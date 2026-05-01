# Research Summary — VS3 Admin Panel v2

**Synthesized:** 2026-05-01
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## Recommended Stack

**PocketBase + SvelteKit. No contest.**

The ARCHITECTURE.md agent suggested Express + SQLite + vanilla SPA. STACK.md recommended PocketBase + SvelteKit. The decision is clear: PocketBase wins because the user has zero coding experience and must self-host. Express requires writing auth, sessions, RBAC, migrations, and a scheduler from scratch — weeks of infrastructure work before any game logic is touched. PocketBase is a single Go binary that ships with all of it: auth collections, role-based API rules, SQLite storage, real-time SSE, and an admin UI. Deployment is one command. The architectural patterns from ARCHITECTURE.md (sessions vs JWT, query-level faction scoping, calculated fields at read time) apply equally to PocketBase — they are not Express-specific insights.

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend / BaaS | PocketBase 0.22.x | Single binary, built-in auth + RBAC + SQLite + real-time |
| Frontend | SvelteKit 2 + Svelte 5 | Less boilerplate than React for data-heavy admin UIs |
| UI components | shadcn-svelte | Dark theme, accessible primitives, matches gold aesthetic |
| Charts | Chart.js 4 | Simple bar/line/donut via svelte-chartjs wrapper |
| Deployment | Railway (no-Docker path) or Docker Compose (VPS path) | Railway is the starting recommendation for non-developer host |
| Scheduler | Cron container in Compose, or lightweight external cron hitting PocketBase API | PocketBase has no built-in scheduler — this must be designed explicitly |

---

## Table Stakes Features

These must all ship in v1. Without any one of them, staff falls back to manual Discord tracking.

1. Multi-user auth — staff login (Head Admin / Staff tiers) + faction member login (scoped portal)
2. Faction CRUD — name, type (PvP/PvE), color, members with roles
3. Node CRUD — name, number, type, tier, owner, base upkeep, road connection, notes
4. Upkeep calculation — `ceil(base × overextensionMul(nodeCount) × (1 + warMul(warCount)))` — single shared server function, consistent everywhere
5. SP submission logging — item picker from catalogue, qty, auto-SP, real-time 40% cap preview
6. 40% cap enforcement — Raw Renewable and Currency each capped per cycle; warn before commit
7. Weekly deadline processing — server-side scheduled job that calculates payment status, applies instability deltas, cycles submissions to history, sets next deadline
8. Instability roll — d100 vs threshold per node after deadline; event drawn from node-type-specific pool
9. Instability event resolution — action buttons per pending event (apply SP debt, apply instability, mark RP handled, dismiss)
10. War declaration and tracking — with upkeep modifier auto-applied to all PvP faction nodes
11. Ownership transfer logging — method enum (peaceful/violent/contested), per-node timeline
12. Dashboard with active alerts — rolls due, overdue nodes, high instability, damaged nodes, pending events
13. Filterable server log — by type, faction, node, text search
14. Faction-scoped player portal — members see only their own faction's nodes + global war/alliance board
15. Data export — JSON backup with timestamp

---

## Phase Build Order

Dependencies are strict. Each layer unlocks the next.

| Layer | What Gets Built | Why This Order |
|-------|----------------|----------------|
| **1 — Foundation** | PocketBase schema (collections + rules), SvelteKit scaffold, auth system, staff login, role middleware | Nothing else can exist without data model and auth |
| **2 — Core Data** | Faction CRUD, Node CRUD, War/Alliance CRUD, basic dashboard | Gets data into the system; enables manual tracking |
| **3 — Upkeep Engine** | SP submission logging, cap enforcement (real-time preview), effective upkeep calculation, SP catalogue | The math layer — must be correct before deadline processing can work |
| **4 — Automation** | Server-side deadline scheduler, instability delta application, instability roll + event selection, bulk process action | Core value unlock — the reason v2 exists |
| **5 — War & Sieges** | Battle outcome logging, ownership transfer, siege tracking, war economy auto-calculation | Second major system; depends on node + war CRUD being stable |
| **6 — Visibility** | Player portal (faction-scoped), metrics/charts, node history refinements, upgrade tracking | Read surfaces; all writes must be stable first |

---

## Critical Pitfalls

Design against these from day one — they cannot be retrofitted.

**C1 — Faction scoping enforced at query level only.**
The player portal's faction-privacy guarantee must be enforced by PocketBase collection API rules (`@request.auth.faction = faction.id`), not by hiding UI elements. A Staff member with browser DevTools can bypass client-side filters. This must be tested in Phase 1 before any member accounts are created.

**C2 — Deadline processor must be idempotent.**
The weekly processor runs on a schedule. If it crashes halfway through, re-running it must not double-apply instability to nodes already processed. Each processed deadline needs a unique key (node ID + deadline timestamp) stored in a processed-deadlines list — identical to v1's `processedDeadlines` array but stored server-side. Design the state machine before writing any code.

**C3 — Scheduler failure must be visible.**
The deadline processor is the entire value proposition. If the cron job silently dies one week, game data is wrong and no one notices until the next cycle. A `job_run_log` table and a "Last Run: X ago" widget on the dashboard are non-negotiable. Alert if last run was more than 8 days ago.

**C4 — Business logic from v1.2.1 JS, not handbook prose.**
The handbook has ambiguities that v1.2.1 already resolved. Re-deriving `calcUp()`, `checkCaps()`, `procDeadlines()`, and `INSTAB_CHANCE[]` from the handbook prose will introduce silent calculation errors. Port the formulas from the v1.2.1 source code. Write unit tests against known outputs (e.g., 2 nodes owned + 1 active war = ×1.1 × 1.15 = ×1.265, ceiling applied).

**C5 — Head Admin privilege enforced at the route level, not UI.**
The Staff UI hides delete/wipe buttons. The PocketBase collection rules must independently enforce that delete operations require `@request.auth.role = "head_admin"`. Route-level and UI-level both must enforce it — neither alone is sufficient.

**C6 — Deadline processor runs server-side, not in browser.**
In v1, `procDeadlines()` runs on every page load. In v2 with multiple staff clients, running it client-side would cause race conditions (two clients both process the same deadline). The scheduler must be a single server-side job. PocketBase has no built-in cron — design the scheduler in Phase 1, implement in Phase 4.

---

## Key Open Questions for Roadmap

1. **Scheduler implementation**: Cron container in Docker Compose, or external lightweight cron (Railway cron jobs, system cron on VPS) calling a PocketBase API webhook? Must be decided before Phase 4 scope is written.
2. **Svelte 5 runes + shadcn-svelte compatibility**: Verify before scaffold. If shadcn-svelte targets Svelte 4, use Svelte 4 syntax for stability.
3. **Railway vs Docker Compose**: Determine which hosting path to document first. Railway is simpler for a non-developer; Docker Compose is more portable. Both can be documented, but one should be the primary.
4. **Upkeep formula edge cases**: What happens when a PvE faction (no war modifier) acquires a node? War modifier applies only to PvP factions — verify this is correctly scoped in both the handbook and v1 code before porting.
