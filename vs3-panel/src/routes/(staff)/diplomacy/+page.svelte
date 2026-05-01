<script lang="ts">
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { Loader2, Plus } from '@lucide/svelte';
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Modal state
  let showCreateModal = $state(false);
  let showEndDialog = $state(false);
  let endTarget = $state<{ id: string; label: string } | null>(null);

  // Loading states
  let saving = $state(false);
  let ending = $state(false);

  // Create form reactive state
  let selectedType = $state('Alliance');
  let showCustomName = $derived(selectedType === 'Custom');

  const isHeadAdmin = data.user.role === 'head_admin';

  function openEndDialog(ag: { id: string; faction_a_name: string; faction_b_name: string; type: string; custom_name: string }) {
    const label = ag.type === 'Custom' && ag.custom_name ? ag.custom_name : ag.type;
    endTarget = { id: ag.id, label: `${label} — ${ag.faction_a_name} ↔ ${ag.faction_b_name}` };
    showEndDialog = true;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  }

  function badgeStyle(type: string): string {
    switch (type) {
      case 'Alliance':
        return 'background: rgba(196,164,90,0.2); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;';
      case 'NAP':
        return 'background: rgba(85,136,170,0.15); border: 1px solid rgba(85,136,170,0.25); color: #88bbdd;';
      case 'Trade Agreement':
        return 'background: rgba(61,107,61,0.15); border: 1px solid rgba(61,107,61,0.25); color: #90cc90;';
      case 'Vassalage':
        return 'background: rgba(200,100,40,0.15); border: 1px solid rgba(200,100,40,0.25); color: #e07840;';
      case 'Coalition':
        return 'background: rgba(160,60,60,0.15); border: 1px solid rgba(160,60,60,0.25); color: #d06868;';
      case 'Custom':
      default:
        return 'background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;';
    }
  }

  $effect(() => {
    if (form?.success) {
      showCreateModal = false;
      showEndDialog = false;
      selectedType = 'Alliance';
    }
  });
</script>

<svelte:head>
  <title>Diplomacy — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Diplomacy</h1>
    <p class="text-[14px] text-muted-foreground mt-1">Alliances, treaties, and agreements between factions</p>
  </div>
  <button
    type="button"
    onclick={() => { showCreateModal = true; selectedType = 'Alliance'; }}
    class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
    style="border-color: #c4a45a; color: #c4a45a;"
    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
  >
    <Plus class="w-4 h-4" />
    New Agreement
  </button>
</div>

