<script lang="ts">
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { Loader2, Plus } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = data.user?.role === 'head_admin';

  // Filter state
  let search = $state('');
  let debouncedSearch = $state('');
  let eventTypeFilter = $state('all');
  let factionFilter = $state('all');
  let nodeFilter = $state('all');
  let sortOrder = $state<'newest' | 'oldest'>('newest');

  // Modal state
  let showAddModal = $state(false);
  let saving = $state(false);

  // Edit/delete state (head admin only)
  type LogEntry = typeof data.logEntries[number];
  let editingEntry = $state<LogEntry | null>(null);
  let editDesc = $state('');
  let editFaction = $state('');
  let editNode = $state('');
  let editSaving = $state(false);
  let deletingEntryId = $state('');
  let deleteDialogOpen = $state(false);

  // Debounce text search 300ms
  $effect(() => {
    const t = setTimeout(() => { debouncedSearch = search; }, 300);
    return () => clearTimeout(t);
  });

  // Close modals on success
  $effect(() => {
    if (form?.success) {
      if (form.action === 'addManualEntry') showAddModal = false;
      if (form.action === 'editLogEntry') { editingEntry = null; }
      if (form.action === 'deleteLogEntry') { deleteDialogOpen = false; deletingEntryId = ''; }
    }
  });

  function openEdit(entry: LogEntry) {
    editingEntry = entry;
    editDesc = entry.description;
    editFaction = entry.related_faction ?? '';
    editNode = entry.related_node ?? '';
  }

  // Derived filtered + sorted entries
  let filteredEntries = $derived((() => {
    let entries = data.logEntries.filter(entry => {
      const matchesSearch = !debouncedSearch ||
        entry.description.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = eventTypeFilter === 'all' || entry.event_type === eventTypeFilter;
      const matchesFaction = factionFilter === 'all' || entry.related_faction === factionFilter;
      const matchesNode = nodeFilter === 'all' || entry.related_node === nodeFilter;
      return matchesSearch && matchesType && matchesFaction && matchesNode;
    });

    if (sortOrder === 'oldest') {
      entries = [...entries].reverse();
    }

    return entries;
  })());

  const EVENT_BADGE_BG = 'rgba(139,125,101,0.12)';
  const EVENT_BADGE_BORDER = '#3d3426';
  const EVENT_TEXT_COLORS: Record<string, string> = {
    faction_change: '#88bbdd',
    node_change: '#d4c060',
    war_event: '#e07840',
    diplomacy_event: '#c4a45a',
    ownership_transfer: '#e07840',
    manual_entry: '#8b7d65',
    cycle_confirmed: '#90cc90',
    instability_event: '#ff9999',
    upkeep_payment: '#c4a45a'
  };

  const EVENT_TYPE_LABELS: Record<string, string> = {
    faction_change: 'Faction Change',
    node_change: 'Node Change',
    war_event: 'War Event',
    diplomacy_event: 'Diplomacy Event',
    ownership_transfer: 'Ownership Transfer',
    manual_entry: 'Manual Entry',
    cycle_confirmed: 'Cycle Confirmed',
    instability_event: 'Instability Event',
    upkeep_payment: 'Upkeep Payment'
  };

  function formatTime(dateStr: string): string {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm');
    } catch {
      return dateStr;
    }
  }

  function eventTextColor(eventType: string): string {
    return EVENT_TEXT_COLORS[eventType] ?? '#8b7d65';
  }

  function eventLabel(eventType: string): string {
    return EVENT_TYPE_LABELS[eventType] ?? eventType;
  }
</script>

<svelte:head>
  <title>Server Log — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Server Log</h1>
    <p class="text-[14px] text-muted-foreground mt-1">Chronological record of all server events</p>
  </div>
  <button
    type="button"
    onclick={() => { showAddModal = true; }}
    class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
    style="border-color: #3d3426; color: #8b7d65;"
    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,125,101,0.10)'}
    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
  >
    <Plus class="w-4 h-4" />
    Add Manual Entry
  </button>
</div>

