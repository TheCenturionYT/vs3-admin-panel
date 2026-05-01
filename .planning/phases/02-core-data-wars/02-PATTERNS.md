# Phase 2: Core Data & Wars — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 26 new/modified files
**Analogs found:** 24 / 26

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `vs3-panel/src/lib/upkeep.ts` | utility | transform | — | no analog (pure TS, no Svelte) |
| `vs3-panel/src/lib/components/InstabilityDot.svelte` | component | transform | `src/routes/(staff)/staff-management/+page.svelte` (badge spans) | partial |
| `vs3-panel/src/lib/components/AppSidebar.svelte` *(modify)* | component | request-response | `src/lib/components/AppSidebar.svelte` | exact |
| `vs3-panel/src/routes/(staff)/factions/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | exact |
| `vs3-panel/src/routes/(staff)/factions/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/factions/[id]/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/factions/[id]/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/nodes/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | exact |
| `vs3-panel/src/routes/(staff)/nodes/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/nodes/[id]/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/nodes/[id]/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/wars/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/wars/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/wars/[id]/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/wars/[id]/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/diplomacy/+page.svelte` | component | CRUD | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/diplomacy/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | exact |
| `vs3-panel/src/routes/(staff)/server-log/+page.svelte` *(upgrade)* | component | request-response | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/server-log/+page.server.ts` | route | CRUD | `src/routes/(staff)/staff-management/+page.server.ts` | role-match |
| `vs3-panel/src/routes/(staff)/sp-catalogue/+page.svelte` | component | request-response | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/sp-catalogue/+page.server.ts` | route | request-response | `src/routes/(staff)/staff-management/+page.server.ts` | role-match |
| `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` | component | file-I/O | `src/routes/(staff)/staff-management/+page.svelte` | role-match |
| `vs3-panel/src/routes/(staff)/server-settings/+page.server.ts` | route | file-I/O | `src/routes/(staff)/staff-management/+page.server.ts` | role-match |
| `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` *(upgrade)* | component | request-response | `src/routes/(staff)/dashboard/+page.svelte` | exact |
| `pb_hooks/log_hooks.js` | middleware | event-driven | `pb_hooks/auth_hooks.js` | role-match |
| `pb_hooks/seed_hooks.js` | middleware | event-driven | `pb_hooks/auth_hooks.js` | role-match |

---

## Pattern Assignments

### `vs3-panel/src/lib/upkeep.ts` (utility, transform)

**Analog:** None — first pure TS utility in project. Use RESEARCH.md Pattern 2 directly.

No analog exists. Port directly from `Admin Panel/VS3_Panel_1_2_1.html` `calcUp()`, `oemul()`, `wmul()`. See RESEARCH.md lines 249–279 for the complete verified implementation. This file has no Svelte dependencies and exports three named functions: `overextensionMul`, `warMul`, `calcUpkeep`.

---

### `vs3-panel/src/lib/components/InstabilityDot.svelte` (component, transform)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte` (badge span pattern)

**Imports pattern** (lines 1–5 of analog):
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { Loader2, Plus } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';
```

**Core component pattern** — copy the `$props()` + `$derived` rune structure from the analog's script block (lines 7–8), applied to InstabilityDot:
```svelte
<script lang="ts">
  const INSTAB_COLORS = ['#90cc90', '#d4c060', '#e0a848', '#e07840', '#d06868', '#ff7070'];
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

**Badge inline style pattern** — copy from analog lines 122–125 (badge span with inline rgba styles, no Tailwind color classes):
```svelte
<span class="px-2 py-1 rounded-full text-[11px] font-semibold"
      style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">
  Active
</span>
```

---

### `vs3-panel/src/lib/components/AppSidebar.svelte` *(modify)* (component, request-response)

**Analog:** `vs3-panel/src/lib/components/AppSidebar.svelte` (exact — this file is being modified)

