<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { format } from 'date-fns';
  import { Loader2, History, Dice5, AlertTriangle, Zap } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';
  import { calcUpkeep, overextensionMul, warMul } from '$lib/upkeep';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Progress } from '$lib/components/ui/progress';
  import { INSTAB_CHANCE, INSTAB_LABEL, pickEvent } from '$lib/instab_events';

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

  // === Tab state ===
  let activeTab = $state<'overview' | 'cycle-history' | 'node-log'>('overview');

  // === Phase 2 modal/dialog state ===
  let showEditModal = $state(false);
  let showDeleteDialog = $state(false);
  let showTransferModal = $state(false);

  // === Phase 3 submission modal state ===
  let showSubmissionModal = $state(false);
  let submissionType = $state<'upkeep' | 'instability_reduction' | 'repair' | 'upgrade'>('upkeep');
  let selectedItemId = $state('');
  let qty = $state(1);
  let staffNote = $state('');
  let submitting = $state(false);

  // === Remove submission dialog state ===
  let removeDialogOpen = $state(false);
  let pendingRemoveId = $state('');

  // === Instability roll state ===
  let rolling = $state(false);
  let lastRoll = $state<null | { roll: number; threshold: number; triggered: boolean; event: ReturnType<typeof pickEvent> | null; savedRollId: string | null }>(null);
  let showRollHistory = $state(false);

  // === Phase 2 loading states ===
  let saving = $state(false);
  let deleting = $state(false);
  let transferring = $state(false);

  // === Phase 2 effective upkeep (computed from live data, never stored) ===
  let nodeCount = $derived(data.ownerNodeCount);
  let warCount = $derived(data.ownerWarCount);
  let factionType = $derived(data.node.ownerType ?? 'PvE');
  let isNeutral = $derived(!data.node.ownerId);

  let oeMul = $derived(overextensionMul(nodeCount));
  let wMul = $derived(warMul(warCount, factionType));
  let effectiveUpkeep = $derived(
    calcUpkeep(data.node.base_upkeep, nodeCount, warCount, factionType, isNeutral)
  );

  // === Phase 3 submission derived values ===
  const selectedItem = $derived(data.spCatalogue?.find((i: { id: string }) => i.id === selectedItemId));
  const newSpValue = $derived(
    submissionType === 'upkeep' ? (selectedItem ? (selectedItem as { sp_value: number }).sp_value * qty : 0)
    : submissionType === 'instability_reduction' ? 40
    : submissionType === 'repair' ? (data.repairCost ?? 0)
    : submissionType === 'upgrade' ? (data.upgradeCost ?? 0)
    : 0
  );

  const capPreview = $derived((() => {
    if (submissionType !== 'upkeep' || !selectedItem) {
      return { applicable: submissionType === 'upkeep', ok: true, rrPct: 0, cPct: 0, rrSP: 0, cSP: 0, cap: 0 };
    }
    const all = [...(data.currentSubmissions ?? []),
                 { category: (selectedItem as { category: string }).category, sp_value: newSpValue }];
    const eff = data.effectiveUpkeep || 1;
    const rrSP = all.filter((s: { category: string }) => s.category === 'Raw Renewable')
                    .reduce((sum: number, s: { sp_value: number }) => sum + s.sp_value, 0);
    const cSP  = all.filter((s: { category: string }) => s.category === 'Currency')
                    .reduce((sum: number, s: { sp_value: number }) => sum + s.sp_value, 0);
    const rrPct = Math.round(rrSP / eff * 100);
    const cPct  = Math.round(cSP / eff * 100);
    return { applicable: true, ok: rrPct <= 40 && cPct <= 40, rrPct, cPct, rrSP, cSP, cap: Math.round(eff * 0.4) };
  })());

  const upgradeBlocked = $derived(submissionType === 'upgrade' && (data.node?.tier ?? 0) >= 4);
  const submitDisabled = $derived(submitting || (submissionType === 'upkeep' && !capPreview.ok) || upgradeBlocked);

  // === Current cycle totals ===
  const cycleTotalSP = $derived(
    (data.currentSubmissions ?? []).reduce((sum: number, s: { sp_value: number }) => sum + s.sp_value, 0)
  );
  // Only upkeep-type submissions count toward the progress bar — repair/upgrade are additional costs
  const upkeepPaidSP = $derived(
    (data.currentSubmissions ?? [])
      .filter((s: { submission_type: string }) => s.submission_type === 'upkeep')
      .reduce((sum: number, s: { sp_value: number }) => sum + s.sp_value, 0)
  );

  const cycleProgressPct = $derived(
    effectiveUpkeep > 0 ? Math.min(100, Math.round(upkeepPaidSP / effectiveUpkeep * 100)) : 0
  );
  const cycleFullyPaid = $derived(effectiveUpkeep > 0 && upkeepPaidSP >= effectiveUpkeep);
  let confirmingCycle = $state(false);

  // === Submission modal label ===
  const submitLabel = $derived(
    submissionType === 'repair' ? 'Log Repair'
    : submissionType === 'upgrade' ? 'Log Upgrade'
    : submissionType === 'instability_reduction' ? 'Reduce Instability'
    : 'Log Submission'
  );

  // === $effect for form feedback / modal close ===
  $effect(() => {
    if (form?.success) {
      if (form.action === 'editNode' || form.action === 'transferOwnership') {
        showEditModal = false;
        showDeleteDialog = false;
        showTransferModal = false;
      }
      if (form.action === 'logSubmission') {
        showSubmissionModal = false;
        selectedItemId = '';
        qty = 1;
        staffNote = '';
      }
      if (form.action === 'removeSubmission') {
        removeDialogOpen = false;
        pendingRemoveId = '';
      }
      if (form.action === 'resolveEvent') {
        lastRoll = null;
      }
      if (form.action === 'confirmCycle') {
        // no extra state to clear
      }
    }
  });

  function rollD100() {
    const instab = (data.node?.instability ?? 0) as number;
    const threshold = INSTAB_CHANCE[instab] ?? 0;
    const roll = Math.floor(Math.random() * 100) + 1;
    const triggered = roll <= threshold;
    const event = triggered ? pickEvent((data.node?.type ?? '') as string) : null;
    lastRoll = { roll, threshold, triggered, event, savedRollId: null };
  }

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

  function outcomeBadgeStyle(outcome: string): string {
    if (outcome === 'paid') return 'background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;';
    if (outcome === 'partial') return 'background: rgba(180,160,50,0.2); border: 1px solid rgba(180,160,50,0.3); color: #d4c060;';
    if (outcome === 'underfunded') return 'background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;';
    return 'background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff7070;';
  }

  function paymentPctColor(pct: number): string {
    if (pct >= 100) return '#90cc90';
    if (pct >= 50) return '#d4c060';
    if (pct >= 1) return '#e07840';
    return '#ff7070';
  }

  function instabDeltaColor(delta: number): string {
    if (delta === 0) return '#8b7d65';
    if (delta === 1) return '#d4c060';
    return '#ff7070';
  }

  function capBarColor(pct: number): string {
    if (pct > 40) return '#8b2b2b';
    if (pct > 30) return '#d4c060';
    return '#3d6b3d';
  }

  function typeBadgeStyle(t: string): string {
    if (t === 'instability_reduction') return 'background: rgba(85,136,170,0.15); border: 1px solid rgba(85,136,170,0.3); color: #88bbdd;';
    if (t === 'upgrade') return 'background: rgba(196,164,90,0.15); border: 1px solid rgba(196,164,90,0.3); color: #d4b46a;';
    return 'background: rgba(139,125,101,0.12); border: 1px solid #3d3426; color: #8b7d65;';
  }
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

