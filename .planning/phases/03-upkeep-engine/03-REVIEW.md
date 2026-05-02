---
phase: 03-upkeep-engine
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - pb_hooks/scheduler.js
  - pb_migrations/1746230400_phase3_schema.js
  - vs3-panel/src/lib/components/AppSidebar.svelte
  - vs3-panel/src/lib/components/ui/progress/index.ts
  - vs3-panel/src/lib/components/ui/progress/progress.svelte
  - vs3-panel/src/lib/components/ui/switch/index.ts
  - vs3-panel/src/lib/components/ui/switch/switch.svelte
  - vs3-panel/src/lib/instab_events.ts
  - vs3-panel/src/routes/(staff)/dashboard/+page.server.ts
  - vs3-panel/src/routes/(staff)/dashboard/+page.svelte
  - vs3-panel/src/routes/(staff)/metrics/+page.server.ts
  - vs3-panel/src/routes/(staff)/metrics/+page.svelte
  - vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts
  - vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte
  - vs3-panel/src/routes/(staff)/server-settings/+page.server.ts
  - vs3-panel/src/routes/(staff)/server-settings/+page.svelte
  - vs3-panel/package.json
findings:
  critical: 5
  warning: 7
  info: 3
  total: 15
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 3 implements the upkeep engine: server-side scheduler, SP submission logging, 40% cap
enforcement, instability delta processing, instability roll flow, metrics page, deadline config,
and data export/import. The core scheduler logic, upkeep formula, and cap enforcement are
structurally sound. However, five blockers were found — ranging from a data-loss race condition
in the scheduler, an authorization bypass on the `processOverdue` endpoint, a destructive import
operation that is unguarded at the collection-rule level, a cap-preview bug in the dashboard
quick-log modal that can produce false "cap exceeded" warnings, and a migration rollback that
deletes `job_run_log` even when it was created by a prior phase. Seven warnings cover idempotency
gaps, missing roll authorization, incorrect instability-reduction semantics, and a
`computeCurrentDeadline` edge case. Three info items cover dead code and labelling.

---

## Critical Issues

### CR-01: `processOverdue` endpoint accepts any authenticated user — no staff/head_admin role check

**File:** `pb_hooks/scheduler.js:259`

**Issue:** The `/api/vs3/process-deadlines` route is protected only by `$apis.requireAuth()`, which
accepts _any_ authenticated PocketBase session — including `members` collection records (player
portal accounts). A logged-in player can POST to this endpoint and trigger deadline processing
(including instability escalation against their own node) outside the normal cycle. While the
idempotency gate limits damage within a single cycle, it cannot prevent a player from triggering
the processor prematurely at the start of a new cycle (before staff intends to run it). This
bypasses the "staff-gated destructive ops" rule in CLAUDE.md.

**Fix:**
```js
routerAdd("POST", "/api/vs3/process-deadlines", function (e) {
    // Require staff or head_admin role — members collection users must be rejected
    const authRecord = e.auth;
    if (!authRecord) return e.json(401, { error: "Authentication required" });
    const role = authRecord.get("role");
    if (role !== "staff" && role !== "head_admin") {
        return e.json(403, { error: "Staff access required" });
    }
    // ... existing body
}, $apis.requireAuth());
```

---

### CR-02: Scheduler does not write a `server_log` entry per-node — bulk write happens outside transaction but `processedCount` may be inflated if a node save fails

**File:** `pb_hooks/scheduler.js:139-223`