**Current disabled-item pattern** (lines 70–81) — used for Phase 3 items after Phase 2 items are activated:
```svelte
<div
  class="flex items-center gap-3 px-4 min-h-[44px] text-[14px] text-muted-foreground cursor-not-allowed select-none"
  title="Coming in Phase 3"
  aria-disabled="true"
>
  <item.Icon class="w-4 h-4 shrink-0 opacity-50" strokeWidth={1.5} />
  <span class="opacity-60">{item.label}</span>
  <span class="ml-auto text-[10px] font-semibold uppercase tracking-wide opacity-40">Soon</span>
</div>
```

**Active nav item pattern** (lines 46–60) — Phase 2 items must use this `<a>` pattern:
```svelte
<a
  href={item.href}
  class="flex items-center gap-3 px-4 min-h-[44px] text-[14px] transition-colors relative
         {isActive(item.href)
           ? 'text-primary'
           : 'text-muted-foreground hover:text-foreground'}"
  style={isActive(item.href)
    ? 'border-left: 2px solid #c4a45a; background: rgba(196,164,90,0.08); padding-left: 14px;'
    : 'border-left: 2px solid transparent;'}
>
  <item.Icon class="w-4 h-4 shrink-0" strokeWidth={1.5} />
  <span>{item.label}</span>
</a>
```

**Separator pattern** (lines 63–64):
```svelte
<div class="mx-4 my-2" style="border-top: 1px solid #3d3426;"></div>
```

**Modification instructions:** Move `phase2Items` entries to `activeNavItems` with `href` values. Add `Settings` icon import and `Server Settings` entry (`href: '/server-settings'`). Move Phase 2 section label + its items block to just the Phase 3 items. Phase 3 items (`Upkeep`, `Metrics`) keep the disabled pattern with `title="Coming in Phase 3"`.

Updated imports to add: `Settings` from `@lucide/svelte`.

---

### All `+page.server.ts` files — List pages (factions, nodes, wars, diplomacy, sp-catalogue, server-log)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.server.ts`

**Imports block** (lines 1–4):
```typescript
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
```

**Load function pattern** (lines 35–72) — parallel fetches with `Promise.all`, typed mapping:
```typescript
export const load: PageServerLoad = async ({ locals }) => {
  const [staffAccounts, memberAccounts, factions] = await Promise.all([
    locals.pb.collection('staff').getFullList({
      sort: 'username',
      fields: 'id,username,role,isActive,lastLogin'
    }),
    locals.pb.collection('members').getFullList({
      sort: 'username',
      expand: 'faction',
      fields: 'id,username,isActive,faction,expand'
    }),
    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name'
    })
  ]);

  return {
    staffAccounts: staffAccounts.map(a => ({
      id: a.id as string,
      username: a.username as string,
      role: a.role as 'head_admin' | 'staff',
      // ...
    })),
    // ...
  };
};
```

For Phase 2 list pages, use `expand` for relation fields. Example for factions page:
```typescript
export const load: PageServerLoad = async ({ locals }) => {
  const factions = await locals.pb.collection('factions').getFullList({
    sort: 'name'
  });
  // Count members and nodes per faction via separate queries or back-relation expand
  return { factions: factions.map(f => ({ ... })) };
};
```

**Zod schema pattern** (lines 6–33) — one schema per action, strict field types:
```typescript
const createFactionSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['PvP', 'PvE'], { message: 'Type is required.' }),
  color: z.string().optional(),
  description: z.string().optional()
});
```

**Action pattern** (lines 74–115) — safeParse → fail(400) → try/catch → fail(500) → success:
```typescript
createFaction: async ({ request, locals }) => {
  const data = await request.formData();
  const parsed = createFactionSchema.safeParse({
    name: data.get('name'),
    type: data.get('type'),
    color: data.get('color'),
    description: data.get('description')
  });

  if (!parsed.success) {
    return fail(400, {
      action: 'createFaction',
      errors: parsed.error.flatten().fieldErrors,
      values: Object.fromEntries(data)
    });
  }

  try {
    await locals.pb.collection('factions').create({
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color ?? '',
      description: parsed.data.description ?? '',
      is_system: false
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.toLowerCase().includes('name')) {
      return fail(400, {
        action: 'createFaction',
        errors: { name: ['A faction with this name already exists.'] },
        values: Object.fromEntries(data)
      });
    }
    return fail(500, {
      action: 'createFaction',
      errors: { _global: ['Something went wrong. Please try again.'] },
      values: Object.fromEntries(data)
    });
  }

  return { success: true, action: 'createFaction' };
},
```

