const { Pool } = require('pg');
const env = require('./env');

/**
 * PostgreSQL connection pool (singleton)
 * Manages database connections with configurable pool size
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log pool events for monitoring
pool.on('connect', () => {
  console.log('📦 PostgreSQL: New client connected to pool');
});

pool.on('error', (err, client) => {
  console.error('❌ PostgreSQL: Unexpected error on idle client', err);
});

pool.on('remove', () => {
  console.log('📦 PostgreSQL: Client removed from pool');
});

/**
 * Execute a query with automatic client management
 * @param {string} text - SQL query text with $1, $2, ... placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (env.NODE_ENV === 'development') {
    console.log('📊 Query:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
  }
  
  return result;
}

/**
 * Get a client for transaction management
 * IMPORTANT: Always release the client with client.release()
 * @returns {Promise<PoolClient>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Timeout to prevent leaked connections
  const timeout = setTimeout(() => {
    console.error('❌ PostgreSQL: Client has been checked out for more than 30 seconds!');
  }, 30000);
  
  client.release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };
  
  return client;
}

/**
 * Execute a callback within a transaction
 * Automatically commits on success, rolls back on error
 * @param {Function} callback - Async function receiving (client)
 * @returns {Promise<any>} Result of callback
 */
async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} True if healthy
 */
async function healthCheck() {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } catch (error) {
    console.error('❌ PostgreSQL health check failed:', error.message);
    return false;
  }
}

/**
 * Gracefully close all pool connections
 */
async function close() {
  console.log('📦 PostgreSQL: Closing connection pool...');
  await pool.end();
  console.log('📦 PostgreSQL: Connection pool closed');
}

module.exports = {
  pool,
  query,
  getClient,
  withTransaction,
  healthCheck,
  close,
};
