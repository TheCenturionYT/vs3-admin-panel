# Architecture Patterns

**Project:** VS3 Admin Panel v2
**Researched:** 2026-05-01
**Confidence:** HIGH — pattern selection driven by hard constraints (self-hosted, SQLite, 3–6 staff, read-only player portal)

---

## Recommended Architecture

A single-server deployment with a Node.js HTTP API backend, a SQLite database, an in-process cron scheduler, and a lightweight SPA frontend. No microservices, no external queues, no managed auth services. Everything runs as one process on one machine.

```
Browser (Staff / Player Portal)
        |
        | HTTP (JSON REST + cookie auth)
        v
+---------------------------+
|   Express API Server      |
|   - Auth middleware       |
|   - Role guard middleware |
|   - Route handlers        |
|   - Cron scheduler        |  <-- in-process, node-cron
+---------------------------+
        |
        | better-sqlite3 (synchronous, in-process)
        v
+---------------------------+
|   SQLite database file    |
|   (single .db file)       |
+---------------------------+
```

This is deliberately the simplest shape that satisfies all constraints. One process, one file, one server. A non-developer can follow a guide: install Node, run `npm install`, run `node server.js`, done.

---

## Component Boundaries

| Component | Responsibility | Communicates With | Notes |
|-----------|---------------|-------------------|-------|
| **Auth Layer** | Login/logout, session validation, role extraction | All routes (middleware) | Runs before every request |
| **Role Guard** | Enforce Head Admin / Staff / Faction Member access tiers | All protected routes | Checks role on session |
| **Faction API** | CRUD for factions, member roster, overextension calc | Node API (reads faction for upkeep calc) | |
| **Node API** | CRUD for nodes, upkeep submission logging, instability state | Faction API, Upkeep Engine, History Log | Most complex surface |
| **Upkeep Engine** | Calculate effective upkeep per node (base × multipliers), cap enforcement, payment status | Node API, War API, Faction API | Pure calculation logic, no DB writes of its own |
| **Deadline Processor** | Weekly scheduled job — processes all nodes, applies instability deltas, rolls events, writes history | Node API, Upkeep Engine, Event Table, History Log | Triggered by cron; also triggerable manually by Head Admin |
| **War/Siege API** | Declare/end wars, battle outcome logging, siege tracking | Faction API (war modifier propagation) | |
| **Alliance/Diplomacy API** | Alliance CRUD, NAP/vassalage records | Faction API | Simpler surface |
| **Event System** | Instability event selection by node type, staff action buttons (apply SP debt, mark RP handled, dismiss) | Node API, History Log | Event table is static config, outcomes write to DB |
| **History Log** | Append-only event log for all significant actions | All write-path APIs | Written to via insert, never updated |
| **Player Portal API** | Faction-scoped read endpoints — own nodes, global war/alliance board | Faction API, Node API, War API | Separate route prefix, enforces faction_id filter |
| **Metrics API** | SP submission aggregates, weekly owed vs paid, instability heatmap data | Node API, History Log | Read-only, no writes |
| **Frontend SPA** | All UI — staff admin panel + player portal as distinct route groups | API server via fetch | Single build, two visual modes based on session role |

---

## Auth Architecture: Sessions, Not JWT

**Decision: HTTP-only cookie sessions (express-session + connect-sqlite3 store)**

Rationale for this scale:

- **JWT is stateless** — you cannot invalidate a JWT without a token blocklist, which defeats statelessness and adds infrastructure. For 3–6 staff on a single server, this complexity buys nothing.
- **Sessions are simple to reason about** — logout deletes the session row, role changes take effect on the next request, no token expiry edge cases.
- **HTTP-only cookies** prevent XSS token theft without any extra configuration.
- **connect-sqlite3** stores sessions in the same SQLite file — zero additional infrastructure.
- **Self-hosted guide simplicity** — no secret rotation for JWT signing keys, no refresh token logic, no client-side token storage decisions.

