# ── Stage 1: build TypeScript → JavaScript ───────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including devDeps for tsc)
COPY package*.json ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: lean runtime image ──────────────────────────────────
FROM node:22-alpine AS runtime

# net-tools / nmap for network scanning (vessel LAN)
# nmap is optional — remove if you don't use raw socket scanning
RUN apk add --no-cache nmap nmap-scripts

WORKDIR /app

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled output from builder
COPY --from=builder /app/dist ./dist

# Data directory — mount a volume here for persistence
RUN mkdir -p /app/data

# Expose agent port (override with PORT env var)
EXPOSE 3000

# Health check so docker-compose / orchestrators know when we're ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
