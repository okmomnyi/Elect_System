const amqp = require('amqplib');
const env = require('./env');

/**
 * RabbitMQ connection and channel management
 * Handles queue setup, publishing, and consuming
 */

let connection = null;
let channel = null;

/**
 * Queue configuration with dead letter exchange for retry logic
 */
const QUEUES = {
  PRIMARY: env.VOTE_QUEUE,
  RETRY: env.VOTE_RETRY_QUEUE,
  DEAD: env.VOTE_DEAD_QUEUE,
};

const EXCHANGES = {
  MAIN: 'voting.exchange',
  DEAD_LETTER: 'voting.dlx',
};

/**
 * Initialize RabbitMQ connection, channel, and queues
 * Sets up dead letter exchange for failed message handling
 */
async function connect(retries = 10, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🐰 RabbitMQ: Connecting (attempt ${attempt}/${retries})...`);
      connection = await amqp.connect(env.RABBITMQ_URL);
      break; // connected — exit retry loop
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`🐰 RabbitMQ: Not ready yet, retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  try {
    channel = await connection.createChannel();
    
    // Set prefetch for fair dispatch (1 message at a time per worker)
    await channel.prefetch(1);
    
    // Create main exchange
    await channel.assertExchange(EXCHANGES.MAIN, 'direct', { durable: true });
    
    // Create dead letter exchange
    await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'direct', { durable: true });
    
    // Primary vote queue with dead letter routing
    await channel.assertQueue(QUEUES.PRIMARY, {
      durable: true,
      deadLetterExchange: EXCHANGES.DEAD_LETTER,
      deadLetterRoutingKey: QUEUES.RETRY,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours max message age
      },
    });
    await channel.bindQueue(QUEUES.PRIMARY, EXCHANGES.MAIN, QUEUES.PRIMARY);
    
    // Retry queue with delay before returning to primary
    await channel.assertQueue(QUEUES.RETRY, {
      durable: true,
      deadLetterExchange: EXCHANGES.MAIN,
      deadLetterRoutingKey: QUEUES.PRIMARY,
      arguments: {
        'x-message-ttl': 60000, // 60 second delay before retry
      },
    });
    await channel.bindQueue(QUEUES.RETRY, EXCHANGES.DEAD_LETTER, QUEUES.RETRY);
    
    // Dead letter queue for permanently failed messages
    await channel.assertQueue(QUEUES.DEAD, {
      durable: true,
    });
    await channel.bindQueue(QUEUES.DEAD, EXCHANGES.DEAD_LETTER, QUEUES.DEAD);
    
    console.log('🐰 RabbitMQ: Connected and queues initialized');

    console.log(`   - Primary queue: ${QUEUES.PRIMARY}`);
    console.log(`   - Retry queue: ${QUEUES.RETRY}`);
    console.log(`   - Dead letter queue: ${QUEUES.DEAD}`);
    
    // Handle connection events
    connection.on('error', (err) => {
      console.error('❌ RabbitMQ: Connection error', err.message);
    });
    
    connection.on('close', () => {
      console.log('🐰 RabbitMQ: Connection closed');
      channel = null;
      connection = null;
    });
    
    return { connection, channel };
  } catch (error) {
    console.error('❌ RabbitMQ: Setup failed', error.message);
    throw error;
  }
}

/**
 * Get the current channel (initializes if needed)
 * @returns {Promise<Channel>} AMQP channel
 */
async function getChannel() {
  if (!channel) {
    await connect();
  }
  return channel;
}

/**
 * Publish a message to the primary vote queue
 * @param {object} message - Vote message payload
 * @returns {Promise<boolean>} True if published successfully
 */
async function publishVote(message) {
  const ch = await getChannel();
  const content = Buffer.from(JSON.stringify(message));
  
  return ch.publish(
    EXCHANGES.MAIN,
    QUEUES.PRIMARY,
    content,
    {
      persistent: true, // Survive broker restart
      contentType: 'application/json',
      messageId: message.messageId,
      timestamp: Date.now(),
    }
  );
}

/**
 * Send a message directly to the dead letter queue
 * Used for messages that should not be retried
 * @param {object} message - Message payload
 * @param {string} reason - Reason for dead lettering
 */
async function sendToDeadLetter(message, reason) {
  const ch = await getChannel();
  const content = Buffer.from(JSON.stringify({ ...message, deadLetterReason: reason }));
  
  return ch.publish(
    EXCHANGES.DEAD_LETTER,
    QUEUES.DEAD,
    content,
    {
      persistent: true,
      contentType: 'application/json',
    }
  );
}

/**
 * Start consuming from the primary vote queue
 * @param {Function} handler - Async function (message, channel) => void
 */
async function consumeVotes(handler) {
  const ch = await getChannel();
  
  console.log(`🐰 RabbitMQ: Starting consumer on ${QUEUES.PRIMARY}`);
  
  await ch.consume(QUEUES.PRIMARY, async (msg) => {
    if (!msg) return;

    // Use RabbitMQ's built-in x-death header to count retries.
    // x-death is an array appended/incremented by the broker each time the
    // message is dead-lettered. The entry for the primary queue carries the
    // authoritative retry count — no application code needs to maintain it.
    const xDeath = msg.properties.headers?.['x-death'] || [];
    const primaryDeath = xDeath.find((d) => d.queue === QUEUES.PRIMARY);
    const retryCount = primaryDeath?.count || 0;

    // A message whose body can't even be parsed will never succeed — retrying it
    // 3 times is pointless and is a poison-loop vector. Dead-letter it at once.
    let content;
    try {
      content = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      console.error('❌ RabbitMQ: Unparseable message, dead-lettering immediately:', parseErr.message);
      try {
        await sendToDeadLetter({ raw: msg.content.toString().slice(0, 1000) }, `unparseable: ${parseErr.message}`);
      } catch (_) { /* still ack to drop the poison message */ }
      ch.ack(msg);
      return;
    }

    try {
      await handler(content, ch, msg, retryCount);
    } catch (error) {
      console.error('❌ RabbitMQ: Consumer error', error.message);

      if (retryCount >= 3) {
        console.log(`🐰 RabbitMQ: Message exceeded max retries, sending to dead letter`);
        try {
          await sendToDeadLetter(content, error.message);
        } catch (_) { /* ignore — still ack to avoid infinite loop */ }
        ch.ack(msg);
      } else {
        // Reject without requeue — dead-letter exchange routes to retry queue
        ch.nack(msg, false, false);
      }
    }
  }, { noAck: false });
}

/**
 * Health check for RabbitMQ connection
 * @returns {Promise<boolean>} True if healthy
 */
async function healthCheck() {
  try {
    const ch = await getChannel();
    await ch.checkQueue(QUEUES.PRIMARY);
    return true;
  } catch (error) {
    console.error('❌ RabbitMQ health check failed:', error.message);
    return false;
  }
}

/**
 * Gracefully close RabbitMQ connection
 */
async function close() {
  console.log('🐰 RabbitMQ: Closing connection...');
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
  console.log('🐰 RabbitMQ: Connection closed');
}

module.exports = {
  connect,
  getChannel,
  publishVote,
  sendToDeadLetter,
  consumeVotes,
  healthCheck,
  close,
  QUEUES,
};
