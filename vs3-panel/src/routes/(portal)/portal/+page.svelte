<script lang="ts">
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';
  import { MapPin } from '@lucide/svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Date formatter: "14 Apr 2026"
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Faction Portal — VS3 Panel</title>
</svelte:head>

<h1 class="text-[22px] font-semibold text-foreground">My Faction Nodes</h1>
<p class="text-[14px] text-muted-foreground mt-1 mb-6">{data.faction.name}</p>

{#if data.nodes.length === 0}
  <!-- Empty state card -->
  <div class="bg-card border border-border rounded-md p-6 text-center">
    <MapPin class="w-8 h-8 text-muted-foreground mb-2 mx-auto" />
    <h2 class="text-[15px] font-semibold text-foreground">No nodes assigned</h2>
    <p class="text-[14px] text-muted-foreground max-w-[340px] mx-auto mt-1">
      Your faction does not currently own any nodes.
    </p>
  </div>
{:else}
  <div class="flex flex-col gap-4">
    {#each data.nodes as node (node.id)}
      <div class="bg-card border border-border rounded-md p-4">
        <!-- Card header row -->
        <div class="flex items-center justify-between">
          <div>
            <div class="text-[15px] font-semibold text-foreground">{node.name}</div>
            <div class="text-[11px] text-muted-foreground mt-1">
              {#if node.isMilitary}
                Military Node · T{node.tier} ({node.tierLabel})
              {:else}
                {node.type} · T{node.tier}
              {/if}
            </div>
          </div>
          <!-- Upkeep status badge -->
          {#if node.upkeepStatus === 'Paid'}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
              style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">
              Paid
            </span>
          {:else if node.upkeepStatus === 'Partial'}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
              style="background: rgba(180,160,50,0.2); border: 1px solid rgba(180,160,50,0.3); color: #d4c060;">
              Partial
            </span>
          {:else if node.upkeepStatus === 'Underfunded'}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
              style="background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;">
              Underfunded
            </span>
          {:else}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
              style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff7070;">
              Unpaid
            </span>
          {/if}
        </div>

        <!-- Card body: two columns -->
        <div class="mt-3 flex gap-8">
          <!-- Left: Instability -->
          <div class="flex-1">
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              INSTABILITY
            </div>
            <InstabilityDot level={node.instability} size="lg" />
          </div>

          <!-- Right: Cycle payment progress -->
          <div class="flex-1">
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              THIS CYCLE
            </div>
            <!-- Progress bar -->
            <div class="w-full h-2 rounded-full mb-1" style="background: #3d3426;">
              <div
                class="h-2 rounded-full transition-all"
                style="
                  width: {Math.min(node.paymentPct, 1) * 100}%;
                  background: {node.paymentPct >= 1 ? '#3d6b3d' : node.paymentPct >= 0.5 ? '#d4c060' : node.paymentPct > 0 ? '#e07840' : '#8b2b2b'};
                "
              ></div>
            </div>
            <div class="text-[11px] text-muted-foreground">
              {node.paidSP} / {node.requiredSP} SP
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
