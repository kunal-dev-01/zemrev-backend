# ==========================================
# API Gateway - Dockerfile (Production)
# ==========================================
FROM node:20-alpine AS base
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml package.json ./

COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/models/package.json ./packages/models/
COPY packages/redis/package.json ./packages/redis/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/credit-service/package.json ./services/credit-service/
COPY services/user-service/package.json ./services/user-service/

RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml package.json ./

# Copy packages and build
COPY packages ./packages
RUN pnpm --filter "@zemrev/config" build && \
    pnpm --filter "@zemrev/db" build && \
    pnpm --filter "@zemrev/models" build && \
    pnpm --filter "@zemrev/redis" build && \
    pnpm --filter "@zemrev/types" build && \
    pnpm --filter "@zemrev/utils" build

# Copy service and build
COPY services/api-gateway ./services/api-gateway
WORKDIR /app/services/api-gateway
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml package.json ./

# Copy package.json files
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/models/package.json ./packages/models/
COPY packages/redis/package.json ./packages/redis/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY services/api-gateway/package.json ./services/api-gateway/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built packages
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/models/dist ./packages/models/dist
COPY --from=builder /app/packages/redis/dist ./packages/redis/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist

# Copy built service
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

WORKDIR /app/services/api-gateway

USER nodejs

EXPOSE 5000

CMD ["pnpm", "start"]