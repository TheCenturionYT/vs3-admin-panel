<script lang="ts">
  import { Construction } from '@lucide/svelte';
</script>

<svelte:head>
  <title>Server Log — VS3 Panel</title>
</svelte:head>

<div class="mb-6">
  <h1 class="text-[22px] font-semibold text-foreground">Server Log</h1>
  <p class="text-[14px] text-muted-foreground mt-1">Chronological record of all server events</p>
</div>

<div class="bg-card border border-border rounded-md p-6 flex flex-col items-center gap-4 py-12">
  <Construction class="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
  <h2 class="text-[15px] font-semibold text-foreground text-center">
    Server Log coming in Phase 2
  </h2>
  <p class="text-[14px] text-muted-foreground text-center max-w-[400px]">
    All faction, node, war, and upkeep events will be recorded here once Phase 2 is complete.
  </p>
</div>
