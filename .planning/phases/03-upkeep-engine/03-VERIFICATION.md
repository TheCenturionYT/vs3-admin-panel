---
phase: 03-upkeep-engine
verified: 2026-05-01T00:00:00Z
status: human_needed
score: 19/19 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit /nodes/[id] for a node with roll_due=true. Click 'Roll d100'. Observe dice display and event card (if triggered). Click a resolve button and confirm roll_due clears and instability updates."
    expected: "Dice face shows correct value, event card shows for triggered rolls, resolution buttons clear roll_due on node, resolveEvent posts to instability_rolls with resolved=true"
    why_human: "Client-side d100 roll + auto-form-submit is a two-step reactive flow that cannot be verified without a running browser; $state/pickEvent interplay requires runtime validation"
  - test: "Visit /dashboard. Confirm 'Scheduler monitoring coming in Phase 3' stub is gone; SCHEDULER HEALTH card shows one of three states (disabled/alert/normal) based on deadline_config.is_active and job_run_log recency."
    expected: "No old stub text visible; correct card state renders; 'Last run: X ago' uses formatDistanceToNow accurately"
    why_human: "Three-state card logic depends on live database values and real-time formatting; visual correctness requires a browser with populated data"
  - test: "From dashboard overdue nodes table, click 'Log Submission' on a row. Verify quick-log modal opens pre-filled with node name, faction, required SP, and paid SP values. Submit an upkeep submission and confirm the dashboard refreshes."
    expected: "Modal opens with correct context, form action points to /nodes/{id}?/logSubmission, invalidateAll() fires after success, row disappears if node becomes fully paid"
    why_human: "Quick-log modal pre-fill state and post-submission dashboard refresh require an interactive session"
  - test: "On /server-settings as head_admin, modify the deadline day/hour and save. Verify values persist on reload and the scheduler uses the new values on next cron tick."
    expected: "deadline_config row updated in PocketBase, next cron tick reads new config, last_processed_ts gate still works"
    why_human: "Save/reload/cron integration requires live PocketBase with the migration applied"
  - test: "On /metrics, switch between SP Totals groupBy modes (category/item/faction/node) and confirm table columns and rows update. Switch to Weekly Chart and verify bar chart renders with theme colors."
    expected: "Table columns change per groupBy, bar chart uses rgba(196,164,90,0.75) for Owed and rgba(61,107,61,0.75) for Paid bars, empty states appear correctly when no data"
    why_human: "Chart.js rendering and table column switching requires visual inspection in a running browser"
---

# Phase 3: Upkeep Engine Verification Report

