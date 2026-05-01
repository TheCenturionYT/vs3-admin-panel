# STATE — VS3 Admin Panel v2.0.0

**Last updated:** 2026-05-01
**Session type:** Phase 2 planned / Ready to execute

---

## Project Reference

**Core value:** Upkeep cycle management must be fast, accurate, and automated — staff should be able to process an entire weekly deadline in minutes, not hours of manual Discord cross-referencing and hand-rolled dice.

**Stack:** PocketBase 0.22.x (backend/BaaS) + SvelteKit 2 / Svelte 5 (frontend) + shadcn-svelte (UI) + Chart.js 4 (charts). Deployment via Railway (primary) or Docker Compose (VPS path).

**Current focus:** Phase 2 — Core Data & Wars

---

## Current Position

| Field | Value |
|-------|-------|
| Phase | 2 — Core Data & Wars |
| Plan | 10 plans in 4 waves — ready to execute |
| Status | Ready to execute |
| Blocking issue | None |

**Progress:**
```
[Phase 1: Foundation        ] [x] Complete — 6/6 plans complete
[Phase 2: Core Data & Wars  ] [~] Planned — 10 plans in 4 waves
[Phase 3: Upkeep Engine     ] [ ] Not started
[Phase 4: Player Portal     ] [ ] Not started
```

Overall: 1 of 4 phases complete, Phase 2 planned and ready to execute

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements mapped | 56/56 |
| Phases defined | 4 |
| Plans created | 16 (Phase 1: 6, Phase 2: 10) |
| Plans complete | 6 (01-01 through 01-06) — Phase 1 done |

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

1. **Scheduler implementation path** — Cron container in Docker Compose vs. external cron (Railway cron job / system cron on VPS) hitting PocketBase API webhook. Decide before Phase 3 scope is written.
2. **PvE faction + war modifier edge case** — war modifier applies only to PvP factions. Verify scope in both handbook and v1.2.1 before porting formula.
3. **T4 upgrade cost** — Handbook §IX says 500 SP; v1 code does not track this. Clarify with user before Phase 3 upgrade tracking.

### Resolved Questions

- ~~Svelte 5 runes + shadcn-svelte compatibility~~ — shadcn-svelte 1.2.7 is Svelte 5 native (Tailwind v4, `@theme inline`). Resolved in 01-01.
- ~~Railway vs Docker Compose primary path~~ — Railway is primary, Docker Compose is secondary. Resolved in 01-06.
- ~~Head Admin at route AND rule level~~ — verified: collection rules + SvelteKit route guards both enforced. Verified in Phase 1.

### Todos

- [ ] Read VS3_Panel_1_2_1.html for `calcUp()`, `checkCaps()`, `procDeadlines()`, `INSTAB_EVENTS` table before Phase 3 planning
- [ ] Resolve open question 1 (scheduler path) before Phase 3 scope is written

### Blockers

None currently.

---

## Session Continuity

**To resume:** Run `/gsd-plan-phase 2` to plan Phase 2 — Core Data & Wars, then `/gsd-execute-phase 2`.
**Files:** All planning artifacts live in `C:\Users\Kramer\Desktop\VS3\.planning\`.
**Source references:** `VS3_Panel_1_2_1.html` (v1 logic), `VS3_Rules_Node_Handbook_v1.3.0.html` (game rules).
**Last completed:** Phase 1 — Foundation (6/6 plans, 2026-05-01). Gap fixes: root redirect + .env.example.
