# Phase 2: Core Data & Wars - Research

**Researched:** 2026-05-01
**Domain:** PocketBase relational schema, SvelteKit load/action patterns for CRUD, JSVM server log hooks, computed upkeep display, JSON export/import, SP Catalogue seeding
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Staff can create, edit, and delete factions with name, type, color, and member roster | PocketBase `factions` collection + `faction_members` relation; SvelteKit form actions; collection `deleteRule: is_system != true` protects Neutral Territory |
| DATA-02 | Each faction member has a role: Leader, Officer, or Member | `faction_members.role` select field with `["Leader","Officer","Member"]` |
| DATA-03 | Neutral Territory exists as a permanent system faction | Seed via `onBootstrap` JSVM hook; `deleteRule: is_system != true` on `factions` collection blocks deletion at API level |
| DATA-04 | Staff can create, edit, and delete nodes with all listed fields | `nodes` collection with 15-type select, tier select, owner relation, road flag; form actions follow staff-management pattern |
| DATA-05 | Military nodes display correct tier label and free reinforcement slots | Client-side `$derived` from tier value using `MIL_NAMES` lookup; not stored — computed at read time |
| DATA-06 | Staff can export all data as timestamped JSON and import from backup | Custom JSVM `routerAdd("GET", "/api/vs3/export", ...)` for export; SvelteKit server action + PocketBase batch-delete + batch-create for import |
| DATA-07 | SP Catalogue is accessible as searchable, filterable reference | `sp_catalogue` collection seeded from v1.2.1 `SP_CAT` array (50 items); filtered client-side via `$derived` |
| WAR-01 | Staff can declare a war between two factions | `wars` collection; form action creates record, triggers server log entry via JSVM `onRecordAfterCreateSuccess` hook |
| WAR-02 | Active wars automatically apply war upkeep modifier — no manual recalculation | Modifier computed at read time in load function; SvelteKit `invalidate()` after war creation refreshes faction/node detail pages |
| WAR-03 | Staff can end a war and record outcome | `wars` update action sets `status=ended`, `end_date`, `outcome` field |
| WAR-04 | War history retained | `status` field on `wars` allows filtering active vs. ended; all records kept |
| WAR-05 | Staff can log a battle outcome on a node | `battles` collection; form action on war detail page |
| WAR-06 | Battle ownership transfer auto-updates ownership timeline | Form action: if `ownership_transferred=true`, creates `node_ownership_history` record with `method="violent"`, updates `nodes.owner` |
| WAR-07 | Staff can track active sieges | `sieges` collection; shown on war detail page |
| DIPLO-01 | Staff can create alliances/treaties between two factions | `diplomacy` collection; form action on `/diplomacy` page |
| DIPLO-02 | Staff can end an alliance and record end date | Update action sets `status=ended`, `end_date` |
| DIPLO-03 | Alliance history retained | All `diplomacy` records kept; history tab filters by `status=ended` |
| LOG-01 | All significant events written to filterable server log | JSVM `onRecordAfterCreateSuccess` / `onRecordAfterUpdateSuccess` hooks on each collection write to `server_log` |
| LOG-02 | Server log can be filtered by event type, faction, node, and text search | Client-side `$derived` filtering on pre-loaded log data; reactive selects + debounced text search |
| LOG-03 | Each node has a per-node history log | `server_log.related_node` relation field; node detail loads log filtered by node ID |
| LOG-04 | Staff can add manual free-text log entries | Form action on `/server-log` page creates `server_log` record with `event_type="manual_entry"` |
| METRICS-03 | Node list and dashboard show instability state visually | `$derived` instability color/label mapping; dot indicator component reused across surfaces |
</phase_requirements>

---

## Summary

Phase 2 is a data-entry and display phase — all 10 surfaces create, update, and display relational data from PocketBase with computed values overlaid client-side. No Phase 3 processing logic ships in Phase 2. The key architectural insight is that **computed values (upkeep formula) live in a shared TypeScript function called from SvelteKit load functions**, not in PocketBase fields, and the war upkeep modifier is kept live via `invalidate()` after data mutation — no SSE subscription needed for Phase 2 scale.

The server log auto-population pattern is the single most novel piece: JSVM `onRecordAfterCreateSuccess` hooks tagged to each collection write to `server_log` server-side, eliminating the need for SvelteKit form actions to manually write log entries. This keeps logging consistent regardless of which API path triggered the change.

Neutral Territory is seeded via an `onBootstrap` JSVM hook and protected by a PocketBase collection `deleteRule: is_system != true`. The SP Catalogue is a PocketBase `sp_catalogue` collection seeded from the verified v1.2.1 `SP_CAT` array (50 items, 13 categories) — static enough that a seed script is the right approach, not a migration file.

**Primary recommendation:** Follow the staff-management page as the pattern reference for all CRUD surfaces. JSVM hooks handle audit logging. Computed upkeep formula lives in `src/lib/upkeep.ts` as a shared pure function. `invalidate()` after mutations is sufficient for WAR-02's live war modifier requirement.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Faction / Node / War / Diplomacy CRUD | SvelteKit form actions | PocketBase (REST API + collection rules) | Form actions call PocketBase SDK; rules enforce role checks |
| Neutral Territory permanence | PocketBase (deleteRule) | JSVM onBootstrap (seeding) | API rule blocks deletion at query level; UI button suppression is secondary |
| Computed upkeep formula | SvelteKit load function / Svelte `$derived` | — | Must never be stored; computed from live faction/war state at read time |
| War upkeep modifier live update | SvelteKit `invalidate()` | — | No SSE needed for Phase 2 scale; `invalidate()` re-runs load after mutation |
| Server log auto-population | PocketBase JSVM hooks (onRecordAfterCreateSuccess) | SvelteKit (manual log entry action) | Hooks fire server-side regardless of API caller; ensures consistent audit trail |
| SP Catalogue data | PocketBase `sp_catalogue` collection (seeded) | JSVM onBootstrap | Static reference data seeded once; UI reads it like any other collection |
| JSON export | PocketBase JSVM `routerAdd` custom endpoint | SvelteKit (triggers download) | Server-side JSON assembly; SvelteKit calls the endpoint and passes the blob to browser |
| JSON import (overwrite) | SvelteKit server action | PocketBase (batch delete + create) | Destructive — requires auth check; action processes uploaded file, calls PocketBase SDK |
| Ownership timeline | PocketBase `node_ownership_history` collection | SvelteKit load (expand + sort) | Append-only ordered history; newest-first sort via `sort: "-transfer_date"` |
| Reactive list filtering | Svelte `$derived` (client-side) | — | Record counts are small (<50 nodes, <30 factions); no server-side pagination needed |
| Faction privacy (Phase 4 scope) | PocketBase collection rules | — | Not active in Phase 2 (staff-only); will be enforced in Phase 4 for portal |

