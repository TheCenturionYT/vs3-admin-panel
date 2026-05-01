<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { format } from 'date-fns';
  import { Loader2 } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';
  import { calcUpkeep, overextensionMul, warMul } from '$lib/upkeep';

  const NODE_TYPES = [
    'Farm', 'Ranch', 'Orchard', 'Mine', 'Quarry', 'Clay Pit', 'Forest',
    'Lumber Mill', 'Resin Farm', 'Peat Bog', 'Salt Works', 'Workshop',
    'Trade Post', 'Military Node', 'Harbor/River Landing'
  ] as const;

  const MIL_TIER_LABELS: Record<number, string> = {
    1: 'Watchtower',
    2: 'Outpost',
    3: 'Fort',
    4: 'Bastion'
  };

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = data.user.role === 'head_admin';

  // Modal/dialog state
  let showEditModal = $state(false);
  let showDeleteDialog = $state(false);
  let showTransferModal = $state(false);

  // Loading states
  let saving = $state(false);
  let deleting = $state(false);
  let transferring = $state(false);

  // Effective upkeep — computed from live data, never stored
  let nodeCount = $derived(data.ownerNodeCount);
  let warCount = $derived(data.ownerWarCount);
  let factionType = $derived(data.node.ownerType ?? 'PvE');
  let isNeutral = $derived(!data.node.ownerId);

  let oeMul = $derived(overextensionMul(nodeCount));
  let wMul = $derived(warMul(warCount, factionType));
  let effectiveUpkeep = $derived(
    calcUpkeep(data.node.base_upkeep, nodeCount, warCount, factionType, isNeutral)
  );

  function formatDate(dateStr: string): string {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm');
    } catch {
      return dateStr;
    }
  }

  function tierBadgeStyle(tier: number): string {
    if (tier === 1) return 'background: rgba(139,125,101,0.12); border: 1px solid #3d3426; color: #8b7d65;';
    if (tier === 2) return 'background: rgba(139,125,101,0.18); border: 1px solid rgba(139,125,101,0.35); color: #a09070;';
    if (tier === 3) return 'background: rgba(196,164,90,0.15); border: 1px solid rgba(196,164,90,0.30); color: #c4a45a;';
    return 'background: rgba(196,164,90,0.22); border: 1px solid rgba(196,164,90,0.40); color: #d4b46a;';
  }

  function methodBadgeStyle(method: string): string {
    if (method === 'peaceful') return 'background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;';
    if (method === 'violent') return 'background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;';
    return 'background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;';
  }

  function methodLabel(method: string): string {
    if (method === 'peaceful') return 'Peaceful Transfer';
    if (method === 'violent') return 'Violent Conquest';
    return 'System';
  }

  $effect(() => {
    if (form?.success) {
      showEditModal = false;
      showDeleteDialog = false;
      showTransferModal = false;
    }
  });
</script>

<svelte:head>
  <title>{data.node.name} — VS3 Panel</title>
</svelte:head>

<!-- Back link -->
<a href="/nodes" class="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
  ← Back to Nodes
</a>

