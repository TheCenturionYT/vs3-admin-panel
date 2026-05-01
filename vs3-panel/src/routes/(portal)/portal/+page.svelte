<script lang="ts">
  import { enhance } from '$app/forms';
  import { Clock } from '@lucide/svelte';
</script>

<svelte:head>
  <title>Faction Portal — VS3 Panel</title>
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
  <div class="w-full max-w-[480px]">
    <div class="bg-card border border-border rounded-md p-6 text-center">

      <div class="mb-4">
        <div class="text-[22px] font-semibold text-primary tracking-wide">VS3 Panel</div>
        <div class="text-[14px] text-muted-foreground mt-1">Faction Portal</div>
      </div>

      <div class="border-t border-border mb-6"></div>

      <div class="flex flex-col items-center gap-3">
        <Clock class="w-8 h-8 text-muted-foreground" />
        <h2 class="text-[15px] font-semibold text-foreground">Portal access coming soon</h2>
        <p class="text-[14px] text-muted-foreground max-w-[360px]">
          Your faction's upkeep status, node health, and alliance information will be available
          here in a future update.
        </p>
      </div>

      <div class="mt-6">
        <form method="POST" action="/login?/logout" use:enhance>
          <button
            type="submit"
            class="px-4 py-2 rounded-md text-[14px] text-muted-foreground border border-border
                   hover:text-foreground hover:bg-card transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>

    </div>
  </div>
</div>
