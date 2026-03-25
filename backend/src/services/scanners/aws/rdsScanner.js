import {
  RDSClient,
  DescribeDBInstancesCommand,
  RDSServiceException,
} from "@aws-sdk/client-rds";
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
} from "@aws-sdk/client-ec2";
import dotenv from "dotenv";
dotenv.config();

// ─── Client Factories ─────────────────────────────────────────────────────────
// TODO: Replace env vars with user-supplied credentials when frontend is ready.
function createRDSClient() {
  return new RDSClient({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
  });
}

function createEC2Client() {
  return new EC2Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
  });
}

// ─── Helper: Normalize RDS errors ────────────────────────────────────────────
function parseRDSError(caught) {
  if (caught instanceof RDSServiceException) {
    return `${caught.name}: ${caught.message}`;
  }
  return String(caught);
}

// ─── Helper: Is this inbound rule open to the internet? ──────────────────────
// Returns true if any IPv4 CIDR is 0.0.0.0/0 OR any IPv6 CIDR is ::/0.
function isOpenToInternet(rule) {
  const ipv4Open = (rule.IpRanges ?? []).some((r) => r.CidrIp === "0.0.0.0/0");
  const ipv6Open = (rule.Ipv6Ranges ?? []).some((r) => r.CidrIpv6 === "::/0");
  return ipv4Open || ipv6Open;
}

// ─── Helper: Does this rule expose the database port? ────────────────────────
// RDS returns the actual DB port via instance.Endpoint.Port.
// We flag a rule only if it is open to the internet AND covers the DB port.
// IpProtocol "-1" means ALL traffic (all ports) — always covers the DB port.
function exposesDbPort(rule, dbPort) {
  if (rule.IpProtocol === "-1") return true; // all-traffic rule covers every port
  const from = rule.FromPort ?? 0;
  const to = rule.ToPort ?? 65535;
  return from <= dbPort && dbPort <= to;
}

// ─── Fetch Security Group Rules ───────────────────────────────────────────────
async function fetchSecurityGroupFindings(ec2Client, sgIds, dbPort) {
  if (!sgIds || sgIds.length === 0) return [];

  const command = new DescribeSecurityGroupsCommand({ GroupIds: sgIds });
  const response = await ec2Client.send(command);
  const securityGroups = response.SecurityGroups ?? [];

  return securityGroups.map((sg) => {
    const inboundRules = sg.IpPermissions ?? [];

    // Find rules that are both open to the internet AND expose the DB port.
    const dangerousRules = inboundRules
      .filter((rule) => isOpenToInternet(rule) && exposesDbPort(rule, dbPort))
      .map((rule) => ({
        protocol: rule.IpProtocol,
        fromPort: rule.IpProtocol === "-1" ? null : rule.FromPort,
        toPort: rule.IpProtocol === "-1" ? null : rule.ToPort,
        ipv4Ranges: (rule.IpRanges ?? []).map((r) => r.CidrIp),
        ipv6Ranges: (rule.Ipv6Ranges ?? []).map((r) => r.CidrIpv6),
      }));

    return {
      groupId: sg.GroupId,
      groupName: sg.GroupName,
      hasOpenInbound: dangerousRules.length > 0,
      openRules: dangerousRules,
    };
  });
}

// ─── Check: Public Access ─────────────────────────────────────────────────────
/**
 * Determines whether an RDS instance is truly publicly accessible.
 *
 * TRUE RISK = PubliclyAccessible flag is true
 *             AND at least one VPC Security Group has an inbound rule
 *             that is open to 0.0.0.0/0 (or ::/0) on the database port.
 *
 * Why both conditions?
 *  - PubliclyAccessible=true only means the instance HAS a public DNS endpoint.
 *    Without an open SG rule, no traffic can actually reach it.
 *  - An open SG rule on a private instance (PubliclyAccessible=false)
 *    has no effect because no public IP/DNS exists.
 */
