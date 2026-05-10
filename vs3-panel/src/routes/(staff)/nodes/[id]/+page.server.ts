import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { calcUpkeep } from '$lib/upkeep';

const NODE_TYPES = [
  'Farm', 'Herd / Ranch', 'Orchard', 'Mine', 'Quarry', 'Clay Pit', 'Forest',
  'Lumber Mill', 'Resin Farm', 'Peat Bog', 'Salt Works', 'Workshop',
  'Trade Post', 'Military Node', 'Harbor'
] as const;

// === Phase 3 Cost Constants ===
// Repair costs from Handbook §VIII (Suggested Repair SP): T1=50, T2=100, T3=200, T4=300
// Note: §IX table shows 50/90/160/250 as "Repair Cost After Violent Capture" — confirm with admin if §IX values should take precedence
const REPAIR_SP: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 300 };
// Upgrade costs from Handbook v1.4.1 §IX Tier table: T1→T2=100, T2→T3=300, T3→T4=600
const UPGRADE_SP: Record<number, number> = { 1: 100, 2: 300, 3: 600 };
const INSTAB_REDUCTION_SP = 40;

function computeNextDeadline(dayOfWeek: number, hour: number, minute: number, tzOffset: number): Date {
  const tzMs = tzOffset * 60 * 60 * 1000;
  const now = new Date();
  const localNow = new Date(now.getTime() + tzMs);
  const currentDay = localNow.getUTCDay();
  let daysUntil = (dayOfWeek - currentDay + 7) % 7;
  if (daysUntil === 0) {
    const passedMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
    if (passedMinutes >= hour * 60 + minute) daysUntil = 7;
  }
  const dl = new Date(localNow.getTime());
  dl.setUTCDate(dl.getUTCDate() + daysUntil);
  dl.setUTCHours(hour, minute, 0, 0);
  return new Date(dl.getTime() - tzMs);
}

function checkCaps(
  existing: Array<{ category: string; sp_value: number }>,
  newCategory: string,
  newSpValue: number,
  effectiveUpkeep: number
): { ok: boolean; rrSP: number; cSP: number; rrPct: number; cPct: number } {
  if (!effectiveUpkeep) return { ok: true, rrSP: 0, cSP: 0, rrPct: 0, cPct: 0 };
  const all = [...existing, { category: newCategory, sp_value: newSpValue }];
  const rrSP = all.filter(s => s.category === 'Raw Renewable').reduce((sum, s) => sum + s.sp_value, 0);
  const cSP  = all.filter(s => s.category === 'Currency').reduce((sum, s) => sum + s.sp_value, 0);
  return {
    ok: (rrSP / effectiveUpkeep * 100) <= 40 && (cSP / effectiveUpkeep * 100) <= 40,
    rrSP, cSP,
    rrPct: Math.round(rrSP / effectiveUpkeep * 100),
    cPct: Math.round(cSP / effectiveUpkeep * 100)
  };
}

// === Phase 2 Schemas (unchanged) ===
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

// === Phase 3 Schemas ===
const logSubmissionSchema = z.object({
  submission_type: z.enum(['upkeep', 'instability_reduction', 'repair', 'upgrade', 'custom']),
  item: z.string().optional(),
  qty: z.coerce.number().int().min(1).optional(),
  custom_name: z.string().max(100).optional(),
  custom_sp: z.coerce.number().optional(),
  staff_note: z.string().max(200).optional()
});

const removeSubmissionSchema = z.object({ id: z.string().min(1) });
const deleteCycleHistorySchema = z.object({ id: z.string().min(1) });
const deleteNodeLogEntrySchema = z.object({ id: z.string().min(1) });
const updateCycleOutcomeSchema = z.object({
  id: z.string().min(1),
  outcome: z.enum(['paid', 'partial', 'underfunded', 'unpaid'])
});

