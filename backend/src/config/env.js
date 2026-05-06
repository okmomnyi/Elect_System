const { z } = require('zod');
require('dotenv').config();

/**
 * Environment variable schema with Zod validation.
 * The application refuses to start if any required variable is missing or invalid.
 */
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),
  WS_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3001'),
  FRONTEND_URL: z.string().url(),
  ALLOWED_EMAIL_DOMAIN: z.string().startsWith('@'),

  // Database
  DATABASE_URL: z.string().startsWith('postgresql://'),
  DATABASE_POOL_SIZE: z.string().transform(Number).pipe(z.number().int().positive()).default('20'),

  // Redis
  REDIS_URL: z.string().startsWith('redis://'),

  // RabbitMQ
  RABBITMQ_URL: z.string().startsWith('amqp://'),
  VOTE_QUEUE: z.string().default('votes.primary'),
  VOTE_RETRY_QUEUE: z.string().default('votes.retry'),
  VOTE_DEAD_QUEUE: z.string().default('votes.dead'),

  // JWT (RS256 asymmetric key pair)
  JWT_PRIVATE_KEY: z.string().min(100),
  JWT_PUBLIC_KEY: z.string().min(100),
  JWT_EXPIRY: z.string().transform(Number).pipe(z.number().int().positive()).default('86400'),

  // Brevo transactional email
  BREVO_API_KEY: z.string().min(10),
  BREVO_SENDER_EMAIL: z.string().email(),
  BREVO_SENDER_NAME: z.string().min(1).default('University Voting System'),

  // Admin Bootstrap
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_NAME: z.string().min(1),
});

let env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Environment validation failed:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error(error);
  }
  console.error('\n💡 Copy .env.example to .env and fill in all required values\n');
  process.exit(1);
}

module.exports = env;