Session record structure (in `sessions` table, managed by connect-sqlite3):
```
session_id (string PK)
user_id    (FK → users)
role       (head_admin | staff | faction_member)
faction_id (nullable FK → factions, set for faction_member only)
expires    (datetime)
```

Auth flow:
```
POST /api/auth/login
  → validate credentials
  → create session row
  → set Set-Cookie: session_id (HttpOnly, SameSite=Strict)
  → return { role, faction_id }

All subsequent requests:
  → Cookie: session_id header read by express-session
  → req.session.user populated
  → role guard middleware checks req.session.user.role

POST /api/auth/logout
  → destroy session row
  → clear cookie
```

---

## Frontend Architecture: Vite SPA (Single Build, Two Modes)

**Decision: Single-page application with React (or Vue), built with Vite, served as static files from Express.**

The staff admin panel and player portal are the same frontend build. The displayed interface switches based on the authenticated user's role. There is no separate deployment, no separate server for the portal.

Route structure in the SPA:
```
/login              → login form (unauthenticated)
/admin/*            → staff views (role: head_admin | staff)
/portal/*           → player portal views (role: faction_member)
```

Express serves the built `dist/` folder as static assets. All `/api/*` routes go to the API handlers. All other routes return `index.html` (SPA fallback).

**Why not SSR?**
- SSR (Next.js, Remix, SvelteKit) adds a Node rendering server, complicates self-hosted deployment, and provides SEO benefits irrelevant to an admin panel behind a login wall.
- The data is dynamic and user-specific — static generation gives nothing.
- Vite + React/Vue can be built once and served as files. Express adds a single `express.static('dist')` line.

**Why not multi-page (MPA)?**
- The admin panel has heavy UI state (tabs within node detail view, inline upkeep submissions, real-time cap warnings). An MPA would require page reloads through all of this, or reimplementing state management with server-side templating.
- A single JS bundle with client-side routing handles tab state, form state, and conditional rendering naturally.

---

## REST API Design

Standard resource-based REST. No GraphQL (too much setup for small team), no tRPC (requires full-stack TypeScript commitment up front).

```
Auth
  POST   /api/auth/login
  POST   /api/auth/logout
  GET    /api/auth/me

Factions
  GET    /api/factions
  POST   /api/factions
  GET    /api/factions/:id
  PUT    /api/factions/:id
  DELETE /api/factions/:id          (head_admin only)
  GET    /api/factions/:id/members
  POST   /api/factions/:id/members
  DELETE /api/factions/:id/members/:userId

Nodes
  GET    /api/nodes
  POST   /api/nodes
  GET    /api/nodes/:id
  PUT    /api/nodes/:id
  DELETE /api/nodes/:id             (head_admin only)
  GET    /api/nodes/:id/history
  GET    /api/nodes/:id/upkeep
  POST   /api/nodes/:id/upkeep      (log submission)
  GET    /api/nodes/:id/events

Upkeep / Deadline
  GET    /api/upkeep/cycle          (current cycle state)
  POST   /api/upkeep/process        (head_admin: trigger manual run)
  GET    /api/upkeep/summary        (owed vs paid per faction)

Wars
  GET    /api/wars
  POST   /api/wars
  PUT    /api/wars/:id
  POST   /api/wars/:id/battles
  POST   /api/wars/:id/sieges

Alliances
  GET    /api/alliances
  POST   /api/alliances
  PUT    /api/alliances/:id

Events (instability)
  GET    /api/events                (pending events needing staff action)
  POST   /api/events/:id/resolve    (apply action: debt | instability | rp | dismiss)

Log
  GET    /api/log                   (filterable, paginated)

Metrics
  GET    /api/metrics/sp
  GET    /api/metrics/instability

Player Portal (faction-scoped, role: faction_member)
  GET    /api/portal/faction        (own faction detail)
  GET    /api/portal/nodes          (own faction's nodes only)
  GET    /api/portal/wars           (all wars, read-only)
  GET    /api/portal/alliances      (all alliances, read-only)
```

Role guard middleware pattern:
```
requireAuth          → any logged-in session
requireStaff         → role in [staff, head_admin]
requireHeadAdmin     → role === head_admin
requirePortalOrStaff → role in [faction_member, staff, head_admin]
```