**Phase Goal:** The weekly upkeep cycle runs automatically — staff logs submissions, the scheduler processes the deadline, instability events surface with action buttons, and the dashboard reports scheduler health
**Verified:** 2026-05-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Scheduler runs every minute via cronAdd, reads deadline_config, processes overdue nodes idempotently | ✓ VERIFIED | `scheduler.js` lines 238-252: `cronAdd("upkeep_deadline_processor", "* * * * *", ...)` with `processDeadlines()` → idempotency gate at line 117: `cfg.getString("last_processed_ts") === deadlineTs` |
| 2 | instab_events.ts exports INSTAB_EVENTS (77 entries), INSTAB_CHANCE, INSTAB_LABEL, pickEvent | ✓ VERIFIED | `instab_events.ts` lines 15-186: all four exports present, 77 entries across 15 node types confirmed, file ends with `// END OF INSTAB_EVENTS — 77 entries, 15 node types` |
| 3 | POST /api/vs3/process-deadlines endpoint triggers processing on demand (UPKEEP-10) | ✓ VERIFIED | `scheduler.js` lines 259-275: `routerAdd("POST", "/api/vs3/process-deadlines", ..., $apis.requireAuth())` wired to `processDeadlines()` |
| 4 | Each scheduler run writes a job_run_log entry with status and details | ✓ VERIFIED | `scheduler.js` lines 241-246: `writeJobRunLog("upkeep_deadline_processor", "completed", ...)` on successful run; lines 250-251: writes `"error"` on catch |
| 5 | Re-running across the same deadline does not double-apply instability | ✓ VERIFIED | `scheduler.js` lines 117-119: gate stamps `last_processed_ts` INSIDE `runInTransaction` (line 221-222) — atomic idempotency |
| 6 | Neutral Territory nodes are skipped during processing | ✓ VERIFIED | `scheduler.js` lines 124-132: `findFirstRecordByData("factions", "name", "Neutral Territory")` then filter `owner != "" && owner != "${neutralId}"` |
| 7 | PocketBase has all five Phase 3 collections with correct rules | ✓ VERIFIED | `pb_migrations/1746230400_phase3_schema.js`: submissions (STAFF rules), submission_history (createRule=null), deadline_config (createRule/updateRule=ADMIN), instability_rolls (STAFF), job_run_log (createRule=null) — all with `exists()` guards |
| 8 | deadline_config seeded with Saturday 23:59 UTC-5, is_active=true | ✓ VERIFIED | Migration lines 143-151: `day_of_week=6, hour=23, minute=59, timezone_offset=-5, is_active=true` with guard against duplicate seed |
| 9 | Head admin can edit deadline_config from /server-settings; staff see read-only notice | ✓ VERIFIED | `server-settings/+page.server.ts` lines 63-94: `saveDeadlineConfig` action with `role !== 'head_admin'` → fail(403); `+page.svelte` line 9: `isHeadAdmin = $derived(data.isHeadAdmin === true)` with read-only notice on `{#if !isHeadAdmin}` |
| 10 | Staff can log a submission (upkeep, instability_reduction, repair, upgrade) from /nodes/[id] | ✓ VERIFIED | `nodes/[id]/+page.server.ts` lines 395-483: `logSubmission` action handles all four types; server-side sp_value derivation; all four types implemented |
| 11 | Upkeep submissions exceeding 40% cap are blocked server-side | ✓ VERIFIED | `nodes/[id]/+page.server.ts` lines 424-443: `checkCaps()` called with recomputed effectiveUpkeep at write time; `cap.ok === false` → fail(400) with cap percentages |
| 12 | Live SP cap preview updates client-side as qty changes | ✓ VERIFIED | `nodes/[id]/+page.svelte` lines 82-96: `capPreview` $derived computes running category totals with two Progress bars |
| 13 | Instability check section renders when roll_due=true; Roll d100 flow works | ✓ VERIFIED | `nodes/[id]/+page.svelte`: `rollD100()` function at lines 138-145, `data.node?.roll_due` conditional verified by grep finding 22 matches for related patterns including `Roll d100`, `rollInstability`, `resolveEvent` |
| 14 | Resolving event sets roll_due=false on node | ✓ VERIFIED | `nodes/[id]/+page.server.ts` lines 530-562: `resolveEvent` action calls `nodes.update(params.id, { roll_due: false })` in all branches |
| 15 | Dashboard shows 'Last deadline run: X ago' from job_run_log; 8-day alert fires | ✓ VERIFIED | `dashboard/+page.server.ts` lines 53-59: `daysSinceLastRun = Infinity` if no run, `schedulerOverdue = daysSinceLastRun > 8`; `+page.svelte` lines 17-21: `formatDistanceToNow` used for `lastRunAgo`; alert and disabled states present at lines 280-307 |
| 16 | Process All Overdue button triggers POST /api/vs3/process-deadlines | ✓ VERIFIED | `dashboard/+page.server.ts` lines 132-148: `processOverdue` action fetches `http://localhost:8090/api/vs3/process-deadlines` with `Authorization: token`; `+page.svelte`: form posts to `?/processOverdue` with confirmation dialog |
| 17 | Cycle History tab shows submission_history rows | ✓ VERIFIED | `nodes/[id]/+page.server.ts` lines 153-156: `submission_history.getFullList` sorted by `-deadline_ts` returned as `cycleHistory`; Svelte file has three-tab layout with `CURRENT CYCLE SUBMISSIONS` and cycle history content |
| 18 | /metrics route renders SP Totals tab (4 groupBy modes) and Weekly Chart tab | ✓ VERIFIED | `metrics/+page.svelte`: `groupBy` $state with category/item/faction/node; `totalsRows` $derived aggregates all four modes; `Bar` from `svelte5-chartjs` with `Chart.register`; both empty states present |
| 19 | Sidebar has Metrics link (BarChart3, /metrics); Phase 3 disabled states removed | ✓ VERIFIED | `AppSidebar.svelte` lines 13 and 29: `BarChart3` imported, `{ label: 'Metrics', href: '/metrics', Icon: BarChart3 }` in `phase2Items`; no "Coming in Phase 3" text found in file |

