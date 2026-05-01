import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

// Validation schemas
const declareWarSchema = z.object({
  faction_a: z.string().min(1, 'Attacker faction is required.'),
  faction_b: z.string().min(1, 'Defender faction is required.'),
  casus_belli: z.string().min(1, 'Casus belli is required.'),
  start_date: z.string().min(1, 'Start date is required.'),
  notes: z.string().optional()
});

const endWarSchema = z.object({
  id: z.string().min(1),
  outcome: z.enum(['Victory_A', 'Victory_B', 'Stalemate'], { message: 'Outcome is required.' }),
  end_date: z.string().min(1, 'End date is required.'),
  notes: z.string().optional()
});

export const load: PageServerLoad = async ({ locals }) => {
  const [wars, pvpFactions] = await Promise.all([
    locals.pb.collection('wars').getFullList({
      sort: '-start_date',
      expand: 'faction_a,faction_b'
    }),
    locals.pb.collection('factions').getFullList({
      filter: 'type = "PvP"',
      sort: 'name',
      fields: 'id,name,color,type'
    })
  ]);

  const activeWars = wars
    .filter(w => w.status === 'active')
    .map(w => ({
      id: w.id as string,
      factionAId: w.faction_a as string,
      factionAName: (w.expand?.faction_a?.name as string) ?? '—',
      factionAColor: (w.expand?.faction_a?.color as string) || '',
      factionBId: w.faction_b as string,
      factionBName: (w.expand?.faction_b?.name as string) ?? '—',
      factionBColor: (w.expand?.faction_b?.color as string) || '',
      casusBelli: (w.casus_belli as string) ?? '',
      startDate: (w.start_date as string) ?? '',
      status: w.status as string
    }));

  const endedWars = wars
    .filter(w => w.status === 'ended')
    .map(w => ({
      id: w.id as string,
      factionAId: w.faction_a as string,
      factionAName: (w.expand?.faction_a?.name as string) ?? '—',
      factionAColor: (w.expand?.faction_a?.color as string) || '',
      factionBId: w.faction_b as string,
      factionBName: (w.expand?.faction_b?.name as string) ?? '—',
      factionBColor: (w.expand?.faction_b?.color as string) || '',
      casusBelli: (w.casus_belli as string) ?? '',
      startDate: (w.start_date as string) ?? '',
      endDate: (w.end_date as string) ?? '',
      outcome: (w.outcome as string) ?? '',
      status: w.status as string
    }));

  return {
    activeWars,
    endedWars,
    pvpFactions: pvpFactions.map(f => ({
      id: f.id as string,
      name: f.name as string,
      color: (f.color as string) || '',
      type: f.type as string
    }))
  };
};

export const actions: Actions = {
  declareWar: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = declareWarSchema.safeParse({
      faction_a: data.get('faction_a'),
      faction_b: data.get('faction_b'),
      casus_belli: data.get('casus_belli'),
      start_date: data.get('start_date'),
      notes: data.get('notes') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'declareWar',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    if (parsed.data.faction_a === parsed.data.faction_b) {
      return fail(400, {
        action: 'declareWar',
        errors: { _global: ['A faction cannot declare war on itself.'] },
        values: Object.fromEntries(data)
      });
    }

    // Verify both factions are PvP
    try {
      const [factionA, factionB] = await Promise.all([
        locals.pb.collection('factions').getOne(parsed.data.faction_a, { fields: 'id,type,name' }),
        locals.pb.collection('factions').getOne(parsed.data.faction_b, { fields: 'id,type,name' })
      ]);

      if (factionA.type !== 'PvP' || factionB.type !== 'PvP') {
        return fail(400, {
          action: 'declareWar',
          errors: { _global: ['Wars can only be declared between PvP factions.'] },
          values: Object.fromEntries(data)
        });
      }
    } catch {
      return fail(404, {
        action: 'declareWar',
        errors: { _global: ['One or both factions not found.'] },
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('wars').create({
        faction_a: parsed.data.faction_a,
        faction_b: parsed.data.faction_b,
        casus_belli: parsed.data.casus_belli,
        start_date: parsed.data.start_date,
        notes: parsed.data.notes ?? '',
        status: 'active'
      });
    } catch {
      return fail(500, {
        action: 'declareWar',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'declareWar' };
  },

  endWar: async ({ request, locals }) => {
    // Gate: head_admin only
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, {
        action: 'endWar',
        errors: { _global: ['Head Admin access required.'] }
      });
    }

    const data = await request.formData();
    const parsed = endWarSchema.safeParse({
      id: data.get('id'),
      outcome: data.get('outcome'),
      end_date: data.get('end_date'),
      notes: data.get('notes') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'endWar',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('wars').update(parsed.data.id, {
        status: 'ended',
        outcome: parsed.data.outcome,
        end_date: parsed.data.end_date,
        notes: parsed.data.notes ?? ''
      });
    } catch {
      return fail(500, {
        action: 'endWar',
        errors: { _global: ['Something went wrong. Please try again.'] }
      });
    }

    return { success: true, action: 'endWar' };
  }
};