---

## Database Entity Relationships

SQLite with better-sqlite3. All foreign keys enabled (`PRAGMA foreign_keys = ON`). Schema uses integer primary keys throughout.

```
users
  id, username, password_hash, role (head_admin|staff|faction_member),
  faction_id (nullable FK → factions.id), created_at

factions
  id, name, slug, type (pvp|pve), color, created_at, disbanded_at (nullable)

faction_members
  id, faction_id (FK), user_id (FK), member_role (leader|officer|member),
  joined_at

nodes
  id, number, name, type, tier, owner_faction_id (FK → factions),
  base_upkeep, road_connected (bool), damage_toggled (bool),
  instability (int), created_at, notes

node_ownership_history
  id, node_id (FK), from_faction_id (nullable FK), to_faction_id (FK),
  method (peaceful|violent|contested), transferred_at, staff_note

upkeep_submissions
  id, node_id (FK), cycle_id (FK → upkeep_cycles), submitted_by (FK → users),
  item_name, item_qty, sp_value, category (raw_renewable|currency|other),
  submitted_at, staff_note

upkeep_cycles
  id, deadline_at, processed_at (nullable), status (open|processing|closed),
  created_at

node_cycle_results
  id, cycle_id (FK), node_id (FK),
  effective_upkeep (calculated), total_paid, payment_status (paid|partial|unpaid),
  instability_delta (int), instability_roll_result (nullable),
  event_triggered (bool)

instability_events
  id, node_id (FK), cycle_id (FK), event_type, description,
  status (pending|applied_debt|applied_instability|rp_handled|dismissed),
  created_at, resolved_at (nullable), resolved_by (nullable FK → users)

wars
  id, attacker_faction_id (FK), defender_faction_id (FK),
  casus_belli, declared_at, ended_at (nullable), outcome_notes (nullable),
  status (active|ended)

battles
  id, war_id (FK), node_id (nullable FK),
  attacker_faction_id (FK), defender_faction_id (FK),
  result (attacker_win|defender_win|draw), occurred_at,
  node_transferred (bool), staff_note

sieges
  id, war_id (FK), node_id (FK),
  attacker_faction_id (FK), defender_faction_id (FK),
  started_at, resolved_at (nullable), status (active|resolved),
  objectives, resolution_notes (nullable)

alliances
  id, type (alliance|nap|trade|vassalage|coalition),
  status (active|ended), formed_at, ended_at (nullable), notes

alliance_parties
  id, alliance_id (FK), faction_id (FK)

server_log
  id, event_type, entity_type (node|faction|war|cycle|alliance),
  entity_id, description, actor_id (nullable FK → users), occurred_at
```

Key relationships:
```
factions 1──* nodes                (nodes.owner_faction_id)
factions 1──* faction_members      (faction_members.faction_id)
users    1──1 faction_members      (a faction_member user has one membership)
nodes    1──* upkeep_submissions   (per-cycle submissions per node)
cycles   1──* node_cycle_results   (one result row per node per cycle)
wars     1──* battles
wars     1──* sieges
alliances 1──* alliance_parties    (N-party alliances supported)
nodes    1──* node_ownership_history
nodes    1──* instability_events
server_log is append-only (no FK enforcement to allow logging entity deletions)
```

Calculated fields (never stored, always derived at read time):
```
node.effective_upkeep = base_upkeep
  × overextension_multiplier(owner_faction)
  × war_modifier(owner_faction)

faction.overextension_multiplier = f(node_count, military_bonus)
faction.war_modifier             = f(active_wars_where_pvp_faction)
faction.total_sp_owed            = sum(node.effective_upkeep) for cycle
```

---

## Scheduled Job Architecture

**Decision: node-cron (in-process scheduler), not an external job runner.**

The weekly deadline processor runs inside the same Express process on a cron schedule. This means:
- No separate process to manage or restart
- Access to all DB helpers without IPC
- Self-hosted guide: "it runs automatically, no configuration needed beyond the deadline day/time in .env"

