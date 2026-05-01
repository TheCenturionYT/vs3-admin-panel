<script lang="ts">
  import { page } from '$app/stores';
  import {
    LayoutDashboard,
    Users,
    ScrollText,
    Shield,
    MapPin,
    Swords,
    Handshake,
    BookOpen,
    CalendarClock,
    BarChart3
  } from '@lucide/svelte';

  const activeNavItems = [
    { label: 'Dashboard',        href: '/dashboard',         Icon: LayoutDashboard },
    { label: 'Staff Management', href: '/staff-management',  Icon: Users },
    { label: 'Server Log',       href: '/server-log',        Icon: ScrollText },
  ];

  const phase2Items = [
    { label: 'Factions',     Icon: Shield },
    { label: 'Nodes',        Icon: MapPin },
    { label: 'Wars',         Icon: Swords },
    { label: 'Diplomacy',    Icon: Handshake },
    { label: 'SP Catalogue', Icon: BookOpen },
  ];

  const phase3Items = [
    { label: 'Upkeep',  Icon: CalendarClock },
    { label: 'Metrics', Icon: BarChart3 },
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
</script>

<nav
  class="fixed left-0 top-[48px] bottom-0 w-[240px] overflow-y-auto"
  style="background: #231d14; border-right: 1px solid #3d3426;"
  aria-label="Main navigation"
>
  <div class="py-2">
    {#each activeNavItems as item}
      <a
        href={item.href}
        class="flex items-center gap-3 px-4 min-h-[44px] text-[14px] transition-colors relative
               {isActive(item.href)
                 ? 'text-primary'
                 : 'text-muted-foreground hover:text-foreground'}"
        style={isActive(item.href)
          ? 'border-left: 2px solid #c4a45a; background: rgba(196,164,90,0.08); padding-left: 14px;'
          : 'border-left: 2px solid transparent;'}
      >
        <item.Icon class="w-4 h-4 shrink-0" strokeWidth={1.5} />
        <span>{item.label}</span>
      </a>
    {/each}
  </div>

  <div class="mx-4 my-2" style="border-top: 1px solid #3d3426;"></div>

  <div class="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">
    Phase 2
  </div>

  <div class="pb-2">
    {#each phase2Items as item}
      <div
        class="flex items-center gap-3 px-4 min-h-[44px] text-[14px] text-muted-foreground cursor-not-allowed select-none"
        title="Coming in Phase 2"
        aria-disabled="true"
      >
        <item.Icon class="w-4 h-4 shrink-0 opacity-50" strokeWidth={1.5} />
        <span class="opacity-60">{item.label}</span>
        <span class="ml-auto text-[10px] font-semibold uppercase tracking-wide opacity-40">Soon</span>
      </div>
    {/each}
  </div>

  <div class="mx-4 my-2" style="border-top: 1px solid #3d3426;"></div>

  <div class="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">
    Phase 3
  </div>

  <div class="pb-2">
    {#each phase3Items as item}
      <div
        class="flex items-center gap-3 px-4 min-h-[44px] text-[14px] text-muted-foreground cursor-not-allowed select-none"
        title="Coming in Phase 3"
        aria-disabled="true"
      >
        <item.Icon class="w-4 h-4 shrink-0 opacity-50" strokeWidth={1.5} />
        <span class="opacity-60">{item.label}</span>
        <span class="ml-auto text-[10px] font-semibold uppercase tracking-wide opacity-40">Soon</span>
      </div>
    {/each}
  </div>
</nav>
