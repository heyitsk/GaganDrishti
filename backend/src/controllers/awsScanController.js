import { runSingleScan, runFullScan } from '../services/awsScanOrchestrator.js';
import CloudCredentials from '../models/CloudCredentials.js';
import { resolveCredentials } from '../services/credentialManager.js';

// ─── Helper: Resolve credentials from credentialId ───────────────────────────
/**
 * Looks up a CloudCredentials document by ID + userId, then resolves
 * usable AWS credentials (role → AssumeRole, keys → decrypt).
 * Returns { creds, credentialId } — creds is null if no credentialId provided.
 */
async function getCredentials(credentialId, userId) {
  if (!credentialId) return { creds: null, credentialId: null };

  const account = await CloudCredentials.findOne({
    _id: credentialId,
    userId,
    isActive: true,
  });

  if (!account) {
    throw new Error('Account not found or inactive');
  }

  const creds = await resolveCredentials(account);
  return { creds, credentialId: account._id };
}

// ─── S3 Public Access ─────────────────────────────────────────────────────────
export const scanS3PublicAccess = async (req, res) => {
  const { bucketName } = req.params;

  if (!bucketName) {
    return res.status(400).json({ error: 'bucketName is required' });
  }

  try {
    const { creds, credentialId } = await getCredentials(
      req.body?.credentialId || req.query?.credentialId,
      req.user._id
    );

    const result = await runSingleScan('s3PublicAccess', req.user._id, credentialId, creds, { bucketName });
    return res.status(200).json(result);
  } catch (error) {
    console.error('S3 Public Access scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to scan S3 bucket public access' });
  }
};

// ─── S3 Encryption ────────────────────────────────────────────────────────────
export const scanS3Encryption = async (req, res) => {
  const { bucketName } = req.params;

  if (!bucketName) {
    return res.status(400).json({ error: 'bucketName is required' });
  }

  try {
    const { creds, credentialId } = await getCredentials(
      req.body?.credentialId || req.query?.credentialId,
      req.user._id
    );

    const result = await runSingleScan('s3Encryption', req.user._id, credentialId, creds, { bucketName });
    return res.status(200).json(result);
  } catch (error) {
    console.error('S3 Encryption scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to scan S3 bucket encryption' });
  }
};

// ─── EC2 Security Groups ─────────────────────────────────────────────────────
export const scanEC2 = async (req, res) => {
  try {
    const { creds, credentialId } = await getCredentials(
      req.body?.credentialId || req.query?.credentialId,
      req.user._id
    );

    const result = await runSingleScan('ec2', req.user._id, credentialId, creds);
    return res.status(200).json(result);
  } catch (error) {
    console.error('EC2 scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to scan EC2 security groups' });
  }
};

// ─── IAM ──────────────────────────────────────────────────────────────────────
export const scanIAMUsers = async (req, res) => {
  try {
    const { creds, credentialId } = await getCredentials(
      req.body?.credentialId || req.query?.credentialId,
      req.user._id
    );

    const result = await runSingleScan('iam', req.user._id, credentialId, creds);
    return res.status(200).json(result);
  } catch (error) {
    console.error('IAM scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to scan IAM' });
  }
};

// ─── RDS ──────────────────────────────────────────────────────────────────────
export const scanRDS = async (req, res) => {
  const { instanceId } = req.params;

  try {
    const { creds, credentialId } = await getCredentials(
      req.body?.credentialId || req.query?.credentialId,
      req.user._id
    );

    const result = await runSingleScan('rds', req.user._id, credentialId, creds, { instanceId });
    return res.status(200).json(result);
  } catch (error) {
    console.error('RDS scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to scan RDS instances' });
  }
};

// ─── Scan All ─────────────────────────────────────────────────────────────────
/**
 * Runs all AWS scanners in parallel, persists a single Scan + all Findings.
 * Request body (all fields optional):
 *   { s3BucketName: string, rdsInstanceId: string, credentialId: string }
 */
export const scanAll = async (req, res) => {
  const { s3BucketName, rdsInstanceId, credentialId: credId } = req.body ?? {};

  try {
    const { creds, credentialId } = await getCredentials(credId, req.user._id);

    const result = await runFullScan(req.user._id, credentialId, creds, {
      s3BucketName,
      rdsInstanceId,
    });

    return res.status(200).json({
      scan: result.scan,
      findings: result.findings,
      scannerResults: result.scannerResults,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('Scan All error:', error);
    return res.status(500).json({ error: error.message || 'Failed to run scan-all' });
  }
};
