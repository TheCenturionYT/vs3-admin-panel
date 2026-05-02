# Phase 3: Upkeep Engine & Automation — Research

**Researched:** 2026-05-01
**Domain:** PocketBase JSVM scheduler, SvelteKit 5 form actions, Chart.js 4 (Svelte 5 wrapper), instability business logic port
**Confidence:** HIGH — all core technical claims verified against codebase, official PocketBase docs, or npm registry

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Scheduler path:** `cronAdd()` in `pb_hooks/scheduler.js` is already scaffolded. Runs server-side in PocketBase JSVM — never SvelteKit. Cron expression `"* * * * *"` (every minute); handler reads `deadline_config` and self-determines if deadline passed.

2. **Deadline configuration:** DB config table (`deadline_config`) with a card in the existing `/server-settings` page. Default: Saturday 23:59 UTC-5. Fields: `day_of_week`, `hour`, `minute`, `timezone_offset`, `is_active`. Single row, head_admin editable.

3. **T4 upgrade cost:** 500 SP (handbook §IX). Full table: T1→T2=60, T2→T3=140, T3→T4=500. Source: v1 for T1/T2, handbook for T4.

4. **INSTAB_EVENTS storage:** Hardcoded in `vs3-panel/src/lib/instab_events.ts`. NOT in a PocketBase table. Scheduler only sets `roll_due=true`; event selection and resolution happen in the UI.

5. **Submission logging UX:** Node detail page `/nodes/[id]` (primary) + quick-add modal from dashboard. No separate `/submissions/new` route.

### New Collections for Phase 3

- `submissions` — current cycle, staff create/read/delete
- `submission_history` — archived per deadline, scheduler-only write
- `deadline_config` — single row, head_admin write
- `instability_rolls` — roll log, staff create/read/update

### Claude's Discretion

None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)

- Player portal (Phase 4) — schema must not preclude future portal queries
- Chart.js library already in package.json — confirm import pattern (now resolved: see Standard Stack)
- Repair and upgrade actions are IN-SCOPE for Phase 3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPKEEP-01 | Effective upkeep calculated as `ceil(baseUpkeep × overextensionMul × (1 + warMul))` | calcUpkeep() already in upkeep.ts — needs to be called consistently from scheduler too |
| UPKEEP-02 | Calculation computed at read time, never stored, consistent across all surfaces | calcUpkeep() is pure function; scheduler must import same logic or inline equivalent JS |
| UPKEEP-03 | Staff can log upkeep submission against a node (item, qty, SP total, note) | SvelteKit form action on /nodes/[id]; sp_catalogue lookup already seeded |
| UPKEEP-04 | Cap preview shows impact BEFORE commit; blocks if Raw Renewable or Currency exceeds 40% | checkCaps() from v1 lines 423–430; derives from calcUpkeep at read time |
| UPKEEP-05 | Staff can remove individual submissions from current cycle | SvelteKit delete action on submissions collection |
| UPKEEP-06 | Configurable weekly deadline triggers automatic processing | deadline_config table + cronAdd() every-minute tick |
| UPKEEP-07 | Deadline processing: payment%, instability delta, archive, rollDue, advance deadline, log | procDeadlines() port to scheduler.js; 8-step logic from v1 lines 433–459 |
| UPKEEP-08 | Deadline processing is idempotent | Idempotency key = deadlineTimestamp + "|" + nodeId stored in deadline_config or job_run_log |
| UPKEEP-09 | Scheduler runs server-side independent of browser | cronAdd() in pb_hooks — confirmed architecture |
| UPKEEP-10 | Staff can bulk-process all overdue nodes in single action | Dashboard "Process All Overdue" button → SvelteKit action → PocketBase custom route or direct API call |
| UPKEEP-11 | Dashboard shows "Last deadline run: X ago" + 8-day alert | job_run_log table (exists from Phase 1 scaffold); dashboard load reads latest record |
| INSTAB-01 | Each node has instability 0–5 with labels and chance% | INSTAB_CHANCE and INSTAB_LABEL constants from v1; hardcode in instab_events.ts |
| INSTAB-02 | Staff triggers d100 instability check when roll_due=true | Client-side Math.random(); result POSTed to SvelteKit action; saved to instability_rolls |
| INSTAB-03 | Events auto-selected from node's type-specific pool (v1 INSTAB_EVENTS table) | 75 events, 15 node types — hardcode in instab_events.ts; pickEvent() filter by node type |
| INSTAB-04 | Pending event shows name, description, effect, action buttons | instability_rolls record + UI reads instab_events.ts for display; resolved=false drives visibility |
| INSTAB-05 | Manual instability reduction: costs 40 SP, logged as submission | submission_type="instability_reduction", sp_value=40 fixed; action updates node.instability -= 1 |
| INSTAB-06 | Instability roll history logged per node | instability_rolls collection; load on node detail page |
| METRICS-01 | SP totals by category, item, faction, node | Query submission_history.snapshot JSON + submissions; aggregate server-side in load function |
| METRICS-02 | Weekly SP owed vs paid bar chart per faction | Chart.js 4 via svelte5-chartjs; data from submission_history aggregated by deadline_ts week |
</phase_requirements>

