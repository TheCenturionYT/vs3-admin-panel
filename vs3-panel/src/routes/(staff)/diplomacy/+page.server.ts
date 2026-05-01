import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const AGREEMENT_TYPES = ['Alliance', 'NAP', 'Trade Agreement', 'Vassalage', 'Coalition', 'Custom'] as const;

const createAgreementSchema = z.object({
  type: z.enum(AGREEMENT_TYPES, { message: 'Agreement type is required.' }),
  faction_a: z.string().min(1, 'Faction A is required.'),
  faction_b: z.string().min(1, 'Faction B is required.'),
  terms: z.string().optional(),
  custom_name: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required.')
}).refine(
  (data) => data.faction_a !== data.faction_b,
  { message: 'Faction A and Faction B must be different.', path: ['faction_b'] }
).refine(
  (data) => data.type !== 'Custom' || (data.custom_name && data.custom_name.trim().length > 0),
  { message: 'Custom name is required for Custom agreement type.', path: ['custom_name'] }
);

const endAgreementSchema = z.object({
  id: z.string().min(1, 'Agreement ID is required.'),
  end_date: z.string().min(1, 'End date is required.'),
  notes: z.string().optional()
});

export const load: PageServerLoad = async ({ locals }) => {
  const [agreements, factions] = await Promise.all([
    locals.pb.collection('diplomacy').getFullList({
      expand: 'faction_a,faction_b',
      sort: '-start_date'
    }),
    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name'
    })
  ]);

  const mapped = agreements.map(a => ({
    id: a.id as string,
    type: a.type as (typeof AGREEMENT_TYPES)[number],
    faction_a: a.faction_a as string,
    faction_b: a.faction_b as string,
    faction_a_name: (a.expand?.faction_a?.name as string) ?? '—',
    faction_b_name: (a.expand?.faction_b?.name as string) ?? '—',
    terms: (a.terms as string) ?? '',
    custom_name: (a.custom_name as string) ?? '',
    start_date: a.start_date as string,
    end_date: (a.end_date as string) ?? '',
    status: a.status as 'active' | 'ended'
  }));

  return {
    activeAgreements: mapped.filter(a => a.status === 'active'),
    endedAgreements: mapped.filter(a => a.status === 'ended'),
    factions: factions.map(f => ({
      id: f.id as string,
      name: f.name as string
    }))
  };
};

export const actions: Actions = {
  createAgreement: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = createAgreementSchema.safeParse({
      type: data.get('type'),
      faction_a: data.get('faction_a'),
      faction_b: data.get('faction_b'),
      terms: data.get('terms') || undefined,
      custom_name: data.get('custom_name') || undefined,
      start_date: data.get('start_date')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'createAgreement',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('diplomacy').create({
        type: parsed.data.type,
        faction_a: parsed.data.faction_a,
        faction_b: parsed.data.faction_b,
        terms: parsed.data.terms ?? '',
        custom_name: parsed.data.custom_name ?? '',
        start_date: parsed.data.start_date,
        status: 'active'
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[diplomacy] createAgreement error:', message);
      return fail(500, {
        action: 'createAgreement',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'createAgreement' };
  },

  endAgreement: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = endAgreementSchema.safeParse({
      id: data.get('id'),
      end_date: data.get('end_date'),
      notes: data.get('notes') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'endAgreement',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      const existing = await locals.pb.collection('diplomacy').getOne(parsed.data.id);
      const updatedTerms = parsed.data.notes
        ? (existing.terms ? `${existing.terms}\n\n[Ended] ${parsed.data.notes}` : `[Ended] ${parsed.data.notes}`)
        : existing.terms;

      await locals.pb.collection('diplomacy').update(parsed.data.id, {
        status: 'ended',
        end_date: parsed.data.end_date,
        terms: updatedTerms
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[diplomacy] endAgreement error:', message);
      return fail(500, {
        action: 'endAgreement',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'endAgreement' };
  }
};