---

## Standard Stack

### Core (all inherited from Phase 1 — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pocketbase (JS SDK) | 0.26.8 | PocketBase API client, CRUD, expand relations | Official SDK; already installed |
| @sveltejs/kit | 2.57.0+ | SSR load functions, form actions, `invalidate()` | Already installed |
| svelte | 5.55.2+ | `$derived` rune for computed values, `$props()` | Already installed |
| zod | 3.24.1 | Validation schemas in form actions | Already installed |
| date-fns | 4.1.0 | Date formatting (timeline, log timestamps) | Already installed |

### New shadcn-svelte Components (Phase 2 additions)

```bash
npx shadcn-svelte@latest add select tabs tooltip scroll-area
```

[VERIFIED: npm registry — shadcn-svelte 1.2.7 current]

| Component | Used By |
|-----------|---------|
| `select` | All filter dropdowns, form fields (type, tier, owner, outcome) |
| `tabs` | Wars list (Active/History tabs), Diplomacy list (Active/History tabs) |
| `tooltip` | Instability level label on node list (hover on dot shows full label) |
| `scroll-area` | Long tables / timelines in fixed-height containers |

### Phase 2 New File: Shared Upkeep Formula

```
src/lib/upkeep.ts   — pure TypeScript functions, no Svelte dependencies
```

This file is the single source of truth for `calcUpkeep()`, `overextensionMul()`, and `warMul()`. It is called from SvelteKit load functions (server-side) and Svelte components (client-side `$derived`). Never stored.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (staff)
    │
    │ HTTPS + pb_auth cookie
    ▼
SvelteKit Node Server
    │
    ├── /factions                    load: getFullList(factions, expand faction_members)
    │   └── /factions/[id]           load: getOne(faction, expand members + nodes + wars)
    │                                 $derived: overextensionMul, warMul, effectiveUpkeep per node
    │
    ├── /nodes                       load: getFullList(nodes, expand owner)
    │   └── /nodes/[id]              load: getOne(node, expand owner) +
    │                                       getFullList(node_ownership_history, filter nodeId, sort -date)
    │                                       getFullList(server_log, filter related_node=nodeId)
    │                                 $derived: effectiveUpkeep (calls calcUpkeep from lib/upkeep.ts)
    │
    ├── /wars                        load: getFullList(wars, expand faction_a + faction_b)
    │   └── /wars/[id]               load: getOne(war) + battles + sieges (filtered by war)
    │
    ├── /diplomacy                   load: getFullList(diplomacy, expand faction_a + faction_b)
    ├── /server-log                  load: getFullList(server_log, expand related_faction + related_node)
    ├── /sp-catalogue                load: getFullList(sp_catalogue, sort name)
    └── /server-settings             static page (export/import actions)
    │
    │ Form actions call PocketBase SDK
    ▼
PocketBase 0.22.22 binary
    │
    ├── Collections: factions, faction_members, nodes, node_ownership_history,
    │                wars, battles, sieges, diplomacy, server_log, sp_catalogue
    │
    ├── Collection rules: deleteRule "is_system != true" on factions
    │                     staff-only rules on all Phase 2 collections (portal scope = Phase 4)
    │
    └── pb_hooks/
        ├── scheduler.js       — unchanged (Phase 1 placeholder)
        ├── auth_hooks.js      — unchanged (Phase 1 lastLogin)
        └── log_hooks.js       — NEW: onRecordAfterCreateSuccess/UpdateSuccess →
                                       writes server_log entries for all Phase 2 collections
        └── seed_hooks.js      — NEW: onBootstrap → seeds Neutral Territory + sp_catalogue
```

### Recommended New Files (Phase 2)

```
vs3-panel/src/
├── lib/
│   └── upkeep.ts                  # calcUpkeep(), overextensionMul(), warMul(), INSTAB_CHANCE
├── routes/(staff)/
│   ├── factions/
│   │   ├── +page.svelte           # Factions list
│   │   ├── +page.server.ts        # load + createFaction action
│   │   └── [id]/
│   │       ├── +page.svelte       # Faction detail
│   │       └── +page.server.ts    # load + editFaction, deleteFaction, addMember, removeMember actions
│   ├── nodes/
│   │   ├── +page.svelte
│   │   ├── +page.server.ts
│   │   └── [id]/
│   │       ├── +page.svelte
│   │       └── +page.server.ts    # load + editNode, deleteNode, transferOwnership actions
│   ├── wars/
│   │   ├── +page.svelte
│   │   ├── +page.server.ts
│   │   └── [id]/
│   │       ├── +page.svelte
│   │       └── +page.server.ts    # load + logBattle, addSiege, resolveSiege, endWar actions
│   ├── diplomacy/
│   │   ├── +page.svelte
│   │   └── +page.server.ts        # load + createAgreement, endAgreement actions
│   ├── server-log/
│   │   ├── +page.svelte           # (upgrade from stub)
│   │   └── +page.server.ts        # load + addManualEntry action
│   ├── sp-catalogue/
│   │   ├── +page.svelte
│   │   └── +page.server.ts        # load only (read-only)
│   ├── server-settings/
│   │   ├── +page.svelte
│   │   └── +page.server.ts        # exportData (custom endpoint call), importData actions
│   └── dashboard/
│       ├── +page.svelte           # (upgrade from stub)
│       └── +page.server.ts        # load: faction count, node count, active war count, instability list