---

## Summary

Phase 3 has no architectural unknowns — all key decisions are locked and the foundation is already built. The work divides cleanly into four concerns:

**1. PocketBase JSVM scheduler** (`pb_hooks/scheduler.js`): Replace the Phase 1 placeholder with the full `procDeadlines()` port. The scheduler runs every minute, reads `deadline_config`, computes whether the current deadline has passed, and processes all unprocessed nodes. Idempotency is enforced by a processed-key set. The existing JSVM patterns from `log_hooks.js` and `export_hooks.js` confirm the exact API shape needed (`$app.findRecordsByFilter`, `$app.save`, `$app.runInTransaction`).

**2. SvelteKit form actions** on `/nodes/[id]` and `/dashboard`: Submissions are standard SvelteKit server actions following the established Phase 2 pattern (zod schema, `fail()`, `use:enhance`). The cap check runs in the server action before saving. The instability roll is triggered client-side (`Math.random()`), then the result is POSTed as a form action.

**3. Chart.js integration**: `svelte-chartjs` is NOT installed (confirmed by checking `node_modules`). The correct package for Svelte 5 is `svelte5-chartjs@1.0.0` + `chart.js@4.5.1`. Needs `npm install`. Bar chart only needed for metrics page.

**4. Schema migration**: Four new collections (`submissions`, `submission_history`, `deadline_config`, `instability_rolls`) need PocketBase collection schema creation, either via admin UI or migration. The nodes collection already has `roll_due` and `instability` fields.

**Primary recommendation:** Port `procDeadlines()` first (it is the core automated behavior), then add submission CRUD, then the instability UI, then metrics. This order means the system is functional after each wave.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deadline processing (idempotent, scheduled) | PocketBase JSVM (server) | — | Race condition prevention; must survive browser closing |
| Upkeep calculation (calcUpkeep) | SvelteKit load (frontend server) | PocketBase JSVM (scheduler) | Both tiers need it; same pure function, duplicated in JSVM |
| Cap enforcement (checkCaps) | SvelteKit server action | — | Final authority before DB write; client preview is informational |
| Submission CRUD | SvelteKit server actions | — | Standard form action pattern |
| Instability roll (d100) | Browser (client-side) | SvelteKit action (save result) | Math.random() is intentionally client-side per UI-SPEC contract |
| Event selection (pickEvent) | Browser (client-side) | — | Reads hardcoded instab_events.ts; no server round-trip |
| Scheduler health monitoring | PocketBase (job_run_log writes) | SvelteKit load (reads) | Scheduler writes its own health; dashboard reads |
| Metrics aggregation | SvelteKit load (frontend server) | — | Query and aggregate submission_history at read time |
| Charts (bar chart) | Browser (client-side) | — | Chart.js renders in DOM; data arrives from server load |
| Deadline config (read/write) | SvelteKit server actions | PocketBase collection rules | head_admin rule enforced at collection level too |

---

## Standard Stack

### Core (already installed — no new installs except charts)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PocketBase JSVM | 0.22.x | Server-side scheduler, hooks, DAO | Locked by project; `$app.findRecordsByFilter`, `$app.save`, `$app.runInTransaction` confirmed |
| SvelteKit 2 | 2.57.0 | Form actions, load functions, invalidation | Locked; established in Phases 1 & 2 |
| Svelte 5 | 5.55.2 | `$derived` for live SP/cap preview, `$state` | Locked; runes pattern confirmed in existing pages |
| shadcn-svelte | 1.2.7 | UI components | Locked; existing components installed |
| zod | 3.24.1 | Form validation in server actions | Established pattern from Phases 1 & 2 |
| date-fns | 4.1.0 | Date formatting (submission timestamps, deadline display) | Already installed; use for `formatDistanceToNow`, `format` |

### New (must install)

| Library | Version | Purpose | Install Command |
|---------|---------|---------|----------------|
| svelte5-chartjs | 1.0.0 | Chart.js wrapper for Svelte 5 | `npm install svelte5-chartjs chart.js` |
| chart.js | 4.5.1 | Bar chart for metrics weekly view | (installed with above) |

[VERIFIED: npm registry — `npm view svelte5-chartjs version` returned `1.0.0`, `npm view chart.js version` returned `4.5.1`]

### New shadcn-svelte components (must install)

Per 03-UI-SPEC.md, these components are needed but not yet installed:

```bash
npx shadcn-svelte@latest add progress switch
```

[VERIFIED: `ls vs3-panel/src/lib/components/ui` confirmed `progress` and `switch` directories are absent]

