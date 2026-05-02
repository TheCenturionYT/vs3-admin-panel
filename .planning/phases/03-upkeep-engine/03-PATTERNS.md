# Phase 3: Upkeep Engine & Automation — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 11 new/modified files
**Analogs found:** 10 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pb_hooks/scheduler.js` | service (scheduler) | event-driven | `pb_hooks/export_hooks.js` + `pb_hooks/log_hooks.js` | role-match |
| `pb_migrations/XXXX_phase3_schema.js` | migration | batch | `pb_migrations/1746057600_phase2_schema.js` | exact |
| `vs3-panel/src/lib/instab_events.ts` | utility | transform | `vs3-panel/src/lib/upkeep.ts` | role-match |
| `vs3-panel/src/lib/upkeep.ts` | utility | transform | self (already exists — no changes needed) | exact |
| `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` | controller | request-response + CRUD | self (already exists — adding actions) | exact |
| `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` | component | request-response | self (already exists — adding sections) | exact |
| `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts` | controller | request-response | self (already exists — adding load queries) | exact |
| `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` | component | request-response | self (already exists — replacing stubs) | exact |
| `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts` | controller | request-response + CRUD | self (already exists — adding action) | exact |
| `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` | component | request-response | self (already exists — adding card) | exact |
| `vs3-panel/src/routes/(staff)/metrics/+page.server.ts` | controller | batch | `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts` | role-match |
| `vs3-panel/src/routes/(staff)/metrics/+page.svelte` | component | request-response | `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` (tabs pattern) | role-match |

---

## Pattern Assignments

### `pb_hooks/scheduler.js` (service, event-driven)

**Analog 1:** `pb_hooks/export_hooks.js` — for `routerAdd` custom endpoint pattern (Process All Overdue button)
**Analog 2:** `pb_hooks/log_hooks.js` — for `writeServerLog` helper, `$app.dao().findCollectionByNameOrId`, `new Record(col)`, `record.set()`, `$app.dao().saveRecord()` patterns

**JSVM routerAdd pattern** (export_hooks.js lines 6–25):
```javascript
routerAdd("GET", "/api/vs3/export", (e) => {
    try {
        const data = { ... };
        return e.json(200, data);
    } catch (err) {
        console.error('[export_hooks] Export failed:', err);
        return e.json(500, { error: 'Export failed.' });
    }
}, $apis.requireAuth());
```

**JSVM writeServerLog helper** (log_hooks.js lines 15–28):
```javascript
function writeServerLog(eventType, description, relatedFaction, relatedNode) {
    const col = $app.dao().findCollectionByNameOrId("server_log");
    const entry = new Record(col);
    entry.set("event_type", eventType);
    entry.set("description", description);
    entry.set("actor", "System");
    if (relatedFaction) { entry.set("related_faction", relatedFaction); }
    if (relatedNode)    { entry.set("related_node", relatedNode); }
    $app.dao().saveRecord(entry);
}
```

**JSVM hook try/catch + e.next()** (log_hooks.js lines 33–45):
```javascript
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog("faction_change", 'Faction "' + e.record.getString("name") + '" was created.', e.record.getId(), null);
    } catch (err) {
        console.error("[log_hooks] factions create log failed:", err);
    }
    e.next();
}, "factions");
```

**JSVM cronAdd wrapper** (scheduler.js lines 34–50 — existing placeholder):
```javascript
cronAdd("upkeep_deadline_processor", "* * * * *", function () {
    // handler body
    console.log("[scheduler] upkeep_deadline_processor triggered — Phase 3 implementation pending");
});
```

**JSVM calcUpkeep inline copy** (from RESEARCH.md Pattern 1 — verified against upkeep.ts lines 15–56):
```javascript
// Keep in sync with vs3-panel/src/lib/upkeep.ts — same pure function, no import possible
function jsvm_oemul(n) { return n <= 1 ? 1 : n === 2 ? 1.1 : n === 3 ? 1.2 : n === 4 ? 1.35 : 1.5; }
function jsvm_wmul(w, type) { if (type === 'PvE') return 0; return w === 0 ? 0 : w === 1 ? 0.15 : w === 2 ? 0.3 : 0.5; }
function jsvm_calcUp(baseUpkeep, nodeCount, warCount, factionType, isNeutral) {
    if (isNeutral || !baseUpkeep) return baseUpkeep;
    return Math.ceil(baseUpkeep * jsvm_oemul(nodeCount) * (1 + jsvm_wmul(warCount, factionType)));
}
```

**JSVM writeJobRunLog helper** (new — copy log_hooks.js writeServerLog shape):
```javascript
function writeJobRunLog(jobType, status, details) {
    try {
        const col = $app.dao().findCollectionByNameOrId("job_run_log");
        const entry = new Record(col);
        entry.set("type", jobType);
        entry.set("status", status);
        entry.set("details", details);
        $app.dao().saveRecord(entry);
    } catch (err) {
        console.error("[scheduler] job_run_log write failed:", err);
    }
}
```

**JSVM transaction pattern** (from RESEARCH.md Pattern 2 + PocketBase docs — note: use `txApp` not `$app` inside):
```javascript
$app.runInTransaction((txApp) => {
    // ALL saves inside MUST use txApp.save(), not $app.save()
    // txApp.findRecordsByFilter(), txApp.findRecordById(), txApp.save() are the only valid calls
    const histCol = txApp.findCollectionByNameOrId("submission_history");
    const histRecord = new Record(histCol);
    histRecord.set("node", nodeId);
    txApp.save(histRecord);
});
```

**Note on API version:** `log_hooks.js` and `export_hooks.js` use `$app.dao().saveRecord()` (old API). The scheduler should also use `$app.dao().saveRecord()` for `writeJobRunLog` outside transactions for consistency. Inside `runInTransaction`, use `txApp.save()` (new API — both forms work in 0.22, but `runInTransaction` callback receives a `txApp` with the new API).

---

### `pb_migrations/XXXX_phase3_schema.js` (migration, batch)

**Analog:** `pb_migrations/1746057600_phase2_schema.js`

**Migration file header and exists() guard** (lines 1–12):
```javascript
/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
    const dao = Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const ADMIN = '@request.auth.role = "head_admin"';

    function exists(name) {
        try { dao.findCollectionByNameOrId(name); return true; } catch (_) { return false; }
    }
