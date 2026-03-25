import { scanS3BucketPublicAccess } from '../services/scanners/aws/s3Scanner.js';
import { scanS3BucketEncryption } from '../services/scanners/aws/s3EncryptionScanner.js';
import { scanEC2SecurityGroups } from '../services/scanners/aws/ec2Scanner.js';
import { scanIAM } from '../services/scanners/aws/iamScanner.js';
import { scanRDSInstances } from '../services/scanners/aws/rdsScanner.js';

// ─── S3 Public Access ─────────────────────────────────────────────────────────
export const scanS3PublicAccess = async (req, res) => {
  const { bucketName } = req.params;

  if (!bucketName) {
    return res.status(400).json({ error: 'bucketName is required' });
  }

  try {
    const result = await scanS3BucketPublicAccess(bucketName);
    return res.status(200).json(result);
  } catch (error) {
    console.error('S3 Public Access scan error:', error);
    return res.status(500).json({ error: 'Failed to scan S3 bucket public access' });
  }
};

// ─── S3 Encryption ────────────────────────────────────────────────────────────
export const scanS3Encryption = async (req, res) => {
  const { bucketName } = req.params;

  if (!bucketName) {
    return res.status(400).json({ error: 'bucketName is required' });
  }

  try {
    const result = await scanS3BucketEncryption(bucketName);
    return res.status(200).json(result);
  } catch (error) {
    console.error('S3 Encryption scan error:', error);
    return res.status(500).json({ error: 'Failed to scan S3 bucket encryption' });
  }
};

// ─── EC2 Security Groups ─────────────────────────────────────────────────────
export const scanEC2 = async (req, res) => {
  try {
    const result = await scanEC2SecurityGroups();
    return res.status(200).json(result);
  } catch (error) {
    console.error('EC2 scan error:', error);
    return res.status(500).json({ error: 'Failed to scan EC2 security groups' });
  }
};

// ─── IAM ──────────────────────────────────────────────────────────────────────
export const scanIAMUsers = async (req, res) => {
  try {
    const result = await scanIAM();
    return res.status(200).json(result);
  } catch (error) {
    console.error('IAM scan error:', error);
    return res.status(500).json({ error: 'Failed to scan IAM' });
  }
};

// ─── RDS ──────────────────────────────────────────────────────────────────────
export const scanRDS = async (req, res) => {
  // instanceId is optional — if omitted, all instances are scanned
  const { instanceId } = req.params;

  try {
    const result = await scanRDSInstances(instanceId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('RDS scan error:', error);
    return res.status(500).json({ error: 'Failed to scan RDS instances' });
  }
};

// ─── Scan All ─────────────────────────────────────────────────────────────────
/**
 * Runs all AWS scanners in parallel.
 * Request body (all fields optional):
 *   { s3BucketName: string, rdsInstanceId: string }
 *
 * Scanners that require input are skipped (marked "skipped") if the
 * corresponding field is not provided.
 */
export const scanAll = async (req, res) => {
  const { s3BucketName, rdsInstanceId } = req.body ?? {};

  // Build a map of scanner name → Promise (or null if skipped)
  const scanners = {
    s3PublicAccess: s3BucketName
      ? scanS3BucketPublicAccess(s3BucketName)
      : null,
    s3Encryption: s3BucketName
      ? scanS3BucketEncryption(s3BucketName)
      : null,
    ec2SecurityGroups: scanEC2SecurityGroups(),
    iam: scanIAM(),
    rds: rdsInstanceId
      ? scanRDSInstances(rdsInstanceId)
      : scanRDSInstances(),  // scans all instances when no ID provided
  };

  try {
    // Separate runnable scanners from skipped ones
    const entries = Object.entries(scanners);
    const runnableEntries = entries.filter(([, promise]) => promise !== null);
    const skippedEntries = entries.filter(([, promise]) => promise === null);

    // Run all non-skipped scanners in parallel — allSettled so one failure
    // doesn't kill the entire batch
    const settled = await Promise.allSettled(
      runnableEntries.map(([, promise]) => promise)
    );

    // Assemble the results object
    const results = {};

    runnableEntries.forEach(([name], index) => {
      const outcome = settled[index];
      if (outcome.status === 'fulfilled') {
        results[name] = { status: 'success', data: outcome.value };
      } else {
        results[name] = {
          status: 'error',
          error: outcome.reason?.message ?? String(outcome.reason),
        };
      }
    });

    skippedEntries.forEach(([name]) => {
      results[name] = {
        status: 'skipped',
        reason: `Required input not provided. Pass ${
          name.startsWith('s3') ? '"s3BucketName"' : '"rdsInstanceId"'
        } in the request body to run this scanner.`,
      };
    });

    return res.status(200).json({
      scannedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Scan All error:', error);
    return res.status(500).json({ error: 'Failed to run scan-all' });
  }
};
