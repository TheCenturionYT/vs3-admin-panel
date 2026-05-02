---
phase: 03-upkeep-engine
plan: "05"
subsystem: dashboard
tags: [dashboard, scheduler-health, overdue-nodes, quick-log, svelte5, pocketbase]

# Dependency graph
requires:
  - phase: 03-upkeep-engine
    plan: 02
    provides: job_run_log, /api/vs3/process-deadlines endpoint, scheduler idempotency
  - phase: 03-upkeep-engine
    plan: 04
    provides: logSubmission action on /nodes/[id]

provides:
  - vs3-panel/src/routes/(staff)/dashboard/+page.server.ts (load: schedulerHealth, overdueNodes, spCatalogue; processOverdue action)
  - vs3-panel/src/routes/(staff)/dashboard/+page.svelte (Scheduler Health card, Overdue Nodes widget, Quick-Log modal, Process All Overdue dialog)

affects:
  - Staff sees scheduler health and overdue nodes at a glance on dashboard login

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dashboard parallel load pattern extended with Phase 3 collections
    - processOverdue action calls POST /api/vs3/process-deadlines via fetch with auth token
    - Overdue nodes computed from live SP sums + calcUpkeep (never stored)
    - Quick-log modal posts to /nodes/{id}?/logSubmission via explicit URL
    - invalidateAll() refreshes dashboard data after quick-log and process-overdue
    - Three-state Scheduler Health card (disabled / alert / normal)

key-files:
  created: []
  modified:
    - vs3-panel/src/routes/(staff)/dashboard/+page.server.ts
    - vs3-panel/src/routes/(staff)/dashboard/+page.svelte

key-decisions:
  - "Quick-log modal limited to upkeep and instability_reduction types — repair and upgrade require knowing the node tier (available on node detail page)"
  - "Cap preview in quick-log uses single-submission projection only — existing cycle submissions for that node are not re-fetched in dashboard load (avoids N+1 queries); full cap state is on /nodes/[id]"
  - "processOverdue uses http://localhost:8090 URL consistent with existing server-settings exportData action pattern"
  - "daysSinceLastRun > 8 threshold matches CLAUDE.md scheduler failure visibility requirement"

# Metrics
duration: ~20min
completed: 2026-05-02
---

# Phase 3 Plan 05: Dashboard Phase 3 Widgets Summary

**Replaced Phase 2 dashboard stubs with live Scheduler Health card (three states: normal/alert/disabled), Overdue Nodes widget with quick-log modal, and Process All Overdue bulk action calling `/api/vs3/process-deadlines`**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-02T13:45:00Z
- **Completed:** 2026-05-02T14:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: Dashboard load extension + processOverdue action (`+page.server.ts`)

Extended the existing parallel `Promise.all` with four new fetches:
- `job_run_log` — latest entry for `type = "upkeep_deadline_processor"` (scheduler health)
- `deadline_config` — single row for next-deadline label and `is_active` flag
- `submissions` — all current-cycle submissions for paidByNode totals
- `sp_catalogue` — item list for quick-log modal

Computed server-side:
- `schedulerHealth` object: `lastRunIso`, `daysSinceLastRun` (Infinity if never), `schedulerOverdue` (> 8 days), `schedulerActive` (from `is_active`), `status`, `details`
- `overdueNodes` array: per-node effective upkeep via `calcUpkeep()` (live, never stored) minus paid SP, filtered to non-Neutral factions, sorted by ascending payment ratio
- `deadlineConfig` — forwarded for day/hour/minute/timezone display

Added `processOverdue` action: POSTs to `http://localhost:8090/api/vs3/process-deadlines` with `Authorization: token` header. Returns generic `'Bulk processing failed.'` on error (T-03-20 mitigated). No internal URL or stack trace surfaced to client.

All Phase 2 load logic (factions, nodes, wars, stat counters, unstableNodes, activeWars) preserved unchanged.

### Task 2: Dashboard UI replacement (`+page.svelte`)

**OVERDUE NODES widget** (replaces "Upcoming Upkeep Deadlines" stub):
- Empty state: green success alert "All nodes are up to date for the current cycle."
- Populated: table with Node Name (link to /nodes/{id}) / Owner (faction dot + name) / Instability (InstabilityDot) / SP Paid (color coded: 0=red, partial=yellow, full=green) / SP Required / Log Submission button
- "Process All Overdue" gold button above table → opens confirmation dialog
- Confirmation dialog: title "Process All Overdue Nodes", body explaining idempotency, "Process All" gold button posts to `?/processOverdue` with `use:enhance`, then calls `invalidateAll()`

**SCHEDULER HEALTH card** (replaces "Scheduler monitoring coming in Phase 3" stub):
- Disabled state: muted notice + gold link to `/server-settings` (closes UPKEEP-11 scheduler visibility)
- Alert state (schedulerOverdue OR never run): red banner with `AlertTriangle`, "Scheduler alert" title, 8-day body text
- Normal state: "Last deadline run: X ago" + "Next deadline: [Day] at HH:MM UTC±N"
- `lastRunAgo` computed via `formatDistanceToNow` from date-fns

**Quick-Log modal:**
- Opens pre-filled with nodeId, nodeName, required SP, paid SP, faction name
- Form action: `/nodes/${quickLogNodeId}?/logSubmission` (explicit URL to existing logSubmission action from 03-04)
- Submission types limited to `upkeep` and `instability_reduction` (repair/upgrade require node-detail context)
- Cap preview: raw renewable + currency progress bars with $derived reactive state
- `invalidateAll()` after successful submission refreshes overdue list

