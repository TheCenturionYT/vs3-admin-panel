<script lang="ts">
  import { Construction } from '@lucide/svelte';
</script>

<svelte:head>
  <title>Dashboard — VS3 Panel</title>
</svelte:head>

<div class="mb-6">
  <h1 class="text-[22px] font-semibold text-foreground">Dashboard</h1>
  <p class="text-[14px] text-muted-foreground mt-1">Server overview and health metrics</p>
</div>

<div class="bg-card border border-border rounded-md p-6 flex flex-col items-center gap-4 py-12">
  <Construction class="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
  <h2 class="text-[15px] font-semibold text-foreground text-center">
    Dashboard coming in Phase 2
  </h2>
  <p class="text-[14px] text-muted-foreground text-center max-w-[400px]">
    Faction health, node status, and upkeep metrics will appear here once Phase 2 is complete.
  </p>
</div>
