import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

// Validation schemas
const editFactionSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['PvP', 'PvE'], { message: 'Type is required.' }),
  color: z.string().optional(),
  description: z.string().optional()
});

const addMemberSchema = z.object({
  userId: z.string().min(1, 'Member account is required.'),
  role: z.enum(['Leader', 'Officer', 'Member'], { message: 'Role is required.' })
});

const editMemberRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['Leader', 'Officer', 'Member'], { message: 'Role is required.' })
});

const removeMemberSchema = z.object({
  memberId: z.string().min(1)
});

export const load: PageServerLoad = async ({ locals, params }) => {
  // Fetch faction
  let faction: Record<string, unknown>;
  try {
    faction = await locals.pb.collection('factions').getOne(params.id);
  } catch {
    throw error(404, 'Faction not found.');
  }

  const [factionMembers, nodes, allMembers, activeWars] = await Promise.all([
    // Members of this faction with user info expanded
    locals.pb.collection('faction_members').getFullList({
      filter: `faction = "${params.id}"`,
      expand: 'user',
      sort: 'role,created'
    }),
    // Nodes owned by this faction
    locals.pb.collection('nodes').getFullList({
      filter: `owner = "${params.id}"`,
      sort: 'node_number,name'
    }),
    // All member accounts (for the add-member dropdown)
    locals.pb.collection('members').getFullList({
      sort: 'username',
      fields: 'id,username'
    }),
    // Active wars involving this faction
    locals.pb.collection('wars').getFullList({
      filter: `(faction_a = "${params.id}" || faction_b = "${params.id}") && status = "active"`,
      expand: 'faction_a,faction_b',
      fields: 'id,faction_a,faction_b,casus_belli,start_date,expand'
    })
  ]);

  return {
    faction: {
      id: faction.id as string,
      name: faction.name as string,
      type: faction.type as 'PvP' | 'PvE',
      color: (faction.color as string) || '',
      description: (faction.description as string) || '',
      isSystem: faction.is_system as boolean
    },
    factionMembers: factionMembers.map(m => ({
      id: m.id as string,
      role: m.role as 'Leader' | 'Officer' | 'Member',
      userId: m.user as string,
      username: (m.expand?.user?.username as string) ?? '—'
    })),
    nodes: nodes.map(n => ({
      id: n.id as string,
      name: n.name as string,
      nodeNumber: n.node_number as number,
      type: n.type as string,
      tier: n.tier as string,
      instability: (n.instability as number) ?? 0,
      baseUpkeep: (n.base_upkeep as number) ?? 0
    })),
    allMembers: allMembers.map(m => ({
      id: m.id as string,
      username: m.username as string
    })),
    activeWars: activeWars.map(w => ({
      id: w.id as string,
      factionAId: w.faction_a as string,
      factionBId: w.faction_b as string,
      factionAName: (w.expand?.faction_a?.name as string) ?? '—',
      factionBName: (w.expand?.faction_b?.name as string) ?? '—',
      casusBelli: (w.casus_belli as string) ?? '',
      startDate: (w.start_date as string) ?? ''
    }))
  };
};

export const actions: Actions = {
  editFaction: async ({ request, locals, params }) => {
    const data = await request.formData();
    const parsed = editFactionSchema.safeParse({
      name: data.get('name'),
      type: data.get('type'),
      color: data.get('color') || undefined,
      description: data.get('description') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'editFaction',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('factions').update(params.id, {
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? '',
        description: parsed.data.description ?? ''
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('name')) {
        return fail(400, {
          action: 'editFaction',
          errors: { name: ['A faction with this name already exists.'] },
          values: Object.fromEntries(data)
        });
      }
      return fail(500, {
        action: 'editFaction',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'editFaction' };
  },

  addMember: async ({ request, locals, params }) => {
    const data = await request.formData();
    const parsed = addMemberSchema.safeParse({
      userId: data.get('userId'),
      role: data.get('role')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'addMember',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('faction_members').create({
        faction: params.id,
        user: parsed.data.userId,
        role: parsed.data.role
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('user')) {
        return fail(400, {
          action: 'addMember',
          errors: { userId: ['This member is already in a faction.'] },
          values: Object.fromEntries(data)
        });
      }
      return fail(500, {
        action: 'addMember',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'addMember' };
  },

  editMemberRole: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = editMemberRoleSchema.safeParse({
      memberId: data.get('memberId'),
      role: data.get('role')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'editMemberRole',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('faction_members').update(parsed.data.memberId, {
        role: parsed.data.role
      });
    } catch {
      return fail(500, {
        action: 'editMemberRole',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    return { success: true, action: 'editMemberRole' };
  },

  removeMember: async ({ request, locals }) => {
    // Gate: head_admin only
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, {
        action: 'removeMember',
        errors: { _global: ['Head Admin access required.'] }
      });
    }

    const data = await request.formData();
    const parsed = removeMemberSchema.safeParse({ memberId: data.get('memberId') });

    if (!parsed.success) {
      return fail(400, {
        action: 'removeMember',
        errors: { _global: ['Invalid request.'] }
      });
    }

    try {
      await locals.pb.collection('faction_members').delete(parsed.data.memberId);
    } catch {
      return fail(500, {
        action: 'removeMember',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    return { success: true, action: 'removeMember' };
  },

  deleteFaction: async ({ request, locals }) => {
    // Gate: head_admin only
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, {
        action: 'deleteFaction',
        errors: { _global: ['Head Admin access required.'] }
      });
    }

    const data = await request.formData();
    const id = data.get('id') as string;

    if (!id) {
      return fail(400, {
        action: 'deleteFaction',
        errors: { _global: ['Invalid request.'] }
      });
    }

    // Prevent deleting system factions
    try {
      const faction = await locals.pb.collection('factions').getOne(id, { fields: 'id,is_system' });
      if (faction.is_system) {
        return fail(403, {
          action: 'deleteFaction',
          errors: { _global: ['System factions cannot be deleted.'] }
        });
      }
    } catch {
      return fail(404, {
        action: 'deleteFaction',
        errors: { _global: ['Faction not found.'] }
      });
    }

    try {
      await locals.pb.collection('factions').delete(id);
    } catch {
      return fail(500, {
        action: 'deleteFaction',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    // Redirect to list after deletion (handled by enhance result on client)
    return { success: true, action: 'deleteFaction' };
  }
};