**Issue:** The transaction at line 139 iterates nodes and calls `txApp.save(node)` for each one.
If any single `txApp.save()` throws (e.g. a validation error on a specific node), the entire
transaction rolls back — correct. However, `processedCount` is incremented _before_ the per-node
saves are flushed (it tracks loop iterations, not committed writes). More critically, there is no
per-node `server_log` write (per the 8-step CLAUDE.md deadline spec, step 7: "Write to serverLog
and node history"). The one `writeServerLog` call at line 225 logs only a bulk count, not
individual node outcomes. When combined with the missing node-level history write, this means the
deadline spec's step 7 is only partially implemented — per-node instability changes are not
individually logged in `server_log` or `node_ownership_history`.

Separately, the idempotency stamp is written inside the transaction on `cfg` (the record fetched
_outside_ the transaction). PocketBase JSVM transactions pass `txApp` as the scoped DAO; writing
the record via `txApp.save(cfg)` where `cfg` was fetched with `$app.dao()` may behave differently
across PocketBase versions and is fragile.

**Fix:** Inside the transaction loop, after `txApp.save(node)`, call `writeServerLog` (or a
txApp-scoped equivalent) for each node with the individual outcome. Refetch `cfg` inside the
transaction using `txApp.findRecordById("deadline_config", cfg.getId())` before stamping it.

---

### CR-03: `importData` action deletes all records then re-inserts — no collection-rule enforcement, any staff member can destroy all data

**File:** `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts:97-158`

**Issue:** The server-side role check at line 99 guards the action. However, the actual
PocketBase API calls at lines 133-149 use `locals.pb` — the _user's_ authenticated PocketBase
client. Collection rules for destructive operations (`deleteRule: ADMIN` in the migration)
restrict deletion to `head_admin`. If a `staff` role user somehow reaches this action (e.g., the
SvelteKit role check at line 99 is bypassed via a direct POST), they will get 403 errors from
PocketBase on the delete calls — but those errors are all caught by the outer `try/catch` at line
151, which logs a generic message and returns `fail(500, ...)`. This means a partial import
(some collections deleted, others not) can silently occur and be reported as a generic server
error with no details about which collections were affected.

More directly: the SvelteKit-side role check is the _only_ meaningful gate. If that check is
removed or bypassed (e.g., a middleware bug), nothing at the collection-rule level prevents a
`staff` user from initiating the deletion loop. CLAUDE.md requires "Head Admin gated at route
AND collection rule level — UI hiding alone is insufficient." The same principle applies to form
actions.

**Fix:** The outer `try/catch` must not silently swallow partial-import state. Use a dedicated
error accumulator. Additionally, the PocketBase collection `deleteRule` for `factions`, `nodes`,
`wars` etc. should be `ADMIN`-only, verified before this action is relied upon as safe.
```ts
// At minimum, fail loudly with the specific collection name on any delete error:
for (const collection of EXPORT_COLLECTIONS) {
  try {
    const existing = await locals.pb.collection(collection).getFullList({ fields: 'id' });
    await Promise.all(existing.map(r => locals.pb.collection(collection).delete(r.id)));
  } catch (err) {
    return fail(500, {
      action: 'importData',
      error: `Import aborted: failed to clear collection '${collection}'. No data was modified for subsequent collections.`
    });
  }
  // then insert...
}
```

---

### CR-04: Cap preview in dashboard quick-log modal ignores existing cycle submissions — shows only the new submission's SP against the cap

**File:** `vs3-panel/src/routes/(staff)/dashboard/+page.svelte:61-73`

**Issue:** The `qlCapPreview` derived block (lines 61-73) calculates `rrSP` and `cSP` from only
the _new submission's_ `qlNewSpValue`. It does not include any existing submissions for that node
in the current cycle. The dashboard `load` function fetches `allSubmissions` (line 20-22) with
`fields: 'id,node,sp_value'` — it does not fetch `category`, so it cannot reconstruct the
per-category totals needed for an accurate cap preview.

The result: a staff member using the dashboard quick-log modal will see the cap bars at 0% for
Raw Renewable / Currency regardless of how much has already been submitted for that node this
cycle. The "exceeds 40% cap" warning will only appear for single submissions that are themselves
over 40% of effective upkeep. In practice this means a staff member can submit multiple Raw
Renewable items totalling >40% without any warning in the dashboard modal, relying entirely on the
server-side check in `logSubmission` to reject it. While the server-side check is the authoritative
gate (correct per CLAUDE.md), CLAUDE.md also states "Preview must show impact BEFORE commit, not
after." The dashboard modal misleads staff into thinking submissions are within cap when they may
not be.

**Fix:** Add `category` to the `allSubmissions` query fields in `dashboard/+page.server.ts`, then
build a per-node `paidCategoryByNode` map. Pass per-node category totals to the overdue nodes
list so `openQuickLog` can receive the existing category breakdown and `qlCapPreview` can
accumulate against it.

```ts
// +page.server.ts — change fields to include category:
locals.pb.collection('submissions').getFullList({
  fields: 'id,node,sp_value,category'
})

// Then build:
const paidCategoryByNode = new Map<string, { rr: number; c: number }>();
for (const s of allSubmissions) {
  const cur = paidCategoryByNode.get(s.node) ?? { rr: 0, c: 0 };
  if (s.category === 'Raw Renewable') cur.rr += s.sp_value;
  if (s.category === 'Currency') cur.c += s.sp_value;
  paidCategoryByNode.set(s.node, cur);
}
// Include in overdueNodes map and pass to the Svelte component
```

---

### CR-05: Migration rollback unconditionally drops `job_run_log` — will delete Phase 2 data on rollback

**File:** `pb_migrations/1746230400_phase3_schema.js:154-165`

**Issue:** The rollback function at lines 154-165 includes `"job_run_log"` in the deletion list.
The comment at line 121 acknowledges that `job_run_log` was created in the Phase 2 migration and
the `exists()` guard skips creation on fresh Phase 3 installs. However, the rollback does _not_
apply the same guard — it unconditionally attempts to delete `job_run_log`, which would destroy
all historical scheduler run records that belong to Phase 2. This violates the Phase 2/3 boundary
and constitutes data loss on migration rollback.

**Fix:**
```js
}, (db) => {
    const dao = Dao(db);
    for (const name of [
        "instability_rolls",
        "deadline_config",
        "submission_history",
        "submissions"
        // job_run_log is owned by the Phase 2 migration — do NOT drop it here
    ]) {
        try { dao.deleteCollection(dao.findCollectionByNameOrId(name)); } catch (_) {}
    }
});
```

---

## Warnings

### WR-01: `removeSubmission` action has no ownership/node check — any staff can delete any submission by ID

**File:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts:486-495`

**Issue:** The `removeSubmission` action fetches only the submission `id` from the form and
deletes it directly via `locals.pb.collection('submissions').delete(parsed.data.id)`. It does not
verify that the submission belongs to the node at `params.id`. A staff member on node A's page
could craft a form POST with the `id` of a submission belonging to node B, and it would be
deleted silently. The collection `deleteRule: STAFF` permits any staff user to delete any
submission record.

**Fix:** Add a verification step before deletion:
```ts
const sub = await locals.pb.collection('submissions').getOne(parsed.data.id, { fields: 'id,node' });
if ((sub as { node: string }).node !== params.id) {
  return fail(400, { action: 'removeSubmission', errors: { _global: ['Submission does not belong to this node.'] } });
}
await locals.pb.collection('submissions').delete(parsed.data.id);
```

---

### WR-02: `rollInstability` action has no check that `roll_due` is true — can create spurious instability_rolls records

**File:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts:498-527`

**Issue:** The `rollInstability` action saves a roll record and optionally clears `roll_due`,
but it does not verify that `node.roll_due === true` before proceeding. Staff can POST to
`?/rollInstability` on any node at any time, creating a roll record even when no roll is due.
This pollutes the instability_rolls history and can incorrectly set `roll_due = false` on a node
that did not have a pending roll.

**Fix:**
```ts
const node = await locals.pb.collection('nodes').getOne(params.id, { fields: 'id,roll_due' });
if (!(node as { roll_due?: boolean }).roll_due) {
  return fail(400, { action: 'rollInstability', errors: { _global: ['No instability roll is currently due for this node.'] } });
}
```

---

### WR-03: `instability_reduction` submission logs a record even when instability is already 0 — sp_value is charged with no effect

**File:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts:444-447`, `+page.svelte:960-964`

**Issue:** When `submission_type === 'instability_reduction'`, the server creates a submission
record (charging 40 SP, logged in the cycle) and then checks `if (cur > 0)` before decrementing.
If `cur === 0`, the 40 SP submission is saved but instability is not reduced — the SP is consumed
with no effect. The UI shows a warning at `+page.svelte:960-964` ("This node's instability is
already 0. This submission will still be logged.") but does not prevent the submission. The server
does not block it either. CLAUDE.md specifies the cost is 40 SP per reduction; there is no
provision for "pay 40 SP for nothing."

**Fix:** Add a server-side guard:
```ts
} else if (submission_type === 'instability_reduction') {
  const cur = (node as { instability?: number }).instability ?? 0;
  if (cur <= 0) {
    return fail(400, { action: 'logSubmission', errors: { _global: ['Instability is already 0. No reduction is needed.'] } });
  }
  item_name = 'Instability Reduction';
  category = 'special';
  sp_value = INSTAB_REDUCTION_SP;
```

---

### WR-04: `computeCurrentDeadline` returns wrong result on the exact deadline minute — deadline processed one week early

**File:** `pb_hooks/scheduler.js:85-93`

**Issue:** In `computeCurrentDeadline`, after computing `dl` as the deadline date-time for the
current week, the guard at line 91 is `if (dl > now)`. This means when the clock is exactly at
the deadline second (`dl === now` in milliseconds), the condition is false and `dl` is _not_
rolled back. This is correct: processing at exactly the deadline is intended. However, there is
a subtler issue: the function computes the "most recent past deadline" by subtracting `dayDiff`
days and then checking `dl > now`. If `dayDiff === 0` (today is the deadline day) and `dl` has
already passed (dl <= now), processing fires correctly. But if `dayDiff === 0` and `dl > now`
(deadline is later today), the function subtracts 7 days to get last week's deadline — also
correct. The logic is sound in most cases.

The actual edge case is: when `minute` is 0-59 and `tzOffset` produces a `utcHour` that wraps
across midnight (e.g. `hour=1, tzOffset=+3` → `utcHour = ((1-3) % 24 + 24) % 24 = 22`), the
`dayOfWeek` alignment computed on line 89 uses the UTC day-of-week of the _current_ UTC date
(which may be the next calendar day relative to local time). If the server's UTC date is already
"Sunday" but the local deadline day is "Saturday" (due to the timezone wrap), `dayDiff` is
calculated correctly by the modular arithmetic, but the `dl.getUTCDate() - dayDiff` subtraction
places `dl` one day ahead of where it should be in local time, because the UTC hour was wrapped
back into the prior calendar day. This can cause the processor to see a `deadlineTs` that is 6
days in the future relative to local time, making `now < new Date(deadlineTs)` true and returning
`not_yet_due` for a full week after the deadline actually passed.

This only affects configurations where `hour - tzOffset < 0` (deadline in UTC is on a different
calendar day than local time). The default seed (Saturday 23:59 UTC-5 = Sunday 04:59 UTC) is one
such case (local Saturday, UTC Sunday). Test coverage of this specific configuration is essential.

**Fix:** Add an explicit test against the default config. At minimum, add a comment documenting
the known cross-midnight behavior and confirming it has been manually verified.

---

### WR-05: `resolveEvent` action does not verify the roll belongs to the current node

**File:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts:530-561`

**Issue:** `resolveEvent` accepts a `roll_id` from the form and resolves it without checking
`roll.node === params.id`. A roll from a different node could be resolved from this page, and the
`roll_due = false` side-effect would incorrectly clear the `roll_due` flag on `params.id`'s node
(line 556) rather than on the node that actually owns the roll.

**Fix:**
```ts
const roll = await locals.pb.collection('instability_rolls').getOne(parsed.data.roll_id);
if ((roll as { node?: string }).node !== params.id) {
  return fail(400, { action: 'resolveEvent', errors: { _global: ['Roll does not belong to this node.'] } });
}
```

---

### WR-06: Dashboard `daysSince` uses `+ 1` offset — wars show "Day 1" on the same day they start

**File:** `vs3-panel/src/routes/(staff)/dashboard/+page.svelte:12-14`

**Issue:** The `daysSince` function returns `Math.floor(...) + 1`. This means a war started
today (0 days ago) displays as "Day 1" — which is consistent with a 1-based day counter. However,
a war started yesterday (1 day ago) displays as "Day 2", and so on. This is internally consistent
but deviates from how "Day X of a war" is typically counted in other game contexts. More
importantly, the formula `Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000) + 1`
will produce "Day 1" for _any_ time within the first 24 hours, which is the expected "war started
today = Day 1" semantic. This is not a bug per se, but the `+1` is not documented and is easy to
accidentally remove during maintenance, changing the semantic. This should be an explicit
named constant or comment.

**Fix:** Add a clarifying comment:
```ts
// Day counter is 1-based: a war that started today shows "Day 1"
function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000) + 1;
}
```

---

### WR-07: Metrics `snapshot` field parsed with `JSON.parse` but stored as a JSON column — double-encoding risk

**File:** `vs3-panel/src/routes/(staff)/metrics/+page.svelte:49-54`

**Issue:** At line 51, the metrics page calls `JSON.parse(h.snapshot || '[]')`. In the scheduler
(`pb_hooks/scheduler.js:204`), the snapshot is stored as `JSON.stringify(snapshot)` into a field
typed as `json` in the schema. PocketBase `json` columns typically return the value already
deserialized when fetched via the SDK. If PocketBase deserializes the JSON column automatically,
`h.snapshot` will already be an array — and `JSON.parse(array.toString())` will produce incorrect
results (parsing `"[object Object],[object Object]"` as a string). If PocketBase returns it as a
raw string, `JSON.parse` is correct.

The scheduler explicitly calls `JSON.stringify(snapshot)` before `.set("snapshot", ...)`. If
PocketBase stores and returns the raw string (not re-parsing it), this is fine. But the
`submission_history` schema defines `snapshot` as `type: "json"` — PocketBase may return it
pre-parsed. This needs explicit verification. In the node detail page (`+page.server.ts:253`), the
snapshot is typed as `unknown` and not parsed, suggesting the author was uncertain too.

**Fix:** In the scheduler, set the snapshot without `JSON.stringify` (let PocketBase handle JSON
column serialization):
```js
histRec.set("snapshot", snapshot);  // not JSON.stringify(snapshot)
```
Then in the metrics Svelte component, access `h.snapshot` directly as an array:
```ts
const snap: SnapshotItem[] = Array.isArray(h.snapshot) ? h.snapshot : [];
```

---

## Info

### IN-01: `UPGRADE_SP` comment says "CONTEXT.md T4 decision: T1→T2=60, T2→T3=140, T3→T4=500" but CLAUDE.md says "resolve before Phase 3"

**File:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts:15-16`

**Issue:** CLAUDE.md explicitly states "T4 upgrade cost: Handbook §IX says 500 SP; v1 code does
not track this. Clarify with user before implementing upgrade tracking." The code has gone ahead
and hardcoded 500 SP for T3→T4, attributing the decision to "CONTEXT.md" (a file that is not
among the reviewed files). If no explicit resolution from the user was documented, this is an
unresolved business logic decision that was silently committed. The value should be confirmed.

**Fix:** Confirm the T3→T4=500 SP decision with the user/game master and add a comment citing the
specific resolution decision, date, and source.

---

### IN-02: `Trade Post` "Bank Panic" event has `spCost: 4` but the description says "pay 40 SMD" — 10 SMD = 1 SP means this should be 4 SP

**File:** `vs3-panel/src/lib/instab_events.ts:157`

**Issue:** The `Bank Panic` event for `Trade Post` has `spCost: 4` and the `effect` field says
"pay 40 SMD". Per CLAUDE.md: "10 SMD = 1 SP" — 40 SMD = 4 SP. The SP value is correctly 4.
However, the `effect` description says "40 SMD" while every other event uses "SP" units in the
effect text. This inconsistency will confuse staff reading the event card in the UI, since the
card displays `spCost` in SP units (e.g. "SP Cost: 4 SP") while the effect text says "40 SMD".
This is technically accurate but misleading in context.

**Fix:** Either update the effect text to read "pay 4 SP (= 40 SMD)" for clarity, or ensure the
UI specifically labels this event's cost in SMD when rendering.

---

### IN-03: `exportData` action available to all authenticated staff — no head_admin check

**File:** `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts:39-61`

**Issue:** The `exportData` action has no role check. Any `staff` user can trigger a full data
export. The exported JSON includes all factions, nodes, wars, diplomacy, and server logs. While
this is read-only (no data mutation), it represents a bulk data exfiltration vector if a staff
account is compromised. CLAUDE.md does not explicitly restrict exports to head_admin, so this may
be intentional — but it should be a conscious decision. Currently the UI shows the export button
to all staff without any role gating.

**Fix:** If staff should not have bulk export access, add a role check matching the import action.
If all staff should have export access, add a code comment documenting this as an intentional
decision.

---

_Reviewed: 2026-05-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