`progress` — cap preview percentage bars in submission form
`switch` — scheduler active toggle in deadline config card

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| svelte5-chartjs | Plain Chart.js with `onMount` | More boilerplate; svelte5-chartjs handles reactivity and cleanup |
| svelte5-chartjs | svelte-chartjs v3 | Svelte 4 wrapper — will not work with Svelte 5 runes mode |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                    SvelteKit (SSR)              PocketBase JSVM
   |                           |                              |
   |  GET /nodes/[id]          |                              |
   |-------------------------->|                              |
   |                           | findRecordsByFilter          |
   |                           | (submissions, history,       |
   |                           |  owner nodes, wars)          |
   |                           |----------------------------->|
   |                           |<--  node + submissions + ... |
   |<-- HTML (submissions,     |                              |
   |    cap preview, instab    |                              |
   |    roll section)          |                              |
   |                           |                              |
   |  [qty change] → $derived  |                              |
   |  SP total + cap bars      |                              |
   |  update instantly         |                              |
   |  (no server round-trip)   |                              |
   |                           |                              |
   |  POST ?/logSubmission     |                              |
   |-------------------------->|                              |
   |                           | checkCaps() server-side      |
   |                           | $app.save(submissions)       |
   |                           |----------------------------->|
   |                           |<-- ok / cap error            |
   |<-- invalidate() →         |                              |
   |   re-fetch + re-render    |                              |
   |                           |                              |
   |  POST ?/rollInstability   |                              |
   |  {roll: 47, nodeId: ...}  |                              |
   |-------------------------->|                              |
   |                           | save(instability_rolls)      |
   |                           | update node.roll_due=false   |
   |                           |----------------------------->|
   |<-- invalidate()           |                              |
   |                           |                              |
   |                           |                              |
   |                           |           cronAdd() (every minute)
   |                           |         <------------------  |
   |                           |              reads deadline_config
   |                           |              checks idempotency key
   |                           |              for each overdue node:
   |                           |                calcUpkeep()
   |                           |                apply instab delta
   |                           |                archive submissions
   |                           |                set roll_due=true
   |                           |                advance deadline
   |                           |                write job_run_log
   |                           |         -------------------> |
