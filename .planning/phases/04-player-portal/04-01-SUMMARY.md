---
phase: 04-player-portal
plan: 01
subsystem: ui
tags: [sveltekit, pocketbase, portal, svelte5, runes, member-auth, upkeep]

# Dependency graph
requires:
  - phase: 03-upkeep-engine
    provides: submissions collection, calcUpkeep function, nodes schema with instability/tier fields
  - phase: 02-core-data-wars
    provides: nodes, factions, wars, diplomacy collections and their field names
  - phase: 01-foundation
    provides: portal auth guard (+layout.server.ts), members collection, locals.pb member token

provides:
  - Portal shell layout (+layout.svelte) with fixed 48px topbar — no AppSidebar
  - factionName field added to +layout.server.ts user object
  - Portal data load function (+page.server.ts) — nodes, wars, alliances, faction
  - Phase 4 PocketBase migration updating collection rules for member portal access

affects:
  - 04-02 (portal UI page uses data shape returned by +page.server.ts load function)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Portal shell pattern: +layout.svelte with topbar-only (no AppSidebar), content at pt-[48px] max-w-[1100px]
    - Member-scoped query pattern: locals.pb (member token) for all portal queries — PocketBase collection rule enforces faction privacy at DB level
    - Parallel query pattern: Promise.all([faction, nodes, wars, diplomacy]) in portal load function
    - paidSP aggregation pattern: single submissions getFullList with node-id IN filter, then Map<nodeId, sum>

key-files:
  created:
    - vs3-panel/src/routes/(portal)/+layout.svelte
    - vs3-panel/src/routes/(portal)/portal/+page.server.ts
    - pb_migrations/1746316800_phase4_portal_rules.js
  modified:
    - vs3-panel/src/routes/(portal)/+layout.server.ts (added factionName fetch + return)

key-decisions:
  - "diplomacy collection used for alliances (not a separate alliances collection) — uses faction_a/faction_b two-party fields, not multi-select"
  - "nodes collection uses owner field (not faction) — filter is owner = {:factionId}"
  - "paidSP computed at load time by summing submissions collection per node — nodes table has no stored paid_sp field"
  - "Phase 4 migration required to open listRule/viewRule on factions/nodes/wars/diplomacy/submissions for member token access"
  - "tier field stored as string select (1/2/3/4) — parseInt() applied at read time in load function"

patterns-established:
  - "Portal queries always use locals.pb (member token) — never an admin client. PocketBase collection rule @request.auth.faction = owner on nodes enforces faction privacy at DB level."
  - "paidSP aggregation: single getFullList with node IN filter, reduce into Map<nodeId, sum> — avoids N+1 queries"

requirements-completed:
  - PORTAL-01
  - PORTAL-02
  - PORTAL-04

# Metrics
duration: 25min
completed: 2026-05-02
---

# Phase 4 Plan 01: Portal Data Layer and Shell Layout Summary

**Member portal shell topbar (fixed 48px, gold VS3 Panel + faction name + Sign Out) and load function returning faction-scoped nodes with server-side upkeep status, plus PocketBase migration enabling member token read access**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02T00:25:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 new layout, 2 new TS files, 1 migration, 1 layout.server.ts update)

## Accomplishments

