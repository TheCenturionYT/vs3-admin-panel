# Phase 1: Foundation - Research

**Researched:** 2026-05-01
**Domain:** PocketBase auth collections + SvelteKit scaffold + shadcn-svelte + Railway/Docker deployment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Deployment Path**
- D-01: Railway is the PRIMARY deployment path. The step-by-step guide targets Railway.
- D-02: Docker Compose is documented as a SECONDARY path (appendix or separate section).
- D-03: Both paths share the same repository structure. No platform-specific code.

**Auth & Session Handling**
- D-04: PocketBase superuser created during first deploy via CLI command or `/admin` setup flow. Documented in deployment guide.
- D-05: Staff accounts (`staff` collection) created by Head Admin through Staff Management page. PocketBase admin UI used only for initial superuser.
- D-06: Faction member accounts (`members` collection) also created through Staff Management page by Head Admin or Staff.
- D-07: Session tokens use PocketBase SDK defaults (30-day tokens stored via cookie, auto-refreshed). Staff do not re-login daily.
- D-08: On session expiry, app redirects to login with "Session expired" notice.
- D-09: Login page is the app root for unauthenticated users. Authenticated users redirect to `/dashboard`.

**App Shell & Navigation**
- D-10: Left sidebar, persistent on desktop. Minimum viewport 1024px (no mobile layout).
- D-11: Sidebar in Phase 1: Dashboard (stub), Staff Management (active), Server Log (stub), all other sections disabled with "Coming in Phase N" tooltip.
- D-12: Top bar: current username + role badge + logout button.
- D-13: Staff Management is the only substantive UI. Must demonstrate role enforcement — only Head Admin can create/deactivate; Staff sees read-only list.
- D-14: Portal route (`/portal`) exists as separate SvelteKit route group with minimal "coming soon" page.

**Visual Theme**
- D-15: Full dark gold medieval theme via Tailwind CSS custom properties in `app.css`. All phases inherit.
- D-16: Exact palette: bg-primary `#1a1410`, bg-secondary `#231d14`, bg-tertiary `#2c2518`, gold `#c4a45a`, gold-hover `#d4b46a`, text-primary `#d4c5a0`, text-muted `#8b7d65`, border `#3d3426`, danger `#8b2b2b`, success `#3d6b3d`.
- D-17: System sans-serif body font. No custom font download in Phase 1.
- D-18: shadcn-svelte initialized in Phase 1, shared across all phases. Palette via CSS variable overrides.

**PocketBase Schema**
- D-19: Phase 1 collections: `staff`, `members`, `factions` (name only), `job_run_log`, `server_log`.
- D-20: Collection API rules (exact):
  - `staff` list/view: `@request.auth.role = "head_admin" || @request.auth.id = id`
  - `staff` create/update: `@request.auth.role = "head_admin"`
  - `staff` delete: `@request.auth.role = "head_admin"`
  - `members` list/view: `@request.auth.role = "head_admin" || @request.auth.role = "staff"`
  - `members` create/update: `@request.auth.role = "head_admin" || @request.auth.role = "staff"`
  - `members` delete: `@request.auth.role = "head_admin"`

**Scheduler Architecture**
- D-21: Scheduler implementation chosen: PocketBase JSVM hooks (`pb_hooks/`). Uses `cronAdd()` — runs server-side in the PocketBase process. No separate container needed.
- D-22: Phase 1 creates `pb_hooks/` structure and a placeholder hook file. Actual deadline logic goes in Phase 3.

### Claude's Discretion

User is not familiar enough with code to direct implementation choices. All structural/implementation decisions are left to Claude's judgment within the constraints above.

### Deferred Ideas (OUT OF SCOPE)

- Real-time multi-client sync beyond PocketBase SSE subscriptions — Phase 2+ concern
- Granular activity logs per staff account — Phase 2 (LOG-01 scope)
- Faction color picker in Staff Management — Phase 2 when factions are built
- Mobile layout — explicitly out of scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Staff member can log in with username/password and stay logged in across page loads | PocketBase JS SDK SSR cookie pattern via `hooks.server.ts`; `authStore.exportToCookie()` + `loadFromCookie()` verified |
| AUTH-02 | Head Admin accounts can perform destructive actions; Staff cannot | PocketBase collection `deleteRule`: `@request.auth.role = "head_admin"` enforced at API layer; SvelteKit route-level guard in `+layout.server.ts` |
| AUTH-03 | Faction member can log in and access player portal | `members` auth collection with `authWithPassword()`; separate route group `(portal)` |
| AUTH-04 | Faction member portal shows only that member's faction data — enforced at API level | PocketBase filter rule `@request.auth.faction = faction` on relevant collections; not a UI concern |
| AUTH-05 | Staff can create, edit, and deactivate staff and member accounts from admin panel | Staff Management page; PocketBase REST API via JS SDK from SvelteKit form actions |
| AUTH-06 | Per-account activity logged (last login timestamp visible to Head Admin) | `lastLogin` field on `staff` collection; updated via JSVM `onRecordAuthRequest` hook |
| DEPLOY-01 | Non-developer can follow a step-by-step guide with no coding experience | Railway guide: GitHub connect → push → set env vars → done; Docker Compose guide: clone → copy .env → `docker compose up -d` |
| DEPLOY-02 | Multiple staff on different PCs can access the same panel with shared state | PocketBase serves shared SQLite; SvelteKit frontend stateless; PocketBase SSE for real-time |
| DEPLOY-03 | Deployment requires no paid third-party SaaS beyond hosting provider | PocketBase is self-hosted; Railway free credit covers small team; no auth SaaS needed |
| UX-01 | Dark gold medieval aesthetic consistent with VS3 visual identity | shadcn-svelte CSS variable overrides in `app.css`; Tailwind v4 `@theme inline` block maps CSS vars to utility classes |
| UX-02 | Staff workflows guided — forms pre-fill, warns before errors, multi-step streamlined | shadcn-svelte form components + SvelteKit form actions with validation; error state returned from actions |
</phase_requirements>