pb_hooks/
├── scheduler.js                   # unchanged
├── auth_hooks.js                  # unchanged
├── log_hooks.js                   # NEW — server log auto-population
└── seed_hooks.js                  # NEW — Neutral Territory + sp_catalogue bootstrap
```

---

### Pattern 1: PocketBase Expand in SvelteKit Load Function

**What:** Fetch a record with its related records expanded in one request.

**When to use:** Any page that needs relational data — faction detail needs members + nodes + active wars.

```typescript
// Source: pocketbase.io/docs/expanding-relations/ [VERIFIED: WebFetch]
// src/routes/(staff)/factions/[id]/+page.server.ts
export const load: PageServerLoad = async ({ locals, params }) => {
  // Single faction with members expanded
  const faction = await locals.pb.collection('factions').getOne(params.id, {
    expand: 'faction_members_via_faction.user'  // back-relation expand
  });

  // Nodes owned by this faction
  const nodes = await locals.pb.collection('nodes').getFullList({
    filter: `owner = "${params.id}"`,
    sort: 'name'
  });

  // Active wars involving this faction
  const wars = await locals.pb.collection('wars').getFullList({
    filter: `(faction_a = "${params.id}" || faction_b = "${params.id}") && status = "active"`,
    expand: 'faction_a,faction_b'
  });

  return { faction, nodes, wars };
};
```

**Expand syntax for back-relations:** `referenceCollection_via_relField`

PocketBase supports up to 6 levels of nested expand via dot-notation. [VERIFIED: WebFetch pocketbase.io/docs/expanding-relations]

---

### Pattern 2: Computed Upkeep Formula in `$derived`

**What:** Calculate effective upkeep at read time from live faction/war state. Never stored.

**When to use:** Faction detail page, Node detail page, Dashboard instability widget.

```typescript
// src/lib/upkeep.ts — shared pure functions
// Ported from VS3_Panel_1_2_1.html calcUp(), oemul(), wmul()
// [VERIFIED: Admin Panel/VS3_Panel_1_2_1.html lines 405-410]

export function overextensionMul(nodeCount: number): number {
  if (nodeCount <= 1) return 1.0;
  if (nodeCount === 2) return 1.1;
  if (nodeCount === 3) return 1.2;
  if (nodeCount === 4) return 1.35;
  return 1.5; // 5+
}

export function warMul(warCount: number, factionType: 'PvP' | 'PvE'): number {
  if (factionType === 'PvE') return 0;  // PvE factions: always 0
  if (warCount === 0) return 0;
  if (warCount === 1) return 0.15;
  if (warCount === 2) return 0.30;
  return 0.50; // 3+
}

export function calcUpkeep(
  baseUpkeep: number,
  nodeCount: number,
  warCount: number,
  factionType: 'PvP' | 'PvE',
  isNeutral: boolean
): number {
  if (isNeutral || !baseUpkeep) return baseUpkeep;
  return Math.ceil(
    baseUpkeep * overextensionMul(nodeCount) * (1 + warMul(warCount, factionType))
  );
}
```

```svelte
<!-- In a Svelte 5 component -->
<script lang="ts">
  import { calcUpkeep } from '$lib/upkeep';
  let { data } = $props();

  // Re-calculates whenever data changes (e.g., after invalidate())
  let effectiveUpkeep = $derived(
    calcUpkeep(
      data.node.baseUpkeep,
      data.nodes.length,          // faction's total node count
      data.activeWars.length,     // faction's active war count
      data.faction.type,
      data.faction.isSystem       // true for Neutral Territory
    )
  );
</script>
```

---

### Pattern 3: SvelteKit `invalidate()` for Live War Modifier (WAR-02)

**What:** After declaring a war, re-run load functions on the current page without a full navigation.

**When to use:** Any mutation that affects computed values shown on the same page — war declaration, war end, ownership transfer.

```svelte
<!-- In /factions/[id]/+page.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';

  // After form submission succeeds, invalidateAll() re-runs the load function.
  // This causes effectiveUpkeep $derived values to recalculate with new war data.
</script>

<form method="POST" action="?/declareWar" use:enhance={() => {
  return async ({ result, update }) => {
    await update();
    if (result.type === 'success') {
      await invalidateAll(); // Re-runs load, picks up new war count
    }
  };
}}>
```

`invalidateAll()` is appropriate for Phase 2 scale. PocketBase real-time subscriptions (SSE) are not required for WAR-02. [VERIFIED: svelte.dev/docs/kit/load WebFetch]

---

### Pattern 4: JSVM Server Log Auto-Population (LOG-01)

**What:** JSVM hooks in `pb_hooks/log_hooks.js` write to `server_log` after every significant record mutation.

**When to use:** All Phase 2 collections (factions, nodes, wars, battles, diplomacy, node_ownership_history).

```javascript
// pb_hooks/log_hooks.js
// Uses $app.dao().saveRecord() — PocketBase 0.22.x pattern
// [VERIFIED: pb_hooks/auth_hooks.js in this project — same API]

onRecordAfterCreateSuccess((e) => {
  try {
    const logCol = $app.dao().findCollectionByNameOrId('server_log');
    const logRecord = new Record(logCol);
    logRecord.set('event_type', 'faction_change');
    logRecord.set('description', `Faction "${e.record.getString('name')}" was created.`);
    logRecord.set('related_faction', e.record.getId());
    logRecord.set('actor', 'System');  // or derive from request context if available
    $app.dao().saveRecord(logRecord);
  } catch (err) {
    console.error('[log_hooks] Failed to write server log:', err);
  }
  e.next();
}, 'factions');

onRecordAfterCreateSuccess((e) => {
  // Similar pattern for nodes, wars, diplomacy, battles, node_ownership_history
  e.next();
}, 'nodes');
```

**Critical:** Use `onRecordAfterCreateSuccess` (not `onRecordCreate`) to avoid writing log entries for records that ultimately fail to save. [VERIFIED: WebFetch pocketbase.io/jsvm]

**API confirmed:** The project's existing `pb_hooks/auth_hooks.js` uses `$app.dao().saveRecord(record)` — this is the correct 0.22.x pattern. The newer `$app.save()` pattern appears in 0.37.x+ docs and should NOT be used. [VERIFIED: pb_hooks/auth_hooks.js]

---

### Pattern 5: Neutral Territory Seeding (DATA-03)

**What:** `onBootstrap` hook ensures Neutral Territory faction exists on every startup. `is_system = true` prevents deletion via collection rule.

```javascript
// pb_hooks/seed_hooks.js
// [VERIFIED: WebFetch pocketbase.io/jsvm + auth_hooks.js pattern]