const rollInstabilitySchema = z.object({
  roll: z.coerce.number().int().min(1).max(100),
  threshold: z.coerce.number().int().min(0).max(100),
  triggered: z.coerce.boolean(),
  event_name: z.string().optional(),
  event_desc: z.string().optional(),
  event_effect: z.string().optional(),
  sp_cost: z.coerce.number().optional(),
  instab_add: z.coerce.number().optional(),
  output_penalty: z.coerce.number().optional(),
  is_choice: z.coerce.boolean().optional(),
  is_rp: z.coerce.boolean().optional()
});

const resolveEventSchema = z.object({
  roll_id: z.string().min(1),
  resolved_action: z.enum(['apply_instability','log_sp_debt','mark_output_penalty','mark_rp_handled','dismiss']),
  staff_note: z.string().max(200).optional()
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

  // Parallel fetch: ownership history, node log, all factions, owner's nodes, owner's active wars,
  // Phase 3: current submissions, submission history, instability rolls, sp_catalogue, deadline_config
  const [
    ownershipHistory,
    nodeLog,
    factions,
    ownerNodes,
    activeWars,
    currentSubmissions,
    cycleHistory,
    instabilityRolls,
    spCatalogue,
    deadlineConfigs
  ] = await Promise.all([
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
      : Promise.resolve([]),

    // Phase 3: current cycle submissions for this node
    locals.pb.collection('submissions').getFullList({
      filter: `node = "${params.id}"`,
      sort: '-created',
      fields: 'id,item_name,category,qty,sp_value,submission_type,staff_note,submitted_by'
    }).catch(() => []),

    // Phase 3: archived cycle history for this node
    locals.pb.collection('submission_history').getFullList({
      filter: `node = "${params.id}"`,
      sort: '-deadline_ts'
    }).catch(() => []),

    // Phase 3: instability roll log for this node
    locals.pb.collection('instability_rolls').getFullList({
      filter: `node = "${params.id}"`,
      sort: '-created'
    }).catch(() => []),

    // Phase 3: SP catalogue items for submission form
    locals.pb.collection('sp_catalogue').getFullList({
      sort: 'category,name',
      fields: 'id,name,category,sp_value'
    }).catch(() => []),

    // Deadline config for next deadline display
    locals.pb.collection('deadline_config').getFullList({
      filter: 'is_active = true',
      fields: 'day_of_week,hour,minute,timezone_offset'
    }).catch(() => [])
  ]);

  const ownerFaction = factions.find((f: Record<string, unknown>) => f.id === ownerId) ?? null;

  const dlCfg = (deadlineConfigs as Record<string, unknown>[])[0] ?? null;
  const nextDeadline = dlCfg
    ? computeNextDeadline(
        dlCfg.day_of_week as number,
        dlCfg.hour as number,
        dlCfg.minute as number,
        dlCfg.timezone_offset as number
      ).toISOString()
    : null;

  // Effective upkeep — never stored, always computed at read time (CLAUDE.md constraint)
  const effectiveUpkeep = calcUpkeep(
    (node.base_upkeep as number) ?? 0,
    (ownerNodes as unknown[]).length,
    (activeWars as unknown[]).length,
    (ownerFaction as { type?: 'PvP' | 'PvE' } | null)?.type ?? 'PvE',
    !ownerId
  );

  const tier = (node.tier as number) ?? 1;

  return {
    node: {
      id: node.id as string,
      name: node.name as string,
      type: node.type as string,
      tier,
      ownerId: node.owner as string | null,
      ownerName: (node.expand as Record<string, unknown> | undefined)?.owner
        ? ((node.expand as Record<string, Record<string, unknown>>).owner.name as string)
        : null,
      ownerColor: (node.expand as Record<string, unknown> | undefined)?.owner
        ? ((node.expand as Record<string, Record<string, unknown>>).owner.color as string)
        : null,
      ownerType: ownerFaction ? (ownerFaction as { type: 'PvP' | 'PvE' }).type : null,
      base_upkeep: (node.base_upkeep as number) ?? 0,
      instability: (node.instability as number) ?? 0,
      has_road: (node.has_road as boolean) ?? false,
      road_note: (node.road_note as string) ?? '',
      notes: (node.notes as string) ?? '',
      roll_due: (node.roll_due as boolean) ?? false
    },
    ownerNodeCount: (ownerNodes as unknown[]).length,
    ownerWarCount: (activeWars as unknown[]).length,
    ownershipHistory: (ownershipHistory as Record<string, unknown>[]).map((h: Record<string, unknown>) => {
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
    nodeLog: ((nodeLog as { items: Record<string, unknown>[] }).items).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      created: e.created as string,
      event_type: e.event_type as string,
      description: e.description as string,
      actor: e.actor as string ?? ''
    })),
    factions: (factions as Record<string, unknown>[]).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      name: f.name as string,
      type: f.type as 'PvP' | 'PvE',
      color: f.color as string
    })),
    // Phase 3 data
    effectiveUpkeep,
    nextDeadline,
    repairCost: REPAIR_SP[tier] ?? 0,
    upgradeCost: UPGRADE_SP[tier] ?? 0,
    currentSubmissions: (currentSubmissions as Record<string, unknown>[]).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      item_name: s.item_name as string,
      category: s.category as string,
      qty: s.qty as number,
      sp_value: s.sp_value as number,
      submission_type: s.submission_type as string,
      staff_note: s.staff_note as string ?? ''
    })),
    cycleHistory: (cycleHistory as Record<string, unknown>[]).map((h: Record<string, unknown>) => ({
      id: h.id as string,
      deadline_ts: h.deadline_ts as string,
      paid_sp: h.paid_sp as number,
      required_sp: h.required_sp as number,
      outcome: h.outcome as string,
      instab_delta: h.instab_delta as number,
      snapshot: h.snapshot as unknown
    })),
    instabilityRolls: (instabilityRolls as Record<string, unknown>[]).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      created: r.created as string,
      roll: r.roll as number,
      threshold: r.threshold as number,
      triggered: r.triggered as boolean,
      event_name: r.event_name as string ?? '',
      event_desc: r.event_desc as string ?? '',
      event_effect: r.event_effect as string ?? '',
      resolved: r.resolved as boolean,
      resolved_action: r.resolved_action as string ?? ''
    })),
    spCatalogue: (spCatalogue as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string,
      category: c.category as string,
      sp_value: c.sp_value as number
    }))
  };
};

