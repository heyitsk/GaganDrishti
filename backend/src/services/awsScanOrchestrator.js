import Scan from '../models/Scan.js';
import Finding from '../models/Finding.js';
import { scanS3BucketPublicAccess } from './scanners/aws/s3Scanner.js';
import { scanS3BucketEncryption } from './scanners/aws/s3EncryptionScanner.js';
import { scanEC2SecurityGroups } from './scanners/aws/ec2Scanner.js';
import { scanIAM } from './scanners/aws/iamScanner.js';
import { scanRDSInstances } from './scanners/aws/rdsScanner.js';

// ─── Severity Constants ──────────────────────────────────────────────────────
const SEVERITY = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

// ─── Transformer: S3 Public Access ───────────────────────────────────────────
// Creates a Finding if the bucket is publicly accessible.
function transformS3PublicAccessFindings(scanId, userId, raw) {
  if (raw.error && !raw.bucketName) return []; // total failure, nothing to record

  const findings = [];

  if (raw.isPublic) {
    findings.push({
      scanId,
      userId,
      provider: 'AWS',
      service: 'S3',
      resource: raw.bucketName,
      resourceName: raw.bucketName,
      issue: raw.reason,
      severity: SEVERITY.HIGH,
      details: raw.details,
      recommendation: 'Review and restrict your S3 bucket policy and ACL settings. Enable S3 Block Public Access at the bucket or account level.',
    });
  }

  return findings;
}

// ─── Transformer: S3 Encryption ──────────────────────────────────────────────
// Creates a Finding if the bucket has no default encryption configured.
function transformS3EncryptionFindings(scanId, userId, raw) {
  if (raw.error && !raw.bucketName) return [];

  const findings = [];

  if (!raw.isEncrypted) {
    findings.push({
      scanId,
      userId,
      provider: 'AWS',
      service: 'S3',
      resource: raw.bucketName,
      resourceName: raw.bucketName,
      issue: raw.reason,
      severity: SEVERITY.MEDIUM,
      details: { rules: raw.rules, primaryAlgorithm: raw.primaryAlgorithm },
      recommendation: 'Enable default server-side encryption (SSE-S3 or SSE-KMS) on this bucket.',
    });
  }

  return findings;
}

// ─── Transformer: EC2 Security Groups ────────────────────────────────────────
// Creates a Finding per flagged security group (open dangerous ports to internet).
function transformEC2Findings(scanId, userId, raw) {
  if (raw.error) return [];

  const findings = [];
  const groups = raw.groups ?? [];

  for (const group of groups) {
    if (!group.isFlagged) continue;

    // Collect the fatal rules for the issue description
    const fatalRules = (group.findings ?? []).filter(f => f.isFatal);
    const portsDescription = fatalRules.map(f => f.reason).join('; ');

    findings.push({
      scanId,
      userId,
      provider: 'AWS',
      service: 'EC2 Security Group',
      resource: group.groupId,
      resourceName: group.groupName,
      issue: `Security group has dangerous ports open to the internet: ${portsDescription}`,
      severity: SEVERITY.CRITICAL,
      details: {
        groupId: group.groupId,
        groupName: group.groupName,
        description: group.description,
        vpcId: group.vpcId,
        findings: group.findings,
      },
      recommendation: 'Restrict inbound rules to specific IP ranges. Never allow 0.0.0.0/0 access to SSH (22), RDP (3389), or all ports.',
    });
  }

  return findings;
}