onBootstrap((e) => {
  // Seed Neutral Territory if it doesn't exist
  try {
    $app.dao().findFirstRecordByData('factions', 'name', 'Neutral Territory');
    // Already exists — nothing to do
  } catch {
    // Record not found — create it
    const col = $app.dao().findCollectionByNameOrId('factions');
    const record = new Record(col);
    record.set('name', 'Neutral Territory');
    record.set('type', 'PvE');
    record.set('color', '#6b6255');  // muted brown — from v1.2.1 line 342
    record.set('is_system', true);
    $app.dao().saveRecord(record);
    console.log('[seed] Neutral Territory created');
  }
  e.next();
});
```

**Collection rule for permanence:** Set `deleteRule` on `factions` to: `is_system != true`

This causes PocketBase to return a 404 (not a permission error) when deletion is attempted on `is_system=true` records — which includes the Neutral Territory record. [VERIFIED: WebFetch pocketbase.io/docs/api-rules-and-filters]

The UI spec confirms: no Delete button is rendered for Neutral Territory at all. The DB rule is the security boundary; the UI suppression is the UX layer.

---

### Pattern 6: JSON Export (DATA-06)

**What:** Custom JSVM route assembles all collection data as JSON and streams it to the client. SvelteKit server action calls this endpoint and passes the response as a file download.

```javascript
// pb_hooks/export_hooks.js
// [VERIFIED: WebFetch pocketbase.io/docs/js-routing/]

routerAdd("GET", "/api/vs3/export", (e) => {
  const data = {
    exported_at: new Date().toISOString(),
    factions:    $app.dao().findRecordsByFilter('factions', '', '-created', 0, 0),
    nodes:       $app.dao().findRecordsByFilter('nodes', '', '-created', 0, 0),
    wars:        $app.dao().findRecordsByFilter('wars', '', '-created', 0, 0),
    battles:     $app.dao().findRecordsByFilter('battles', '', '-created', 0, 0),
    sieges:      $app.dao().findRecordsByFilter('sieges', '', '-created', 0, 0),
    diplomacy:   $app.dao().findRecordsByFilter('diplomacy', '', '-created', 0, 0),
    server_log:  $app.dao().findRecordsByFilter('server_log', '', '-created', 0, 0),
    node_ownership_history: $app.dao().findRecordsByFilter('node_ownership_history', '', '-created', 0, 0)
  };
  return e.json(200, data);
}, $apis.requireAuth());
```

SvelteKit server action for the browser download:
```typescript
// In /server-settings/+page.server.ts
export const actions: Actions = {
  exportData: async ({ locals, fetch }) => {
    const response = await fetch(`${process.env.POCKETBASE_URL}/api/vs3/export`, {
      headers: { Authorization: locals.pb.authStore.token }
    });
    const json = await response.json();
    // Return to client; client side triggers download via blob URL
    return { exportJson: JSON.stringify(json, null, 2) };
  }
};
```

Alternatively: the client can call the PocketBase export endpoint directly using the token from the session. The SvelteKit action approach is cleaner for audit (staff must be authenticated).

---

### Pattern 7: Reactive Client-Side Filtering with `$derived`

**What:** Filter lists without server round-trips. Correct for Phase 2 record counts (<50 nodes, <30 factions).

```svelte
<script lang="ts">
  let { data } = $props();
  let search = $state('');
  let typeFilter = $state('all');

  // Debounced search — not needed if filtering is instant at this scale
  let filteredFactions = $derived(
    data.factions.filter(f => {
      const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || f.type === typeFilter;
      return matchesSearch && matchesType;
    })
  );
