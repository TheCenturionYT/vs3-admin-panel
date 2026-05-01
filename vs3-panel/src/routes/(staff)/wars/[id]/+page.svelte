<script lang="ts">
  import { enhance } from '$app/forms';
  import { format, differenceInDays } from 'date-fns';
  import { Loader2, ArrowLeft, Plus, Shield } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = data.user.role === 'head_admin';
  const war = data.war;

  // Derived values
  const isActive = $derived(war.status === 'active');
  const activeSieges = $derived(data.sieges.filter((s: typeof data.sieges[number]) => !s.resolved));

  // Log Battle modal state
  let showLogBattleModal = $state(false);
  let logBattleSaving = $state(false);
  let ownershipTransferred = $state(false);
  let selectedBattleNode = $state('');

  // Add Siege modal state
  let showAddSiegeModal = $state(false);
  let addSiegeSaving = $state(false);

  // Resolve Siege modal state
  let showResolveModal = $state(false);
  let resolveTarget = $state<{ id: string; nodeName: string } | null>(null);
  let resolvingSaving = $state(false);

  function openResolveModal(siege: { id: string; nodeName: string }) {
    resolveTarget = siege;
    showResolveModal = true;
  }

  function formatDate(d: string): string {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
  }

  function formatDateTime(d: string): string {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
  }

  function calcDaysIntoSiege(start: string): number {
    try { return differenceInDays(new Date(), new Date(start)); } catch { return 0; }
  }

  function outcomeLabel(outcome: string): string {
    if (outcome === 'Victory_A') return `Victory — ${war.factionAName}`;
    if (outcome === 'Victory_B') return `Victory — ${war.factionBName}`;
    if (outcome === 'Stalemate') return 'Stalemate';
    return outcome || '—';
  }

  $effect(() => {
    if (form?.success) {
      showLogBattleModal = false;
      showAddSiegeModal = false;
      showResolveModal = false;
      ownershipTransferred = false;
      selectedBattleNode = '';
    }
  });

  const today = format(new Date(), 'yyyy-MM-dd');
</script>

<svelte:head>
  <title>{war.factionAName} vs {war.factionBName} — VS3 Panel</title>
</svelte:head>

<!-- Back link -->
<a href="/wars" class="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
  <ArrowLeft class="w-4 h-4" />
  Back to Wars
</a>

