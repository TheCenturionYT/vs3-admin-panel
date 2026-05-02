import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const NODE_TYPES = [
  'Farm', 'Ranch', 'Orchard', 'Mine', 'Quarry', 'Clay Pit', 'Forest',
  'Lumber Mill', 'Resin Farm', 'Peat Bog', 'Salt Works', 'Workshop',
  'Trade Post', 'Military Node', 'Harbor/River Landing'
] as const;

const createNodeSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(NODE_TYPES, { message: 'Invalid node type.' }),
  tier: z.coerce.number().int().min(1).max(4),
  owner: z.string().optional(),
  base_upkeep: z.coerce.number().min(0).optional(),
  has_road: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  road_note: z.string().optional(),
  notes: z.string().optional()
});

const deleteNodeSchema = z.object({
  id: z.string().min(1)
});

export const load: PageServerLoad = async ({ locals }) => {
  const [nodes, factions] = await Promise.all([
    locals.pb.collection('nodes').getFullList({
      sort: 'name',
      expand: 'owner'
    }),
    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name,type,color'
    })
  ]);

  return {
    nodes: nodes.map(n => ({
      id: n.id as string,
      name: n.name as string,
      type: n.type as string,
      tier: n.tier as number,
      ownerId: n.owner as string | null,
      ownerName: (n.expand?.owner?.name as string) ?? null,
      ownerColor: (n.expand?.owner?.color as string) ?? null,
      base_upkeep: n.base_upkeep as number,
      instability: (n.instability as number) ?? 0,
      has_road: n.has_road as boolean,
      road_note: n.road_note as string,
      notes: n.notes as string,
      roll_due: n.roll_due as boolean
    })),
    factions: factions.map(f => ({
      id: f.id as string,
      name: f.name as string,
      type: f.type as 'PvP' | 'PvE',
      color: f.color as string
    }))
  };
};

export const actions: Actions = {
  createNode: async ({ request, locals }) => {
    const data = await request.formData();

    const rawOwner = data.get('owner') as string | null;
    const rawHasRoad = data.get('has_road') as string | null;

    const parsed = createNodeSchema.safeParse({
      name: data.get('name'),
      type: data.get('type'),
      tier: data.get('tier'),
      owner: rawOwner || undefined,
      base_upkeep: data.get('base_upkeep') || undefined,
      has_road: rawHasRoad || 'false',
      road_note: data.get('road_note') || undefined,
      notes: data.get('notes') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'createNode',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('nodes').create({
        name: parsed.data.name,
        type: parsed.data.type,
        tier: parsed.data.tier,
        owner: parsed.data.owner || null,
        base_upkeep: parsed.data.base_upkeep ?? 0,
        has_road: parsed.data.has_road ?? false,
        road_note: parsed.data.road_note ?? '',
        notes: parsed.data.notes ?? '',
        instability: 0,
        roll_due: false
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('name')) {
        return fail(400, {
          action: 'createNode',
          errors: { name: ['A node with this name already exists.'] },
          values: Object.fromEntries(data)
        });
      }
      return fail(500, {
        action: 'createNode',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'createNode' };
  },

  deleteNode: async ({ request, locals }) => {
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, { action: 'deleteNode', errors: { _global: ['Head Admin access required.'] } });
    }

    const data = await request.formData();
    const parsed = deleteNodeSchema.safeParse({ id: data.get('id') });

    if (!parsed.success) {
      return fail(400, { action: 'deleteNode', errors: { _global: ['Invalid request.'] } });
    }

    try {
      await locals.pb.collection('nodes').delete(parsed.data.id);
    } catch {
      return fail(500, { action: 'deleteNode', errors: { _global: ['Something went wrong. Please try again.'] } });
    }

    return { success: true, action: 'deleteNode' };
  }
};