<!-- Detail header -->
<div class="rounded-md border border-border p-4 mb-6"
     style="border-left: 4px solid {data.node.ownerColor || '#8b7d65'};">
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-[22px] font-semibold text-foreground">{data.node.name}</h1>
      <div class="flex flex-wrap items-center gap-2 mt-2">
        <!-- Type badge -->
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
              style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">
          {data.node.type}
        </span>
        <!-- Tier badge -->
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold" style={tierBadgeStyle(data.node.tier)}>
          T{data.node.tier}
        </span>
        <!-- Military node tier label sub-badge -->
        {#if data.node.type === 'Military Node'}
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
                style="background: rgba(85,136,170,0.15); border: 1px solid rgba(85,136,170,0.30); color: #88bbdd;">
            {MIL_TIER_LABELS[data.node.tier]}
          </span>
        {/if}
        <!-- Instability -->
        <span class="text-[14px] text-foreground">
          <InstabilityDot level={data.node.instability} size="lg" />
        </span>
        {#if data.node.roll_due}
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
                style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff9999;">
            Roll Due
          </span>
        {/if}
        <!-- Owner -->
        {#if data.node.ownerName}
          <a href="/factions/{data.node.ownerId}"
             class="inline-flex items-center gap-1.5 text-[14px] text-foreground hover:text-primary transition-colors">
            {#if data.node.ownerColor}
              <span class="w-2 h-2 rounded-full shrink-0" style="background: {data.node.ownerColor};"></span>
            {/if}
            {data.node.ownerName}
          </a>
        {:else}
          <span class="text-[14px] text-muted-foreground">Unowned</span>
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2 ml-4">
      <button
        type="button"
        onclick={() => showEditModal = true}
        class="px-3 py-1.5 rounded-md text-[13px] border transition-colors"
        style="border-color: #c4a45a; color: #c4a45a;"
        onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
        onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
      >
        Edit
      </button>
      {#if isHeadAdmin}
        <button
          type="button"
          onclick={() => showDeleteDialog = true}
          class="px-3 py-1.5 rounded-md text-[13px] border transition-colors"
          style="border-color: #8b2b2b; color: #ff9999;"
          onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,43,43,0.12)'}
          onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
          Delete
        </button>
      {/if}
    </div>
  </div>
</div>

<!-- Military Node reinforcement slots -->
{#if data.node.type === 'Military Node'}
  <div class="bg-card border border-border rounded-md p-4 mb-4">
    <div class="text-[11px] font-semibold uppercase text-primary mb-2" style="letter-spacing: 0.07em;">
      Reinforcement Slots
    </div>
    <p class="text-[14px] text-foreground">
      <span class="font-semibold" style="color: #c4a45a;">{data.node.tier}</span>
      <span class="text-muted-foreground"> free slot{data.node.tier !== 1 ? 's' : ''} (no SP cost) — Tier {data.node.tier} {MIL_TIER_LABELS[data.node.tier]}</span>
    </p>
  </div>
{/if}

<!-- Effective Upkeep card -->
<div class="bg-card border border-border rounded-md p-4 mb-4">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Effective Upkeep
  </div>
  {#if !data.node.ownerId}
    <p class="text-[14px] text-muted-foreground">No owner — upkeep not applicable.</p>
  {:else if !data.node.base_upkeep}
    <p class="text-[14px] text-muted-foreground">No base upkeep set.</p>
  {:else}
    <div class="flex flex-wrap items-center gap-2 text-[14px]">
      <span class="text-foreground">Base: <span class="font-medium">{data.node.base_upkeep} SP</span></span>
      <span class="text-muted-foreground">×</span>
      <span class="text-foreground">Overextension: <span class="font-medium">×{oeMul.toFixed(2)}</span>
        <span class="text-muted-foreground text-[12px]"> ({nodeCount} node{nodeCount !== 1 ? 's' : ''})</span>
      </span>
      <span class="text-muted-foreground">×</span>
      {#if factionType === 'PvE'}
        <span class="text-muted-foreground">War modifier: N/A (PvE)</span>
      {:else}
        <span class="text-foreground">War modifier: <span class="font-medium">+{Math.round(wMul * 100)}%</span>
          <span class="text-muted-foreground text-[12px]"> ({warCount} active war{warCount !== 1 ? 's' : ''})</span>
        </span>
      {/if}
      <span class="text-muted-foreground">=</span>
      <span class="text-[14px] font-semibold" style="color: #c4a45a;">{effectiveUpkeep} SP/week</span>
    </div>
  {/if}
</div>

<!-- Road info -->
{#if data.node.has_road || data.node.road_note}
  <div class="bg-card border border-border rounded-md p-4 mb-4">
    <div class="text-[11px] font-semibold uppercase text-primary mb-2" style="letter-spacing: 0.07em;">Road Access</div>
    <div class="flex items-center gap-2 text-[14px]">
      <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
            style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">
        Road Connected
      </span>
      {#if data.node.road_note}
        <span class="text-muted-foreground">{data.node.road_note}</span>
      {/if}
    </div>
  </div>
{/if}

<!-- Notes -->
{#if data.node.notes}
  <div class="bg-card border border-border rounded-md p-4 mb-4">
    <div class="text-[11px] font-semibold uppercase text-primary mb-2" style="letter-spacing: 0.07em;">Notes</div>
    <p class="text-[14px] text-muted-foreground">{data.node.notes}</p>
  </div>
{/if}

<!-- Transfer Ownership section -->
<div class="bg-card border border-border rounded-md p-4 mb-4">
  <div class="flex items-center justify-between mb-3">
    <div class="text-[11px] font-semibold uppercase text-primary" style="letter-spacing: 0.07em;">
      Transfer Ownership
    </div>
    <button
      type="button"
      onclick={() => showTransferModal = true}
      class="px-3 py-1.5 rounded-md text-[13px] border transition-colors"
      style="border-color: #c4a45a; color: #c4a45a;"
      onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
      onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      Transfer
    </button>
  </div>
  <p class="text-[14px] text-muted-foreground">
    Current owner: <span class="text-foreground">{data.node.ownerName ?? 'Unowned'}</span>.
    Record an ownership change and update the timeline.
  </p>
</div>

<!-- Ownership History card -->
<div class="bg-card border border-border rounded-md p-4 mb-4">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Ownership History
  </div>
  {#if data.ownershipHistory.length === 0}
    <p class="text-[14px] text-muted-foreground">No ownership history recorded. Assign an owner to begin the timeline.</p>
  {:else}
    <div class="space-y-0">
      {#each data.ownershipHistory as entry, i}
        <div class="flex gap-3">
          <!-- Timeline dot + connector -->
          <div class="flex flex-col items-center">
            <div class="w-2 h-2 rounded-full shrink-0 mt-1.5"
                 style="background: {i === 0 ? '#c4a45a' : entry.method === 'peaceful' ? '#90cc90' : entry.method === 'violent' ? '#e07840' : '#8b7d65'};"></div>
            {#if i < data.ownershipHistory.length - 1}
              <div class="w-0.5 flex-1 my-1" style="background: #3d3426; min-height: 16px;"></div>
            {/if}
          </div>
          <!-- Entry content -->
          <div class="pb-4 flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-[14px] font-semibold text-foreground">
                {entry.fromFactionName ?? 'Unowned'} → {entry.toFactionName ?? 'Unowned'}
              </span>
              {#if i === 0}
                <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" style="color: #c4a45a; border: 1px solid rgba(196,164,90,0.3); background: rgba(196,164,90,0.1);">CURRENT</span>
              {/if}
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold" style={methodBadgeStyle(entry.method)}>
                {methodLabel(entry.method)}
              </span>
            </div>
            <div class="text-[11px] text-muted-foreground">{formatDate(entry.transfer_date)}</div>
            {#if entry.staff_note}
              <p class="text-[14px] text-muted-foreground italic mt-1">{entry.staff_note}</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Node Log card -->
<div class="bg-card border border-border rounded-md p-4 mb-4">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Node Log <span class="text-muted-foreground font-normal normal-case" style="letter-spacing: 0;">(last 50 entries)</span>
  </div>
  {#if data.nodeLog.length === 0}
    <p class="text-[14px] text-muted-foreground">No log entries for this node.</p>
  {:else}
    <table class="w-full">
      <thead>
        <tr style="border-bottom: 1px solid #3d3426;">
          <th class="text-left px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Date</th>
          <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Event</th>
          <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Description</th>
          <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actor</th>
        </tr>
      </thead>
      <tbody>
        {#each data.nodeLog as entry}
          <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
            <td class="px-0 py-2 text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(entry.created)}</td>
            <td class="px-3 py-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold"
                    style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">
                {entry.event_type}
              </span>
            </td>
            <td class="px-3 py-2 text-[14px] text-foreground">{entry.description}</td>
            <td class="px-3 py-2 text-[14px] text-muted-foreground">{entry.actor || '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Edit Node Modal -->
{#if showEditModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6 max-h-[90vh] overflow-y-auto" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="edit-modal-title" class="text-[15px] font-semibold text-foreground">Edit Node</h2>
        <button type="button" onclick={() => { showEditModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Update node details and status</p>

      <form method="POST" action="?/editNode"
        use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }}>

        <div class="grid grid-cols-2 gap-4">
          <!-- Name -->
          <div class="col-span-2">
            <label for="edit-name" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Node Name <span style="color: #ff9999;">*</span>
            </label>
            <input id="edit-name" name="name" type="text" required
              value={data.node.name}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" />
            {#if form?.action === 'editNode' && form?.errors?.name}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.name[0]}</p>
            {/if}
          </div>

          <!-- Type -->
          <div>
            <label for="edit-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Type <span style="color: #ff9999;">*</span>
            </label>
            <select id="edit-type" name="type" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              {#each NODE_TYPES as t}
                <option value={t} selected={data.node.type === t}>{t}</option>
              {/each}
            </select>
          </div>

          <!-- Tier -->
          <div>
            <label for="edit-tier" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Tier <span style="color: #ff9999;">*</span>
            </label>
            <select id="edit-tier" name="tier" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="1" selected={data.node.tier === 1}>T1</option>
              <option value="2" selected={data.node.tier === 2}>T2</option>
              <option value="3" selected={data.node.tier === 3}>T3</option>
              <option value="4" selected={data.node.tier === 4}>T4</option>
            </select>
          </div>

          <!-- Owner -->
          <div>
            <label for="edit-owner" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Owner Faction
            </label>
            <select id="edit-owner" name="owner"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="" selected={!data.node.ownerId}>Unowned</option>
              {#each data.factions as f}
                <option value={f.id} selected={data.node.ownerId === f.id}>{f.name}</option>
              {/each}
            </select>
          </div>

          <!-- Base Upkeep -->
          <div>
            <label for="edit-upkeep" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Base Upkeep (SP/week)
            </label>
            <input id="edit-upkeep" name="base_upkeep" type="number" min="0"
              value={data.node.base_upkeep || ''}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" />
          </div>

          <!-- Instability -->
          <div>
            <label for="edit-instability" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Instability (0–5)
            </label>
            <select id="edit-instability" name="instability"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="0" selected={data.node.instability === 0}>0 — Fully Controlled</option>
              <option value="1" selected={data.node.instability === 1}>1 — Minor Unrest</option>
              <option value="2" selected={data.node.instability === 2}>2 — Growing Disorder</option>
              <option value="3" selected={data.node.instability === 3}>3 — Serious Instability</option>
              <option value="4" selected={data.node.instability === 4}>4 — Near Revolt</option>
              <option value="5" selected={data.node.instability === 5}>5 — Open Rebellion</option>
            </select>
          </div>

          <!-- Roll Due -->
          <div>
            <label class="flex items-center gap-3 cursor-pointer mt-6">
              <input type="hidden" name="roll_due" value="false" />
              <input type="checkbox" name="roll_due" value="true"
                checked={data.node.roll_due}
                class="w-4 h-4 rounded"
                style="accent-color: #c4a45a;" />
              <span class="text-[14px] text-foreground">Instability Roll Due</span>
            </label>
          </div>

          <!-- Has Road -->
          <div class="col-span-2">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="hidden" name="has_road" value="false" />
              <input type="checkbox" name="has_road" value="true"
                checked={data.node.has_road}
                class="w-4 h-4 rounded"
                style="accent-color: #c4a45a;" />
              <span class="text-[14px] text-foreground">Has Road Access</span>
            </label>
          </div>

          <!-- Road Note -->
          <div class="col-span-2">
            <label for="edit-road-note" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Road Note
            </label>
            <input id="edit-road-note" name="road_note" type="text"
              value={data.node.road_note}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" />
          </div>

          <!-- Notes -->
          <div class="col-span-2">
            <label for="edit-notes" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Notes
            </label>
            <textarea id="edit-notes" name="notes" rows="3"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
              style="background: #2c2518; border: 1px solid #3d3426;">{data.node.notes}</textarea>
          </div>
        </div>

        {#if form?.action === 'editNode' && form?.errors?._global}
          <div class="mt-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end mt-6">
          <button type="button" onclick={() => { showEditModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={saving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if saving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Transfer Ownership Modal -->
{#if showTransferModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
    <div class="w-full max-w-[480px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="transfer-modal-title" class="text-[15px] font-semibold text-foreground">Transfer Ownership</h2>
        <button type="button" onclick={() => { showTransferModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">
        Transferring from: <strong class="text-foreground">{data.node.ownerName ?? 'Unowned'}</strong>
      </p>

      <form method="POST" action="?/transferOwnership"
        use:enhance={() => { transferring = true; return async ({ update }) => { await update({ reset: false }); transferring = false; }; }}>

        <div class="mb-4">
          <label for="transfer-to" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Transfer To <span style="color: #ff9999;">*</span>
          </label>
          <select id="transfer-to" name="to_faction_id" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select destination faction...</option>
            {#each data.factions as f}
              {#if f.id !== data.node.ownerId}
                <option value={f.id}>{f.name}</option>
              {/if}
            {/each}
          </select>
          {#if form?.action === 'transferOwnership' && form?.errors?.to_faction_id}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.to_faction_id[0]}</p>
          {/if}
        </div>

        <div class="mb-4">
          <label for="transfer-method" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Method <span style="color: #ff9999;">*</span>
          </label>
          <select id="transfer-method" name="method" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select method...</option>
            <option value="peaceful">Peaceful Transfer</option>
            <option value="violent">Violent Conquest</option>
            <option value="system">System</option>
          </select>
          {#if form?.action === 'transferOwnership' && form?.errors?.method}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.method[0]}</p>
          {/if}
        </div>

        <div class="mb-6">
          <label for="transfer-note" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Staff Note
          </label>
          <input id="transfer-note" name="staff_note" type="text"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional context for this transfer" />
        </div>

        {#if form?.action === 'transferOwnership' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showTransferModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={transferring}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if transferring}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Record Transfer
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteDialog}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="delete-dialog-title" class="text-[15px] font-semibold text-foreground mb-3">Delete Node</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Deleting <strong class="text-foreground">{data.node.name}</strong> will permanently remove this node and all associated ownership history and log entries. This cannot be undone.
      </p>
      <form method="POST" action="?/deleteNode"
        use:enhance={() => { deleting = true; return async ({ update }) => { await update(); deleting = false; }; }}>
        <input type="hidden" name="id" value={data.node.id} />
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
