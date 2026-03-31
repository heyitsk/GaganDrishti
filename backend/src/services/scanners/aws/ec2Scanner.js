import {
  EC2Client,
  DescribeSecurityGroupsCommand,
    EC2ServiceException,
    MonitorInstancesCommand
} from "@aws-sdk/client-ec2";
import dotenv from "dotenv";
dotenv.config();

// ─── EC2 Client ───────────────────────────────────────────────────────────────
// Accepts optional credentials object; falls back to .env if not provided.
function createEC2Client(credentials) {
  return new EC2Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: credentials
      ? {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          ...(credentials.sessionToken && { sessionToken: credentials.sessionToken }),
        }
      : {
          accessKeyId: process.env.ACCESS_KEY,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
  });
}

// ─── Helper: Normalize EC2 errors ────────────────────────────────────────────
function parseEC2Error(caught) {
  if (caught instanceof EC2ServiceException) {
    return `${caught.name}: ${caught.message}`;
  }
  return String(caught);
}

// ─── Helper: Is this rule open to the internet? ───────────────────────────────
// Checks whether any IPv4 CIDR is 0.0.0.0/0 OR any IPv6 CIDR is ::/0.
function isOpenToInternet(rule) {
  const ipv4Open = (rule.IpRanges ?? []).some(
    (r) => r.CidrIp === "0.0.0.0/0"
  );
  const ipv6Open = (rule.Ipv6Ranges ?? []).some(
    (r) => r.CidrIpv6 === "::/0"
  );
  return ipv4Open || ipv6Open;
}

// ─── Helper: Is this rule targeting a dangerous port range? ──────────────────
// Dangerous if:
//   • IpProtocol is "-1" (all traffic — all protocols, all ports)
//   • SSH  : FromPort 22  — ToPort 22
//   • RDP  : FromPort 3389 — ToPort 3389
//   • All ports: FromPort 0 — ToPort 65535
function isDangerousPort(rule) {
  if (rule.IpProtocol === "-1") return true; // all-traffic rule

  const from = rule.FromPort;
  const to = rule.ToPort;

  const isSsh = from === 22 && to === 22;
  const isRdp = from === 3389 && to === 3389;
  const isAllPorts = from === 0 && to === 65535;

  return isSsh || isRdp || isAllPorts;
}

// ─── Helper: Human-readable port label ───────────────────────────────────────
function portLabel(rule) {
  if (rule.IpProtocol === "-1") return "All Traffic (protocol: -1)";
  if (rule.FromPort === rule.ToPort) return `Port ${rule.FromPort}`;
  return `Ports ${rule.FromPort}–${rule.ToPort}`;
}

// ─── Per-group analyser ───────────────────────────────────────────────────────
/**
 * Analyses a single security group's inbound rules (IpPermissions only).
 * Returns a structured findings array and a top-level isFlagged boolean.
 *
 * @param {object} sg - A SecurityGroup object from the AWS SDK response
 * @returns {{ isFlagged: boolean, findings: object[] }}
 */
