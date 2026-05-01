<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { Loader2, Plus } from '@lucide/svelte';
  import { calcUpkeep, overextensionMul, warMul } from '$lib/upkeep';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Modal / dialog state
  let showAddModal = $state(false);
  let showDeleteDialog = $state(false);
  let deleteTarget = $state<{ id: string; name: string } | null>(null);
  let saving = $state(false);
  let deleting = $state(false);

  // Filter state
  let search = $state('');
  let typeFilter = $state('all');
  let debouncedSearch = $state('');

  $effect(() => {
    const t = setTimeout(() => { debouncedSearch = search; }, 300);
    return () => clearTimeout(t);
  });

  const isHeadAdmin = data.user.role === 'head_admin';

  let filteredFactions = $derived(
    data.factions.filter(f => {
      const matchesSearch = !debouncedSearch || f.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = typeFilter === 'all' || f.type === typeFilter;
      return matchesSearch && matchesType;
    })
  );

  function openDeleteDialog(faction: { id: string; name: string }) {
    deleteTarget = { id: faction.id, name: faction.name };
    showDeleteDialog = true;
  }

  // Format effective upkeep as a total for the faction (sum across owned nodes would
  // require full node data — here we show the overextension multiplier instead since
  // we only have counts, not base_upkeep per node on the list page)
  function formatOeMul(nodeCount: number): string {
    return `×${overextensionMul(nodeCount).toFixed(2).replace(/\.?0+$/, '')}`;
  }

  function formatWarMul(warCount: number, type: 'PvP' | 'PvE'): string {
    if (type === 'PvE') return 'N/A (PvE)';
    const pct = warMul(warCount, type) * 100;
    return pct === 0 ? '+0%' : `+${pct}%`;
  }

  $effect(() => {
    if (form?.success) {
      showAddModal = false;
      showDeleteDialog = false;
    }
  });
</script>

