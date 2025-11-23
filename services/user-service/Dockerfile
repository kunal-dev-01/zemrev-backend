FROM node:20-alpine AS base
RUN npm install -g pnpm

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

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml package.json ./

COPY packages ./packages
RUN pnpm --filter "@zemrev/config" build && \
    pnpm --filter "@zemrev/db" build && \
    pnpm --filter "@zemrev/models" build && \
    pnpm --filter "@zemrev/redis" build && \
    pnpm --filter "@zemrev/types" build && \
    pnpm --filter "@zemrev/utils" build

COPY services/user-service ./services/user-service
WORKDIR /app/services/user-service
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml package.json ./

COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/models/package.json ./packages/models/
COPY packages/redis/package.json ./packages/redis/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY services/user-service/package.json ./services/user-service/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/models/dist ./packages/models/dist
COPY --from=builder /app/packages/redis/dist ./packages/redis/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist

COPY --from=builder /app/services/user-service/dist ./services/user-service/dist

WORKDIR /app/services/user-service

USER nodejs

EXPOSE 5002

CMD ["pnpm", "start"]