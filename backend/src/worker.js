/**
 * Worker Entry Point (backend/src/worker.js)
 * RabbitMQ vote consumer - runs as a separate process within the backend container
 * Started by: docker-compose worker service, PM2 ecosystem config
 */

const env = require('./config/env');
const database = require('./config/database');
const redisModule = require('./config/redis');
const rabbitmq = require('./config/rabbitmq');
const voteProcessor = require('./processors/vote.processor');

console.log('🔧 Starting Vote Worker...\n');

/**
 * Main worker startup function
 */
async function startWorker() {
  try {
    // Test database connection
    const dbHealthy = await database.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ PostgreSQL connected');

    // Test Redis connection
    const redisHealthy = await redisModule.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }
    console.log('✅ Redis connected');

    // Connect to RabbitMQ and set up queues
    await rabbitmq.connect();
    console.log('✅ RabbitMQ connected');

    // Start consuming votes from the queue
    console.log('\n🎧 Worker listening for votes...\n');

    await rabbitmq.consumeVotes(async (message, channel, msg, retryCount) => {
      console.log(`📥 Received vote: ${message.messageId} (retry: ${retryCount})`);

      try {
        await voteProcessor.processVote(message);
        channel.ack(msg);
        console.log(`✅ Vote processed: ${message.messageId}`);
      } catch (error) {
        console.error(`❌ Vote processing failed: ${message.messageId}`, error.message);

        if (error.code === 'ALREADY_VOTED' || error.code === 'DUPLICATE_ENTRY') {
          // Idempotent — vote already recorded, ack to remove from queue
          channel.ack(msg);
          console.log(`ℹ️ Vote already recorded (idempotent): ${message.messageId}`);
        } else if (retryCount >= 3) {
          // Exceeded max retries — send to dead letter queue
          await rabbitmq.sendToDeadLetter(message, error.message);
          channel.ack(msg);
          console.log(`☠️ Vote sent to dead letter after ${retryCount} retries: ${message.messageId}`);
        } else {
          // Reject without requeue — dead letter exchange will handle retry delay
          channel.nack(msg, false, false);
          console.log(`🔄 Vote nacked for retry (attempt ${retryCount + 1}/3): ${message.messageId}`);
        }
      }
    });
  } catch (error) {
    console.error('❌ Worker failed to start:', error.message);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  console.log(`\n⚠️ ${signal} received. Shutting down worker gracefully...`);

  try {
    await rabbitmq.close();
    await redisModule.close();
    await database.close();
    console.log('✅ Worker shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during worker shutdown:', error.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in worker:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection in worker:', reason);
});

// Start the worker
startWorker();
