# VS3 Admin Panel — SvelteKit Service
# Multi-stage build: build stage installs deps and compiles; runner stage is minimal
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps needed for build)
COPY vs3-panel/package*.json ./
RUN npm ci

# Copy source and build
COPY vs3-panel/ .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

# Copy built output and production dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
ENV NODE_ENV=production

# adapter-node entry point
CMD ["node", "build/index.js"]