---

## Summary

Phase 1 establishes the structural backbone: PocketBase collections with API-level RBAC, a SvelteKit scaffold with SSR auth, staff login/logout, the Staff Management page demonstrating role enforcement, the dark gold theme baseline, and deployment documentation. All decisions from CONTEXT.md are locked — this research resolves the technical execution details without revisiting those choices.

**Key finding on shadcn-svelte:** The current release (1.x) now **requires** Svelte 5 and Tailwind v4. The prior concern about compatibility is resolved — the latest CLI (`shadcn-svelte@latest`) targets Svelte 5 runes natively. Using anything older would require following a migration guide, so starting fresh with the current stack is the right approach. [VERIFIED: shadcn-svelte.com/docs/migration]

**Key finding on PocketBase JSVM `cronAdd`:** `cronAdd()` is a top-level function available in `pb_hooks/*.js` files. It takes a jobId string, cron expression, and handler function. Registration happens at file-load time — the hook file is loaded when PocketBase starts. No `onBootstrap` wrapper is needed for the registration itself; `cronAdd()` can be called at the module level. [VERIFIED: pocketbase.io/jsvm]

**Primary recommendation:** Scaffold with `npx sv create` (includes Tailwind), then `npx shadcn-svelte@latest init`. Use `hooks.server.ts` for the PocketBase auth cookie pattern. Route group `(staff)` for admin routes, `(portal)` for member routes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User authentication | PocketBase (auth collections) | SvelteKit (cookie relay, redirect guards) | PocketBase owns password hashing, JWT issuance, token validation |
| RBAC enforcement | PocketBase (collection API rules) | SvelteKit (route-level guard) | API rules are the security boundary; SvelteKit guards are UX-level protection |
| Faction data scoping | PocketBase (collection filter rules) | — | Must be enforced at query level, not UI; PocketBase collection rules are the only valid location |
| Session management | PocketBase (authToken duration) | SvelteKit hooks.server.ts (cookie sync) | PocketBase issues 30-day tokens; SvelteKit relays them as cookies across SSR/client |
| Staff Management CRUD | SvelteKit (form actions) | PocketBase (REST API) | SvelteKit form actions call PocketBase API; PocketBase enforces rules |
| Navigation/routing | SvelteKit (route groups, layouts) | — | Frontend routing concern; PocketBase has no routing role |
| Dark theme baseline | SvelteKit/CSS (app.css, Tailwind) | — | Pure frontend CSS concern |
| Deployment scaffold | Docker/Railway (infra) | SvelteKit + PocketBase (app layer) | Infrastructure is separate from application code |
| Scheduler placeholder | PocketBase JSVM (pb_hooks/) | — | cronAdd() runs inside PocketBase process; Phase 3 fills in logic |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pocketbase (JS SDK) | 0.26.8 | PocketBase API client, auth store, SSR cookie handling | Official SDK; only client for PocketBase |
| svelte | 5.55.5 | Reactive component model with runes | Required by shadcn-svelte 1.x; runes are the current paradigm |
| @sveltejs/kit | 2.59.0 | Framework: SSR, routing, form actions, load functions | Current stable release |
| @sveltejs/adapter-node | 5.5.4 | Build SvelteKit for Node.js server (Railway/Docker) | Required for SSR + form actions on Railway |
| shadcn-svelte (CLI) | 1.2.7 | Accessible UI component primitives copied into project | Current release; Svelte 5 + Tailwind v4 native |
| tailwindcss | 4.2.4 | Utility CSS; `@theme inline` block for CSS variable mapping | Required by shadcn-svelte 1.x |
| bits-ui | 2.18.0 | Headless primitives used by shadcn-svelte components | Installed transitively via shadcn-svelte CLI |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.24.1 | Runtime form/data validation | All form action handlers in SvelteKit |
| date-fns | 4.1.0 | Date formatting and deadline arithmetic | Any timestamp display; Phase 3 deadline calculations |
| tw-animate-css | (latest) | Animation classes for shadcn-svelte components | Installed by shadcn-svelte init |
| @lucide/svelte | (latest) | Icon set matching shadcn-svelte aesthetic | Navigation icons, status badges |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn-svelte | Skeleton UI | Both support Svelte 5; shadcn-svelte has more compositional data-table/form primitives |
| shadcn-svelte | DaisyUI | DaisyUI lacks accessible complex components (dialogs, selects); insufficient for admin panel |
| @sveltejs/adapter-node | adapter-static | Static export loses SSR, form actions, and server hooks — incompatible with auth pattern |
| Tailwind v4 | Tailwind v3 | shadcn-svelte 1.x requires Tailwind v4; no choice if using current shadcn-svelte |

