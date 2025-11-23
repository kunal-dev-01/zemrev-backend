FROM node:20-alpine AS builder

WORKDIR /app

# Copy root files for workspace
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# Copy all service package.json files
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/credit-service/package.json ./services/credit-service/
COPY services/user-service/package.json ./services/user-service/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY services/credit-service ./services/credit-service

WORKDIR /app/services/credit-service

RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy root files for workspace
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# Copy all service package.json files
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/credit-service/package.json ./services/credit-service/
COPY services/user-service/package.json ./services/user-service/

RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

COPY services/credit-service ./services/credit-service

WORKDIR /app/services/credit-service

COPY --from=builder /app/services/credit-service/dist ./dist

EXPOSE 5003

CMD ["pnpm", "start"]