<!-- ======================== TABS ======================== -->
<Tabs.Root bind:value={activeTab}>
  <Tabs.List class="border-b border-border rounded-none bg-transparent h-auto p-0 gap-0 mb-4">
    <Tabs.Trigger value="overview"
      class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors">
      Overview
    </Tabs.Trigger>
    <Tabs.Trigger value="cycle-history"
      class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors flex items-center gap-1.5">
      <History class="w-3.5 h-3.5" />
      Cycle History
    </Tabs.Trigger>
    <Tabs.Trigger value="node-log"
      class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors">
      Node Log
    </Tabs.Trigger>
  </Tabs.List>

  <!-- ===================== OVERVIEW TAB ===================== -->
  <Tabs.Content value="overview">

    <!-- ---- CURRENT CYCLE SUBMISSIONS ---- -->
    <div class="bg-card border border-border rounded-md p-4 mb-4">
      <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">CURRENT CYCLE SUBMISSIONS</div>

      {#if (data.currentSubmissions ?? []).length === 0}
        <p class="text-[14px] text-muted-foreground text-center py-6">No submissions logged for this cycle.</p>
        <div class="flex justify-center mt-2">
          <button
            type="button"
            onclick={() => { submissionType = 'upkeep'; showSubmissionModal = true; }}
            class="px-3 py-1.5 rounded-md text-[13px] border transition-colors"
            style="border-color: #c4a45a; color: #c4a45a;"
            onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
            onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >
            Log Submission
          </button>
        </div>
      {:else}
        <table class="w-full text-[14px] mb-3">
          <thead>
            <tr style="border-bottom: 1px solid #3d3426;">
              <th class="text-left px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Item</th>
              <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Category</th>
              <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Qty</th>
              <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">SP</th>
              <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Type</th>
              <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Note</th>
              <th class="text-right px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each (data.currentSubmissions ?? []) as sub (sub.id)}
              <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
                <td class="px-0 py-2 text-[14px] text-foreground">{sub.item_name}</td>
                <td class="px-3 py-2 text-[14px] text-muted-foreground">{sub.category}</td>
                <td class="px-3 py-2 text-[14px] text-muted-foreground text-right">{sub.qty}</td>
                <td class="px-3 py-2 text-right">
                  <span class="text-[14px] font-semibold" style="color: #c4a45a;">{sub.sp_value} SP</span>
                </td>
                <td class="px-3 py-2">
                  <span class="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={typeBadgeStyle(sub.submission_type)}>
                    {sub.submission_type === 'instability_reduction' ? 'Instab. Red.' : sub.submission_type}
                  </span>
                </td>
                <td class="px-3 py-2 text-[14px] text-muted-foreground italic" title={sub.staff_note}>
                  {sub.staff_note ? sub.staff_note.slice(0, 40) + (sub.staff_note.length > 40 ? '…' : '') : '—'}
                </td>
                <td class="px-0 py-2 text-right">
                  <button
                    type="button"
                    onclick={() => { pendingRemoveId = sub.id; removeDialogOpen = true; }}
                    class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                    style="border-color: #8b2b2b; color: #ff9999;"
                    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,43,43,0.12)'}
                    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <!-- Progress bar -->
        {#if effectiveUpkeep > 0}
          <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] text-muted-foreground">Upkeep progress</span>
              <span class="text-[11px] font-semibold" style="color: {cycleFullyPaid ? '#90cc90' : cycleProgressPct >= 50 ? '#d4c060' : '#e07840'};">
                {upkeepPaidSP} / {effectiveUpkeep} SP ({cycleProgressPct}%)
              </span>
            </div>
            <div class="relative w-full rounded h-2 overflow-hidden" style="background: #2c2518;">
              <div class="h-full rounded transition-all" style="width: {cycleProgressPct}%; background: {cycleFullyPaid ? '#3d6b3d' : cycleProgressPct >= 50 ? '#8a7a30' : '#8b4020'};"></div>
            </div>
            {#if cycleFullyPaid}
              <p class="text-[11px] mt-1 font-semibold" style="color: #90cc90;">✓ Upkeep requirement met for this cycle</p>
            {/if}
          </div>
        {/if}
        <div class="flex items-center justify-between mt-2">
          <span class="text-[14px] text-muted-foreground">
            Total SP this cycle: <span class="font-semibold" style="color: #c4a45a;">{cycleTotalSP} SP</span>
          </span>
          <div class="flex items-center gap-2">
            {#if cycleFullyPaid}
              <form method="POST" action="?/confirmCycle"
                use:enhance={() => { confirmingCycle = true; return async ({ update }) => { await update(); confirmingCycle = false; }; }}>
                <button type="submit" disabled={confirmingCycle}
                  class="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50"
                  style="border-color: #3d6b3d; color: #90cc90; background: rgba(61,107,61,0.08);">
                  {#if confirmingCycle}<Loader2 class="w-3 h-3 animate-spin" />{/if}
                  Confirm Week Paid
                </button>
              </form>
            {/if}
            <button
              type="button"
              onclick={() => { submissionType = 'upkeep'; showSubmissionModal = true; }}
              class="px-3 py-1.5 rounded-md text-[13px] border transition-colors"
              style="border-color: #c4a45a; color: #c4a45a;"
              onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
              onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >
              Log Submission
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- ---- INSTABILITY CHECK (only when roll_due = true) ---- -->
    {#if data.node?.roll_due}
      {@const instabLevel = data.node.instability ?? 0}
      {@const instabChance = INSTAB_CHANCE[instabLevel] ?? 0}
      {@const instabLabel = INSTAB_LABEL[instabLevel] ?? 'Unknown'}
      <div class="bg-card border border-border rounded-md p-4 mb-4">
        <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">INSTABILITY CHECK</div>

        <div class="flex items-center justify-between mb-4">
          <span class="text-[14px] text-foreground">
            Roll required — <span class="font-semibold">{instabLabel}</span>
            <span class="text-muted-foreground"> ({instabChance}% event chance)</span>
          </span>
          {#if !lastRoll}
            <button
              type="button"
              onclick={rollD100}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border transition-colors"
              style="border-color: #c4a45a; color: #c4a45a;"
              onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
              onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >
              <Dice5 class="w-4 h-4" />
              Roll d100
            </button>
          {/if}
        </div>

        {#if lastRoll}
          <!-- Dice display -->
          <div class="flex flex-col items-center mb-4">
            <div class="w-12 h-12 rounded flex items-center justify-center mb-2"
                 style="background: #2c2518; border: 1px solid #3d3426;">
              <span class="text-[22px] font-semibold text-foreground">{lastRoll.roll}</span>
            </div>
            {#if !lastRoll.triggered}
              <p class="text-[14px]" style="color: #90cc90;">
                No event triggered ({lastRoll.roll} &gt; {lastRoll.threshold})
              </p>
            {:else}
              <p class="text-[14px] font-semibold" style="color: #e07840;">
                Event triggered ({lastRoll.roll} ≤ {lastRoll.threshold})
              </p>
            {/if}
          </div>

          <!-- Step 1: Save roll via ?/rollInstability (required before resolving) -->
          {#if !lastRoll.savedRollId}
            <form method="POST" action="?/rollInstability"
              use:enhance={() => {
                rolling = true;
                return async ({ result, update }) => {
                  if (result.type === 'success' && result.data && typeof result.data === 'object' && 'rollId' in result.data) {
                    if (lastRoll) {
                      lastRoll = { ...lastRoll, savedRollId: result.data.rollId as string };
                    }
                    // Don't call update() for triggered events — we need to keep lastRoll state
                    if (!lastRoll?.triggered) {
                      await update();
                    }
                  } else {
                    await update();
                  }
                  rolling = false;
                };
              }}>
              <input type="hidden" name="roll" value={lastRoll.roll} />
              <input type="hidden" name="threshold" value={lastRoll.threshold} />
              <input type="hidden" name="triggered" value={String(lastRoll.triggered)} />
              {#if lastRoll.event}
                <input type="hidden" name="event_name" value={lastRoll.event.name} />
                <input type="hidden" name="event_desc" value={lastRoll.event.desc} />
                <input type="hidden" name="event_effect" value={lastRoll.event.effect} />
                {#if lastRoll.event.spCost !== undefined}
                  <input type="hidden" name="sp_cost" value={lastRoll.event.spCost} />
                {/if}
                {#if lastRoll.event.instabAdd !== undefined}
                  <input type="hidden" name="instab_add" value={lastRoll.event.instabAdd} />
                {/if}
                {#if lastRoll.event.outputPenalty !== undefined}
                  <input type="hidden" name="output_penalty" value={lastRoll.event.outputPenalty} />
                {/if}
                {#if lastRoll.event.choice}
                  <input type="hidden" name="is_choice" value="true" />
                {/if}
                {#if lastRoll.event.rp}
                  <input type="hidden" name="is_rp" value="true" />
                {/if}
              {/if}
              <div class="flex justify-center">
                <button type="submit" disabled={rolling}
                  class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
                  style="border-color: #c4a45a; color: #c4a45a;">
                  {#if rolling}<Loader2 class="w-4 h-4 animate-spin" />{/if}
                  {lastRoll.triggered ? 'Save Roll' : 'Save Roll & Clear'}
                </button>
              </div>
            </form>
          {/if}

          <!-- Step 2: Event card + ?/resolveEvent action buttons (after roll is saved) -->
          {#if lastRoll.triggered && lastRoll.event && lastRoll.savedRollId}
            {@const ev = lastRoll.event}
            {@const rollId = lastRoll.savedRollId}
            <div class="rounded-md p-4 mb-4" style="background: rgba(200,100,40,0.08); border: 1px solid rgba(200,100,40,0.2);">
              <div class="text-[15px] font-semibold text-foreground mb-1">{ev.name}</div>
              <div class="text-[14px] text-muted-foreground italic mb-2">{ev.desc}</div>
              <div class="text-[14px] text-foreground mb-3">{ev.effect}</div>
              <!-- Metadata -->
              <div class="flex flex-wrap gap-3 text-[11px] mb-3">
                {#if ev.spCost !== undefined && ev.spCost > 0}
                  <span class="text-muted-foreground">SP Cost: <span class="text-foreground">{ev.spCost} SP</span></span>
                {/if}
                {#if ev.instabAdd !== undefined && ev.instabAdd > 0}
                  <span class="text-muted-foreground">Instab: <span style="color: #ff7070;">+{ev.instabAdd}</span></span>
                {/if}
                {#if ev.outputPenalty !== undefined && ev.outputPenalty > 0}
                  <span class="text-muted-foreground">Output Penalty: <span style="color: #e07840;">{ev.outputPenalty}%</span></span>
                {/if}
                {#if ev.choice}
                  <span class="font-semibold" style="color: #d4c060;">Choice available — staff determines outcome</span>
                {/if}
                {#if ev.rp}
                  <span class="font-semibold" style="color: #88bbdd;">Requires RP resolution</span>
                {/if}
              </div>

              <!-- ?/resolveEvent action buttons -->
              <div class="flex flex-wrap gap-2">
                {#if ev.instabAdd !== undefined && ev.instabAdd > 0}
                  <form method="POST" action="?/resolveEvent"
                    use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="apply_instability" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50"
                      style="background: rgba(139,43,43,0.15); border-color: rgba(139,43,43,0.4); color: #ff9999;">
                      Apply Instability (+{ev.instabAdd})
                    </button>
                  </form>
                {/if}

                {#if ev.spCost !== undefined && ev.spCost > 0}
                  <form method="POST" action="?/resolveEvent"
                    use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="log_sp_debt" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50"
                      style="border-color: #3d3426; color: #d4c5a0;">
                      Log SP Debt
                    </button>
                  </form>
                {/if}

                {#if ev.outputPenalty !== undefined && ev.outputPenalty > 0}
                  <form method="POST" action="?/resolveEvent"
                    use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="mark_output_penalty" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50"
                      style="border-color: #3d3426; color: #d4c5a0;">
                      Mark Output Penalty
                    </button>
                  </form>
                {/if}

                {#if ev.rp}
                  <form method="POST" action="?/resolveEvent"
                    use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="mark_rp_handled" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50"
                      style="border-color: #3d3426; color: #d4c5a0;">
                      Mark RP Handled
                    </button>
                  </form>
                {/if}

                <!-- Resolve / Dismiss — always available -->
                <form method="POST" action="?/resolveEvent"
                  use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                  <input type="hidden" name="roll_id" value={rollId} />
                  <input type="hidden" name="resolved_action" value="dismiss" />
                  <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50"
                    style="border-color: #3d3426; color: #d4c5a0;">
                    Resolve / Dismiss
                  </button>
                </form>
              </div>
            </div>
          {/if}

          <!-- Roll history toggle -->
          {#if (data.instabilityRolls ?? []).length > 0}
            <button
              type="button"
              onclick={() => showRollHistory = !showRollHistory}
              class="text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              {showRollHistory ? 'Hide' : 'View'} roll history ({data.instabilityRolls.length} roll{data.instabilityRolls.length !== 1 ? 's' : ''})
            </button>
          {/if}
        {/if}

        <!-- Roll history table (when no active roll but history exists) -->
        {#if !lastRoll && (data.instabilityRolls ?? []).length > 0}
          <button
            type="button"
            onclick={() => showRollHistory = !showRollHistory}
            class="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRollHistory ? 'Hide' : 'View'} roll history ({data.instabilityRolls.length} roll{data.instabilityRolls.length !== 1 ? 's' : ''})
          </button>
        {/if}
      </div>
    {/if}

    <!-- Manual instability roll + roll history (when roll_due = false) -->
    {#if !data.node?.roll_due}
      <div class="bg-card border border-border rounded-md p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.07em;">
            MANUAL INSTABILITY ROLL
          </div>
          {#if !lastRoll}
            <button
              type="button"
              onclick={rollD100}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border transition-colors"
              style="border-color: #c4a45a; color: #c4a45a;"
              onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
              onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >
              <Dice5 class="w-4 h-4" />
              Roll d100
            </button>
          {/if}
        </div>

        {#if lastRoll}
          <!-- Reuse same dice display + save/resolve form from roll_due section -->
          <div class="flex flex-col items-center mb-4">
            <div class="w-12 h-12 rounded flex items-center justify-center mb-2"
                 style="background: #2c2518; border: 1px solid #3d3426;">
              <span class="text-[22px] font-semibold text-foreground">{lastRoll.roll}</span>
            </div>
            {#if !lastRoll.triggered}
              <p class="text-[14px]" style="color: #90cc90;">No event triggered ({lastRoll.roll} &gt; {lastRoll.threshold})</p>
            {:else}
              <p class="text-[14px] font-semibold" style="color: #e07840;">Event triggered ({lastRoll.roll} ≤ {lastRoll.threshold})</p>
            {/if}
          </div>

          {#if !lastRoll.savedRollId}
            <form method="POST" action="?/rollInstability"
              use:enhance={() => {
                rolling = true;
                return async ({ result, update }) => {
                  if (result.type === 'success' && result.data && typeof result.data === 'object' && 'rollId' in result.data) {
                    if (lastRoll) lastRoll = { ...lastRoll, savedRollId: result.data.rollId as string };
                    if (!lastRoll?.triggered) await update();
                  } else {
                    await update();
                  }
                  rolling = false;
                };
              }}>
              <input type="hidden" name="roll" value={lastRoll.roll} />
              <input type="hidden" name="threshold" value={lastRoll.threshold} />
              <input type="hidden" name="triggered" value={String(lastRoll.triggered)} />
              {#if lastRoll.event}
                <input type="hidden" name="event_name" value={lastRoll.event.name} />
                <input type="hidden" name="event_desc" value={lastRoll.event.desc} />
                <input type="hidden" name="event_effect" value={lastRoll.event.effect} />
                {#if lastRoll.event.spCost !== undefined}<input type="hidden" name="sp_cost" value={lastRoll.event.spCost} />{/if}
                {#if lastRoll.event.instabAdd !== undefined}<input type="hidden" name="instab_add" value={lastRoll.event.instabAdd} />{/if}
                {#if lastRoll.event.outputPenalty !== undefined}<input type="hidden" name="output_penalty" value={lastRoll.event.outputPenalty} />{/if}
                {#if lastRoll.event.choice}<input type="hidden" name="is_choice" value="true" />{/if}
                {#if lastRoll.event.rp}<input type="hidden" name="is_rp" value="true" />{/if}
              {/if}
              <div class="flex justify-center">
                <button type="submit" disabled={rolling}
                  class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
                  style="border-color: #c4a45a; color: #c4a45a;">
                  {#if rolling}<Loader2 class="w-4 h-4 animate-spin" />{/if}
                  {lastRoll.triggered ? 'Save Roll' : 'Save Roll & Clear'}
                </button>
              </div>
            </form>
          {/if}

          {#if lastRoll.triggered && lastRoll.event && lastRoll.savedRollId}
            {@const ev = lastRoll.event}
            {@const rollId = lastRoll.savedRollId}
            <div class="rounded-md p-4 mb-4" style="background: rgba(200,100,40,0.08); border: 1px solid rgba(200,100,40,0.2);">
              <div class="text-[15px] font-semibold text-foreground mb-1">{ev.name}</div>
              <div class="text-[14px] text-muted-foreground italic mb-2">{ev.desc}</div>
              <div class="text-[14px] text-foreground mb-3">{ev.effect}</div>
              <div class="flex flex-wrap gap-3 text-[11px] mb-3">
                {#if ev.spCost !== undefined && ev.spCost > 0}<span class="text-muted-foreground">SP Cost: <span class="text-foreground">{ev.spCost} SP</span></span>{/if}
                {#if ev.instabAdd !== undefined && ev.instabAdd > 0}<span class="text-muted-foreground">Instab: <span style="color: #ff7070;">+{ev.instabAdd}</span></span>{/if}
                {#if ev.outputPenalty !== undefined && ev.outputPenalty > 0}<span class="text-muted-foreground">Output Penalty: <span style="color: #e07840;">{ev.outputPenalty}%</span></span>{/if}
                {#if ev.choice}<span class="font-semibold" style="color: #d4c060;">Choice available</span>{/if}
                {#if ev.rp}<span class="font-semibold" style="color: #88bbdd;">Requires RP resolution</span>{/if}
              </div>
              <div class="flex flex-wrap gap-2">
                {#if ev.instabAdd !== undefined && ev.instabAdd > 0}
                  <form method="POST" action="?/resolveEvent" use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="apply_instability" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50" style="background: rgba(139,43,43,0.15); border-color: rgba(139,43,43,0.4); color: #ff9999;">Apply Instability (+{ev.instabAdd})</button>
                  </form>
                {/if}
                {#if ev.spCost !== undefined && ev.spCost > 0}
                  <form method="POST" action="?/resolveEvent" use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="log_sp_debt" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50" style="border-color: #3d3426; color: #d4c5a0;">Log SP Debt ({ev.spCost} SP)</button>
                  </form>
                {/if}
                {#if ev.outputPenalty !== undefined && ev.outputPenalty > 0}
                  <form method="POST" action="?/resolveEvent" use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="mark_output_penalty" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50" style="border-color: #3d3426; color: #d4c5a0;">Mark Output Penalty ({ev.outputPenalty}%)</button>
                  </form>
                {/if}
                {#if ev.rp}
                  <form method="POST" action="?/resolveEvent" use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                    <input type="hidden" name="roll_id" value={rollId} />
                    <input type="hidden" name="resolved_action" value="mark_rp_handled" />
                    <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50" style="border-color: #3d3426; color: #d4c5a0;">Mark RP Handled</button>
                  </form>
                {/if}
                <form method="POST" action="?/resolveEvent" use:enhance={() => { rolling = true; return async ({ update }) => { await update(); rolling = false; }; }}>
                  <input type="hidden" name="roll_id" value={rollId} />
                  <input type="hidden" name="resolved_action" value="dismiss" />
                  <button type="submit" disabled={rolling} class="px-3 py-1.5 rounded-md text-[13px] border transition-colors disabled:opacity-50" style="border-color: #3d3426; color: #d4c5a0;">Resolve / Dismiss</button>
                </form>
              </div>
            </div>
          {/if}
        {/if}

        {#if (data.instabilityRolls ?? []).length > 0}
          <button type="button" onclick={() => showRollHistory = !showRollHistory}
            class="text-[11px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
            style="letter-spacing: 0.07em;">
            {showRollHistory ? '▾' : '▸'} INSTABILITY ROLL HISTORY ({data.instabilityRolls.length})
          </button>
          {#if showRollHistory}
            <table class="w-full text-[14px] mt-3">
              <thead>
                <tr style="border-bottom: 1px solid #3d3426;">
                  <th class="text-left px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Date</th>
                  <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Roll</th>
                  <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Threshold</th>
                  <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Triggered</th>
                  <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Event</th>
                </tr>
              </thead>
              <tbody>
                {#each (data.instabilityRolls ?? []) as r (r.id)}
                  <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
                    <td class="px-0 py-2 text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(r.created)}</td>
                    <td class="px-3 py-2 text-[14px] text-foreground text-right">{r.roll}</td>
                    <td class="px-3 py-2 text-[14px] text-muted-foreground text-right">{r.threshold}</td>
                    <td class="px-3 py-2">
                      {#if r.triggered}
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" style="background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;">Yes</span>
                      {:else}
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">No</span>
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-[14px] text-muted-foreground">
                      {#if r.event_name}
                        <span title={[r.event_desc, r.event_effect].filter(Boolean).join(' — ')} style="cursor: help; border-bottom: 1px dashed currentColor;">
                          {r.event_name}
                        </span>
                      {:else}
                        —
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- ---- Road info ---- -->
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

    <!-- ---- Notes ---- -->
    {#if data.node.notes}
      <div class="bg-card border border-border rounded-md p-4 mb-4">
        <div class="text-[11px] font-semibold uppercase text-primary mb-2" style="letter-spacing: 0.07em;">Notes</div>
        <p class="text-[14px] text-muted-foreground">{data.node.notes}</p>
      </div>
    {/if}

    <!-- ---- Transfer Ownership section ---- -->
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

    <!-- ---- Ownership History card ---- -->
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

  </Tabs.Content>

  <!-- ===================== CYCLE HISTORY TAB ===================== -->
  <Tabs.Content value="cycle-history">
    <div class="bg-card border border-border rounded-md p-4 mb-4">
      <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">CYCLE HISTORY</div>

      {#if (data.cycleHistory ?? []).length === 0}
        <p class="text-[14px] text-muted-foreground text-center py-6">No cycle history yet. This node's first processed deadline will appear here.</p>
      {:else}
        <table class="w-full text-[14px]">
          <thead>
            <tr style="border-bottom: 1px solid #3d3426;">
              <th class="text-left px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Deadline</th>
              <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Paid</th>
              <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Required</th>
              <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Payment %</th>
              <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Outcome</th>
              <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Instab Δ</th>
            </tr>
          </thead>
          <tbody>
            {#each (data.cycleHistory ?? []) as cycle (cycle.id)}
              {@const payPct = cycle.required_sp > 0 ? Math.round(cycle.paid_sp / cycle.required_sp * 100) : 0}
              <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
                <td class="px-0 py-2 text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(cycle.deadline_ts)}</td>
                <td class="px-3 py-2 text-[14px] text-foreground text-right">{cycle.paid_sp} SP</td>
                <td class="px-3 py-2 text-[14px] text-muted-foreground text-right">{cycle.required_sp} SP</td>
                <td class="px-3 py-2 text-right">
                  <span class="text-[14px] font-semibold" style="color: {paymentPctColor(payPct)};">{payPct}%</span>
                </td>
                <td class="px-3 py-2">
                  <span class="px-2 py-0.5 rounded text-[11px] font-semibold" style={outcomeBadgeStyle(cycle.outcome)}>
                    {cycle.outcome}
                  </span>
                </td>
                <td class="px-3 py-2 text-right">
                  <span class="text-[14px]" style="color: {instabDeltaColor(cycle.instab_delta)};">
                    +{cycle.instab_delta}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </Tabs.Content>

  <!-- ===================== NODE LOG TAB ===================== -->
  <Tabs.Content value="node-log">
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
  </Tabs.Content>
</Tabs.Root>

<!-- ======================== SUBMISSION MODAL ======================== -->
{#if showSubmissionModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="submission-modal-title">
    <div class="w-full max-w-[560px] rounded-lg p-6 max-h-[90vh] overflow-y-auto" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="submission-modal-title" class="text-[15px] font-semibold text-foreground">{submitLabel}</h2>
        <button type="button" onclick={() => { showSubmissionModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Log a submission against {data.node.name}</p>

      <form method="POST" action="?/logSubmission"
        use:enhance={() => { submitting = true; return async ({ update }) => { await update({ reset: false }); submitting = false; }; }}>

        <!-- Submission Type -->
        <div class="mb-4">
          <label for="sub-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Submission Type <span style="color: #ff9999;">*</span>
          </label>
          <select id="sub-type" name="submission_type" bind:value={submissionType}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="upkeep">Upkeep</option>
            <option value="repair">Repair</option>
            <option value="upgrade">Upgrade</option>
            <option value="instability_reduction">Reduce Instability</option>
          </select>
        </div>

        <!-- Upkeep fields -->
        {#if submissionType === 'upkeep'}
          <div class="mb-4">
            <label for="sub-item" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Item <span style="color: #ff9999;">*</span>
            </label>
            <select id="sub-item" name="item" bind:value={selectedItemId}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select item...</option>
              {#each (data.spCatalogue ?? []) as cat}
                <option value={cat.id}>{cat.name} ({cat.category} — {cat.sp_value} SP ea.)</option>
              {/each}
            </select>
            {#if form?.action === 'logSubmission' && form?.errors?.item}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.item[0]}</p>
            {/if}
          </div>
          <div class="mb-4">
            <label for="sub-qty" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Quantity <span style="color: #ff9999;">*</span>
            </label>
            <input id="sub-qty" name="qty" type="number" min="1" bind:value={qty}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" />
          </div>
          {#if selectedItem}
            <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(196,164,90,0.06); border: 1px solid rgba(196,164,90,0.15);">
              <span class="text-muted-foreground">{qty} × {(selectedItem as {sp_value: number}).sp_value} SP = </span>
              <span class="font-semibold" style="color: #c4a45a;">{newSpValue} SP</span>
            </div>
          {/if}

        {:else if submissionType === 'repair'}
          <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(196,164,90,0.06); border: 1px solid rgba(196,164,90,0.15);">
            <span class="text-muted-foreground">Repair — T{data.node.tier}: </span>
            <span class="font-semibold" style="color: #c4a45a;">{data.repairCost} SP</span>
          </div>

        {:else if submissionType === 'upgrade'}
          {#if upgradeBlocked}
            <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
              Node is already at maximum tier (T4).
            </div>
          {:else}
            <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(196,164,90,0.06); border: 1px solid rgba(196,164,90,0.15);">
              <span class="text-muted-foreground">Upgrade — T{data.node.tier} → T{Number(data.node.tier) + 1}: </span>
              <span class="font-semibold" style="color: #c4a45a;">{data.upgradeCost} SP</span>
            </div>
          {/if}

        {:else if submissionType === 'instability_reduction'}
          <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(196,164,90,0.06); border: 1px solid rgba(196,164,90,0.15);">
            <span class="text-muted-foreground">Fixed cost = </span>
            <span class="font-semibold" style="color: #c4a45a;">40 SP</span>
          </div>
          {#if (data.node?.instability ?? 0) === 0}
            <div class="mb-4 px-3 py-2 rounded-md text-[13px]" style="background: rgba(180,160,50,0.1); border: 1px solid rgba(180,160,50,0.3); color: #d4c060;">
              This node's instability is already 0. This submission will still be logged.
            </div>
          {/if}
        {/if}

        <!-- Staff Note -->
        <div class="mb-4">
          <label for="sub-note" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Staff Note <span class="font-normal normal-case">(optional, max 200 chars)</span>
          </label>
          <input id="sub-note" name="staff_note" type="text" maxlength="200" bind:value={staffNote}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional context..." />
        </div>

        <!-- Cap Preview -->
        <div class="mb-4 p-3 rounded-md" style="background: rgba(139,125,101,0.08); border: 1px solid #3d3426;">
          <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">CAP PREVIEW</div>

          {#if submissionType !== 'upkeep'}
            <p class="text-[11px] text-muted-foreground" style="opacity: 0.7;">
              Category caps do not apply to {submissionType === 'repair' ? 'Repair' : submissionType === 'upgrade' ? 'Upgrade' : 'Instability Reduction'} submissions.
            </p>
          {:else}
            <!-- Raw Renewable row -->
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] text-muted-foreground">Raw Renewable</span>
                <span class="text-[11px]" style="color: {capBarColor(capPreview.rrPct)};">{capPreview.rrPct}%</span>
              </div>
              <div class="relative w-full rounded h-2 overflow-hidden" style="background: #2c2518;">
                <div class="h-full rounded transition-all" style="width: {Math.min(100, capPreview.rrPct)}%; background: {capBarColor(capPreview.rrPct)};"></div>
                <!-- 40% threshold line -->
                <div class="absolute top-0 bottom-0 w-px" style="left: 40%; background: #8b7d65; opacity: 0.6;"></div>
              </div>
              <div class="flex justify-between mt-1">
                <span class="text-[11px] text-muted-foreground">{capPreview.rrSP} SP used / {capPreview.cap} SP cap (40%)</span>
                {#if selectedItem && (selectedItem as {category: string}).category === 'Raw Renewable'}
                  {#if capPreview.rrPct > 40}
                    <span class="text-[11px] font-semibold" style="color: #ff7070;">→ {capPreview.rrPct}% — exceeds 40% cap</span>
                  {:else if capPreview.rrPct > 30}
                    <span class="text-[11px] font-semibold" style="color: #d4c060;">→ {capPreview.rrPct}% — approaching 40% cap</span>
                  {:else}
                    <span class="text-[11px] text-muted-foreground">→ {capPreview.rrPct}% after this submission</span>
                  {/if}
                {/if}
              </div>
            </div>
            <!-- Currency row -->
            <div class="mb-2">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] text-muted-foreground">Currency</span>
                <span class="text-[11px]" style="color: {capBarColor(capPreview.cPct)};">{capPreview.cPct}%</span>
              </div>
              <div class="relative w-full rounded h-2 overflow-hidden" style="background: #2c2518;">
                <div class="h-full rounded transition-all" style="width: {Math.min(100, capPreview.cPct)}%; background: {capBarColor(capPreview.cPct)};"></div>
                <div class="absolute top-0 bottom-0 w-px" style="left: 40%; background: #8b7d65; opacity: 0.6;"></div>
              </div>
              <div class="flex justify-between mt-1">
                <span class="text-[11px] text-muted-foreground">{capPreview.cSP} SP used / {capPreview.cap} SP cap (40%)</span>
                {#if selectedItem && (selectedItem as {category: string}).category === 'Currency'}
                  {#if capPreview.cPct > 40}
                    <span class="text-[11px] font-semibold" style="color: #ff7070;">→ {capPreview.cPct}% — exceeds 40% cap</span>
                  {:else if capPreview.cPct > 30}
                    <span class="text-[11px] font-semibold" style="color: #d4c060;">→ {capPreview.cPct}% — approaching 40% cap</span>
                  {:else}
                    <span class="text-[11px] text-muted-foreground">→ {capPreview.cPct}% after this submission</span>
                  {/if}
                {/if}
              </div>
            </div>

            {#if !capPreview.ok}
              <div class="mt-2 flex items-center gap-2 px-3 py-2 rounded text-[14px]" style="background: rgba(139,43,43,0.15); border: 1px solid rgba(200,68,68,0.3);">
                <AlertTriangle class="w-4 h-4 shrink-0" style="color: #ff7070;" />
                <span style="color: #ff7070;">This submission exceeds the 40% cap. It cannot be saved.</span>
              </div>
            {/if}
          {/if}
        </div>

        {#if form?.action === 'logSubmission' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showSubmissionModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={submitDisabled}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if submitting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ======================== REMOVE SUBMISSION DIALOG ======================== -->
{#if removeDialogOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="remove-dialog-title">
    <div class="w-full max-w-[420px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="remove-dialog-title" class="text-[15px] font-semibold text-foreground mb-3">Remove Submission</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Remove this submission from the current cycle? This cannot be undone.
      </p>
      <form method="POST" action="?/removeSubmission"
        use:enhance={() => { return async ({ update }) => { await update(); }; }}>
        <input type="hidden" name="id" value={pendingRemoveId} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { removeDialogOpen = false; pendingRemoveId = ''; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit"
            class="px-4 py-2 rounded-md text-[14px] border transition-colors"
            style="border-color: #8b2b2b; color: #ff9999;">
            Remove Submission
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ======================== EDIT NODE MODAL ======================== -->
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

<!-- ======================== TRANSFER OWNERSHIP MODAL ======================== -->
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

<!-- ======================== DELETE CONFIRMATION ======================== -->
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
