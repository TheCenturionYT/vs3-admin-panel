<script lang="ts">
  import { Construction } from '@lucide/svelte';
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';

  let { data } = $props();

  function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000) + 1;
  }
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

<!-- Phase 3 placeholders -->
<div class="grid grid-cols-2 gap-4">
  <div class="bg-card border border-border rounded-md p-6 flex flex-col items-center gap-3 py-10">
    <Construction class="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
    <div class="text-[15px] font-semibold text-foreground text-center">Upcoming Upkeep Deadlines</div>
    <p class="text-[14px] text-muted-foreground text-center">Upkeep tracking coming in Phase 3.</p>
  </div>

  <div class="bg-card border border-border rounded-md p-6 flex flex-col items-center gap-3 py-10">
    <Construction class="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
    <div class="text-[15px] font-semibold text-foreground text-center">Scheduler Health</div>
    <p class="text-[14px] text-muted-foreground text-center">Automated deadline processing coming in Phase 3.</p>
  </div>
</div>
