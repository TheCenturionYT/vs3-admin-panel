<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { Loader2 } from '@lucide/svelte';
  import { calcUpkeep, overextensionMul, warMul } from '$lib/upkeep';
  import InstabilityDot from '$lib/components/InstabilityDot.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isHeadAdmin = data.user.role === 'head_admin';

  // Modal state
  let showEditModal = $state(false);
  let showAddMemberModal = $state(false);
  let showEditRoleModal = $state(false);
  let showDeleteModal = $state(false);
  let editRoleTarget = $state<{ id: string; username: string; currentRole: string } | null>(null);

  // Loading flags
  let savingEdit = $state(false);
  let savingMember = $state(false);
  let savingRole = $state(false);
  let removingMember = $state(false);
  let deletingFaction = $state(false);

  // Computed upkeep values (never stored — always derived from live data)
  let nodeCount = $derived(data.nodes.length);
  let warCount = $derived(data.activeWars.length);
  let oeMul = $derived(overextensionMul(nodeCount));
  let wMul = $derived(warMul(warCount, data.faction.type));

  let totalEffectiveUpkeep = $derived(
    data.nodes.reduce((sum, node) => {
      return sum + calcUpkeep(
        node.baseUpkeep,
        nodeCount,
        warCount,
        data.faction.type,
        data.faction.isSystem
      );
    }, 0)
  );

  function openEditRoleModal(member: { id: string; username: string; role: string }) {
    editRoleTarget = { id: member.id, username: member.username, currentRole: member.role };
    showEditRoleModal = true;
  }

  function formatWarMulDisplay(): string {
    if (data.faction.type === 'PvE') return 'N/A (PvE)';
    const pct = wMul * 100;
    return pct === 0 ? '+0%' : `+${pct}%`;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function getOpponentName(war: typeof data.activeWars[0]): string {
    return war.factionAId === data.faction.id ? war.factionBName : war.factionAName;
  }

  function getOpponentWarId(war: typeof data.activeWars[0]): string {
    return war.id;
  }

  // Role badge styles
  function roleBadgeStyle(role: string): string {
    if (role === 'Leader') return 'background: rgba(196,164,90,0.2); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;';
    if (role === 'Officer') return 'background: rgba(196,164,90,0.12); border: 1px solid rgba(196,164,90,0.22); color: #b89a50;';
    return 'background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;';
  }

  // Tier badge styles
  function tierBadgeStyle(tier: string): string {
    if (tier === '4') return 'background: rgba(196,164,90,0.22); border: 1px solid rgba(196,164,90,0.40); color: #d4b46a;';
    if (tier === '3') return 'background: rgba(196,164,90,0.12); border: 1px solid rgba(196,164,90,0.22); color: #c4a45a;';
    if (tier === '2') return 'background: rgba(139,125,101,0.18); border: 1px solid rgba(139,125,101,0.3); color: #a89880;';
    return 'background: rgba(139,125,101,0.12); border: 1px solid #3d3426; color: #8b7d65;';
  }

  $effect(() => {
    if (form?.success) {
      showEditModal = false;
      showAddMemberModal = false;
      showEditRoleModal = false;
      editRoleTarget = null;
      if (form.action === 'deleteFaction') {
        goto('/factions');
      }
    }
  });
</script>

<svelte:head>
  <title>{data.faction.name} — VS3 Panel</title>
</svelte:head>

<!-- Back link -->
<a href="/factions" class="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground mb-4 transition-colors">
  ← Back to Factions
</a>

<!-- Detail header card with faction color stripe -->
<div class="rounded-md border border-border p-4 mb-6"
     style="border-left: 4px solid {data.faction.color || '#8b7d65'};">
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-[22px] font-semibold text-foreground">{data.faction.name}</h1>
      <div class="flex items-center gap-3 mt-1 flex-wrap">
        <!-- Type badge -->
        {#if data.faction.type === 'PvP'}
          <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
            style="background: rgba(200,100,40,0.15); border: 1px solid rgba(200,100,40,0.25); color: #e07840;">
            PvP
          </span>
        {:else}
          <span class="px-2 py-1 rounded-full text-[11px] font-semibold"
            style="background: rgba(61,107,61,0.15); border: 1px solid rgba(61,107,61,0.25); color: #90cc90;">
            PvE
          </span>
        {/if}
        <span class="text-[14px] text-muted-foreground">{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
        <span class="text-[14px] text-muted-foreground">{data.factionMembers.length} {data.factionMembers.length === 1 ? 'member' : 'members'}</span>
        {#if data.faction.description}
          <span class="text-[14px] text-muted-foreground italic">{data.faction.description}</span>
        {/if}
      </div>
    </div>
    <!-- Action buttons (not for system factions) -->
    {#if !data.faction.isSystem}
      <div class="flex items-center gap-2">
        <button type="button"
          onclick={() => { showEditModal = true; }}
          class="px-3 py-1.5 rounded text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
          Edit Faction
        </button>
        {#if isHeadAdmin}
          <button type="button"
            onclick={() => { showDeleteModal = true; }}
            class="px-3 py-1.5 rounded text-[14px] border transition-colors"
            style="border-color: #8b2b2b; color: #ff9999;">
            Delete Faction
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Upkeep Modifiers card -->
<div class="mb-6">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Upkeep Modifiers
  </div>
  <div class="bg-card border border-border rounded-md p-4">
    <div class="flex items-center gap-6 flex-wrap text-[14px]">
      <div>
        <span class="text-muted-foreground">{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} → Overextension:</span>
        <span class="ml-2 font-semibold" style="color: #c4a45a;">×{oeMul.toFixed(2).replace(/\.?0+$/, '')}</span>
      </div>
      <div>
        <span class="text-muted-foreground">{warCount} active {warCount === 1 ? 'war' : 'wars'} → War modifier:</span>
        <span class="ml-2 font-semibold" style="color: #c4a45a;">{formatWarMulDisplay()}</span>
      </div>
      {#if nodeCount > 0}
        <div>
          <span class="text-muted-foreground">Total effective upkeep:</span>
          <span class="ml-2 font-semibold" style="color: #c4a45a;">{totalEffectiveUpkeep} SP/week</span>
        </div>
      {/if}
    </div>
    {#if data.faction.isSystem}
      <p class="text-[14px] text-muted-foreground mt-2 italic">System faction — upkeep scaling does not apply.</p>
    {/if}
  </div>
</div>

<!-- Members card -->
<div class="mb-6">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Members
  </div>
  <div class="bg-card border border-border rounded-md overflow-hidden">
    {#if data.factionMembers.length === 0}
      <div class="py-8 text-center">
        <p class="text-[14px] text-muted-foreground">No members assigned. Add members to this faction.</p>
      </div>
    {:else}
      <table class="w-full">
        <thead>
          <tr style="border-bottom: 1px solid #3d3426;">
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Username</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Role</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.factionMembers as member}
            <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
              <td class="px-4 py-2 text-[14px] text-foreground">{member.username}</td>
              <td class="px-4 py-2">
                <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style={roleBadgeStyle(member.role)}>
                  {member.role}
                </span>
              </td>
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <button type="button"
                    onclick={() => openEditRoleModal({ id: member.id, username: member.username, role: member.role })}
                    class="px-2 py-1 rounded text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                    Edit Role
                  </button>
                  {#if isHeadAdmin}
                    <form method="POST" action="?/removeMember"
                      use:enhance={() => {
                        removingMember = true;
                        return async ({ update }) => { await update(); removingMember = false; };
                      }}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <button type="submit" disabled={removingMember}
                        class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors disabled:opacity-50"
                        style="border-color: #8b2b2b; color: #ff9999;">
                        Remove
                      </button>
                    </form>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <!-- Add member button -->
    <div class="px-4 py-3" style="border-top: 1px solid rgba(196,164,90,0.06);">
      <button type="button"
        onclick={() => { showAddMemberModal = true; }}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded text-[14px] border transition-colors"
        style="border-color: #c4a45a; color: #c4a45a;"
        onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
        onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
        Add Member
      </button>
    </div>
  </div>
</div>

<!-- Faction Nodes card -->
<div class="mb-6">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Faction Nodes
  </div>
  <div class="bg-card border border-border rounded-md overflow-hidden">
    {#if data.nodes.length === 0}
      <div class="py-8 text-center">
        <p class="text-[14px] text-muted-foreground">No nodes owned by this faction.</p>
      </div>
    {:else}
      <table class="w-full">
        <thead>
          <tr style="border-bottom: 1px solid #3d3426;">
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Name</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Type</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Tier</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Instability</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Eff. Upkeep</th>
          </tr>
        </thead>
        <tbody>
          {#each data.nodes as node}
            <tr
              style="border-bottom: 1px solid rgba(196,164,90,0.06); cursor: pointer;"
              onclick={() => goto(`/nodes/${node.id}`)}
              onkeydown={(e) => e.key === 'Enter' && goto(`/nodes/${node.id}`)}
              role="row"
              tabindex="0"
              onmouseover={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(196,164,90,0.03)'}
              onmouseout={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
            >
              <td class="px-4 py-2 text-[14px] font-semibold text-foreground">
                {#if node.nodeNumber}
                  <span class="text-muted-foreground mr-1">#{node.nodeNumber}</span>
                {/if}
                {node.name}
              </td>
              <td class="px-4 py-2 text-[14px] text-muted-foreground">{node.type}</td>
              <td class="px-4 py-2">
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold" style={tierBadgeStyle(node.tier)}>
                  T{node.tier}
                </span>
              </td>
              <td class="px-4 py-2 text-[14px]">
                <InstabilityDot level={node.instability} />
              </td>
              <td class="px-4 py-2 text-[14px] font-semibold" style="color: #c4a45a;">
                {calcUpkeep(node.baseUpkeep, nodeCount, warCount, data.faction.type, data.faction.isSystem)} SP/week
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<!-- Active Wars card -->
<div class="mb-6">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Active Wars
  </div>
  <div class="bg-card border border-border rounded-md p-4">
    {#if data.activeWars.length === 0}
      <p class="text-[14px] text-muted-foreground">Not currently at war.</p>
      {#if data.faction.type === 'PvE'}
        <p class="text-[14px] text-muted-foreground mt-1">PvE faction — war modifier does not apply.</p>
      {/if}
    {:else}
      <div class="space-y-2">
        {#each data.activeWars as war}
          <a href="/wars/{war.id}"
            class="flex items-center gap-4 px-3 py-2 rounded-md border border-border hover:text-foreground transition-colors"
            style="color: #d4c5a0;"
            onmouseover={(e) => (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(196,164,90,0.03)'}
            onmouseout={(e) => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
          >
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style="background: rgba(200,100,40,0.2); border: 1px solid rgba(200,100,40,0.3); color: #e07840;">
              War
            </span>
            <span class="text-[14px] font-semibold text-foreground">vs {getOpponentName(war)}</span>
            {#if war.casusBelli}
              <span class="text-[14px] text-muted-foreground truncate">{war.casusBelli}</span>
            {/if}
            <span class="ml-auto text-[11px] text-muted-foreground">{formatDate(war.startDate)}</span>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- ===== MODALS ===== -->

<!-- Edit Faction Modal -->
{#if showEditModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="edit-faction-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="edit-faction-title" class="text-[15px] font-semibold text-foreground">Edit Faction</h2>
        <button type="button" onclick={() => { showEditModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Update faction details</p>

      <form method="POST" action="?/editFaction"
        use:enhance={() => {
          savingEdit = true;
          return async ({ update }) => { await update({ reset: false }); savingEdit = false; };
        }}>

        <div class="mb-4">
          <label for="edit-name" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Name <span style="color: #ff9999;">*</span>
          </label>
          <input id="edit-name" name="name" type="text" required
            value={form?.action === 'editFaction' ? (form?.values?.name ?? data.faction.name) : data.faction.name}
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Faction name" />
          {#if form?.action === 'editFaction' && form?.errors?.name}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.name[0]}</p>
          {/if}
        </div>

        <div class="mb-4">
          <label for="edit-type" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Type <span style="color: #ff9999;">*</span>
          </label>
          <select id="edit-type" name="type" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="PvP" selected={data.faction.type === 'PvP'}>PvP</option>
            <option value="PvE" selected={data.faction.type === 'PvE'}>PvE</option>
          </select>
        </div>

        <div class="mb-4">
          <label for="edit-color" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Color
          </label>
          <div class="flex items-center gap-3">
            <input id="edit-color" name="color" type="color"
              value={data.faction.color || '#c4a45a'}
              class="h-9 w-16 rounded cursor-pointer"
              style="background: #2c2518; border: 1px solid #3d3426; padding: 2px;" />
            <span class="text-[14px] text-muted-foreground">Faction color dot and header stripe</span>
          </div>
        </div>

        <div class="mb-6">
          <label for="edit-description" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Description
          </label>
          <textarea id="edit-description" name="description" rows="3"
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors resize-none"
            style="background: #2c2518; border: 1px solid #3d3426;"
            placeholder="Optional faction description">{data.faction.description}</textarea>
        </div>

        {#if form?.action === 'editFaction' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showEditModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={savingEdit}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if savingEdit}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Add Member Modal -->
{#if showAddMemberModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="add-member-title">
    <div class="w-full max-w-[480px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="add-member-title" class="text-[15px] font-semibold text-foreground">Add Member</h2>
        <button type="button" onclick={() => { showAddMemberModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Assign a member account to this faction</p>

      <form method="POST" action="?/addMember"
        use:enhance={() => {
          savingMember = true;
          return async ({ update }) => { await update({ reset: false }); savingMember = false; };
        }}>

        <div class="mb-4">
          <label for="member-user" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Member Account <span style="color: #ff9999;">*</span>
          </label>
          <select id="member-user" name="userId" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="">Select member account...</option>
            {#each data.allMembers as member}
              <option value={member.id}>{member.username}</option>
            {/each}
          </select>
          {#if form?.action === 'addMember' && form?.errors?.userId}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.userId[0]}</p>
          {/if}
        </div>

        <div class="mb-6">
          <label for="member-role" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Role <span style="color: #ff9999;">*</span>
          </label>
          <select id="member-role" name="role" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="Member" selected>Member</option>
            <option value="Officer">Officer</option>
            <option value="Leader">Leader</option>
          </select>
          {#if form?.action === 'addMember' && form?.errors?.role}
            <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.role[0]}</p>
          {/if}
        </div>

        {#if form?.action === 'addMember' && form?.errors?._global}
          <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
            {form.errors._global[0]}
          </div>
        {/if}

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showAddMemberModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={savingMember}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if savingMember}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Add Member
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Member Role Modal -->
{#if showEditRoleModal && editRoleTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="edit-role-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="edit-role-title" class="text-[15px] font-semibold text-foreground">Edit Role</h2>
        <button type="button" onclick={() => { showEditRoleModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">Change role for <strong class="text-foreground">{editRoleTarget.username}</strong></p>

      <form method="POST" action="?/editMemberRole"
        use:enhance={() => {
          savingRole = true;
          return async ({ update }) => { await update(); savingRole = false; };
        }}>
        <input type="hidden" name="memberId" value={editRoleTarget.id} />

        <div class="mb-6">
          <label for="new-role" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Role <span style="color: #ff9999;">*</span>
          </label>
          <select id="new-role" name="role" required
            class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none transition-colors"
            style="background: #2c2518; border: 1px solid #3d3426;">
            <option value="Member" selected={editRoleTarget.currentRole === 'Member'}>Member</option>
            <option value="Officer" selected={editRoleTarget.currentRole === 'Officer'}>Officer</option>
            <option value="Leader" selected={editRoleTarget.currentRole === 'Leader'}>Leader</option>
          </select>
        </div>

        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showEditRoleModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={savingRole}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #c4a45a; color: #c4a45a;">
            {#if savingRole}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Faction Dialog -->
{#if showDeleteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="delete-faction-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="delete-faction-title" class="text-[15px] font-semibold text-foreground mb-3">Delete Faction</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Deleting <strong class="text-foreground">{data.faction.name}</strong> will permanently remove this faction
        and all associated member records. Node ownership will be reassigned to Neutral Territory.
        This cannot be undone.
      </p>

      {#if form?.action === 'deleteFaction' && form?.errors?._global}
        <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
          {form.errors._global[0]}
        </div>
      {/if}

      <form method="POST" action="?/deleteFaction"
        use:enhance={() => {
          deletingFaction = true;
          return async ({ update }) => { await update(); deletingFaction = false; };
        }}>
        <input type="hidden" name="id" value={data.faction.id} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showDeleteModal = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={deletingFaction}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #8b2b2b; color: #ff9999;">
            {#if deletingFaction}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Delete Faction
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
