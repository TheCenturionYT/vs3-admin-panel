<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs';
  import { Bar, Pie } from 'svelte5-chartjs';
  import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement } from 'chart.js';
  import { format, startOfWeek } from 'date-fns';
  import type { PageData } from './$types';

  Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

  let { data }: { data: PageData } = $props();

  // SP Totals filters
  let groupBy = $state<'category' | 'item' | 'faction' | 'node'>('category');
  let dateRange = $state<'all' | '4w' | '12w' | 'current'>('all');
  let factionFilter = $state<string>('');
  let nodeFilter = $state<string>('');

  // Weekly Chart filter
  let chartFactionFilter = $state<string>('');

  type SnapshotItem = { item_name: string; category: string; qty: number; sp_value: number };

  function rangeCutoffMs(range: 'all' | '4w' | '12w' | 'current'): number {
    if (range === 'all') return 0;
    if (range === '4w') return Date.now() - 4 * 7 * 86400000;
    if (range === '12w') return Date.now() - 12 * 7 * 86400000;
    // current — last 7 days
    return Date.now() - 7 * 86400000;
  }

  const filteredHistory = $derived((() => {
    const cutoff = rangeCutoffMs(dateRange);
    return data.submissionHistory.filter(h => {
      if (cutoff && new Date(h.deadline_ts).getTime() < cutoff) return false;
      if (factionFilter) {
        const node = data.nodes.find(n => n.id === h.node);
        if (!node || node.owner !== factionFilter) return false;
      }
      if (nodeFilter && h.node !== nodeFilter) return false;
      return true;
    });
  })());

  const totalsRows = $derived((() => {
    // Parse all snapshots once
    const items: Array<SnapshotItem & { node: string; faction: string; deadline_ts: string }> = [];
    for (const h of filteredHistory) {
      const node = data.nodes.find(n => n.id === h.node);
      try {
        // PocketBase json-typed fields return already-deserialized values via the SDK.
        // Guard handles both native array (normal) and legacy string (pre-WR-07-fix data).
        const snap: SnapshotItem[] = Array.isArray(h.snapshot)
          ? (h.snapshot as SnapshotItem[])
          : (typeof h.snapshot === 'string' ? JSON.parse(h.snapshot || '[]') : []);
        for (const s of snap) {
          items.push({ ...s, node: h.node, faction: node?.owner ?? '', deadline_ts: h.deadline_ts });
        }
      } catch { /* skip malformed */ }
    }

    if (groupBy === 'category') {
      const map = new Map<string, { totalSP: number; count: number }>();
      for (const i of items) {
        const e = map.get(i.category) ?? { totalSP: 0, count: 0 };
        e.totalSP += i.sp_value; e.count += 1; map.set(i.category, e);
      }
      const grand = items.reduce((s, i) => s + i.sp_value, 0) || 1;
      return Array.from(map.entries()).map(([k, v]) => ({
        key: k, label: k, totalSP: v.totalSP, count: v.count,
        pct: Math.round(v.totalSP / grand * 100)
      })).sort((a, b) => b.totalSP - a.totalSP);
    }
    if (groupBy === 'item') {
      const map = new Map<string, { category: string; totalSP: number; totalQty: number; count: number }>();
      for (const i of items) {
        const e = map.get(i.item_name) ?? { category: i.category, totalSP: 0, totalQty: 0, count: 0 };
        e.totalSP += i.sp_value; e.totalQty += i.qty; e.count += 1; map.set(i.item_name, e);
      }
      return Array.from(map.entries()).map(([k, v]) => ({
        key: k, label: k, category: v.category, totalSP: v.totalSP, totalQty: v.totalQty,
        count: v.count, avgPerSubmission: v.count ? Math.round(v.totalSP / v.count) : 0
      })).sort((a, b) => b.totalSP - a.totalSP);
    }
    if (groupBy === 'faction') {
      const map = new Map<string, { nodeIds: Set<string>; owedSP: number; paidSP: number }>();
      for (const h of filteredHistory) {
        const node = data.nodes.find(n => n.id === h.node);
        const fid = node?.owner ?? '';
        if (!fid) continue;
        const e = map.get(fid) ?? { nodeIds: new Set(), owedSP: 0, paidSP: 0 };
        e.nodeIds.add(h.node); e.owedSP += h.required_sp; e.paidSP += h.paid_sp;
        map.set(fid, e);
      }
      return Array.from(map.entries()).map(([fid, v]) => {
        const f = data.factions.find(x => x.id === fid);
        return {
          key: fid, label: f?.name ?? '(unknown)', color: f?.color ?? '#888',
          nodes: v.nodeIds.size, owedSP: v.owedSP, paidSP: v.paidSP,
          rate: v.owedSP ? Math.round(v.paidSP / v.owedSP * 100) : 0
        };
      }).sort((a, b) => b.paidSP - a.paidSP);
    }
    // groupBy === 'node'
    const map = new Map<string, { paidSP: number; cycles: number; rateSum: number }>();
    for (const h of filteredHistory) {
      const e = map.get(h.node) ?? { paidSP: 0, cycles: 0, rateSum: 0 };
      e.paidSP += h.paid_sp; e.cycles += 1;
      e.rateSum += h.required_sp ? (h.paid_sp / h.required_sp * 100) : 0;
      map.set(h.node, e);
    }
    return Array.from(map.entries()).map(([nid, v]) => {
      const n = data.nodes.find(x => x.id === nid);
      const owner = data.factions.find(f => f.id === n?.owner);
      return {
        key: nid, label: n?.name ?? '(unknown)', ownerName: owner?.name ?? '',
        ownerColor: owner?.color ?? '#888', type: n?.type ?? '',
        paidSP: v.paidSP, cycles: v.cycles,
        avgRate: v.cycles ? Math.round(v.rateSum / v.cycles) : 0
      };
    }).sort((a, b) => b.paidSP - a.paidSP);
  })());

  const PIE_PALETTE = [
    '#c4a45a','#3d6b3d','#3d6b8a','#8b4b6b',
    '#6b8b3d','#8b6b3d','#5a8a8a','#8a5a3d',
    '#6b3d8b','#3d8b6b','#8b3d5a','#3d5a8b'
  ];

  const pieData = $derived((() => {
    if (totalsRows.length === 0) return null;

    if (groupBy === 'faction') {
      const rows = totalsRows as Array<{ key: string; label: string; color: string; paidSP: number }>;
      const positive = rows.filter(r => r.paidSP > 0);
      if (positive.length === 0) return null;
      return {
        labels: positive.map(r => r.label),
        datasets: [{ data: positive.map(r => r.paidSP), backgroundColor: positive.map(r => r.color), borderColor: '#1a1510', borderWidth: 2 }]
      };
    }
    if (groupBy === 'node') {
      const rows = totalsRows as Array<{ key: string; label: string; ownerColor: string; paidSP: number }>;
      const positive = rows.filter(r => r.paidSP > 0).slice(0, 12);
      if (positive.length === 0) return null;
      return {
        labels: positive.map(r => r.label),
        datasets: [{ data: positive.map(r => r.paidSP), backgroundColor: positive.map(r => r.ownerColor), borderColor: '#1a1510', borderWidth: 2 }]
      };
    }
    // category / item — from snapshot SP values
    const rows = totalsRows as Array<{ key: string; label: string; totalSP: number }>;
    const positive = rows.filter(r => r.totalSP > 0).slice(0, 12);
    if (positive.length === 0) return null;
    return {
      labels: positive.map(r => r.label),
      datasets: [{ data: positive.map(r => r.totalSP), backgroundColor: positive.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]), borderColor: '#1a1510', borderWidth: 2 }]
    };
  })());

  function paymentRateColor(rate: number): string {
    if (rate >= 100) return '#90cc90';
    if (rate >= 50) return '#d4c060';
    return '#e07840';
  }

  // Weekly chart aggregation
  const chartData = $derived((() => {
    type Bucket = { weekKey: string; weekLabel: string; ts: number; perFaction: Map<string, { owed: number; paid: number }> };
    const buckets = new Map<string, Bucket>();
    for (const h of data.submissionHistory) {
      const dt = new Date(h.deadline_ts);
      const ws = startOfWeek(dt, { weekStartsOn: 1 });
      const key = ws.toISOString();
      const node = data.nodes.find(n => n.id === h.node);
      const fid = node?.owner ?? '';
      if (!fid) continue;
      if (chartFactionFilter && fid !== chartFactionFilter) continue;
      let b = buckets.get(key);
      if (!b) {
        b = { weekKey: key, weekLabel: format(ws, 'MMM dd'), ts: ws.getTime(), perFaction: new Map() };
        buckets.set(key, b);
      }
      const fe = b.perFaction.get(fid) ?? { owed: 0, paid: 0 };
      fe.owed += h.required_sp; fe.paid += h.paid_sp;
      b.perFaction.set(fid, fe);
    }
    const sortedBuckets = Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
    const labels = sortedBuckets.map(b => b.weekLabel);

    const factionsToShow = chartFactionFilter
      ? data.factions.filter(f => f.id === chartFactionFilter)
      : data.factions.filter(f => f.name !== 'Neutral Territory');

    const datasets: Array<{ label: string; data: number[]; backgroundColor: string; borderColor: string }> = [];
    for (const f of factionsToShow) {
      datasets.push({
        label: `${f.name} — Owed`,
        data: sortedBuckets.map(b => b.perFaction.get(f.id)?.owed ?? 0),
        backgroundColor: 'rgba(196,164,90,0.75)',
        borderColor: '#c4a45a'
      });
      datasets.push({
        label: `${f.name} — Paid`,
        data: sortedBuckets.map(b => b.perFaction.get(f.id)?.paid ?? 0),
        backgroundColor: 'rgba(61,107,61,0.75)',
        borderColor: '#3d6b3d'
      });
    }
    return { labels, datasets, isEmpty: sortedBuckets.length === 0 };
  })());