**Score:** 19/19 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pb_migrations/1746230400_phase3_schema.js` | Phase 3 schema migration | ✓ VERIFIED | 167 lines, all 5 collections, exists() guards, seed row, revert function |
| `pb_hooks/scheduler.js` | cronAdd + processDeadlines + routerAdd | ✓ VERIFIED | 276 lines, jsvm_calcUp, runInTransaction, last_processed_ts idempotency, $apis.requireAuth() |
| `vs3-panel/src/lib/instab_events.ts` | INSTAB_EVENTS 77 entries, helpers | ✓ VERIFIED | 187 lines, 77 entries across 15 node types, all exports present |
| `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts` | saveDeadlineConfig + load | ✓ VERIFIED | saveDeadlineConfigSchema, head_admin gate, upsert pattern, isHeadAdmin in load |
| `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` | Deadline Configuration card | ✓ VERIFIED | DEADLINE CONFIGURATION label, Switch, nextDeadlinePreview $derived, read-only notice |
| `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` | logSubmission, removeSubmission, rollInstability, resolveEvent actions | ✓ VERIFIED | All 4 actions present, REPAIR_SP/UPGRADE_SP constants, checkCaps(), calcUpkeep import |
| `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` | Tabs, Submissions section, Instability Roll, Cap Preview | ✓ VERIFIED | Three-tab layout, CURRENT CYCLE SUBMISSIONS, capPreview $derived, Roll d100, all four submit labels |
| `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts` | schedulerHealth, overdueNodes, processOverdue action | ✓ VERIFIED | All three in load return, processOverdue fetches /api/vs3/process-deadlines with auth token |
| `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` | SCHEDULER HEALTH card, OVERDUE NODES widget, Quick-Log modal | ✓ VERIFIED | Both widget labels present, stubs removed, quick-log modal with logSubmission form action |
| `vs3-panel/src/routes/(staff)/metrics/+page.server.ts` | load: submission_history, factions, nodes | ✓ VERIFIED | Minimal load with Promise.all, snapshot field included, catch fallbacks |
| `vs3-panel/src/routes/(staff)/metrics/+page.svelte` | SP Totals + Weekly Chart | ✓ VERIFIED | All four groupBy modes, chart colors, both empty states, JSON.parse(h.snapshot) |
| `vs3-panel/src/lib/components/AppSidebar.svelte` | Metrics nav link active | ✓ VERIFIED | BarChart3 icon, /metrics href, no "Coming in Phase 3" text |
| `vs3-panel/src/lib/components/ui/progress/index.ts` | shadcn Progress export | ✓ VERIFIED | Exists per migration 01 |
| `vs3-panel/src/lib/components/ui/switch/index.ts` | shadcn Switch export | ✓ VERIFIED | Exists per migration 01, imported in server-settings page |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scheduler.js` cronAdd | `deadline_config.last_processed_ts` | `cfg.getString → txApp.save(cfg)` inside runInTransaction | ✓ WIRED | Lines 117, 221-222 |
| `scheduler.js` processDeadlines | `submission_history` | `txApp.save(histRec)` inside transaction | ✓ WIRED | Lines 196-205 |
| `scheduler.js` | `job_run_log` | `writeJobRunLog()` helper | ✓ WIRED | Lines 55-64, called on lines 242-246 and 250-251 |
| `server-settings/+page.svelte` form | `?/saveDeadlineConfig` | `use:enhance` POST | ✓ WIRED | `action="?/saveDeadlineConfig"` present in svelte |
| `server-settings/+page.server.ts` saveDeadlineConfig | `deadline_config` collection | `pb.collection('deadline_config').update` | ✓ WIRED | Lines 83-86 |
| `nodes/[id]/+page.svelte` | `?/logSubmission` | `use:enhance` form POST | ✓ WIRED | showSubmissionModal form with `action="?/logSubmission"` |
| `nodes/[id]/+page.server.ts` logSubmission | `checkCaps` + `calcUpkeep` | Server-side cap enforcement | ✓ WIRED | Lines 433-443 |
| `nodes/[id]/+page.svelte` | `?/rollInstability` and `?/resolveEvent` | Hidden form auto-submit post roll | ✓ WIRED | rollInstability and resolveEvent found 22 times in svelte file |
| `dashboard/+page.server.ts` processOverdue | `POST /api/vs3/process-deadlines` | `fetch` with `Authorization: token` | ✓ WIRED | Lines 136-139 |
| `dashboard/+page.svelte` quick-log modal | `/nodes/{id}?/logSubmission` | Explicit action URL | ✓ WIRED | Line 373: `action="/nodes/{quickLogNodeId}?/logSubmission"` |
| `metrics/+page.svelte` Bar component | `chart.js Chart.register` | `svelte5-chartjs` import | ✓ WIRED | Line 3: `import { Bar } from 'svelte5-chartjs'`; line 8: `Chart.register(...)` |
| `metrics/+page.svelte` | `submission_history.snapshot` | `JSON.parse(h.snapshot)` client aggregation | ✓ WIRED | Line 50 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `dashboard/+page.svelte` SCHEDULER HEALTH | `data.schedulerHealth.lastRunIso` | `job_run_log.getList(1,1,{filter:'type="upkeep_deadline_processor"',sort:'-created'})` | Yes — queries real collection | ✓ FLOWING |
| `dashboard/+page.svelte` OVERDUE NODES | `data.overdueNodes` | `nodes.getFullList` + `submissions.getFullList` + `calcUpkeep()` — computed server-side | Yes — live SP sums against live effective upkeep | ✓ FLOWING |
| `nodes/[id]/+page.svelte` capPreview | `data.currentSubmissions` | `submissions.getFullList({filter:node="${id}"})` | Yes — fetches live submission records | ✓ FLOWING |
| `metrics/+page.svelte` totalsRows/chartData | `data.submissionHistory` | `submission_history.getFullList({fields:'...snapshot...'})` | Yes — queries real collection; JSON.parse client-side | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running PocketBase and browser — all code paths confirmed by static analysis above)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UPKEEP-01 | 03-02, 03-04 | calcUpkeep formula (ceil, overextension, war modifier) | ✓ SATISFIED | `scheduler.js` jsvm_calcUp lines 43-48 (1.1/1.2/1.35/1.5, 0.15/0.3/0.5); `nodes/[id]/+page.server.ts` imports `calcUpkeep` from `$lib/upkeep` |
| UPKEEP-02 | 03-02, 03-04 | Effective upkeep never stored, always computed at read time | ✓ SATISFIED | Scheduler recomputes per node in transaction; `+page.server.ts` load uses `calcUpkeep()`; dashboard uses `calcUpkeep()` — never written to DB |
| UPKEEP-03 | 03-04 | Staff can log upkeep submission from node detail | ✓ SATISFIED | `logSubmission` action handles `submission_type === 'upkeep'` with sp_catalogue lookup |
| UPKEEP-04 | 03-04 | 40% cap preview shown before commit | ✓ SATISFIED | `capPreview` $derived in `nodes/[id]/+page.svelte`; Progress bars in modal |
| UPKEEP-05 | 03-04 | Staff can remove individual submissions | ✓ SATISFIED | `removeSubmission` action; Remove button with confirmation dialog in svelte |
| UPKEEP-06 | 03-01, 03-03 | Configurable weekly deadline in server-settings | ✓ SATISFIED | `saveDeadlineConfig` action with head_admin gate; Deadline Configuration card |
| UPKEEP-07 | 03-02 | Deadline processing: payment%, instab delta, archive, roll_due, advance, log | ✓ SATISFIED | `processDeadlines()` implements all 8 steps; `submission_history` archive; `roll_due` flag; idempotency stamp |
| UPKEEP-08 | 03-02 | Idempotent deadline processing | ✓ SATISFIED | `last_processed_ts` gate inside `runInTransaction` — atomic; second run returns `already_processed` |
| UPKEEP-09 | 03-02 | Scheduler runs server-side independent of browser | ✓ SATISFIED | `cronAdd("upkeep_deadline_processor", "* * * * *", ...)` in PocketBase JSVM hooks |
| UPKEEP-10 | 03-02, 03-05 | Bulk-process overdue nodes in one action | ✓ SATISFIED | `routerAdd("POST", "/api/vs3/process-deadlines")` in scheduler; `processOverdue` action in dashboard |
| UPKEEP-11 | 03-05 | Dashboard shows "Last run: X ago" and 8-day alert | ✓ SATISFIED | SCHEDULER HEALTH card with `formatDistanceToNow`, `schedulerOverdue = daysSinceLastRun > 8`, `schedulerActive` check |
| INSTAB-01 | 03-02 | Instability levels 0-5 with labels and chance % | ✓ SATISFIED | `INSTAB_CHANCE` and `INSTAB_LABEL` exported from `instab_events.ts`; displayed in Instability Check section |
| INSTAB-02 | 03-04 | Staff can trigger d100 instability check when roll_due=true | ✓ SATISFIED | `data.node?.roll_due === true` conditional; `rollD100()` function; form posts to `?/rollInstability` |
| INSTAB-03 | 03-02, 03-04 | Events selected from node-type-specific pool matching v1 INSTAB_EVENTS | ✓ SATISFIED | `pickEvent(nodeType)` in `instab_events.ts` filters by canonical node type via NT_MAP |
| INSTAB-04 | 03-04 | Pending events show name/desc/effect and action buttons | ✓ SATISFIED | Event card rendered with name/desc/effect; resolve buttons for all 5 resolved_action values |
| INSTAB-05 | 03-04 | Staff can reduce instability by 1 (costs 40 SP) | ✓ SATISFIED | `instability_reduction` type: `INSTAB_REDUCTION_SP = 40`; `node.instability -= 1` side effect |
| INSTAB-06 | 03-01, 03-04 | Instability roll history logged per node | ✓ SATISFIED | `instability_rolls` collection in schema; `rollInstability` action creates record with roll/threshold/triggered |
| METRICS-01 | 03-06 | SP Totals broken down by category/item/faction/node | ✓ SATISFIED | `totalsRows` $derived in `metrics/+page.svelte` with all four groupBy modes |
| METRICS-02 | 03-05, 03-06 | Weekly SP owed vs paid bar chart per faction | ✓ SATISFIED | `chartData` $derived in `metrics/+page.svelte`; `Bar` from `svelte5-chartjs`; owed/paid datasets per faction per week |

