# STATE — VS3 Admin Panel v2.0.0

**Last updated:** 2026-05-01
**Session type:** Phase 1 execution

---

## Project Reference

**Core value:** Upkeep cycle management must be fast, accurate, and automated — staff should be able to process an entire weekly deadline in minutes, not hours of manual Discord cross-referencing and hand-rolled dice.

**Stack:** PocketBase 0.22.x (backend/BaaS) + SvelteKit 2 / Svelte 5 (frontend) + shadcn-svelte (UI) + Chart.js 4 (charts). Deployment via Railway (primary) or Docker Compose (VPS path).

**Current focus:** Phase 1 — Foundation

---

## Current Position

| Field | Value |
|-------|-------|
| Phase | 1 — Foundation |
| Plan | 01-02 complete (2 of 6) |
| Status | Executing |
| Blocking issue | None |

**Progress:**
```
[Phase 1: Foundation        ] [.] Executing — 2/6 plans complete
[Phase 2: Core Data & Wars  ] [ ] Not started
[Phase 3: Upkeep Engine     ] [ ] Not started
[Phase 4: Player Portal     ] [ ] Not started
```

Overall: 0 of 4 phases complete (Phase 1 in progress — 01-01 and 01-02 done)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements mapped | 56/56 |
| Phases defined | 4 |
| Plans created | 6 (Phase 1) |
| Plans complete | 2 (01-01, 01-02) |

---

## Accumulated Context

### Key Decisions Locked

- **PocketBase + SvelteKit** — confirmed by research. Do not revisit.
- **Faction scoping at query level** — PocketBase collection rules enforce it, not client-side filters. Must be tested in Phase 1 before any member accounts are created (Pitfall C1).
- **Deadline processor is server-side only** — not a browser function. Client-side would cause race conditions with multiple staff members. Design the scheduler in Phase 1, implement in Phase 3 (Pitfall C6).
- **Deadline processor must be idempotent** — unique key per processed node+deadline timestamp prevents double-apply on crash recovery (Pitfall C2).
- **Business logic ported from v1.2.1 JS, not handbook prose** — handbook has ambiguities already resolved in v1.2.1. Port `calcUp()`, `checkCaps()`, `procDeadlines()`, `INSTAB_CHANCE[]` directly (Pitfall C4).
- **Head Admin enforcement at route AND rule level** — both PocketBase collection rules and UI must enforce it; neither alone is sufficient (Pitfall C5).
- **Scheduler failure must be visible** — `job_run_log` table + "Last Run: X ago" dashboard widget + 8-day alert are non-negotiable (Pitfall C3).

### Open Questions (pre-Phase 1)

1. **Scheduler implementation path** — Cron container in Docker Compose vs. external cron (Railway cron job / system cron on VPS) hitting PocketBase API webhook. Decide before Phase 3 scope is written.
2. **Svelte 5 runes + shadcn-svelte compatibility** — verify before scaffold. If shadcn-svelte targets Svelte 4, use Svelte 4 syntax.
3. **Railway vs Docker Compose primary path** — Railway recommended for non-developer; Docker Compose for portability. One must be the primary for the deployment guide.
4. **PvE faction + war modifier edge case** — war modifier applies only to PvP factions. Verify scope in both handbook and v1.2.1 before porting formula.

### Todos

- [ ] Resolve open questions 1–4 before Phase 1 planning begins
- [ ] Read VS3_Panel_1_2_1.html for `calcUp()`, `checkCaps()`, `procDeadlines()`, `INSTAB_EVENTS` table before Phase 3 planning

### Blockers

None currently.

---

## Session Continuity

**To resume:** Run `/gsd-execute-phase 1` to continue Phase 1 execution (next: 01-03).
**Files:** All planning artifacts live in `C:\Users\Kramer\Desktop\VS3\.planning\`.
**Source references:** `VS3_Panel_1_2_1.html` (v1 logic), `VS3_Rules_Node_Handbook_v1.3.0.html` (game rules).
**Last completed:** 01-02 — pb_hooks scheduler placeholder, auth hooks, SCHEMA.md (2026-05-01)
