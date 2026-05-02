<script lang="ts">
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { Loader2, Plus } from '@lucide/svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Modal state
  let showAddEditModal = $state(false);
  let modalMode = $state<'add' | 'edit'>('add');
  let modalAccountType = $state<'staff' | 'member'>('staff');
  let editTarget = $state<{ id: string; collection: 'staff' | 'members'; username: string; role?: string; factionId?: string } | null>(null);

  // Deactivate/reactivate dialog state
  let showToggleDialog = $state(false);
  let toggleTarget = $state<{ id: string; collection: 'staff' | 'members'; username: string; currentlyActive: boolean } | null>(null);

  // Loading states
  let savingAccount = $state(false);
  let togglingAccount = $state(false);

  let showDeleteDialog = $state(false);
  let deleteTarget = $state<{ id: string; collection: 'staff' | 'members'; username: string } | null>(null);
  let deletingAccount = $state(false);

  function openDeleteDialog(account: { id: string; collection: 'staff' | 'members'; username: string }) {
    deleteTarget = account;
    showDeleteDialog = true;
  }

  const isHeadAdmin = data.user.role === 'head_admin';

  function openAddModal(type: 'staff' | 'member') {
    modalMode = 'add';
    modalAccountType = type;
    editTarget = null;
    showAddEditModal = true;
  }

  function openEditModal(account: { id: string; collection: 'staff' | 'members'; username: string; role?: string; factionId?: string }) {
    modalMode = 'edit';
    modalAccountType = account.collection === 'staff' ? 'staff' : 'member';
    editTarget = account;
    showAddEditModal = true;
  }

  function openToggleDialog(account: { id: string; collection: 'staff' | 'members'; username: string; isActive: boolean }) {
    toggleTarget = { id: account.id, collection: account.collection, username: account.username, currentlyActive: account.isActive };
    showToggleDialog = true;
  }

  function formatLastLogin(lastLogin: string | null): string {
    if (!lastLogin) return 'Never';
    try {
      return format(new Date(lastLogin), 'dd MMM yyyy HH:mm');
    } catch {
      return 'Never';
    }
  }

  $effect(() => {
    if (form?.success) {
      showAddEditModal = false;
      showToggleDialog = false;
      showDeleteDialog = false;
    }
  });
</script>

<svelte:head>
  <title>Staff Management — VS3 Panel</title>
</svelte:head>