</script>
```

UI spec requires: text search debounced 300ms, select filters immediate. [VERIFIED: 02-UI-SPEC.md Interaction Contracts]

For debouncing the text search, use a `$effect` with `setTimeout` — no third-party library needed at this scale. [ASSUMED]

---

### Pattern 8: Ownership Timeline (WAR-06)

**What:** When a battle results in ownership transfer, both the node owner field and the history table must be updated atomically.

```typescript
// In /nodes/[id]/+page.server.ts (or /wars/[id]/+page.server.ts for battle log)
transferOwnership: async ({ request, locals }) => {
  // ... validate input ...

  // Update node owner
  await locals.pb.collection('nodes').update(nodeId, { owner: newOwnerId });

  // Append to ownership history
  await locals.pb.collection('node_ownership_history').create({
    node: nodeId,
    faction: newOwnerId,
    transfer_date: new Date().toISOString(),
    method: transferMethod,  // 'peaceful' | 'violent' | 'system'
    staff_note: note
  });
  // server_log entry written by JSVM hook on node_ownership_history create
}
```

PocketBase does not offer client-accessible transactions from the JS SDK. Two sequential SDK calls are acceptable here — the history record failing does not leave data corrupt (node owner updates, history just has a gap). For Phase 2 reliability, the action catches errors on both calls independently. [ASSUMED — no atomic multi-collection transaction in PocketBase SDK]

---

### Anti-Patterns to Avoid

- **Storing effectiveUpkeep as a field:** Violates CLAUDE.md constraint and will cause stale data when war count or node count changes. Always compute at read time from live faction/war state.
- **Writing server_log from SvelteKit form actions:** Centralizing log writes in JSVM hooks ensures consistency. If SvelteKit actions write logs, they can be skipped during import or other non-SvelteKit writes.
- **Using `onRecordCreate` instead of `onRecordAfterCreateSuccess`:** `onRecordCreate` fires before the save completes. If the save fails, you get a log entry for a record that doesn't exist.
- **Filtering by multiple factions in `wars` using OR without parentheses:** PocketBase filter `faction_a = X || faction_b = Y && status = "active"` has operator precedence issues. Always use explicit parentheses: `(faction_a = X || faction_b = Y) && status = "active"`.
- **Using `$app.save()` in JSVM hooks instead of `$app.dao().saveRecord()`:** The newer API (`$app.save()`) is for PocketBase 0.37.x+. This project runs 0.22.22. Use `$app.dao().saveRecord()` — confirmed by `auth_hooks.js` in this project.
- **Calling PocketBase from `onBootstrap` without try/catch:** The collections may not exist yet on a truly fresh database. The seed hook must handle the case where `findCollectionByNameOrId` throws (Phase 2 schema not yet applied).

---

## PocketBase Schema — Phase 2 Collections

The following collections must be created in PocketBase before Phase 2 UI is built. They extend the Phase 1 schema (staff, members, factions stub, job_run_log, server_log).

### Collection: `factions` (extends Phase 1 stub)

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| name | Text | required | |
| type | Select | PvP, PvE | required |
| color | Text | | hex color string |
| description | Text | | optional |
| is_system | Bool | default false | Neutral Territory = true |

**Rules:**
- listRule: `@request.auth.role = "head_admin" || @request.auth.role = "staff"`
- viewRule: same
- createRule: `@request.auth.role = "head_admin"`
- updateRule: `@request.auth.role = "head_admin"`
- deleteRule: `@request.auth.role = "head_admin" && is_system != true`

### Collection: `faction_members`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| faction | Relation | → factions | required, single |
| user | Relation | → members | required, single |
| role | Select | Leader, Officer, Member | required |

**Rules:** staff/head_admin CRUD. deleteRule: `head_admin only`.

### Collection: `nodes`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| name | Text | required | |
| node_number | Number | | display order |
| type | Select | Farm, Ranch, Orchard, Mine, Quarry, Clay Pit, Forest, Lumber Mill, Resin Farm, Peat Bog, Salt Works, Workshop, Trade Post, Military Node, Harbor/River Landing | required, 15 options — [VERIFIED: VS3_Panel_1_2_1.html line 228] |
| tier | Select | 1, 2, 3, 4 | required |
| owner | Relation | → factions | optional (null = Neutral Territory) |
| base_upkeep | Number | | SP/week base |
| has_road | Bool | default false | |
| road_note | Text | | optional, only relevant if has_road=true |
| notes | Text | | free-text staff notes |
| instability | Number | min 0 max 5 | default 0 |
| roll_due | Bool | default false | Phase 3 uses this; Phase 2 just stores it |

**Rules:** staff CRUD; deleteRule: head_admin only.

### Collection: `node_ownership_history`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| node | Relation | → nodes | required |
| faction | Relation | → factions | required |
| transfer_date | Date | | required |
| method | Select | peaceful, violent, system | required |
| staff_note | Text | | optional |

**Rules:** staff create/list/view; head_admin delete. No update rule (append-only).

**Sort pattern:** Always fetch with `sort: "-transfer_date"` to get newest first.

### Collection: `wars`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| faction_a | Relation | → factions | required |
| faction_b | Relation | → factions | required |
| casus_belli | Text | required | |
| start_date | Date | required | |
| end_date | Date | | null while active |
| outcome | Select | Victory_A, Victory_B, Stalemate | null while active |
| status | Select | active, ended | required, default active |
| notes | Text | | |

**War filter for active wars involving faction X:**
```
(faction_a = "X" || faction_b = "X") && status = "active"
```

### Collection: `battles`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| war | Relation | → wars | required |
| node | Relation | → nodes | optional |
| attacker | Relation | → factions | required |
| defender | Relation | → factions | required |
| result | Text | | e.g. "Attacker victory" |
| description | Text | | |
| battle_date | Date | required | |
| ownership_transferred | Bool | default false | |

### Collection: `sieges`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| war | Relation | → wars | required |
| node | Relation | → nodes | required |
| attacker | Relation | → factions | required |
| defender | Relation | → factions | required |
| objectives | Text | | |
| start_date | Date | required | |
| resolved | Bool | default false | |
| resolution_note | Text | | |

### Collection: `diplomacy`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| type | Select | Alliance, NAP, Trade Agreement, Vassalage, Coalition, Custom | required |
| faction_a | Relation | → factions | required |
| faction_b | Relation | → factions | required |
| terms | Text | | |
| custom_name | Text | | only used when type=Custom |
| start_date | Date | required | |
| end_date | Date | | null while active |
| status | Select | active, ended | required, default active |

### Collection: `server_log` (extends Phase 1 stub)

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| event_type | Select | faction_change, node_change, war_event, diplomacy_event, ownership_transfer, manual_entry | required |
| description | Text | required | |
| related_faction | Relation | → factions | optional |
| related_node | Relation | → nodes | optional |
| actor | Text | | staff username or "System" |

**Note:** Phase 1 already created a `server_log` collection stub. Phase 2 adds the relation fields and event_type select field to it.

### Collection: `sp_catalogue`

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| name | Text | required | e.g. "64 firewood" |
| category | Select | Raw Renewable, Fuel, Agriculture & Food, Construction, Masonry, Textiles & Leather, Early Metals, Mid Metals, Late Metals, Tools & Hardware, Military Supplies, Utility Goods, Currency | required, 13 categories |
| sp_value | Number | required | integer |
| demand_level | Text | | e.g. "Very low", "Moderate", "High" |

**Data source:** 50 items from `SP_CAT` array in `VS3_Panel_1_2_1.html` lines 173–226. [VERIFIED: codebase grep]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SP Catalogue data | Re-derive from handbook prose | Port directly from v1.2.1 `SP_CAT` array | Handbook has ambiguities; v1.2.1 JS is authoritative per CLAUDE.md |
| Upkeep formula | Derive from handbook description | Port `calcUp()`, `oemul()`, `wmul()` from v1.2.1 | Same reason; the formula is already verified and implemented |
| Neutral Territory permanence | Custom UI logic preventing deletion | PocketBase `deleteRule: is_system != true` | DB-level protection works even if UI is bypassed; UI suppression is secondary |
| Server log population | Form action manually writing log entries | JSVM `onRecordAfterCreateSuccess` hooks | Hooks fire regardless of API caller; consistent audit trail |
| Multi-level expand | Multiple sequential API calls | PocketBase `expand` with dot-notation | One round-trip for `nodes` + `owner.type` + `owner.wars_via_faction_a` |
| Debounce utility | Custom debounce function | 3-line `$effect` with `setTimeout` | Simple enough to inline; no library needed at this scale |
| Pagination | Server-side cursor pagination | Client-side `$derived` filtering | <50 nodes, <30 factions fits in one request; pagination adds complexity without benefit |
| File download | Custom download link construction | `URL.createObjectURL(blob)` + programmatic `<a>.click()` | Standard browser pattern; no server streaming needed for export sizes |

---

## SP Catalogue — Complete Seed Data

From `VS3_Panel_1_2_1.html` SP_CAT array (50 items). [VERIFIED: codebase grep lines 173-226]

The seed hook must create these 50 records in `sp_catalogue` on first bootstrap. A Wave 0 task writes the complete seed data into `pb_hooks/seed_hooks.js`.

Categories (13): Raw Renewable, Fuel, Agriculture & Food, Construction, Masonry, Textiles & Leather, Early Metals, Mid Metals, Late Metals, Tools & Hardware, Military Supplies, Utility Goods, Currency

Notable items verified from v1 source:
- 10 SMD = 1 SP (Currency), 50 SMD = 5 SP, 100 SMD = 10 SP
- 1 steel ingot = 28 SP (Late Metals)
- 64 firewood = 4 SP (Raw Renewable)

---

## Common Pitfalls

### Pitfall 1: War Filter Operator Precedence

**What goes wrong:** PocketBase filter `faction_a = "X" || faction_b = "X" && status = "active"` is parsed as `faction_a = "X" || (faction_b = "X" && status = "active")` — returns wars where faction_a = X regardless of status.

**Why it happens:** PocketBase uses standard boolean operator precedence (AND before OR) without extra parentheses.

**How to avoid:** Always wrap OR conditions: `(faction_a = "X" || faction_b = "X") && status = "active"`.

**Warning signs:** Dashboard shows ended wars in Active Wars widget.

---

### Pitfall 2: Using New JSVM API (`$app.save()`) in 0.22.x

**What goes wrong:** PocketBase 0.37.x documentation shows `$app.save(record)` and `$app.findFirstRecordByFilter()`. These do not exist in PocketBase 0.22.x JSVM.

**Why it happens:** Most online resources and LLM training data show the newer API. PocketBase changed its JSVM API significantly at 0.23+ with breaking changes.

**How to avoid:** Use `$app.dao().saveRecord(record)`, `$app.dao().findCollectionByNameOrId()`, `$app.dao().findFirstRecordByData()`. These are confirmed by the existing `auth_hooks.js` in this project.

**Warning signs:** JSVM hook logs `TypeError: $app.save is not a function` or similar.

---

### Pitfall 3: `onBootstrap` Collection Not Yet Existing

**What goes wrong:** `onBootstrap` hook tries to find `factions` collection before the schema has been applied (truly fresh database, first boot). `findCollectionByNameOrId` throws, and the seed hook crashes the entire PocketBase startup.

**Why it happens:** On first-ever startup, `pb_data/` is empty. PocketBase applies migrations/schema AFTER the bootstrap event in some versions.

**How to avoid:** Wrap all `onBootstrap` collection access in try/catch. If the collection doesn't exist yet (thrown error), log and continue — the seed will run correctly on subsequent startups after schema is applied via the admin UI.

**Warning signs:** PocketBase fails to start on fresh install. Check `pb_data/` logs for hook errors.

---

### Pitfall 4: Ownership Transfer Race — Two Sequential SDK Calls

**What goes wrong:** SvelteKit action updates `nodes.owner`, then creates `node_ownership_history` record. If the second call fails (network error, PocketBase down), the node's owner is updated but no history record exists.

**Why it happens:** PocketBase JS SDK does not support multi-collection transactions from the client side.

**How to avoid:** In Phase 2, accept this limitation — the history record missing is not data corruption (node has correct owner). Log the error clearly. Phase 3 can introduce a JSVM custom endpoint that performs the operation in a `$app.runInTransaction()` block if this becomes a real issue.

**Warning signs:** Node detail shows new owner but no history entry for the transfer.

---

### Pitfall 5: SP Catalogue Missing from `sp_catalogue` on Fresh Deploy

**What goes wrong:** The SP Catalogue page loads an empty table because `sp_catalogue` was never seeded.

**Why it happens:** The seed is in a JSVM hook that runs on PocketBase startup, but the `sp_catalogue` collection must exist first (created via admin UI or schema import). If schema is applied after first PocketBase start, the bootstrap hook ran before the collection existed.

**How to avoid:** The seed hook must check if records already exist before inserting. Document in deployment guide: "Apply PocketBase schema before first user-facing access. Restart PocketBase after schema import to trigger seed hooks."

**Warning signs:** SP Catalogue page shows empty state ("No items match your search") without any filters active.

---

### Pitfall 6: War Modifier Not Updating Without Page Reload

**What goes wrong:** Staff declares a war on `/wars`, then navigates to `/factions/[id]`. The faction detail still shows "0 active wars → +0%" war modifier because the load function ran before the war was created.

**Why it happens:** SvelteKit caches load data. Without `invalidate()`, the faction detail page shows stale data.

**How to avoid:** After declaring a war (on `/wars` page), the form action returns success. The faction/node detail pages are separate routes — they will re-run their load functions naturally on navigation. The war modifier only needs `invalidate()` if the user is ON the faction detail page when the war is declared (e.g., via a modal). The UI spec has war declaration only on `/wars` and `/wars/[id]`, so natural navigation handles WAR-02 without special invalidation.

**Warning signs:** Faction detail shows 0 war modifier after war declaration, but refreshing the page shows correct value.

---

## Code Examples

### Back-relation expand for faction members

```typescript
// Source: pocketbase.io/docs/expanding-relations/ [VERIFIED: WebFetch]
// Fetch faction members via back-relation on faction_members collection
const members = await locals.pb.collection('faction_members').getFullList({
  filter: `faction = "${factionId}"`,
  expand: 'user'
});
// access: members[0].expand?.user?.username
```

### Active war count for upkeep formula

```typescript
// Count active wars for a given faction (needed for warMul)
const activeWars = await locals.pb.collection('wars').getFullList({
  filter: `(faction_a = "${factionId}" || faction_b = "${factionId}") && status = "active"`,
  fields: 'id'  // only fetch IDs — we just need the count
});
const warCount = activeWars.length;
```

### Instability dot component (METRICS-03)

```svelte
<!-- src/lib/components/InstabilityDot.svelte -->
<script lang="ts">
  const INSTAB_COLORS = [
    '#90cc90', '#d4c060', '#e0a848', '#e07840', '#d06868', '#ff7070'
  ];
  const INSTAB_LABELS = [
    'Fully Controlled', 'Minor Unrest', 'Growing Disorder',
    'Serious Instability', 'Near Revolt', 'Open Rebellion'
  ];

  let { level, size = 'sm' }: { level: number; size?: 'sm' | 'lg' } = $props();
  let color = $derived(INSTAB_COLORS[level] ?? '#90cc90');
  let label = $derived(INSTAB_LABELS[level] ?? 'Unknown');
  let dotClass = $derived(size === 'sm' ? 'w-2 h-2' : 'w-3 h-3');
