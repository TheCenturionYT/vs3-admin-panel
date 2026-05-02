<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { formatDistanceToNow } from 'date-fns';
  import { AlertTriangle, Activity, Loader2 } from '@lucide/svelte';
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';
  import { Progress } from '$lib/components/ui/progress';
  import { calcUpkeep } from '$lib/upkeep';

  let { data, form } = $props();

  function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000) + 1;
  }

  // === Scheduler Health ===
  const lastRunAgo = $derived(
    data.schedulerHealth?.lastRunIso
      ? formatDistanceToNow(new Date(data.schedulerHealth.lastRunIso), { addSuffix: true })
      : 'Never'
  );

  // === Next deadline label from deadline_config ===
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const nextDeadlineLabel = $derived((() => {
    const cfg = data.deadlineConfig;
    if (!cfg) return null;
    const dow = cfg.day_of_week as number ?? 6;
    const h = String(cfg.hour as number ?? 23).padStart(2, '0');
    const m = String(cfg.minute as number ?? 59).padStart(2, '0');
    const tz = cfg.timezone_offset as number ?? -5;
    return `${dayNames[dow]} at ${h}:${m} UTC${tz >= 0 ? '+' : ''}${tz}`;
  })());

  // === Process All Overdue dialog ===
  let confirmProcessOpen = $state(false);
  let processing = $state(false);

  // === Quick-Log Modal ===
  let quickLogOpen = $state(false);
  let quickLogNodeId = $state('');
  let quickLogNodeName = $state('');
  let quickLogRequired = $state(0);
  let quickLogPaid = $state(0);
  let quickLogFactionName = $state('');
  let qlExistingRR = $state(0);   // existing Raw Renewable SP for the node this cycle
  let qlExistingC = $state(0);    // existing Currency SP for the node this cycle

  // Quick-log submission form state
  let qlSubmissionType = $state<'upkeep' | 'instability_reduction' | 'repair' | 'upgrade'>('upkeep');
  let qlSelectedItemId = $state('');
  let qlQty = $state(1);
  let qlStaffNote = $state('');
  let qlSubmitting = $state(false);

  // Quick-log cap preview (derived from live state)
  const qlSelectedItem = $derived((data.spCatalogue ?? []).find((i: { id: string }) => i.id === qlSelectedItemId));
  const qlNewSpValue = $derived(
    qlSubmissionType === 'upkeep' ? (qlSelectedItem ? (qlSelectedItem as { sp_value: number }).sp_value * qlQty : 0)
    : qlSubmissionType === 'instability_reduction' ? 40
    : 0
  );
  const qlCapPreview = $derived((() => {
    if (qlSubmissionType !== 'upkeep' || !qlSelectedItem) {
      return { applicable: qlSubmissionType === 'upkeep', ok: true, rrPct: 0, cPct: 0, rrSP: 0, cSP: 0, cap: 0 };
    }
    const eff = quickLogRequired || 1;
    // Accumulate existing cycle SP + new submission to match server-side checkCaps behavior
    const newRR = (qlSelectedItem as { category: string }).category === 'Raw Renewable' ? qlNewSpValue : 0;
    const newC = (qlSelectedItem as { category: string }).category === 'Currency' ? qlNewSpValue : 0;
    const rrSP = qlExistingRR + newRR;
    const cSP = qlExistingC + newC;
    const rrPct = Math.round(rrSP / eff * 100);
    const cPct = Math.round(cSP / eff * 100);
    return { applicable: true, ok: rrPct <= 40 && cPct <= 40, rrPct, cPct, rrSP, cSP, cap: Math.round(eff * 0.4) };
  })());
  const qlSubmitDisabled = $derived(qlSubmitting || (qlSubmissionType === 'upkeep' && !qlCapPreview.ok));

  function openQuickLog(nodeId: string, nodeName: string, required: number, paid: number, factionName: string | null, rrPaid = 0, cPaid = 0) {
    quickLogNodeId = nodeId;
    quickLogNodeName = nodeName;
    quickLogRequired = required;
    quickLogPaid = paid;
    quickLogFactionName = factionName ?? '';
    qlExistingRR = rrPaid;
    qlExistingC = cPaid;
    qlSubmissionType = 'upkeep';
    qlSelectedItemId = '';
    qlQty = 1;
    qlStaffNote = '';
    quickLogOpen = true;
  }

  function capBarColor(pct: number): string {
    if (pct > 40) return '#8b2b2b';
    if (pct > 30) return '#d4c060';
    return '#3d6b3d';
  }

  function spPaidColor(paid: number, required: number): string {
    if (paid === 0) return '#ff7070';
    if (paid < required) return '#d4c060';
    return '#90cc90';
  }

  // Close quick-log on success
  $effect(() => {
    if (form?.success && form.action === 'logSubmission') {
      quickLogOpen = false;
    }
  });