<!-- Filter bar -->
<div class="flex items-center gap-3 mb-4 bg-card border border-border rounded-md px-4 py-3 flex-wrap">
  <input
    type="text"
    placeholder="Search log entries..."
    bind:value={search}
    class="flex-1 min-w-[180px] bg-transparent text-[14px] text-foreground focus:outline-none placeholder:text-muted-foreground"
  />

  <!-- Event type filter -->
  <select
    bind:value={eventTypeFilter}
    class="px-3 py-1.5 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; width: 200px;"
  >
    <option value="all">All Event Types</option>
    <option value="faction_change">Faction Change</option>
    <option value="node_change">Node Change</option>
    <option value="war_event">War Event</option>
    <option value="diplomacy_event">Diplomacy Event</option>
    <option value="ownership_transfer">Ownership Transfer</option>
    <option value="manual_entry">Manual Entry</option>
    <option value="cycle_confirmed">Cycle Confirmed</option>
    <option value="instability_event">Instability Event</option>
    <option value="upkeep_payment">Upkeep Payment</option>
  </select>

  <!-- Faction filter -->
  <select
    bind:value={factionFilter}
    class="px-3 py-1.5 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; width: 180px;"
  >
    <option value="all">All Factions</option>
    {#each data.factions as faction}
      <option value={faction.id}>{faction.name}</option>
    {/each}
  </select>

  <!-- Node filter -->
  <select
    bind:value={nodeFilter}
    class="px-3 py-1.5 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426; width: 180px;"
  >
    <option value="all">All Nodes</option>
    {#each data.nodes as node}
      <option value={node.id}>{node.name}</option>
    {/each}
  </select>

  <!-- Sort toggle -->
  <div class="flex rounded-md overflow-hidden" style="border: 1px solid #3d3426;">
    <button
      type="button"
      onclick={() => { sortOrder = 'newest'; }}
      class="px-3 py-1.5 text-[14px] transition-colors"
      style={sortOrder === 'newest'
        ? 'background: rgba(196,164,90,0.12); color: #c4a45a; border-right: 1px solid #3d3426;'
        : 'background: transparent; color: #8b7d65; border-right: 1px solid #3d3426;'}
    >
      Newest First
    </button>
    <button
      type="button"
      onclick={() => { sortOrder = 'oldest'; }}
      class="px-3 py-1.5 text-[14px] transition-colors"
      style={sortOrder === 'oldest'
        ? 'background: rgba(196,164,90,0.12); color: #c4a45a;'
        : 'background: transparent; color: #8b7d65;'}
    >
      Oldest First
    </button>
  </div>
</div>

<!-- Entry count -->
<div class="text-[11px] text-muted-foreground mb-3" style="letter-spacing: 0.04em;">
  Showing {filteredEntries.length} of {data.logEntries.length} entries
</div>

<!-- Log table -->
<div class="bg-card border border-border rounded-md overflow-hidden">
  {#if data.logEntries.length === 0}
    <div class="py-12 text-center">
      <p class="text-[15px] font-semibold text-foreground mb-2">No log entries yet</p>
      <p class="text-[14px] text-muted-foreground">Events will appear here as factions, nodes, and wars are managed.</p>
    </div>
  {:else if filteredEntries.length === 0}
    <div class="py-12 text-center">
      <p class="text-[15px] font-semibold text-foreground mb-2">No matching entries</p>
      <p class="text-[14px] text-muted-foreground">Adjust your filters or search terms to find log entries.</p>
    </div>
  {:else}
    <table class="w-full">
      <thead>
        <tr style="border-bottom: 1px solid #3d3426;">
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground whitespace-nowrap" style="letter-spacing: 0.06em; width: 160px;">Time</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em; width: 170px;">Type</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Description</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em; width: 160px;">Related Faction</th>
          <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em; width: 120px;">Actor</th>
          {#if isHeadAdmin}<th class="px-4 py-2 text-[11px]" style="width: 110px;"></th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each filteredEntries as entry}
          <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
            <td class="px-4 py-2 text-[11px] text-muted-foreground whitespace-nowrap align-top pt-3">
              {formatTime(entry.created)}
            </td>
            <td class="px-4 py-2 align-top pt-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                style="background: {EVENT_BADGE_BG}; border: 1px solid {EVENT_BADGE_BORDER}; color: {eventTextColor(entry.event_type)};"
              >
                {eventLabel(entry.event_type)}
              </span>
            </td>
            <td class="px-4 py-2 text-[14px] text-foreground align-top">
              {entry.description}
            </td>
            <td class="px-4 py-2 text-[14px] text-muted-foreground align-top">
              {entry.related_faction_name ?? '—'}
            </td>
            <td class="px-4 py-2 text-[14px] text-muted-foreground align-top">
              {entry.actor}
            </td>
            {#if isHeadAdmin}
              <td class="px-4 py-2 align-top">
                <div class="flex gap-1">
                  <button type="button" onclick={() => openEdit(entry)}
                    class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                    style="border-color: #3d5a8b; color: #88bbdd;"
                    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(61,90,139,0.12)'}
                    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
                    Edit
                  </button>
                  <button type="button" onclick={() => { deletingEntryId = entry.id; deleteDialogOpen = true; }}
                    class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                    style="border-color: #8b2b2b; color: #ff9999;"
                    onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,43,43,0.12)'}
                    onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
                    Del
                  </button>
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Add Manual Entry Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="add-entry-modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="add-entry-modal-title" class="text-[15px] font-semibold text-foreground">Add Manual Log Entry</h2>
        <button type="button" onclick={() => { showAddModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Record a ruling, RP event, or staff note.</p>

      <form method="POST" action="?/addManualEntry"
        use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }}>

        <div class="mb-4">
          <label for="entry-description" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Entry Text <span style="color: #ff9999;">*</span>
          </label>
          <textarea
            id="entry-description"
            name="description"
            required
            rows={4}
            maxlength={1000}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors resize-y"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Describe the event, ruling, or note..."
          >{form?.action === 'addManualEntry' ? (form?.values?.description ?? '') : ''}</textarea>
          {#if form?.action === 'addManualEntry' && (form?.errors as Record<string, string[]> | undefined)?.description}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{(form!.errors as Record<string, string[]>).description[0]}</p>
          {/if}
        </div>

        <div class="mb-4">
          <label for="entry-faction" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Related Faction <span class="normal-case font-normal" style="color: #8b7d65;">(optional)</span>
          </label>
          <select
            id="entry-faction"
            name="related_faction"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
          >
            <option value="">No related faction</option>
            {#each data.factions as faction}
              <option value={faction.id}>{faction.name}</option>
            {/each}
          </select>
        </div>

        <div class="mb-6">
          <label for="entry-node" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Related Node <span class="normal-case font-normal" style="color: #8b7d65;">(optional)</span>
          </label>
          <select
            id="entry-node"
            name="related_node"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
          >
            <option value="">No related node</option>
            {#each data.nodes as node}
              <option value={node.id}>{node.name}</option>
            {/each}
          </select>
        </div>

        {#if form?.action === 'addManualEntry' && (form?.errors as Record<string, string[]> | undefined)?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {(form!.errors as Record<string, string[]>)._global[0]}
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
            Add Entry
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ======================== EDIT LOG ENTRY MODAL ======================== -->
{#if editingEntry}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true">
    <div class="w-full max-w-[600px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[15px] font-semibold text-foreground">Edit Log Entry</h2>
        <button type="button" onclick={() => editingEntry = null}
          class="text-muted-foreground hover:text-foreground transition-colors">&#x2715;</button>
      </div>

      <form method="POST" action="?/editLogEntry"
        use:enhance={() => { editSaving = true; return async ({ update }) => { await update({ reset: false }); editSaving = false; }; }}>
        <input type="hidden" name="id" value={editingEntry.id} />

        <div class="mb-4">
          <label class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Description <span style="color: #ff9999;">*</span>
          </label>
          <textarea name="description" rows={4} required bind:value={editDesc}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-y"
            style="background: #2c2518; border: 1px solid #3d3426;"></textarea>
        </div>

        <div class="mb-4">
          <label class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Related Faction <span class="font-normal normal-case" style="color: #8b7d65;">(optional)</span>
          </label>
          <select name="related_faction" bind:value={editFaction}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">No related faction</option>
            {#each data.factions as f}
              <option value={f.id}>{f.name}</option>
            {/each}
          </select>
        </div>

        <div class="mb-6">
          <label class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Related Node <span class="font-normal normal-case" style="color: #8b7d65;">(optional)</span>
          </label>
          <select name="related_node" bind:value={editNode}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">No related node</option>
            {#each data.nodes as n}
              <option value={n.id}>{n.name}</option>
            {/each}
          </select>
        </div>

        {#if form?.action === 'editLogEntry' && (form?.errors as Record<string, string[]> | undefined)?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {(form!.errors as Record<string, string[]>)._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => editingEntry = null}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={editSaving}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if editSaving}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ======================== DELETE LOG ENTRY DIALOG ======================== -->
{#if deleteDialogOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true">
    <div class="w-full max-w-[420px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 class="text-[15px] font-semibold text-foreground mb-3">Delete Log Entry</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Permanently delete this log entry? This cannot be undone.
      </p>
      <form method="POST" action="?/deleteLogEntry"
        use:enhance={() => { return async ({ update }) => { await update(); }; }}>
        <input type="hidden" name="id" value={deletingEntryId} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { deleteDialogOpen = false; deletingEntryId = ''; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit"
            class="px-4 py-2 rounded-md text-[14px] border transition-colors"
            style="border-color: #8b2b2b; color: #ff9999;">
            Delete Entry
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
