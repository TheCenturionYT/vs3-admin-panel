<script lang="ts">
  import { enhance } from '$app/forms';
  import { Download, Upload, AlertTriangle, Loader2 } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = $derived(data.isHeadAdmin);

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