</script>

<svelte:head>
  <title>Dashboard — VS3 Panel</title>
</svelte:head>

<div class="mb-6">
  <h1 class="text-[22px] font-semibold text-foreground">Dashboard</h1>
  <p class="text-[14px] text-muted-foreground mt-1">Server overview and faction health</p>
</div>

<!-- Stat cards -->
<div class="grid grid-cols-3 gap-4 mb-4">
  <div class="bg-card border border-border rounded-md p-4">
    <div class="text-[11px] font-semibold uppercase text-muted-foreground mb-2" style="letter-spacing: 0.07em;">Active Factions</div>
    <div class="text-[22px] font-semibold" style="color: #c4a45a;">{data.factionCount}</div>
  </div>

  <div class="bg-card border border-border rounded-md p-4">
    <div class="text-[11px] font-semibold uppercase text-muted-foreground mb-2" style="letter-spacing: 0.07em;">Total Nodes</div>
    <div class="text-[22px] font-semibold" style="color: #c4a45a;">{data.nodeCount}</div>
  </div>

  <div class="bg-card border border-border rounded-md p-4">
    <div class="text-[11px] font-semibold uppercase text-muted-foreground mb-2" style="letter-spacing: 0.07em;">Active Wars</div>
    <div class="text-[22px] font-semibold" style="color: #c4a45a;">{data.activeWarCount}</div>
  </div>
</div>

