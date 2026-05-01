import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

// Validation schemas
const createFactionSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['PvP', 'PvE'], { message: 'Type is required.' }),
  color: z.string().optional(),
  description: z.string().optional()
});

export const load: PageServerLoad = async ({ locals }) => {
  const [factions, members, nodes, activeWars] = await Promise.all([
    locals.pb.collection('factions').getFullList({ sort: 'name' }),
    locals.pb.collection('members').getFullList({ fields: 'id,faction' }),
    locals.pb.collection('nodes').getFullList({ fields: 'id,owner' }),
    locals.pb.collection('wars').getFullList({
      filter: 'status = "active"',
      fields: 'id,faction_a,faction_b'
    })
  ]);

  // Build per-faction member and node counts
  const memberCountMap: Record<string, number> = {};
  for (const m of members) {
    const fid = m.faction as string;
    if (fid) memberCountMap[fid] = (memberCountMap[fid] ?? 0) + 1;
  }

  const nodeCountMap: Record<string, number> = {};
  for (const n of nodes) {
    const oid = n.owner as string;
    if (oid) nodeCountMap[oid] = (nodeCountMap[oid] ?? 0) + 1;
  }

  const warCountMap: Record<string, number> = {};
  for (const w of activeWars) {
    const fa = w.faction_a as string;
    const fb = w.faction_b as string;
    if (fa) warCountMap[fa] = (warCountMap[fa] ?? 0) + 1;
    if (fb) warCountMap[fb] = (warCountMap[fb] ?? 0) + 1;
  }

  return {
    factions: factions.map(f => ({
      id: f.id as string,
      name: f.name as string,
      type: f.type as 'PvP' | 'PvE',
      color: (f.color as string) || '',
      description: (f.description as string) || '',
      isSystem: f.is_system as boolean,
      memberCount: memberCountMap[f.id] ?? 0,
      nodeCount: nodeCountMap[f.id] ?? 0,
      warCount: warCountMap[f.id] ?? 0
    }))
  };
};

export const actions: Actions = {
  createFaction: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = createFactionSchema.safeParse({
      name: data.get('name'),
      type: data.get('type'),
      color: data.get('color') || undefined,
      description: data.get('description') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'createFaction',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('factions').create({
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? '',
        description: parsed.data.description ?? '',
        is_system: false
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('name')) {
        return fail(400, {
          action: 'createFaction',
          errors: { name: ['A faction with this name already exists.'] },
          values: Object.fromEntries(data)
        });
      }
      return fail(500, {
        action: 'createFaction',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'createFaction' };
  },

  deleteFaction: async ({ request, locals }) => {
    // Gate: head_admin only (also enforced at DB rule level)
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

    // Check is_system — prevent deleting system factions (e.g. Neutral Territory)
    try {
      const faction = await locals.pb.collection('factions').getOne(id, { fields: 'id,is_system,name' });
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

    return { success: true, action: 'deleteFaction' };
  }
};
