<script lang="ts">
  import { page } from '$app/stores';
  import {
    LayoutDashboard,
    Users,
    Settings,
    Shield,
    MapPin,
    Swords,
    Handshake,
    ScrollText,
    BookOpen,
    BarChart3
  } from '@lucide/svelte';

  const activeNavItems = [
    { label: 'Dashboard',        href: '/dashboard',        Icon: LayoutDashboard },
    { label: 'Staff Management', href: '/staff-management', Icon: Users },
    { label: 'Server Settings',  href: '/server-settings',  Icon: Settings },
  ];

  const phase2Items = [
    { label: 'Factions',     href: '/factions',      Icon: Shield },
    { label: 'Nodes',        href: '/nodes',          Icon: MapPin },
    { label: 'Wars',         href: '/wars',           Icon: Swords },
    { label: 'Diplomacy',    href: '/diplomacy',      Icon: Handshake },
    { label: 'Server Log',   href: '/server-log',     Icon: ScrollText },
    { label: 'SP Catalogue', href: '/sp-catalogue',   Icon: BookOpen },
    { label: 'Metrics',      href: '/metrics',        Icon: BarChart3 },
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

  <div class="pb-2">
    {#each phase2Items as item}
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

</nav>