<svelte:head>
  <title>Factions — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Factions</h1>
    <p class="text-[14px] text-muted-foreground mt-1">All player factions and Neutral Territory</p>
  </div>
  {#if isHeadAdmin}
    <button
      type="button"
      onclick={() => { showAddModal = true; }}
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

<!-- Filter bar -->
<div class="flex items-center gap-3 mb-4 bg-card border border-border rounded-md px-4 py-3">
  <input
    type="text"
    placeholder="Search factions..."
    bind:value={search}
    class="flex-1 bg-transparent text-[14px] text-foreground focus:outline-none placeholder:text-muted-foreground"
  />
  <select
    bind:value={typeFilter}
    class="px-3 py-1.5 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; min-width: 140px;"
  >
    <option value="all">All Types</option>
    <option value="PvP">PvP</option>
    <option value="PvE">PvE</option>
  </select>
</div>

<!-- Factions table -->
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
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Type</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Nodes</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Members</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Upkeep Mod</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Status</th>
          {#if isHeadAdmin}
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
          {/if}
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
            onmouseover={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(196,164,90,0.03)'}
            onmouseout={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
          >
            <!-- Name + color dot -->
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  style="background: {faction.color || '#8b7d65'};"
                ></span>
                <span class="text-[14px] font-semibold text-foreground">{faction.name}</span>
              </div>
            </td>
            <!-- Type badge -->
            <td class="px-4 py-2">
              {#if faction.type === 'PvP'}
                <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
                  style="background: rgba(200,100,40,0.15); border: 1px solid rgba(200,100,40,0.25); color: #e07840;">
                  PvP
                </span>
              {:else}
                <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
                  style="background: rgba(61,107,61,0.15); border: 1px solid rgba(61,107,61,0.25); color: #90cc90;">
                  PvE
                </span>
              {/if}
            </td>
            <!-- Node count -->
            <td class="px-4 py-2 text-[14px] text-muted-foreground">{faction.nodeCount}</td>
            <!-- Member count -->
            <td class="px-4 py-2 text-[14px] text-muted-foreground">{faction.memberCount}</td>
            <!-- Upkeep modifiers summary -->
            <td class="px-4 py-2 text-[14px] text-muted-foreground">
              <span class="font-semibold" style="color: #c4a45a;">{formatOeMul(faction.nodeCount)}</span>
              <span class="ml-1 text-[11px]">{formatWarMul(faction.warCount, faction.type)}</span>
            </td>
            <!-- Status -->
            <td class="px-4 py-2">
              <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
                style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">
                Active
              </span>
            </td>
            <!-- Actions (head_admin only, no delete for is_system) -->
            {#if isHeadAdmin}
              <td class="px-4 py-2">
                {#if !faction.isSystem}
                  <button
                    type="button"
                    onclick={(e) => { e.stopPropagation(); openDeleteDialog(faction); }}
                    class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                    style="border-color: #8b2b2b; color: #ff9999;"
                  >
                    Delete
                  </button>
                {:else}
                  <span class="text-[14px] text-muted-foreground">—</span>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Add Faction Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="add-faction-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="add-faction-title" class="text-[15px] font-semibold text-foreground">Add Faction</h2>
        <button type="button" onclick={() => { showAddModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Create a new player faction</p>

      <form method="POST" action="?/createFaction"
        use:enhance={() => {
          saving = true;
          return async ({ update }) => { await update({ reset: false }); saving = false; };
        }}>

        <!-- Name -->
        <div class="mb-4">
          <label for="faction-name" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Name <span style="color: #ff9999;">*</span>
          </label>
          <input id="faction-name" name="name" type="text" required
            value={form?.values?.name ?? ''}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Enter faction name" />
          {#if form?.action === 'createFaction' && form?.errors?.name}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.name[0]}</p>
          {/if}
        </div>

        <!-- Type -->
        <div class="mb-4">
          <label for="faction-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Type <span style="color: #ff9999;">*</span>
          </label>
          <select id="faction-type" name="type" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="" disabled selected={!form?.values?.type}>Select type...</option>
            <option value="PvP" selected={form?.values?.type === 'PvP'}>PvP</option>
            <option value="PvE" selected={form?.values?.type === 'PvE'}>PvE</option>
          </select>
          {#if form?.action === 'createFaction' && form?.errors?.type}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.type[0]}</p>
          {/if}
        </div>

        <!-- Color -->
        <div class="mb-4">
          <label for="faction-color" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Color
          </label>
          <div class="flex items-center gap-3">
            <input id="faction-color" name="color" type="color"
              value={form?.values?.color ?? '#c4a45a'}
              class="h-9 w-16 rounded cursor-pointer"
              style="background: #2c2518; border: 1px solid #3d3426; padding: 2px;" />
            <span class="text-[14px] text-muted-foreground">Faction color dot and header stripe</span>
          </div>
        </div>

        <!-- Description -->
        <div class="mb-6">
          <label for="faction-description" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Description
          </label>
          <textarea id="faction-description" name="description" rows="3"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional faction description">{form?.values?.description ?? ''}</textarea>
        </div>

        {#if form?.action === 'createFaction' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showAddModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if saving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Save Faction
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Faction Dialog -->
{#if showDeleteDialog && deleteTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="delete-faction-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="delete-faction-title" class="text-[15px] font-semibold text-foreground mb-3">Delete Faction</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Deleting <strong class="text-foreground">{deleteTarget.name}</strong> will permanently remove this faction
        and all associated member records. Node ownership will be reassigned to Neutral Territory.
        This cannot be undone.
      </p>

      {#if form?.action === 'deleteFaction' && form?.errors?._global}
        <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
          {form.errors._global[0]}
        </div>
      {/if}

      <form method="POST" action="?/deleteFaction"
        use:enhance={() => {
          deleting = true;
          return async ({ update }) => { await update(); deleting = false; };
        }}>
        <input type="hidden" name="id" value={deleteTarget.id} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showDeleteDialog = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
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
