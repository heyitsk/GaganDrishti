import { Queue } from 'bullmq';

// ─── Shared Redis connection options ─────────────────────────────────────────
// Used by both the Queue (producer) and the Worker (consumer) so they talk
// to the same Redis instance. Override via .env if needed.
export const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
};

// ─── Scan Queue (producer) ───────────────────────────────────────────────────
// Controllers call scanQueue.add() to enqueue a scan job.
// The Worker in src/workers/scanWorker.js consumes from this same queue.
export const scanQueue = new Queue('scan-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                                       // retry failed jobs up to 3 times
    backoff: { type: 'exponential', delay: 5000 },     // 5s → 10s → 20s
    removeOnComplete: 10,                             // keep last 10 completed jobs in Redis
    removeOnFail: 20,                                 // keep last 20 failed jobs for debugging
  },
});