```
// server.js (simplified)
import cron from 'node-cron';
import { processDeadline } from './jobs/deadline-processor.js';

const DEADLINE_SCHEDULE = process.env.DEADLINE_CRON || '0 20 * * 0'; // Sunday 8pm

cron.schedule(DEADLINE_SCHEDULE, async () => {
  console.log('[cron] Running weekly deadline processor');
  await processDeadline();
});
```

Deadline processor steps (in transaction):
```
1. Open new upkeep_cycle row (status: processing)
2. For each active node:
   a. Sum upkeep_submissions for this cycle
   b. Calculate effective_upkeep (base × multipliers)
   c. Determine payment_status (paid / partial / unpaid)
   d. Calculate instability_delta (per handbook rules)
   e. Update node.instability
   f. If partial/unpaid: roll instability chance
   g. If roll triggers: insert instability_events row (status: pending)
   h. Insert node_cycle_results row
3. Close cycle (status: closed, processed_at: now)
4. Insert server_log entries for the cycle
5. Commit transaction
```

All steps run inside a single SQLite transaction. If anything fails, the entire cycle rolls back — no partial state.

Head Admin can also trigger a manual run via `POST /api/upkeep/process` (useful for testing, and for cycles that need to run off-schedule).

---

## Data Flow Diagrams

### Upkeep Submission (Staff entering a player's payment)

```
Staff browser
  POST /api/nodes/:id/upkeep { item, qty, sp_value, category, note }
    → requireStaff middleware
    → validate sp_value against cap (raw_renewable + currency ≤ 40% of effective_upkeep)
    → if cap exceeded: return 422 with warning details
    → insert upkeep_submissions row
    → insert server_log row
    → return updated node upkeep state
  ← { submission, cap_status, running_totals }
Staff browser updates upkeep totals in UI
```

### Weekly Deadline (Automated)

```
node-cron fires
  → deadline-processor.js
  → BEGIN TRANSACTION
  → for each node: calculate, write results, write instability events
  → COMMIT
  → (no HTTP involved — direct DB access)

Next staff page load:
  GET /api/events  → returns pending instability_events
  Staff reviews events, clicks action buttons
  POST /api/events/:id/resolve { action: 'apply_instability' }
    → update instability_events.status
    → apply side effects (SP debt → node record, etc.)
    → insert server_log row
```

### Player Portal Data Access

```
Faction member browser
  GET /api/portal/nodes
    → requireAuth middleware
    → role check: faction_member only
    → query nodes WHERE owner_faction_id = req.session.faction_id
    → NEVER returns other factions' nodes
  ← [own faction's nodes]

  GET /api/portal/wars
    → same auth
    → query wars WHERE status = 'active' (all factions visible — global board)
    → no instability or upkeep details returned
  ← [active wars]
```

---

## Build Order (Phase Dependencies)

The components have hard dependencies that dictate build sequence:

```
Layer 0 — Foundation (everything depends on this)
  Database schema + migrations
  Auth system (sessions, login/logout, role middleware)

Layer 1 — Core Data (no dependencies between these)
  Faction CRUD API
  Node CRUD API (depends on Faction for owner_faction_id)

Layer 2 — Business Logic (depends on Layer 1)
  Upkeep Engine (depends on Node + Faction for multiplier inputs)
  Upkeep submission logging (depends on Node + cycle concept)
  War/Siege API (depends on Faction)

Layer 3 — Automation (depends on Layer 2)
  Upkeep cycle model (cycles table, cycle CRUD)
  Deadline Processor job (depends on Upkeep Engine + all Layer 2 data)
  Instability Event system (depends on Deadline Processor output)

Layer 4 — Read Surfaces (depends on all prior layers)
  History Log / Server Log API
  Metrics API
  Player Portal API (faction-scoped views over Layer 1–3 data)
  Alliance/Diplomacy API (relatively isolated, but references Faction)

Layer 5 — Frontend (depends on all APIs)
  Auth UI (login form, session handling)
  Staff admin views (faction, node, war, upkeep, events)
  Player portal views (portal-scoped data)
```

