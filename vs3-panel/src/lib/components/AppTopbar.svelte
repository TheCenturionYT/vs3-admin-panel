<script lang="ts">
  import { enhance } from '$app/forms';
  import { Loader2 } from '@lucide/svelte';

  let {
    username,
    role
  }: {
    username: string;
    role: 'head_admin' | 'staff';
  } = $props();

  let loggingOut = $state(false);
</script>

<header
  class="fixed top-0 left-0 right-0 h-[48px] flex items-center justify-between px-4 z-10"
  style="background: #231d14; border-bottom: 1px solid #3d3426;"
>
  <span class="text-[15px] font-semibold text-primary tracking-[0.05em]">VS3 Panel</span>

  <div class="flex items-center gap-3">
    <span class="text-[14px] text-foreground">{username}</span>

    {#if role === 'head_admin'}
      <span
        class="px-2 py-1 rounded-full text-[11px] font-semibold"
        style="background: rgba(196,164,90,0.2); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;"
      >
        Head Admin
      </span>
    {:else}
      <span
        class="px-2 py-1 rounded-full text-[11px] font-semibold"
        style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;"
      >
        Staff
      </span>
    {/if}

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
