import { runSingleScan, runFullScan } from '../services/awsScanOrchestrator.js';
import CloudCredentials from '../models/CloudCredentials.js';
import { resolveCredentials } from '../services/credentialManager.js';
import { scanQueue } from '../config/bullmq.js';

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

// ─── Queue: Single Scan ───────────────────────────────────────────────────────
/**
 * Enqueues a single-scanner job. Returns 202 + jobId immediately.
 * Request body: { credentialId, scannerName, params? }
 *   scannerName: 's3PublicAccess' | 's3Encryption' | 'ec2' | 'iam' | 'rds'
 *   params: { bucketName?, instanceId? }
 */
const VALID_SCANNERS = new Set(['s3PublicAccess', 's3Encryption', 'ec2', 'iam', 'rds']);

export const enqueueSingleScan = async (req, res) => {
  const { credentialId, scannerName, params = {} } = req.body ?? {};

  if (!credentialId) {
    return res.status(400).json({ error: 'credentialId is required' });
  }
  if (!scannerName) {
    return res.status(400).json({ error: 'scannerName is required' });
  }
  if (!VALID_SCANNERS.has(scannerName)) {
    return res.status(400).json({
      error: `Invalid scannerName: "${scannerName}". Valid values are: ${[...VALID_SCANNERS].join(', ')}`,
    });
  }

  try {
    const job = await scanQueue.add('single-scan', {
      type: 'single',
      userId: String(req.user._id),
      credentialId: String(credentialId),
      scannerName,
      params,
    });

    return res.status(202).json({
      message: 'Scan job queued',
      jobId: job.id,
      status: 'queued',
    });
  } catch (error) {
    console.error('Enqueue single scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to queue single scan' });
  }
};

// ─── Queue: Full Scan ─────────────────────────────────────────────────────────
/**
 * Enqueues a full-scan job (all scanners). Returns 202 + jobId immediately.
 * Request body: { credentialId, options? }
 *   options: { s3BucketName?, rdsInstanceId? }
 */
export const enqueueFullScan = async (req, res) => {
  const { credentialId, options = {} } = req.body ?? {};

  if (!credentialId) {
    return res.status(400).json({ error: 'credentialId is required' });
  }

  try {
    const job = await scanQueue.add('full-scan', {
      type: 'full',
      userId: String(req.user._id),
      credentialId: String(credentialId),
      options,
    });

    return res.status(202).json({
      message: 'Full scan job queued',
      jobId: job.id,
      status: 'queued',
    });
  } catch (error) {
    console.error('Enqueue full scan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to queue full scan' });
  }
};

// ─── Queue: Job Status ────────────────────────────────────────────────────────
/**
 * Polls the status of a queued scan job.
 * Returns BullMQ job state + result (scan _id, findings count) when completed.
 */
export const getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await scanQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: `Job ${jobId} not found` });
    }

    const state = await job.getState();   // 'waiting' | 'active' | 'completed' | 'failed'
    const result = job.returnvalue ?? null;
    const failReason = job.failedReason ?? null;

    // Return 422 whenever the job has errored — covers both:
    //   'failed'  → exhausted all retry attempts
    //   'delayed' → failed but BullMQ is about to retry (failedReason is already set)
    const httpStatus = failReason ? 422 : 200;

    return res.status(httpStatus).json({
      jobId,
      state,
      jobName: job.name,
      ...(result && { result }),
      ...(failReason && { error: failReason }),
    });
  } catch (error) {
    console.error('Get job status error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get job status' });
  }
};
