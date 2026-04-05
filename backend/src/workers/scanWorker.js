import { Worker } from 'bullmq';
import { redisConnection } from '../config/bullmq.js';
import { runSingleScan, runFullScan } from '../services/awsScanOrchestrator.js';
import CloudCredentials from '../models/CloudCredentials.js';
import { resolveCredentials } from '../services/credentialManager.js';
import { getIO } from '../config/socket.js';

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

// ─── Worker lifecycle events ──────────────────────────────────────────────────

// Helper to reliably emit socket events to the user who owns the job
function emitScanUpdate(job, state, extra = {}) {
  try {
    const io = getIO();
    const userId = job.data?.userId;
    if (userId) {
      io.to(`user_${userId}`).emit('scanUpdate', {
        jobId: job.id,
        state,
        ...extra,
      });
    }
  } catch (err) {
    // getIO() throws if socket isn't running; ignore silently in testing/standalone mode
  }
}

// Track whether Redis is currently down so we only log once per outage
let redisOffline = false;

scanWorker.on('active', (job) => {
  console.log(`▶️  Scan job ${job.id} active`);
  emitScanUpdate(job, 'active');
});

scanWorker.on('completed', (job) => {
  if (redisOffline) {
    redisOffline = false;
    console.log('✅ Redis reconnected — scan worker is back online.');
  }
  console.log(`✅ Scan job ${job.id} completed (type: ${job.data.type})`);
  
  // result comes from what the async function inside new Worker() returned
  // specifically: { scan, findings, scannerResults, skipped }
  emitScanUpdate(job, 'completed', { result: job.returnvalue });
});

scanWorker.on('failed', (job, err) => {
  console.error(`❌ Scan job ${job?.id} failed: ${err.message}`);
  if (job) {
    emitScanUpdate(job, 'failed', { error: err.message || String(err) });
  }
});

scanWorker.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    if (!redisOffline) {
      redisOffline = true;
      console.warn('⚠️  Redis unavailable (ECONNREFUSED 127.0.0.1:6379) — scan worker is offline. Retrying in background...');
    }
    // Suppress subsequent ECONNREFUSED spam — retryStrategy handles the backoff
    return;
  }
  // Non-Redis errors always log
  console.error('⚠️  scanWorker encountered an error:', err.message);
});

export default scanWorker;
