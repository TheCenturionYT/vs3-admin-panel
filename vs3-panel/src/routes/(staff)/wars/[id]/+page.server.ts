import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

// Validation schemas
const logBattleSchema = z.object({
  node: z.string().optional(),
  attacker: z.string().min(1, 'Attacker is required.'),
  defender: z.string().min(1, 'Defender is required.'),
  result: z.string().optional(),
  description: z.string().optional(),
  battle_date: z.string().min(1, 'Battle date is required.'),
  ownership_transferred: z.boolean().default(false)
});

const addSiegeSchema = z.object({
  node: z.string().min(1, 'Node is required.'),
  attacker: z.string().min(1, 'Attacker is required.'),
  defender: z.string().min(1, 'Defender is required.'),
  objectives: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required.')
});

const resolveSiegeSchema = z.object({
  id: z.string().min(1),
  resolution_note: z.string().optional()
});

export const load: PageServerLoad = async ({ locals, params }) => {
  // Fetch war
  let war: Record<string, unknown>;
  try {
    war = await locals.pb.collection('wars').getOne(params.id, {
      expand: 'faction_a,faction_b'
    });
  } catch {
    throw error(404, 'War not found.');
  }

  const [battles, sieges, nodes] = await Promise.all([
    locals.pb.collection('battles').getFullList({
      filter: `war = "${params.id}"`,
      sort: '-battle_date',
      expand: 'node,attacker,defender'
    }),
    locals.pb.collection('sieges').getFullList({
      filter: `war = "${params.id}"`,
      sort: '-start_date',
      expand: 'node,attacker,defender'
    }),
    locals.pb.collection('nodes').getFullList({
      sort: 'node_number,name',
      fields: 'id,name,node_number'
    })
  ]);

  const factionA = war.expand as Record<string, unknown>;

  return {
    war: {
      id: war.id as string,
      factionAId: war.faction_a as string,
      factionAName: ((factionA?.faction_a as Record<string, unknown>)?.name as string) ?? '—',
      factionAColor: ((factionA?.faction_a as Record<string, unknown>)?.color as string) || '',
      factionBId: war.faction_b as string,
      factionBName: ((factionA?.faction_b as Record<string, unknown>)?.name as string) ?? '—',
      factionBColor: ((factionA?.faction_b as Record<string, unknown>)?.color as string) || '',
      casusBelli: (war.casus_belli as string) ?? '',
      startDate: (war.start_date as string) ?? '',
      endDate: (war.end_date as string) ?? '',
      status: (war.status as string) ?? 'active',
      outcome: (war.outcome as string) ?? '',
      notes: (war.notes as string) ?? ''
    },
    battles: battles.map(b => ({
      id: b.id as string,
      nodeId: (b.node as string) || '',
      nodeName: ((b.expand as Record<string, unknown>)?.node as Record<string, unknown>)?.name as string || '',
      attackerId: b.attacker as string,
      attackerName: ((b.expand as Record<string, unknown>)?.attacker as Record<string, unknown>)?.name as string || '—',
      defenderId: b.defender as string,
      defenderName: ((b.expand as Record<string, unknown>)?.defender as Record<string, unknown>)?.name as string || '—',
      result: (b.result as string) ?? '',
      description: (b.description as string) ?? '',
      battleDate: (b.battle_date as string) ?? '',
      ownershipTransferred: (b.ownership_transferred as boolean) ?? false
    })),
    sieges: sieges.map(s => ({
      id: s.id as string,
      nodeId: s.node as string,
      nodeName: ((s.expand as Record<string, unknown>)?.node as Record<string, unknown>)?.name as string || '—',
      attackerId: s.attacker as string,
      attackerName: ((s.expand as Record<string, unknown>)?.attacker as Record<string, unknown>)?.name as string || '—',
      defenderId: s.defender as string,
      defenderName: ((s.expand as Record<string, unknown>)?.defender as Record<string, unknown>)?.name as string || '—',
      objectives: (s.objectives as string) ?? '',
      startDate: (s.start_date as string) ?? '',
      resolved: (s.resolved as boolean) ?? false,
      resolutionNote: (s.resolution_note as string) ?? ''
    })),
    nodes: nodes.map(n => ({
      id: n.id as string,
      name: n.name as string,
      nodeNumber: n.node_number as number
    }))
  };
};

export const actions: Actions = {
  logBattle: async ({ request, locals, params }) => {
    const data = await request.formData();
    const ownershipTransferred = data.get('ownership_transferred') === 'true' || data.get('ownership_transferred') === 'on';

    const parsed = logBattleSchema.safeParse({
      node: (data.get('node') as string) || undefined,
      attacker: data.get('attacker'),
      defender: data.get('defender'),
      result: (data.get('result') as string) || undefined,
      description: (data.get('description') as string) || undefined,
      battle_date: data.get('battle_date'),
      ownership_transferred: ownershipTransferred
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'logBattle',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    let battleId: string;
    try {
      const battle = await locals.pb.collection('battles').create({
        war: params.id,
        node: parsed.data.node ?? null,
        attacker: parsed.data.attacker,
        defender: parsed.data.defender,
        result: parsed.data.result ?? '',
        description: parsed.data.description ?? '',
        battle_date: parsed.data.battle_date,
        ownership_transferred: parsed.data.ownership_transferred
      });
      battleId = battle.id;
    } catch {
      return fail(500, {
        action: 'logBattle',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    // CRITICAL: if ownership transferred and node provided, create ownership record and update node
    if (parsed.data.ownership_transferred && parsed.data.node) {
      try {
        await locals.pb.collection('node_ownership_history').create({
          node: parsed.data.node,
          faction: parsed.data.attacker,
          transfer_date: parsed.data.battle_date,
          method: 'violent',
          staff_note: 'Transferred via battle outcome.'
        });
        await locals.pb.collection('nodes').update(parsed.data.node, {
          owner: parsed.data.attacker
        });
      } catch (err: unknown) {
        // Non-fatal — battle was logged; log but do not block
        console.error('[logBattle] Failed to update ownership:', err);
      }
    }

    return { success: true, action: 'logBattle' };
  },

  addSiege: async ({ request, locals, params }) => {
    const data = await request.formData();
    const parsed = addSiegeSchema.safeParse({
      node: data.get('node'),
      attacker: data.get('attacker'),
      defender: data.get('defender'),
      objectives: (data.get('objectives') as string) || undefined,
      start_date: data.get('start_date')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'addSiege',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('sieges').create({
        war: params.id,
        node: parsed.data.node,
        attacker: parsed.data.attacker,
        defender: parsed.data.defender,
        objectives: parsed.data.objectives ?? '',
        start_date: parsed.data.start_date,
        resolved: false
      });
    } catch {
      return fail(500, {
        action: 'addSiege',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'addSiege' };
  },

  resolveSiege: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = resolveSiegeSchema.safeParse({
      id: data.get('id'),
      resolution_note: (data.get('resolution_note') as string) || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'resolveSiege',
        errors: parsed.error.flatten().fieldErrors
      });
    }

    try {
      await locals.pb.collection('sieges').update(parsed.data.id, {
        resolved: true,
        resolution_note: parsed.data.resolution_note ?? ''
      });
    } catch {
      return fail(500, {
        action: 'resolveSiege',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    return { success: true, action: 'resolveSiege' };
  }
};
