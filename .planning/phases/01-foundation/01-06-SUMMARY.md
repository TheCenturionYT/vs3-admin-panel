---
plan: 01-06
phase: 1
subsystem: deployment
status: complete
completed: 2026-05-01
tags: [docker, railway, pocketbase, sveltekit, deployment]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [deployment-infrastructure]
  affects: []
tech_stack:
  added: [node:22-alpine, alpine:3, PocketBase 0.22.22]
  patterns: [multi-stage Docker build, Docker Compose health-check dependency, Railway DOCKERFILE builder]
key_files:
  created:
    - Dockerfile
    - Dockerfile.pb
    - docker-compose.yml
    - railway.toml
    - docs/DEPLOYMENT.md
  modified: []
decisions:
  - Railway is the primary deployment path; Docker Compose is secondary
  - PocketBase 0.22.22 pinned in Dockerfile.pb ARG VERSION
  - adapter-node entry point is node build/index.js
  - pb_hooks mounted as volume in docker-compose for dev hot-reload; COPY-ed in container image
metrics:
  duration: 4m
  completed_date: 2026-05-01
---

# Phase 1 Plan 6: Deployment Infrastructure Summary

One-liner: Multi-stage node:22-alpine Dockerfile + alpine:3 PocketBase container with --hooksDir wired, Docker Compose health-check dependency chain, railway.toml DOCKERFILE config, and a 9-step non-developer Railway deployment guide with Docker Compose secondary path.

## Files Created

- `Dockerfile` — SvelteKit multi-stage build for Railway/Docker (node:22-alpine), produces `build/index.js` via `npm run build`, runs with `node build/index.js`
- `Dockerfile.pb` — PocketBase binary container (alpine:3, PB v0.22.22), COPY-es pb_hooks/, VOLUME /pb_data, CMD serves with `--dir=/pb_data --hooksDir=/pb_hooks`
- `docker-compose.yml` — wires SvelteKit + PocketBase with named `pb_data` volume, healthcheck on PocketBase, `depends_on: condition: service_healthy` for app service
- `railway.toml` — Railway configuration pointing to root `Dockerfile` with DOCKERFILE builder
- `docs/DEPLOYMENT.md` — non-developer Railway guide (Steps 1–9) + Docker Compose secondary path + Local Dev + Troubleshooting (5 scenarios) + Environment Variable Reference

## Dockerfile.pb CMD

`/usr/local/bin/pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data --hooksDir=/pb_hooks`

--hooksDir confirmed present: yes

## PocketBase Version

`ARG VERSION=0.22.22` (matches research requirement 0.22.x)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates infrastructure files only, no application code.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Deployment files only.

## Self-Check: PASSED

- Dockerfile exists: FOUND
- Dockerfile.pb exists: FOUND
- docker-compose.yml exists: FOUND
- railway.toml exists: FOUND
- docs/DEPLOYMENT.md exists: FOUND
- Commit 5902646 exists: FOUND
- `node build/index.js` in Dockerfile: FOUND
- `--hooksDir=/pb_hooks` in Dockerfile.pb: FOUND
- `pb_data:/pb_data` in docker-compose.yml: FOUND
- `DOCKERFILE` in railway.toml: FOUND
- `CRITICAL` in DEPLOYMENT.md: FOUND
- `SCHEMA.md` reference in DEPLOYMENT.md: FOUND
- `ORIGIN` in DEPLOYMENT.md: FOUND
- Troubleshooting section in DEPLOYMENT.md: FOUND
- Steps 1 through 9 in DEPLOYMENT.md: FOUND
