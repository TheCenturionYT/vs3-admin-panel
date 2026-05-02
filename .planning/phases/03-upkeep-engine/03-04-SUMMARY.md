---
phase: 03-upkeep-engine
plan: "04"
subsystem: node-submissions
tags: [submissions, cap-enforcement, instability, upkeep, svelte5, pocketbase]
key-files:
  created: []
  modified:
    - vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts
    - vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte
metrics:
  tasks_completed: 2
  tasks_total: 2
  commits: 2
---

# Plan 03-04 Summary — Node Detail: Submissions, Cap Enforcement, Instability Roll, Cycle History

## Commits

| Commit | Description |
|--------|-------------|
| `eb8e61f` | feat(03-04): extend nodes/[id] server with submission and instability actions |
| `c1e2045` | feat(03-04): render tabs, submissions section, instability roll, cycle history on nodes/[id] |

## What Was Built

### Task 1 — `+page.server.ts` server actions

Extended the existing Phase 2 node detail server file. All Phase 2 actions preserved. Added:

**Constants:** `REPAIR_SP` `{1:50, 2:100, 3:200, 4:300}`, `UPGRADE_SP` `{1:60, 2:140, 3:500}`, `INSTAB_REDUCTION_SP = 40`. Server-side `checkCaps()` function that recomputes effective upkeep at write time (never stored) and returns `{ok, rrSP, cSP, rrPct, cPct}`.

**logSubmission action:** Handles four submission types. For `upkeep`: resolves sp_value via sp_catalogue lookup × qty, then runs server-authoritative cap check (recomputes effectiveUpkeep from live faction/war state). Returns 400 with `errors._global` if either Raw Renewable or Currency would exceed 40%. For `instability_reduction`: fixed 40 SP, decrements `node.instability` by 1 (min 0). For `repair`: tier-based fixed cost from REPAIR_SP. For `upgrade`: tier-based cost from UPGRADE_SP, blocks at T4, increments `node.tier` on success.

**removeSubmission action:** Deletes submission by id from `submissions` collection.

**rollInstability action:** Records d100 roll (sent from client) to `instability_rolls`. Clears `roll_due=false` immediately when not triggered.

**resolveEvent action:** Updates instability_roll record to `resolved=true`, applies side effects per `resolved_action` (`apply_instability` increments instability capped at 5, others just clear `roll_due`).

**load extension:** Added `submissions`, `submission_history`, `instability_rolls`, `sp_catalogue` fetches via `Promise.all`. Returns `effectiveUpkeep`, `repairCost`, `upgradeCost`, `currentSubmissions`, `cycleHistory`, `instabilityRolls`, `spCatalogue`.

### Task 2 — `+page.svelte` UI

**Three-tab layout:** Wrapped existing Phase 2 content in `<Tabs.Root>` — Overview / Cycle History / Node Log. Existing Phase 2 content (ownership timeline, upkeep display, edit form, notes) preserved inside Overview tab.

**Current Cycle Submissions section (Overview tab):** Table with Item / Category / Qty / SP / Type / Note / Actions columns. Per-row Remove button triggers confirmation Dialog. "Total SP this cycle: N SP" summary. "Log Submission" button opens modal. Empty state with action button.

**Log Submission modal (Dialog, 560px):** Form posts to `?/logSubmission`. Submission type selector drives field visibility. For upkeep: item Select from sp_catalogue grouped by category + qty input. For repair/upgrade/instability_reduction: fixed cost display only. Cap Preview component: two Progress bars (Raw Renewable %, Currency %) with colour-coded fill (≤30% green, 30-40% yellow, >40% red). Cap exceeded banner blocks submit. Non-upkeep types show "Category caps do not apply to {type} submissions" at 40% opacity.

**Instability Check section (Overview tab):** Conditionally renders when `data.node?.roll_due === true`. Shows level label and event chance. "Roll d100" button performs client-side roll (`Math.floor(Math.random() * 100) + 1`), immediately reveals dice with roll value. Auto-submits hidden form to `?/rollInstability` with all roll fields. If triggered: event card (name, description, effect, metadata chips for sp_cost/instab_add/output_penalty/is_choice/is_rp). Resolution buttons (Apply Instability / Log SP Debt / Mark Output Penalty / Mark RP Handled / Dismiss) each submit `?/resolveEvent` with `roll_id` and `resolved_action`.

**Cycle History tab:** Table from `submission_history`: Deadline (formatted) / Paid SP / Required SP / Payment % / Outcome badge / Instab Δ. Outcome badges colour-coded (paid=green, partial=yellow, underfunded=orange, unpaid=red). Empty state.

**$derived reactive state:** `capPreview` computes running cap totals including the pending submission. `submitDisabled` gates the submit button. `upgradeBlocked` catches T4 upgrade attempts client-side.

## Deviations

None. All must-haves satisfied as specified. All four submission types implemented. Cap check is server-authoritative (client-side disable is informational only per threat model T-03-13). All STRIDE threats mitigated or accepted per plan.

## Self-Check: PASSED

- [x] `logSubmission`, `removeSubmission`, `rollInstability`, `resolveEvent` actions present
- [x] `REPAIR_SP { 1: 50, 2: 100, 3: 200, 4: 300 }` — matches CLAUDE.md §Repair Costs (§VIII values)
- [x] `UPGRADE_SP { 1: 60, 2: 140, 3: 500 }` — matches CLAUDE.md §Upgrade Costs
- [x] `INSTAB_REDUCTION_SP = 40`
- [x] Server-side `checkCaps()` recomputes effectiveUpkeep at write time (never stored)
- [x] Cap only enforced for `upkeep` type; repair/upgrade/instability_reduction bypass
- [x] `roll_due: false` cleared in both `rollInstability` (not triggered) and `resolveEvent`
- [x] `instability` capped at 5 in `resolveEvent apply_instability`
- [x] T4 upgrade blocked server-side
- [x] All existing Phase 2 actions and types preserved
- [x] Tabs (Overview / Cycle History / Node Log) wrapping existing content
- [x] Cap preview bars with colour thresholds
- [x] `data.node?.roll_due` conditional rendering for Instability Check section
- [x] Cycle History tab with outcome badge colours
