const { Queue, Worker } = require('bullmq');
const env = require('./env');

/**
 * Parse a redis:// URL into the connection options BullMQ expects.
 * BullMQ does not accept a URL string directly — it needs { host, port, password }.
 * maxRetriesPerRequest: null is required by BullMQ (ioredis default is 3, which
 * causes "max retries exceeded" errors inside the worker event loop).
 */
function parseRedisConnection(url) {
  const parsed = new URL(url);
  const opts = {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  if (parsed.password) opts.password = decodeURIComponent(parsed.password);
  // Only set username if non-empty (redis:// uses an empty username for password-only auth)
  if (parsed.username && parsed.username !== '') opts.username = parsed.username;
  return opts;
}

const connection = parseRedisConnection(env.REDIS_URL);

/**
 * Queue name constants — import these wherever you addBulk / add jobs.
 */
const QUEUE_NAMES = {
  EMAIL_DISPATCH: 'email-dispatch',
};

/**
 * Default job options applied to every job unless overridden:
 *  - 3 attempts with exponential back-off (2 s, 4 s, 8 s)
 *  - Keep last 1 000 completed and 5 000 failed jobs in Redis for inspection
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/**
 * Named queues — add to these from controllers / services.
 *
 *   queues.emailDispatch.add('send-vote-confirmation', { ... })
 *   queues.emailDispatch.addBulk([ ... ])
 */
const queues = {
  emailDispatch: new Queue(QUEUE_NAMES.EMAIL_DISPATCH, {
    connection,
    defaultJobOptions,
  }),
};

/**
 * Worker factory — used by job files to create typed workers.
 *
 * @param {string}   queueName  One of QUEUE_NAMES.*
 * @param {Function} processor  async (job) => { ... }
 * @param {object}   options    BullMQ WorkerOptions overrides
 */
function createWorker(queueName, processor, options = {}) {
  return new Worker(queueName, processor, {
    connection,
    ...options,
  });
}

module.exports = { queues, createWorker, QUEUE_NAMES };
