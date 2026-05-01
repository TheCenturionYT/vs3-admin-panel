<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { format, differenceInDays } from 'date-fns';
  import { Loader2, Plus, Swords } from '@lucide/svelte';
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = data.user.role === 'head_admin';

  // Declare War modal state
  let showDeclareModal = $state(false);
  let declaringSaving = $state(false);

  // End War modal state
  let showEndModal = $state(false);
  let endTarget = $state<{ id: string; factionAName: string; factionBName: string } | null>(null);
  let endingSaving = $state(false);

  function openEndModal(war: { id: string; factionAName: string; factionBName: string }) {
    endTarget = war;
    showEndModal = true;
  }

  function formatDate(d: string): string {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
  }

  function calcDuration(start: string, end: string): string {
    if (!start || !end) return '—';
    try {
      const days = differenceInDays(new Date(end), new Date(start));
      return `${days} day${days === 1 ? '' : 's'}`;
    } catch { return '—'; }
  }

  function truncate(s: string, n = 60): string {
    if (!s) return '—';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function outcomeLabel(outcome: string, factionAName: string, factionBName: string): string {
    if (outcome === 'Victory_A') return `Victory — ${factionAName}`;
    if (outcome === 'Victory_B') return `Victory — ${factionBName}`;
    if (outcome === 'Stalemate') return 'Stalemate';
    return outcome || '—';
  }

  $effect(() => {
    if (form?.success) {
      showDeclareModal = false;
      showEndModal = false;
    }
  });

  // Today's date for default end_date
  const today = format(new Date(), 'yyyy-MM-dd');
</script>

<svelte:head>
  <title>Wars — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Wars</h1>
    <p class="text-[14px] text-muted-foreground mt-1">Active and historical conflicts between factions</p>
  </div>
  <button
    type="button"
    onclick={() => showDeclareModal = true}
    class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
    style="border-color: #c4a45a; color: #c4a45a;"
    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
  >
    <Plus class="w-4 h-4" />
    Declare War
  </button>
</div>

<!-- Tabs -->
<Tabs value="active">
  <TabsList class="mb-4" style="background: #231d14; border: 1px solid #3d3426;">
    <TabsTrigger value="active" style="data-[state=active]:color: #c4a45a; data-[state=active]:border-bottom: 2px solid #c4a45a;">
      Active Wars
      {#if data.activeWars.length > 0}
        <span class="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold" style="background: rgba(200,100,40,0.2); color: #e07840;">{data.activeWars.length}</span>
      {/if}
    </TabsTrigger>
    <TabsTrigger value="history">
      War History
      {#if data.endedWars.length > 0}
        <span class="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold" style="background: rgba(139,125,101,0.15); color: #8b7d65;">{data.endedWars.length}</span>
      {/if}
    </TabsTrigger>
  </TabsList>

  <!-- Active Wars Tab -->
  <TabsContent value="active">
    <div class="bg-card border border-border rounded-md overflow-hidden">
      {#if data.activeWars.length === 0}
        <div class="py-12 text-center">
          <Swords class="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p class="text-[15px] font-semibold text-foreground mb-2">No active wars</p>
          <p class="text-[14px] text-muted-foreground">Declare a war to begin tracking conflict.</p>
        </div>
      {:else}
        <table class="w-full">
          <thead>
            <tr style="border-bottom: 1px solid #3d3426;">
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Factions</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Casus Belli</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Started</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Status</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.activeWars as war}
              <tr
                style="border-bottom: 1px solid rgba(196,164,90,0.06); cursor: pointer;"
                onclick={() => goto(`/wars/${war.id}`)}
                onkeydown={(e) => e.key === 'Enter' && goto(`/wars/${war.id}`)}
                role="row"
                tabindex="0"
                onmouseover={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(196,164,90,0.03)'}
                onmouseout={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {war.factionAColor || '#8b7d65'};"></span>
                    {war.factionAName}
                    <span class="text-muted-foreground font-normal">vs</span>
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {war.factionBColor || '#8b7d65'};"></span>
                    {war.factionBName}
                  </div>
                </td>
                <td class="px-4 py-3 text-[14px] text-muted-foreground">{truncate(war.casusBelli)}</td>
                <td class="px-4 py-3 text-[14px] text-muted-foreground">{formatDate(war.startDate)}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;">
                    Active
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2" onclick={(e) => e.stopPropagation()} role="none">
                    <button
                      type="button"
                      onclick={(e) => { e.stopPropagation(); goto(`/wars/${war.id}`); }}
                      class="px-2 py-1 rounded text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View
                    </button>
                    {#if isHeadAdmin}
                      <button
                        type="button"
                        onclick={(e) => { e.stopPropagation(); openEndModal(war); }}
                        class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                        style="border-color: #8b2b2b; color: #ff9999;"
                      >
                        End War
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </TabsContent>

  <!-- War History Tab -->
  <TabsContent value="history">
    <div class="bg-card border border-border rounded-md overflow-hidden">
      {#if data.endedWars.length === 0}
        <div class="py-12 text-center">
          <p class="text-[15px] font-semibold text-foreground mb-2">No war history yet</p>
          <p class="text-[14px] text-muted-foreground">Ended wars will appear here.</p>
        </div>
      {:else}
        <table class="w-full">
          <thead>
            <tr style="border-bottom: 1px solid #3d3426;">
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Factions</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Casus Belli</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Duration</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Date Range</th>
              <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {#each data.endedWars as war}
              <tr
                style="border-bottom: 1px solid rgba(196,164,90,0.06); cursor: pointer;"
                onclick={() => goto(`/wars/${war.id}`)}
                onkeydown={(e) => e.key === 'Enter' && goto(`/wars/${war.id}`)}
                role="row"
                tabindex="0"
                onmouseover={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(196,164,90,0.03)'}
                onmouseout={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {war.factionAColor || '#8b7d65'};"></span>
                    {war.factionAName}
                    <span class="text-muted-foreground font-normal">vs</span>
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {war.factionBColor || '#8b7d65'};"></span>
                    {war.factionBName}
                  </div>
                </td>
                <td class="px-4 py-3 text-[14px] text-muted-foreground">{truncate(war.casusBelli)}</td>
                <td class="px-4 py-3 text-[14px] text-muted-foreground">{calcDuration(war.startDate, war.endDate)}</td>
                <td class="px-4 py-3 text-[14px] text-muted-foreground">{formatDate(war.startDate)} — {formatDate(war.endDate)}</td>
                <td class="px-4 py-3">
                  {#if war.outcome === 'Victory_A' || war.outcome === 'Victory_B'}
                    <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">
                      {outcomeLabel(war.outcome, war.factionAName, war.factionBName)}
                    </span>
                  {:else if war.outcome === 'Stalemate'}
                    <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">
                      Stalemate
                    </span>
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
  </TabsContent>
</Tabs>

<!-- Declare War Modal -->
{#if showDeclareModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="declare-modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="declare-modal-title" class="text-[15px] font-semibold text-foreground">Declare War</h2>
        <button type="button" onclick={() => { showDeclareModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Record a new conflict between two PvP factions.</p>

      <form method="POST" action="?/declareWar"
        use:enhance={() => { declaringSaving = true; return async ({ update }) => { await update({ reset: false }); declaringSaving = false; }; }}>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="faction-a" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Attacker <span style="color: #ff9999;">*</span>
            </label>
            <select id="faction-a" name="faction_a" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select attacker...</option>
              {#each data.pvpFactions as f}
                <option value={f.id}>{f.name}</option>
              {/each}
            </select>
            {#if form?.action === 'declareWar' && form?.errors?.faction_a}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.faction_a[0]}</p>
            {/if}
          </div>
          <div>
            <label for="faction-b" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Defender <span style="color: #ff9999;">*</span>
            </label>
            <select id="faction-b" name="faction_b" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select defender...</option>
              {#each data.pvpFactions as f}
                <option value={f.id}>{f.name}</option>
              {/each}
            </select>
            {#if form?.action === 'declareWar' && form?.errors?.faction_b}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.faction_b[0]}</p>
            {/if}
          </div>
        </div>

        <div class="mb-4">
          <label for="casus-belli" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Casus Belli <span style="color: #ff9999;">*</span>
          </label>
          <input id="casus-belli" name="casus_belli" type="text" required
            value={form?.action === 'declareWar' ? (form?.values?.casus_belli ?? '') : ''}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Reason for the declaration of war" />
          {#if form?.action === 'declareWar' && form?.errors?.casus_belli}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.casus_belli[0]}</p>
          {/if}
        </div>

        <div class="mb-4">
          <label for="start-date" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Start Date <span style="color: #ff9999;">*</span>
          </label>
          <input id="start-date" name="start_date" type="date" required
            value={form?.action === 'declareWar' ? (form?.values?.start_date ?? today) : today}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;" />
          {#if form?.action === 'declareWar' && form?.errors?.start_date}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.start_date[0]}</p>
          {/if}
        </div>

        <div class="mb-6">
          <label for="declare-notes" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Notes
          </label>
          <textarea id="declare-notes" name="notes" rows={3}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional context or background..."
          >{form?.action === 'declareWar' ? (form?.values?.notes ?? '') : ''}</textarea>
        </div>

        {#if form?.action === 'declareWar' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showDeclareModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={declaringSaving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if declaringSaving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Declare War
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- End War Modal -->
{#if showEndModal && endTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="end-war-modal-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="end-war-modal-title" class="text-[15px] font-semibold text-foreground mb-1">End War</h2>
      <p class="text-[11px] text-muted-foreground mb-4">Record the outcome of this conflict. This action cannot be undone.</p>

      <form method="POST" action="?/endWar"
        use:enhance={() => { endingSaving = true; return async ({ update }) => { await update(); endingSaving = false; }; }}>
        <input type="hidden" name="id" value={endTarget.id} />

        <div class="mb-4">
          <label for="outcome" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Outcome <span style="color: #ff9999;">*</span>
          </label>
          <select id="outcome" name="outcome" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select outcome...</option>
            <option value="Victory_A">Victory — {endTarget.factionAName}</option>
            <option value="Victory_B">Victory — {endTarget.factionBName}</option>
            <option value="Stalemate">Stalemate</option>
          </select>
          {#if form?.action === 'endWar' && form?.errors?.outcome}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.outcome[0]}</p>
          {/if}
        </div>

        <div class="mb-4">
          <label for="end-date" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            End Date <span style="color: #ff9999;">*</span>
          </label>
          <input id="end-date" name="end_date" type="date" required
            value={today}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;" />
        </div>

        <div class="mb-6">
          <label for="end-notes" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Notes
          </label>
          <textarea id="end-notes" name="notes" rows={3}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional notes about the war's conclusion..."
          ></textarea>
        </div>

        {#if form?.action === 'endWar' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showEndModal = false; endTarget = null; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={endingSaving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #8b2b2b; color: #ff9999;">
            {#if endingSaving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            End War
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