```

### Recommended Project Structure (Phase 3 additions only)

```
pb_hooks/
├── scheduler.js           # Replace placeholder with full procDeadlines() impl
vs3-panel/src/
├── lib/
│   ├── upkeep.ts          # EXISTING — calcUpkeep(), no changes needed
│   ├── instab_events.ts   # NEW — INSTAB_EVENTS[], INSTAB_CHANCE[], INSTAB_LABEL[], pickEvent()
│   └── utils.ts           # EXISTING — add formatTimeAgo() helper if not present
├── routes/(staff)/
│   ├── nodes/[id]/
│   │   └── +page.server.ts  # ADD actions: logSubmission, removeSubmission, rollInstability,
│   │                        #              resolveEvent, reduceInstability, logRepair, logUpgrade
│   ├── dashboard/
│   │   └── +page.server.ts  # ADD: load submissions/job_run_log; ADD actions: processOverdue
│   ├── server-settings/
│   │   └── +page.server.ts  # ADD actions: saveDeadlineConfig; load deadline_config
│   └── metrics/
│       ├── +page.server.ts  # NEW — aggregate submission_history for tables + chart data
│       └── +page.svelte     # NEW — SP Totals tab + Weekly Chart tab
```

### Pattern 1: calcUpkeep() in the JSVM Scheduler

The `calcUpkeep()` function is already in TypeScript (`vs3-panel/src/lib/upkeep.ts`). The PocketBase JSVM is a JavaScript runtime — it cannot import TypeScript files. The scheduler must inline or duplicate the equivalent pure JS.

**What:** Define the three-function upkeep calc directly in `scheduler.js`.
**When to use:** Only inside `scheduler.js`. Never import from SvelteKit.

```javascript
// Source: upkeep.ts ported to JSVM-compatible JS
function jsvm_oemul(n) { return n <= 1 ? 1 : n === 2 ? 1.1 : n === 3 ? 1.2 : n === 4 ? 1.35 : 1.5; }
function jsvm_wmul(w, type) { if (type === 'PvE') return 0; return w === 0 ? 0 : w === 1 ? 0.15 : w === 2 ? 0.3 : 0.5; }
function jsvm_calcUp(baseUpkeep, nodeCount, warCount, factionType, isNeutral) {
    if (isNeutral || !baseUpkeep) return baseUpkeep;
    return Math.ceil(baseUpkeep * jsvm_oemul(nodeCount) * (1 + jsvm_wmul(warCount, factionType)));
}
```

[VERIFIED: upkeep.ts lines 1–56 confirmed; JSVM is plain JS, no TypeScript]

### Pattern 2: procDeadlines() in JSVM — Full 8-Step Logic

**What:** The scheduler reads `deadline_config`, computes the current deadline occurrence, then processes all unprocessed overdue nodes.
**When:** Every minute tick; only executes if `now > current_deadline_ts` AND idempotency key not already recorded.

```javascript
// Source: v1 lines 433–459 adapted for PocketBase JSVM API
cronAdd("upkeep_deadline_processor", "* * * * *", function () {
    try {
        // 1. Read deadline_config (single row)
        const configs = $app.findRecordsByFilter("deadline_config", "", "", 1, 0);
        if (!configs || configs.length === 0) return;
        const cfg = configs[0];
        if (!cfg.getBool("is_active")) return;

        // 2. Compute current deadline timestamp from config fields
        const deadlineTs = computeCurrentDeadline(cfg); // pure date math
        const now = new Date();
        if (now <= new Date(deadlineTs)) return; // not yet due

        // 3. Check idempotency at the config level
        const lastProcessed = cfg.getString("last_processed_key");
        if (lastProcessed === deadlineTs) return; // already ran this cycle

        // 4. Fetch all owned (non-Neutral) nodes
        const neutralFaction = $app.findFirstRecordByData("factions", "name", "Neutral Territory");
        const nodes = $app.findRecordsByFilter(
            "nodes",
            `owner != "" && owner != "${neutralFaction.getId()}"`,
            "", 0, 0
        );

        $app.runInTransaction((txApp) => {
            for (const node of nodes) {
                const nodeId = node.getId();
                const nodeKey = deadlineTs + "|" + nodeId;

                // Per-node idempotency check against job_run_log or a processed_keys field
                // (see pitfalls section for implementation detail)

                // Step 2: Calculate payment %
                const ownerId = node.getString("owner");
                const ownerFaction = txApp.findRecordById("factions", ownerId);
                const ownerNodes = txApp.findRecordsByFilter("nodes", `owner = "${ownerId}"`, "", 0, 0);
                const ownerWars = txApp.findRecordsByFilter(
                    "wars",
                    `(faction_a = "${ownerId}" || faction_b = "${ownerId}") && status = "active"`,
                    "", 0, 0
                );
                const baseUpkeep = node.getInt("base_upkeep");
                const factionType = ownerFaction.getString("type");
                const isNeutral = false;
                const req = jsvm_calcUp(baseUpkeep, ownerNodes.length, ownerWars.length, factionType, isNeutral);

                const submissions = txApp.findRecordsByFilter(
                    "submissions", `node = "${nodeId}"`, "", 0, 0
                );
                const paid = submissions.reduce((s, sub) => s + sub.getInt("sp_value"), 0);
                const pct = req > 0 ? paid / req * 100 : 100;

                // Step 3: Apply instability delta
                let instabDelta = 0;
                if (pct >= 100) instabDelta = 0;
                else if (pct >= 50) instabDelta = 1;
                else instabDelta = 2; // covers pct > 0 AND pct == 0

                const currentInstab = node.getInt("instability");
                const newInstab = Math.min(5, currentInstab + instabDelta);

                // Step 4-8: Archive, set rollDue, advance deadline, log
                // ... (see full implementation plan)
            }

            // Stamp idempotency key
            cfg.set("last_processed_key", deadlineTs);
            txApp.save(cfg);
        });

        writeJobRunLog("upkeep_deadline_processor", "completed", nodes.length + " nodes processed");
    } catch (err) {
        console.error("[scheduler] procDeadlines failed:", err);
        writeJobRunLog("upkeep_deadline_processor", "error", String(err));
    }
});
```

[VERIFIED: PocketBase JSVM API — `$app.findRecordsByFilter`, `$app.runInTransaction`, `$app.findRecordById`, `$app.save` confirmed from official docs at pocketbase.io/docs/js-records/]
[VERIFIED: v1 procDeadlines() logic at lines 433–459 of VS3_Panel_1_2_1.html]

### Pattern 3: checkCaps() as a SvelteKit Server Action

**What:** Before saving a submission, compute the cap impact including the new item.
**When:** Any `logSubmission` action where `submission_type === "upkeep"`.

```typescript
// Source: v1 lines 423–430
function checkCaps(
  existingSubmissions: { category: string; sp_value: number }[],
  newCategory: string,
  newSpValue: number,
  effectiveUpkeep: number
): { ok: boolean; rrPct: number; cPct: number; rrSP: number; cSP: number } {
  if (!effectiveUpkeep) return { ok: true, rrPct: 0, cPct: 0, rrSP: 0, cSP: 0 };
  const all = [...existingSubmissions, { category: newCategory, sp_value: newSpValue }];
  const rrSP = all.filter(s => s.category === 'Raw Renewable').reduce((sum, s) => sum + s.sp_value, 0);
  const cSP  = all.filter(s => s.category === 'Currency').reduce((sum, s) => sum + s.sp_value, 0);
  return {
    ok: rrSP / effectiveUpkeep * 100 <= 40 && cSP / effectiveUpkeep * 100 <= 40,
    rrPct: Math.round(rrSP / effectiveUpkeep * 100),
    cPct:  Math.round(cSP / effectiveUpkeep * 100),
    rrSP,
    cSP
  };
}
```

Cap applies ONLY to `submission_type === "upkeep"`. Repair, upgrade, instability_reduction submissions bypass the cap check entirely.
[VERIFIED: v1 checkCaps() lines 423–430; CLAUDE.md 40% Category Caps section]

### Pattern 4: computeCurrentDeadline() — Timezone-Aware Date Math

**What:** Given `deadline_config` fields (day_of_week, hour, minute, timezone_offset), compute the ISO timestamp of the most recent deadline occurrence.

```javascript
// Pure JS — works in both JSVM and SvelteKit
function computeCurrentDeadline(dayOfWeek, hour, minute, tzOffsetHours) {
    // Work in UTC: deadline in local time is (hour - tzOffsetHours) in UTC
    const utcHour = ((hour - tzOffsetHours) + 24) % 24;
    const now = new Date();
    // Find the most recent past occurrence of dayOfWeek at utcHour:minute
    let dl = new Date(now);
    dl.setUTCHours(utcHour, minute, 59, 999);
    // Roll back to the target day of week
    const dayDiff = (dl.getUTCDay() - dayOfWeek + 7) % 7;
    dl.setUTCDate(dl.getUTCDate() - dayDiff);
    // If that would be in the future, go back 7 days
    if (dl > now) dl.setUTCDate(dl.getUTCDate() - 7);
    return dl.toISOString();
}
```

[ASSUMED — this logic is derived from v1 `getNextDeadline()` (v1 lines 377–383) adapted for server-side UTC computation. The exact math should be validated against the v1 behavior before finalizing.]

### Pattern 5: svelte5-chartjs Bar Chart (Metrics Page)

```svelte
<!-- Source: github.com/LupusAI/svelte5-chartjs README -->
<script lang="ts">
  import { Bar } from 'svelte5-chartjs';
  import {
    Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend
  } from 'chart.js';

  Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  // data prop from +page.server.ts load
  let { chartData } = $props();
