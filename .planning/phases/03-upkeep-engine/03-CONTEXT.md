# Phase 3 Context — Upkeep Engine & Automation

**Phase:** 3 — Upkeep Engine & Automation
**Status:** Decisions captured — ready for research and planning
**Date:** 2026-05-01

---

## Decisions Locked

### 1. Scheduler path
`cronAdd()` in `pb_hooks/scheduler.js` is already scaffolded and is the confirmed approach.
- Runs server-side in PocketBase JSVM — never SvelteKit
- Use `"* * * * *"` (every minute) as the cron expression — the handler reads `deadline_config` and self-determines if the deadline has passed
- This is simpler than a complex cron expression that would need to change whenever the deadline day/time changes

### 2. Deadline configuration
**Decision:** DB config table (`deadline_config`) with a card in the Server Settings page (existing `/server-settings` route).
- Default: Saturday, 23:59, timezone offset -5 (EST)
- Fields: `day_of_week` (0–6), `hour` (0–23), `minute` (0–59), `timezone_offset` (integer hours, e.g. -5 for EST)
- Single row — head_admin can edit via Server Settings page
- No new route needed — add a Deadline Config card to the existing `/server-settings` page
- Scheduler reads config on each minute tick, computes current deadline occurrence, checks idempotency

### 3. T4 upgrade cost
**Decision:** Track upgrades at 500 SP for T4 only (overrides v1's 280).
- Full upgrade cost table: T1→T2 = 60 SP, T2→T3 = 140 SP, T3→T4 = 500 SP
- Source: v1 UPGRADE_SP for T1/T2/T3, Handbook §IX for T4 specifically
- Upgrade action on node detail page: logs a `submission_type="upgrade"` record, increments node tier
- Staff triggers upgrade; panel enforces the SP cost via the submission flow

### 4. INSTAB_EVENTS storage
**Decision:** Hardcoded in static files — NOT in a PocketBase table.
- `vs3-panel/src/lib/instab_events.ts` — TypeScript for SvelteKit UI (display events, action buttons)
- Scheduler does NOT need INSTAB_EVENTS — event selection and resolution happen in the UI
- The scheduler only sets `roll_due=true` on nodes with instability > 0 after deadline processing
- Staff triggers d100 roll from the UI; the roll result + selected event is stored in `instability_rolls`

### 5. Submission logging UX
**Decision:** Both node detail page AND quick-add from dashboard.
- Node detail page `/nodes/[id]` — primary location for logging submissions (item, qty, SP preview, cap warning)
- Dashboard — shows unpaid/overdue nodes with a "Log Submission" quick-add modal (same form, pre-filled node)
- No separate `/submissions/new` route

---

## New Collections for Phase 3 Schema Migration

### `submissions` (current cycle — cleared on deadline processing)
| Field | Type | Notes |
|-------|------|-------|
| `node` | relation → nodes | required |
| `item` | relation → sp_catalogue | optional (null for special types) |
| `item_name` | text | denormalized for display |
| `category` | text | denormalized from sp_catalogue or special |
| `qty` | number | |
| `sp_value` | number | total SP for this submission |
| `submission_type` | select | "upkeep", "instability_reduction", "repair", "upgrade" |
| `staff_note` | text | optional |
| `submitted_by` | relation → staff | optional |

Rules: STAFF create/read/delete, ADMIN delete-only for history

### `submission_history` (archived per deadline cycle)
| Field | Type | Notes |
|-------|------|-------|
| `node` | relation → nodes | required |
| `deadline_ts` | date | which deadline this cycle corresponds to |
| `paid_sp` | number | total SP paid that cycle |
| `required_sp` | number | effective upkeep that cycle |
| `outcome` | select | "paid", "partial", "underfunded", "unpaid" |
| `instab_delta` | number | 0, 1, or 2 |
| `snapshot` | json | array of {item_name, category, qty, sp_value} |

Rules: STAFF read, createRule null (scheduler-only), ADMIN delete

### `deadline_config` (single row)
| Field | Type | Notes |
|-------|------|-------|
| `day_of_week` | number | 0–6, default 6 (Saturday) |
| `hour` | number | 0–23, default 23 |
| `minute` | number | 0–59, default 59 |
| `timezone_offset` | number | hours offset from UTC, default -5 (EST) |
| `is_active` | bool | if false, scheduler skips processing |

Rules: STAFF read, ADMIN create/update (single row, never deleted)

### `instability_rolls` (roll log per node)
| Field | Type | Notes |
|-------|------|-------|
| `node` | relation → nodes | required |
| `roll` | number | 1–100 |
| `threshold` | number | INSTAB_CHANCE[node.instability] at time of roll |
| `triggered` | bool | roll ≤ threshold |
| `event_name` | text | if triggered |
| `event_desc` | text | if triggered |
| `event_effect` | text | if triggered |
| `sp_cost` | number | if event has SP cost |
| `instab_add` | number | if event adds instability |
| `output_penalty` | number | if event has output penalty |
| `is_choice` | bool | if event offers staff a choice |
| `is_rp` | bool | if event requires RP resolution |
| `resolved` | bool | |
| `resolved_action` | select | "apply_instability", "log_sp_debt", "mark_output_penalty", "mark_rp_handled", "dismiss" |
| `staff_note` | text | optional |

Rules: STAFF create/read/update, ADMIN delete

### Nodes collection additions (schema migration)
- No `upkeepDeadline` per node — global deadline from `deadline_config` applies to all nodes
- `roll_due` (bool) — already exists in Phase 2 schema ✓
- `instability` (number 0–5) — already exists ✓

---

## Logic to Port from v1

### procDeadlines() → scheduler.js
From `Admin Panel/VS3_Panel_1_2_1.html` lines 433–459:
```
1. Skip nodes with no owner or owner = Neutral Territory
2. Idempotency key: deadlineTimestamp + "|" + nodeId
3. Calculate: req = calcUp(node), paid = sum(submissions.sp_value), pct = paid/req*100
4. Instability delta: pct>=100 → +0, pct>=50 → +1, pct>0 or pct==0 → +2
5. node.instability = min(5, instability + delta)
6. If delta > 0 AND instability > 0 → rollDue = true
7. Archive current submissions to submission_history snapshot
8. Delete submissions records for this node
9. Advance deadline (compute next Saturday 23:59 EST from deadline_config)
10. Write server_log entry (type: "upkeep_deadline_processed")
11. Write job_run_log record
12. Stamp idempotency key in deadline_config.last_processed_ts or job_run_log
```

### checkCaps() → SvelteKit submissions server action
From v1 lines 423–430:
```
cap_check: rrSP/req <= 40% AND cSP/req <= 40%
Show warning BEFORE save, block if over cap (not just warn)
Preview shows current rrPct and cPct including the new submission
```

### INSTAB_EVENTS + pickEvent() → `vs3-panel/src/lib/instab_events.ts`
From v1 lines 241–326:
- 15 node types, ~5 events each, 75 total entries
- NT_MAP alias: "Ranch" → "Herd / Ranch", "Harbor/River Landing" → "Harbor / River Landing"
- pickEvent: filter by node type, pick random from pool
- Event fields: name, desc, effect, outputPenalty, spCost, instabAdd, choice, rp

### calcUp() — already ported to `vs3-panel/src/lib/upkeep.ts` ✓

---

## Phase 3 UI Pages/Additions Summary

### Modified pages
- **`/nodes/[id]`** — add Submissions section (list + add form with SP preview + cap warning) + Instability Roll section (when rollDue=true) + cycle history tab
- **`/dashboard`** — add unpaid nodes quick-log buttons + scheduler health card (Last Run: X ago, 8-day alert)
- **`/server-settings`** — add Deadline Config card (day/hour/min/timezone editable by head_admin)

### New pages
- **`/metrics`** — SP totals by category, item, faction, node (tables) + weekly SP owed vs paid bar chart per faction (Chart.js 4)

### Sidebar additions
- Metrics link (after Server Log)

---

## Special Submission Types

| Type | SP Cost | Description |
|------|---------|-------------|
| `upkeep` | varies | Normal cycle submission (item from sp_catalogue) |
| `instability_reduction` | 40 SP fixed | Manually reduce node instability by 1 (INSTAB-05) |
| `repair` | T1=50, T2=100, T3=200, T4=300 | Repair node (§VIII values) |
| `upgrade` | T1→T2=60, T2→T3=140, T3→T4=500 | Upgrade node tier (v1 values; T4 uses handbook §IX) |

---

## Deferred (Out of Phase 3 Scope)

- Chart.js library already in package.json — confirm import pattern in Phase 3 research
- Player portal (Phase 4) will need to query submission + instability state — schema must not preclude this
- Repair and upgrade actions are in-scope for Phase 3 (per special submission types above)

---

## Open Questions Resolved

- ~~Scheduler path~~ — `cronAdd()` in pb_hooks/scheduler.js, confirmed (scaffolded in Phase 1)
- ~~PvE war modifier~~ — `warMul=0` for PvE, already implemented in upkeep.ts
- ~~T4 upgrade cost~~ — 500 SP (handbook §IX), using v1 values for T1→T2 and T2→T3
