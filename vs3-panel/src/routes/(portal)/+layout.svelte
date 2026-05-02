<script lang="ts">
  import { enhance } from '$app/forms';
  import { Loader2 } from '@lucide/svelte';
  import { Separator } from '$lib/components/ui/separator';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  let loggingOut = $state(false);
</script>

<header
  class="fixed top-0 left-0 right-0 h-[48px] flex items-center justify-between px-4 z-10"
  style="background: #231d14; border-bottom: 1px solid #3d3426;"
>
  <div class="flex items-center">
    <span class="text-[15px] font-semibold" style="color: #c4a45a;">VS3 Panel</span>
    <Separator orientation="vertical" class="h-4 mx-3" />
    <span class="text-[15px] text-foreground">{data.user.factionName}</span>
  </div>

  <div class="flex items-center gap-3">
    <span class="text-[14px] text-foreground">{data.user.username}</span>

    <form
      method="POST"
      action="/login?/logout"
      use:enhance={() => {
        loggingOut = true;
        return async ({ update }) => {
          await update();
          loggingOut = false;
        };
      }}
    >
      <button
        type="submit"
        disabled={loggingOut}
        class="flex items-center gap-1 px-3 py-1 rounded-md text-[14px] text-muted-foreground
               hover:text-foreground transition-colors disabled:opacity-50"
      >
        {#if loggingOut}
          <Loader2 class="w-3 h-3 animate-spin" />
        {/if}
        Sign Out
      </button>
    </form>
  </div>
</header>

<main class="pt-[48px] min-h-screen bg-background">
  <div class="max-w-[1100px] mx-auto p-6">
    {@render children()}
  </div>
</main>