**Installation (verified order):**
```bash
# 1. Scaffold SvelteKit with Tailwind included
npx sv create vs3-panel --add tailwindcss
# Choose: TypeScript, ESLint, Prettier — No additional features

# 2. Install PocketBase SDK and supporting libraries
npm install pocketbase zod date-fns

# 3. Install adapter-node for Railway/Docker deployment
npm install -D @sveltejs/adapter-node

# 4. Initialize shadcn-svelte (installs bits-ui, tw-animate-css, lucide-svelte etc.)
npx shadcn-svelte@latest init
# Answer prompts: base color "slate", CSS path "src/app.css", default aliases

# 5. Add components as needed (example)
npx shadcn-svelte@latest add button card table badge dialog separator
```

**Version verification:** Versions above confirmed via `npm view [package] version` on 2026-05-01. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (staff)
    │
    │ HTTPS request (with pb_auth cookie)
    ▼
SvelteKit Node Server (Railway service or Docker)
    │
    ├── hooks.server.ts
    │     loadFromCookie() → authStore populated
    │     authRefresh() → validates token against PocketBase
    │     exportToCookie() → updated cookie on response
    │
    ├── (staff) route group ─── +layout.server.ts (redirect if !auth || role check)
    │     ├── /dashboard ─── stub page
    │     ├── /staff-management ─── ACTIVE: list/create/deactivate accounts
    │     └── /[other stubs]
    │
    ├── (portal) route group ─── +layout.server.ts (redirect if !members auth)
    │     └── /portal ─── "Portal access coming soon" page
    │
    └── /login ─── form action → locals.pb.collection('staff').authWithPassword()
                               → locals.pb.collection('members').authWithPassword()

    │
    │ HTTP (internal Docker network or Railway private network)
    ▼
PocketBase binary (Railway service or Docker sidecar)
    │
    ├── API rules enforce: @request.auth.role = "head_admin" on destructive ops
    ├── Collections: staff (auth), members (auth), factions, job_run_log, server_log
    ├── SQLite: pb_data/data.db (persisted via Docker volume or Railway volume)
    └── pb_hooks/scheduler.js ─── cronAdd() placeholder (Phase 3 fills logic)
```

### Recommended Project Structure

```
vs3-panel/
├── src/
│   ├── app.css              # Tailwind imports + shadcn CSS vars + VS3 gold palette overrides
│   ├── app.d.ts             # App.Locals type declaration (pb: PocketBase)
│   ├── hooks.server.ts      # Auth cookie load/export on every request
│   ├── lib/
│   │   ├── components/
│   │   │   └── ui/          # shadcn-svelte copied components (Button, Card, Table, etc.)
│   │   ├── server/
│   │   │   ├── pocketbase.ts  # PocketBase URL env var + superuser client helper
│   │   │   └── auth.ts        # requireStaffAuth(), requireHeadAdmin() guard functions
│   │   └── utils.ts           # cn() class merger from shadcn init
│   └── routes/
│       ├── +layout.svelte   # Root layout (minimal, no auth assumption)
│       ├── login/
│       │   ├── +page.svelte       # Login form (gold medieval styled)
│       │   └── +page.server.ts    # Form action: authWithPassword, redirect to /dashboard
│       ├── (staff)/               # Route group: staff app (no URL effect)
│       │   ├── +layout.server.ts  # Guard: redirect to /login if not staff auth
│       │   ├── +layout.svelte     # App shell: sidebar + topbar
│       │   ├── dashboard/
│       │   │   └── +page.svelte   # Stub: "Phase 2" placeholder
│       │   ├── staff-management/
│       │   │   ├── +page.svelte        # Staff/member list with role-gated actions
│       │   │   └── +page.server.ts     # load(): fetch staff+members; actions: create/update/deactivate
│       │   └── server-log/
│       │       └── +page.svelte   # Stub: "Phase 2" placeholder
│       └── (portal)/              # Route group: player portal (no URL effect)
│           ├── +layout.server.ts  # Guard: redirect to /login if not members auth
│           └── portal/
│               └── +page.svelte   # "Portal access coming soon" page
├── pb_hooks/
│   └── scheduler.js         # cronAdd() placeholder with JSDoc — Phase 3 fills logic
├── pb_migrations/           # (empty in Phase 1 — schema managed via PocketBase admin UI)
├── static/
├── svelte.config.js         # adapter-node configuration
├── tailwind.config.ts       # (if using Tailwind v3 compat; Tailwind v4 uses app.css @theme)
├── components.json          # shadcn-svelte config
├── .env.example             # POCKETBASE_URL, PUBLIC_POCKETBASE_URL
├── .env                     # gitignored
├── Dockerfile               # SvelteKit service (multi-stage: build + node runtime)
├── Dockerfile.pb            # PocketBase service (alpine wget → scratch)
├── docker-compose.yml       # Both services + pb_data volume
└── docs/
    └── DEPLOYMENT.md        # Non-developer Railway + Docker Compose guide
