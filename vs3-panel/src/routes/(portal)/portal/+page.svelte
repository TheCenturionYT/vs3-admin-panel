<script lang="ts">
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';
  import { MapPin, Swords } from '@lucide/svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Date formatter: "14 Apr 2026"
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function getAllianceBadgeStyle(type: string): string {
    const styles: Record<string, string> = {
      'Alliance':         'background: rgba(61,107,61,0.15); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;',
      'NAP':              'background: rgba(85,136,170,0.15); border: 1px solid rgba(85,136,170,0.3); color: #88bbdd;',
      'Trade Agreement':  'background: rgba(196,164,90,0.15); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;',
      'Vassalage':        'background: rgba(160,100,40,0.15); border: 1px solid rgba(160,100,40,0.3); color: #e07840;',
      'Coalition':        'background: rgba(139,43,43,0.15); border: 1px solid rgba(139,43,43,0.3); color: #e08080;',
      'Custom':           'background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;'
    };
    return styles[type] ?? styles['Custom'];
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
          {:else if node.upkeepStatus === 'Unpaid'}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
              style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff7070;">
              Unpaid
            </span>
          {:else}
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
              style="background: rgba(80,80,80,0.2); border: 1px solid rgba(80,80,80,0.3); color: #999999;">
              N/A
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

<div class="border-t border-border my-12"></div>

<h2 class="text-[22px] font-semibold text-foreground">War & Alliance Board</h2>
<p class="text-[14px] text-muted-foreground mt-1 mb-6">
  Global view — all active wars and alliances
</p>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">

  <!-- Left column — Active Wars -->
  <div>
    <div class="text-[11px] font-semibold uppercase tracking-wider mb-3"
      style="color: #c4a45a;">
      ACTIVE WARS
    </div>

    {#if data.wars.length === 0}
      <div class="bg-muted rounded-md p-4 text-center">
        <span class="text-[14px] text-muted-foreground">No active wars.</span>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each data.wars as war (war.id)}
          <div class="bg-card border border-border rounded-md p-4">
            <!-- Row 1: parties -->
            <div class="flex items-center gap-1 text-[14px] font-semibold text-foreground">
              <span>{war.factionAName}</span>
              <Swords class="w-3 h-3 text-muted-foreground mx-1" aria-label="vs" />
              <span>{war.factionBName}</span>
            </div>
            <!-- Row 2: casus belli (omit if empty) -->
            {#if war.casusBelli}
              <div class="mt-1 text-[11px]">
                <span class="text-muted-foreground">Casus belli: </span>
                <span class="text-foreground">{war.casusBelli}</span>
              </div>
            {/if}
            <!-- Row 3: start date -->
            <div class="mt-1 text-[11px] text-muted-foreground">
              Since {formatDate(war.startDate)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Right column — Active Alliances -->
  <div>
    <div class="text-[11px] font-semibold uppercase tracking-wider mb-3"
      style="color: #c4a45a;">
      ACTIVE ALLIANCES
    </div>

    {#if data.alliances.length === 0}
      <div class="bg-muted rounded-md p-4 text-center">
        <span class="text-[14px] text-muted-foreground">No active alliances.</span>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each data.alliances as alliance (alliance.id)}
          {@const allianceBadgeStyle = getAllianceBadgeStyle(alliance.type)}
          {@const partyDisplay = alliance.parties.length === 2
            ? `${alliance.parties[0]} & ${alliance.parties[1]}`
            : alliance.parties.length > 2
              ? `${alliance.parties[0]}, ${alliance.parties[1]}, and ${alliance.parties.length - 2} more`
              : alliance.parties.join(', ')}
          <div class="bg-card border border-border rounded-md p-4">
            <!-- Row 1: type badge + parties -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={allianceBadgeStyle}>
                {alliance.type}
              </span>
              <span class="text-[14px] text-foreground">{partyDisplay}</span>
            </div>
            <!-- Row 2: start date -->
            <div class="mt-1 text-[11px] text-muted-foreground">
              Since {formatDate(alliance.startDate)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

</div><!-- end grid -->
