<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { Loader2, Plus } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';

  const NODE_TYPES = [
    'Farm', 'Herd / Ranch', 'Orchard', 'Mine', 'Quarry', 'Clay Pit', 'Forest',
    'Lumber Mill', 'Resin Farm', 'Peat Bog', 'Salt Works', 'Workshop',
    'Trade Post', 'Military Node', 'Harbor'
  ] as const;

  const MIL_TIER_LABELS: Record<number, string> = {
    1: 'Watchtower',
    2: 'Outpost',
    3: 'Fort',
    4: 'Bastion'
  };

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Modal state
  let showAddModal = $state(false);
  let showDeleteDialog = $state(false);
  let deleteTarget = $state<{ id: string; name: string } | null>(null);

  // Loading states
  let saving = $state(false);
  let deleting = $state(false);

  // Filter state
  let typeFilter = $state('all');
  let tierFilter = $state('all');
  let ownerFilter = $state('all');
  let search = $state('');
  let debouncedSearch = $state('');

  const isHeadAdmin = data.user.role === 'head_admin';

  $effect(() => {
    const t = setTimeout(() => { debouncedSearch = search; }, 300);
    return () => clearTimeout(t);
  });

  let filteredNodes = $derived(
    data.nodes.filter(n => {
      const matchesSearch = !debouncedSearch || n.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = typeFilter === 'all' || n.type === typeFilter;
      const matchesTier = tierFilter === 'all' || String(n.tier) === tierFilter;
      const matchesOwner = ownerFilter === 'all' || (ownerFilter === 'unowned' ? !n.ownerId : n.ownerId === ownerFilter);
      return matchesSearch && matchesType && matchesTier && matchesOwner;
    })
  );

  function openDeleteDialog(node: { id: string; name: string }) {
    deleteTarget = { id: node.id, name: node.name };
    showDeleteDialog = true;
  }

  function tierBadgeStyle(tier: number): string {
    if (tier === 1) return 'background: rgba(139,125,101,0.12); border: 1px solid #3d3426; color: #8b7d65;';
    if (tier === 2) return 'background: rgba(139,125,101,0.18); border: 1px solid rgba(139,125,101,0.35); color: #a09070;';
    if (tier === 3) return 'background: rgba(196,164,90,0.15); border: 1px solid rgba(196,164,90,0.30); color: #c4a45a;';
    return 'background: rgba(196,164,90,0.22); border: 1px solid rgba(196,164,90,0.40); color: #d4b46a;';
  }

  $effect(() => {
    if (form?.success) {
      showAddModal = false;
      showDeleteDialog = false;
    }
  });
</script>

<svelte:head>
  <title>Nodes — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Nodes</h1>
    <p class="text-[14px] text-muted-foreground mt-1">All territory nodes and their current ownership</p>
  </div>
  <button
    type="button"
    onclick={() => showAddModal = true}
    class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
    style="border-color: #c4a45a; color: #c4a45a;"
    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
  >
    <Plus class="w-4 h-4" />
    New Node
  </button>
</div>

