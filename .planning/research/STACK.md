# Technology Stack

**Project:** VS3 Admin Panel v2
**Researched:** 2026-05-01
**Research mode:** Ecosystem — "What's the best self-hosted admin panel stack?"

> **VERIFICATION NOTE:** All external research tools (WebSearch, WebFetch, Context7 CLI) were
> unavailable in this environment. Version numbers and feature claims are drawn from training
> data (knowledge cutoff ~Aug 2025). Before finalizing, verify current versions at the
> official sources linked in each section. Confidence levels reflect this constraint.

---

## Recommended Stack

### Summary Decision

| Layer | Technology | Version* | Confidence |
|-------|-----------|---------|------------|
| Backend / BaaS | PocketBase | 0.22.x | MEDIUM — verify at pocketbase.io |
| Frontend framework | SvelteKit | 2.x | HIGH — stable, well-documented |
| UI component library | shadcn-svelte | latest | MEDIUM — verify at shadcn-svelte.com |
| Charts | Chart.js | 4.x | HIGH — very stable, no breaking changes expected |
| Deployment | Docker Compose (single VPS) | — | HIGH — standard pattern |
| Hosting option | Railway / Fly.io free tier | — | MEDIUM — free tier terms change |

*Verify all versions before starting. See Sources section.

---

## Core Framework

### Backend: PocketBase

