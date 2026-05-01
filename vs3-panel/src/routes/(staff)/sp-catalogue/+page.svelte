<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const ALL_CATEGORIES = [
    'Raw Renewable',
    'Fuel',
    'Agriculture & Food',
    'Construction',
    'Masonry',
    'Textiles & Leather',
    'Early Metals',
    'Mid Metals',
    'Late Metals',
    'Tools & Hardware',
    'Military Supplies',
    'Utility Goods',
    'Currency'
  ];

  // Filter state
  let search = $state('');
  let debouncedSearch = $state('');
  let categoryFilter = $state('all');
  let demandFilter = $state('all');

  // Debounce text search 300ms
  $effect(() => {
    const t = setTimeout(() => { debouncedSearch = search; }, 300);
    return () => clearTimeout(t);
  });

  // Unique demand levels from data
  let demandLevels = $derived(
    [...new Set(data.items.map((i) => i.demand_level).filter(Boolean))].sort()
  );

  // Filtered items
  let filteredItems = $derived(
    data.items.filter((item) => {
      const matchesSearch =
        !debouncedSearch || item.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesDemand = demandFilter === 'all' || item.demand_level === demandFilter;
      return matchesSearch && matchesCategory && matchesDemand;
    })
  );

  // Whether we're filtering by a specific category (for grouping decision)
  let isFilteringByCategory = $derived(categoryFilter !== 'all');

  // Group filtered items by category (in canonical order)
  let groupedItems = $derived(() => {
    if (isFilteringByCategory) {
      // Single group — no headers needed
      return [{ category: categoryFilter, items: filteredItems }];
    }
    // Group by category in canonical order
    const groups: { category: string; items: typeof filteredItems }[] = [];
    for (const cat of ALL_CATEGORIES) {
      const catItems = filteredItems.filter((i) => i.category === cat);
      if (catItems.length > 0) {
        groups.push({ category: cat, items: catItems });
      }
    }
    // Any items in categories not in the canonical list
    const knownCategories = new Set(ALL_CATEGORIES);
    const otherItems = filteredItems.filter((i) => !knownCategories.has(i.category));
    if (otherItems.length > 0) {
      groups.push({ category: 'Other', items: otherItems });
    }
    return groups;
  });
</script>

<svelte:head>
  <title>SP Catalogue — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">
      SP Catalogue
      <span
        class="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold align-middle"
        style="background: rgba(196,164,90,0.15); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;"
      >
        {data.items.length} items
      </span>
    </h1>
    <p class="text-[14px] text-muted-foreground mt-1">
      Item reference for SP value, category, and demand level
    </p>
  </div>
</div>

<!-- Filter bar -->
<div class="flex items-center gap-3 mb-4 bg-card border border-border rounded-md px-4 py-3">
  <input
    type="text"
    placeholder="Search items..."
    bind:value={search}
    class="flex-1 bg-transparent text-[14px] text-foreground focus:outline-none placeholder:text-muted-foreground"
  />

  <!-- Category filter -->
  <select
    bind:value={categoryFilter}
    class="w-[200px] px-3 py-1.5 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426;"
  >
    <option value="all">All Categories</option>
    {#each ALL_CATEGORIES as cat}
      <option value={cat}>{cat}</option>
    {/each}
  </select>

  <!-- Demand level filter -->
  <select
    bind:value={demandFilter}
    class="w-[160px] px-3 py-1.5 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
    style="background: #2c2518; border: 1px solid #3d3426;"
  >
    <option value="all">All Demand Levels</option>
    {#each demandLevels as level}
      <option value={level}>{level}</option>
    {/each}
  </select>
</div>

<!-- Result count -->
<p class="text-[11px] text-muted-foreground mb-3" style="letter-spacing: 0.04em;">
  Showing {filteredItems.length} of {data.items.length} items
</p>

<!-- Table (grouped by category) -->
{#if filteredItems.length === 0}
  <div class="bg-card border border-border rounded-md py-12 text-center">
    <p class="text-[15px] font-semibold text-foreground mb-2">No items match your search</p>
    <p class="text-[14px] text-muted-foreground">Try different search terms or clear your filters.</p>
  </div>
{:else}
  <div class="bg-card border border-border rounded-md overflow-hidden">
    <table class="w-full">
      <thead>
        <tr style="border-bottom: 1px solid #3d3426;">
          <th
            class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground"
            style="letter-spacing: 0.06em;"
          >Item Name</th>
          <th
            class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground"
            style="letter-spacing: 0.06em;"
          >Category</th>
          <th
            class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground"
            style="letter-spacing: 0.06em;"
          >SP Value</th>
          <th
            class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground"
            style="letter-spacing: 0.06em;"
          >Demand Level</th>
        </tr>
      </thead>
      <tbody>
        {#each groupedItems() as group}
          {#if !isFilteringByCategory}
            <!-- Category header row -->
            <tr style="background: rgba(196,164,90,0.04); border-bottom: 1px solid rgba(196,164,90,0.12);">
              <td
                colspan="4"
                class="px-4 py-1.5 text-[11px] font-semibold uppercase"
                style="color: #c4a45a; letter-spacing: 0.07em;"
              >
                {group.category}
              </td>
            </tr>
          {/if}
          {#each group.items as item}
            <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
              <td class="px-4 py-2 text-[14px] text-foreground">{item.name}</td>
              <td class="px-4 py-2 text-[14px] text-muted-foreground">{item.category}</td>
              <td class="px-4 py-2 text-[14px] font-semibold" style="color: #c4a45a;"
                >{item.sp_value} SP</td
              >
              <td class="px-4 py-2 text-[14px] text-muted-foreground"
                >{item.demand_level || '—'}</td
              >
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
