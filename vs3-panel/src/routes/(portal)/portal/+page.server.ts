import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { calcUpkeep } from '$lib/upkeep';

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { user } = await parent();
  const factionId = user.factionId;

  if (!factionId) {
    error(500, 'Faction not found');
  }

  // Fetch faction first — getOne throws on missing record, never returns null
  let faction;
  try {
    faction = await locals.pb.collection('factions').getOne(factionId);
  } catch {
    error(500, 'Faction not found');
  }

  // 3 parallel queries — all via locals.pb (member token, never admin)
  // diplomacy collection uses faction_a / faction_b fields (two-party agreements)
  // nodes use owner field (relation to factions), not a faction field
  const [rawNodes, wars, diplomacyAgreements] = await Promise.all([
    // Filter: nodes owned by this faction (owner field) — excludes unowned/neutral nodes
    locals.pb.collection('nodes').getFullList({
      filter: `owner = "${factionId}"`,
      sort: 'name'
    }),
    // Wars: all active wars — global board (T-04-04: accepted, intentional)
    locals.pb.collection('wars').getFullList({
      filter: 'status = "active"',
      expand: 'faction_a,faction_b',
      sort: '-created'
    }),
    // Diplomacy: all active agreements — global board (T-04-04: accepted, intentional)
    locals.pb.collection('diplomacy').getFullList({
      filter: 'status = "active"',
      expand: 'faction_a,faction_b',
      sort: '-start_date'
    })
  ]);

  // Count active wars involving this faction (for war upkeep modifier)
  const factionWarCount = wars.filter(
    (w) => w.faction_a === factionId || w.faction_b === factionId
  ).length;

  const nodeCount = rawNodes.length;

  // Build filter helpers for all faction nodes
  const nodeFilterParts = rawNodes.map((n, i) => `node = {:nid${i}}`).join(' || ');
  const nodeFilterValues = Object.fromEntries(rawNodes.map((n, i) => [`nid${i}`, n.id]));

  // Fetch current-cycle submissions (upkeep type only) and last cycle history in parallel.
  // submission_history.listRule now includes member access (migration 1777900005).
  let allSubmissions: Array<{ node: string; sp_value: number; submission_type: string }> = [];
  let lastCycleByNode: Record<string, { outcome: string; paid_sp: number; required_sp: number }> = {};

  if (nodeCount > 0) {
    const [subResult, histResult] = await Promise.allSettled([
      locals.pb.collection('submissions').getFullList({
        filter: nodeFilterParts,
        filterValues: nodeFilterValues,
        fields: 'node,sp_value,submission_type'
      }),
      locals.pb.collection('submission_history').getFullList({
        filter: nodeFilterParts,
        filterValues: nodeFilterValues,
        sort: '-deadline_ts',
        fields: 'node,outcome,paid_sp,required_sp'
      })
    ]);

    if (subResult.status === 'fulfilled') {
      allSubmissions = subResult.value as typeof allSubmissions;
    }

    if (histResult.status === 'fulfilled') {
      // Keep only the most recent cycle per node (list is sorted -deadline_ts)
      for (const h of histResult.value) {
        const nodeId = h.node as string;
        if (!lastCycleByNode[nodeId]) {
          lastCycleByNode[nodeId] = {
            outcome: h.outcome as string,
            paid_sp: h.paid_sp as number,
            required_sp: h.required_sp as number
          };
        }
      }
    }
  }

  // Build a map of nodeId → upkeep-only paid SP this cycle.
  // Only 'upkeep' type submissions count toward the upkeep requirement;
  // repair/upgrade are negative costs that should not reduce the paid SP total.
  const paidSpByNode = new Map<string, number>();
  const hasSubsByNode = new Set<string>();
  for (const sub of allSubmissions) {
    hasSubsByNode.add(sub.node);
    if ((sub.submission_type as string) === 'upkeep') {
      const prev = paidSpByNode.get(sub.node) ?? 0;
      paidSpByNode.set(sub.node, prev + (sub.sp_value as number));
    }
  }

  // Military node tier labels (CLAUDE.md: T1=Watchtower, T2=Outpost, T3=Fort, T4=Bastion)
  const MILITARY_TIER_LABELS: Record<number, string> = {
    1: 'Watchtower', 2: 'Outpost', 3: 'Fort', 4: 'Bastion'
  };

  // Compute effective upkeep and cycle payment status for each node
  const nodes = rawNodes.map((node) => {
    const tier = parseInt(node.tier as string, 10) || 1;
    const isMilitary = node.type === 'Military Node';

    const effectiveUpkeep = calcUpkeep(
      (node.base_upkeep as number) ?? 0,
      nodeCount,
      factionWarCount,
      faction.type as 'PvP' | 'PvE',
      false // never neutral — filtered above (owner = factionId excludes unowned nodes)
    );

    const nodeId = node.id as string;
    const hasCurrentSubs = hasSubsByNode.has(nodeId);
    const paidSP: number = paidSpByNode.get(nodeId) ?? 0;
    const lastCycle = lastCycleByNode[nodeId] ?? null;

    // Paid status: if current-cycle submissions exist, compute from them.
    // If submissions were cleared (cycle was just pushed), fall back to last cycle outcome.
    const requiredSP: number = effectiveUpkeep;
    let upkeepStatus: 'Paid' | 'Partial' | 'Underfunded' | 'Unpaid' | 'N/A';

    if (requiredSP === 0) {
      upkeepStatus = 'N/A';
    } else if (!hasCurrentSubs && lastCycle) {
      // No in-flight submissions — reflect the most recent completed cycle
      const outcome = lastCycle.outcome;
      if (outcome === 'paid') upkeepStatus = 'Paid';
      else if (outcome === 'partial') upkeepStatus = 'Partial';
      else if (outcome === 'underfunded') upkeepStatus = 'Underfunded';
      else upkeepStatus = 'Unpaid';
    } else {
      // In-flight submissions exist — compute live
      const paymentPct = paidSP / requiredSP;
      if (paymentPct >= 1) upkeepStatus = 'Paid';
      else if (paymentPct >= 0.5) upkeepStatus = 'Partial';
      else if (paymentPct > 0) upkeepStatus = 'Underfunded';
      else upkeepStatus = 'Unpaid';
    }

    // Progress bar values — use last cycle if no current subs
    const displayPaid = hasCurrentSubs ? paidSP : (lastCycle?.paid_sp ?? 0);
    const displayRequired = hasCurrentSubs ? requiredSP : (lastCycle?.required_sp ?? requiredSP);
    const paymentPct = displayRequired > 0 ? displayPaid / displayRequired : 0;

    const tierLabel = isMilitary ? (MILITARY_TIER_LABELS[tier] ?? '') : '';

    return {
      id: nodeId,
      name: node.name as string,
      type: node.type as string,
      tier,
      isMilitary,
      tierLabel,
      instability: (node.instability as number) ?? 0,
      upkeepStatus,
      paidSP: displayPaid,
      requiredSP: displayRequired,
      paymentPct
    };
  });

  // Shape wars for portal display
  const warsForPortal = wars.map((w) => ({
    id: w.id as string,
    factionAName: (w.expand?.faction_a?.name ?? w.faction_a) as string,
    factionBName: (w.expand?.faction_b?.name ?? w.faction_b) as string,
    casusBelli: (w.casus_belli ?? '') as string,
    startDate: w.start_date as string
  }));

  // Shape diplomacy agreements for portal display (faction_a / faction_b — two-party model)
  const alliancesForPortal = diplomacyAgreements.map((a) => ({
    id: a.id as string,
    type: a.type as string,
    parties: [
      (a.expand?.faction_a?.name ?? a.faction_a) as string,
      (a.expand?.faction_b?.name ?? a.faction_b) as string
    ].filter(Boolean),
    startDate: a.start_date as string
  }));

  return {
    faction: {
      id: faction.id as string,
      name: faction.name as string,
      type: faction.type as 'PvP' | 'PvE'
    },
    nodes,
    wars: warsForPortal,
    alliances: alliancesForPortal
  };
};