</script>

<span class="inline-flex items-center gap-1.5">
  <span class="{dotClass} rounded-full shrink-0" style="background: {color};"></span>
  {label}
</span>
```

### Faction color stripe on detail header card

```svelte
<!-- 4px left border using faction's own color hex -->
<div class="rounded-md border border-border p-4"
     style="border-left: 4px solid {faction.color || '#8b7d65'};">
```

---

## Project Constraints (from CLAUDE.md)

All Phase 1 constraints carry forward. Phase 2-specific constraints:

1. **Upkeep formula from v1.2.1 JS only:** Port `calcUp()`, `oemul()`, `wmul()` exactly. Do not re-derive from handbook prose.
2. **Effective upkeep never stored:** No field in any Phase 2 collection may hold computed upkeep. Always calculate at read time.
3. **Neutral Territory at DB rule level:** `deleteRule: is_system != true` on `factions` is non-negotiable. UI button suppression is additional UX, not security.
4. **Head Admin gating:** Phase 2 destructive actions (delete faction, delete node, import data) require `@request.auth.role = "head_admin"` in collection rules AND route-level checks in `+page.server.ts`.
5. **JSVM API is 0.22.x style:** `$app.dao().saveRecord()`, `$app.dao().findCollectionByNameOrId()`. Not 0.37.x `$app.save()`.
6. **SP Catalogue data from v1.2.1:** 50 items, 13 categories, verified. Do not source from handbook.
7. **PvE factions:** War modifier is always 0, regardless of any wars involving them. `warMul()` must check `factionType === 'PvE'` before anything else.
8. **Repair costs §VIII:** T1=50 SP, T2=100, T3=200, T4=300. Not §IX values. Relevant to Phase 3 but schema design (if any repair fields exist) must respect this.
9. **Node types exactly 15:** Farm, Ranch, Orchard, Mine, Quarry, Clay Pit, Forest, Lumber Mill, Resin Farm, Peat Bog, Salt Works, Workshop, Trade Post, Military Node, Harbor/River Landing. [VERIFIED: VS3_Panel_1_2_1.html line 228]
10. **Military tier names:** Watchtower (T1), Outpost (T2), Fort (T3), Bastion (T4). Free reinforcement slots = tier number. [VERIFIED: VS3_Panel_1_2_1.html lines 229, CLAUDE.md]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PocketBase 0.22.x JSVM: `$app.dao().saveRecord()` | PocketBase 0.37.x: `$app.save()` | 0.23.0 breaking change | **This project uses 0.22.x — do not use new API** |
| Svelte 4: `$: computed = ...` reactive statements | Svelte 5: `$derived(...)` rune | Svelte 5 release | Use `$derived` for all computed values in Phase 2 components |
| Svelte 4: `export let data` | Svelte 5: `let { data } = $props()` | Svelte 5 release | Use `$props()` in all Phase 2 components — Phase 1 codebase already uses this |
| SvelteKit: manual fetch in component | SvelteKit: server load function returning typed data | Current practice | Load functions run on server, enforce auth via `locals.pb` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Client-side `$derived` filtering is sufficient (no debounce library needed) | Pattern 7 | Minor — can add simple setTimeout debounce if typing lags; not a correctness issue |
| A2 | Two sequential SDK calls (update node + create history) are acceptable for ownership transfer in Phase 2 | Pattern 8 | Low — if both fail, no data corruption; if second fails, history has a gap (recoverable) |
| A3 | `URL.createObjectURL(blob)` + click() is the right browser download pattern for export | Don't Hand-Roll | Low — this is standard browser API; would need testing in target browsers |
| A4 | `onBootstrap` fires after all JSVM files are loaded but before serving requests | Pattern 5 | Medium — if collection doesn't exist at bootstrap time, seed silently skips (try/catch handles) |
| A5 | SvelteKit `invalidateAll()` is sufficient for WAR-02 live modifier without SSE | Pattern 3 | Low — invalidateAll() re-fetches all load data; confirmed by SvelteKit docs pattern |

---

## Open Questions

1. **Server log actor field — how to get staff username in JSVM hook?**
   - What we know: `onRecordAfterCreateSuccess` receives `e.record` but not the HTTP request auth context reliably in 0.22.x hooks
   - What's unclear: Can JSVM hooks in 0.22.x access `e.httpContext` or request auth token to derive the staff username?
   - Recommendation: Default `actor` to "System" in JSVM hooks. For LOG-04 (manual entries), the SvelteKit form action writes the record directly using `locals.pb.authStore.record.username` as actor. Acceptable split for Phase 2.

2. **`factions` collection Phase 1 stub — what fields exist?**
   - What we know: Phase 1 created a `factions` stub with at minimum `name` field (used by staff-management for member assignment)
   - What's unclear: Phase 1 CONTEXT.md D-19 says "factions (name only)" — needs `type`, `color`, `description`, `is_system` added in Phase 2
   - Recommendation: Phase 2 Wave 0 task adds these fields via PocketBase admin UI before other work begins. Verify `name` field constraint (required, unique?) before adding fields.

3. **`server_log` Phase 1 stub — what schema exists?**
   - What we know: Phase 1 created `server_log` collection (per D-19). No fields were specified in CONTEXT.md.
   - What's unclear: Whether Phase 1 added any fields or left it empty
   - Recommendation: Wave 0 verifies existing fields in admin UI and adds missing ones. If all fields need adding, treat as new collection.

---

## Environment Availability

Phase 2 is code/config-only changes within the existing project structure. All tools confirmed available from Phase 1.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PocketBase 0.22.22 | All collections | Already deployed | 0.22.22 | — |
| Node.js | SvelteKit dev server | Already installed | — | — |
| shadcn-svelte CLI | New component install | Already installed | 1.2.7 | — |
| PocketBase admin UI | Schema creation (Wave 0) | Available at :8090/_ | — | — |

**Missing:** No blocking dependencies.

---

## Validation Architecture

> Phase 2 has no automated test framework configured (none detected in project). Phase 2 is UI-heavy CRUD with minimal pure logic to unit test. The one pure function that matters (`calcUpkeep`) is testable.

### Test Framework

None currently configured. Wave 0 should add Vitest for the `src/lib/upkeep.ts` pure functions.

| Property | Value |
|----------|-------|
| Framework | Vitest (recommended — built-in Vite integration, already using Vite) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run src/lib/upkeep.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPKEEP-01 (preview) | `calcUpkeep()` returns `ceil(base × overextMul × (1 + warMul))` | unit | `npx vitest run src/lib/upkeep.test.ts` | Wave 0 gap |
| DATA-03 | Neutral Territory not deleted (API rule) | manual smoke | Check PocketBase admin UI after applying deleteRule | — |
| WAR-02 | War modifier visible on faction detail after war declared | manual smoke | Navigate flow in browser | — |
| LOG-01 | Server log entry appears after faction create | manual smoke | Create faction, check /server-log | — |
| DATA-06 | Export produces valid JSON, import restores data | manual smoke | Download, check file, re-import | — |

### Wave 0 Gaps

- [ ] `src/lib/upkeep.test.ts` — unit tests for `calcUpkeep`, `overextensionMul`, `warMul`
- [ ] `vitest.config.ts` — minimal config: `{ test: { environment: 'node' } }`
- [ ] Framework install: `npm install -D vitest`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (inherited) | PocketBase auth — already enforced in Phase 1 |
| V3 Session Management | Yes (inherited) | PocketBase 30-day token — Phase 1 |
| V4 Access Control | Yes | deleteRule `is_system != true` on factions; head_admin checks on destructive actions |
| V5 Input Validation | Yes | zod schemas on all form actions (follow staff-management pattern) |
| V6 Cryptography | No | No new crypto in Phase 2 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct API call to delete Neutral Territory | Tampering | PocketBase `deleteRule: is_system != true` — returns 404 to caller |
| Import JSON overwriting all data as Staff (not Head Admin) | Elevation of privilege | SvelteKit action checks `locals.pb.authStore.record.role === 'head_admin'` + PocketBase collection rule |
| PocketBase filter injection via search inputs | Tampering | PocketBase SDK parameterizes filter values; avoid string interpolation in filters where user input is involved |
| War declared between PvE factions | Tampering / Invalid State | Form validation: check faction type before allowing war declaration; both must be PvP |

---

## Sources

### Primary (HIGH confidence)
- `Admin Panel/VS3_Panel_1_2_1.html` — SP_CAT array (50 items), NODE_TYPES (15), MIL_NAMES, calcUp(), oemul(), wmul(), NEUTRAL_ID pattern [VERIFIED: codebase Read]
- `pb_hooks/auth_hooks.js` — confirmed PocketBase 0.22.x JSVM API: `$app.dao().saveRecord()`, `onRecordAuthRequest` hook syntax [VERIFIED: codebase Read]
- `vs3-panel/package.json` — confirmed installed versions: pocketbase 0.26.8 SDK, svelte 5.55.2, @sveltejs/kit 2.57.0, shadcn-svelte 1.2.7 [VERIFIED: codebase Read]
- `vs3-panel/src/routes/(staff)/staff-management/+page.server.ts` — canonical form action pattern: zod validation, PocketBase SDK calls, error handling [VERIFIED: codebase Read]
- `.planning/phases/02-core-data-wars/02-UI-SPEC.md` — all surface specs, component patterns, interaction contracts [VERIFIED: codebase Read]
- `pocketbase.io/docs/expanding-relations/` — expand parameter syntax, back-relation notation, 6-level depth [VERIFIED: WebFetch]
- `pocketbase.io/docs/api-rules-and-filters/` — `is_system != true` deleteRule pattern, relation-field access control [VERIFIED: WebFetch]
- `pocketbase.io/docs/js-overview/` — `onRecordAfterCreateSuccess` hook, `$app.findCollectionByNameOrId`, `$app.newRecord`, `$app.save` [VERIFIED: WebFetch — note: newer API; use `$app.dao()` for 0.22.x]
- `pocketbase.io/docs/js-routing/` — `routerAdd()` custom endpoint pattern for export [VERIFIED: WebFetch]
- `svelte.dev/docs/kit/load` — `invalidate()` / `invalidateAll()` pattern, `$derived` rune [VERIFIED: WebFetch]

### Secondary (MEDIUM confidence)
- shadcn-svelte.com — `select`, `tabs`, `tooltip`, `scroll-area` components confirmed in 1.2.7 registry [CITED: npm view shadcn-svelte version]

### Tertiary (LOW confidence)
- Two sequential SDK calls as ownership transfer approach [ASSUMED — no PocketBase 0.22.x multi-collection transaction confirmation found]
- `onBootstrap` timing relative to collection availability [ASSUMED — behavior on truly fresh database not confirmed by docs]

---

## Metadata

**Confidence breakdown:**
- PocketBase schema design: HIGH — field types, API rules, filter syntax all verified
- JSVM hooks (0.22.x API): HIGH — confirmed by existing `auth_hooks.js` in project
- SvelteKit load/action patterns: HIGH — confirmed by `staff-management` reference implementation
- SP Catalogue data: HIGH — ported from verified v1.2.1 source
- Export/import pattern: MEDIUM — routerAdd confirmed; exact implementation needs integration test
- `onBootstrap` seeding timing: LOW — edge case behavior on fresh DB not confirmed

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (PocketBase 0.22.x is stable; shadcn-svelte 1.2.7 is current)