**Head Admin gate pattern** — add this check at the top of any destructive action:
```typescript
deleteFaction: async ({ request, locals }) => {
  // Gate: head_admin only (also enforced at DB rule level)
  if (locals.pb.authStore.record?.role !== 'head_admin') {
    return fail(403, { action: 'deleteFaction', errors: { _global: ['Head Admin access required.'] } });
  }
  // ... rest of action
},
```

---

### All `+page.server.ts` files — Detail pages (`[id]`)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.server.ts`

**Load with expand pattern** — for detail pages loading relational data (copy structure, change collection + expand fields):
```typescript
export const load: PageServerLoad = async ({ locals, params }) => {
  const faction = await locals.pb.collection('factions').getOne(params.id);

  const [members, nodes, activeWars] = await Promise.all([
    locals.pb.collection('faction_members').getFullList({
      filter: `faction = "${params.id}"`,
      expand: 'user',
      sort: 'role,created'
    }),
    locals.pb.collection('nodes').getFullList({
      filter: `owner = "${params.id}"`,
      sort: 'node_number'
    }),
    locals.pb.collection('wars').getFullList({
      filter: `(faction_a = "${params.id}" || faction_b = "${params.id}") && status = "active"`,
      expand: 'faction_a,faction_b',
      fields: 'id,faction_a,faction_b,casus_belli,start_date,expand'
    })
  ]);

  return { faction, members, nodes, activeWars };
};
```

Note: `expand` field access pattern from analog line 65: `a.expand?.faction?.name as string`.

---

### `vs3-panel/src/routes/(staff)/factions/+page.svelte` (component, CRUD)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

**Script block pattern** (lines 1–58) — copy entire structure: `$props()`, `$state` for modal flags, `$state` for edit target, `$state` for loading flags, `$effect` to close modal on success:
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Plus } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let showAddModal = $state(false);
  let showDeleteDialog = $state(false);
  let deleteTarget = $state<{ id: string; name: string } | null>(null);
  let saving = $state(false);
  let deleting = $state(false);

  // Reactive filter state
  let search = $state('');
  let typeFilter = $state('all');
  let debouncedSearch = $state('');

  // Debounce: use $effect + setTimeout (no library needed)
  $effect(() => {
    const t = setTimeout(() => { debouncedSearch = search; }, 300);
    return () => clearTimeout(t);
  });

  let filteredFactions = $derived(
    data.factions.filter(f => {
      const matchesSearch = !debouncedSearch || f.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = typeFilter === 'all' || f.type === typeFilter;
      return matchesSearch && matchesType;
    })
  );

  const isHeadAdmin = data.user.role === 'head_admin';

  $effect(() => {
    if (form?.success) {
      showAddModal = false;
      showDeleteDialog = false;
    }
  });
