import { Queue } from 'bullmq';
import Redis from 'ioredis';
// ─── Shared Redis connection options ─────────────────────────────────────────
export const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  // Required by BullMQ — lets it manage retries itself rather than ioredis throwing
  maxRetriesPerRequest: null,
  // Back off gradually: 500ms → 1s → 1.5s ... capped at 30s
  // Without this, ioredis reconnects 100s of times per second and floods logs
  retryStrategy: (times) => Math.min(times * 500, 30_000),
};

// ─── Scan Queue (producer) ───────────────────────────────────────────────────
// Controllers call scanQueue.add() to enqueue a scan job.
// The Worker in src/workers/scanWorker.js consumes from this same queue.
export const scanQueue = new Queue('scan-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                                       // retry failed jobs up to 3 times
    backoff: { type: 'exponential', delay: 5000 },     // 5s → 10s → 20s
    removeOnComplete: 10,                              // keep last 10 completed jobs in Redis
    removeOnFail: 20,                                  // keep last 20 failed jobs for debugging
  },
});

// Attach an error listener immediately so ioredis doesn't print raw stack traces to stderr.
// Without this, Node.js prints every ECONNREFUSED attempt directly to stderr
// because the Queue's internal ioredis connection has no error listener.
// ECONNREFUSED is silenced here — retryStrategy in redisConnection handles reconnection.
// Any other unexpected Queue errors still log.
scanQueue.on('error', (err) => {
  if (err.code !== 'ECONNREFUSED') {
    console.error('⚠️  scanQueue error:', err.message);
  }
});

// ─── Startup Check ───────────────────────────────────────────────────────────
export const checkRedisConnection = async () => {
  return new Promise((resolve, reject) => {
    //we are making a temporary redis client and when it is ready we resolve the promise and quit the connection 
    const client = new Redis({
      ...redisConnection,
      maxRetriesPerRequest: null,
      retryStrategy: () => null, // DO NOT RETRY
    });

    client.on('error', (err) => {
      client.disconnect();
      reject(new Error(`Redis connection failed: ${err.message}`));
    });

    client.on('ready', () => {
      client.quit();
      console.log('✅ Redis connection established');
      resolve();
    });
  });
};