```

### Pattern 1: SSR Auth Cookie Pattern (SvelteKit + PocketBase)

**What:** Per-request PocketBase instance initialized from cookie, refreshed, and written back as cookie on response.

**When to use:** Every SvelteKit request. This is the canonical integration pattern for PocketBase + SvelteKit SSR.

```typescript
// Source: https://github.com/pocketbase/js-sdk/blob/master/README.md
// src/hooks.server.ts
import PocketBase from 'pocketbase';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

    // Load auth state from the request cookie
    event.locals.pb.authStore.loadFromCookie(
        event.request.headers.get('cookie') || ''
    );

    try {
        // Refresh the token if valid — keeps sessions alive
        if (event.locals.pb.authStore.isValid) {
            await event.locals.pb.collection('users').authRefresh();
        }
    } catch {
        event.locals.pb.authStore.clear();
    }

    const response = await resolve(event);

    // Write updated auth cookie back to client
    response.headers.append(
        'set-cookie',
        event.locals.pb.authStore.exportToCookie({ httpOnly: true, secure: true, sameSite: 'Strict' })
    );

    return response;
};
```

**Note:** The `authRefresh()` call uses `collection('users')` in SDK examples but must be `collection('staff')` or `collection('members')` depending on which collection the user authenticated against. The auth store's `record?.collectionName` field indicates which. An implementation detail the planner must address.

### Pattern 2: Route-Level Auth Guard

**What:** `+layout.server.ts` in each route group redirects unauthenticated users to login.

**When to use:** Every protected route group. Head-admin-only routes need an additional role check.

```typescript
// Source: https://svelte.dev/docs/kit/load
// src/routes/(staff)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // locals.pb.authStore populated by hooks.server.ts
    if (!locals.pb.authStore.isValid) {
        redirect(303, '/login');
    }
    const record = locals.pb.authStore.record;
    return {
        user: {
            id: record?.id,
            username: record?.username,
            role: record?.role,
        }
    };
};
```

### Pattern 3: PocketBase Collection API Rules

**What:** Exact filter syntax for RBAC enforced at the PocketBase API layer.

**When to use:** Setting collection rules via PocketBase admin UI or migrations. These are the security enforcement boundary.

```
// Source: https://pocketbase.io/docs/api-rules-and-filters
// Rule: null  → locked (superuser only)
// Rule: ""    → anyone can perform the action
// Rule: "expr" → only if filter expression is true

// staff list/view:
@request.auth.role = "head_admin" || @request.auth.id = id

// staff create/update/delete (head admin only):
@request.auth.role = "head_admin"

// members list/view (any staff):
@request.auth.role = "head_admin" || @request.auth.role = "staff"

// members delete (head admin only):
@request.auth.role = "head_admin"

// Faction-scoped (Phase 4 — members collection reading faction data):
@request.auth.collectionName = "members" && faction = @request.auth.record.faction
```

### Pattern 4: PocketBase JSVM cronAdd() in pb_hooks

**What:** Server-side cron job registered in a JS hook file loaded by PocketBase at startup.

**When to use:** Phase 1 creates the placeholder; Phase 3 fills the handler.

```javascript
// Source: https://pocketbase.io/jsvm/functions/cronAdd.html
// pb_hooks/scheduler.js

