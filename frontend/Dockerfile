# Use Node 22 LTS Alpine — minimal attack surface, no high CVEs
FROM node:22.22-alpine AS base

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY jsconfig.json next.config.js tailwind.config.js postcss.config.js ./
RUN npm install && npm cache clean --force

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Accept build-time public env vars (baked into the Next.js bundle)
ARG NEXT_PUBLIC_API_URL=http://localhost
ARG NEXT_PUBLIC_WS_URL=http://localhost
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

# Production image
FROM node:22.22-alpine AS runner
WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# public/ is optional — create empty dir if it doesn't exist
RUN mkdir -p ./public
COPY --from=builder --chown=nextjs:nodejs /app/public* ./public/

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