**All 19 Phase 3 requirements from plans verified.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `dashboard/+page.svelte` | ~373 | Quick-log modal limits to `upkeep` and `instability_reduction` only (not repair/upgrade) | ℹ️ Info | Intentional per 03-05 SUMMARY deviation — repair/upgrade require node-detail context; server cap enforcement unchanged; documented in summary |
| `dashboard/+page.svelte` | ~61-73 | Quick-log cap preview uses single-submission projection, not cumulative cycle total | ℹ️ Info | Intentional per 03-05 SUMMARY deviation — server-side checkCaps in logSubmission remains authoritative; noted as limitation in modal |
| `dashboard/+page.server.ts` | 134 | `http://localhost:8090` hardcoded URL for processOverdue | ⚠️ Warning | Phase 3 accepted this pattern (matches existing export endpoint pattern); breaks if PocketBase runs on different port in production — mitigated by server-side only execution |

Neither info-level item prevents goal achievement. The hardcoded localhost URL is a deployment concern but matches existing patterns in the codebase and does not block phase functionality.

### Human Verification Required

#### 1. Instability Roll End-to-End Flow

**Test:** On /nodes/[id] for a node with instability >= 1 and roll_due=true, click "Roll d100". If triggered (roll <= INSTAB_CHANCE[level]), observe the event card with name/description/effect. Click one of the resolution action buttons.
**Expected:** Roll value displays in dice face, event card renders with correct node-type-specific event, action button submits resolveEvent form, node.roll_due becomes false, Instability Check section disappears on page refresh.
**Why human:** Two-step client flow (client roll → auto-form-submit) requires reactive runtime. The $state → $effect → form auto-submit chain cannot be confirmed statically.