<!-- Page header -->
<div class="flex items-start justify-between mb-6">
  <div>
    <h1 class="text-[22px] font-semibold text-foreground">Staff Management</h1>
    <p class="text-[14px] text-muted-foreground mt-1">Manage staff and faction member accounts</p>
  </div>
  {#if isHeadAdmin}
    <button
      type="button"
      onclick={() => openAddModal('staff')}
      class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors"
      style="border-color: #c4a45a; color: #c4a45a;"
      onmouseover={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,90,0.12)'}
      onmouseout={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      <Plus class="w-4 h-4" />
      Add Account
    </button>
  {/if}
</div>

{#if !isHeadAdmin}
  <div
    class="mb-6 px-4 py-2 rounded-md text-[14px] flex items-center gap-2"
    style="background: rgba(85,136,170,0.12); border: 1px solid rgba(85,136,170,0.30); color: #88bbdd;"
  >
    You have read-only access to this page. Contact a Head Admin to make changes.
  </div>
{/if}

<!-- Staff Accounts section -->
<div class="mb-8">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Staff Accounts
  </div>
  <div class="bg-card border border-border rounded-md overflow-hidden">
    {#if data.staffAccounts.length === 0}
      <div class="py-12 text-center">
        <p class="text-[15px] font-semibold text-foreground mb-2">No accounts yet</p>
        <p class="text-[14px] text-muted-foreground">Use 'Add Account' above to create the first account.</p>
      </div>
    {:else}
      <table class="w-full">
        <thead>
          <tr style="border-bottom: 1px solid #3d3426;">
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Username</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Role</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Status</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Last Login</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.staffAccounts as account}
            <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
              <td class="px-4 py-2 text-[14px] text-foreground">{account.username}</td>
              <td class="px-4 py-2">
                {#if account.role === 'head_admin'}
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(196,164,90,0.2); border: 1px solid rgba(196,164,90,0.3); color: #c4a45a;">Head Admin</span>
                {:else}
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(139,125,101,0.15); border: 1px solid #3d3426; color: #8b7d65;">Staff</span>
                {/if}
              </td>
              <td class="px-4 py-2">
                {#if account.isActive}
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">Active</span>
                {:else}
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff9999;">Inactive</span>
                {/if}
              </td>
              <td class="px-4 py-2 text-[14px] text-muted-foreground">{formatLastLogin(account.lastLogin)}</td>
              <td class="px-4 py-2">
                {#if isHeadAdmin}
                  <div class="flex items-center gap-2">
                    <button type="button"
                      onclick={() => openEditModal({ id: account.id, collection: 'staff', username: account.username, role: account.role })}
                      class="px-2 py-1 rounded text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                      Edit
                    </button>
                    <button type="button"
                      onclick={() => openToggleDialog({ id: account.id, collection: 'staff', username: account.username, isActive: account.isActive })}
                      class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                      style={account.isActive ? 'border-color: #8b2b2b; color: #ff9999;' : 'border-color: #3d3426; color: #8b7d65;'}>
                      {account.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button type="button"
                      onclick={() => openDeleteDialog({ id: account.id, collection: 'staff', username: account.username })}
                      class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                      style="border-color: #6b1a1a; color: #cc6666;">
                      Delete
                    </button>
                  </div>
                {:else}
                  <span class="text-[14px] text-muted-foreground">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<!-- Faction Member Accounts section -->
<div class="mb-8">
  <div class="text-[11px] font-semibold uppercase text-primary mb-3" style="letter-spacing: 0.07em;">
    Faction Member Accounts
  </div>
  <div class="bg-card border border-border rounded-md overflow-hidden">
    {#if data.memberAccounts.length === 0}
      <div class="py-12 text-center">
        <p class="text-[15px] font-semibold text-foreground mb-2">No member accounts yet</p>
        <p class="text-[14px] text-muted-foreground">No faction member accounts have been created yet.</p>
      </div>
    {:else}
      <table class="w-full">
        <thead>
          <tr style="border-bottom: 1px solid #3d3426;">
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Username</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Faction</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Status</th>
            <th class="text-left px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground" style="letter-spacing: 0.06em;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.memberAccounts as account}
            <tr style="border-bottom: 1px solid rgba(196,164,90,0.06);">
              <td class="px-4 py-2 text-[14px] text-foreground">{account.username}</td>
              <td class="px-4 py-2 text-[14px] text-foreground">{account.factionName}</td>
              <td class="px-4 py-2">
                {#if account.isActive}
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(61,107,61,0.2); border: 1px solid rgba(61,107,61,0.3); color: #90cc90;">Active</span>
                {:else}
                  <span class="px-2 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(139,43,43,0.2); border: 1px solid rgba(139,43,43,0.3); color: #ff9999;">Inactive</span>
                {/if}
              </td>
              <td class="px-4 py-2">
                {#if isHeadAdmin}
                  <div class="flex items-center gap-2">
                    <button type="button"
                      onclick={() => openEditModal({ id: account.id, collection: 'members', username: account.username, factionId: account.factionId })}
                      class="px-2 py-1 rounded text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                      Edit
                    </button>
                    <button type="button"
                      onclick={() => openToggleDialog({ id: account.id, collection: 'members', username: account.username, isActive: account.isActive })}
                      class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                      style={account.isActive ? 'border-color: #8b2b2b; color: #ff9999;' : 'border-color: #3d3426; color: #8b7d65;'}>
                      {account.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button type="button"
                      onclick={() => openDeleteDialog({ id: account.id, collection: 'members', username: account.username })}
                      class="px-2 py-1 rounded text-[11px] font-semibold border transition-colors"
                      style="border-color: #6b1a1a; color: #cc6666;">
                      Delete
                    </button>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<!-- Add/Edit Account Modal -->
{#if showAddEditModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="w-full max-w-[680px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <div class="flex items-center justify-between mb-1">
        <h2 id="modal-title" class="text-[15px] font-semibold text-foreground">
          {modalMode === 'add' ? 'Add Account' : 'Edit Account'}
        </h2>
        <button type="button" onclick={() => { showAddEditModal = false; }}
          class="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">&#x2715;</button>
      </div>
      <p class="text-[11px] text-muted-foreground mb-4">
        {modalMode === 'add' ? 'Create a new staff or faction member account' : 'Update account details'}
      </p>

      {#if modalMode === 'add'}
        <div class="flex gap-2 mb-4">
          <button type="button" onclick={() => { modalAccountType = 'staff'; }}
            class="px-3 py-1 rounded text-[14px] border transition-colors"
            style={modalAccountType === 'staff' ? 'border-color: #c4a45a; color: #c4a45a; background: rgba(196,164,90,0.12);' : 'border-color: #3d3426; color: #8b7d65;'}>
            Staff Account
          </button>
          <button type="button" onclick={() => { modalAccountType = 'member'; }}
            class="px-3 py-1 rounded text-[14px] border transition-colors"
            style={modalAccountType === 'member' ? 'border-color: #c4a45a; color: #c4a45a; background: rgba(196,164,90,0.12);' : 'border-color: #3d3426; color: #8b7d65;'}>
            Member Account
          </button>
        </div>
      {/if}

      {#if modalAccountType === 'staff'}
        <form method="POST" action={modalMode === 'add' ? '?/createStaff' : '?/updateStaff'}
          use:enhance={() => { savingAccount = true; return async ({ update }) => { await update({ reset: false }); savingAccount = false; }; }}>
          {#if modalMode === 'edit' && editTarget}
            <input type="hidden" name="id" value={editTarget.id} />
          {/if}
          <div class="mb-4">
            <label for="staff-username" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Username {#if modalMode === 'add'}<span style="color: #ff9999;">*</span>{/if}
            </label>
            <input id="staff-username" name="username" type="text" required={modalMode === 'add'} disabled={modalMode === 'edit'}
              value={editTarget?.username ?? ''}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" placeholder="Enter username" />
            {#if form?.action === 'createStaff' && form?.errors?.username}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.username[0]}</p>
            {/if}
          </div>
          <div class="mb-4">
            <label for="staff-password" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Password {#if modalMode === 'add'}<span style="color: #ff9999;">*</span>{/if}
            </label>
            <input id="staff-password" name="password" type="password" required={modalMode === 'add'}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder={modalMode === 'edit' ? 'Leave blank to keep current password' : 'Enter password (min 8 chars)'} />
            {#if form?.action === 'createStaff' && form?.errors?.password}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.password[0]}</p>
            {/if}
          </div>
          <div class="mb-6">
            <label for="staff-role" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Role <span style="color: #ff9999;">*</span>
            </label>
            <select id="staff-role" name="role" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="staff" selected={!editTarget || editTarget.role === 'staff'}>Staff</option>
              <option value="head_admin" selected={editTarget?.role === 'head_admin'}>Head Admin</option>
            </select>
          </div>
          {#if form?.action === 'createStaff' && form?.errors?._global}
            <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
              {form.errors._global[0]}
            </div>
          {/if}
          <div class="flex gap-2 justify-end">
            <button type="button" onclick={() => { showAddEditModal = false; }}
              class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={savingAccount}
              class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
              style="border-color: #c4a45a; color: #c4a45a;">
              {#if savingAccount}<Loader2 class="w-4 h-4 animate-spin" />{/if}
              Save Account
            </button>
          </div>
        </form>
      {:else}
        <form method="POST" action={modalMode === 'add' ? '?/createMember' : '?/updateMember'}
          use:enhance={() => { savingAccount = true; return async ({ update }) => { await update({ reset: false }); savingAccount = false; }; }}>
          {#if modalMode === 'edit' && editTarget}
            <input type="hidden" name="id" value={editTarget.id} />
          {/if}
          <div class="mb-4">
            <label for="member-username" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Username {#if modalMode === 'add'}<span style="color: #ff9999;">*</span>{/if}
            </label>
            <input id="member-username" name="username" type="text" required={modalMode === 'add'} disabled={modalMode === 'edit'}
              value={editTarget?.username ?? ''}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;" placeholder="Enter username" />
            {#if form?.action === 'createMember' && form?.errors?.username}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.username[0]}</p>
            {/if}
          </div>
          <div class="mb-4">
            <label for="member-password" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Password {#if modalMode === 'add'}<span style="color: #ff9999;">*</span>{/if}
            </label>
            <input id="member-password" name="password" type="password" required={modalMode === 'add'}
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;"
              placeholder={modalMode === 'edit' ? 'Leave blank to keep current password' : 'Enter password (min 8 chars)'} />
            {#if form?.action === 'createMember' && form?.errors?.password}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.password[0]}</p>
            {/if}
          </div>
          <div class="mb-6">
            <label for="member-faction" class="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
              Faction <span style="color: #ff9999;">*</span>
            </label>
            <select id="member-faction" name="factionId" required
              class="w-full px-4 py-2 rounded-md text-[14px] text-foreground focus:outline-none focus:border-primary transition-colors"
              style="background: #2c2518; border: 1px solid #3d3426;">
              <option value="">Select a faction...</option>
              {#each data.factions as faction}
                <option value={faction.id} selected={editTarget?.factionId === faction.id}>{faction.name}</option>
              {/each}
            </select>
            {#if form?.action === 'createMember' && form?.errors?.factionId}
              <p class="text-[11px] mt-1" style="color: #ff9999;">{form.errors.factionId[0]}</p>
            {/if}
          </div>
          {#if form?.action === 'createMember' && form?.errors?._global}
            <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
              {form.errors._global[0]}
            </div>
          {/if}
          <div class="flex gap-2 justify-end">
            <button type="button" onclick={() => { showAddEditModal = false; }}
              class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={savingAccount}
              class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
              style="border-color: #c4a45a; color: #c4a45a;">
              {#if savingAccount}<Loader2 class="w-4 h-4 animate-spin" />{/if}
              Save Account
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}

<!-- Deactivate/Reactivate Dialog -->
{#if showToggleDialog && toggleTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="toggle-dialog-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="toggle-dialog-title" class="text-[15px] font-semibold text-foreground mb-3">
        {toggleTarget.currentlyActive ? 'Deactivate Account' : 'Reactivate Account'}
      </h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        {#if toggleTarget.currentlyActive}
          Deactivating <strong class="text-foreground">{toggleTarget.username}</strong> will prevent them from signing in. Their data and history are preserved. You can reactivate this account at any time.
        {:else}
          Reactivating <strong class="text-foreground">{toggleTarget.username}</strong> will allow them to sign in again.
        {/if}
      </p>
      <form method="POST" action={toggleTarget.currentlyActive ? '?/deactivateAccount' : '?/reactivateAccount'}
        use:enhance={() => { togglingAccount = true; return async ({ update }) => { await update(); togglingAccount = false; }; }}>
        <input type="hidden" name="id" value={toggleTarget.id} />
        <input type="hidden" name="collection" value={toggleTarget.collection} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showToggleDialog = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={togglingAccount}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style={toggleTarget.currentlyActive ? 'border-color: #8b2b2b; color: #ff9999;' : 'border-color: #c4a45a; color: #c4a45a;'}>
            {#if togglingAccount}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            {toggleTarget.currentlyActive ? 'Deactivate Account' : 'Reactivate Account'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Account Dialog -->
{#if showDeleteDialog && deleteTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.78);"
    role="dialog" aria-modal="true" aria-labelledby="delete-acct-title">
    <div class="w-full max-w-[400px] rounded-lg p-6" style="background: #231d14; border: 1px solid rgba(196,164,90,0.28);">
      <h2 id="delete-acct-title" class="text-[15px] font-semibold text-foreground mb-3">Delete Account</h2>
      <p class="text-[14px] text-muted-foreground mb-6">
        Permanently delete <strong class="text-foreground">{deleteTarget.username}</strong>? This removes the account and all associated data. This cannot be undone.
      </p>
      {#if form?.action === 'deleteAccount' && form?.error}
        <div class="mb-4 px-4 py-2 rounded-md text-[14px]" style="background: rgba(139,43,43,0.12); border: 1px solid rgba(200,68,68,0.30); color: #ff9999;">
          {form.error}
        </div>
      {/if}
      <form method="POST" action="?/deleteAccount"
        use:enhance={() => { deletingAccount = true; return async ({ update }) => { await update(); deletingAccount = false; }; }}>
        <input type="hidden" name="id" value={deleteTarget.id} />
        <input type="hidden" name="collection" value={deleteTarget.collection} />
        <div class="flex gap-2 justify-end">
          <button type="button" onclick={() => { showDeleteDialog = false; }}
            class="px-4 py-2 rounded-md text-[14px] border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button type="submit" disabled={deletingAccount}
            class="flex items-center gap-2 px-4 py-2 rounded-md text-[14px] border transition-colors disabled:opacity-50"
            style="border-color: #6b1a1a; color: #cc6666; background: rgba(107,26,26,0.12);">
            {#if deletingAccount}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            Delete Permanently
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
