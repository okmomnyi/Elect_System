# Use Node 22 LTS with bookworm-slim for better security
FROM node:22-bookworm-slim AS base

# Install security updates
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
FROM base AS deps
RUN npm install --only=production && npm cache clean --force

# Build stage — copies full source including scripts/
FROM base AS builder
RUN npm install
COPY . .

# Production image
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install security updates and wget for healthcheck
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs voting

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

# Create logs directory
RUN mkdir -p logs && chown -R voting:nodejs logs

USER voting

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "src/server.js"]