- `+layout.svelte` created: fixed 48px topbar (bg #231d14) showing "VS3 Panel" in gold, Separator, faction name, username, and Sign Out button with Loader2 spinner — no AppSidebar
- `+layout.server.ts` updated to fetch faction name from PocketBase and include `factionName` in user object
- `+page.server.ts` created: 4 parallel queries via `locals.pb` (member token) — faction, nodes (owner-scoped), wars (global), diplomacy (global); `calcUpkeep()` called per node; paidSP aggregated from submissions; upkeepStatus enum computed server-side
- `1746316800_phase4_portal_rules.js` migration created: updates listRule/viewRule on factions, nodes, wars, diplomacy, submissions to allow member portal access

## Task Commits

1. **Task 1: Portal shell layout** - `21adc05` (feat)
2. **Task 2: Portal data load function** - `0066184` (feat)

## Files Created/Modified

- `vs3-panel/src/routes/(portal)/+layout.svelte` — Portal shell with fixed topbar, no sidebar, content wrapper
- `vs3-panel/src/routes/(portal)/+layout.server.ts` — Added factionName fetch and return in user object
- `vs3-panel/src/routes/(portal)/portal/+page.server.ts` — Load function: 4 parallel PocketBase queries, calcUpkeep per node, upkeepStatus derivation
- `pb_migrations/1746316800_phase4_portal_rules.js` — Phase 4 migration: member read access to portal collections

## Decisions Made

- **diplomacy not alliances**: The collection created in Phase 2 is named `diplomacy` with `faction_a`/`faction_b` fields (two-party model). The plan referenced `alliances` with a multi-select `factions` field — corrected to match actual schema.
- **owner not faction on nodes**: The nodes collection uses `owner` as the relation field to factions. Filter updated to `owner = {:factionId}`.
- **paidSP from submissions**: The nodes collection has no stored `paid_sp` field. Current-cycle paid SP is computed by summing `sp_value` from the `submissions` collection (a single query with `node IN (...)` filter rather than N+1 per-node queries).
- **Phase 4 migration required**: All portal collections (factions, nodes, wars, diplomacy, submissions) had `listRule: STAFF` — member tokens would receive 403 on every query. Migration updates rules to allow `@request.auth.collectionName = "members"` read access with appropriate scope.
- **tier as string**: The `tier` field is a PocketBase select stored as a string ("1"–"4"). `parseInt()` applied in load function before passing to `calcUpkeep()` and MILITARY_TIER_LABELS lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Collection name: diplomacy not alliances**
- **Found during:** Task 2 (portal data load function)
- **Issue:** Plan referenced `alliances` collection with `expand: 'factions'` (multi-select). Actual Phase 2 schema has `diplomacy` collection with `faction_a`/`faction_b` fields.
- **Fix:** Changed collection name to `diplomacy`, updated expand to `faction_a,faction_b`, mapped two named parties instead of array expand.
- **Files modified:** vs3-panel/src/routes/(portal)/portal/+page.server.ts
- **Verification:** Matches diplomacy+page.server.ts pattern established in Phase 2
- **Committed in:** 0066184 (Task 2 commit)

**2. [Rule 1 - Bug] Node filter field: owner not faction**
- **Found during:** Task 2 (portal data load function)
- **Issue:** Plan used `filter: 'faction = {:factionId}'` but nodes collection uses `owner` as the relation field to factions.
- **Fix:** Changed filter to `owner = {:factionId}` and removed `owner_type != "neutral"` (no such field — unowned nodes excluded by `owner = factionId` naturally returning empty).
- **Files modified:** vs3-panel/src/routes/(portal)/portal/+page.server.ts
- **Verification:** Matches nodes+page.server.ts filter pattern from Phase 2
- **Committed in:** 0066184 (Task 2 commit)

**3. [Rule 1 - Bug] tier stored as string select not number**
- **Found during:** Task 2 (portal data load function)
- **Issue:** Plan treated `node.tier` as a number directly; PocketBase stores it as string select ("1","2","3","4").
- **Fix:** Added `parseInt(node.tier as string, 10) || 1` before passing to calcUpkeep and MILITARY_TIER_LABELS.
- **Files modified:** vs3-panel/src/routes/(portal)/portal/+page.server.ts
- **Verification:** Matches how nodes/[id]/+page.server.ts handles tier
- **Committed in:** 0066184 (Task 2 commit)

**4. [Rule 1 - Bug] paidSP from submissions collection not node field**
- **Found during:** Task 2 (portal data load function)
- **Issue:** Plan used `node.cycle_paid_sp` field which does not exist on the nodes collection. The submissions collection tracks current-cycle SP per node.
- **Fix:** Added 5th parallel-ish query to `submissions` with `node IN (nodeIds)` filter after nodes are fetched, aggregated into Map<nodeId, sum> for O(1) lookup per node.
- **Files modified:** vs3-panel/src/routes/(portal)/portal/+page.server.ts
- **Verification:** Matches pattern from nodes/[id]/+page.server.ts which sums currentSubmissions
- **Committed in:** 0066184 (Task 2 commit)

**5. [Rule 2 - Missing Critical] Phase 4 PocketBase migration for member read access**
- **Found during:** Task 2 (portal data load function)
- **Issue:** All portal collections (factions, nodes, wars, diplomacy, submissions) had `listRule/viewRule: STAFF` — member tokens would receive 403 on every query, making the portal non-functional.
- **Fix:** Created `pb_migrations/1746316800_phase4_portal_rules.js` updating read rules: nodes scoped to `@request.auth.faction = owner`, factions scoped to `@request.auth.faction = id` (viewRule), wars/diplomacy/submissions opened to members.
- **Files modified:** pb_migrations/1746316800_phase4_portal_rules.js (new)
- **Verification:** Rules match threat model dispositions (T-04-01: nodes scoped, T-04-04: wars/alliances global accepted)
- **Committed in:** 0066184 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (4 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correctness and functionality. No scope creep. Plan's intent fully realized.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

PocketBase must be restarted for `1746316800_phase4_portal_rules.js` to run. The migration updates collection access rules for member portal access — without this restart, members will receive 403 errors on all portal queries.

## Next Phase Readiness

- Portal shell layout ready: topbar renders with faction name + username + Sign Out
- Load function returns typed data: `nodes[]` with effectiveUpkeep/upkeepStatus/paidSP/requiredSP, `wars[]`, `alliances[]`, `faction`
- Plan 02 can use this data shape directly to build the portal UI page
- TypeScript compilation passes (no errors from new files)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| vs3-panel/src/routes/(portal)/+layout.svelte | FOUND |
| vs3-panel/src/routes/(portal)/+layout.server.ts (factionName) | FOUND |
| vs3-panel/src/routes/(portal)/portal/+page.server.ts | FOUND |
| pb_migrations/1746316800_phase4_portal_rules.js | FOUND |
| commit 21adc05 (Task 1) | FOUND |
| commit 0066184 (Task 2) | FOUND |

---
*Phase: 04-player-portal*
*Completed: 2026-05-02*