Each layer can ship incrementally. The project is usable after Layer 2 (staff can enter data manually). Layer 3 is the core value unlock (automation). Layer 4 is reach and polish.

---

## Scalability Considerations

This app has a fixed, small user base (3–6 staff, ~20–50 faction members). Scalability is not a design driver. These notes exist to confirm the architecture is not over-engineered for the scale.

| Concern | At this scale | Notes |
|---------|---------------|-------|
| Concurrent writes | SQLite WAL mode handles 3–6 staff trivially | Enable `PRAGMA journal_mode=WAL` at startup |
| Scheduler reliability | In-process cron is fine; if process restarts, next cron fires on schedule | If process was down during the scheduled time, staff triggers manually |
| Session storage | connect-sqlite3 in same DB file | Fine for dozens of concurrent sessions |
| Query performance | All queries return small result sets; a node list will be ~50 rows | No indexing strategy needed beyond FK indexes |
| Horizontal scaling | Not a goal; single server, single process | If ever needed, sessions would need a Redis store — but that's future scope |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: JWT for sessions
**What:** Using JSON Web Tokens for user sessions
**Why bad:** Cannot invalidate tokens without a blocklist; adds refresh token complexity; no benefit over cookies for a self-hosted single-server app
**Instead:** HTTP-only cookie sessions via express-session

### Anti-Pattern 2: Storing calculated fields
**What:** Persisting `effective_upkeep`, `overextension_multiplier`, `war_modifier` as columns on nodes/factions
**Why bad:** These values depend on runtime state (number of active wars, node count) and go stale immediately on war declaration/end; keeping them in sync requires update cascades across multiple tables
**Instead:** Calculate on every read in the API layer; only persist the inputs (base_upkeep, node count, war status). SQLite is fast enough — these are single-digit millisecond computations over ~50 rows.

### Anti-Pattern 3: Calculating upkeep outside a transaction
**What:** Running the deadline processor as a sequence of separate queries without a transaction
**Why bad:** A server restart mid-cycle leaves nodes in partial payment states; impossible to audit or roll back
**Instead:** Single `BEGIN ... COMMIT` wrapping the entire cycle. If it fails, roll back and retry.

### Anti-Pattern 4: Leaking cross-faction data in portal API
**What:** Using a single `/api/nodes` endpoint for both staff and portal views, relying on frontend filtering
**Why bad:** Any logged-in faction member can call the raw endpoint and see all nodes
**Instead:** Separate `/api/portal/*` routes with `WHERE owner_faction_id = session.faction_id` enforced at the query level, not filtered after fetch

### Anti-Pattern 5: Mutable server log
**What:** Allowing log entries to be edited or deleted
**Why bad:** The log is the audit trail for disputed game decisions; mutability destroys its value
**Instead:** Append-only inserts only. No update/delete on server_log. Corrections are new entries.

### Anti-Pattern 6: External scheduler (cron job, systemd timer)
**What:** Running the deadline processor as a separate OS-level scheduled task
**Why bad:** Non-developer deployment guide becomes: "install Node, configure systemd, set up cron" — much harder to follow; process isolation means separate DB connection setup
**Instead:** node-cron inside the server process. One `node server.js`, everything runs.

---

## Sources

**Confidence note:** WebSearch and Bash tools were unavailable during this research session. All findings are based on:
- Direct analysis of PROJECT.md requirements and constraints
- Established patterns for Node.js/Express/SQLite self-hosted applications (HIGH confidence — well-documented, widely deployed pattern)
- Auth pattern analysis (sessions vs JWT) based on official security documentation principles
- SQLite concurrency characteristics from SQLite official documentation (WAL mode behavior)

Claims that would benefit from external verification:
- connect-sqlite3 compatibility with current express-session version (MEDIUM confidence — verify package README before implementation)
- node-cron API surface for schedule configuration (MEDIUM confidence — verify against current npm package docs)
- better-sqlite3 WAL mode pragma syntax (HIGH confidence — stable API, unchanged for years)