</script>

<div style="min-height: 280px; position: relative;">
  <Bar
    data={chartData}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#d4c5a0' } },
        tooltip: { /* ... */ }
      },
      scales: {
        x: { ticks: { color: '#8b7d65' }, grid: { color: '#3d3426' } },
        y: { ticks: { color: '#8b7d65' }, grid: { color: '#3d3426' } }
      }
    }}
  />
</div>
```

[VERIFIED: svelte5-chartjs v1.0.0 confirmed on npm registry; chart.js 4.5.1 confirmed. Tree-shaking requires explicit Chart.register() calls.]

### Pattern 6: SvelteKit `invalidate` After Submission

After any submission action, use `invalidate` (not `goto`) so the page re-fetches load data without a full navigation. This updates cap preview, cycle totals, and instability roll section.

```typescript
// In +page.svelte — after successful form submission
import { invalidateAll } from '$app/navigation';
// inside enhance callback:
await invalidateAll();
```

[VERIFIED: SvelteKit 2 API — established in Phase 2 pages]

### Anti-Patterns to Avoid

- **Storing effectiveUpkeep in the database:** CLAUDE.md explicitly forbids this. Always recalculate from live faction/node/war state.
- **Importing upkeep.ts in scheduler.js:** JSVM is plain JS. Inline the equivalent pure functions.
- **Running deadline processing in a SvelteKit action:** The "Process All Overdue" dashboard button should call the same logic that the scheduler uses, but executed inside a PocketBase JSVM custom route (`routerAdd`) rather than in SvelteKit, to maintain single-writer pattern.
- **Using `$app` inside `runInTransaction` (use `txApp` argument instead):** Official docs state: "always use its `txApp` argument and not the original `$app` instance."
- **Applying instability to Neutral Territory nodes:** v1 line 436 skips nodes with no owner or owner === NEUTRAL_ID. Same check needed in scheduler.
- **Double-counting instability on partial payment:** Delta is either +0, +1, or +2 — never cumulative within a single deadline run. The `pct >= 50` check must be before `pct > 0`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart bar rendering | Custom SVG/canvas chart | svelte5-chartjs + chart.js | Tooltip, legend, responsive, theme support all built-in |
| Form validation | Custom validators | zod (already installed) | Established Phase 2 pattern; type inference |
| Date formatting ("3 days ago") | Custom time-since function | date-fns `formatDistanceToNow` (already installed) | Handles edge cases, locale-aware |
| Progress bar | Custom CSS div | shadcn `progress` component | Accessible, consistent with design system |
| Cron scheduling | setInterval in SvelteKit | PocketBase `cronAdd()` | Server-side, survives browser close, process restart safe |
| Submission cap math | Custom per-action re-implementation | `checkCaps()` function (single shared utility) | Same logic needed in both server action and client preview |

**Key insight:** The hardest part of this phase is the scheduler's date math and idempotency key management — not the UI. Use transactions and per-node idempotency keys to make restart-safe.

---

## Common Pitfalls

### Pitfall 1: JSVM calcUpkeep Drift

**What goes wrong:** The TypeScript `calcUpkeep()` in `upkeep.ts` and the inlined JS version in `scheduler.js` diverge over time. A bug fix is made to `upkeep.ts` but `scheduler.js` is not updated. Instability is applied differently in the UI vs the scheduler.

**Why it happens:** Two code locations, no shared import, easy to forget the second.

**How to avoid:** Add a comment in both files cross-referencing the other. Include a test that compares results from both implementations with the same inputs. Keep the JSVM version as a verbatim copy with no clever abstractions.

**Warning signs:** UI shows "Fully Paid" but scheduler applied instability delta +1.

### Pitfall 2: Timezone Off-by-One in Deadline Computation

**What goes wrong:** Deadline triggers one week early or one week late due to wrong UTC conversion.

**Why it happens:** `timezone_offset=-5` means Saturday 23:59 EST = Sunday 04:59 UTC. If the UTC day rolls over to Sunday during this window, the day-of-week comparison breaks.

**How to avoid:** Always work in UTC in the scheduler. Compute the UTC equivalent of the local deadline time first, then find the correct day-of-week in UTC. Test the edge case where local Saturday 23:59 EST is UTC Sunday 04:59.

**Warning signs:** Deadline runs on Sunday instead of Saturday (for EST).

### Pitfall 3: runInTransaction Without txApp

**What goes wrong:** Using `$app.save()` inside a `$app.runInTransaction()` callback instead of `txApp.save()`. The save call bypasses the transaction and commits immediately, making the transaction non-atomic.

**Why it happens:** It appears to work in testing (single user), fails under concurrent writes.

**How to avoid:** Always use `txApp` inside transaction callbacks. The official PocketBase doc states: "Inside the transaction function always use its `txApp` argument and not the original `$app` instance."

**Warning signs:** Partial deadline runs persisted even when the transaction handler threw an error.

### Pitfall 4: Instability Applied to Neutral Territory

**What goes wrong:** Neutral Territory nodes receive instability deltas during deadline processing.

**Why it happens:** The scheduler iterates all nodes without filtering, or the owner check is against the wrong field.

**How to avoid:** Port v1 line 436 verbatim: skip nodes where `!ownerId || ownerId === NEUTRAL_ID`. Fetch the Neutral Territory faction's ID at the start of each scheduler run.

**Warning signs:** Neutral Territory nodes showing instability > 0 in node list.

### Pitfall 5: Cap Check Bypassed by Special Submission Types

**What goes wrong:** Repair, upgrade, or instability_reduction submissions are accidentally rejected by the 40% cap check.

**Why it happens:** The cap check is applied to all submissions without checking `submission_type`.

**How to avoid:** Cap check runs ONLY when `submission_type === "upkeep"`. The server action must branch before calling `checkCaps()`.

**Warning signs:** Staff cannot log a T2 Repair because the node's Raw Renewable cap is already at 35%.

### Pitfall 6: Metrics Query on submission_history.snapshot JSON

**What goes wrong:** The `snapshot` field in `submission_history` is a JSON string (array). Trying to filter or aggregate at the SQL level will fail.

**Why it happens:** PocketBase stores JSON fields as text; no native JSON query support in filter expressions.

**How to avoid:** Load all relevant `submission_history` records in the SvelteKit load function, then parse and aggregate in TypeScript — not in the PocketBase filter. For large datasets this is fine (admin tool, small player count).

**Warning signs:** PocketBase filter error referencing `snapshot->category` or similar JSON path syntax.

### Pitfall 7: svelte-chartjs vs svelte5-chartjs

**What goes wrong:** Installing `svelte-chartjs` (Svelte 4 wrapper) instead of `svelte5-chartjs`. The component either silently fails or produces hydration errors with Svelte 5 runes mode.

**Why it happens:** `svelte-chartjs` is the more well-known package name. Web search results favor it.

**How to avoid:** Install `svelte5-chartjs@1.0.0 chart.js@4.5.1`. The package is purpose-built for Svelte 5.

---

## Code Examples

### Creating a submission_history archive record (JSVM)

```javascript
// Source: CONTEXT.md schema spec + PocketBase JSVM docs
const histCol = txApp.findCollectionByNameOrId("submission_history");
const histRecord = new Record(histCol);
histRecord.set("node", nodeId);
histRecord.set("deadline_ts", deadlineTs);
histRecord.set("paid_sp", paid);
histRecord.set("required_sp", req);
histRecord.set("outcome", outcome);         // "paid" | "partial" | "underfunded" | "unpaid"
histRecord.set("instab_delta", instabDelta);
histRecord.set("snapshot", JSON.stringify(snapshotItems)); // array of {item_name, category, qty, sp_value}
txApp.save(histRecord);
```

### Loading current-cycle submissions for cap preview (SvelteKit)

```typescript
// In +page.server.ts load function
const currentSubmissions = await locals.pb.collection('submissions').getFullList({
  filter: `node = "${params.id}"`,
  fields: 'id,item_name,category,qty,sp_value,submission_type,staff_note'
});