// ─── Transformer: IAM ────────────────────────────────────────────────────────
// Creates Findings for: root MFA off, per-user console-without-MFA, stale keys,
// dangerous policies.
function transformIAMFindings(scanId, userId, raw) {
  if (raw.error) return [];

  const findings = [];

  // Account-level: Root MFA
  const rootMFA = raw.accountChecks?.rootMFA;
  if (rootMFA && rootMFA.isFlagged) {
    findings.push({
      scanId,
      userId,
      provider: 'AWS',
      service: 'IAM',
      resource: 'root-account',
      resourceName: 'Root Account',
      issue: rootMFA.reason,
      severity: SEVERITY.CRITICAL,
      details: { rootMFA },
      recommendation: 'Enable MFA on the root account immediately. Use a hardware MFA device for maximum security.',
    });
  }

  // Per-user checks
  const users = raw.users ?? [];
  for (const user of users) {
    if (!user.isFlagged) continue;

    const checks = user.checks ?? {};

    // Console login without MFA
    if (checks.mfaAndLogin?.isFlagged) {
      findings.push({
        scanId,
        userId,
        provider: 'AWS',
        service: 'IAM',
        resource: user.userId,
        resourceName: user.userName,
        issue: checks.mfaAndLogin.reason,
        severity: SEVERITY.HIGH,
        details: { userName: user.userName, mfaAndLogin: checks.mfaAndLogin },
        recommendation: 'Enable MFA for this IAM user or remove console access if not needed.',
      });
    }

    // Stale / never-used access keys
    if (checks.accessKeys?.isFlagged) {
      findings.push({
        scanId,
        userId,
        provider: 'AWS',
        service: 'IAM',
        resource: user.userId,
        resourceName: user.userName,
        issue: checks.accessKeys.reason,
        severity: SEVERITY.MEDIUM,
        details: { userName: user.userName, accessKeys: checks.accessKeys },
        recommendation: 'Rotate or delete stale and unused access keys. Follow the 90-day rotation policy.',
      });
    }

    // Dangerous attached policies
    if (checks.attachedPolicies?.isFlagged) {
      const dangerousPolicies = checks.attachedPolicies.dangerousPolicies ?? [];
      // Use the highest risk level among the dangerous policies
      const hasCritical = dangerousPolicies.some(p => p.riskLevel === 'CRITICAL');
      const hasHigh = dangerousPolicies.some(p => p.riskLevel === 'HIGH');
      const severity = hasCritical ? SEVERITY.CRITICAL : hasHigh ? SEVERITY.HIGH : SEVERITY.MEDIUM;

      findings.push({
        scanId,
        userId,
        provider: 'AWS',
        service: 'IAM',
        resource: user.userId,
        resourceName: user.userName,
        issue: checks.attachedPolicies.reason,
        severity,
        details: { userName: user.userName, attachedPolicies: checks.attachedPolicies },
        recommendation: 'Replace broad managed policies with least-privilege custom policies scoped to the user\'s actual needs.',
      });
    }
  }

  return findings;
}

// ─── Transformer: RDS ────────────────────────────────────────────────────────
// Creates Findings for: publicly accessible instances, unencrypted storage.
function transformRDSFindings(scanId, userId, raw) {
  if (raw.error) return [];

  const findings = [];
  const instances = raw.instances ?? [];

  for (const inst of instances) {
    if (!inst.isFlagged) continue;

    // Public access finding
    if (inst.publicAccess?.isPublic) {
      findings.push({
        scanId,
        userId,
        provider: 'AWS',
        service: 'RDS',
        resource: inst.dbInstanceId,
        resourceName: inst.dbInstanceId,
        issue: inst.publicAccess.reason,
        severity: SEVERITY.CRITICAL,
        details: {
          dbInstanceId: inst.dbInstanceId,
          engine: inst.engine,
          publicAccess: inst.publicAccess,
        },
        recommendation: 'Disable public accessibility on this RDS instance and restrict security group inbound rules to private CIDRs only.',
      });
    }

    // Unencrypted storage finding
    if (!inst.storageEncryption?.isEncrypted) {
      findings.push({
        scanId,
        userId,
        provider: 'AWS',
        service: 'RDS',
        resource: inst.dbInstanceId,
        resourceName: inst.dbInstanceId,
        issue: inst.storageEncryption.reason,
        severity: SEVERITY.HIGH,
        details: {
          dbInstanceId: inst.dbInstanceId,
          engine: inst.engine,
          storageEncryption: inst.storageEncryption,
        },
        recommendation: 'Enable storage encryption. Note: you cannot enable encryption on an existing unencrypted instance — you must create an encrypted snapshot and restore from it.',
      });
    }
  }

  return findings;
}

// ─── Count findings by severity ──────────────────────────────────────────────
function countSeverities(findings) {
  let criticalCount = 0, highCount = 0, mediumCount = 0;
  for (const f of findings) {
    if (f.severity === SEVERITY.CRITICAL) criticalCount++;
    else if (f.severity === SEVERITY.HIGH) highCount++;
    else if (f.severity === SEVERITY.MEDIUM) mediumCount++;
  }
  return { totalFindings: findings.length, criticalCount, highCount, mediumCount };
}

// ─── Run a Single Scanner ────────────────────────────────────────────────────
/**
 * Runs a single scanner, persists the Scan + Findings, and returns both.
 *
 * @param {string}  scannerName - e.g. 's3PublicAccess', 'ec2', 'iam', 'rds'
 * @param {ObjectId} userId
 * @param {ObjectId} credentialId
 * @param {object}  creds - resolved AWS credentials
 * @param {object}  params - scanner-specific params (bucketName, instanceId, etc.)
 * @returns {{ scan, findings }}
 */
