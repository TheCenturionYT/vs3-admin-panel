import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const NODE_TYPES = [
  'Farm', 'Ranch', 'Orchard', 'Mine', 'Quarry', 'Clay Pit', 'Forest',
  'Lumber Mill', 'Resin Farm', 'Peat Bog', 'Salt Works', 'Workshop',
  'Trade Post', 'Military Node', 'Harbor/River Landing'
] as const;

const editNodeSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(NODE_TYPES, { message: 'Invalid node type.' }),
  tier: z.coerce.number().int().min(1).max(4),
  owner: z.string().optional(),
  base_upkeep: z.coerce.number().min(0).optional(),
  has_road: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  road_note: z.string().optional(),
  notes: z.string().optional(),
  instability: z.coerce.number().int().min(0).max(5).optional(),
  roll_due: z.enum(['true', 'false']).transform(v => v === 'true').optional()
});

const transferOwnershipSchema = z.object({
  to_faction_id: z.string().min(1, 'Destination faction is required.'),
  method: z.enum(['peaceful', 'violent', 'system'], { message: 'Transfer method is required.' }),
  staff_note: z.string().optional()
});

const deleteNodeSchema = z.object({
  id: z.string().min(1)
});

export const load: PageServerLoad = async ({ locals, params }) => {
  // Fetch the node with its owner
  let node: Record<string, unknown>;
  try {
    node = await locals.pb.collection('nodes').getOne(params.id, { expand: 'owner' });
  } catch {
    redirect(303, '/nodes');
  }

  const ownerId = node.owner as string | null;

  // Parallel fetch: ownership history, node log, all factions, owner's nodes, owner's active wars
  const [ownershipHistory, nodeLog, factions, ownerNodes, activeWars] = await Promise.all([
    locals.pb.collection('node_ownership_history').getFullList({
      filter: `node = "${params.id}"`,
      sort: '-transfer_date',
      expand: 'from_faction,to_faction'
    }).catch(() => []),

    locals.pb.collection('server_log').getList(1, 50, {
      filter: `related_node = "${params.id}"`,
      sort: '-created'
    }).catch(() => ({ items: [] })),

    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name,type,color'
    }).catch(() => []),

    ownerId
      ? locals.pb.collection('nodes').getFullList({
          filter: `owner = "${ownerId}"`,
          fields: 'id'
        }).catch(() => [])
      : Promise.resolve([]),

    ownerId
      ? locals.pb.collection('wars').getFullList({
          filter: `(faction_a = "${ownerId}" || faction_b = "${ownerId}") && status = "active"`,
          fields: 'id'
        }).catch(() => [])
      : Promise.resolve([])
  ]);

  const ownerFaction = factions.find((f: Record<string, unknown>) => f.id === ownerId) ?? null;

  return {
    node: {
      id: node.id as string,
      name: node.name as string,
      type: node.type as string,
      tier: node.tier as number,
      ownerId: node.owner as string | null,
      ownerName: (node.expand as Record<string, unknown> | undefined)?.owner
        ? ((node.expand as Record<string, Record<string, unknown>>).owner.name as string)
        : null,
      ownerColor: (node.expand as Record<string, unknown> | undefined)?.owner
        ? ((node.expand as Record<string, Record<string, unknown>>).owner.color as string)
        : null,
      ownerType: ownerFaction ? (ownerFaction.type as 'PvP' | 'PvE') : null,
      base_upkeep: (node.base_upkeep as number) ?? 0,
      instability: (node.instability as number) ?? 0,
      has_road: (node.has_road as boolean) ?? false,
      road_note: (node.road_note as string) ?? '',
      notes: (node.notes as string) ?? '',
      roll_due: (node.roll_due as boolean) ?? false
    },
    ownerNodeCount: ownerNodes.length,
    ownerWarCount: activeWars.length,
    ownershipHistory: ownershipHistory.map((h: Record<string, unknown>) => {
      const exp = h.expand as Record<string, Record<string, unknown>> | undefined;
      return {
        id: h.id as string,
        transfer_date: h.transfer_date as string,
        fromFactionId: h.from_faction as string | null,
        fromFactionName: exp?.from_faction?.name as string ?? null,
        toFactionId: h.to_faction as string | null,
        toFactionName: exp?.to_faction?.name as string ?? null,
        method: h.method as 'peaceful' | 'violent' | 'system',
        staff_note: h.staff_note as string ?? ''
      };
    }),
    nodeLog: (nodeLog as { items: Record<string, unknown>[] }).items.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      created: e.created as string,
      event_type: e.event_type as string,
      description: e.description as string,
      actor: e.actor as string ?? ''
    })),
    factions: factions.map((f: Record<string, unknown>) => ({
      id: f.id as string,
      name: f.name as string,
      type: f.type as 'PvP' | 'PvE',
      color: f.color as string
    }))
  };
};

export const actions: Actions = {
  editNode: async ({ request, locals, params }) => {
    const data = await request.formData();

    const rawOwner = data.get('owner') as string | null;
    const rawHasRoad = data.get('has_road') as string | null;
    const rawRollDue = data.get('roll_due') as string | null;

    const parsed = editNodeSchema.safeParse({
      name: data.get('name'),
      type: data.get('type'),
      tier: data.get('tier'),
      owner: rawOwner || undefined,
      base_upkeep: data.get('base_upkeep') || undefined,
      has_road: rawHasRoad || 'false',
      road_note: data.get('road_note') || undefined,
      notes: data.get('notes') || undefined,
      instability: data.get('instability') || undefined,
      roll_due: rawRollDue || 'false'
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'editNode',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('nodes').update(params.id, {
        name: parsed.data.name,
        type: parsed.data.type,
        tier: parsed.data.tier,
        owner: parsed.data.owner || null,
        base_upkeep: parsed.data.base_upkeep ?? 0,
        has_road: parsed.data.has_road ?? false,
        road_note: parsed.data.road_note ?? '',
        notes: parsed.data.notes ?? '',
        instability: parsed.data.instability ?? 0,
        roll_due: parsed.data.roll_due ?? false
      });
    } catch {
      return fail(500, {
        action: 'editNode',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    return { success: true, action: 'editNode' };
  },

  transferOwnership: async ({ request, locals, params }) => {
    const data = await request.formData();
    const parsed = transferOwnershipSchema.safeParse({
      to_faction_id: data.get('to_faction_id'),
      method: data.get('method'),
      staff_note: data.get('staff_note') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'transferOwnership',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      // Get current node to know the from_faction
      const node = await locals.pb.collection('nodes').getOne(params.id, { fields: 'id,owner' });
      const fromFactionId = node.owner as string | null;

      // Create ownership history record
      await locals.pb.collection('node_ownership_history').create({
        node: params.id,
        from_faction: fromFactionId || null,
        to_faction: parsed.data.to_faction_id,
        method: parsed.data.method,
        transfer_date: new Date().toISOString(),
        staff_note: parsed.data.staff_note ?? ''
      });

      // Update node owner
      await locals.pb.collection('nodes').update(params.id, {
        owner: parsed.data.to_faction_id
      });
    } catch {
      return fail(500, {
        action: 'transferOwnership',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    return { success: true, action: 'transferOwnership' };
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

    redirect(303, '/nodes');
  }
};
