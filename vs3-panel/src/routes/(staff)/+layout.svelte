<script lang="ts">
  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import AppTopbar from '$lib/components/AppTopbar.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<AppTopbar username={(data as any).user.username} role={(data as any).user.role} />
<AppSidebar />

<main class="pl-[240px] pt-[48px] min-h-screen bg-background flex flex-col">
  <div class="p-6 flex-1">
    {@render children()}
  </div>
  <footer class="pl-6 pb-4 pt-2">
    <span class="text-[11px]" style="color: #5a4e3a;">VS3 Admin Panel v1.0.1</span>
  </footer>
</main>