#### 2. Scheduler Health Card Visual States

**Test:** Visit /dashboard with three separate scenarios: (a) deadline_config.is_active=false, (b) last job_run_log entry > 8 days old or absent, (c) recent successful run.
**Expected:** (a) muted disabled notice with /server-settings link; (b) red Scheduler alert banner with AlertTriangle; (c) "Last deadline run: X ago" with next deadline label.
**Why human:** Three-state conditional rendering depends on live DB state. Card visual correctness requires a browser with each scenario loaded.

#### 3. Quick-Log Modal Pre-fill and Dashboard Refresh

**Test:** From dashboard with at least one overdue node, click "Log Submission" on a row. Confirm modal opens with node name, faction, required SP, and current paid SP in the context header. Submit a valid upkeep submission.
**Expected:** Modal context header shows correct values, form posts to /nodes/{id}?/logSubmission, modal closes on success, dashboard overdueNodes list updates via invalidateAll().
**Why human:** quickLogNodeId/quickLogRequired/quickLogPaid reactive pre-fill requires live click event; invalidateAll() effect requires running SvelteKit.

#### 4. Deadline Configuration Save and Scheduler Pick-up

**Test:** As head_admin on /server-settings, change deadline day to a different day, save. Reload page and confirm new value shown. Wait for next cron tick (up to 60 seconds) and confirm job_run_log is not double-written.
**Expected:** deadline_config.day_of_week updated, scheduler reads new config on next tick, idempotency still works.
**Why human:** Requires live PocketBase with migration applied, admin credentials, and cron timing observation.

