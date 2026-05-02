<script lang="ts">
  import { enhance } from '$app/forms';
  import { Download, Upload, AlertTriangle, Loader2 } from '@lucide/svelte';
  import { Switch } from '$lib/components/ui/switch';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = $derived(data.isHeadAdmin === true);

  // Deadline configuration state
  let dayOfWeek = $state<number>(data.deadlineConfig?.day_of_week ?? 6);
  let hour      = $state<number>(data.deadlineConfig?.hour ?? 23);
  let minute    = $state<number>(data.deadlineConfig?.minute ?? 59);
  let tzOffset  = $state<number>(data.deadlineConfig?.timezone_offset ?? -5);
  let isActive  = $state<boolean>(data.deadlineConfig?.is_active ?? true);
  let savingDeadline = $state(false);

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const tzLabel = $derived(tzOffset >= 0 ? `UTC+${tzOffset}` : `UTC${tzOffset}`);
  const nextDeadlinePreview = $derived(
    `${dayNames[dayOfWeek]} at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${tzLabel}`
  );

  // Export state
  let exporting = $state(false);

  // Import state
  let importing = $state(false);
  let showConfirmDialog = $state(false);
  let pendingImportForm = $state<HTMLFormElement | null>(null);
  let selectedFileName = $state('');

  // Track import success for feedback
  let importSuccess = $state(false);

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    selectedFileName = input.files?.[0]?.name ?? '';
  }

  function triggerExportDownload(exportJson: string) {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vs3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  $effect(() => {
    if (form?.success && form.action === 'importData') {
      importSuccess = true;
      showConfirmDialog = false;
      selectedFileName = '';
      // Reset the file input
      const fileInput = document.querySelector<HTMLInputElement>('input[name="backup"]');
      if (fileInput) fileInput.value = '';
    }
  });
</script>

<svelte:head>
  <title>Server Settings — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="mb-6">
  <h1 class="text-[22px] font-semibold text-foreground">Server Settings</h1>
  <p class="text-[14px] text-muted-foreground mt-1">Data export, import, and server configuration</p>
</div>

<!-- DATA EXPORT & IMPORT card -->
<div class="rounded-lg border" style="border-color: #3d3426; background: #1a1410;">
  <!-- Section label -->
  <div class="px-5 pt-5 pb-3">
    <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">Data Export &amp; Import</span>
  </div>

  <div style="border-top: 1px solid #3d3426;"></div>

  <!-- Export sub-section -->
  <div class="px-5 py-5">
    <h2 class="text-[15px] font-semibold text-foreground">Export Data</h2>
    <p class="text-[14px] text-muted-foreground mt-1 mb-4">
      Download a timestamped JSON backup of all factions, nodes, wars, diplomacy, and log entries.
    </p>

    {#if form?.action === 'exportData' && form.error}
      <div class="mb-4 flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
           style="background: rgba(180,50,50,0.12); border: 1px solid rgba(180,50,50,0.3); color: #e08080;">
        <AlertTriangle class="w-4 h-4 shrink-0" />
        {form.error}
      </div>
    {/if}

    <form
      method="POST"
      action="?/exportData"
      use:enhance={() => {
        exporting = true;
        return async ({ result }) => {
          exporting = false;
          if (result.type === 'success' && result.data?.exportJson) {
            triggerExportDownload(result.data.exportJson as string);
          }
        };
      }}
    >
      <button
        type="submit"
        disabled={exporting}
        class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style="border-color: #c4a45a; color: #c4a45a;"
        onmouseover={(e) => { if (!exporting) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'; }}
        onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
      >
        {#if exporting}
          <Loader2 class="w-4 h-4 animate-spin" />
          Exporting…
        {:else}
          <Download class="w-4 h-4" />
          Export JSON
        {/if}
      </button>
    </form>
  </div>

  <div style="border-top: 1px solid #3d3426;"></div>

  <!-- Import sub-section -->
  <div class="px-5 py-5">
    <h2 class="text-[15px] font-semibold text-foreground">Import Data</h2>
    <p class="text-[14px] text-muted-foreground mt-1 mb-4">
      Restore from a previously exported JSON backup. This will overwrite all current data.
    </p>

    {#if isHeadAdmin}
      <!-- Danger alert -->
      <div class="mb-4 flex items-start gap-3 rounded-md px-4 py-3 text-[13px]"
           style="background: rgba(180,50,50,0.12); border: 1px solid rgba(180,50,50,0.3); color: #e08080;">
        <AlertTriangle class="w-4 h-4 shrink-0 mt-[1px]" />
        <span>This action will permanently replace all existing data. Ensure you have a backup before importing.</span>
      </div>

      {#if form?.action === 'importData' && form.error}
        <div class="mb-4 flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
             style="background: rgba(180,50,50,0.12); border: 1px solid rgba(180,50,50,0.3); color: #e08080;">
          <AlertTriangle class="w-4 h-4 shrink-0" />
          {form.error}
        </div>
      {/if}

      {#if importSuccess}
        <div class="mb-4 flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
             style="background: rgba(61,107,61,0.15); border: 1px solid rgba(61,107,61,0.25); color: #90cc90;">
          Import completed successfully.
        </div>
      {/if}

      <form
        method="POST"
        action="?/importData"
        enctype="multipart/form-data"
        bind:this={pendingImportForm}
        use:enhance={() => {
          importing = true;
          importSuccess = false;
          return async ({ update }) => {
            importing = false;
            await update();
          };
        }}
      >
        <!-- File input -->
        <div class="mb-4">
          <label
            for="backup-file"
            class="block text-[13px] text-muted-foreground mb-2"
          >Choose JSON file</label>
          <input
            id="backup-file"
            name="backup"
            type="file"
            accept=".json,application/json"
            onchange={onFileChange}
            class="block text-[13px] text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:text-[13px] file:cursor-pointer file:transition-colors"
            style="file-border-color: #3d3426; file:border-color: #3d3426; file:background: #2a2118; file:color: #c4a45a;"
          />
          {#if selectedFileName}
            <p class="mt-1.5 text-[12px] text-muted-foreground">Selected: {selectedFileName}</p>
          {/if}
        </div>

        <!-- Import button — opens confirmation dialog instead of submitting directly -->
        <button
          type="button"
          disabled={importing || !selectedFileName}
          onclick={() => { showConfirmDialog = true; }}
          class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style="border-color: #b04040; color: #e08080; background: rgba(180,50,50,0.08);"
          onmouseover={(e) => { if (!importing && selectedFileName) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,50,50,0.18)'; }}
          onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,50,50,0.08)'}
        >
          {#if importing}
            <Loader2 class="w-4 h-4 animate-spin" />
            Importing…
          {:else}
            <Upload class="w-4 h-4" />
            Import from JSON
          {/if}
        </button>
      </form>
    {:else}
      <!-- Staff read-only notice -->
      <div class="flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
           style="background: rgba(255,255,255,0.04); border: 1px solid #3d3426; color: #7a6e60;">
        Data import requires Head Admin access.
      </div>
    {/if}
  </div>
</div>

<!-- DEADLINE CONFIGURATION card -->
<div class="rounded-lg border" style="border-color: #3d3426; background: #1a1410; margin-top: 1rem;">
  <div class="px-5 pt-5 pb-3">
    <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">DEADLINE CONFIGURATION</span>
  </div>
  <div style="border-top: 1px solid #3d3426;"></div>
  <div class="px-5 py-5">
    <p class="text-[14px] text-muted-foreground mb-4">Configure when the weekly upkeep deadline is processed.</p>

    {#if !isHeadAdmin}
      <p class="text-[14px] text-muted-foreground italic mb-4">Deadline configuration requires Head Admin access.</p>
    {/if}

    <form method="POST" action="?/saveDeadlineConfig" use:enhance={() => {
      savingDeadline = true;
      return async ({ update }) => { await update(); savingDeadline = false; };
    }}>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Day of Week</span>
          <select name="day_of_week" bind:value={dayOfWeek} disabled={!isHeadAdmin}
                  class="mt-1 block w-full rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground">
            {#each dayNames as name, i}
              <option value={i}>{name}</option>
            {/each}
          </select>
        </label>

        <div class="flex items-end gap-2">
          <label class="block flex-1">
            <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Hour (0–23)</span>
            <input type="number" name="hour" min="0" max="23" bind:value={hour} disabled={!isHeadAdmin}
                   class="mt-1 block w-full rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground" />
          </label>
          <span class="text-[14px] text-muted-foreground pb-3">:</span>
          <label class="block flex-1">
            <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Minute (0–59)</span>
            <input type="number" name="minute" min="0" max="59" bind:value={minute} disabled={!isHeadAdmin}
                   class="mt-1 block w-full rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground" />
          </label>
        </div>

        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">UTC Offset (hours)</span>
          <input type="number" name="timezone_offset" min="-12" max="14" step="1" bind:value={tzOffset} disabled={!isHeadAdmin}
                 class="mt-1 block w-full rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground" />
          <span class="text-[11px] text-muted-foreground">e.g. -5 for EST, +0 for UTC, +1 for CET</span>
        </label>

        <div class="flex items-center gap-3 pt-6">
          <Switch name="is_active" bind:checked={isActive} disabled={!isHeadAdmin} />
          <input type="hidden" name="is_active" value={isActive ? 'on' : ''} />
          <span class="text-[14px] text-foreground">Scheduler active</span>
        </div>
      </div>

      <div class="text-[14px] text-muted-foreground mb-4">
        Next deadline: <span class="text-foreground">{nextDeadlinePreview}</span>
      </div>

      {#if !isActive}
        <div class="text-[13px] mb-3" style="color: #d4c060;">
          Disabling the scheduler will stop automatic deadline processing.
        </div>
      {/if}

      {#if isHeadAdmin}
        <button type="submit" disabled={savingDeadline}
                class="rounded-md px-4 py-2 text-[14px] font-semibold"
                style="background: #c4a45a; color: #1a1410;">
          {savingDeadline ? 'Saving…' : 'Save Deadline Config'}
        </button>
      {/if}
    </form>

    {#if data.deadlineConfig?.last_processed_ts}
      <div class="text-[11px] text-muted-foreground mt-4">
        Last processed: {data.deadlineConfig.last_processed_ts}
      </div>
    {:else}
      <div class="text-[11px] text-muted-foreground mt-4">Never processed</div>
    {/if}
  </div>
</div>

<!-- Import Confirmation Dialog -->
{#if showConfirmDialog}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40"
    style="background: rgba(0,0,0,0.6);"
    role="presentation"
    onclick={() => { showConfirmDialog = false; }}
    onkeydown={(e) => { if (e.key === 'Escape') showConfirmDialog = false; }}
  ></div>

  <!-- Dialog -->
  <div
    class="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-xl"
    style="width: 400px; background: #1a1410; border: 1px solid #3d3426;"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
  >
    <div class="px-6 py-5">
      <h3 id="confirm-title" class="text-[16px] font-semibold text-foreground mb-2">Import and Overwrite Data</h3>
      <p class="text-[14px] text-muted-foreground leading-relaxed">
        Importing will permanently replace all current factions, nodes, wars, diplomacy records,
        and server log entries with the contents of the selected file.
        This cannot be undone. Are you absolutely sure?
      </p>
    </div>

    <div class="px-6 pb-5 flex items-center justify-end gap-3">
      <!-- Cancel -->
      <button
        type="button"
        onclick={() => { showConfirmDialog = false; }}
        class="px-4 py-2 rounded-md text-[14px] text-muted-foreground transition-colors"
        style="background: transparent; border: 1px solid #3d3426;"
        onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'}
        onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
      >
        Cancel
      </button>

      <!-- Confirm — actually submits the form -->
      <button
        type="button"
        onclick={() => {
          showConfirmDialog = false;
          pendingImportForm?.requestSubmit();
        }}
        class="px-4 py-2 rounded-md text-[14px] transition-colors"
        style="background: rgba(180,50,50,0.2); border: 1px solid #b04040; color: #e08080;"
        onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,50,50,0.35)'}
        onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,50,50,0.2)'}
      >
        Yes, Overwrite All Data
      </button>
    </div>
  </div>
{/if}