// cronAdd() is a global function available in pb_hooks context.
// Called at module level — runs once at PocketBase startup.
// If a job with the same ID exists it is replaced (safe for restarts).
cronAdd("upkeep_deadline_processor", "0 0 * * 0", () => {
    // Placeholder: Phase 3 implements deadline processing logic here.
    // This cron runs every Sunday at 00:00.
    // DO NOT implement business logic here yet.
    console.log("[scheduler] upkeep_deadline_processor triggered — logic pending Phase 3");
});
```

**Constraint:** `cronAdd()` is available only in the `pb_hooks` context. It cannot be called from SvelteKit or external processes.

### Pattern 5: shadcn-svelte CSS Variable Override for VS3 Theme

**What:** Override shadcn-svelte's default HSL/OKLCH palette with the VS3 medieval gold palette using the Tailwind v4 `@theme inline` block.

**When to use:** Phase 1 `src/app.css` — this is the single source of truth for all colors across all phases.

```css
/* Source: https://www.shadcn-svelte.com/docs/migration/tailwind-v4 */
/* src/app.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* VS3 Medieval Gold Palette — overrides shadcn defaults */
:root {
  /* The app always runs in dark mode — no light mode needed */
  --background:        #1a1410;   /* near-black dark brown — bg-primary */
  --card:              #231d14;   /* slightly lighter — bg-secondary (cards/panels) */
  --popover:           #231d14;
  --muted:             #2c2518;   /* bg-tertiary (hover states, inputs) */
  --input:             #2c2518;

  --foreground:        #d4c5a0;   /* parchment off-white — text-primary */
  --card-foreground:   #d4c5a0;
  --popover-foreground: #d4c5a0;
  --muted-foreground:  #8b7d65;   /* secondary text-muted */

  --primary:           #c4a45a;   /* gold accent */
  --primary-foreground: #1a1410;  /* dark text on gold buttons */
  --secondary:         #2c2518;
  --secondary-foreground: #d4c5a0;
  --accent:            #d4b46a;   /* gold-hover */
  --accent-foreground: #1a1410;

  --border:            #3d3426;   /* subtle dark gold border */
  --ring:              #c4a45a;

  --destructive:       #8b2b2b;   /* muted red */
  --destructive-foreground: #d4c5a0;

  /* Success (non-shadcn custom — use with text-[--success] in components) */
  --success:           #3d6b3d;

  --radius: 0.375rem;             /* slightly tighter than shadcn default */
}

@theme inline {
  --color-background:  var(--background);
  --color-foreground:  var(--foreground);
  --color-card:        var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-muted:       var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-primary:     var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-border:      var(--border);
  --color-input:       var(--input);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-ring:        var(--ring);
  --color-accent:      var(--accent);
  --color-success:     var(--success);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    /* Force dark mode always — no theme toggle */
  }
}
```

### Anti-Patterns to Avoid

- **Calling `authWithPassword` against the wrong collection:** The login page must explicitly call `locals.pb.collection('staff')` for staff and `locals.pb.collection('members')` for portal users. Using a generic `users` collection (which does not exist in this schema) will silently fail.
- **Skipping the `authRefresh()` call in hooks:** Without refresh, a valid token near expiry is not renewed, leading to unexpected logouts mid-session.
- **Placing the auth guard only in the layout Svelte component:** Guards must be in `+layout.server.ts` (runs on server), not `+layout.svelte` (runs on client). Client-side guards can be bypassed.
- **Hardcoding PocketBase URL:** The internal Docker URL (`http://pocketbase:8090`) differs from the Railway private network URL and the public URL used during build. Use environment variables with a fallback.
- **Using `adapter-static`:** The auth cookie pattern requires server-side execution. Static export removes `hooks.server.ts` and form actions. Use `adapter-node`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom crypto.createHash | PocketBase built-in | PocketBase uses bcrypt internally; bypassing it with raw SQL inserts would store plaintext |
| JWT issuance and validation | Custom JWT library | PocketBase authStore | Token lifecycle managed by PocketBase; refreshed automatically via authRefresh() |
| Session storage | Custom localStorage or cookie handler | PocketBase SDK authStore.exportToCookie() / loadFromCookie() | Handles serialization, expiry, SameSite, HttpOnly, Secure flags |
| Role-based access | Custom middleware checking role field | PocketBase collection API rules | Rules are enforced at the database query layer, not the application layer |
| Component primitives (dialogs, selects, tables) | Custom accessible implementations | shadcn-svelte | Focus traps, ARIA roles, keyboard navigation are already correct |
| Form state management | Custom reactive form state | SvelteKit form actions + `use:enhance` | Progressive enhancement, server-side validation, error forwarding built-in |
| Cron scheduling | Custom setInterval or node-cron in SvelteKit | PocketBase JSVM cronAdd() | cronAdd() runs inside PocketBase process; SvelteKit-based timers would not survive SvelteKit restarts and would create race conditions |

**Key insight:** PocketBase eliminates the entire auth infrastructure layer. Every hour spent building custom auth, sessions, or RBAC is a wasted hour because PocketBase provides verified implementations of all of them.

---

## Common Pitfalls

### Pitfall 1: Wrong Auth Collection in authRefresh

**What goes wrong:** `hooks.server.ts` calls `event.locals.pb.collection('users').authRefresh()` but the project uses `staff` and `members` collections. The call fails silently (the SDK catches the 404) but clears the auth store, logging users out on every request.

**Why it happens:** SDK examples use `collection('users')` — the default built-in collection name — which does not exist when using custom auth collections.

**How to avoid:** Inspect `event.locals.pb.authStore.record?.collectionName` after `loadFromCookie()`. If it is `'staff'`, call `collection('staff').authRefresh()`. If it is `'members'`, call `collection('members').authRefresh()`. Or call both with a try/catch on each.

**Warning signs:** Users are logged out after every page load despite having a valid-looking cookie.

---

