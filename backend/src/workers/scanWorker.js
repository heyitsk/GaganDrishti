import { Worker } from 'bullmq';
import { redisConnection } from '../config/bullmq.js';
import { runSingleScan, runFullScan } from '../services/awsScanOrchestrator.js';
import CloudCredentials from '../models/CloudCredentials.js';
import { resolveCredentials } from '../services/credentialManager.js';

// ─── Credential resolver ─────────────────────────────────────────────────────
// Re-resolves credentials from MongoDB at execution time (Option A).
// No secrets are stored in Redis — only the credentialId travels in the job payload.
async function resolveCredentialsFromId(credentialId, userId) {
  const account = await CloudCredentials.findOne({
    _id: credentialId,
    userId,
    isActive: true,
  });

  if (!account) {
    throw new Error(`Credential not found or inactive (id: ${credentialId})`);
  }

  return resolveCredentials(account);
}

// ─── Worker (consumer) ───────────────────────────────────────────────────────
// Listens to 'scan-queue' and processes each job by calling the orchestrator.
//
// Job payload schema:
//   type: 'single' | 'full'
//   userId: string
//   credentialId: string
//   scannerName: string          (only for type: 'single')
//   params: object               (only for type: 'single', e.g. { bucketName })
//   options: object              (only for type: 'full', e.g. { s3BucketName, rdsInstanceId })

const scanWorker = new Worker(
  'scan-queue',
  async (job) => {
    const { type, userId, credentialId, scannerName, params = {}, options = {} } = job.data;

    // Resolve fresh AWS credentials from MongoDB — no secrets in Redis
    const creds = credentialId
      ? await resolveCredentialsFromId(credentialId, userId)
      : null;

    if (type === 'single') {
      return await runSingleScan(scannerName, userId, credentialId, creds, params);
    }

    if (type === 'full') {
      return await runFullScan(userId, credentialId, creds, options);
    }

    throw new Error(`Unknown job type: "${type}". Expected "single" or "full".`);
  },
  {
    connection: redisConnection,
    concurrency: 5,    // up to 5 scans processed in parallel
  }
);

// ─── Worker lifecycle events ──────────────────────────────────────────────────
scanWorker.on('completed', (job) => {
  console.log(`✅ Scan job ${job.id} completed (type: ${job.data.type})`);
});

scanWorker.on('failed', (job, err) => {
  console.error(`❌ Scan job ${job?.id} failed: ${err.message}`);
});

scanWorker.on('error', (err) => {
  console.error('⚠️  scanWorker encountered an error:', err.message);
});

export default scanWorker;