export async function runSingleScan(scannerName, userId, credentialId, creds, params = {}) {
  // Create scan document
  const scan = await Scan.create({
    userId,
    credentialId,
    provider: 'AWS',
    status: 'running',
  });

  try {
    let rawResult;
    let findings = [];

    switch (scannerName) {
      case 's3PublicAccess':
        rawResult = await scanS3BucketPublicAccess(params.bucketName, creds);
        findings = transformS3PublicAccessFindings(scan._id, userId, rawResult);
        break;

      case 's3Encryption':
        rawResult = await scanS3BucketEncryption(params.bucketName, creds);
        findings = transformS3EncryptionFindings(scan._id, userId, rawResult);
        break;

      case 'ec2':
        rawResult = await scanEC2SecurityGroups(creds);
        findings = transformEC2Findings(scan._id, userId, rawResult);
        break;

      case 'iam':
        rawResult = await scanIAM(creds);
        findings = transformIAMFindings(scan._id, userId, rawResult);
        break;

      case 'rds':
        rawResult = await scanRDSInstances(params.instanceId, creds);
        findings = transformRDSFindings(scan._id, userId, rawResult);
        break;

      default:
        throw new Error(`Unknown scanner: ${scannerName}`);
    }

    // If the scanner reported a hard error (e.g. bucket doesn't exist, RDS instance not found),
    // fail the scan rather than completing it silently with 0 findings.
    if (rawResult?.error) {
      throw new Error(rawResult.error);
    }

    // Persist findings
    const savedFindings = findings.length > 0
      ? await Finding.insertMany(findings)
      : [];

    // Mark scan completed with counts
    const counts = countSeverities(findings);
    await scan.markCompleted(counts);

    return { scan, findings: savedFindings };

  } catch (error) {
    await scan.markFailed();
    throw error;
  }
}

// ─── Run Full Scan (All Scanners) ────────────────────────────────────────────
/**
 * Runs all applicable scanners, persists a single Scan document + all Findings.
 *
 * @param {ObjectId} userId
 * @param {ObjectId} credentialId
 * @param {object}   creds - resolved AWS credentials
 * @param {object}   options - { s3BucketName?, rdsInstanceId? }
 * @returns {{ scan, findings, skipped }}
 */
export async function runFullScan(userId, credentialId, creds, options = {}) {
  const { s3BucketName, rdsInstanceId } = options;

  // Create a single Scan document for the full scan
  const scan = await Scan.create({
    userId,
    credentialId,
    provider: 'AWS',
    status: 'running',
  });

  try {
    // Build scanner tasks — each returns { name, promise } or is skipped
    const tasks = [];
    const skipped = [];

    if (s3BucketName) {
      tasks.push({
        name: 's3PublicAccess',
        promise: scanS3BucketPublicAccess(s3BucketName, creds),
        transform: (raw) => transformS3PublicAccessFindings(scan._id, userId, raw),
      });
      tasks.push({
        name: 's3Encryption',
        promise: scanS3BucketEncryption(s3BucketName, creds),
        transform: (raw) => transformS3EncryptionFindings(scan._id, userId, raw),
      });
    } else {
      skipped.push('s3PublicAccess', 's3Encryption');
    }

    tasks.push({
      name: 'ec2',
      promise: scanEC2SecurityGroups(creds),
      transform: (raw) => transformEC2Findings(scan._id, userId, raw),
    });

    tasks.push({
      name: 'iam',
      promise: scanIAM(creds),
      transform: (raw) => transformIAMFindings(scan._id, userId, raw),
    });

    if (rdsInstanceId) {
      tasks.push({
        name: 'rds',
        promise: scanRDSInstances(rdsInstanceId, creds),
        transform: (raw) => transformRDSFindings(scan._id, userId, raw),
      });
    } else {
      skipped.push('rds');
    }

    // Run all scanner promises in parallel
    const results = await Promise.allSettled(tasks.map(t => t.promise));

    // Transform results → findings
    let allFindings = [];
    const scannerResults = {};

    results.forEach((outcome, index) => {
      const task = tasks[index];
      if (outcome.status === 'fulfilled') {
        const findings = task.transform(outcome.value);
        allFindings = allFindings.concat(findings);
        scannerResults[task.name] = { status: 'success' };
      } else {
        scannerResults[task.name] = {
          status: 'error',
          error: outcome.reason?.message ?? String(outcome.reason),
        };
      }
    });

    // Add skipped scanners to results
    for (const name of skipped) {
      scannerResults[name] = {
        status: 'skipped',
        reason: `Required input not provided. Pass ${
          name.startsWith('s3') ? '"s3BucketName"' : '"rdsInstanceId"'
        } in the request body to run this scanner.`,
      };
    }

    // Persist all findings in one batch
    const savedFindings = allFindings.length > 0
      ? await Finding.insertMany(allFindings)
      : [];

    // Mark scan completed
    const counts = countSeverities(allFindings);
    await scan.markCompleted(counts);

    return { scan, findings: savedFindings, scannerResults, skipped };

  } catch (error) {
    await scan.markFailed();
    throw error;
  }
}
