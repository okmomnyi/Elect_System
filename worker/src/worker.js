/**
 * RabbitMQ Worker Entry Point
 * Consumes votes from the queue and processes them
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Reuse backend config/services — worker runs from project root in dev
const env = require('../../backend/src/config/env');
const database = require('../../backend/src/config/database');
const redis = require('../../backend/src/config/redis');
const rabbitmq = require('../../backend/src/config/rabbitmq');
const voteProcessor = require('./processors/vote.processor');

console.log('🔧 Starting Vote Worker...\n');

/**
 * Main worker function
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
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }
    console.log('✅ Redis connected');
    
    // Connect to RabbitMQ
    await rabbitmq.connect();
    console.log('✅ RabbitMQ connected');
    
    // Start consuming votes
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
          // Idempotent - ack the message, it's already processed
          channel.ack(msg);
          console.log(`ℹ️ Vote already recorded (idempotent): ${message.messageId}`);
        } else if (retryCount >= 3) {
          // Max retries - send to dead letter
          await rabbitmq.sendToDeadLetter(message, error.message);
          channel.ack(msg);
          console.log(`☠️ Vote sent to dead letter: ${message.messageId}`);
        } else {
          // Retry
          channel.nack(msg, false, false);
          console.log(`🔄 Vote will be retried: ${message.messageId}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Worker failed to start:', error.message);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  console.log(`\n⚠️ ${signal} received. Shutting down worker...`);
  
  try {
    await rabbitmq.close();
    await redis.close();
    await database.close();
    console.log('✅ Worker shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in worker:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection in worker:', reason);
});

// Start the worker
startWorker();