function analyseSecurityGroup(sg) {
  const rules = sg.IpPermissions ?? [];

  const findings = rules.map((rule) => {
    const openToInternet = isOpenToInternet(rule);
    const dangerousPort = isDangerousPort(rule);
    const isFatal = openToInternet && dangerousPort;

    // Collect the CIDR strings for readability
    const ipv4Ranges = (rule.IpRanges ?? []).map((r) => r.CidrIp);
    const ipv6Ranges = (rule.Ipv6Ranges ?? []).map((r) => r.CidrIpv6);

    let reason;
    if (isFatal) {
      reason = `${portLabel(rule)} is open to the internet (${[...ipv4Ranges, ...ipv6Ranges].join(", ")}) — HIGH RISK.`;
    } else if (dangerousPort && !openToInternet) {
      reason = `${portLabel(rule)} is a sensitive port but is NOT open to the internet — OK.`;
    } else if (openToInternet && !dangerousPort) {
      reason = `${portLabel(rule)} is open to the internet but is not a flagged sensitive port — LOW RISK.`;
    } else {
      reason = `${portLabel(rule)} is restricted — OK.`;
    }

    return {
      protocol: rule.IpProtocol,
      fromPort: rule.IpProtocol === "-1" ? null : rule.FromPort,
      toPort: rule.IpProtocol === "-1" ? null : rule.ToPort,
      ipv4Ranges,
      ipv6Ranges,
      isOpenToInternet: openToInternet,
      isDangerousPort: dangerousPort,
      isFatal,
      reason,
    };
  });

  const isFlagged = findings.some((f) => f.isFatal);

  return { isFlagged, findings };
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────
/**
 * Fetches up to 10 EC2 security groups and audits each one's inbound rules
 * for risky port exposure.
 *
 * Dangerous patterns checked (inbound only):
 *   • IpProtocol "-1"  — all traffic open to 0.0.0.0/0 or ::/0
 *   • Port 22  (SSH)   — open to 0.0.0.0/0 or ::/0
 *   • Port 3389 (RDP)  — open to 0.0.0.0/0 or ::/0
 *   • Ports 0–65535    — open to 0.0.0.0/0 or ::/0
 *
 * @returns {Promise<object>} Structured scan result or { error } on failure
 */
export async function scanEC2SecurityGroups(credentials) {
  const client = createEC2Client(credentials);

  try {
    // Pass an empty filters array so AWS returns ALL security groups.
    // MaxResults: 10 keeps it simple for our current scale.
    const command = new DescribeSecurityGroupsCommand({ MaxResults: 10 });
    const response = await client.send(command);

    const securityGroups = response.SecurityGroups ?? [];

    const groups = securityGroups.map((sg) => {
      const { isFlagged, findings } = analyseSecurityGroup(sg);

      return {
        groupId: sg.GroupId,
        groupName: sg.GroupName,
        description: sg.Description,
        vpcId: sg.VpcId ?? null,
        isFlagged,
        findings,
      };
    });

    const flaggedGroups = groups.filter((g) => g.isFlagged).length;

    return {
      scannedAt: new Date().toISOString(),
      totalGroups: groups.length,
      flaggedGroups,
      groups,
    };
  } catch (caught) {
    return { error: parseEC2Error(caught) };
  }
}
// ── Quick local test ──────────────────────────────────────────────────────────
// scanEC2SecurityGroups().then((result) => {
//   console.log(JSON.stringify(result, null, 2));
// });

//raw output 
//{
//   "scannedAt": "2026-03-31T04:57:18.816Z",
//   "totalGroups": 4,
//   "flaggedGroups": 2,
//   "groups": [
//     {
//       "groupId": "sg-0ae5bedc8b35d8aff",
//       "groupName": "default",
//       "description": "default VPC security group",
//       "vpcId": "vpc-0f7d5faac8fc60db6",
//       "isFlagged": false,
//       "findings": [
//         {
//           "protocol": "-1",
//           "fromPort": null,
//           "toPort": null,
//           "ipv4Ranges": [],
//           "ipv6Ranges": [],
//           "isOpenToInternet": false,
//           "isDangerousPort": true,
//           "isFatal": false,
//           "reason": "All Traffic (protocol: -1) is a sensitive port but is NOT open to the internet — OK."
//         }
//       ]
//     },
//     {
//       "groupId": "sg-0745ead6dba9083f5",
//       "groupName": "aws-sdk-test",
//       "description": "allow ssh and web access",
//       "vpcId": "vpc-0f7d5faac8fc60db6",
//       "isFlagged": true,
//       "findings": [
//         {
//           "protocol": "tcp",
//           "fromPort": 8000,
//           "toPort": 8000,
//           "ipv4Ranges": [
//             "0.0.0.0/0"
//           ],
//           "ipv6Ranges": [],
//           "isOpenToInternet": true,
//           "isDangerousPort": false,
//           "isFatal": false,
//           "reason": "Port 8000 is open to the internet but is not a flagged sensitive port — LOW RISK."
//         },
//         {
//           "protocol": "tcp",
//           "fromPort": 22,
//           "toPort": 22,
//           "ipv4Ranges": [
//             "0.0.0.0/0"
//           ],
//           "ipv6Ranges": [
//             "::/0"
//           ],
//           "isOpenToInternet": true,
//           "isDangerousPort": true,
//           "isFatal": true,
//           "reason": "Port 22 is open to the internet (0.0.0.0/0, ::/0) — HIGH RISK."
//         }
//       ]
//     },
//     {
//       "groupId": "sg-0e1c9dada0441ce14",
//       "groupName": "rds-database",
//       "description": "Created by RDS management console",
//       "vpcId": "vpc-0f7d5faac8fc60db6",
//       "isFlagged": false,
//       "findings": [
//         {
//           "protocol": "tcp",
//           "fromPort": 3306,
//           "toPort": 3306,
//           "ipv4Ranges": [
//             "0.0.0.0/0"
//           ],
//           "ipv6Ranges": [],
//           "isOpenToInternet": true,
//           "isDangerousPort": false,
//           "isFatal": false,
//           "reason": "Port 3306 is open to the internet but is not a flagged sensitive port — LOW RISK."
//         }
//       ]
//     }
//   ]
// }