// Calculate effective upkeep at read time
const effectiveUpkeep = calcUpkeep(
  node.base_upkeep,
  ownerNodes.length,
  ownerWarCount,
  ownerFaction?.type ?? 'PvE',
  !node.ownerId || node.ownerId === NEUTRAL_FACTION_ID
);

return { node, currentSubmissions, effectiveUpkeep, ... };
```

### Svelte 5 rune-based live SP preview

```svelte
<script lang="ts">
  let { node, currentSubmissions, effectiveUpkeep, spCatalogue } = $props();

  let selectedItemId = $state('');
  let qty = $state(1);

  const selectedItem = $derived(spCatalogue.find(i => i.id === selectedItemId));
  const newSpValue   = $derived(selectedItem ? selectedItem.sp_value * qty : 0);

  // Cap preview including the pending new submission
  const capPreview = $derived(() => {
    if (!selectedItem) return null;
    const all = [
      ...currentSubmissions,
      { category: selectedItem.category, sp_value: newSpValue }
    ];
    const rrSP = all.filter(s => s.category === 'Raw Renewable').reduce((sum, s) => sum + s.sp_value, 0);
    const cSP  = all.filter(s => s.category === 'Currency').reduce((sum, s) => sum + s.sp_value, 0);
    const cap  = effectiveUpkeep * 0.40;
    return { rrSP, cSP, cap, rrPct: rrSP / effectiveUpkeep * 100, cPct: cSP / effectiveUpkeep * 100 };
  });
