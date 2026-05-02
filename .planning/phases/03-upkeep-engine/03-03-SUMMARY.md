---
phase: 03-upkeep-engine
plan: 03
subsystem: server-settings
tags: [sveltekit, pocketbase, deadline-config, form-action, zod, switch]

# Dependency graph
requires:
  - plan: 03-01
    provides: deadline_config collection (seeded), switch component

provides:
  - saveDeadlineConfig action (head_admin-gated, zod-validated, upsert)
  - deadlineConfig + isHeadAdmin from load()
  - Deadline Configuration card on /server-settings (day/hour/min/tz/active)
  - Live next-deadline preview ($derived, updates as inputs change)

affects:
  - 03-05 (dashboard scheduler health card — deadline_config readable via load)
  - 03-06 (dashboard may display next deadline from same collection)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - zod saveDeadlineConfigSchema with coerce + preprocess for checkbox boolean
    - upsert pattern via getList(1,1) then update or create
    - Hidden input carries Switch value to server (shadcn Switch does not post when off)
    - $derived tzLabel + nextDeadlinePreview for live preview without server round-trip

key-files:
  modified:
    - vs3-panel/src/routes/(staff)/server-settings/+page.server.ts
    - vs3-panel/src/routes/(staff)/server-settings/+page.svelte

key-decisions:
  - "saveDeadlineConfig uses upsert pattern (getList then update/create) because deadline_config is a singleton row — same approach as scheduler reads"
  - "Hidden input alongside Switch component carries is_active boolean value because shadcn Switch does not emit a form field value when unchecked"
  - "isHeadAdmin $derived from data.isHeadAdmin === true (strict equality) to handle null/undefined safely"

# Metrics
duration: 8min
completed: 2026-05-01
---

# Phase 3 Plan 03: Deadline Configuration UI Summary

**Deadline Configuration card added to /server-settings: head admins can edit day/hour/minute/UTC-offset and toggle scheduler active; staff see read-only notice; live preview shows next deadline as inputs change**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-01T00:00:00Z
- **Completed:** 2026-05-01T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `+page.server.ts`: Added `saveDeadlineConfigSchema` zod schema enforcing min/max on all fields (day 0–6, hour 0–23, minute 0–59, tz -12–14, is_active as boolean via preprocess). Load extended to fetch `deadline_config` singleton and return `isHeadAdmin`. `saveDeadlineConfig` action added with head_admin gate (403 on fail), zod parse (400 on fail), upsert via `getList(1,1)` then update/create (500 on error).
- `+page.svelte`: `Switch` imported from `$lib/components/ui/switch`. Reactive state vars (`dayOfWeek`, `hour`, `minute`, `tzOffset`, `isActive`, `savingDeadline`) initialized from `data.deadlineConfig` with safe defaults. `nextDeadlinePreview` and `tzLabel` as `$derived` update live as inputs change. DEADLINE CONFIGURATION card renders after Data Export/Import card with 2-column grid: day select, hour:minute inputs, tz offset input, active switch. Head admin sees editable form + Save button; staff sees italic notice. Hidden input carries `is_active` value for form POST. `last_processed_ts` displayed below form (or "Never processed"). Existing Data Export/Import card markup unchanged.

## Task Commits

1. **Task 1: Add deadline_config load + saveDeadlineConfig action** - `dd5bce3` (feat)
2. **Task 2: Render Deadline Configuration card on server-settings page** - `f592e1c` (feat)

## Files Modified

- `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts` — zod schema, extended load, saveDeadlineConfig action
- `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` — Switch import, reactive state, Deadline Configuration card

## Card Location

The Deadline Configuration card is positioned directly after the Data Export & Import card on `/server-settings`. It uses the same `rounded-lg border` container style (`border-color: #3d3426; background: #1a1410`) with `margin-top: 1rem` for separation.

## Action Shape

```
POST /server-settings?/saveDeadlineConfig
Fields: day_of_week (0-6), hour (0-23), minute (0-59), timezone_offset (-12-14), is_active ('on'|'')
Auth:   head_admin role required (403 otherwise)
Return: { success: true, action: 'saveDeadlineConfig' } or fail(400|403|500, { action, errors })
```

## Deviations from Plan

None — plan executed exactly as written.

The plan's `isHeadAdmin` expression was `$derived(data.isHeadAdmin === true)` (strict equality) vs the plan's template suggestion of `$derived(data.isHeadAdmin === true)` — matches exactly. The existing file already had `isHeadAdmin = $derived(data.isHeadAdmin)` which was updated to use strict equality for safety.

## Known Stubs

None. The card reads from `data.deadlineConfig` which is loaded from the live `deadline_config` collection (seeded in Plan 01 migration). `last_processed_ts` will show "Never processed" until the scheduler first runs — this is correct behavior, not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `saveDeadlineConfig` action accesses the existing `deadline_config` collection, which already has `updateRule=ADMIN` as a second enforcement layer (T-03-10 mitigated at both SvelteKit action level and PocketBase collection rule level). T-03-11 mitigated by zod schema range constraints. T-03-12 mitigated by same head_admin gate.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| vs3-panel/src/routes/(staff)/server-settings/+page.server.ts | FOUND |
| vs3-panel/src/routes/(staff)/server-settings/+page.svelte | FOUND |
| commit dd5bce3 (Task 1 — server action) | FOUND |
| commit f592e1c (Task 2 — svelte card) | FOUND |
| saveDeadlineConfig action present | FOUND |
| saveDeadlineConfigSchema present | FOUND |
| head_admin gate present | FOUND |
| DEADLINE CONFIGURATION card present | FOUND |
| nextDeadlinePreview $derived present | FOUND |
| Data Export card preserved | FOUND |

---
*Phase: 03-upkeep-engine*
*Completed: 2026-05-01*