</script>

<svelte:head><title>Metrics — VS3 Panel</title></svelte:head>

<div class="mb-6">
  <h1 class="text-[22px] font-semibold text-foreground">Metrics</h1>
  <p class="text-[14px] text-muted-foreground mt-1">SP submission totals and payment performance</p>
</div>

<Tabs.Root value="totals">
  <Tabs.List class="border-b border-border rounded-none bg-transparent h-auto p-0 gap-0 mb-6">
    <Tabs.Trigger
      value="totals"
      class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors"
    >
      SP Totals
    </Tabs.Trigger>
    <Tabs.Trigger
      value="chart"
      class="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors"
    >
      Weekly Chart
    </Tabs.Trigger>
  </Tabs.List>

  <!-- SP Totals tab -->
  <Tabs.Content value="totals">
    <!-- Filter bar -->
    <div class="flex flex-wrap gap-3 mb-4">
      <div>
        <label class="block text-[11px] font-semibold uppercase text-muted-foreground mb-1" style="letter-spacing: 0.07em;">Group By</label>
        <select
          bind:value={groupBy}
          class="rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground"
          style="min-width: 160px;"
        >
          <option value="category">By Category</option>
          <option value="item">By Item</option>
          <option value="faction">By Faction</option>
          <option value="node">By Node</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-semibold uppercase text-muted-foreground mb-1" style="letter-spacing: 0.07em;">Date Range</label>
        <select
          bind:value={dateRange}
          class="rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground"
          style="min-width: 180px;"
        >
          <option value="all">All Time</option>
          <option value="4w">Last 4 Weeks</option>
          <option value="12w">Last 12 Weeks</option>
          <option value="current">Current Cycle</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-semibold uppercase text-muted-foreground mb-1" style="letter-spacing: 0.07em;">Faction</label>
        <select
          bind:value={factionFilter}
          class="rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground"
          style="min-width: 180px;"
        >
          <option value="">All Factions</option>
          {#each data.factions as f (f.id)}
            <option value={f.id}>{f.name}</option>
          {/each}
        </select>
      </div>
      {#if groupBy !== 'node'}
        <div>
          <label class="block text-[11px] font-semibold uppercase text-muted-foreground mb-1" style="letter-spacing: 0.07em;">Node</label>
          <select
            bind:value={nodeFilter}
            class="rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground"
            style="min-width: 180px;"
          >
            <option value="">All Nodes</option>
            {#each data.nodes as n (n.id)}
              <option value={n.id}>{n.name}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>

    <!-- Pie chart + table -->
    {#if totalsRows.length === 0}
      <div class="bg-card border border-border rounded-md py-8 text-center text-[14px] text-muted-foreground">
        No submission data for the selected filters. Data appears after the first cycle is pushed.
      </div>
    {:else}
      <div class="flex gap-4 mb-4">
        <!-- Pie chart -->
        <div class="bg-card border border-border rounded-md p-4 flex items-center justify-center" style="min-width: 260px; width: 260px; height: 260px;">
          {#if pieData}
            <Pie
              data={pieData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => ` ${ctx.label}: ${ctx.parsed} SP`
                    }
                  }
                }
              }}
            />
          {:else}
            <p class="text-[13px] text-muted-foreground text-center">No positive SP data to chart.</p>
          {/if}
        </div>
        <!-- Legend -->
        {#if pieData}
          <div class="bg-card border border-border rounded-md p-4 flex-1 overflow-auto" style="max-height: 260px;">
            <div class="text-[11px] font-semibold uppercase text-muted-foreground mb-3" style="letter-spacing: 0.07em;">Breakdown</div>
            <div class="space-y-1.5">
              {#each pieData.labels as label, i}
                <div class="flex items-center gap-2 text-[13px]">
                  <span class="w-3 h-3 rounded-sm shrink-0" style="background: {pieData.datasets[0].backgroundColor[i]};"></span>
                  <span class="text-foreground truncate flex-1">{label}</span>
                  <span class="text-muted-foreground shrink-0">{pieData.datasets[0].data[i]} SP</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Detail table (only when there's data) -->
    {#if totalsRows.length > 0}
    <div class="bg-card border border-border rounded-md">
      {#if groupBy === 'category'}
        <table class="w-full text-[14px]">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Category</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Total SP</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Submission Count</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">% of All SP</th>
            </tr>
          </thead>
          <tbody>
            {#each totalsRows as row (row.key)}
              <tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td class="px-4 py-3 text-foreground">{row.label}</td>
                <td class="px-4 py-3 text-right font-semibold" style="color: #c4a45a;">{row.totalSP} SP</td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.pct}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else if groupBy === 'item'}
        <table class="w-full text-[14px]">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Item Name</th>
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Category</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Total SP</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Total Qty</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Avg SP/Submission</th>
            </tr>
          </thead>
          <tbody>
            {#each totalsRows as row (row.key)}
              <tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td class="px-4 py-3 text-foreground">{row.label}</td>
                <td class="px-4 py-3 text-muted-foreground">{row.category}</td>
                <td class="px-4 py-3 text-right font-semibold" style="color: #c4a45a;">{row.totalSP} SP</td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.totalQty}</td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.avgPerSubmission} SP</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else if groupBy === 'faction'}
        <table class="w-full text-[14px]">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Faction</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Nodes</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Total SP Owed</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Total SP Paid</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Payment Rate</th>
            </tr>
          </thead>
          <tbody>
            {#each totalsRows as row (row.key)}
              <tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td class="px-4 py-3">
                  <span class="flex items-center gap-2 text-foreground">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {row.color};"></span>
                    {row.label}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.nodes}</td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.owedSP} SP</td>
                <td class="px-4 py-3 text-right font-semibold" style="color: #c4a45a;">{row.paidSP} SP</td>
                <td class="px-4 py-3 text-right font-semibold" style="color: {paymentRateColor(row.rate)};">{row.rate}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <!-- groupBy === 'node' -->
        <table class="w-full text-[14px]">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Node</th>
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Owner</th>
              <th class="text-left text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Type</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Total SP Paid</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Cycles Tracked</th>
              <th class="text-right text-[11px] font-semibold uppercase text-muted-foreground px-4 py-3" style="letter-spacing: 0.07em;">Avg Payment Rate</th>
            </tr>
          </thead>
          <tbody>
            {#each totalsRows as row (row.key)}
              <tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td class="px-4 py-3">
                  <a href="/nodes/{row.key}" class="text-foreground hover:text-primary transition-colors">{row.label}</a>
                </td>
                <td class="px-4 py-3">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background: {row.ownerColor};"></span>
                    {row.ownerName}
                  </span>
                </td>
                <td class="px-4 py-3 text-muted-foreground">{row.type}</td>
                <td class="px-4 py-3 text-right font-semibold" style="color: #c4a45a;">{row.paidSP} SP</td>
                <td class="px-4 py-3 text-right text-muted-foreground">{row.cycles}</td>
                <td class="px-4 py-3 text-right font-semibold" style="color: {paymentRateColor(row.avgRate)};">{row.avgRate}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
    {/if}
  </Tabs.Content>

  <!-- Weekly Chart tab -->
  <Tabs.Content value="chart">
    <div class="mb-4">
      <label class="block text-[11px] font-semibold uppercase text-muted-foreground mb-1" style="letter-spacing: 0.07em;">Faction</label>
      <select
        bind:value={chartFactionFilter}
        class="rounded-md bg-card border border-border px-3 py-2 text-[14px] text-foreground"
        style="min-width: 240px;"
      >
        <option value="">All Factions</option>
        {#each data.factions.filter(f => f.name !== 'Neutral Territory') as f (f.id)}
          <option value={f.id}>{f.name}</option>
        {/each}
      </select>
    </div>

    {#if chartData.isEmpty}
      <div class="bg-card border border-border rounded-md py-8 text-center text-[14px] text-muted-foreground">
        No cycle history available for charting. Data appears after the first deadline is processed.
      </div>
    {:else}
      <div style="min-height: 280px; position: relative;" class="bg-card border border-border rounded-md p-4">
        <Bar
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: '#d4c5a0' } }
            },
            scales: {
              x: { ticks: { color: '#8b7d65' }, grid: { color: '#3d3426' } },
              y: {
                ticks: { color: '#8b7d65' },
                grid: { color: '#3d3426' },
                title: { display: true, text: 'SP', color: '#8b7d65' }
              }
            }
          }}
        />
      </div>
    {/if}
  </Tabs.Content>
</Tabs.Root>