</script>
```

### Reading job_run_log for dashboard health card

```typescript
// +page.server.ts load
const latestRun = await locals.pb.collection('job_run_log').getList(1, 1, {
  filter: 'type = "upkeep_deadline_processor"',
  sort: '-created'
}).catch(() => ({ items: [] }));

const lastRunAt = latestRun.items[0]?.created ?? null;
const lastRunAgo = lastRunAt ? formatDistanceToNow(new Date(lastRunAt), { addSuffix: true }) : 'Never';
const isOverdue = lastRunAt
  ? differenceInDays(new Date(), new Date(lastRunAt)) > 8
  : true;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `svelte-chartjs` (Svelte 4 wrapper) | `svelte5-chartjs` (Svelte 5 native) | v1.0.0 released May 2025 | Must use svelte5-chartjs; old package breaks with runes |
| `$app.dao().saveRecord()` | `$app.save()` (PocketBase 0.22+) | PocketBase 0.22 | log_hooks.js uses old API; scheduler should use new `$app.save()` |
| `$app.dao().findRecordsByFilter()` | `$app.findRecordsByFilter()` | PocketBase 0.22 | Both work in 0.22; prefer new top-level API going forward |

**Note on PocketBase API migration:** The existing `log_hooks.js` uses `$app.dao().saveRecord()` (old API). This still works in PocketBase 0.22.x but the new API is `$app.save(record)`. The scheduler should use the modern API. Both are valid in 0.22.

[VERIFIED: export_hooks.js uses `$app.dao()` pattern and works in production; pocketbase.io/docs/js-records confirmed `$app.save()` is the current API]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `computeCurrentDeadline()` timezone logic correctly converts local deadline to UTC day-of-week | Architecture Patterns — Pattern 4 | Deadline fires on wrong day/week; instability applied at wrong time |
| A2 | `job_run_log` collection exists from Phase 1 scaffold (scheduler.js comments reference it) | Code Examples | Need to create the collection in Wave 0 if it doesn't exist |
| A3 | PocketBase `runInTransaction` with `txApp` commits atomically across multiple `$app.save()` calls for different collections | Architecture Patterns — Pattern 2 | Partial deadline runs could persist on error |

**Verification action for A2:** Check `pb_data/data.db` schema or PocketBase admin UI to confirm `job_run_log` collection fields before writing to it in the scheduler.

---

## Open Questions

1. **Does `job_run_log` collection exist?**
   - What we know: `scheduler.js` comments reference it (`{ type, startedAt, completedAt, status, details }`). No migration file found.
   - What's unclear: Was it created manually via PocketBase admin UI in Phase 1 or Phase 2?
   - Recommendation: Wave 0 task must verify existence and field names. If absent, create it before implementing the scheduler body.

2. **Idempotency key storage: `deadline_config.last_processed_key` vs separate `processed_deadline_keys` table**
   - What we know: v1 used an array `DB.processedDeadlines` (capped at 200 entries). CONTEXT.md mentions "record processed key in deadline_config.last_processed_ts or job_run_log."
   - What's unclear: The `deadline_config` schema in CONTEXT.md does not include a `last_processed_key` field, only `is_active`.
   - Recommendation: Add `last_processed_ts` (date/datetime) to the `deadline_config` schema. The idempotency check is: `last_processed_ts === computed_deadline_ts`. This is simpler than a separate table and handles the weekly cycle (only one deadline per week to track).

3. **`"Process All Overdue"` button architecture: SvelteKit action vs PocketBase custom route**
   - What we know: UPKEEP-10 requires bulk processing. The scheduler does the same work.
   - What's unclear: Should the SvelteKit action call a PocketBase `routerAdd` endpoint (same code path as scheduler), or replicate the logic in a SvelteKit server action?
   - Recommendation: Expose a `POST /api/vs3/process-deadlines` custom route in `pb_hooks/scheduler.js` using `routerAdd`. The SvelteKit action calls this endpoint (same pattern as the export endpoint). This avoids duplicating the deadline processing logic across the TypeScript/JavaScript boundary.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | svelte5-chartjs install | ✓ | (project running) | — |
| PocketBase JSVM | scheduler.js cronAdd() | ✓ | 0.22.x | — |
| svelte5-chartjs | Metrics chart | ✗ | — | Install: `npm install svelte5-chartjs chart.js` |
| chart.js | Metrics chart | ✗ | — | Install with above |
| shadcn `progress` component | Cap preview bars | ✗ | — | Install: `npx shadcn-svelte@latest add progress` |
| shadcn `switch` component | Deadline config active toggle | ✗ | — | Install: `npx shadcn-svelte@latest add switch` |