<!-- Filter bar -->
<div class="flex items-center gap-3 mb-4 bg-card border border-border rounded-md px-4 py-3">
  <input
    type="text"
    placeholder="Search nodes..."
    bind:value={search}
    class="flex-1 bg-transparent text-[14px] text-foreground focus:outline-none placeholder:text-muted-foreground"
  />
  <select
    bind:value={typeFilter}
    class="px-3 py-1.5 rounded-md text-[13px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; min-width: 160px;"
  >
    <option value="all">All Types</option>
    {#each NODE_TYPES as t}
      <option value={t}>{t}</option>
    {/each}
  </select>
  <select
    bind:value={tierFilter}
    class="px-3 py-1.5 rounded-md text-[13px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; min-width: 100px;"
  >
    <option value="all">All Tiers</option>
    <option value="1">T1</option>
    <option value="2">T2</option>
    <option value="3">T3</option>
    <option value="4">T4</option>
  </select>
  <select
    bind:value={ownerFilter}
    class="px-3 py-1.5 rounded-md text-[13px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; min-width: 160px;"
  >
    <option value="all">All Owners</option>
    <option value="unowned">Unowned</option>
    {#each data.factions as f}
      <option value={f.id}>{f.name}</option>
    {/each}
  </select>
</div>

<!-- Nodes table -->
<div class="bg-card border border-border rounded-md overflow-hidden">
  {#if filteredNodes.length === 0}
    <div class="py-12 text-center">
      <p class="text-[15px] font-semibold text-foreground mb-2">No nodes found</p>
      <p class="text-[14px] text-muted-foreground">
        {data.nodes.length === 0 ? 'Create a node to start tracking territory.' : 'No nodes match the current filters.'}
      </p>
    </div>
  {:else}
    <table class="w-full">
      <thead>
        <tr style="border-bottom: 1px solid #3d3426;">
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Name</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Type</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Tier</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Owner</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Instability</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Base Upkeep</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredNodes as node}
          <tr
            style="border-bottom: 1px solid rgba(196,164,90,0.06); cursor: pointer;"
            onclick={() => goto(`/nodes/${node.id}`)}
            onkeydown={(e) => e.key === 'Enter' && goto(`/nodes/${node.id}`)}
            role="row"
            tabindex="0"
          >
            <td class="px-4 py-2">
              <span class="text-[14px] text-foreground font-medium">{node.name}</span>
              {#if node.roll_due}
                <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold" style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff9999;">Roll Due</span>
              {/if}
            </td>
            <td class="px-4 py-2 text-[14px] text-muted-foreground">{node.type}</td>
            <td class="px-4 py-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold" style={tierBadgeStyle(node.tier)}>T{node.tier}</span>
              {#if node.type === 'Military Node'}
                <span class="ml-1 text-[11px] text-muted-foreground">{MIL_TIER_LABELS[node.tier]}</span>
              {/if}
            </td>
            <td class="px-4 py-2">
              {#if node.ownerName}
                <span class="inline-flex items-center gap-1.5 text-[14px] text-foreground">
                  {#if node.ownerColor}
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {node.ownerColor};"></span>
                  {/if}
                  {node.ownerName}
                </span>
              {:else}
                <span class="text-[14px] text-muted-foreground">—</span>
              {/if}
            </td>
            <td class="px-4 py-2 text-[14px] text-foreground">
              <InstabilityDot level={node.instability} />
            </td>
            <td class="px-4 py-2 text-[14px] text-muted-foreground">
              {node.base_upkeep ? `${node.base_upkeep} SP` : '—'}
            </td>
            <td class="px-4 py-2">
              {#if isHeadAdmin}
                <button
                  type="button"
                  onclick={(e) => { e.stopPropagation(); openDeleteDialog(node); }}
                  class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                  style="border-color: #8b2b2b; color: #ff9999;"
                >
                  Delete
                </button>
              {:else}
                <span class="text-[14px] text-muted-foreground">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Create Node Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="modal-title" class="text-[15px] font-semibold text-foreground">New Node</h2>
        <button type="button" onclick={() => { showAddModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Add a territory node and assign an owner faction</p>

      <form method="POST" action="?/createNode"
        use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }}>

        <div class="grid grid-cols-2 gap-4">
          <!-- Name -->
          <div class="col-span-2 mb-0">
            <label for="node-name" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Node Name <span style="color: #ff9999;">*</span>
            </label>
            <input id="node-name" name="name" type="text" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder="e.g. Northern Mine" />
            {#if form?.action === 'createNode' && form?.errors?.name}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.name[0]}</p>
            {/if}
          </div>

          <!-- Type -->
          <div>
            <label for="node-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Type <span style="color: #ff9999;">*</span>
            </label>
            <select id="node-type" name="type" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select type...</option>
              {#each NODE_TYPES as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
            {#if form?.action === 'createNode' && form?.errors?.type}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.type[0]}</p>
            {/if}
          </div>

          <!-- Tier -->
          <div>
            <label for="node-tier" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Tier <span style="color: #ff9999;">*</span>
            </label>
            <select id="node-tier" name="tier" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select tier...</option>
              <option value="1">T1</option>
              <option value="2">T2</option>
              <option value="3">T3</option>
              <option value="4">T4</option>
            </select>
            {#if form?.action === 'createNode' && form?.errors?.tier}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.tier[0]}</p>
            {/if}
          </div>

          <!-- Owner: nodes always start neutral — use Transfer Ownership to assign -->

          <!-- Base Upkeep -->
          <div>
            <label for="node-upkeep" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Base Upkeep (SP/week)
            </label>
            <input id="node-upkeep" name="base_upkeep" type="number" min="0"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder="e.g. 80" />
          </div>

          <!-- Has Road -->
          <div class="col-span-2">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="hidden" name="has_road" value="false" />
              <input type="checkbox" name="has_road" value="true"
                class="w-4 h-4 rounded"
                style="accent-color: #c4a45a;" />
              <span class="text-[14px] text-foreground">Has Road Access</span>
            </label>
          </div>

          <!-- Road Note -->
          <div class="col-span-2">
            <label for="node-road-note" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Road Note
            </label>
            <input id="node-road-note" name="road_note" type="text"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder="Optional road connection details" />
          </div>

          <!-- Notes -->
          <div class="col-span-2">
            <label for="node-notes" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Notes
            </label>
            <textarea id="node-notes" name="notes" rows="2"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder="Optional notes about this node"></textarea>
          </div>
        </div>

        {#if form?.action === 'createNode' && form?.errors?._global}
          <div class="mt-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end mt-6">
          <button type="button" onclick={() => { showAddModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={saving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if saving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Create Node
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Dialog -->
{#if showDeleteDialog && deleteTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="delete-dialog-title" class="text-[15px] font-semibold text-foreground mb-3">Delete Node</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Deleting <strong class="text-foreground">{deleteTarget.name}</strong> will permanently remove this node and all associated ownership history and log entries. This cannot be undone.
      </p>
      <form method="POST" action="?/deleteNode"
        use:enhance={() => { deleting = true; return async ({ update }) => { await update(); deleting = false; }; }}>
        <input type="hidden" name="id" value={deleteTarget.id} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showDeleteDialog = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={deleting}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #8b2b2b; color: #ff9999;">
            {#if deleting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Delete Node
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
