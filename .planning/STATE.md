# STATE — VS3 Admin Panel v2.0.0

**Last updated:** 2026-05-02
**Session type:** Phase 3 executing — gap closure plans complete

---

## Project Reference

**Core value:** Upkeep cycle management must be fast, accurate, and automated — staff should be able to process an entire weekly deadline in minutes, not hours of manual Discord cross-referencing and hand-rolled dice.

**Stack:** PocketBase 0.22.x (backend/BaaS) + SvelteKit 2 / Svelte 5 (frontend) + shadcn-svelte (UI) + Chart.js 4 (charts). Deployment via Railway (primary) or Docker Compose (VPS path).

**Current focus:** Phase 3 — Upkeep Engine & Automation

---

## Current Position

| Field | Value |
|-------|-------|
| Phase | 3 — Upkeep Engine |
| Plan | 6 plans in 4 waves |
| Status | Ready to execute |
| Blocking issue | None |

**Progress:**
```
[Phase 1: Foundation        ] [x] Complete — 6/6 plans complete
[Phase 2: Core Data & Wars  ] [x] Complete — 10/10 plans complete
[Phase 3: Upkeep Engine     ] [ ] Planned — 6/6 plans ready, 0 executed
[Phase 4: Player Portal     ] [ ] Not started
```

Overall: 2 of 4 phases complete

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements mapped | 56/56 |
| Phases defined | 4 |
| Plans created | 22 (Phase 1: 6, Phase 2: 10, Phase 3: 6) |
| Plans complete | 16 (01-01 through 01-06, 02-01 through 02-10) — Phases 1 & 2 done |

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
- **Railway is the primary deployment path** — Docker Compose is secondary. PocketBase Volume at `/pb_data` must be attached before first deploy to prevent data loss on restart. (01-06)

### Open Questions (carry forward)

None.

### Resolved Questions

- ~~Svelte 5 runes + shadcn-svelte compatibility~~ — shadcn-svelte 1.2.7 is Svelte 5 native (Tailwind v4, `@theme inline`). Resolved in 01-01.
- ~~Railway vs Docker Compose primary path~~ — Railway is primary, Docker Compose is secondary. Resolved in 01-06.
- ~~Head Admin at route AND rule level~~ — verified: collection rules + SvelteKit route guards both enforced. Verified in Phase 1.
- ~~Scheduler implementation path~~ — `cronAdd()` in pb_hooks/scheduler.js with `"* * * * *"` tick; reads deadline_config collection to determine if deadline has passed. Resolved in Phase 3 discuss.
- ~~PvE war modifier edge case~~ — `warMul=0` for PvE factions always. Implemented in upkeep.ts.
- ~~T4 upgrade cost~~ — 500 SP (Handbook §IX). T1→T2=60, T2→T3=140 from v1. Resolved 2026-05-01.

### Todos

- [ ] Run `/gsd-execute-phase 3` — 6 plans ready at `.planning/phases/03-upkeep-engine/`

### Blockers

None currently.

---

## Session Continuity

**To resume:** Run `/gsd-execute-phase 3` — 6 plans ready at `.planning/phases/03-upkeep-engine/`.
**Files:** All planning artifacts live in `C:\Users\Kramer\Desktop\VS3\.planning\`.
**Source references:** `VS3_Panel_1_2_1.html` (v1 logic — calcUp, checkCaps, procDeadlines, INSTAB_EVENTS), `VS3_Rules_Node_Handbook_v1.3.0.html` (game rules).
**Last completed:** Phase 3 Plan 08 — Data-correctness gap closure (CR-03/04/05, WR-07, IN-02/03). 2026-05-02.