#### 5. Metrics Bar Chart Rendering

**Test:** Visit /metrics Weekly Chart tab with at least one submission_history record present.
**Expected:** Chart.js bar chart renders with gold owed bars (rgba(196,164,90,0.75)) and green paid bars (rgba(61,107,61,0.75)); legend shows faction names; axes have themed colors.
**Why human:** Chart.js canvas rendering requires a browser; visual color correctness cannot be verified statically.

---

## Summary

Phase 3 is functionally complete. All 19 must-have truths are VERIFIED at code level (exists, substantive, wired, data-flowing). The five human verification items are runtime/visual checks that cannot be confirmed programmatically — they do not indicate missing implementation, but require a live system to confirm the interactive flows work end-to-end.

**Notable findings:**
- Scheduler idempotency is correctly implemented: `last_processed_ts` is stamped inside `runInTransaction`, making the gate atomic with node writes
- The 40% cap is server-authoritative: `checkCaps()` recomputes `effectiveUpkeep` from live faction/war state at write time, never storing the value
- Quick-log modal deviation (upkeep/instability_reduction only, single-submission cap preview) is intentional and documented — server-side enforcement is unchanged
- `http://localhost:8090` is hardcoded in both `processOverdue` and `exportData` actions — consistent with existing codebase pattern but is a deployment concern for non-standard setups
- 77 INSTAB_EVENTS (not 75) because Military Node has 7 events in v1 — within the accepted 70-80 range

---

_Verified: 2026-05-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
