# VS3 Admin Panel — Unified Service Dockerfile
# Handles both SvelteKit and PocketBase from a single image.
# Set SERVICE_TYPE=pocketbase in Railway vars to run PocketBase;
# leave it unset (or set to svelte) to run SvelteKit.

# ── Stage 1: Build SvelteKit ─────────────────────────────────────────────────
FROM node:22-alpine AS svelte-builder
WORKDIR /app
COPY vs3-panel/package*.json ./
RUN npm ci
COPY vs3-panel/ .
RUN npm run build
RUN npm prune --omit=dev

# ── Stage 2: Download PocketBase binary ──────────────────────────────────────
FROM alpine:3 AS pb-downloader
ARG PB_VERSION=0.22.22
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
         -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /tmp/ \
 && chmod +x /tmp/pocketbase \
 && rm /tmp/pb.zip

# ── Stage 3: Runtime image ───────────────────────────────────────────────────
FROM node:22-alpine
RUN apk add --no-cache ca-certificates

# PocketBase
COPY --from=pb-downloader /tmp/pocketbase /usr/local/bin/pocketbase
COPY pb_hooks/       /pb_hooks/
COPY pb_migrations/  /pb_migrations/
# SvelteKit
COPY --from=svelte-builder /app/build        /app/build
COPY --from=svelte-builder /app/node_modules /app/node_modules
COPY --from=svelte-builder /app/package.json /app/package.json

ENV NODE_ENV=production

# SERVICE_TYPE=pocketbase → PocketBase; anything else → SvelteKit
CMD ["/bin/sh", "-c", \
  "if [ \"$SERVICE_TYPE\" = \"pocketbase\" ]; then \
     /usr/local/bin/pocketbase serve --http=0.0.0.0:${PORT:-8090} --dir=/pb_data --hooksDir=/pb_hooks --migrationsDir=/pb_migrations; \
   else \
     node /app/build/index.js; \
   fi"]