### Pitfall 2: Railway Build Fails Because PocketBase Is Not Running During Build

**What goes wrong:** SvelteKit's build step (`vite build`) may attempt to execute server load functions to prerender routes. If those load functions call PocketBase, and PocketBase is not running during the build phase, the build fails or produces an empty prerendered result.

**Why it happens:** Railway's private network is not available during the build phase — only at runtime. The PocketBase service may also not be started when the SvelteKit build runs.

**How to avoid:** Set `export const prerender = false` on any route that calls PocketBase (or set it globally in `svelte.config.js`). Use `PUBLIC_POCKETBASE_URL` (the public Railway domain) in the build environment, with `POCKETBASE_URL` (private network URL) at runtime. SvelteKit's `adapter-node` build does not prerender by default, so this is largely automatic — but verify no `prerender = true` is set on authenticated routes.

**Warning signs:** Railway build logs show PocketBase connection errors during the `vite build` step.

---

### Pitfall 3: PocketBase Data Lost on Railway Redeploy

**What goes wrong:** PocketBase stores data in `pb_data/` on the local filesystem. On Railway, each redeploy creates a fresh container. Without a persistent volume mounted at `pb_data/`, all collections, records, and the schema are wiped on every deploy.

**Why it happens:** Developers test locally where the filesystem persists. Railway containers are ephemeral by default.

**How to avoid:** Attach a Railway Volume with mount path `/pb_data` to the PocketBase service before the first deploy. Set PocketBase's `--dir` flag to `/pb_data` in the Dockerfile CMD. Verify the volume is attached in the Railway dashboard after deploy.

**Warning signs:** The PocketBase admin UI asks to create a new superuser on every deploy (first-run setup screen).

---

### Pitfall 4: shadcn-svelte `init` Overwrites app.css

**What goes wrong:** Running `npx shadcn-svelte@latest init` creates a new `app.css` with shadcn's default palette, overwriting the VS3 medieval gold palette.

**Why it happens:** The init command configures CSS variables as part of setup.

**How to avoid:** Run `shadcn-svelte init` first (before writing the VS3 palette), then add the VS3 palette overrides to `app.css`. Alternatively, back up `app.css` before running init and merge manually. The shadcn variables must exist for components to render — do not delete them. Override their values with the VS3 hex colors.

**Warning signs:** Components render with shadcn default slate/white theme instead of dark gold.

---

### Pitfall 5: Collection API Rules Set to `null` vs Empty String

**What goes wrong:** A PocketBase collection rule set to `null` (locked) means only superusers can access it. A rule set to `""` (empty string) means anyone can access it. The CONTEXT.md rules for `staff` create/update/delete are non-null non-empty — they require `@request.auth.role = "head_admin"`. If misconfigured as `null`, the SvelteKit app (which authenticates as a `staff` user, not superuser) cannot create staff accounts.

**Why it happens:** The PocketBase admin UI shows `null` as "Locked" with no obvious difference from a role-based rule in the UI.

**How to avoid:** After creating collections, verify each rule by attempting the operation as a `staff` auth user (not superuser). The `members` create rule must work for both `head_admin` and `staff` — verify both role tokens can create member records.

**Warning signs:** 403 errors when the Staff Management page tries to list staff accounts (listRule is `null` instead of the role filter).

---

## Code Examples

### Login Form Action (staff)

```typescript
// Source: https://github.com/pocketbase/js-sdk/blob/master/README.md
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        const data = await request.formData();
        const username = String(data.get('username'));
        const password = String(data.get('password'));

        try {
            // Try staff first, then members
            await locals.pb.collection('staff').authWithPassword(username, password);
            redirect(303, '/dashboard');
        } catch {
            // Staff login failed — check if it's a portal user
            try {
                await locals.pb.collection('members').authWithPassword(username, password);
                redirect(303, '/portal');
            } catch {
                return fail(400, { error: 'Invalid username or password' });
            }
        }
    }
};
```

### PocketBase Dockerfile (for Railway or Docker Compose)

```dockerfile
# Source: https://www.shrey.com/blog/deploy-pocketbase-on-railway/ [VERIFIED: WebFetch]
# Dockerfile.pb
FROM alpine:3 AS downloader
ARG VERSION=0.22.22
RUN apk add --no-cache ca-certificates unzip wget
RUN wget https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip \
    && unzip pocketbase_${VERSION}_linux_amd64.zip \
    && chmod +x /pocketbase

FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=downloader /pocketbase /usr/local/bin/pocketbase
VOLUME /pb_data
EXPOSE 8090
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
```

### Docker Compose (secondary path)

```yaml
# Source: Canonical pattern from research — [ASSUMED] exact file format, adjust ports as needed
# docker-compose.yml
services:
  pocketbase:
    build:
      context: .
      dockerfile: Dockerfile.pb
    volumes:
      - pb_data:/pb_data
    ports:
      - "8090:8090"
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - POCKETBASE_URL=http://pocketbase:8090
      - PUBLIC_POCKETBASE_URL=${PUBLIC_POCKETBASE_URL}  # external URL, set in .env
    ports:
      - "3000:3000"
    depends_on:
      - pocketbase
    restart: unless-stopped

volumes:
  pb_data:
```

