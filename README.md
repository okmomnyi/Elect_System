# University Electronic Voting System

A secure, production-ready electronic voting platform for universities. Built with **Node.js/Express**, **Next.js 14**, **PostgreSQL**, **Redis**, and **RabbitMQ**, with transactional email via **Brevo**.

## Features

- **Two-Factor Authentication**: university email + password, then a one-time code (OTP) emailed for every sign-in. A mistyped code can be retried — it is only consumed on a correct match.
- **Password Recovery**: self-service forgot/reset password via signed, single-use email tokens.
- **Vote Integrity**: 3-layer anti-double-vote protection (Redis flag → queue idempotency → DB unique constraint).
- **Ballot Secrecy**: voter identity (`vote_receipts`) and choice (`ballots`) are stored in separate tables, linked only by an opaque receipt token and never joined.
- **Real-time Results**: live vote tallies over WebSocket (Socket.io + Redis adapter). The running tally is only sent to authenticated users who have voted, or once the election closes.
- **Zero Vote Loss**: durable RabbitMQ queues; votes that commit but lose their Redis tally update are healed from the database on retry.
- **Full Audit Trail**: append-only `audit_log` (UPDATE/DELETE revoked).
- **Horizontally Scalable**: stateless API + worker; Redis-backed sessions and Socket.io fan-out.

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
                                        │   Worker    │  ──▶ Brevo (email)
                                        │  (Consumer) │
                                        └─────────────┘
```

Containers (see `docker-compose.yml`): `postgres`, `redis`, `rabbitmq`, `migrate` (one-shot), `seeder` (one-shot, dev), `backend`, `worker`, `frontend`, `nginx`.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OpenSSL (for generating JWT keys)

### 1. Configure environment

```bash
cp .env.example .env
```

Generate an RS256 key pair for JWT and add it to `.env` (single line, newlines escaped as `\n` — the backend un-escapes and validates that the values are real PEM keys):

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
# JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

Set the remaining required values in `.env`:

```bash
# Secrets — change these!
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_password
RABBITMQ_PASSWORD=your_secure_password

# Domain / app
FRONTEND_URL=https://voting.youruniversity.edu   # no trailing slash needed; it is normalized
ALLOWED_EMAIL_DOMAIN=@youruniversity.edu
BOOTSTRAP_ADMIN_EMAIL=admin@youruniversity.edu
BOOTSTRAP_ADMIN_NAME=System Administrator

# Email (Brevo transactional)
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=no-reply@youruniversity.edu
BREVO_SENDER_NAME=University Voting System
```

> `.env` is gitignored and must never be committed. Only `.env.example` (a template with placeholders) is tracked.

### 2. Start services

```bash
# Production-style (HTTP on :80 via nginx)
docker compose up -d --build

# Development (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

On every boot, the **`migrate`** service applies any pending SQL migrations (tracked in the `schema_migrations` table) before `backend`/`worker` start. In dev, the **`seeder`** service then loads sample data. The app is served at **http://localhost**.

### 3. Database migrations

Migrations live in `backend/src/db/migrations/` and run **once each**, in filename order, every file wrapped in its own transaction:

```bash
# Run manually (outside Docker)
cd backend && npm run migrate
```

Because applied files are recorded in `schema_migrations`, re-running only applies new files. To add a migration, drop a new numbered `.sql` file in the migrations directory.

### 4. TLS (production)

The default `nginx/nginx.conf` serves HTTP on `:80`, which is correct for local/dev. For production, terminate TLS at nginx:

1. Place certificates at `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem` (self-signed for testing):
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem
   ```
2. Mount the TLS config and certs in the `nginx` service (see `nginx/nginx.tls.conf.example`):
   ```yaml
   volumes:
     - ./nginx/nginx.tls.conf.example:/etc/nginx/nginx.conf:ro
     - ./nginx/ssl:/etc/nginx/ssl:ro
   ```
3. Set `NODE_ENV=production` so the backend advertises HSTS (only safe once TLS is actually terminated). HSTS is intentionally **not** sent over plain HTTP.

## Authentication Flows

| Flow | Steps |
|------|-------|
| Register | `POST /api/auth/register` (email + name + password) → OTP emailed → `POST /api/auth/verify-otp` |
| Login (2FA) | `POST /api/auth/login` (email + password) → OTP emailed → `POST /api/auth/verify-otp` |
| Legacy OTP-only | `POST /api/auth/request-otp` → `POST /api/auth/verify-otp` |
| Forgot password | `POST /api/auth/forgot-password` → reset link emailed → `POST /api/auth/reset-password` |
| Change password | `POST /api/auth/change-password` (authenticated) |

## Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | Password + OTP 2FA; RS256 JWT in HttpOnly, SameSite cookies |
| Domain Validation | Server-side email-domain check |
| Brute Force Protection | Redis counter, 5 attempts then lockout; OTP retained across mistypes, consumed only on match |
| Rate Limiting | Global per-IP limit + stricter auth/OTP limits (Redis) |
| SQL Injection | Parameterized queries only |
| CORS | Restricted to `FRONTEND_URL` (trailing slash normalized) |
| Security Headers | Helmet (CSP, X-Frame-Options); HSTS in production only |
| Anti-Double-Vote | 3-layer: Redis → worker idempotency → DB unique constraint |
| Ballot Secrecy | Identity/choice tables never joined |
| Live Tally Access | WebSocket join requires auth + voted/closed/visible election |
| Audit Immutability | UPDATE/DELETE revoked on `audit_log` |

## API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account, receive OTP |
| `/api/auth/login` | POST | Verify password, receive OTP |
| `/api/auth/request-otp` | POST | Legacy OTP-only request |
| `/api/auth/verify-otp` | POST | Verify OTP, issue session |
| `/api/auth/forgot-password` | POST | Email a reset link |
| `/api/auth/reset-password` | POST | Set new password via token |
| `/api/auth/change-password` | POST | Change password (authenticated) |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Current user |

### Elections (Student)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/elections` | GET | List available elections |
| `/api/elections/:id` | GET | Election details |
| `/api/elections/:id/vote` | POST | Cast vote |
| `/api/elections/:id/results` | GET | Results (after voting / on close) |
| `/api/elections/:id/receipt/:token` | GET | Verify vote receipt |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/elections` | GET/POST | List/create elections |
| `/api/admin/elections/:id` | PUT/DELETE | Update/delete election |
| `/api/admin/elections/:id/open` | POST | Open for voting |
| `/api/admin/elections/:id/close` | POST | Close election |
| `/api/admin/elections/:id/analytics` | GET | Real-time statistics |
| `/api/admin/audit-log` | GET | Audit trail |

### Health Checks
| Endpoint | Description |
|----------|-------------|
| `/health` | Backend overall health (also `/health/db`, `/health/redis`, `/health/queue`) |
| Worker `:3002/health` | Worker liveness (consumer attached + RabbitMQ reachable) |

## Database Schema

```
users            -- student/admin accounts (incl. password_hash for 2FA)
elections        -- election definitions
candidates       -- election candidates
vote_receipts    -- WHO voted (identity)        UNIQUE(user_id, election_id)
ballots          -- HOW they voted (choice, no user_id)
audit_log        -- append-only action log
verification_log -- OTP verification history
password_reset_tokens -- single-use reset tokens
schema_migrations     -- applied-migration tracking
```

See `backend/src/db/migrations/` for the full schema.

## Redis Key Patterns

| Key | Purpose | TTL |
|-----|---------|-----|
| `verify:{email}` | OTP storage | 600s |
| `otp_attempts:{email}` | Brute-force counter | 600s |
| `reg:{email}` | Pending registration | 900s |
| `session:{userId}` | Session cache | 86400s |
| `voted:{userId}:{electionId}` | Vote flag | Election end + 1 day |
| `tally:{electionId}:{candidateId}` | Live count | None |
| `election:{id}:status` | Election state | None |
| `rate:{ip}:{endpoint}` | Rate limit | 60s |

## Development

```bash
# Infrastructure only
docker compose up postgres redis rabbitmq -d

# Backend (in backend/)
npm install && npm run migrate && npm run dev
npm run worker          # in a second terminal

# Frontend (in frontend/)
npm install && npm run dev
```

### Code Style
- **Backend**: CommonJS, async/await, no ORM, parameterized SQL.
- **Frontend**: Next.js App Router, React hooks, Tailwind CSS.

## Production Deployment

### Scaling

The `backend` and `worker` services have no fixed `container_name`, so they scale:

```bash
docker compose up -d --scale backend=3 --scale worker=2
```

Sessions and live tallies are Redis-backed and the Socket.io Redis adapter fans out across backend replicas; nginx pins WebSocket connections with `ip_hash`.

### Monitoring
- Backend health: `/health/*`; worker health: `:3002/health`
- RabbitMQ management UI: port 15672
- PostgreSQL: `pg_stat_*` views; Redis: `INFO`

### Backup
```bash
docker exec voting-postgres pg_dump -U voting_user voting_db > backup.sql
docker cp voting-redis:/data/appendonly.aof ./redis-backup.aof
```

## Troubleshooting

**"OTP expired or not requested"** — the code expired (10 min) or was already used; request a new one. Check Redis connectivity and Brevo delivery (spam folder).

**"Results are not yet available"** — results are hidden during an active election until you vote or it closes.

**WebSocket won't connect / no live updates** — check nginx WebSocket timeouts and the Redis adapter; confirm you are authenticated and have voted.

**Migrations didn't apply** — check the `migrate` service logs (`docker compose logs migrate`); it records applied files in `schema_migrations`.

### Logs
```bash
docker compose logs -f                 # all
docker compose logs -f backend worker  # API + consumer
docker compose logs -f migrate         # migration run
```

## License

Proprietary — University Internal Use Only

## Support

Contact: elections-support@university.edu