[VERIFIED: `node_modules/svelte-chartjs` and `node_modules/chart.js` confirmed absent. `src/lib/components/ui/progress` and `ui/switch` confirmed absent.]

**Missing dependencies with no fallback:**
- None — all missing items have known install commands.

**Missing dependencies with fallback:**
- svelte5-chartjs / chart.js — metrics chart won't render without it; must install before Wave N that implements `/metrics`.
- progress / switch — shadcn components won't exist; must install before Wave N that implements the submission form and deadline config card.

---

## Security Domain

The project uses `security_enforcement` implicitly (not explicitly false in config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 1 handled) | PocketBase auth — already enforced |
| V3 Session Management | No (Phase 1 handled) | PocketBase tokens — already enforced |
| V4 Access Control | Yes | `head_admin` gate on deadline_config write; collection rules |
| V5 Input Validation | Yes | zod on all form actions; PocketBase field type validation |
| V6 Cryptography | No | No new crypto in this phase |

### Known Threat Patterns for Phase 3 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Staff logging submissions for nodes they shouldn't access | Tampering | PocketBase collection rules: STAFF can create submissions; no per-faction restriction needed (staff are trusted) |
| Head-admin-only deadline config write bypassed via direct API | Elevation of Privilege | PocketBase collection rule: `@request.auth.role = "head_admin"` on deadline_config update |
| Scheduler double-run on crash injects +2 instability twice | Tampering | Idempotency key (last_processed_ts) checked before processing each deadline |
| Client-side roll value manipulation (player sends roll=1 always) | Tampering | Roll is generated server-side or at minimum validated: `1 <= roll <= 100` check in SvelteKit action |
| Metrics page exposes submission data across factions | Information Disclosure | Metrics is staff-only route; collection rules already restrict member access |

**Roll value validation note:** The UI-SPEC says roll is generated client-side (`Math.floor(Math.random() * 100) + 1`). The server action must validate the submitted roll is an integer 1–100. A malicious staff member could submit roll=1 always to force events, but this is a high-trust team and the action is logged in `instability_rolls` — the roll value is visible in history.

---

## Sources

### Primary (HIGH confidence)
- `Admin Panel/VS3_Panel_1_2_1.html` lines 233–460 — INSTAB_EVENTS, INSTAB_CHANCE, checkCaps(), procDeadlines(), calcUp(), pickEvent() (directly read in this session)
- `vs3-panel/src/lib/upkeep.ts` — calcUpkeep() already ported (directly read)
- `pb_hooks/scheduler.js`, `log_hooks.js`, `export_hooks.js` — JSVM API patterns in use (directly read)
- `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` — established load/action patterns (directly read)
- pocketbase.io/docs/js-records/ — `$app.findRecordsByFilter`, `$app.save`, `$app.runInTransaction`, `txApp` contract
- pocketbase.io/jsvm/functions/cronAdd.html — `cronAdd(jobId, cronExpr, handler)` signature

### Secondary (MEDIUM confidence)
- npm registry — svelte5-chartjs@1.0.0, chart.js@4.5.1 version verification (npm view command, directly run)
- github.com/LupusAI/svelte5-chartjs — Svelte 5 wrapper usage pattern, tree-shaking requirement

### Tertiary (LOW confidence)
- `computeCurrentDeadline()` timezone logic (A1) — derived from v1 `getNextDeadline()`, not independently tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry or node_modules
- Scheduler JSVM patterns: HIGH — confirmed from official PocketBase docs and existing hooks code
- Architecture: HIGH — all locked decisions from CONTEXT.md, no alternatives explored
- Chart.js integration: HIGH — npm verified; Svelte 5 wrapper confirmed
- Deadline timezone math: MEDIUM — logic derived from v1 but not independently validated

**Research date:** 2026-05-01
**Valid until:** 2026-07-01 (PocketBase 0.22.x stable; chart.js 4.x stable)

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are actionable constraints the planner must verify:

1. **Business logic from v1.2.1 only** — `procDeadlines()`, `checkCaps()`, `INSTAB_EVENTS`, `pickEvent()` must be ported from `VS3_Panel_1_2_1.html`, not re-derived from handbook prose.
2. **Deadline processor is server-side only** — never in SvelteKit; race condition risk with multiple staff.
3. **Deadline processor is idempotent** — processed key (nodeId + deadlineTimestamp) prevents double-apply.
4. **Effective upkeep never stored** — always calculated at read time from live faction/war state.
5. **Scheduler failure must be visible** — `job_run_log` + "Last Run: X ago" + 8-day alert are non-negotiable.
6. **Head Admin gated at route AND collection rule level** — deadline_config write requires both.
7. **Faction privacy at query level** — not relevant in this phase (submissions are staff-only); portal phase handles it.
8. **Repair costs: §VIII values** — T1=50, T2=100, T3=200, T4=300 (not §IX).
9. **T4 upgrade cost: 500 SP** — locked decision from CONTEXT.md §3.
10. **Visual identity: dark gold medieval** — all new UI must match existing color tokens in `app.css`.