<!-- Instability Overview -->
<div class="bg-card border border-border rounded-md p-4 mb-4">
  <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">Instability Overview</div>

  {#if data.unstableNodes.length === 0}
    <div class="rounded-md px-4 py-3 text-[14px]" style="background: #1e3a1e; border: 1px solid #3d6b3d; color: #90cc90;">
      All nodes fully controlled.
    </div>
  {:else}
    <table class="w-full text-[14px]">
      <thead>
        <tr class="border-b border-border">
          <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground pb-2 pr-4" style="letter-spacing: 0.07em;">Node</th>
          <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground pb-2 pr-4" style="letter-spacing: 0.07em;">Type</th>
          <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground pb-2 pr-4" style="letter-spacing: 0.07em;">Tier</th>
          <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground pb-2 pr-4" style="letter-spacing: 0.07em;">Owner</th>
          <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground pb-2" style="letter-spacing: 0.07em;">Instability</th>
        </tr>
      </thead>
      <tbody>
        {#each data.unstableNodes as node (node.id)}
          <tr class="border-b border-border last:border-0">
            <td class="py-2 pr-4 text-foreground">{node.name}</td>
            <td class="py-2 pr-4 text-muted-foreground">{node.type}</td>
            <td class="py-2 pr-4 text-muted-foreground">T{node.tier}</td>
            <td class="py-2 pr-4 text-muted-foreground">{node.owner_name}</td>
            <td class="py-2">
              <span class="inline-flex items-center gap-2">
                <InstabilityDot level={node.instability} />
                <span class="text-muted-foreground">({node.instability})</span>
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Active Wars -->
{#if data.activeWarCount > 0}
  <div class="bg-card border border-border rounded-md p-4 mb-4">
    <div class="flex items-center gap-2 mb-3">
      <div class="text-[11px] font-semibold uppercase" style="color: #c4a45a; letter-spacing: 0.07em;">Active Wars</div>
      <span class="text-[11px] font-semibold px-1.5 py-0.5 rounded" style="background: #2c2518; color: #c4a45a; border: 1px solid #3d3426;">{data.activeWarCount}</span>
    </div>
    <div class="flex flex-col">
      {#each data.activeWars as war (war.id)}
        <a href="/wars/{war.id}" class="block text-[14px] text-foreground hover:text-primary transition-colors py-1">
          {war.faction_a_name} vs {war.faction_b_name} — {war.casus_belli} — Day {daysSince(war.start_date)}
        </a>
      {/each}
    </div>
  </div>
{/if}

<!-- Phase 3 Widgets -->
<div class="grid grid-cols-2 gap-4">

  <!-- OVERDUE NODES widget -->
  <div class="bg-card border border-border rounded-md p-4">
    <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">OVERDUE NODES</div>

    {#if (data.overdueNodes ?? []).length === 0}
      <div class="rounded-md px-4 py-3 text-[14px]" style="background: #1e3a1e; border: 1px solid #3d6b3d; color: #90cc90;">
        All nodes are up to date for the current cycle.
      </div>
    {:else}
      <div class="flex justify-end mb-3">
        <button
          type="button"
          onclick={() => confirmProcessOpen = true}
          class="px-3 py-1.5 rounded-md text-[13px] border transition-colors"
          style="border-color: #c4a45a; color: #c4a45a;"
          onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
          onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
          Process All Overdue
        </button>
      </div>
      <table class="w-full text-[14px]">
        <thead>
          <tr style="border-bottom: 1px solid #3d3426;">
            <th class="text-left px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Node</th>
            <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Owner</th>
            <th class="text-left px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Instab.</th>
            <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Paid</th>
            <th class="text-right px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Required</th>
            <th class="text-right px-0 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each (data.overdueNodes ?? []) as row (row.node.id)}
            <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
              <td class="px-0 py-2">
                <a href="/nodes/{row.node.id}" class="text-[14px] font-semibold text-foreground hover:text-primary transition-colors">
                  {row.node.name}
                </a>
              </td>
              <td class="px-3 py-2 text-[14px] text-muted-foreground">
                {#if row.faction}
                  <span class="inline-flex items-center gap-1.5">
                    {#if row.faction.color}
                      <span class="w-2 h-2 rounded-full shrink-0" style="background: {row.faction.color};"></span>
                    {/if}
                    {row.faction.name}
                  </span>
                {:else}
                  —
                {/if}
              </td>
              <td class="px-3 py-2">
                <InstabilityDot level={row.node.instability} />
              </td>
              <td class="px-3 py-2 text-right">
                <span class="text-[14px]" style="color: {spPaidColor(row.paid, row.required)};">{row.paid} SP</span>
              </td>
              <td class="px-3 py-2 text-right text-[14px] text-muted-foreground">{row.required} SP</td>
              <td class="px-0 py-2 text-right">
                <button
                  type="button"
                  onclick={() => openQuickLog(row.node.id, row.node.name, row.required, row.paid, row.faction?.name ?? null, row.rrPaid ?? 0, row.cPaid ?? 0)}
                  class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                  style="border-color: #c4a45a; color: #c4a45a;"
                  onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
                  onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  Log Submission
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- SCHEDULER HEALTH card -->
  <div class="bg-card border border-border rounded-md p-4">
    <div class="flex items-center gap-2 mb-3">
      <Activity class="w-3.5 h-3.5" style="color: #c4a45a;" />
      <div class="text-[11px] font-semibold uppercase" style="color: #c4a45a; letter-spacing: 0.07em;">SCHEDULER HEALTH</div>
    </div>

    {#if !data.schedulerHealth?.schedulerActive}
      <!-- Scheduler disabled state -->
      <p class="text-[14px] text-muted-foreground mb-2">Scheduler is currently disabled. Enable it in Server Settings.</p>
      <a href="/server-settings" class="text-[14px] transition-colors" style="color: #c4a45a;"
         onmouseover={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#d4b46a'}
         onmouseout={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#c4a45a'}>
        Go to Server Settings
      </a>
    {:else if data.schedulerHealth?.schedulerOverdue || !data.schedulerHealth?.lastRunIso}
      <!-- Alert state -->
      <div class="rounded-md p-3 mb-3" style="background: rgba(139,43,43,0.15); border: 1px solid rgba(200,68,68,0.3);">
        <div class="flex items-center gap-2 mb-1">
          <AlertTriangle class="w-4 h-4 shrink-0" style="color: #ff7070;" />
          <span class="text-[14px] font-semibold" style="color: #ff7070;">Scheduler alert</span>
        </div>
        <p class="text-[14px]" style="color: #ff7070;">No deadline has been processed in over 8 days. Check the scheduler configuration.</p>
      </div>
      <p class="text-[11px] text-muted-foreground">Last run: {lastRunAgo}</p>
    {:else}
      <!-- Normal state -->
      <div class="mb-2">
        <span class="text-[14px] text-muted-foreground">Last deadline run: </span>
        <span class="text-[14px] font-semibold text-foreground">{lastRunAgo}</span>
      </div>
      {#if nextDeadlineLabel}
        <p class="text-[11px] text-muted-foreground">Next deadline: {nextDeadlineLabel}</p>
      {/if}
    {/if}
  </div>

</div>

<!-- ======================== PROCESS ALL OVERDUE CONFIRMATION ======================== -->
{#if confirmProcessOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="process-dialog-title">
    <div class="w-full max-w-[480px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="process-dialog-title" class="text-[15px] font-semibold text-foreground mb-3">Process All Overdue Nodes</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        This will run deadline processing for all nodes that have passed their deadline. Nodes already processed this cycle will be skipped automatically.
      </p>
      {#if form?.action === 'processOverdue' && form?.errors?._global}
        <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
          {form.errors._global[0]}
        </div>
      {/if}
      <div class="flex gap-2 justify-end">
        <button
          type="button"
          onclick={() => confirmProcessOpen = false}
          class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors"
        >Cancel</button>
        <form method="POST" action="?/processOverdue" use:enhance={() => {
          processing = true;
          return async ({ update }) => {
            await update();
            processing = false;
            confirmProcessOpen = false;
            await invalidateAll();
          };
        }}>
          <button
            type="submit"
            disabled={processing}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] font-semibold disabled:opacity-50"
            style="background: #c4a45a; color: #1a1410;"
          >
            {#if processing}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            {processing ? 'Processing…' : 'Process All'}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- ======================== QUICK-LOG MODAL ======================== -->
{#if quickLogOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="quick-log-modal-title">
    <div class="w-full max-w-[560px] rounded-lg p-6 max-h-[90vh] overflow-y-auto" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="quick-log-modal-title" class="text-[15px] font-semibold text-foreground">Log Submission — {quickLogNodeName}</h2>
        <button type="button" onclick={() => { quickLogOpen = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <!-- Context header -->
      <div class="mb-4 text-[11px] text-muted-foreground">
        {#if quickLogFactionName}<span>{quickLogFactionName} — </span>{/if}
        Required: <span class="font-semibold" style="color: #c4a45a;">{quickLogRequired} SP/week</span>
        <span class="ml-2">Paid this cycle: <span style="color: {spPaidColor(quickLogPaid, quickLogRequired)};">{quickLogPaid} SP</span></span>
      </div>

      <form method="POST" action="/nodes/{quickLogNodeId}?/logSubmission"
        use:enhance={() => {
          qlSubmitting = true;
          return async ({ update }) => {
            await update({ reset: false });
            qlSubmitting = false;
            quickLogOpen = false;
            await invalidateAll();
          };
        }}>

        <!-- Submission Type -->
        <div class="mb-4">
          <label for="ql-sub-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Submission Type <span style="color: #ff9999;">*</span>
          </label>
          <select id="ql-sub-type" name="submission_type" bind:value={qlSubmissionType}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="upkeep">Upkeep</option>
            <option value="instability_reduction">Reduce Instability</option>
          </select>
        </div>

        <!-- Upkeep fields -->
        {#if qlSubmissionType === 'upkeep'}
          <div class="mb-4">
            <label for="ql-sub-item" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Item <span style="color: #ff9999;">*</span>
            </label>
            <select id="ql-sub-item" name="item" bind:value={qlSelectedItemId}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select item...</option>
              {#each (data.spCatalogue ?? []) as cat}
                <option value={cat.id}>{cat.name} ({cat.category} — {cat.sp_value} SP ea.)</option>
              {/each}
            </select>
          </div>
          <div class="mb-4">
            <label for="ql-sub-qty" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Quantity <span style="color: #ff9999;">*</span>
            </label>
            <input id="ql-sub-qty" name="qty" type="number" min="1" bind:value={qlQty}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" />
          </div>
          {#if qlSelectedItem}
            <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(196,164,90,0.06); border: 1px solid rgba(196,164,90,0.15);">
              <span class="text-muted-foreground">{qlQty} × {(qlSelectedItem as {sp_value: number}).sp_value} SP = </span>
              <span class="font-semibold" style="color: #c4a45a;">{qlNewSpValue} SP</span>
            </div>
          {/if}

        {:else if qlSubmissionType === 'instability_reduction'}
          <div class="mb-4 px-3 py-2 rounded-md text-[14px]" style="background: rgba(196,164,90,0.06); border: 1px solid rgba(196,164,90,0.15);">
            <span class="text-muted-foreground">Fixed cost = </span>
            <span class="font-semibold" style="color: #c4a45a;">40 SP</span>
          </div>
        {/if}

        <!-- Staff Note -->
        <div class="mb-4">
          <label for="ql-sub-note" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Staff Note <span class="font-normal normal-case">(optional, max 200 chars)</span>
          </label>
          <input id="ql-sub-note" name="staff_note" type="text" maxlength="200" bind:value={qlStaffNote}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional context..." />
        </div>

        <!-- Cap Preview -->
        <div class="mb-4 p-3 rounded-md" style="background: rgba(139,125,101,0.08); border: 1px solid #3d3426;">
          <div class="text-[11px] font-semibold uppercase mb-3" style="color: #c4a45a; letter-spacing: 0.07em;">CAP PREVIEW</div>

          {#if qlSubmissionType !== 'upkeep'}
            <p class="text-[11px] text-muted-foreground" style="opacity: 0.7;">
              Category caps do not apply to {qlSubmissionType === 'instability_reduction' ? 'Instability Reduction' : qlSubmissionType} submissions.
            </p>
          {:else}
            <!-- Raw Renewable -->
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] text-muted-foreground">Raw Renewable</span>
                <span class="text-[11px]" style="color: {capBarColor(qlCapPreview.rrPct)};">{qlCapPreview.rrPct}%</span>
              </div>
              <div class="relative w-full rounded h-2 overflow-hidden" style="background: #2c2518;">
                <div class="h-full rounded transition-all" style="width: {Math.min(100, qlCapPreview.rrPct)}%; background: {capBarColor(qlCapPreview.rrPct)};"></div>
                <div class="absolute top-0 bottom-0 w-px" style="left: 40%; background: #8b7d65; opacity: 0.6;"></div>
              </div>
              <div class="flex justify-between mt-1">
                <span class="text-[11px] text-muted-foreground">{qlCapPreview.rrSP} SP used / {qlCapPreview.cap} SP cap (40%)</span>
                {#if qlSelectedItem && (qlSelectedItem as {category: string}).category === 'Raw Renewable'}
                  {#if qlCapPreview.rrPct > 40}
                    <span class="text-[11px] font-semibold" style="color: #ff7070;">→ {qlCapPreview.rrPct}% — exceeds 40% cap</span>
                  {:else if qlCapPreview.rrPct > 30}
                    <span class="text-[11px] font-semibold" style="color: #d4c060;">→ {qlCapPreview.rrPct}% — approaching 40% cap</span>
                  {:else}
                    <span class="text-[11px] text-muted-foreground">→ {qlCapPreview.rrPct}% after this submission</span>
                  {/if}
                {/if}
              </div>
            </div>
            <!-- Currency -->
            <div class="mb-2">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] text-muted-foreground">Currency</span>
                <span class="text-[11px]" style="color: {capBarColor(qlCapPreview.cPct)};">{qlCapPreview.cPct}%</span>
              </div>
              <div class="relative w-full rounded h-2 overflow-hidden" style="background: #2c2518;">
                <div class="h-full rounded transition-all" style="width: {Math.min(100, qlCapPreview.cPct)}%; background: {capBarColor(qlCapPreview.cPct)};"></div>
                <div class="absolute top-0 bottom-0 w-px" style="left: 40%; background: #8b7d65; opacity: 0.6;"></div>
              </div>
              <div class="flex justify-between mt-1">
                <span class="text-[11px] text-muted-foreground">{qlCapPreview.cSP} SP used / {qlCapPreview.cap} SP cap (40%)</span>
                {#if qlSelectedItem && (qlSelectedItem as {category: string}).category === 'Currency'}
                  {#if qlCapPreview.cPct > 40}
                    <span class="text-[11px] font-semibold" style="color: #ff7070;">→ {qlCapPreview.cPct}% — exceeds 40% cap</span>
                  {:else if qlCapPreview.cPct > 30}
                    <span class="text-[11px] font-semibold" style="color: #d4c060;">→ {qlCapPreview.cPct}% — approaching 40% cap</span>
                  {:else}
                    <span class="text-[11px] text-muted-foreground">→ {qlCapPreview.cPct}% after this submission</span>
                  {/if}
                {/if}
              </div>
            </div>

            {#if !qlCapPreview.ok}
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
          <button type="button" onclick={() => { quickLogOpen = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={qlSubmitDisabled}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if qlSubmitting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Log Submission
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
