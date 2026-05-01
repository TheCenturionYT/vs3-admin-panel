<script lang="ts">
  import { enhance } from '$app/forms';
  import { Loader2 } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let loading = $state(false);
</script>

<svelte:head>
  <title>Sign In — VS3 Panel</title>
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
  <div class="w-full max-w-[400px]">
    <!-- Card -->
    <div class="bg-card border border-border rounded-md p-6">

      <!-- Brand -->
      <div class="mb-4">
        <div class="flex items-baseline gap-2">
          <span class="text-[22px] font-semibold text-primary tracking-wide">VS3 Panel</span>
          <span class="text-[11px] text-muted-foreground">v2.0.0</span>
        </div>
        <p class="text-[14px] text-muted-foreground mt-1">Staff &amp; Member Access</p>
      </div>

      <div class="border-t border-border mb-4"></div>

      <!-- Session expired notice -->
      {#if data.expired}
        <div
          class="mb-4 px-4 py-2 rounded-md text-[14px]"
          style="background: rgba(212,146,58,0.12); border: 1px solid rgba(212,146,58,0.30); color: #f0c080;"
        >
          Your session has expired. Please sign in again.
        </div>
      {/if}

      <!-- Login form -->
      <form
        method="POST"
        action="?/login"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            await update();
            loading = false;
          };
        }}
      >
        <!-- Username field -->
        <div class="mb-4">
          <label
            for="username"
            class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2"
          >
            Username <span class="text-[#ff9999]">*</span>
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autocomplete="username"
            value={form?.username ?? ''}
            class="w-full px-4 py-2 bg-muted border border-border rounded-md text-[14px] text-foreground
                   placeholder:text-muted-foreground
                   focus:outline-none focus:border-primary transition-colors"
            placeholder="Enter your username"
          />
        </div>

        <!-- Password field -->
        <div class="mb-4">
          <label
            for="password"
            class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2"
          >
            Password <span class="text-[#ff9999]">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-4 py-2 bg-muted border border-border rounded-md text-[14px] text-foreground
                   placeholder:text-muted-foreground
                   focus:outline-none focus:border-primary transition-colors"
            placeholder="Enter your password"
          />
        </div>

        <!-- Error notice -->
        {#if form?.error}
          <div
            class="mb-4 px-4 py-2 rounded-md text-[14px]"
            style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;"
          >
            {form.error}
          </div>
        {/if}

        <!-- Submit button -->
        <button
          type="submit"
          disabled={loading}
          class="w-full px-4 py-2 rounded-md text-[14px] font-normal transition-colors
                 border border-primary text-primary
                 hover:bg-[rgba(196,164,90,0.12)]
                 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-center gap-2"
        >
          {#if loading}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          Sign In
        </button>
      </form>

      <div class="border-t border-border mt-4 pt-4">
        <p class="text-[14px] text-muted-foreground text-center">
          Access issues? Contact your Head Admin.
        </p>
      </div>

    </div>
  </div>
</div>
