---
phase: 03-upkeep-engine
plan: 06
subsystem: metrics
tags: [svelte5-chartjs, chart.js, metrics, sidebar, aggregation]

# Dependency graph
requires:
  - phase: 03-upkeep-engine
    plan: 01
    provides: svelte5-chartjs + chart.js installed, submission_history collection created

provides:
  - /metrics route (staff-only, SP Totals + Weekly Chart tabs)
  - Sidebar Metrics nav link active (BarChart3 icon, /metrics)
  - Phase 3 disabled states removed from AppSidebar

affects:
  - AppSidebar.svelte (Metrics link active, Phase 3 section removed)
  - /metrics route (new)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Client-side JSON.parse aggregation of submission_history.snapshot (Pitfall 6 compliance)
    - $derived chain for four groupBy aggregation modes (category/item/faction/node)
    - svelte5-chartjs Bar component with Chart.register tree-shaking

key-files:
  created:
    - vs3-panel/src/routes/(staff)/metrics/+page.server.ts
    - vs3-panel/src/routes/(staff)/metrics/+page.svelte
  modified:
    - vs3-panel/src/lib/components/AppSidebar.svelte

key-decisions:
  - "Metrics nav item added directly to phase2Items array — no separate Phase 3 disabled section needed since all Phase 3 items are now live"
  - "CalendarClock import removed; Upkeep submissions route through /nodes (node detail page) per UI-SPEC — no dedicated /upkeep route exists"
  - "Aggregation fully client-side in +page.svelte $derived — snapshot is JSON text, not queryable in PB filter (RESEARCH.md Pitfall 6)"
  - "chartData.isEmpty guard prevents rendering Bar when no submission_history rows exist"

requirements-completed:
  - METRICS-01
  - METRICS-02

# Metrics
duration: 4min
completed: 2026-05-02
---

# Phase 3 Plan 06: Metrics Page and Sidebar Activation Summary

**New /metrics route with SP Totals and Weekly Chart tabs wired to live submission_history; Metrics sidebar link activated and Phase 3 disabled states removed**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-02T14:00:50Z
- **Completed:** 2026-05-02T14:04:43Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `+page.server.ts` fetches `submission_history` (with `snapshot` field), `factions`, and `nodes` via `Promise.all` with `.catch(() => [])` fallback on each — intentionally minimal per Pitfall 6 (snapshot is JSON text, not SQL-queryable)
- `+page.svelte` implements SP Totals tab with four groupBy modes: by Category (Category / Total SP / Submission Count / % of All SP), by Item (Item Name / Category / Total SP / Total Qty / Avg SP/Submission), by Faction (Faction dot+name / Nodes / SP Owed / SP Paid / Payment Rate), by Node (Node link / Owner dot+name / Type / Total SP Paid / Cycles / Avg Payment Rate)
- Date range filter (All Time / Last 4 Weeks / Last 12 Weeks / Current Cycle), faction filter, node filter (hidden when groupBy=node)
- Payment rate colored: ≥100%=#90cc90, 50-99%=#d4c060, <50%=#e07840; SP totals in gold #c4a45a
- Weekly Chart tab: Chart.js bar chart via svelte5-chartjs `Bar` component with `Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)` tree-shaking; SP Owed bars `rgba(196,164,90,0.75)`, SP Paid bars `rgba(61,107,61,0.75)`; legend labels #d4c5a0; grid #3d3426; ticks #8b7d65
- Both tabs have UI-SPEC-exact empty states: "No submission data for the selected filters." and "No cycle history available for charting. Data appears after the first deadline is processed."
- `AppSidebar.svelte`: Metrics added as active nav item (BarChart3, /metrics) in phase2Items array; entire Phase 3 disabled section removed; `CalendarClock` import removed
- T-03-22 mitigated: route lives under `(staff)` layout guard — non-staff redirected
- T-03-23 mitigated: `JSON.parse(h.snapshot)` wrapped in `try/catch`, malformed snapshots silently skipped

## Task Commits

1. **Task 1: Create /metrics +page.server.ts** - `549c8b9` (feat)
2. **Task 2: Create /metrics +page.svelte** - `e9169de` (feat)
3. **Task 3: Update AppSidebar** - `29361d6` (feat)

## Files Created/Modified

- `vs3-panel/src/routes/(staff)/metrics/+page.server.ts` — load function returns submissionHistory, factions, nodes
- `vs3-panel/src/routes/(staff)/metrics/+page.svelte` — SP Totals tab + Weekly Chart tab, full aggregation logic
- `vs3-panel/src/lib/components/AppSidebar.svelte` — Metrics link active, Phase 3 disabled section removed

## Decisions Made

- **Aggregation in +page.svelte**: The `snapshot` field is a JSON string — PocketBase filters cannot query into it. All filtering and grouping happens in TypeScript `$derived` computations on the client. This is intentional per RESEARCH.md Pitfall 6 and acceptable for this dataset size (bounded: 3-6 factions, ~30 nodes, weekly cycles).
- **No dedicated /upkeep route**: Upkeep submissions live on `/nodes/[id]` (node detail page). The sidebar Upkeep disabled item just pointed to this flow — removing the disabled section is sufficient. The plan explicitly calls this out (Upkeep routes to /nodes).
- **Metrics added to phase2Items**: Rather than creating a new "Phase 3 items" active section, Metrics was appended to the existing `phase2Items` array which already handles active link styling. Cleaner and matches final nav order from UI-SPEC.

## Deviations from Plan

None — plan executed exactly as written.

The sidebar had no "Coming in Phase 4" items (they were never added in earlier plans), so the acceptance criterion "File still contains Coming in Phase 4" was N/A. No deviation — there were no Phase 4 disabled items to preserve.

## Known Stubs

None. All data flows from real `submission_history` records. Empty states render correct copy when no data exists.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`. The `/metrics` route inherits the `(staff)` layout guard from the route group layout. No new network endpoints, no new file access, no new auth paths introduced.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| vs3-panel/src/routes/(staff)/metrics/+page.server.ts | FOUND |
| vs3-panel/src/routes/(staff)/metrics/+page.svelte | FOUND |
| vs3-panel/src/lib/components/AppSidebar.svelte modified | FOUND |
| commit 549c8b9 (server.ts) | FOUND |
| commit e9169de (page.svelte) | FOUND |
| commit 29361d6 (AppSidebar) | FOUND |

---
*Phase: 03-upkeep-engine*
*Completed: 2026-05-02*
