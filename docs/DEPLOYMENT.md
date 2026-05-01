# VS3 Admin Panel — Deployment Guide

**Version:** 2.0.0
**Last updated:** 2026-05-01

This guide covers two deployment paths:
- **Path A (Primary): Railway** — Recommended. No server management required. Requires a GitHub account and a Railway account (free tier available).
- **Path B (Secondary): Docker Compose** — For users who prefer a VPS or local server. Requires Docker installed.

Both paths use the same codebase. No platform-specific code changes are needed.

---

## Before You Start

You will need:
- [ ] A GitHub account (free at github.com)
- [ ] The VS3 Admin Panel repository pushed to GitHub
- [ ] A Railway account (free at railway.app) — for Path A
- [ ] Docker installed on your server — for Path B

---

## Path A: Railway Deployment (Primary)

Railway is the recommended deployment path. You will deploy two Railway services from the same GitHub repository: one for the SvelteKit web panel, one for PocketBase (the database).

### Step 1: Create a Railway Account

1. Go to [railway.app](https://railway.app) and click **Start a New Project**
2. Sign in with your GitHub account
3. Railway will ask to connect your GitHub — click **Authorize**

### Step 2: Create the PocketBase Service

1. In Railway, click **New Project** → **Deploy from GitHub repo**
2. Select your VS3 Admin Panel repository
3. Railway will detect the repository. When asked to configure:
   - **Service name:** PocketBase
   - **Build method:** Dockerfile
   - **Dockerfile path:** `Dockerfile.pb`
4. Click **Deploy** — wait for the first build to finish

**CRITICAL — Step 2a: Attach a Volume to PocketBase BEFORE the First Successful Deploy**

Without a volume, PocketBase's database is erased every time the service restarts or redeploys. This means you would lose all your collection configuration and account data on every update.

To attach a volume:
1. In your Railway project, click on the **PocketBase** service
2. Go to the **Volumes** tab
3. Click **Add a Volume**
4. Set the **Mount Path** to: `/pb_data`
5. Click **Create**

After attaching the volume, trigger a redeploy: click **Deploy** again. From now on, your data is safe across restarts.

### Step 3: Configure PocketBase Environment Variables

In the Railway PocketBase service, go to **Variables**. No additional env vars are required for PocketBase in Phase 1 — it uses its defaults.

### Step 4: Get the PocketBase URLs

After deploy, Railway assigns two URLs to the PocketBase service:
- **Public URL:** shown in the service's **Settings** tab (format: `https://something.up.railway.app`) — this is what your browser uses to access PocketBase
- **Private URL:** shown in the **Networking** tab → Private Networking (format: `pocketbase.railway.internal:8090`) — this is what the SvelteKit service uses to talk to PocketBase internally

Note both URLs — you will need them in Step 6.

### Step 5: Create the SvelteKit Service

1. In the same Railway project, click **+ New Service** → **GitHub Repo** (same repo)
2. Configure:
   - **Service name:** VS3 Panel
   - **Build method:** Dockerfile
   - **Dockerfile path:** `Dockerfile` (the root Dockerfile, not Dockerfile.pb)
3. Do NOT deploy yet — set environment variables first (Step 6)

### Step 6: Configure SvelteKit Environment Variables

In the Railway VS3 Panel service, go to **Variables** and add these exact values:

| Variable | Value | Example |
|----------|-------|---------|
| `NODE_ENV` | `production` | `production` |
| `POCKETBASE_URL` | PocketBase private URL with port | `http://pocketbase.railway.internal:8090` |
| `PUBLIC_POCKETBASE_URL` | PocketBase public URL (from Step 4) | `https://pocketbase-xxx.up.railway.app` |
| `ORIGIN` | VS3 Panel public URL (your app's Railway domain) | `https://vs3-panel-xxx.up.railway.app` |

To find your VS3 Panel public URL: go to the VS3 Panel service → **Settings** → **Domains** → copy the Railway-assigned domain.

### Step 7: Deploy the SvelteKit Service

1. Click **Deploy** on the VS3 Panel service
2. Watch the build logs — it should succeed in 2–3 minutes
3. Once deployed, click the public URL to open the login page

### Step 8: Set Up PocketBase Collections

The collections (database tables) must be configured manually in the PocketBase admin UI:

1. Open your PocketBase public URL in a browser and add `/_/` to the end:
   `https://your-pocketbase-url.up.railway.app/_/`
2. You will see the **PocketBase Setup** screen — create your superuser account:
   - Email: use a real email you control (for password recovery)
   - Password: use a strong password (this is the highest-privilege account)
3. Once logged in to the PocketBase admin UI, follow the **Schema Setup Checklist** in [docs/SCHEMA.md](./SCHEMA.md) to create all five Phase 1 collections

**Important:** The PocketBase admin account (superuser) is separate from staff accounts in the panel. Staff accounts are created through the VS3 Panel's Staff Management page after setup is complete.

### Step 9: Create the First Head Admin Account

1. Open your VS3 Panel (the SvelteKit service URL) — you will see the login page
2. You cannot log in yet — no staff accounts exist in the `staff` collection
3. Go back to the PocketBase admin UI → **staff** collection → **Records** tab
4. Click **New record** and create the first Head Admin account:
   - username: your chosen admin username
   - password: strong password
   - role: `head_admin`
   - isActive: `true`
5. Return to the VS3 Panel and log in with this account
6. Use the **Staff Management** page to create additional staff accounts (no need to return to PocketBase admin UI)

### Railway Deployment — Complete

Your VS3 Admin Panel is now running. Staff can access the panel at your VS3 Panel Railway URL.

---

## Path B: Docker Compose Deployment (Secondary)

Use this path for a VPS or local server with Docker installed.

### Prerequisites

- Docker and Docker Compose installed on your server
- Git installed
- A domain name or static IP for the server (optional but recommended for HTTPS)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/vs3-admin-panel.git
cd vs3-admin-panel
```

### Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in the values:

```
# PocketBase URL (internal Docker network — do not change this for Docker Compose)
POCKETBASE_URL=http://pocketbase:8090

# Public URL where PocketBase is accessible from a browser
# For local dev: http://localhost:8090
# For VPS with domain: https://pb.your-domain.com
PUBLIC_POCKETBASE_URL=http://localhost:8090

# Public URL of the SvelteKit app
# For local dev: http://localhost:3000
# For VPS: https://your-domain.com
ORIGIN=http://localhost:3000
```

### Step 3: Start the Services

```bash
docker compose up -d
```

This command:
1. Builds the SvelteKit container (2–5 minutes on first run)
2. Downloads the PocketBase binary
3. Starts both services
4. Creates a persistent `pb_data` Docker volume for PocketBase data

### Step 4: Set Up PocketBase Collections

1. Open `http://your-server-ip:8090/_/` in your browser
2. Create the PocketBase superuser account
3. Follow the **Schema Setup Checklist** in [docs/SCHEMA.md](./SCHEMA.md)

### Step 5: Create the First Head Admin Account

Same as Path A — Step 9 above.

### Step 6: Access the Panel

Open `http://your-server-ip:3000` in your browser.

### Docker Compose Tips

```bash
# View logs
docker compose logs -f

# Stop services
docker compose down

# Update after code changes
docker compose up -d --build

# Back up PocketBase data
docker run --rm -v vs3-panel_pb_data:/pb_data -v $(pwd):/backup alpine tar czf /backup/pb_backup_$(date +%Y%m%d).tar.gz /pb_data
```

---

## Local Development

To run the panel on your local machine for development:

### Option A: PocketBase binary + SvelteKit dev server (simplest)

1. Download PocketBase 0.22.x from [github.com/pocketbase/pocketbase/releases](https://github.com/pocketbase/pocketbase/releases)
2. Run PocketBase: `./pocketbase serve --hooksDir=./pb_hooks`
3. In a separate terminal: `cd vs3-panel && npm install && npm run dev`
4. Open `http://localhost:5173` for the panel, `http://localhost:8090/_/` for PocketBase admin

### Option B: Docker Compose for local dev

Same as Path B above, but set `ORIGIN=http://localhost:3000` in `.env`.

---

## Troubleshooting

### PocketBase setup screen appears on every Railway deploy

You forgot to attach a Railway Volume at `/pb_data` before the first deploy (Pitfall 3). Attach the volume now and redeploy. If data was lost, you will need to re-create collections and accounts following the setup steps above.

### Railway build fails with PocketBase connection errors

SvelteKit attempted to connect to PocketBase during the build phase, but PocketBase is not available at build time. Make sure no routes have `export const prerender = true` — all authenticated routes must NOT prerender. This is the default with adapter-node.

### Staff users are logged out on every page load

The `authRefresh()` call in `hooks.server.ts` is failing because it is calling the wrong collection. Verify that `hooks.server.ts` checks `authStore.record?.collectionName` and calls `collection('staff')` or `collection('members')` accordingly — not `collection('users')`.

### 403 errors on the Staff Management page

The PocketBase collection API rules may not be configured correctly. Verify the rules match exactly what is documented in [docs/SCHEMA.md](./SCHEMA.md). A common mistake is leaving rules as `null` (locked to superuser) instead of setting the role-based expression.

### Login works but the panel shows no staff accounts

The staff `listRule` may be misconfigured. It should be:
`@request.auth.role = "head_admin" || @request.auth.id = id`
Not `null` (which would block the SvelteKit app) and not `""` (which would allow unauthenticated access).

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `POCKETBASE_URL` | Yes | Internal URL for server-side PocketBase calls. Use private network URL on Railway, `http://pocketbase:8090` in Docker Compose |
| `PUBLIC_POCKETBASE_URL` | Yes | Public PocketBase URL. Used during Railway build phase. Set to the PocketBase service's public Railway domain |
| `ORIGIN` | Yes (Railway) | The public URL of the SvelteKit app. Required by SvelteKit adapter-node for security |

---

*Deployment Guide — VS3 Admin Panel v2.0.0*
*Path A: Railway (primary) | Path B: Docker Compose (secondary)*
