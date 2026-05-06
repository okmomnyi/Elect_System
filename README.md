# University Electronic Voting System

A secure, production-ready electronic voting platform for universities. Built with Node.js, Express, Next.js 14, PostgreSQL, Redis, RabbitMQ, and n8n.

## Features

- **Secure Authentication**: OTP-based email verification with university domain restriction
- **Vote Integrity**: 3-layer anti-double-vote protection (Redis → Queue dedup → DB constraint)
- **Ballot Secrecy**: Vote identity and choice are cryptographically separated
- **Real-time Results**: Live vote tally updates via WebSocket
- **Zero Vote Loss**: Durable message queues ensure every vote is recorded
- **Full Audit Trail**: Immutable logging of all system actions
- **100+ req/sec Capacity**: Horizontally scalable architecture

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│    Nginx    │────▶│  Next.js    │
│  (Student)  │     │   (Proxy)   │     │  Frontend   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  Express.js │
                    │   Backend   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PostgreSQL  │     │    Redis    │     │  RabbitMQ   │
│  (Storage)  │     │   (Cache)   │     │   (Queue)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │   Worker    │
                                        │  (Consumer) │
                                        └─────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OpenSSL (for generating JWT keys)

### 1. Clone and Configure

```bash
cd university-voting-system

# Copy environment template
cp .env.example .env

# Generate RS256 key pair for JWT
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Add keys to .env file (escape newlines)
# JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
# JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
```

### 2. Configure Environment Variables

Edit `.env` and set:

```bash
# Required - Change these!
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_password
RABBITMQ_PASSWORD=your_secure_password
N8N_INTERNAL_TOKEN=your_random_token
N8N_ENCRYPTION_KEY=your_random_key

# Domain settings
FRONTEND_URL=https://voting.youruniversity.edu
ALLOWED_EMAIL_DOMAIN=@youruniversity.edu
BOOTSTRAP_ADMIN_EMAIL=admin@youruniversity.edu

# JWT Keys (from step 1)
JWT_PRIVATE_KEY="..."
JWT_PUBLIC_KEY="..."
```

### 3. SSL Certificates

Place SSL certificates in `nginx/ssl/`:
- `fullchain.pem` - Certificate chain
- `privkey.pem` - Private key

For development, generate self-signed:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem
```

### 4. Start Services

```bash
# Production
docker-compose up -d

# Development (with hot reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 5. Import n8n Workflows

1. Access n8n at `http://localhost:5678` (dev) or your configured domain
2. Import workflows from `n8n/workflows/*.json`
3. Configure SMTP credentials for email sending
4. Configure Redis and PostgreSQL credentials

## Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | RS256 JWT in HttpOnly cookies |
| Domain Validation | Server-side email domain check |
| Brute Force Protection | Redis counter, 5 attempts, 15min lockout |
| Rate Limiting | Redis sliding window on all endpoints |
| SQL Injection | Parameterized queries only |
| CORS | Restricted to frontend URL |
| Security Headers | Helmet.js with CSP, HSTS, X-Frame-Options |
| Anti-Double-Vote | 3-layer: Redis → Worker dedup → DB constraint |
| Ballot Secrecy | Identity/choice tables never joined |
| Audit Immutability | UPDATE/DELETE revoked on audit_log table |

## API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/request-otp` | POST | Request OTP email |
| `/api/auth/verify-otp` | POST | Verify OTP and login |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Get current user |

### Elections (Student)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/elections` | GET | List available elections |
| `/api/elections/:id` | GET | Get election details |
| `/api/elections/:id/vote` | POST | Cast vote |
| `/api/elections/:id/results` | GET | Get results (if voted) |
| `/api/elections/:id/receipt/:token` | GET | Verify vote receipt |

### Admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/elections` | GET/POST | List/Create elections |
| `/api/admin/elections/:id` | PUT/DELETE | Update/Delete election |
| `/api/admin/elections/:id/open` | POST | Open election for voting |
| `/api/admin/elections/:id/close` | POST | Close election |
| `/api/admin/elections/:id/analytics` | GET | Real-time statistics |
| `/api/admin/audit-log` | GET | View audit trail |

### Health Checks

| Endpoint | Description |
|----------|-------------|
| `/health` | Overall health status |
| `/health/db` | PostgreSQL connectivity |
| `/health/redis` | Redis connectivity |
| `/health/queue` | RabbitMQ connectivity |

## Database Schema

```sql
-- Core tables
users           -- Student/admin accounts
elections       -- Election definitions
candidates      -- Election candidates
vote_receipts   -- Who voted (identity)
ballots         -- How they voted (choice)
audit_log       -- Immutable action log
verification_log-- OTP verification history
```

See `backend/src/db/migrations/001_initial_schema.sql` for full schema.

## Redis Key Patterns

| Key | Purpose | TTL |
|-----|---------|-----|
| `verify:{email}` | OTP storage | 900s |
| `otp_attempts:{email}` | Brute force counter | 900s |
| `session:{userId}` | Session cache | 86400s |
| `voted:{userId}:{electionId}` | Vote flag | Election end + 1 day |
| `tally:{electionId}:{candidateId}` | Live count | None |
| `election:{id}:status` | Election state | None |
| `rate:{ip}:{endpoint}` | Rate limit | 60s |

## n8n Workflows

1. **OTP Verification** - Generate and email verification codes
2. **Vote Confirmation** - Send receipt after successful vote
3. **Election Opened** - Notify students of new elections
4. **Election Closed** - Email results to admins
5. **Suspicious Activity** - Alert on security events

## Development

### Local Development

```bash
# Start infrastructure only
docker-compose up postgres redis rabbitmq -d

# Run backend (in backend directory)
npm install
npm run dev

# Run frontend (in frontend directory)
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Code Style

- **Backend**: CommonJS, async/await, no ORMs
- **Frontend**: ESM, React hooks, Tailwind CSS
- **SQL**: Parameterized queries only

## Production Deployment

### Scaling

```bash
# Scale API servers
docker-compose up -d --scale backend=3

# Scale workers
docker-compose up -d --scale worker=2
```

### Monitoring

- Health endpoints: `/health/*`
- RabbitMQ: Port 15672 (management UI)
- PostgreSQL: Standard pg_stat views
- Redis: `INFO` command metrics

### Backup

```bash
# PostgreSQL
docker exec voting-postgres pg_dump -U voting_user voting_db > backup.sql

# Redis (AOF enabled)
docker cp voting-redis:/data/appendonly.aof ./redis-backup.aof
```

## Troubleshooting

### Common Issues

**"OTP expired or not requested"**
- Check Redis connectivity
- Verify n8n workflow is triggered
- Check email delivery

**"Already voted" when haven't**
- Check `voted:{userId}:{electionId}` key in Redis
- Verify election ID is correct

**WebSocket disconnects**
- Check Nginx timeout settings
- Verify Redis adapter configuration

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Worker processing
docker-compose logs -f worker
```

## License

Proprietary - University Internal Use Only

## Support

Contact: voting-support@university.edu