### SvelteKit Dockerfile

```dockerfile
# Source: SvelteKit adapter-node pattern [ASSUMED] — adjust as needed
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build/index.js"]
```

### app.d.ts Type Declaration

```typescript
// Source: https://github.com/pocketbase/js-sdk/blob/master/README.md
// src/app.d.ts
import type PocketBase from 'pocketbase';

declare global {
    namespace App {
        interface Locals {
            pb: PocketBase;
        }
    }
}
export {};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn-svelte on Svelte 4 + Tailwind v3 | shadcn-svelte 1.x requires Svelte 5 + Tailwind v4 | shadcn-svelte 1.0 release (2025) | New projects must use current stack; migration guide exists for old projects |
| Tailwind v3 `tailwind.config.js` with `theme.extend.colors` | Tailwind v4 `app.css` with `@theme inline` block | Tailwind v4 (early 2025) | No `tailwind.config.js` needed for color configuration; everything in CSS |
| `npm create svelte@latest` CLI | `npx sv create` (new `sv` CLI) | SvelteKit 2.x era | `sv create` includes `--add tailwindcss` flag — one-command scaffold with Tailwind |
| PocketBase JSVM `onBootstrap()` needed for hooks | `cronAdd()` called at module level in pb_hooks files | PocketBase 0.22.x | Hook files are loaded at startup; top-level `cronAdd()` registers on load |

**Deprecated/outdated:**
- `npm create svelte@latest`: Still works but `npx sv create` is the current canonical CLI.
- `@sveltejs/kit` versions below 2.x: Breaking changes in SvelteKit 2; use 2.x.
- shadcn-svelte Svelte 4 components: No longer maintained in 1.x releases.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Docker Compose YAML format (exact service names, volume syntax) | Code Examples | Minor — syntax errors caught at `docker compose up` time |
| A2 | SvelteKit Dockerfile uses `node:22-alpine` and `npm run build` produces `build/index.js` | Code Examples | Low risk — adapter-node output is documented; node version may differ from Railway |
| A3 | PocketBase version 0.22.22 is the current 0.22.x patch | Code Examples (Dockerfile.pb) | Low risk — use `VERSION` ARG to override at build time; check GitHub releases |
| A4 | `authRefresh()` with the correct collection name is the right pattern for refreshing both `staff` and `members` tokens | Pattern 1 | Medium risk — if SDK behavior differs for custom collections; test against real PocketBase instance |

---

## Open Questions

1. **Login routing: one page or two?**
   - What we know: Staff auth goes to `/dashboard`, member auth goes to `/portal`. Login page must attempt both collections.
   - What's unclear: Should there be a single `/login` page that tries both collections, or separate `/login` (staff) and `/portal/login` (members)?
   - Recommendation: Single `/login` page with one form. The action tries `staff` first, then `members`. The session cookie's `collectionName` field distinguishes the user type in subsequent requests. This is simpler for the deployment guide.

2. **`authRefresh()` collection detection**
   - What we know: `hooks.server.ts` must call `authRefresh()` on the correct collection.
   - What's unclear: The SDK example uses `collection('users')` — does `authStore.record?.collectionName` reliably identify the correct collection after `loadFromCookie()`?
   - Recommendation: Read `authStore.record?.collectionName` after `loadFromCookie()`. Write a switch: `'staff'` → refresh staff, `'members'` → refresh members. Add a test against a real PocketBase instance in Wave 0.

3. **PocketBase schema management approach**
   - What we know: Collections can be created via PocketBase admin UI or via API. CONTEXT.md does not specify.
   - What's unclear: Should Phase 1 use the PocketBase admin UI to create collections manually (simpler for non-developer), or use a migration script?
   - Recommendation: Use the PocketBase admin UI for Phase 1 (no migration script complexity). Document the exact collection/field configuration in the deployment guide. Phase 3 can introduce JSVM hook-based migrations if needed.

---

## Environment Availability

> No external tool dependencies beyond Node.js and Docker are required at development time. The target deployment environments are Railway (cloud) and Docker (local/VPS).

| Dependency | Required By | Available (dev machine) | Version | Fallback |
|------------|------------|------------------------|---------|----------|
| Node.js | SvelteKit build + dev server | Assumed present | Verify ≥ 18.x | Install Node.js 22 LTS |
| npm | Package management | Assumed present | — | — |
| Docker | Secondary deployment path, local PocketBase dev | Not verified | — | Run PocketBase binary directly |
| PocketBase binary | Local development against real PocketBase | Not verified | 0.22.x | Railway-hosted PocketBase (requires deploy first) |
| Railway account | Primary deployment | User provides | — | Docker Compose path |

**Note on local development:** Developers can run PocketBase as a single binary (`./pocketbase serve`) alongside `npm run dev` without Docker. The binary is downloaded from the GitHub releases page. Document both the binary and Docker paths for local dev in the deployment guide.

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` are directly relevant to Phase 1 and must be honored:

1. **Stack is locked:** PocketBase 0.22.x + SvelteKit 2 + Svelte 5 (runes) + shadcn-svelte + Tailwind CSS. Do not deviate.
2. **Faction privacy at query level only:** `@request.auth.faction = faction.id` enforcement is a PocketBase collection rule, not a UI filter. Phase 1 establishes the pattern before member accounts exist.
3. **Head Admin at route AND collection rule level:** Both `+layout.server.ts` redirect and PocketBase `deleteRule` must enforce it. Never UI-hiding alone.
4. **Deadline processor server-side only:** The `pb_hooks/` directory and `cronAdd()` pattern are established in Phase 1 even though the logic ships in Phase 3. This prevents a client-side implementation from being tempted later.
5. **Effective upkeep never stored:** Not relevant to Phase 1 but must be designed into Phase 3 — Phase 1 schema should not include any `effectiveUpkeep` columns.
6. **Scheduler failure must be visible:** `job_run_log` collection created in Phase 1 (per D-19) so Phase 3's health widget has a table to query. Schema must match: `type`, `startedAt`, `completedAt`, `status`, `details (json)`.
7. **Business logic from v1.2.1 JS, not handbook:** Not relevant to Phase 1 but must not be preempted by Phase 1 designs (no business logic calculation in Phase 1).
8. **Desktop-first, no mobile:** Minimum 1024px. No responsive breakpoints below that.
9. **Dark gold medieval aesthetic:** D-15 through D-18 are the authoritative color spec. `app.css` is the single source of truth.

---

## Sources

### Primary (HIGH confidence)
- `pocketbase.io/jsvm` — `cronAdd()` API, `onBootstrap`, hook file structure — [VERIFIED via Context7 /websites/pocketbase_io_jsvm]
- `pocketbase.io/docs/api-rules-and-filters` — collection API rule syntax (`@request.auth.*`) — [VERIFIED via Context7 /websites/pocketbase_io]
- `github.com/pocketbase/js-sdk` — SSR auth cookie pattern (hooks.server.ts integration) — [VERIFIED via Context7 /pocketbase/js-sdk]
- `svelte.dev/docs/kit/advanced-routing` — route groups with parentheses in directory names — [VERIFIED via Context7 /websites/svelte_dev_kit]
- `svelte.dev/docs/kit/load` — redirect from load, auth guard pattern — [VERIFIED via Context7 /websites/svelte_dev_kit]
- `svelte.dev/docs/kit/adapter-node` — PORT/HOST env vars, build output — [VERIFIED via Context7 /websites/svelte_dev_kit]
- `shadcn-svelte.com/docs/migration/svelte-5` — Svelte 5 compatibility, required deps — [VERIFIED via Context7 /websites/shadcn-svelte]
- `shadcn-svelte.com/docs/migration/tailwind-v4` — Tailwind v4 CSS variable pattern with `@theme inline` — [VERIFIED via Context7 /websites/shadcn-svelte]
- `shadcn-svelte.com/docs/installation/sveltekit` — `npx sv create --add tailwindcss` + `shadcn-svelte@latest init` — [VERIFIED via Context7 /websites/shadcn-svelte]
- npm registry — package versions verified 2026-05-01 [VERIFIED: npm view]

### Secondary (MEDIUM confidence)
- `docs.railway.com/guides/sveltekit` — Railway deployment steps, monorepo support, NODE adapter requirement — [VERIFIED via WebFetch]
- `shrey.com/blog/deploy-pocketbase-on-railway/` — PocketBase Dockerfile pattern, Railway volume mount path `/pb_data` — [VERIFIED via WebFetch]
- Railway search results — Railway's private network unavailable during build; fix with public domain during build — [CITED: station.railway.com via WebSearch]
- `shadcn-svelte.com/docs/changelog` — current release requires Svelte 5 + Tailwind v4 — [CITED: WebSearch results]

### Tertiary (LOW confidence)
- Docker Compose YAML structure for SvelteKit + PocketBase — [ASSUMED] based on patterns; validate with `docker compose up`
- PocketBase 0.22.22 as current patch — [ASSUMED] verify at github.com/pocketbase/pocketbase/releases

---

## Metadata

**Confidence breakdown:**
- PocketBase auth collection rules syntax: HIGH — verified against official docs
- PocketBase JSVM `cronAdd()` syntax: HIGH — verified against official JSVM docs
- SvelteKit SSR cookie pattern: HIGH — verified against official JS SDK docs
- shadcn-svelte + Svelte 5 + Tailwind v4 compatibility: HIGH — confirmed current release requires both
- Railway deployment pattern: MEDIUM — confirmed via official Railway guide + community blog
- Docker Compose file format: LOW — pattern is standard but exact file not verified via working example

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days; PocketBase JSVM docs are stable; shadcn-svelte releases frequently)