| Property | Value |
|----------|-------|
| Technology | PocketBase |
| Version | 0.22.x (MEDIUM confidence — verify at https://github.com/pocketbase/pocketbase/releases) |
| Purpose | Database + auth + REST/realtime API in one binary |
| Why | Single Go binary with zero runtime dependencies. Non-developer deployment is a `./pocketbase serve` command. Includes built-in admin UI, SQLite database, user auth with roles, and Server-Sent Events for real-time updates. All requirements — shared state, multi-user auth, RBAC, file uploads — are solved out of the box with zero infrastructure decisions. |

**Why PocketBase over the alternatives:**

- **Over Supabase (self-hosted):** Supabase self-hosted requires Docker Compose with 8+ containers (Kong, Postgres, PostgREST, GoTrue, Realtime, Storage, Studio). That's an expert-level deployment. PocketBase is one binary.
- **Over Directus:** Directus self-hosted has similar container complexity and heavier resource needs. Good product, wrong fit for "non-developer can follow a guide."
- **Over custom Node.js + Express + better-auth:** Correct choice if you need flexibility, but means writing auth, sessions, RBAC, migrations, and real-time from scratch. Every hour spent on infrastructure is not spent on upkeep automation.
- **Over Firebase/Firestore:** Paid SaaS beyond a small free tier. Violates the "no paid third-party SaaS" constraint. Also not self-hosted.
- **Over Appwrite:** Strong alternative, but requires Docker with multiple containers. Heavier than PocketBase for this scale.

**PocketBase specifically solves the project's non-negotiables:**

1. Auth with roles — built-in users collection + collection-level rules + custom auth collections. Head Admin vs Staff vs Faction Member maps directly to auth collection rules.
2. Faction data scoping — collection API rules can be written as `@request.auth.faction = faction.id` — only one faction's records are returned per authenticated user.
3. Real-time sync — SSE subscriptions mean all staff tabs update live when any staff member submits upkeep.
4. Beginner deployment — `./pocketbase serve` or a three-line Docker Compose file. Admin UI at `/admin` for schema changes without touching code.
5. SQLite — zero database administration, file-based backup (`cp pb_data/data.db backup.db`), runs on $5/month VPS.

**Limitations to acknowledge:**

- Not horizontally scalable (SQLite single-writer). At 3–6 staff this is irrelevant.
- No built-in background job scheduler — weekly deadline auto-processing will need either a PocketBase hook (Go extension) or a cron job that calls the PocketBase API. This is a known gap, addressed in PITFALLS.md.
- Community is strong but smaller than Supabase; ecosystem of third-party tooling is thinner.

---

### Frontend Framework: SvelteKit

| Property | Value |
|----------|-------|
| Technology | SvelteKit |
| Version | 2.x (HIGH confidence — released Nov 2023, stable as of research date) |
| Purpose | Full-stack web framework — server-side rendering, routing, form actions, API endpoints |
| Why | SvelteKit 2 + Svelte 5 (runes model) is the leanest modern framework for an admin panel. Less boilerplate than React/Next.js, no virtual DOM overhead, server actions handle form submissions without client-side fetch wrangling. The resulting app is fast, readable, and easy to extend by a small team. |

**Why SvelteKit over the alternatives:**

- **Over Next.js (React):** Next.js is the industry standard but comes with React's verbosity. For an admin panel — dominated by forms, tables, and conditional UI — Svelte's reactivity model is dramatically less code. Next.js also has more footguns around App Router vs Pages Router that confuse developers let alone non-developers doing the deployment. SvelteKit's mental model is simpler.
- **Over plain HTML/Vanilla JS:** v1.2.1 was this and it worked until multi-user state became a requirement. Going back is not viable for shared real-time data.
- **Over Nuxt (Vue):** Reasonable alternative. SvelteKit is chosen because Svelte's compile-time reactivity produces smaller bundles and the component model is more intuitive for building complex data-heavy UIs.
- **Over Remix:** Excellent framework but React-based (same verbosity cost as Next.js) and smaller ecosystem than Next.js without the upside.
- **Over HTMX + minimal JS:** HTMX is compelling for simple CRUD. This project needs charts, real-time SSE subscriptions, complex multi-step modals (instability event handling, bulk upkeep), and a rich dark-theme UI. HTMX would hit its limits fast.

**SvelteKit + PocketBase integration is well-documented.** The PocketBase JS SDK works directly in SvelteKit server and client contexts. Pattern: SvelteKit server load functions fetch initial data from PocketBase, client-side subscribes to SSE for live updates.

**Svelte version note:** Svelte 5 (runes syntax) is available and stable as of late 2024. SvelteKit 2 supports both Svelte 4 and Svelte 5. Recommendation is Svelte 5 runes for new projects — cleaner reactivity, better TypeScript inference. This does mean learning the runes model (`$state`, `$derived`, `$effect`), which is a small upfront cost with long-term payoff.

---

## UI Component Library

### shadcn-svelte

| Property | Value |
|----------|-------|
| Technology | shadcn-svelte |
| Version | Follow the docs at https://shadcn-svelte.com — it is not versioned as a package you install; components are copied into your project |
| Purpose | Pre-built accessible UI components: tables, dialogs, forms, dropdowns, charts (via Recharts/LayerChart) |
| Why | shadcn-svelte gives production-quality components (DataTable, Dialog, Select, Tabs, Badge, Card) that match the project's needs exactly without fighting a monolithic component library. Components are copied into the project — you own the code. No runtime dependency to break. The dark theme support is excellent and can be styled to match the gold medieval aesthetic from v1.2.1 using CSS custom properties (Tailwind CSS variables). |

**Why shadcn-svelte over alternatives:**

- **Over Skeleton UI:** Both are good. shadcn-svelte is chosen because its component primitives (built on Bits UI / Melt UI) are more compositional and its table/form patterns are more aligned with data-heavy admin UIs.
- **Over DaisyUI:** DaisyUI is pure CSS over Tailwind — fast to start, but customization hits a ceiling. Admin panels need complex table behavior (sorting, filtering, pagination), multi-step dialogs, and accessible select inputs. DaisyUI's components are too basic.
- **Over Flowbite-Svelte:** Flowbite components are functional but not as polished or accessible as shadcn-svelte's Bits UI primitives.
- **Over building raw with Tailwind:** Viable but slow. Every dialog, dropdown, and table needs accessibility handling (focus traps, ARIA) that shadcn-svelte provides for free.

**Tailwind CSS 4 note (MEDIUM confidence):** Tailwind CSS v4 was released in early 2025 with a major config format change. shadcn-svelte tracks Tailwind — verify compatibility at https://shadcn-svelte.com before starting. If shadcn-svelte has not fully migrated, use Tailwind v3 for stability.

---

## Charts

### Chart.js

| Property | Value |
|----------|-------|
| Technology | Chart.js |
| Version | 4.x (HIGH confidence) |
| Purpose | Bar charts (weekly SP owed vs paid per faction), line charts (instability over time), potentially a heatmap for instability across nodes |
| Why | Chart.js 4 is the simplest charting library with the widest Svelte ecosystem support. The `svelte-chartjs` wrapper (`svelte-chartjs` on npm) provides a declarative Svelte component. Setup is under 20 lines of code for a working chart. |

**Why Chart.js over alternatives:**

- **Over D3.js:** D3 is powerful but requires learning a separate paradigm. For bar/line charts with tooltips, Chart.js is 1/10th the code.
- **Over Recharts:** Recharts is React-only.
- **Over ECharts (Apache):** ECharts is heavier and its Svelte integration is thinner. Chart.js is the safer, more documented choice.
- **Over Layerchart (shadcn-svelte's chart layer):** If shadcn-svelte's chart components are mature at build time, prefer them — they'll match the design system automatically. Fall back to Chart.js + custom styling if not.

---

## Database

### SQLite (via PocketBase)

| Property | Value |
|----------|-------|
| Technology | SQLite |
| Version | 3.x (embedded in PocketBase binary) |
| Purpose | Persistent storage for all nodes, factions, upkeep submissions, wars, events, users |
| Why | Zero administration. No separate database server. File-based backup. At 3–6 concurrent users with under 10K rows of data, SQLite is more than sufficient. PocketBase manages the SQLite file and exposes it via a type-safe REST API. |

No alternative considered. The project's constraints (single binary, self-hosted by a non-developer, small team) make SQLite via PocketBase the only rational choice. PostgreSQL would require a separate server process, connection pooling, and user/permission management — overkill and a deployment complexity multiplier.

---

## Authentication

### PocketBase Built-in Auth

| Property | Value |
|----------|-------|
| Technology | PocketBase auth collections |
| Version | Built into PocketBase |
| Purpose | Username/password login, session management, role-based access |
| Why | PocketBase's auth collections handle password hashing, JWT issuance, refresh tokens, and email verification out of the box. Auth collection rules enforce RBAC at the API layer — no auth logic to write in the application. |

**Role mapping for this project:**

- `_superusers` — PocketBase built-in admin (deploy-time only, not for staff)
- `staff` auth collection — with a `role` field: `head_admin` | `staff`
- `members` auth collection — faction member accounts with a `faction` relation field

Collection API rules then gate data:
- Staff endpoints: `@request.auth.collectionName = "staff"`
- Head admin-only (delete/wipe): `@request.auth.role = "head_admin"`
- Faction member endpoints: `@request.auth.collectionName = "members" && faction = @request.auth.faction`

No third-party auth library (Auth.js, Lucia, Clerk) is needed. Auth.js/Lucia would be the right call if building a custom Node.js backend, but PocketBase makes them redundant.

---

## Infrastructure & Deployment

### Primary Path: Docker Compose on a VPS

| Property | Value |
|----------|-------|
| Technology | Docker Compose |
| Version | Compose v2 (built into Docker Desktop / Docker Engine 20.10+) |
| Purpose | Run PocketBase + serve SvelteKit frontend as a single deployable unit |
| Why | Docker Compose gives a non-developer a repeatable, documented deployment: clone repo, copy `.env.example` to `.env`, run `docker compose up -d`. No installing Node, Go, or Python. One command to update (`docker compose pull && docker compose up -d`). |

**Compose architecture for this project:**

```yaml
services:
  app:         # SvelteKit frontend — built to static or Node adapter
  pocketbase:  # PocketBase binary — mounts ./pb_data as a volume for persistence
```

SvelteKit is deployed using the `@sveltejs/adapter-node` adapter (produces a Node.js server). This is simpler than static export because the app has server-side logic (load functions, form actions, API proxying).

**Backup strategy:** Mount `pb_data/` as a Docker volume mapped to a host directory. Backup = copy that directory. Document this in the deployment guide.

### Alternative Path: Railway (no Docker knowledge required)

If the host is uncomfortable with Docker, Railway (https://railway.app) provides:
- GitHub-connected deployments — push to `main`, Railway builds and deploys automatically
- PocketBase can be deployed as a Railway service from the official template
- SvelteKit deploys via Nixpacks (zero config)
- Free tier: $5/month credit (sufficient for this scale)
- Persistent volume for `pb_data/`

Railway is the recommended starting point for a truly non-developer host. Docker Compose is the recommended path if the host wants full control / no cloud dependency.

### NOT Recommended: Vercel / Netlify for the backend

Vercel and Netlify work well for static frontends but cannot run PocketBase (requires a persistent process and file system). SvelteKit can deploy to Vercel, but PocketBase cannot — this splits the deployment across two providers and adds CORS complexity. Keep both on one server.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pocketbase` (JS SDK) | 0.21.x+ | PocketBase API client, realtime subscriptions | Always — the primary data layer |
| `svelte-chartjs` | 3.x | Chart.js wrapper for Svelte | For SP/instability charts |
| `@sveltejs/adapter-node` | latest | Build SvelteKit for Docker/Railway deployment | Always — needed for SSR + form actions |
| `zod` | 3.x | Runtime schema validation for form data | Validate upkeep submission inputs, node CRUD forms |
| `bits-ui` | latest | Headless UI primitives (used by shadcn-svelte) | Via shadcn-svelte — don't install directly |
| `clsx` + `tailwind-merge` | latest | Conditional CSS class merging | Via shadcn-svelte utilities |
| `date-fns` | 3.x | Date formatting, deadline calculations | Weekly deadline processing, history timestamps |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend/BaaS | PocketBase | Supabase (self-hosted) | 8+ Docker containers, expert deployment |
| Backend/BaaS | PocketBase | Directus | Multiple containers, heavier resource footprint |
| Backend/BaaS | PocketBase | Custom Node.js + better-auth + Drizzle | More control but 3x build time for infrastructure |
| Frontend | SvelteKit | Next.js (React) | More boilerplate, App Router complexity confuses deployments |
| Frontend | SvelteKit | Nuxt (Vue) | Reasonable alt, SvelteKit chosen for compile-time reactivity |
| Frontend | SvelteKit | HTMX | Too limited for SSE subscriptions + complex modals + charts |
| UI | shadcn-svelte | Skeleton UI | Less compositional for data-heavy tables/forms |
| UI | shadcn-svelte | DaisyUI | Insufficient for accessible complex components |
| Charts | Chart.js | D3.js | 10x more complexity for the same bar/line charts |
| Hosting | Docker Compose / Railway | Vercel + separate DB | Splits backend/frontend, CORS complexity, PocketBase can't run on Vercel |
| Database | SQLite (PocketBase) | PostgreSQL | Overkill for <20 users; requires separate server process |

---

## Installation Reference

```bash
# 1. Scaffold SvelteKit
npm create svelte@latest vs3-panel
# Choose: Skeleton project, TypeScript, ESLint, Prettier

# 2. Install core dependencies
npm install pocketbase
npm install chart.js svelte-chartjs
npm install date-fns zod

# 3. Install Tailwind CSS (verify version with shadcn-svelte docs)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Install shadcn-svelte (follow https://shadcn-svelte.com/docs/installation)
npx shadcn-svelte@latest init

# 5. Add SvelteKit Node adapter
npm install -D @sveltejs/adapter-node
```

PocketBase setup:
```bash
# Download single binary from https://github.com/pocketbase/pocketbase/releases
./pocketbase serve
# Admin UI at http://127.0.0.1:8090/_/
```

---

## Known Gaps Requiring Phase-Level Research

1. **Weekly deadline cron job:** PocketBase does not have a built-in scheduler. Options are: (a) PocketBase JSVM hooks with a ticker, (b) a separate lightweight cron container in Compose, (c) the SvelteKit server calling a PocketBase API endpoint on a timer. Research this in the Upkeep Automation phase.

2. **Svelte 5 runes stability:** Svelte 5 was released in October 2024. The ecosystem (shadcn-svelte, svelte-chartjs) may still have Svelte 4 as the tested baseline. Verify component library compatibility before committing to Svelte 5 runes syntax.

3. **Tailwind CSS v4 + shadcn-svelte compatibility:** Tailwind v4 changed the config format significantly. Verify shadcn-svelte's current Tailwind requirement at https://shadcn-svelte.com before setup.

4. **Railway free tier availability:** Railway's free tier terms changed in 2024. Verify current pricing/credits at https://railway.app/pricing before recommending to the non-developer host.

---

## Sources

> All sources below are cited for verification. External fetch was unavailable during research — these URLs represent where to verify each claim.

- PocketBase releases and changelog: https://github.com/pocketbase/pocketbase/releases
- PocketBase documentation: https://pocketbase.io/docs/
- SvelteKit documentation: https://kit.svelte.dev/docs
- Svelte 5 documentation: https://svelte.dev/docs/svelte/overview
- shadcn-svelte: https://shadcn-svelte.com/docs
- Chart.js 4 docs: https://www.chartjs.org/docs/latest/
- svelte-chartjs: https://github.com/SauravKanchan/svelte-chartjs
- Railway pricing: https://railway.app/pricing
- Tailwind CSS v4 migration: https://tailwindcss.com/docs/v4-beta (verify current URL)
- `@sveltejs/adapter-node`: https://kit.svelte.dev/docs/adapter-node
- `date-fns` v3: https://date-fns.org/docs/Getting-Started
- `zod` v3: https://zod.dev/

**Confidence summary:**

| Claim | Confidence | Reason |
|-------|------------|--------|
| PocketBase is suitable for this use case | HIGH | Architectural fit is clear from documented features |
| PocketBase version 0.22.x | MEDIUM | Training data; verify at GitHub releases |
| SvelteKit 2.x is stable | HIGH | Released Nov 2023, stable major version |
| Svelte 5 runes are production-ready | MEDIUM | Released Oct 2024, ecosystem adoption varies |
| shadcn-svelte Tailwind v4 compatibility | LOW | Tailwind v4 is recent; ecosystem migration ongoing |
| Railway free tier terms | LOW | Free tier terms changed in 2024; verify before recommending |
| Chart.js 4.x stability | HIGH | Very stable library, no major breaking changes |
| Docker Compose deployment pattern | HIGH | Industry-standard, well-documented |