<!-- Tabs -->
<Tabs value="active">
  <TabsList>
    <TabsTrigger value="active">Active Agreements</TabsTrigger>
    <TabsTrigger value="history">Agreement History</TabsTrigger>
  </TabsList>

  <!-- Active Agreements -->
  <TabsContent value="active">
    <div class="mt-4">
      {#if data.activeAgreements.length === 0}
        <div class="bg-card border border-border rounded-md py-12 text-center">
          <p class="text-[15px] font-semibold text-foreground mb-2">No active agreements</p>
          <p class="text-[14px] text-muted-foreground">Create an agreement to track alliances and treaties.</p>
        </div>
      {:else}
        {#each data.activeAgreements as ag}
          <div class="bg-card border border-border rounded-md p-4 mb-2 flex items-center gap-4">
            <!-- Type badge -->
            <span class="shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                  style={badgeStyle(ag.type)}>
              {ag.type === 'Custom' && ag.custom_name ? ag.custom_name : ag.type}
            </span>

            <!-- Faction names -->
            <span class="text-[15px] font-semibold text-foreground">
              {ag.faction_a_name} ↔ {ag.faction_b_name}
            </span>

            <!-- Terms snippet -->
            {#if ag.terms}
              <span class="text-[14px] text-muted-foreground truncate flex-1" title={ag.terms}>
                {ag.terms.length > 80 ? ag.terms.slice(0, 80) + '…' : ag.terms}
              </span>
            {:else}
              <span class="flex-1"></span>
            {/if}

            <!-- Start date -->
            <span class="text-[11px] text-muted-foreground shrink-0">{formatDate(ag.start_date)}</span>

            <!-- End Agreement button (head_admin only) -->
            {#if isHeadAdmin}
              <button
                type="button"
                onclick={() => openEndDialog(ag)}
                class="shrink-0 px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                style="border-color: #8b2b2b; color: #ff9999;"
              >
                End Agreement
              </button>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </TabsContent>

  <!-- Agreement History -->
  <TabsContent value="history">
    <div class="mt-4">
      {#if data.endedAgreements.length === 0}
        <div class="bg-card border border-border rounded-md py-12 text-center">
          <p class="text-[15px] font-semibold text-foreground mb-2">No past agreements on record</p>
          <p class="text-[14px] text-muted-foreground">Ended agreements will appear here.</p>
        </div>
      {:else}
        {#each data.endedAgreements as ag}
          <div class="bg-card border border-border rounded-md p-4 mb-2 flex items-center gap-4">
            <!-- Type badge -->
            <span class="shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                  style={badgeStyle(ag.type)}>
              {ag.type === 'Custom' && ag.custom_name ? ag.custom_name : ag.type}
            </span>

            <!-- Faction names -->
            <span class="text-[15px] font-semibold text-foreground">
              {ag.faction_a_name} ↔ {ag.faction_b_name}
            </span>

            <!-- Terms snippet -->
            {#if ag.terms}
              <span class="text-[14px] text-muted-foreground truncate flex-1" title={ag.terms}>
                {ag.terms.length > 80 ? ag.terms.slice(0, 80) + '…' : ag.terms}
              </span>
            {:else}
              <span class="flex-1"></span>
            {/if}

            <!-- Date range -->
            <span class="text-[11px] text-muted-foreground shrink-0">
              {formatDate(ag.start_date)} – {formatDate(ag.end_date)}
            </span>

            <!-- Ended badge -->
            <span class="shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold"
                  style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">
              Ended
            </span>
          </div>
        {/each}
      {/if}
    </div>
  </TabsContent>
</Tabs>

<!-- Create Agreement Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="create-modal-title" class="text-[15px] font-semibold text-foreground">New Agreement</h2>
        <button type="button" onclick={() => { showCreateModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Record a diplomacy agreement between two factions</p>

      <form method="POST" action="?/createAgreement"
        use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }}>

        <!-- Agreement Type -->
        <div class="mb-4">
          <label for="ag-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Type <span style="color: #ff9999;">*</span>
          </label>
          <select id="ag-type" name="type" required
            bind:value={selectedType}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="Alliance">Alliance</option>
            <option value="NAP">NAP</option>
            <option value="Trade Agreement">Trade Agreement</option>
            <option value="Vassalage">Vassalage</option>
            <option value="Coalition">Coalition</option>
            <option value="Custom">Custom</option>
          </select>
          {#if form?.action === 'createAgreement' && form?.errors?.type}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.type[0]}</p>
          {/if}
        </div>

        <!-- Custom Name (only when type = Custom) -->
        {#if showCustomName}
          <div class="mb-4">
            <label for="ag-custom-name" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Custom Name <span style="color: #ff9999;">*</span>
            </label>
            <input id="ag-custom-name" name="custom_name" type="text"
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder="Enter agreement name" />
            {#if form?.action === 'createAgreement' && form?.errors?.custom_name}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.custom_name[0]}</p>
            {/if}
          </div>
        {/if}

        <!-- Faction A -->
        <div class="mb-4">
          <label for="ag-faction-a" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Faction A <span style="color: #ff9999;">*</span>
          </label>
          <select id="ag-faction-a" name="faction_a" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select a faction...</option>
            {#each data.factions as faction}
              <option value={faction.id}>{faction.name}</option>
            {/each}
          </select>
          {#if form?.action === 'createAgreement' && form?.errors?.faction_a}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.faction_a[0]}</p>
          {/if}
        </div>

        <!-- Faction B -->
        <div class="mb-4">
          <label for="ag-faction-b" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Faction B <span style="color: #ff9999;">*</span>
          </label>
          <select id="ag-faction-b" name="faction_b" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select a faction...</option>
            {#each data.factions as faction}
              <option value={faction.id}>{faction.name}</option>
            {/each}
          </select>
          {#if form?.action === 'createAgreement' && form?.errors?.faction_b}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.faction_b[0]}</p>
          {/if}
        </div>

        <!-- Terms (optional) -->
        <div class="mb-4">
          <label for="ag-terms" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Terms <span class="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <textarea id="ag-terms" name="terms" rows="3"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Describe the terms and conditions of this agreement..."></textarea>
        </div>

        <!-- Start Date -->
        <div class="mb-6">
          <label for="ag-start-date" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Start Date <span style="color: #ff9999;">*</span>
          </label>
          <input id="ag-start-date" name="start_date" type="date" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;" />
          {#if form?.action === 'createAgreement' && form?.errors?.start_date}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.start_date[0]}</p>
          {/if}
        </div>

        {#if form?.action === 'createAgreement' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showCreateModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={saving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if saving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Create Agreement
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- End Agreement Dialog -->
{#if showEndDialog && endTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="end-dialog-title">
    <div class="w-full max-w-[480px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="end-dialog-title" class="text-[15px] font-semibold text-foreground mb-1">End Agreement</h2>
      <p class="text-[14px] text-muted-foreground mb-4">
        Ending <strong class="text-foreground">{endTarget.label}</strong> will move it to Agreement History.
      </p>

      <form method="POST" action="?/endAgreement"
        use:enhance={() => { ending = true; return async ({ update }) => { await update(); ending = false; }; }}>
        <input type="hidden" name="id" value={endTarget.id} />

        <!-- End Date -->
        <div class="mb-4">
          <label for="end-date" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            End Date <span style="color: #ff9999;">*</span>
          </label>
          <input id="end-date" name="end_date" type="date" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;" />
          {#if form?.action === 'endAgreement' && form?.errors?.end_date}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.end_date[0]}</p>
          {/if}
        </div>

        <!-- Notes (optional) -->
        <div class="mb-6">
          <label for="end-notes" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Notes <span class="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <textarea id="end-notes" name="notes" rows="3"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Reason or context for ending this agreement..."></textarea>
        </div>

        {#if form?.action === 'endAgreement' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showEndDialog = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={ending}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #8b2b2b; color: #ff9999;">
            {#if ending}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            End Agreement
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