</script>
```

**Page header pattern** (lines 65–84) — copy exactly, swap content:
```svelte
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Factions</h1>
    <p class="text-[14px] text-muted-foreground mt-1">All player factions and Neutral Territory</p>
  </div>
  {#if isHeadAdmin}
    <button
      type="button"
      onclick={() => showAddModal = true}
      class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
      style="border-color: #c4a45a; color: #c4a45a;"
      onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
      onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      <Plus class="w-4 h-4" />
      Add Faction
    </button>
  {/if}
</div>
```

**Table card pattern** (lines 100–161) — copy `bg-card border border-border rounded-md overflow-hidden` wrapper, empty state, `<table>` with `<thead>` header row and `<tbody>` rows:
```svelte
<div class="bg-card border border-border rounded-md overflow-hidden">
  {#if filteredFactions.length === 0}
    <div class="py-12 text-center">
      <p class="text-[15px] font-semibold text-foreground mb-2">No factions yet</p>
      <p class="text-[14px] text-muted-foreground">Add a faction to begin tracking nodes, members, and wars.</p>
    </div>
  {:else}
    <table class="w-full">
      <thead>
        <tr style="border-bottom: 1px solid #3d3426;">
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Name</th>
          <!-- more headers -->
        </tr>
      </thead>
      <tbody>
        {#each filteredFactions as faction}
          <tr
            style="border-bottom: 1px solid rgba(196,164,90,0.06); cursor: pointer;"
            onclick={() => goto(`/factions/${faction.id}`)}
            onkeydown={(e) => e.key === 'Enter' && goto(`/factions/${faction.id}`)}
            role="row"
            tabindex="0"
          >
            <!-- cells -->
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
```

**Clickable row navigation** — use `goto` from `$app/navigation`. Action buttons inside the row must call `e.stopPropagation()`:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
</script>
<!-- In the row's actions cell: -->
<button type="button" onclick={(e) => { e.stopPropagation(); openDeleteDialog(faction); }}>
  Delete
</button>
```

**Modal pattern** (lines 222–356) — copy modal overlay and container exactly:
```svelte
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="modal-title" class="text-[15px] font-semibold text-foreground">Add Faction</h2>
        <button type="button" onclick={() => { showAddModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <!-- form inside -->
    </div>
  </div>
{/if}
```

**Confirmation dialog pattern** (lines 359–391) — 400px max-width variant for destructive actions:
```svelte
{#if showDeleteDialog && deleteTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="delete-dialog-title" class="text-[15px] font-semibold text-foreground mb-3">Delete Faction</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Deleting <strong class="text-foreground">{deleteTarget.name}</strong> will permanently remove this faction and all associated member records...
      </p>
      <form method="POST" action="?/deleteFaction"
        use:enhance={() => { deleting = true; return async ({ update }) => { await update(); deleting = false; }; }}>
        <input type="hidden" name="id" value={deleteTarget.id} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showDeleteDialog = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={deleting}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #8b2b2b; color: #ff9999;">
            {#if deleting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Delete Faction
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
```

**Form field pattern** (lines 258–289) — label + input/select combo:
```svelte
<div class="mb-4">
  <label for="field-id" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
    Field Name <span style="color: #ff9999;">*</span>
  </label>
  <input id="field-id" name="fieldName" type="text" required
    class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426;"
    placeholder="Enter value" />
  {#if form?.action === 'createFaction' && form?.errors?.fieldName}
    <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.fieldName[0]}</p>
  {/if}
</div>
```

**Global error banner in form** (lines 290–294):
```svelte
{#if form?.action === 'createFaction' && form?.errors?._global}
  <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
    {form.errors._global[0]}
  </div>
{/if}
```

**Submit button with spinner** (lines 299–303):
```svelte
<button type="submit" disabled={saving}
  class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
  style="border-color: #c4a45a; color: #c4a45a;">
  {#if saving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
  Save Faction
</button>
```

**use:enhance pattern** (line 254):
```svelte
<form method="POST" action="?/createFaction"
  use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }}>
```

---

### `vs3-panel/src/routes/(staff)/factions/[id]/+page.svelte` (component, CRUD)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

**Back link pattern** — new for Phase 2 detail pages:
```svelte
<a href="/factions" class="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
  ← Back to Factions
</a>
```

**Detail header card with color stripe** (from RESEARCH.md Pattern):
```svelte
<div class="rounded-md border border-border p-4 mb-6"
     style="border-left: 4px solid {data.faction.color || '#8b7d65'};">
  <h1 class="text-[22px] font-semibold text-foreground">{data.faction.name}</h1>
  <div class="flex items-center gap-3 mt-1">
    <!-- PvP/PvE badge -->
    <!-- member count, node count in text-muted -->
    <!-- action buttons if isHeadAdmin && !faction.is_system -->
  </div>
</div>
```

**Section label pattern** (lines 97–99 of analog):
```svelte
<div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
  Members
</div>
```

**Upkeep derived display** — import from lib and use `$derived`:
```svelte
<script lang="ts">
  import { calcUpkeep, overextensionMul, warMul } from '$lib/upkeep';
  let { data } = $props();

  let nodeCount = $derived(data.nodes.length);
  let warCount = $derived(data.activeWars.length);
  let oeMul = $derived(overextensionMul(nodeCount));
  let wMul = $derived(warMul(warCount, data.faction.type));
</script>
```

**invalidateAll after war declaration** (from RESEARCH.md Pattern 3):
```svelte
<form method="POST" action="?/declareWar" use:enhance={() => {
  return async ({ result, update }) => {
    await update();
    if (result.type === 'success') {
      await invalidateAll();
    }
  };
}}>
```

---

### `vs3-panel/src/routes/(staff)/nodes/+page.svelte` (component, CRUD)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

Same patterns as factions list page. Additional filter state for tier and owner:
```svelte
let tierFilter = $state('all');
let ownerFilter = $state('all');

let filteredNodes = $derived(
  data.nodes.filter(n => {
    const matchesSearch = !debouncedSearch || n.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesTier = tierFilter === 'all' || n.tier === tierFilter;
    const matchesOwner = ownerFilter === 'all' || n.ownerId === ownerFilter;
    return matchesSearch && matchesTier && matchesOwner;
  })
);
```

**Tier badge pattern** — inline style for each tier (from UI-SPEC lines 397–403):
```svelte
{#if node.tier === '1'}
  <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
        style="background: rgba(139,125,101,0.12); border: 1px solid #3d3426; color: #8b7d65;">T1</span>
{:else if node.tier === '4'}
  <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
        style="background: rgba(196,164,90,0.22); border: 1px solid rgba(196,164,90,0.40); color: #d4b46a;">T4</span>
{/if}
```

---

### `vs3-panel/src/routes/(staff)/wars/+page.svelte` (component, CRUD)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

**Tabs pattern** — shadcn-svelte `Tabs` component (new in Phase 2):
```svelte
<script lang="ts">
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
</script>

<Tabs defaultValue="active">
  <TabsList>
    <TabsTrigger value="active">Active Wars</TabsTrigger>
    <TabsTrigger value="history">War History</TabsTrigger>
  </TabsList>
  <TabsContent value="active">
    <!-- active wars table, same table pattern as staff-management -->
  </TabsContent>
  <TabsContent value="history">
    <!-- history table -->
  </TabsContent>
</Tabs>
```

Tabs styling override to match VS3 gold palette — active tab underline is `#c4a45a`. Apply via component's CSS class prop or local style override.

---

### `vs3-panel/src/routes/(staff)/wars/[id]/+page.svelte` (component, CRUD)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

**Battle Log Entry pattern** — reverse-chronological list of card entries (no table, cards):
```svelte
{#each data.battles as battle}
  <div class="bg-card border border-border rounded-md p-4 mb-2">
    <div class="flex items-start justify-between">
      <span class="text-[14px] font-semibold text-foreground">{battle.expand?.node?.name ?? 'No specific node'}</span>
      <span class="text-[11px] text-muted-foreground">{formatDate(battle.battle_date)}</span>
    </div>
    <p class="text-[14px] text-muted-foreground italic mt-1">{battle.description}</p>
    {#if battle.ownership_transferred}
      <div class="mt-2 px-3 py-1.5 rounded-md text-[14px]" style="background: rgba(85,136,170,0.12); border: 1px solid rgba(85,136,170,0.25); color: #88bbdd;">
        Ownership transferred to {battle.expand?.newOwner?.name}
      </div>
    {/if}
  </div>
{/each}
```

---

### `vs3-panel/src/routes/(staff)/diplomacy/+page.svelte` (component, CRUD)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

Uses Tabs (same as wars page). Agreements displayed as cards (not table). Copy the modal overlay/container pattern. Diplomacy agreement card:
```svelte
{#each data.agreements as ag}
  <div class="bg-card border border-border rounded-md p-4 mb-2 flex items-center gap-4">
    <!-- Type badge (inline style from UI-SPEC lines 297–305) -->
    <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
          style="background: rgba(196,164,90,0.2); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;">
      {ag.type}
    </span>
    <span class="text-[15px] font-semibold text-foreground">{ag.expand?.faction_a?.name} ↔ {ag.expand?.faction_b?.name}</span>
    <span class="text-[14px] text-muted-foreground ml-auto">{formatDate(ag.start_date)}</span>
    {#if isHeadAdmin && ag.status === 'active'}
      <button type="button" onclick={() => openEndDialog(ag)}
        class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
        style="border-color: #8b2b2b; color: #ff9999;">
        End Agreement
      </button>
    {/if}
  </div>
{/each}
```

---

### `vs3-panel/src/routes/(staff)/server-log/+page.svelte` *(upgrade)* (component, request-response)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

**Filter bar pattern** — full-width bar above table, no "Apply" button:
```svelte
<div class="flex items-center gap-3 mb-4 bg-card border border-border rounded-md px-4 py-3">
  <input
    type="text"
    placeholder="Search log entries..."
    bind:value={search}
    class="flex-1 bg-transparent text-[14px] text-foreground focus:outline-none placeholder:text-muted-foreground"
  />
  <!-- shadcn Select components for event_type, faction, node filters -->
</div>
```

No row click on server log — log entries are not individually addressable (table rows are not `cursor-pointer`).

---

### `vs3-panel/src/routes/(staff)/sp-catalogue/+page.svelte` (component, request-response)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

Read-only table — no Add/Edit/Delete buttons. No `isHeadAdmin` checks needed. Filter bar with search + category select + demand select. SP Value column uses gold color:
```svelte
<td class="px-4 py-2 text-[14px] font-semibold" style="color: #c4a45a;">{item.sp_value} SP</td>
```

---

### `vs3-panel/src/routes/(staff)/server-settings/+page.svelte` (component, file-I/O)

**Analog:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte`

**Section label pattern** (from analog line 97):
```svelte
<div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
  Data Export & Import
</div>
```

**Staff read-only notice** (from analog lines 86–93):
```svelte
{#if !isHeadAdmin}
  <div class="mb-6 px-4 py-2 rounded-md text-[14px] flex items-center gap-2"
    style="background: rgba(85,136,170,0.12); border: 1px solid rgba(85,136,170,0.30); color: #88bbdd;">
    Data import requires Head Admin access.
  </div>
{/if}
```

**Export button** — gold variant, triggers form POST that returns JSON blob for browser download:
```svelte
<form method="POST" action="?/exportData" use:enhance={() => {
  return async ({ result }) => {
    if (result.type === 'success' && result.data?.exportJson) {
      const blob = new Blob([result.data.exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vs3-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}}>
  <button type="submit" class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
    style="border-color: #c4a45a; color: #c4a45a;">Export JSON</button>
</form>
```

---

### `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` *(upgrade)* (component, request-response)

**Analog:** `vs3-panel/src/routes/(staff)/dashboard/+page.svelte` (current stub being replaced)

Current stub (lines 1–23) shows a "coming in Phase 2" placeholder — replace entirely. Copy page header pattern from staff-management. Add stat cards using the card pattern:
```svelte
<!-- Stat cards row -->
<div class="grid grid-cols-3 gap-4 mb-6">
  <div class="bg-card border border-border rounded-md p-4">
    <div class="text-[11px] font-semibold uppercase text-muted-foreground mb-2" style="letter-spacing: 0.07em;">Active Factions</div>
    <div class="text-[22px] font-semibold" style="color: #c4a45a;">{data.factionCount}</div>
  </div>
  <!-- Total Nodes card -->
  <!-- Active Wars card -->
</div>
```

**Phase 3 placeholder card** — copy the stub's Construction icon pattern for "Upcoming Upkeep Deadlines" and "Scheduler Health":
```svelte
<div class="bg-card border border-border rounded-md p-6 flex flex-col items-center gap-4 py-12">
  <Construction class="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
  <p class="text-[14px] text-muted-foreground text-center">Upkeep tracking coming in Phase 3.</p>
</div>
```

---

### `pb_hooks/log_hooks.js` (middleware, event-driven)

**Analog:** `C:\Users\Kramer\Desktop\VS3\pb_hooks\auth_hooks.js`

**Hook registration pattern** (lines 5–22 of analog):
```javascript
onRecordAuthRequest((e) => {
    if (e.collection.name !== "staff") {
        e.next();
        return;
    }
    try {
        const record = e.record;
        record.set("lastLogin", new Date().toISOString());
        $app.dao().saveRecord(record);
    } catch (err) {
        console.error("[auth_hooks] Failed to update lastLogin:", err);
    }
    e.next();
}, "staff");
```

**Log hook pattern** — apply this structure for each Phase 2 collection. The collection name filter is passed as the second argument (same as `"staff"` in analog):
```javascript
// pb_hooks/log_hooks.js
onRecordAfterCreateSuccess((e) => {
    try {
        const logCol = $app.dao().findCollectionByNameOrId('server_log');
        const logRecord = new Record(logCol);
        logRecord.set('event_type', 'faction_change');
        logRecord.set('description', `Faction "${e.record.getString('name')}" was created.`);
        logRecord.set('related_faction', e.record.getId());
        logRecord.set('actor', 'System');
        $app.dao().saveRecord(logRecord);
    } catch (err) {
        // Non-fatal — log but do not break the original operation
        console.error('[log_hooks] Failed to write server log:', err);
    }
    e.next();
}, 'factions');
```

Key differences from auth_hooks analog:
- Use `onRecordAfterCreateSuccess` (not `onRecordCreate`) — fires only after confirmed save
- Use `onRecordAfterUpdateSuccess` for update events
- Pass collection name as second arg to scope the hook
- Always call `e.next()` even inside try/catch — never omit it
- Use `$app.dao().saveRecord()` not `$app.save()` (0.22.x API — confirmed by analog line 15)

---

### `pb_hooks/seed_hooks.js` (middleware, event-driven)

**Analog:** `C:\Users\Kramer\Desktop\VS3\pb_hooks\auth_hooks.js`

**Bootstrap hook pattern** — `onBootstrap` with try/catch guard (no equivalent in analog; pattern from RESEARCH.md lines 379–397):
```javascript
// pb_hooks/seed_hooks.js
onBootstrap((e) => {
    // Seed Neutral Territory faction if it doesn't exist
    try {
        $app.dao().findFirstRecordByData('factions', 'name', 'Neutral Territory');
        // Already exists — skip
    } catch {
        // Record not found — create it
        try {
            const col = $app.dao().findCollectionByNameOrId('factions');
            const record = new Record(col);
            record.set('name', 'Neutral Territory');
            record.set('type', 'PvE');
            record.set('color', '#6b6255');
            record.set('is_system', true);
            $app.dao().saveRecord(record);
            console.log('[seed] Neutral Territory created');
        } catch (err) {
            // Collection may not exist yet on fresh DB — silent skip, retry on next start
            console.error('[seed] Could not seed Neutral Territory — schema not applied yet:', err);
        }
    }

    // Seed sp_catalogue (check count first to avoid re-seeding)
    try {
        const existing = $app.dao().findRecordsByFilter('sp_catalogue', '', '', 1, 0);
        if (existing.length === 0) {
            // ... create all 50 SP_CAT records
        }
    } catch (err) {
        console.error('[seed] Could not seed sp_catalogue:', err);
    }

    e.next();
});
```

JSVM API used here: `$app.dao().findFirstRecordByData()`, `$app.dao().findCollectionByNameOrId()`, `$app.dao().saveRecord()`, `new Record(col)` — all confirmed by analog (`auth_hooks.js` line 15).

---

## Shared Patterns

### Auth: Role Check in Load Function

**Source:** `vs3-panel/src/routes/(staff)/+layout.server.ts` (lines 1–23)
**Apply to:** All `+page.server.ts` files — user role is available via parent layout data

The layout load (lines 15–21) returns `{ user: { id, username, role } }`. All page server files receive this via `locals` (for API rule enforcement) and via `data.user` in the component (for UI gating). No page server file needs to re-check auth — the layout handles redirect at lines 5–13. For destructive actions, add an explicit role check inside the action:

```typescript
// In any +page.server.ts destructive action:
if (locals.pb.authStore.record?.role !== 'head_admin') {
  return fail(403, { action: 'deleteX', errors: { _global: ['Head Admin access required.'] } });
}
```

### Error Handling

**Source:** `vs3-panel/src/routes/(staff)/staff-management/+page.server.ts` (lines 99–113)
**Apply to:** All form actions in all `+page.server.ts` files

Three-tier pattern: zod validation fail → specific API error → generic 500:
```typescript
// Tier 1: zod
if (!parsed.success) {
  return fail(400, { action: 'actionName', errors: parsed.error.flatten().fieldErrors, values: Object.fromEntries(data) });
}
// Tier 2: specific API error (optional — only when a known error is detectable)
if (message.toLowerCase().includes('unique constraint')) {
  return fail(400, { action: 'actionName', errors: { fieldName: ['Must be unique.'] }, values: Object.fromEntries(data) });
}
// Tier 3: generic
return fail(500, { action: 'actionName', errors: { _global: ['Something went wrong. Please try again.'] }, values: Object.fromEntries(data) });
```

### Modal State Management

**Source:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte` (lines 9–58)
**Apply to:** All list and detail page components with modals

Pattern: `$state` boolean flag per modal + `$state` target object + `$effect` to close on form success:
```svelte
let showModal = $state(false);
let modalTarget = $state<{ id: string; name: string } | null>(null);

$effect(() => {
  if (form?.success) {
    showModal = false;
  }
});
```

### Color Tokens (Inline Styles)

**Source:** `vs3-panel/src/app.css` (lines 1–44)
**Apply to:** All component files — never hardcode hex values not in this list

All components use inline `style=` attributes for rgba badge colors (not Tailwind utilities, since they are dynamic per instability level or faction type). The CSS variables are:
- `#1a1410` — background primary
- `#231d14` — card background (modals, sidebar)
- `#2c2518` — inputs, muted bg
- `#c4a45a` — gold accent (primary)
- `#d4b46a` — gold hover
- `#d4c5a0` — text foreground
- `#8b7d65` — text muted
- `#3d3426` — border
- `#8b2b2b` — destructive

### Section Label

**Source:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte` (lines 97–99)
**Apply to:** All detail pages and any section heading inside a card

```svelte
<div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
  Section Name
</div>
```

### PocketBase SDK — JSVM API Version Lock

**Source:** `C:\Users\Kramer\Desktop\VS3\pb_hooks\auth_hooks.js` (line 15)
**Apply to:** All JSVM hook files (`log_hooks.js`, `seed_hooks.js`)

This project runs PocketBase 0.22.22. Use ONLY:
- `$app.dao().saveRecord(record)` — NOT `$app.save(record)`
- `$app.dao().findCollectionByNameOrId(name)` — NOT `$app.findCollectionByNameOrId()`
- `$app.dao().findFirstRecordByData(col, field, value)`
- `$app.dao().findRecordsByFilter(col, filter, sort, limit, offset)`
- `new Record(collection)` — constructor takes collection object

### `use:enhance` with Loading State

**Source:** `vs3-panel/src/routes/(staff)/staff-management/+page.svelte` (line 254)
**Apply to:** Every `<form>` in every component file

```svelte
<form method="POST" action="?/actionName"
  use:enhance={() => {
    saving = true;
    return async ({ update }) => {
      await update({ reset: false });
      saving = false;
    };
  }}>
```

Use `reset: false` to preserve form values on validation error. Use plain `update()` (without `reset: false`) on destructive confirm dialogs where re-showing the form is not needed.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vs3-panel/src/lib/upkeep.ts` | utility | transform | No pure TS utility library files exist yet in the project. Source functions directly from `Admin Panel/VS3_Panel_1_2_1.html` `calcUp()`, `oemul()`, `wmul()` as specified in CLAUDE.md and RESEARCH.md. |

---

## Metadata

**Analog search scope:** `vs3-panel/src/routes/(staff)/`, `vs3-panel/src/lib/components/`, `vs3-panel/src/hooks.server.ts`, `pb_hooks/`, `vs3-panel/src/app.css`
**Files scanned:** 8 source files fully read
**Phase 1 codebase maturity:** High — staff-management is a complete, production-quality reference for all CRUD surfaces
**Pattern extraction date:** 2026-05-01
