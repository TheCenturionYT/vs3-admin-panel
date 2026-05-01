---
plan: 01-02
phase: 1
subsystem: pb_hooks / schema
status: complete
completed: 2026-05-01
tags: [pocketbase, schema, hooks, scheduler, auth, documentation]
dependency_graph:
  requires: []
  provides: [pb_hooks/scheduler.js, pb_hooks/auth_hooks.js, docs/SCHEMA.md]
  affects: [01-03, 01-04, 01-05, 01-06]
tech_stack:
  added: []
  patterns: [PocketBase JSVM cronAdd, PocketBase onRecordAuthRequest hook]
key_files:
  created:
    - pb_hooks/scheduler.js
    - pb_hooks/auth_hooks.js
    - docs/SCHEMA.md
  modified: []
decisions:
  - cronAdd("upkeep_deadline_processor") registered as weekly Sunday 00:00 UTC job — job ID stable across restarts
  - job_run_log and server_log create/update rules set to null (locked) to prevent unauthenticated writes from SvelteKit
  - server_log.nodeId is text in Phase 1 (relation added in Phase 2 when nodes collection exists)
metrics:
  duration: ~5 minutes
  completed: 2026-05-01
---

# Phase 1 Plan 02: PocketBase Schema Documentation and pb_hooks Scheduler Placeholder — Summary

**One-liner:** PocketBase JSVM hook files (cronAdd scheduler placeholder + lastLogin auth hook) and authoritative five-collection schema reference for Phase 1 Foundation.

## Files Created

- `pb_hooks/scheduler.js` — cronAdd() placeholder for Phase 3 deadline processor; documents idempotency, job_run_log health tracking, and 8-step processing sequence
- `pb_hooks/auth_hooks.js` — lastLogin tracking hook via onRecordAuthRequest (AUTH-06)
- `docs/SCHEMA.md` — authoritative Phase 1 collection reference covering all five collections with field definitions, API rules, null-vs-empty-string rule distinction, and Schema Setup Checklist

## Verification Results

- cronAdd() registered in scheduler.js: yes (grep count: 2 — once in comment, once in call)
- Cron expression "0 0 * * 0" present: yes
- "PHASE 3 IMPLEMENTATION GOES HERE" present: yes
- idempotency/processed key documented: yes (3 matches)
- job_run_log referenced in scheduler.js: yes
- onRecordAuthRequest in auth_hooks.js: yes
- lastLogin field updated in auth_hooks.js: yes (4 matches)
- e.next() called correctly in both branches: yes (2 calls)
- All 5 collections documented in SCHEMA.md: yes (staff, members, factions, job_run_log, server_log)
- API rules documented with null-vs-empty-string distinction: yes
- Schema Setup Checklist present: yes

## Commits

- `c89a172` — feat(01-02): add pb_hooks/scheduler.js — cronAdd placeholder for Phase 3 deadline processor
- `e4c2468` — feat(01-02): add auth_hooks.js lastLogin tracker and SCHEMA.md collection reference

## Deviations from Plan

None — plan executed exactly as written.

## AUTH-06 Implementation Note

`pb_hooks/auth_hooks.js` updates `lastLogin` on the staff collection via `onRecordAuthRequest` hook. The hook calls `e.next()` in both the early-return branch (non-staff collections) and after the try/catch (staff collections) to ensure the auth request always completes successfully. The lastLogin update failure is non-fatal — it logs the error but does not block authentication.

## Known Stubs

None — this plan creates documentation and JSVM hooks only. No UI components or data flows are wired.

## Threat Flags

None — no new network endpoints or auth paths introduced. The auth_hooks.js hook operates within PocketBase's existing auth flow.

## Self-Check: PASSED

- pb_hooks/scheduler.js: FOUND
- pb_hooks/auth_hooks.js: FOUND
- docs/SCHEMA.md: FOUND
- Commit c89a172: FOUND
- Commit e4c2468: FOUND
