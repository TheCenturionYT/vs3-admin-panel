---
phase: 03-upkeep-engine
plan: "08"
subsystem: upkeep
tags: [sveltekit, pocketbase, migrations, scheduler, svelte5, typescript]

requires:
  - phase: 03-upkeep-engine
    provides: scheduler, submissions, migration schema, dashboard, metrics page

provides:
  - CR-03: importData fail-fast loop with collection name in error response
  - CR-04: dashboard cap preview accumulates existing cycle SP per node/category
  - CR-05: Phase 3 migration rollback does not drop job_run_log
  - WR-07: snapshot stored as native JS array; metrics reads with Array.isArray guard
  - IN-02: Bank Panic effect text corrected to dual-unit label
  - IN-03: exportData intentionality comment added

affects: [03-upkeep-engine, Phase 4 portal if it reads submission_history]

tech-stack:
  added: []
  patterns:
    - "Fail-fast per-collection error reporting in importData with named collection in error message"
    - "PocketBase JSON columns: store native objects (no JSON.stringify), read with Array.isArray guard"
    - "Dashboard quick-log cap preview accumulates existing cycle totals from load data"

key-files:
  created: []
  modified:
    - pb_migrations/1746230400_phase3_schema.js
    - pb_hooks/scheduler.js
    - vs3-panel/src/lib/instab_events.ts
    - vs3-panel/src/routes/(staff)/server-settings/+page.server.ts
    - vs3-panel/src/routes/(staff)/dashboard/+page.server.ts
    - vs3-panel/src/routes/(staff)/dashboard/+page.svelte
    - vs3-panel/src/routes/(staff)/metrics/+page.svelte

key-decisions:
  - "JSON.parse fallback retained in metrics for legacy string snapshot data pre-WR-07-fix"
  - "importData delete loop changed from Promise.all to sequential for fail-fast with clean error state"
  - "openQuickLog extended with optional rrPaid/cPaid params (default 0) for backward-compat"

requirements-completed: [UPKEEP-04, UPKEEP-07, METRICS-01]

duration: 12min
completed: 2026-05-02
---

# Phase 3 Plan 08: Data-Correctness Gap Closure Summary

**Closed six code-review gaps across seven files: migration rollback safety, PocketBase JSON double-encoding, dashboard cap preview accuracy, importData fail-fast, Bank Panic label, and exportData role comment.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02T00:12:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- CR-05 closed: Phase 3 migration rollback no longer lists `job_run_log` (owned by Phase 2); safe to run rollback without destroying scheduler log data
- WR-07 closed: scheduler stores snapshot as native JS array (no `JSON.stringify`), metrics page guards with `Array.isArray` and falls back to `JSON.parse` for pre-fix legacy string data
- CR-04 closed: dashboard `allSubmissions` query now fetches `category`; `paidCategoryByNode` map tracks per-node RR/Currency totals; `overdueNodes` carries `rrPaid`/`cPaid`; `openQuickLog` accepts and stores them; `qlCapPreview` accumulates existing cycle SP so the preview matches server-side `checkCaps`
- CR-03 closed: importData loop is now fail-fast per-collection — reports exact collection name on delete or insert failure so staff know what partial state exists
- IN-02 closed: Bank Panic effect clarified from `pay 40 SMD` to `pay 4 SP (= 40 SMD)` (dual-unit)
- IN-03 documented: exportData has explicit comment confirming all-staff access is intentional

## Task Commits

1. **Task 1: Migration rollback, scheduler snapshot, Bank Panic text** - `3b6fc99` (fix)
2. **Task 2: importData fail-fast, dashboard cap preview, metrics guard, exportData comment** - `a27e1e0` (fix)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `pb_migrations/1746230400_phase3_schema.js` — Removed `job_run_log` from rollback collection list; updated comments
- `pb_hooks/scheduler.js` — Replaced `JSON.stringify(snapshot)` with bare `snapshot` + explanatory comment
- `vs3-panel/src/lib/instab_events.ts` — Bank Panic effect: `pay 40 SMD` → `pay 4 SP (= 40 SMD)`
- `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts` — importData fail-fast loop; exportData intentionality comment
- `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts` — Added `category` to allSubmissions fields; `paidCategoryByNode` map; `rrPaid`/`cPaid` in overdueNodes result
- `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` — `qlExistingRR`/`qlExistingC` state vars; `openQuickLog` signature extended; `qlCapPreview` accumulates existing; call site updated
- `vs3-panel/src/routes/(staff)/metrics/+page.svelte` — `Array.isArray(h.snapshot)` guard replaces bare `JSON.parse`

## Decisions Made

- Kept a `JSON.parse` fallback in the `Array.isArray` guard for metrics: submission_history records written before WR-07 may have double-encoded string snapshots. The fallback is safe inside the existing `try/catch`.
- Changed importData delete from `Promise.all` to sequential `for` loop: sequential gives a deterministic abort point after the first failure, making partial-state clearer to staff.
- `openQuickLog` extended with `rrPaid = 0, cPaid = 0` optional params (not breaking, defaults to prior behavior if called without them from other sites).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript check (`npx tsc --noEmit`) reported only a pre-existing `Cannot find type definition file for 'node'` environment issue unrelated to any modified files — 0 new errors introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six gaps (CR-03, CR-04, CR-05, WR-07, IN-02, IN-03) are closed
- dashboard/+page.svelte Svelte 5 runes pattern maintained throughout
- Ready for Phase 3 completion or Phase 4 player portal planning

---
*Phase: 03-upkeep-engine*
*Completed: 2026-05-02*