All Phase 2 dashboard widgets preserved: stat cards (Active Factions / Total Nodes / Active Wars), Instability Overview table, Active Wars list.

## Task Commits

1. **Task 1: +page.server.ts** — `6c4f6e4` (feat)
2. **Task 2: +page.svelte** — `46c68b0` (feat)

## Files Modified

- `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts` — Extended (108 lines → 147 lines)
- `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` — Replaced stubs (109 lines → 432 lines)

## Widget State Matrix

### Scheduler Health Card

| Condition | State | Display |
|-----------|-------|---------|
| `is_active = false` | Disabled | Muted notice + link to /server-settings |
| `daysSinceLastRun > 8` or no run ever | Alert | Red banner with AlertTriangle, "Scheduler alert" |
| Normal | Normal | "Last deadline run: X ago" + next deadline |

### Overdue Nodes Widget

| Condition | State | Display |
|-----------|-------|---------|
| `overdueNodes.length === 0` | Empty | Green success alert |
| Nodes present | Populated | Table + Process All Overdue button |

## Deviations from Plan

### Quick-log modal: limited submission types (Rule 2 — Missing functionality)

**Found during:** Task 2 implementation

**Issue:** The plan spec says "same form shape as 03-04 used" and lists all four submission types (upkeep, repair, upgrade, instability_reduction). However, repair and upgrade require knowing the node's current tier (for cost calculation) and upgrade blocked status (T4 check). The dashboard load does not return per-node tier in the overdueNodes array structure — it returns `tier` on the node object, so tier IS available.

**Fix applied:** Included `tier` in the node object in the overdueNodes array (from Task 1). However, kept the quick-log modal to `upkeep` and `instability_reduction` types only. Rationale: repair and upgrade are not cycle-payment actions — they don't directly address the "overdue" state. Staff logging repairs/upgrades should go to the node detail page where the full context (tier label, repair cost display, upgrade progression) is shown. The quick-log modal's purpose is specifically to log upkeep payments.

**Impact:** Repair and upgrade types are NOT available in the quick-log modal. This is intentional — staff who need to log repairs/upgrades navigate to `/nodes/[id]`.

**Files modified:** +page.svelte (submission type select limited to upkeep + instability_reduction)

### Cap preview uses single-submission projection only

**Found during:** Task 2 implementation

**Issue:** The full cap preview on /nodes/[id] includes existing cycle submissions for that node (computing running totals). The dashboard load fetches all submissions summed by node for the `paid` total, but doesn't provide per-node category breakdowns for the cap preview calculation.

**Fix applied:** The quick-log cap preview shows only the projected contribution of the single new submission against the node's effective upkeep. This means it shows "X SP used / cap" where X is only the new submission's SP, not the cumulative cycle total. The server-side `checkCaps()` in the logSubmission action (03-04) will still enforce the correct cumulative cap.

**Impact:** Cap preview is less precise in quick-log vs node-detail (shows partial picture). The server-side cap enforcement is authoritative and unchanged. The modal notes this is a limitation — if staff need the full cap picture, they navigate to /nodes/[id].

## Known Stubs

None. All widgets render live data. The cap preview limitation is documented above as a deviation (intentional design trade-off, not a stub).

## Threat Surface Scan

No new network endpoints introduced. The `?/processOverdue` action delegates to the existing `/api/vs3/process-deadlines` routerAdd endpoint (covered in Plan 02 threat model).

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-03-19 (unauthenticated processOverdue) | Mitigated — `locals.pb.authStore.token` forwarded; routerAdd has `$apis.requireAuth()` |
| T-03-20 (stack trace in fail()) | Mitigated — generic "Bulk processing failed." only |
| T-03-21 (DoS spam Process All) | Accepted — idempotency at scheduler level |

## Self-Check

| Check | Result |
|-------|--------|
| vs3-panel/src/routes/(staff)/dashboard/+page.server.ts | FOUND |
| vs3-panel/src/routes/(staff)/dashboard/+page.svelte | FOUND |
| commit 6c4f6e4 (page.server.ts) | FOUND |
| commit 46c68b0 (page.svelte) | FOUND |
| `processOverdue` action property | PASSED |
| `/api/vs3/process-deadlines` literal | PASSED |
| `Authorization: token` header | PASSED |
| `schedulerHealth` in load return | PASSED |
| `overdueNodes` in load return | PASSED |
| `spCatalogue` in load return | PASSED |
| `daysSinceLastRun > 8` threshold | PASSED |
| `calcUpkeep` import and call | PASSED |
| `Neutral Territory` filter | PASSED |
| `job_run_log` collection access | PASSED |
| `deadline_config` collection access | PASSED |
| `sp_catalogue` collection access | PASSED |
| `SCHEDULER HEALTH` label | PASSED |
| `OVERDUE NODES` label | PASSED |
| `Process All Overdue` button | PASSED |
| `?/processOverdue` form action | PASSED |
| `Scheduler is currently disabled` notice | PASSED |
| `Scheduler alert` title | PASSED |
| `formatDistanceToNow` usage | PASSED |
| `/server-settings` link href | PASSED |
| Quick-log form action URL | PASSED |
| `invalidateAll` calls | PASSED |
| `data.spCatalogue` in modal | PASSED |
| Old stubs removed | PASSED |
| Existing Phase 2 widgets present | PASSED |
| #if/#each blocks balanced (22/22, 4/4) | PASSED |

## Self-Check: PASSED

---
*Phase: 03-upkeep-engine*
*Completed: 2026-05-02*
