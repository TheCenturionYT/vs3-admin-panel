<script lang="ts">
  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import AppTopbar from '$lib/components/AppTopbar.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<AppTopbar username={(data as any).user.username} role={(data as any).user.role} />
<AppSidebar />

<main class="pl-[240px] pt-[48px] min-h-screen bg-background">
  <div class="p-6">
    {@render children()}
  </div>
</main>