```

**Collection create pattern with schema and rules** (lines 14–29):
```javascript
    if (!exists("submissions")) {
        dao.saveCollection(new Collection({
            name: "submissions", type: "base",
            schema: [
                { name: "node",            type: "relation", required: true,
                  options: { collectionId: "nodes", maxSelect: 1 } },
                { name: "item",            type: "relation",
                  options: { collectionId: "sp_catalogue", maxSelect: 1 } },
                { name: "item_name",       type: "text" },
                { name: "category",        type: "text" },
                { name: "qty",             type: "number" },
                { name: "sp_value",        type: "number" },
                { name: "submission_type", type: "select", required: true,
                  options: { maxSelect: 1, values: ["upkeep","instability_reduction","repair","upgrade"] } },
                { name: "staff_note",      type: "text" },
                { name: "submitted_by",    type: "relation",
                  options: { collectionId: "staff", maxSelect: 1 } }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: STAFF,
            updateRule: STAFF,
            deleteRule: STAFF
        }));
    }
```

**Select field with values** (phase2 lines 17–19 pattern):
```javascript
{ name: "outcome", type: "select", required: true,
  options: { maxSelect: 1, values: ["paid","partial","underfunded","unpaid"] } }
```

**JSON field** (phase2 pattern for text storing JSON):
```javascript
{ name: "snapshot", type: "json" }
```

---

### `vs3-panel/src/lib/instab_events.ts` (utility, transform)

**Analog:** `vs3-panel/src/lib/upkeep.ts`

**File header convention** (upkeep.ts lines 1–9):
```typescript
/**
 * instab_events.ts — Instability events table and helper functions for VS3 Admin Panel.
 *
 * Ported directly from Admin Panel/VS3_Panel_1_2_1.html (INSTAB_EVENTS, INSTAB_CHANCE, pickEvent).
 * Do NOT re-derive from handbook prose — the v1 JS is the authoritative source.
 *
 * IMPORTANT: Scheduler does NOT use this file. JSVM cannot import TypeScript.
 * This file is SvelteKit-only (UI display, roll evaluation, event selection).
 */
```

**Pure exported function pattern** (upkeep.ts lines 15–21):
```typescript
export const INSTAB_CHANCE: Record<number, number> = {
  0: 0, 1: 5, 2: 15, 3: 30, 4: 50, 5: 75
};

export const INSTAB_LABEL: Record<number, string> = {
  0: 'Stable', 1: 'Minor Instability', 2: 'Moderate Instability',
  3: 'Serious Instability', 4: 'Severe Instability', 5: 'Critical Instability'
};

export interface InstabEvent {
  name: string;
  desc: string;
  effect: string;
  outputPenalty?: boolean;
  spCost?: number;
  instabAdd?: number;
  choice?: boolean;
  rp?: boolean;
}

export function pickEvent(nodeType: string, instabilityLevel: number): InstabEvent | null {
  // filter INSTAB_EVENTS by nodeType (with NT_MAP alias), pick random from pool
}
```

---

### `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` (controller, request-response + CRUD)

**Analog:** Self (existing file — extend, do not rewrite)

**Existing imports pattern** (lines 1–3):
```typescript
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
```

**Extending load with parallel fetches** (lines 46–76 pattern — add to existing Promise.all):
```typescript
// Add to the existing Promise.all in load:
locals.pb.collection('submissions').getFullList({
  filter: `node = "${params.id}"`,
  sort: '-created',
  fields: 'id,item_name,category,qty,sp_value,submission_type,staff_note,submitted_by'
}).catch(() => []),

locals.pb.collection('submission_history').getFullList({
  filter: `node = "${params.id}"`,
  sort: '-deadline_ts'
}).catch(() => []),

locals.pb.collection('instability_rolls').getFullList({
  filter: `node = "${params.id}"`,
  sort: '-created'
}).catch(() => []),

locals.pb.collection('sp_catalogue').getFullList({
  sort: 'category,name',
  fields: 'id,name,category,sp_value'
}).catch(() => [])
```

**New action schema pattern** (lines 11–28 — copy zod schema shape):
```typescript
const logSubmissionSchema = z.object({
  submission_type: z.enum(['upkeep', 'instability_reduction', 'repair', 'upgrade']),
  item: z.string().optional(),
  qty: z.coerce.number().int().min(1).optional(),
  sp_value: z.coerce.number().min(0),
  staff_note: z.string().max(200).optional()
});

const rollInstabilitySchema = z.object({
  roll: z.coerce.number().int().min(1).max(100),
  threshold: z.coerce.number().int(),
  triggered: z.enum(['true', 'false']).transform(v => v === 'true'),
  event_name: z.string().optional(),
  event_desc: z.string().optional(),
  event_effect: z.string().optional(),
  sp_cost: z.coerce.number().optional(),
  instab_add: z.coerce.number().optional(),
  output_penalty: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  is_choice: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  is_rp: z.enum(['true', 'false']).transform(v => v === 'true').optional()
});

const removeSubmissionSchema = z.object({
  id: z.string().min(1)
});
```

**Head admin gate pattern** (lines 230–233):
```typescript
if (locals.pb.authStore.record?.role !== 'head_admin') {
  return fail(403, { action: 'actionName', errors: { _global: ['Head Admin access required.'] } });
}
```

**Action success/fail return shape** (lines 181, 226–227):
```typescript
// Success:
return { success: true, action: 'logSubmission' };
// Validation fail:
return fail(400, { action: 'logSubmission', errors: parsed.error.flatten().fieldErrors, values: Object.fromEntries(data) });
// Server error:
return fail(500, { action: 'logSubmission', errors: { _global: ['Something went wrong. Please try again.'] } });
```

**calcUpkeep call pattern in load** (used on lines 80–99 — replicate in action for cap check):
```typescript
import { calcUpkeep } from '$lib/upkeep';

// In load — effectiveUpkeep never stored, always derived from live state:
const effectiveUpkeep = calcUpkeep(
  node.base_upkeep as number,
  ownerNodes.length,
  ownerWars.length,
  ownerFaction?.type ?? 'PvE',
  !node.owner  // isNeutral
);
```

---

### `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` (component, request-response)

**Analog:** Self (existing file — extend with new sections)

**Svelte 5 runes imports and $props** (lines 1–23):
```typescript
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { format } from 'date-fns';
import { Loader2 } from '@lucide/svelte';
import type { PageData, ActionData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();
```

**$state and $derived pattern** (lines 27–47):
```typescript
// Boolean modal/dialog state
let showSubmissionModal = $state(false);
let submitting = $state(false);

// Live SP preview — $derived from $state inputs, no server round-trip
let selectedItemId = $state('');
let qty = $state(1);
const selectedItem = $derived(data.spCatalogue.find(i => i.id === selectedItemId));
const newSpValue   = $derived(selectedItem ? selectedItem.sp_value * qty : 0);

// Cap preview computed reactively
const capPreview = $derived((() => {
  if (!selectedItem) return null;
  const all = [...data.currentSubmissions, { category: selectedItem.category, sp_value: newSpValue }];
  const rrSP = all.filter(s => s.category === 'Raw Renewable').reduce((sum, s) => sum + s.sp_value, 0);
  const cSP  = all.filter(s => s.category === 'Currency').reduce((sum, s) => sum + s.sp_value, 0);
  return { rrSP, cSP,
    rrPct: data.effectiveUpkeep ? Math.round(rrSP / data.effectiveUpkeep * 100) : 0,
    cPct:  data.effectiveUpkeep ? Math.round(cSP  / data.effectiveUpkeep * 100) : 0,
    ok: rrSP / data.effectiveUpkeep * 100 <= 40 && cSP / data.effectiveUpkeep * 100 <= 40
  };
})());
```

**$effect for form feedback / modal close** (lines 76–82):
```typescript
$effect(() => {
  if (form?.success) {
    showSubmissionModal = false;
    showRollModal = false;
  }
});
```

**use:enhance with spinner** (existing page pattern):
```svelte
<form method="POST" action="?/logSubmission" use:enhance={() => {
  submitting = true;
  return async ({ update }) => {
    await update();
    submitting = false;
  };
}}>
  <button type="submit" disabled={submitting || (submissionType === 'upkeep' && !capPreview?.ok)}>
    {#if submitting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
    Log Submission
  </button>
</form>
```

**Tabs pattern** (shadcn Tabs, gold underline — from existing tabs component installed in Phase 2):
```svelte
<script>
  import * as Tabs from '$lib/components/ui/tabs';
  let activeTab = $state('overview');
</script>

<Tabs.Root bind:value={activeTab}>
  <Tabs.List class="border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
    <Tabs.Trigger value="overview"
      class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary
             px-4 py-2 text-[14px] font-medium text-muted-foreground
             data-[state=active]:text-foreground transition-colors">
      Overview
    </Tabs.Trigger>
    <Tabs.Trigger value="cycle-history">Cycle History</Tabs.Trigger>
    <Tabs.Trigger value="node-log">Node Log</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview"><!-- overview content --></Tabs.Content>
  <Tabs.Content value="cycle-history"><!-- history table --></Tabs.Content>
  <Tabs.Content value="node-log"><!-- existing node log content --></Tabs.Content>
</Tabs.Root>
```

**invalidateAll after action** (RESEARCH.md Pattern 6):
```typescript
// Inside use:enhance callback after successful submission:
await invalidateAll();
```

**Section label pattern** (nodes[id] page and dashboard.svelte — lines 41–42 in dashboard):
```svelte
<div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">
  CURRENT CYCLE SUBMISSIONS
</div>
```

**Card container pattern** (dashboard.svelte lines 40–41):
```svelte
<div class="bg-card border border-border rounded-md p-4 mb-4">
```

**Table pattern** (dashboard.svelte lines 48–76 — thead/tbody with border-b):
```svelte
<table class="w-full text-[14px]">
  <thead>
    <tr class="border-b border-border">
      <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground pb-2 pr-4"
          style="letter-spacing: 0.07em;">Column</th>
    </tr>
  </thead>
  <tbody>
    {#each items as item (item.id)}
      <tr class="border-b border-border last:border-0">
        <td class="py-2 pr-4 text-foreground">{item.value}</td>
      </tr>
    {/each}
  </tbody>
</table>
```

---

### `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts` (controller, request-response)

**Analog:** Self (existing file — add queries + processOverdue action)

**Existing parallel load pattern** (lines 3–12):
```typescript
export const load: PageServerLoad = async ({ locals }) => {
  const [factions, nodes, wars] = await Promise.all([
    locals.pb.collection('factions').getFullList({ sort: 'name' }),
    locals.pb.collection('nodes').getFullList({ expand: 'owner' }),
    locals.pb.collection('wars').getFullList({ filter: 'status = "active"', expand: 'faction_a,faction_b', sort: '-start_date' })
  ]);
```

**Add to Promise.all for Phase 3:**
```typescript
// job_run_log for scheduler health card
locals.pb.collection('job_run_log').getList(1, 1, {
  filter: 'type = "upkeep_deadline_processor"',
  sort: '-created'
}).catch(() => ({ items: [] })),

// submissions aggregated per node (for overdue widget — sum sp_value grouped by node)
locals.pb.collection('submissions').getFullList({
  fields: 'node,sp_value'
}).catch(() => []),

// deadline_config for next-deadline preview
locals.pb.collection('deadline_config').getList(1, 1, {}).catch(() => ({ items: [] }))
```

**server-settings fetch pattern** (server-settings/+page.server.ts lines 23–43 — calling PocketBase custom route from SvelteKit action):
```typescript
// processOverdue action — calls routerAdd endpoint in scheduler.js
processOverdue: async ({ locals }) => {
  try {
    const pbUrl = 'http://localhost:8090';
    const token = locals.pb.authStore.token;
    const res = await fetch(`${pbUrl}/api/vs3/process-deadlines`, {
      method: 'POST',
      headers: { Authorization: token }
    });
    if (!res.ok) {
      return fail(500, { action: 'processOverdue', error: 'Processing failed.' });
    }
    return { success: true, action: 'processOverdue' };
  } catch (err: unknown) {
    return fail(500, { action: 'processOverdue', error: 'Processing failed. Please try again.' });
  }
}
```

---

### `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` (component, request-response)

**Analog:** Self (existing file — replace Phase 2 stub placeholders at lines 95–108)

**Stub location to replace** (dashboard/+page.svelte lines 95–108):
```svelte
<!-- REPLACE THESE TWO STUBS: -->
<div class="grid grid-cols-2 gap-4">
  <div class="bg-card border border-border rounded-md p-6 ...">
    <!-- "Upcoming Upkeep Deadlines" placeholder -->
  </div>
  <div class="bg-card border border-border rounded-md p-6 ...">
    <!-- "Scheduler Health" placeholder -->
  </div>
</div>
```

**Danger alert banner pattern** (server-settings/+page.svelte lines 76–80):
```svelte
<div class="mb-4 flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
     style="background: rgba(180,50,50,0.12); border: 1px solid rgba(180,50,50,0.3); color: #e08080;">
  <AlertTriangle class="w-4 h-4 shrink-0" />
  {errorMessage}
</div>
```

**Success alert pattern** (dashboard.svelte lines 44–46):
```svelte
<div class="rounded-md px-4 py-3 text-[14px]"
     style="background: #1e3a1e; border: 1px solid #3d6b3d; color: #90cc90;">
  All nodes fully controlled.
</div>
```

**Stat card pattern** (dashboard.svelte lines 23–27):
```svelte
<div class="bg-card border border-border rounded-md p-4">
  <div class="text-[11px] font-semibold uppercase text-muted-foreground mb-2"
       style="letter-spacing: 0.07em;">SCHEDULER HEALTH</div>
  <div class="text-[22px] font-semibold" style="color: #c4a45a;">{lastRunAgo}</div>
</div>
```

---

### `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts` (controller, request-response + CRUD)

**Analog:** Self (existing file — add `saveDeadlineConfig` action and deadline_config load)

**Head Admin gate pattern in action** (server-settings/+page.server.ts lines 48–50):
```typescript
const role = (locals.pb.authStore.record as Record<string, unknown>)?.role;
if (role !== 'head_admin') {
  return fail(403, { action: 'saveDeadlineConfig', error: 'Deadline configuration requires Head Admin access.' });
}
```

**New action to add:**
```typescript
saveDeadlineConfig: async ({ request, locals }) => {
  const role = (locals.pb.authStore.record as Record<string, unknown>)?.role;
  if (role !== 'head_admin') {
    return fail(403, { action: 'saveDeadlineConfig', error: 'Deadline configuration requires Head Admin access.' });
  }
  const formData = await request.formData();
  const parsed = saveDeadlineConfigSchema.safeParse({
    day_of_week: formData.get('day_of_week'),
    hour: formData.get('hour'),
    minute: formData.get('minute'),
    timezone_offset: formData.get('timezone_offset'),
    is_active: formData.get('is_active')
  });
  if (!parsed.success) {
    return fail(400, { action: 'saveDeadlineConfig', errors: parsed.error.flatten().fieldErrors });
  }
  try {
    const existing = await locals.pb.collection('deadline_config').getList(1, 1, {});
    if (existing.items.length > 0) {
      await locals.pb.collection('deadline_config').update(existing.items[0].id, parsed.data);
    } else {
      await locals.pb.collection('deadline_config').create(parsed.data);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail(500, { action: 'saveDeadlineConfig', error: `Save failed: ${message}` });
  }
  return { success: true, action: 'saveDeadlineConfig' };
}
```

---

### `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` (component, request-response)

**Analog:** Self (existing file — add Deadline Config card after the export/import card)

**Existing card section pattern** (server-settings/+page.svelte lines 60–66):
```svelte
<div class="rounded-lg border" style="border-color: #3d3426; background: #1a1410;">
  <div class="px-5 pt-5 pb-3">
    <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">Deadline Configuration</span>
  </div>
  <div style="border-top: 1px solid #3d3426;"></div>
  <div class="px-5 py-5">
    <!-- card content -->
  </div>
</div>
```

**isHeadAdmin gate in template** (server-settings/+page.svelte line 8):
```svelte
const isHeadAdmin = $derived(data.isHeadAdmin);
// Then in markup:
{#if isHeadAdmin}
  <!-- editable form -->
{:else}
  <p class="text-[14px] text-muted-foreground">Deadline configuration requires Head Admin access.</p>
{/if}
```

**Live $derived preview for deadline** (matching the $derived cap preview pattern):
```typescript
let dayOfWeek = $state(data.deadlineConfig?.day_of_week ?? 6);
let hour      = $state(data.deadlineConfig?.hour ?? 23);
let minute    = $state(data.deadlineConfig?.minute ?? 59);
let tzOffset  = $state(data.deadlineConfig?.timezone_offset ?? -5);

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const nextDeadlinePreview = $derived(
  `${dayNames[dayOfWeek]} at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UTC${tzOffset >= 0 ? '+' : ''}${tzOffset}`
);
```

---

### `vs3-panel/src/routes/(staff)/metrics/+page.server.ts` (controller, batch)

**Analog:** `vs3-panel/src/routes/(staff)/dashboard/+page.server.ts`

**Load function structure** (dashboard lines 3–12):
```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const [submissionHistory, factions, nodes] = await Promise.all([
    locals.pb.collection('submission_history').getFullList({
      sort: '-deadline_ts',
      fields: 'node,deadline_ts,paid_sp,required_sp,outcome,instab_delta,snapshot'
    }).catch(() => []),
    locals.pb.collection('factions').getFullList({ sort: 'name', fields: 'id,name,color,type' }).catch(() => []),
    locals.pb.collection('nodes').getFullList({ sort: 'name', fields: 'id,name,type,tier,owner' }).catch(() => [])
  ]);
  // Aggregate in TypeScript — NOT in PocketBase filter (snapshot is JSON text, not queryable)
  // See RESEARCH.md Pitfall 6
  return { submissionHistory, factions, nodes };
};
```

**sp_catalogue load pattern** (sp-catalogue/+page.server.ts lines 1–17):
```typescript
const items = await locals.pb.collection('sp_catalogue').getFullList({ sort: 'category,name' });
return { items: items.map(item => ({ id: item.id, name: item.name, category: item.category, sp_value: item.sp_value })) };
```

---

### `vs3-panel/src/routes/(staff)/metrics/+page.svelte` (component, request-response)

**Analog:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` (tabs pattern)

**Page heading pattern** (nodes[id]/+page.svelte lines 85–87):
```svelte
<svelte:head>
  <title>Metrics — VS3 Panel</title>
</svelte:head>
<div class="mb-6">
  <h1 class="text-[22px] font-semibold text-foreground">Metrics</h1>
  <p class="text-[14px] text-muted-foreground mt-1">SP submission totals and payment performance</p>
</div>
```

**Chart.js 4 via svelte5-chartjs** (RESEARCH.md Pattern 5 — library not yet installed, run `npm install svelte5-chartjs chart.js`):
```svelte
<script lang="ts">
  import { Bar } from 'svelte5-chartjs';
  import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

  Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  let { chartData } = $props();  // passed from $derived aggregation
</script>

<div style="min-height: 280px; position: relative;">
  <Bar
    data={chartData}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#d4c5a0' } }
      },
      scales: {
        x: { ticks: { color: '#8b7d65' }, grid: { color: '#3d3426' } },
        y: { ticks: { color: '#8b7d65' }, grid: { color: '#3d3426' }, title: { display: true, text: 'SP', color: '#8b7d65' } }
      }
    }}
  />
</div>
```

**Faction color dot pattern** (nodes[id]/+page.svelte lines 131–134):
```svelte
<span class="w-2 h-2 rounded-full shrink-0" style="background: {faction.color};"></span>
{faction.name}
```

**Filter select state pattern** (matching $state pattern in existing pages):
```typescript
let groupBy   = $state<'category'|'item'|'faction'|'node'>('category');
let dateRange = $state<'all'|'4w'|'12w'|'current'>('all');
let filterFaction = $state('');
```

---

## Shared Patterns

### Authentication / Role Gate
**Source:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` lines 230–233
**Apply to:** `saveDeadlineConfig` action, `deleteNode`-style destructive ops
```typescript
if (locals.pb.authStore.record?.role !== 'head_admin') {
  return fail(403, { action: 'actionName', errors: { _global: ['Head Admin access required.'] } });
}
```

### Error Handling in Actions
**Source:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` lines 153–181
**Apply to:** All new server actions (`logSubmission`, `rollInstability`, `saveDeadlineConfig`, `removeSubmission`)
```typescript
if (!parsed.success) {
  return fail(400, { action: 'actionName', errors: parsed.error.flatten().fieldErrors, values: Object.fromEntries(data) });
}
try {
  await locals.pb.collection('collection').create({ ... });
} catch {
  return fail(500, { action: 'actionName', errors: { _global: ['Something went wrong. Please try again.'] } });
}
return { success: true, action: 'actionName' };
```

### Zod Schema Validation
**Source:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` lines 11–28
**Apply to:** All new actions
```typescript
const schema = z.object({
  field: z.coerce.number().int().min(1).max(100),
  optField: z.string().optional()
});
const parsed = schema.safeParse({ field: data.get('field'), optField: data.get('optField') || undefined });
if (!parsed.success) { return fail(400, { ... }); }
```

### PB Parallel Fetch with Error Isolation
**Source:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` lines 46–76
**Apply to:** All extended load functions (nodes[id], dashboard, metrics)
```typescript
const [a, b, c] = await Promise.all([
  locals.pb.collection('x').getFullList({ ... }).catch(() => []),
  locals.pb.collection('y').getFullList({ ... }).catch(() => []),
  locals.pb.collection('z').getList(1, 1, { ... }).catch(() => ({ items: [] }))
]);
```

### JSVM Record Write Pattern
**Source:** `pb_hooks/log_hooks.js` lines 15–28
**Apply to:** `scheduler.js` (writeJobRunLog helper, all record creates inside scheduler)
```javascript
const col = $app.dao().findCollectionByNameOrId("collection_name");
const entry = new Record(col);
entry.set("field", value);
$app.dao().saveRecord(entry);
```

### Svelte 5 $state/$derived Reactivity
**Source:** `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` lines 27–47
**Apply to:** Submission modal (live SP preview + cap bars), deadline config preview, metrics filters
```typescript
let inputValue = $state(defaultValue);
const derived = $derived(computeFrom(inputValue));
```

### use:enhance with Loading State
**Source:** `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` lines 12–13 + pattern
**Apply to:** All new form submissions
```svelte
<form method="POST" action="?/actionName" use:enhance={() => {
  loading = true;
  return async ({ update }) => { await update(); loading = false; };
}}>
```

### Color Token Usage
**Source:** `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` lines 24–37
**Apply to:** All new UI sections
- Section labels: `style="color: #c4a45a; letter-spacing: 0.07em;"` + `class="text-[11px] font-semibold uppercase"`
- Cards: `class="bg-card border border-border rounded-md p-4 mb-4"`
- SP values: `style="color: #c4a45a;"` + `class="text-[14px] font-semibold"`
- Muted text: `class="text-[14px] text-muted-foreground"`
- Danger: `style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff9999;"`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All files have analogs; new patterns from RESEARCH.md fill any gaps |

---

## Metadata

**Analog search scope:** `pb_hooks/`, `pb_migrations/`, `vs3-panel/src/lib/`, `vs3-panel/src/routes/(staff)/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-01

**Critical notes for planner:**
1. `scheduler.js` uses `$app.dao().saveRecord()` (Phase 2 old API) for helpers outside transactions. Inside `$app.runInTransaction()`, use `txApp.save()` — these are intentionally different.
2. `calcUpkeep()` is TS-only. The JSVM copy (`jsvm_calcUp`) must be kept in sync manually; add cross-reference comments in both files.
3. `svelte5-chartjs` and `chart.js` must be `npm install`'d before implementing `/metrics`. Also run `npx shadcn-svelte@latest add progress separator` before implementing the submission form.
4. `job_run_log` collection existence must be verified (see RESEARCH.md Open Question 1) before implementing `writeJobRunLog`.
5. `deadline_config.last_processed_ts` field must be added to the Phase 3 migration (not in CONTEXT.md schema table but required for idempotency — see RESEARCH.md Open Question 2).
6. The `?/processOverdue` dashboard action must call `POST /api/vs3/process-deadlines` (a `routerAdd` in scheduler.js), not duplicate deadline logic in SvelteKit.