async function checkPublicAccess(ec2Client, instance) {
  const publiclyAccessibleFlag = instance.PubliclyAccessible === true;
  const dbPort = instance.Endpoint?.Port ?? 0;

  // Extract all VPC Security Group IDs attached to this instance.
  const sgIds = (instance.VpcSecurityGroups ?? [])
    .filter((sg) => sg.Status === "active")
    .map((sg) => sg.VpcSecurityGroupId);

  // Fetch and analyse the security groups.
  const sgFindings = await fetchSecurityGroupFindings(ec2Client, sgIds, dbPort);

  // At least one SG must have an open inbound rule on the DB port.
  const sgHasOpenInbound = sgFindings.some((sg) => sg.hasOpenInbound);

  // True public exposure only if BOTH conditions are met.
  const isPublic = publiclyAccessibleFlag && sgHasOpenInbound;

  // ── Human-readable reason ─────────────────────────────────────────────────
  let reason;
  if (isPublic) {
    const openGroups = sgFindings
      .filter((sg) => sg.hasOpenInbound)
      .map((sg) => sg.groupId)
      .join(", ");
    reason = `Instance has a public endpoint AND security group(s) [${openGroups}] allow inbound traffic from 0.0.0.0/0 on port ${dbPort} — HIGH RISK.`;
  } else if (publiclyAccessibleFlag && !sgHasOpenInbound) {
    reason = `Instance has a public endpoint (PubliclyAccessible=true) but all security groups restrict inbound access on port ${dbPort} — OK.`;
  } else if (!publiclyAccessibleFlag && sgHasOpenInbound) {
    reason = `Security groups allow open inbound but instance has no public endpoint (PubliclyAccessible=false) — OK (private instance).`;
  } else {
    reason = `Instance has no public endpoint and security groups restrict inbound access — OK.`;
  }

  return {
    isPublic,
    reason,
    details: {
      publiclyAccessibleFlag,
      dbPort,
      sgHasOpenInbound,
      securityGroups: sgFindings,
    },
  };
}

// ─── Check: Storage Encryption ────────────────────────────────────────────────
/**
 * Reads the StorageEncrypted flag from the DB instance.
 * Unencrypted storage = data at rest is at risk.
 *
 * @param {object} instance - A DBInstance object from DescribeDBInstances
 * @returns {{ isEncrypted: boolean, reason: string }}
 */
function checkStorageEncryption(instance) {
  const isEncrypted = instance.StorageEncrypted === true;
  const reason = isEncrypted
    ? "Storage is encrypted at rest — OK."
    : "Storage is NOT encrypted at rest — data is at risk. Enable encryption immediately.";
  return { isEncrypted, reason };
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────
/**
 * Scans a specific RDS DB instance for security issues:
 *   1. Public access (PubliclyAccessible flag + SG inbound rules on DB port)
 *   2. Storage encryption (StorageEncrypted flag)
 *
 * Currently targets a hardcoded instance identifier.
 * TODO: Accept instance identifier as a parameter (user-submitted from frontend).
 *
 * @returns {Promise<object>} Structured security report or { error } on failure
 */
export async function scanRDSInstances(instanceId) {
  const rdsClient = createRDSClient();
  const ec2Client = createEC2Client();

  try {
    // If instanceId is provided, scan that specific instance; otherwise scan all.
    const commandParams = instanceId
      ? { DBInstanceIdentifier: instanceId }
      : {};
    const command = new DescribeDBInstancesCommand(commandParams);
    const response = await rdsClient.send(command);
    const dbInstances = response.DBInstances ?? [];

    // Run public-access check (async, needs SG lookup) and encryption check
    // (sync, reads local field) for each instance.
    const instances = await Promise.all(
      dbInstances.map(async (instance) => {
        const [publicAccess, storageEncryption] = await Promise.all([
          checkPublicAccess(ec2Client, instance),
          Promise.resolve(checkStorageEncryption(instance)),
        ]);

        // Instance is flagged if it is publicly exposed OR storage is unencrypted.
        const isFlagged = publicAccess.isPublic || !storageEncryption.isEncrypted;

        return {
          dbInstanceId: instance.DBInstanceIdentifier,
          dbInstanceClass: instance.DBInstanceClass,
          engine: instance.Engine,
          engineVersion: instance.EngineVersion,
          status: instance.DBInstanceStatus,
          publicAccess,
          storageEncryption,
          isFlagged,
        };
      })
    );

    const flaggedCount = instances.filter((i) => i.isFlagged).length;

    return {
      scannedAt: new Date().toISOString(),
      totalInstances: instances.length,
      flaggedInstances: flaggedCount,
      instances,
    };
  } catch (caught) {
    return { error: parseRDSError(caught) };
  }
}
