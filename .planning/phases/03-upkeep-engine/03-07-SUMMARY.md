---
phase: 03-upkeep-engine
plan: "07"
subsystem: security
tags: [pocketbase, sveltekit, authorization, data-integrity, scheduler]

requires:
  - phase: 03-upkeep-engine
    provides: scheduler.js deadline processor, nodes/[id] form actions

provides:
  - Role-gated POST /api/vs3/process-deadlines (staff/head_admin only)
  - Per-node server_log entries written after transaction via nodeOutcomes accumulator
  - cfg refetched inside transaction via txApp to eliminate cross-DAO fragility
  - removeSubmission verifies submission.node === params.id before delete
  - rollInstability guards on roll_due === true before creating roll record
  - instability_reduction returns 400 when instability is already 0
  - resolveEvent verifies roll.node === params.id before resolving
  - Cross-midnight timezone documentation comment on computeCurrentDeadline

affects: [03-upkeep-engine, 04-player-portal]

tech-stack:
  added: []
  patterns:
    - "Accumulate-then-write: collect side-effect data inside txn, execute writes after commit"
    - "Ownership verification: fetch record and check node field matches params.id before mutate"
    - "Guard-before-action: validate state preconditions (roll_due, instability > 0) before destructive writes"

key-files:
  created: []
  modified:
    - pb_hooks/scheduler.js
    - vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts

key-decisions:
  - "writeServerLog cannot be called inside $app.runInTransaction() — nodeOutcomes array pattern used to defer writes until after commit"
  - "cfg refetch inside transaction uses txApp.findRecordById to ensure the idempotency stamp is atomic with node updates and not subject to stale DAO state"
  - "instability_reduction guard placed at branch entry (before item_name/category/sp_value assignment) so the 400 fires before any submission is created"
  - "resolveEvent node ownership check placed between getOne and update to fail-fast before any state mutation"

requirements-completed: [UPKEEP-07, UPKEEP-08, UPKEEP-10]

duration: 18min
completed: 2026-05-02
---

# Phase 3 Plan 07: Security and Data-Integrity Gaps Summary

**Role-gated process-deadlines endpoint, per-node server_log via nodeOutcomes accumulator, cfg txn refetch, and four ownership/guard checks on nodes/[id] form actions**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02T00:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Closed CR-01: members-collection users are now rejected at the process-deadlines endpoint with a 403 before processDeadlines() is ever called
- Closed CR-02: per-node server_log entries written via nodeOutcomes accumulator pattern (safe outside transaction); cfg refetched inside txn via txApp.findRecordById eliminating cross-DAO fragility
- Closed WR-01/02/03/05: four ownership and state-precondition guards added to nodes/[id] form actions preventing cross-node manipulation and invalid state transitions
- Added WR-04 documentation comment explaining cross-midnight UTC edge case in computeCurrentDeadline

## Task Commits

Each task was committed atomically:

1. **Task 1: scheduler.js — role check, per-node server_log, cfg refetch, cross-midnight comment** - `8c4d161` (security)
2. **Task 2: nodes/[id]/+page.server.ts — WR-01/02/03/05 guards** - `8c4d161` (security, same commit per plan instructions)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `pb_hooks/scheduler.js` — Role check on routerAdd, nodeOutcomes accumulator, cfgInTx refetch, CROSS-MIDNIGHT comment
- `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` — removeSubmission ownership check, rollInstability roll_due guard, instability_reduction instability>0 guard, resolveEvent node ownership check

## Decisions Made

- writeServerLog uses `$app.dao()` and cannot be called inside `$app.runInTransaction()`. The nodeOutcomes array pattern defers all per-node log writes to after the transaction commits, preserving atomicity while still producing per-node audit records.
- cfg is refetched inside the transaction using `txApp.findRecordById("deadline_config", cfg.getId())` so the idempotency stamp write is fully within the txApp DAO context and consistent with the surrounding node saves.
- The `instability_reduction` guard (`cur <= 0`) is placed at the very start of that branch, before `item_name`/`category`/`sp_value` are set, ensuring the 400 fires before any submission record is created.
- The `resolveEvent` node ownership check is placed between `getOne(parsed.data.roll_id)` and the subsequent `update(...)` call to fail-fast before any state mutation occurs.

## Deviations from Plan

None - plan executed exactly as written. IN-03 (exportData intentionality comment) was explicitly scoped to plan 03-08 Task 2 and was skipped as directed.

## Issues Encountered

None. The only TypeScript compiler output was the pre-existing `TS2688: Cannot find type definition file for 'node'` error (missing `@types/node` configuration in compilerOptions) which is unrelated to this plan's changes. No errors were reported for the modified file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All security gaps from the Phase 3 code review (CR-01, CR-02, WR-01, WR-02, WR-03, WR-05, WR-04) are now closed
- pb_hooks/scheduler.js and nodes/[id]/+page.server.ts are ready for plan 03-08 (remaining gaps: WR-06, WR-07, IN-01, IN-02, IN-03)
- No blockers

---
*Phase: 03-upkeep-engine*
*Completed: 2026-05-02*