export const actions: Actions = {
  // === Phase 2 Actions (preserved unchanged) ===
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
  },

  // === Phase 3 Actions ===

  logSubmission: async ({ request, locals, params }) => {
    const formData = await request.formData();
    const parsed = logSubmissionSchema.safeParse({
      submission_type: formData.get('submission_type'),
      item: formData.get('item') || undefined,
      qty: formData.get('qty') || undefined,
      custom_name: formData.get('custom_name') || undefined,
      custom_sp: formData.get('custom_sp') || undefined,
      staff_note: formData.get('staff_note') || undefined
    });
    if (!parsed.success) {
      return fail(400, { action: 'logSubmission', errors: parsed.error.flatten().fieldErrors });
    }
    const { submission_type, item, qty, custom_name, custom_sp, staff_note } = parsed.data;

    // Resolve sp_value, item_name, category by submission_type
    const node = await locals.pb.collection('nodes').getOne(params.id);
    const tier = (node as { tier?: number }).tier ?? 1;
    let sp_value = 0;
    let item_name = '';
    let category = '';

    if (submission_type === 'upkeep') {
      if (!item || !qty) return fail(400, { action: 'logSubmission', errors: { _global: ['Item and quantity are required for upkeep submissions.'] } });
      const cat = await locals.pb.collection('sp_catalogue').getOne(item).catch(() => null);
      if (!cat) return fail(400, { action: 'logSubmission', errors: { item: ['Item not found.'] } });
      item_name = (cat as { name: string }).name;
      category = (cat as { category: string }).category;
      sp_value = (cat as { sp_value: number }).sp_value * qty;

      // Cap check (server is authoritative — T-03-13 mitigation)
      const existing = await locals.pb.collection('submissions').getFullList({
        filter: `node = "${params.id}"`,
        fields: 'category,sp_value'
      });
      // Recompute effective upkeep at write time (NEVER store — CLAUDE.md constraint)
      const factionId = (node as { owner?: string }).owner ?? '';
      const ownerFaction = factionId ? await locals.pb.collection('factions').getOne(factionId).catch(() => null) : null;
      const ownerNodes = factionId ? await locals.pb.collection('nodes').getFullList({ filter: `owner = "${factionId}"`, fields: 'id' }) : [];
      const ownerWars = factionId ? await locals.pb.collection('wars').getFullList({ filter: `(faction_a = "${factionId}" || faction_b = "${factionId}") && status = "active"`, fields: 'id' }) : [];
      const eff = calcUpkeep(
        (node as { base_upkeep: number }).base_upkeep,
        ownerNodes.length,
        ownerWars.length,
        (ownerFaction as { type?: 'PvP' | 'PvE' } | null)?.type ?? 'PvE',
        !factionId
      );
      const cap = checkCaps(existing as Array<{ category: string; sp_value: number }>, category, sp_value, eff);
      if (!cap.ok) {
        return fail(400, { action: 'logSubmission', errors: { _global: [`This submission exceeds the 40% cap. Raw Renewable: ${cap.rrPct}%, Currency: ${cap.cPct}%.`] } });
      }
    } else if (submission_type === 'instability_reduction') {
      const cur = (node as { instability?: number }).instability ?? 0;
      if (cur <= 0) {
        return fail(400, { action: 'logSubmission', errors: { _global: ['Instability is already 0. No reduction is needed.'] } });
      }
      item_name = 'Instability Reduction';
      category = 'special';
      sp_value = -INSTAB_REDUCTION_SP;
    } else if (submission_type === 'repair') {
      if (!REPAIR_SP[tier]) return fail(400, { action: 'logSubmission', errors: { _global: [`No repair cost defined for tier ${tier}.`] } });
      item_name = `Repair — T${tier}`;
      category = 'special';
      sp_value = -REPAIR_SP[tier];
    } else if (submission_type === 'upgrade') {
      if (tier >= 4) return fail(400, { action: 'logSubmission', errors: { _global: ['Node is already at maximum tier (T4).'] } });
      if (!UPGRADE_SP[tier]) return fail(400, { action: 'logSubmission', errors: { _global: [`No upgrade cost defined for tier ${tier}.`] } });
      // Block duplicate upgrade submissions — only one allowed at a time per node.
      // Multiple upgrades in the queue is the #1 cause of unexpected tier jumps.
      const existingUpgrades = await locals.pb.collection('submissions').getFullList({
        filter: `node = "${params.id}" && submission_type = "upgrade"`,
        fields: 'id,item_name'
      }).catch(() => []);
      if (existingUpgrades.length > 0) {
        const existing = (existingUpgrades[0] as { item_name: string }).item_name;
        return fail(400, { action: 'logSubmission', errors: { _global: [`An upgrade submission ("${existing}") is already queued. Remove it first or push the current cycle.`] } });
      }
      item_name = `Upgrade — T${tier} → T${Number(tier) + 1}`;
      category = 'special';
      sp_value = -UPGRADE_SP[tier];
    } else if (submission_type === 'custom') {
      if (!custom_name?.trim()) return fail(400, { action: 'logSubmission', errors: { _global: ['Description is required for custom submissions.'] } });
      if (!custom_sp || custom_sp === 0) return fail(400, { action: 'logSubmission', errors: { _global: ['SP value must be non-zero for custom submissions.'] } });
      item_name = custom_name.trim();
      category = 'special';
      sp_value = custom_sp;
    }

    const submittedBy = (locals.pb.authStore.record as { id?: string } | null)?.id;

    try {
      await locals.pb.collection('submissions').create({
        node: params.id,
        item: submission_type === 'upkeep' ? item : '',
        item_name, category, qty: qty ?? 1, sp_value,
        submission_type, staff_note: staff_note ?? '',
        submitted_by: submittedBy ?? ''
      });
      // Side effects for special types
      if (submission_type === 'instability_reduction') {
        const cur = (node as { instability?: number }).instability ?? 0;
        if (cur > 0) {
          await locals.pb.collection('nodes').update(params.id, { instability: cur - 1 });
        }
      }
      // Note: upgrade tier increment happens in confirmCycle, not here
    } catch {
      return fail(500, { action: 'logSubmission', errors: { _global: ['Failed to save submission.'] } });
    }
    return { success: true, action: 'logSubmission' };
  },

  removeSubmission: async ({ request, locals, params }) => {
    const formData = await request.formData();
    const parsed = removeSubmissionSchema.safeParse({ id: formData.get('id') });
    if (!parsed.success) return fail(400, { action: 'removeSubmission', errors: parsed.error.flatten().fieldErrors });
    // Verify submission belongs to this node — prevents cross-node deletion via crafted POST
    let subNode: string;
    try {
      const sub = await locals.pb.collection('submissions').getOne(parsed.data.id, { fields: 'id,node' });
      subNode = (sub as { node: string }).node;
    } catch {
      return fail(400, { action: 'removeSubmission', errors: { _global: ['Submission not found.'] } });
    }
    if (subNode !== params.id) {
      return fail(400, { action: 'removeSubmission', errors: { _global: ['Submission does not belong to this node.'] } });
    }
    try {
      await locals.pb.collection('submissions').delete(parsed.data.id);
    } catch {
      return fail(500, { action: 'removeSubmission', errors: { _global: ['Failed to remove submission.'] } });
    }
    return { success: true, action: 'removeSubmission' };
  },

  rollInstability: async ({ request, locals, params }) => {
    const formData = await request.formData();
    const parsed = rollInstabilitySchema.safeParse({
      roll: formData.get('roll'),
      threshold: formData.get('threshold'),
      triggered: formData.get('triggered'),
      event_name: formData.get('event_name') || undefined,
      event_desc: formData.get('event_desc') || undefined,
      event_effect: formData.get('event_effect') || undefined,
      sp_cost: formData.get('sp_cost') || undefined,
      instab_add: formData.get('instab_add') || undefined,
      output_penalty: formData.get('output_penalty') || undefined,
      is_choice: formData.get('is_choice') || undefined,
      is_rp: formData.get('is_rp') || undefined
    });
    if (!parsed.success) return fail(400, { action: 'rollInstability', errors: parsed.error.flatten().fieldErrors });

    const isManual = formData.get('is_manual') === 'true';

    if (!isManual) {
      // Guard: for automatic rolls (roll_due workflow), require roll_due = true on the node
      const nodeForRoll = await locals.pb.collection('nodes').getOne(params.id, { fields: 'id,roll_due' });
      if (!(nodeForRoll as { roll_due?: boolean }).roll_due) {
        return fail(400, { action: 'rollInstability', errors: { _global: ['No instability roll is currently due for this node.'] } });
      }
    }

    let rollId = '';
    try {
      const rollRecord = await locals.pb.collection('instability_rolls').create({
        node: params.id, ...parsed.data,
        resolved: !parsed.data.triggered,
        // Tag manual rolls for history display
        is_manual: isManual
      });
      rollId = rollRecord.id as string;
      // If not triggered, clear roll_due (no-op for manual rolls, correct for scheduled rolls)
      if (!parsed.data.triggered && !isManual) {
        await locals.pb.collection('nodes').update(params.id, { roll_due: false });
      }
    } catch {
      return fail(500, { action: 'rollInstability', errors: { _global: ['Failed to save roll.'] } });
    }
    return { success: true, action: 'rollInstability', rollId };
  },

  resolveEvent: async ({ request, locals, params }) => {
    const formData = await request.formData();
    const parsed = resolveEventSchema.safeParse({
      roll_id: formData.get('roll_id'),
      resolved_action: formData.get('resolved_action'),
      staff_note: formData.get('staff_note') || undefined
    });
    if (!parsed.success) return fail(400, { action: 'resolveEvent', errors: parsed.error.flatten().fieldErrors });
    try {
      const roll = await locals.pb.collection('instability_rolls').getOne(parsed.data.roll_id);
      // Verify roll belongs to this node — prevents resolving a roll from a different node page
      if ((roll as { node?: string }).node !== params.id) {
        return fail(400, { action: 'resolveEvent', errors: { _global: ['Roll does not belong to this node.'] } });
      }
      await locals.pb.collection('instability_rolls').update(parsed.data.roll_id, {
        resolved: true,
        resolved_action: parsed.data.resolved_action,
        staff_note: parsed.data.staff_note ?? ''
      });
      // Side effects per action
      if (parsed.data.resolved_action === 'apply_instability') {
        const node = await locals.pb.collection('nodes').getOne(params.id);
        const cur = (node as { instability?: number }).instability ?? 0;
        const add = (roll as { instab_add?: number }).instab_add ?? 1;
        await locals.pb.collection('nodes').update(params.id, {
          instability: Math.min(5, cur + add),
          roll_due: false
        });
      } else if (parsed.data.resolved_action === 'log_sp_debt') {
        const spCost = (roll as { sp_cost?: number }).sp_cost ?? 0;
        if (spCost > 0) {
          const submittedBy = (locals.pb.authStore.record as { id?: string } | null)?.id;
          await locals.pb.collection('submissions').create({
            node: params.id,
            item: '',
            item_name: `Event SP Debt — ${(roll as { event_name?: string }).event_name ?? 'Event'}`,
            category: 'special',
            qty: 1,
            sp_value: spCost,
            submission_type: 'upkeep',
            staff_note: `Auto-logged from instability event`,
            submitted_by: submittedBy ?? ''
          }).catch(() => null);
        }
        await locals.pb.collection('nodes').update(params.id, { roll_due: false });
      } else {
        // mark_output_penalty, mark_rp_handled, dismiss → just clear roll_due
        await locals.pb.collection('nodes').update(params.id, { roll_due: false });
      }
    } catch {
      return fail(500, { action: 'resolveEvent', errors: { _global: ['Failed to resolve event.'] } });
    }
    return { success: true, action: 'resolveEvent' };
  },

  deleteCycleHistory: async ({ request, locals, params }) => {
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, { action: 'deleteCycleHistory', errors: { _global: ['Head Admin access required.'] } });
    }
    const formData = await request.formData();
    const parsed = deleteCycleHistorySchema.safeParse({ id: formData.get('id') });
    if (!parsed.success) {
      return fail(400, { action: 'deleteCycleHistory', errors: { _global: ['Invalid request.'] } });
    }
    // Verify record belongs to this node
    try {
      const rec = await locals.pb.collection('submission_history').getOne(parsed.data.id, { fields: 'id,node' });
      if ((rec as { node: string }).node !== params.id) {
        return fail(400, { action: 'deleteCycleHistory', errors: { _global: ['Record does not belong to this node.'] } });
      }
    } catch {
      return fail(400, { action: 'deleteCycleHistory', errors: { _global: ['Record not found.'] } });
    }
    try {
      await locals.pb.collection('submission_history').delete(parsed.data.id);
    } catch {
      return fail(500, { action: 'deleteCycleHistory', errors: { _global: ['Failed to delete cycle history.'] } });
    }
    return { success: true, action: 'deleteCycleHistory' };
  },

  deleteNodeLogEntry: async ({ request, locals, params }) => {
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, { action: 'deleteNodeLogEntry', errors: { _global: ['Head Admin access required.'] } });
    }
    const formData = await request.formData();
    const parsed = deleteNodeLogEntrySchema.safeParse({ id: formData.get('id') });
    if (!parsed.success) {
      return fail(400, { action: 'deleteNodeLogEntry', errors: { _global: ['Invalid request.'] } });
    }
    // Verify the log entry belongs to this node
    try {
      const entry = await locals.pb.collection('server_log').getOne(parsed.data.id, { fields: 'id,related_node' });
      if ((entry as { related_node: string }).related_node !== params.id) {
        return fail(400, { action: 'deleteNodeLogEntry', errors: { _global: ['Entry does not belong to this node.'] } });
      }
    } catch {
      return fail(400, { action: 'deleteNodeLogEntry', errors: { _global: ['Entry not found.'] } });
    }
    try {
      await locals.pb.collection('server_log').delete(parsed.data.id);
    } catch {
      return fail(500, { action: 'deleteNodeLogEntry', errors: { _global: ['Failed to delete entry.'] } });
    }
    return { success: true, action: 'deleteNodeLogEntry' };
  },

  updateCycleOutcome: async ({ request, locals, params }) => {
    const formData = await request.formData();
    const parsed = updateCycleOutcomeSchema.safeParse({
      id: formData.get('id'),
      outcome: formData.get('outcome')
    });
    if (!parsed.success) {
      return fail(400, { action: 'updateCycleOutcome', errors: parsed.error.flatten().fieldErrors });
    }
    // Verify record belongs to this node
    try {
      const rec = await locals.pb.collection('submission_history').getOne(parsed.data.id, { fields: 'id,node' });
      if ((rec as { node: string }).node !== params.id) {
        return fail(400, { action: 'updateCycleOutcome', errors: { _global: ['Record does not belong to this node.'] } });
      }
    } catch {
      return fail(400, { action: 'updateCycleOutcome', errors: { _global: ['Record not found.'] } });
    }
    try {
      await locals.pb.collection('submission_history').update(parsed.data.id, { outcome: parsed.data.outcome });
    } catch {
      return fail(500, { action: 'updateCycleOutcome', errors: { _global: ['Failed to update outcome.'] } });
    }
    return { success: true, action: 'updateCycleOutcome' };
  },

  confirmCycle: async ({ locals, params }) => {
    let step = 'fetch';
    try {
      const node = await locals.pb.collection('nodes').getOne(params.id);
      const factionId = (node as { owner?: string }).owner ?? '';

      step = 'fetch-related';
      const [submissions, ownerFaction, ownerNodes, ownerWars] = await Promise.all([
        locals.pb.collection('submissions').getFullList({ filter: `node = "${params.id}"` }),
        factionId ? locals.pb.collection('factions').getOne(factionId).catch(() => null) : Promise.resolve(null),
        factionId ? locals.pb.collection('nodes').getFullList({ filter: `owner = "${factionId}"`, fields: 'id' }) : Promise.resolve([]),
        factionId ? locals.pb.collection('wars').getFullList({ filter: `(faction_a = "${factionId}" || faction_b = "${factionId}") && status = "active"`, fields: 'id' }) : Promise.resolve([])
      ]);

      const effectiveUpkeep = calcUpkeep(
        (node as { base_upkeep: number }).base_upkeep,
        ownerNodes.length,
        ownerWars.length,
        (ownerFaction as { type?: 'PvP' | 'PvE' } | null)?.type ?? 'PvE',
        !factionId
      );

      const paidSP = (submissions as { submission_type: string; sp_value: number }[])
        .filter(s => s.submission_type === 'upkeep')
        .reduce((sum, s) => sum + s.sp_value, 0);

      const paymentPct = effectiveUpkeep > 0 ? paidSP / effectiveUpkeep : 1;
      let outcome: string;
      let instabDelta: number;
      if (paymentPct >= 1)       { outcome = 'paid';        instabDelta = 0; }
      else if (paymentPct >= 0.5){ outcome = 'partial';     instabDelta = 1; }
      else if (paymentPct > 0)   { outcome = 'underfunded'; instabDelta = 2; }
      else                       { outcome = 'unpaid';      instabDelta = 2; }

      const actor = (locals.pb.authStore.record as { username?: string } | null)?.username ?? '';

      // Build snapshot of items pushed this cycle for the history viewer
      const snapshotItems = (submissions as { item_name: string; category: string; qty: number; sp_value: number; submission_type: string; staff_note: string }[])
        .map(s => ({
          item_name: s.item_name,
          category: s.category,
          qty: s.qty,
          sp_value: s.sp_value,
          submission_type: s.submission_type,
          staff_note: s.staff_note ?? ''
        }));

      step = 'create-history';
      await locals.pb.collection('submission_history').create({
        node: params.id,
        deadline_ts: new Date().toISOString(),
        paid_sp: paidSP,
        required_sp: effectiveUpkeep,
        outcome,
        instab_delta: instabDelta,
        snapshot: snapshotItems
      });

      step = 'update-instability';
      if (instabDelta > 0) {
        const curInstab = (node as { instability?: number }).instability ?? 0;
        const newInstab = Math.min(5, curInstab + instabDelta);
        await locals.pb.collection('nodes').update(params.id, { instability: newInstab, roll_due: newInstab > 0 });
      }

      // Apply upgrade tier bump — validate that the upgrade submission matches the CURRENT tier
      // to prevent stale subs from jumping tiers unexpectedly
      step = 'update-tier';
      const STANDARD_BASE_UPKEEP: Record<number, number> = { 1: 40, 2: 80, 3: 160, 4: 240 };
      const curTier = (node as { tier?: number }).tier ?? 1;
      const validUpgrade = (submissions as { submission_type: string; item_name: string }[])
        .find(s => s.submission_type === 'upgrade' && s.item_name === `Upgrade — T${curTier} → T${Number(curTier) + 1}`);
      if (validUpgrade) {
        const newTier = Math.min(4, curTier + 1);
        await locals.pb.collection('nodes').update(params.id, {
          tier: newTier,
          base_upkeep: STANDARD_BASE_UPKEEP[newTier] ?? (node as { base_upkeep?: number }).base_upkeep
        });
      }

      step = 'delete-submissions';
      for (const sub of submissions as { id: string }[]) {
        await locals.pb.collection('submissions').delete(sub.id).catch(() => null);
      }
      // Second-pass cleanup: catch any submissions that slipped through (e.g., created
      // concurrently while confirmCycle was running). This makes the delete idempotent.
      step = 'delete-submissions-cleanup';
      const remaining = await locals.pb.collection('submissions').getFullList({
        filter: `node = "${params.id}"`,
        fields: 'id'
      }).catch(() => []);
      for (const sub of remaining as { id: string }[]) {
        await locals.pb.collection('submissions').delete(sub.id).catch(() => null);
      }

      step = 'create-log';
      const tierNote = validUpgrade ? ` — tier upgraded to T${Math.min(4, curTier + 1)}` : '';
      await locals.pb.collection('server_log').create({
        event_type: 'cycle_confirmed',
        description: `Upkeep cycle confirmed — ${paidSP}/${effectiveUpkeep} SP paid (${outcome})${instabDelta > 0 ? ` — instability +${instabDelta}` : ''}${tierNote}`,
        actor,
        related_node: params.id
      });
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : String(e);
      // Expose PocketBase validation details if available
      if (e && typeof e === 'object') {
        const pb = e as { status?: number; data?: unknown; response?: { data?: unknown } };
        if (pb.data) msg += ' | ' + JSON.stringify(pb.data);
        else if (pb.response?.data) msg += ' | ' + JSON.stringify(pb.response.data);
        if (pb.status) msg += ` (HTTP ${pb.status})`;
      }
      return fail(500, { action: 'confirmCycle', errors: { _global: [`[${step}] ${msg}`] } });
    }
    redirect(303, `/nodes/${params.id}`);
  }
};