<!-- Detail Header Card -->
<div class="rounded-md border border-border p-5 mb-6" style="border-left: 4px solid #e07840;">
  <div class="flex items-start justify-between gap-4">
    <div class="flex-1 min-w-0">
      <h1 class="text-[22px] font-semibold text-foreground flex items-center gap-3 flex-wrap">
        <span class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full shrink-0" style="background: {war.factionAColor || '#8b7d65'};"></span>
          {war.factionAName}
        </span>
        <span class="text-muted-foreground text-[18px]">vs</span>
        <span class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full shrink-0" style="background: {war.factionBColor || '#8b7d65'};"></span>
          {war.factionBName}
        </span>
      </h1>

      <div class="flex items-center gap-3 mt-2 flex-wrap">
        {#if war.status === 'active'}
          <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;">Active</span>
        {:else}
          <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">Ended</span>
          {#if war.outcome === 'Victory_A' || war.outcome === 'Victory_B'}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">{outcomeLabel(war.outcome)}</span>
          {:else if war.outcome === 'Stalemate'}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">Stalemate</span>
          {/if}
        {/if}

        <span class="text-[14px] text-muted-foreground">{formatDate(war.startDate)}{war.endDate ? ` — ${formatDate(war.endDate)}` : ' — Ongoing'}</span>
      </div>

      {#if war.casusBelli}
        <p class="text-[14px] text-muted-foreground mt-2">
          <span class="text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.05em;">Casus Belli:</span>
          {war.casusBelli}
        </p>
      {/if}

      {#if war.notes}
        <p class="text-[14px] text-muted-foreground mt-1 italic">{war.notes}</p>
      {/if}
    </div>

    <!-- Action buttons -->
    {#if isActive}
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onclick={() => showAddSiegeModal = true}
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] border transition-colors"
          style="border-color: #3d3426; color: #8b7d65;"
          onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#d4c5a0'}
          onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#8b7d65'}
        >
          <Shield class="w-4 h-4" />
          Add Siege
        </button>
        <button
          type="button"
          onclick={() => showLogBattleModal = true}
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] border transition-colors"
          style="border-color: #c4a45a; color: #c4a45a;"
          onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
          onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
          <Plus class="w-4 h-4" />
          Log Battle
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Active Sieges Section (only when war is active and there are active sieges) -->
{#if isActive && activeSieges.length > 0}
  <div class="mb-6">
    <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
      Active Sieges
    </div>
    <div class="flex flex-col gap-3">
      {#each activeSieges as siege}
        <div class="bg-card border border-border rounded-md p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[14px] font-semibold text-foreground">{siege.nodeName}</span>
                <span class="text-[11px] text-muted-foreground">— Day {calcDaysIntoSiege(siege.startDate)} of siege</span>
              </div>
              <p class="text-[14px] text-muted-foreground">
                {siege.attackerName} <span class="text-muted-foreground">→</span> {siege.defenderName}
              </p>
              {#if siege.objectives}
                <p class="text-[14px] text-muted-foreground mt-1 italic">{siege.objectives}</p>
              {/if}
              <p class="text-[11px] text-muted-foreground mt-1">Started {formatDate(siege.startDate)}</p>
            </div>
            <button
              type="button"
              onclick={() => openResolveModal(siege)}
              class="px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors shrink-0"
              style="border-color: #3d3426; color: #8b7d65;"
              onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#d4c5a0'}
              onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#8b7d65'}
            >
              Resolve Siege
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Battle Log Section -->
<div class="mb-6">
  <div class="flex items-center justify-between mb-3">
    <div class="text-[11px] font-semibold uppercase text-primary" style="letter-spacing: 0.07em;">
      Battle Log
    </div>
    {#if isActive}
      <button
        type="button"
        onclick={() => showLogBattleModal = true}
        class="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] border transition-colors"
        style="border-color: #c4a45a; color: #c4a45a;"
        onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
        onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
      >
        <Plus class="w-3.5 h-3.5" />
        Log Battle
      </button>
    {/if}
  </div>

  {#if data.battles.length === 0}
    <div class="bg-card border border-border rounded-md py-10 text-center">
      <p class="text-[15px] font-semibold text-foreground mb-1">No battles logged yet</p>
      <p class="text-[14px] text-muted-foreground">Log a battle outcome to begin tracking this war's history.</p>
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each data.battles as battle}
        <div class="bg-card border border-border rounded-md p-4">
          <div class="flex items-start justify-between gap-4 mb-2">
            <span class="text-[14px] font-semibold text-foreground">
              {battle.nodeName || 'No specific node'}
            </span>
            <span class="text-[11px] text-muted-foreground shrink-0">{formatDateTime(battle.battleDate)}</span>
          </div>
          <p class="text-[14px] text-muted-foreground mb-1">
            {battle.attackerName} <span class="text-muted-foreground">→</span> {battle.defenderName}
          </p>
          {#if battle.result}
            <p class="text-[14px] text-muted-foreground font-semibold">{battle.result}</p>
          {/if}
          {#if battle.description}
            <p class="text-[14px] text-muted-foreground italic mt-1">{battle.description}</p>
          {/if}
          {#if battle.ownershipTransferred}
            <div class="mt-2 px-3 py-1.5 rounded-md text-[13px]" style="background: rgba(85,136,170,0.12); border: 1px solid rgba(85,136,170,0.25); color: #88bbdd;">
              Ownership transferred to {battle.attackerName}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Log Battle Modal -->
{#if showLogBattleModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="log-battle-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="log-battle-title" class="text-[15px] font-semibold text-foreground">Log Battle Outcome</h2>
        <button type="button" onclick={() => { showLogBattleModal = false; ownershipTransferred = false; selectedBattleNode = ''; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Record the outcome of a battle during this war.</p>

      <form method="POST" action="?/logBattle"
        use:enhance={() => { logBattleSaving = true; return async ({ update }) => { await update({ reset: false }); logBattleSaving = false; }; }}>

        <div class="mb-4">
          <label for="battle-node" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Node
          </label>
          <select id="battle-node" name="node"
            bind:value={selectedBattleNode}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">No specific node</option>
            {#each data.nodes as node}
              <option value={node.id}>#{node.nodeNumber} — {node.name}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="battle-attacker" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Attacker <span style="color: #ff9999;">*</span>
            </label>
            <select id="battle-attacker" name="attacker" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select attacker...</option>
              <option value={war.factionAId}>{war.factionAName}</option>
              <option value={war.factionBId}>{war.factionBName}</option>
            </select>
            {#if form?.action === 'logBattle' && form?.errors?.attacker}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.attacker[0]}</p>
            {/if}
          </div>
          <div>
            <label for="battle-defender" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Defender <span style="color: #ff9999;">*</span>
            </label>
            <select id="battle-defender" name="defender" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select defender...</option>
              <option value={war.factionAId}>{war.factionAName}</option>
              <option value={war.factionBId}>{war.factionBName}</option>
            </select>
          </div>
        </div>

        <div class="mb-4">
          <label for="battle-result" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Result
          </label>
          <input id="battle-result" name="result" type="text"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="e.g. Attacker victory, Defender held, Draw..." />
        </div>

        <div class="mb-4">
          <label for="battle-date" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Battle Date <span style="color: #ff9999;">*</span>
          </label>
          <input id="battle-date" name="battle_date" type="date" required
            value={today}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;" />
          {#if form?.action === 'logBattle' && form?.errors?.battle_date}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.battle_date[0]}</p>
          {/if}
        </div>

        <div class="mb-4">
          <label for="battle-description" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Description
          </label>
          <textarea id="battle-description" name="description" rows={3}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="What happened in this battle?"
          ></textarea>
        </div>

        <!-- Ownership Transfer -->
        <div class="mb-4 p-3 rounded-md" style="background: #2c2518; border: 1px solid #3d3426;">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="ownership_transferred"
              value="true"
              bind:checked={ownershipTransferred}
              class="w-4 h-4 rounded"
              style="accent-color: #c4a45a;"
            />
            <span class="text-[14px] text-foreground">This battle resulted in an ownership transfer</span>
          </label>
          {#if ownershipTransferred && selectedBattleNode}
            <div class="mt-3 px-3 py-2 rounded-md text-[13px]" style="background: rgba(85,136,170,0.10); border: 1px solid rgba(85,136,170,0.20); color: #88bbdd;">
              This will create an ownership transfer record and update the node's owner to the attacker faction.
            </div>
          {/if}
        </div>

        {#if form?.action === 'logBattle' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showLogBattleModal = false; ownershipTransferred = false; selectedBattleNode = ''; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={logBattleSaving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if logBattleSaving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Log Battle
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Add Siege Modal -->
{#if showAddSiegeModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="add-siege-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="add-siege-title" class="text-[15px] font-semibold text-foreground">Add Siege</h2>
        <button type="button" onclick={() => { showAddSiegeModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Record an ongoing siege during this war.</p>

      <form method="POST" action="?/addSiege"
        use:enhance={() => { addSiegeSaving = true; return async ({ update }) => { await update({ reset: false }); addSiegeSaving = false; }; }}>

        <div class="mb-4">
          <label for="siege-node" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Node Being Sieged <span style="color: #ff9999;">*</span>
          </label>
          <select id="siege-node" name="node" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select node...</option>
            {#each data.nodes as node}
              <option value={node.id}>#{node.nodeNumber} — {node.name}</option>
            {/each}
          </select>
          {#if form?.action === 'addSiege' && form?.errors?.node}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.node[0]}</p>
          {/if}
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="siege-attacker" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Attacker <span style="color: #ff9999;">*</span>
            </label>
            <select id="siege-attacker" name="attacker" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select attacker...</option>
              <option value={war.factionAId}>{war.factionAName}</option>
              <option value={war.factionBId}>{war.factionBName}</option>
            </select>
          </div>
          <div>
            <label for="siege-defender" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Defender <span style="color: #ff9999;">*</span>
            </label>
            <select id="siege-defender" name="defender" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select defender...</option>
              <option value={war.factionAId}>{war.factionAName}</option>
              <option value={war.factionBId}>{war.factionBName}</option>
            </select>
          </div>
        </div>

        <div class="mb-4">
          <label for="siege-start-date" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Start Date <span style="color: #ff9999;">*</span>
          </label>
          <input id="siege-start-date" name="start_date" type="date" required
            value={today}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;" />
        </div>

        <div class="mb-6">
          <label for="siege-objectives" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Objectives
          </label>
          <textarea id="siege-objectives" name="objectives" rows={3}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="What are the siege objectives?"
          ></textarea>
        </div>

        {#if form?.action === 'addSiege' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showAddSiegeModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={addSiegeSaving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if addSiegeSaving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Add Siege
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Resolve Siege Modal -->
{#if showResolveModal && resolveTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="resolve-siege-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="resolve-siege-title" class="text-[15px] font-semibold text-foreground mb-1">Resolve Siege</h2>
      <p class="text-[14px] text-muted-foreground mb-4">
        Mark the siege of <strong class="text-foreground">{resolveTarget.nodeName}</strong> as resolved.
      </p>

      <form method="POST" action="?/resolveSiege"
        use:enhance={() => { resolvingSaving = true; return async ({ update }) => { await update(); resolvingSaving = false; }; }}>
        <input type="hidden" name="id" value={resolveTarget.id} />

        <div class="mb-6">
          <label for="resolution-note" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Resolution Note
          </label>
          <textarea id="resolution-note" name="resolution_note" rows={3}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="How was the siege resolved?"
          ></textarea>
        </div>

        {#if form?.action === 'resolveSiege' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showResolveModal = false; resolveTarget = null; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={resolvingSaving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if resolvingSaving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Resolve Siege
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
