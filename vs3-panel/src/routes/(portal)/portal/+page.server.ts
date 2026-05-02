import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { calcUpkeep } from '$lib/upkeep';

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { user } = await parent();
  const factionId = user.factionId;

  if (!factionId) {
    error(500, 'Faction not found');
  }

  // 4 parallel queries — all via locals.pb (member token, never admin)
  // diplomacy collection uses faction_a / faction_b fields (two-party agreements)
  // nodes use owner field (relation to factions), not a faction field
  const [faction, rawNodes, wars, diplomacyAgreements] = await Promise.all([
    locals.pb.collection('factions').getOne(factionId),
    // Filter: nodes owned by this faction (owner field) — excludes unowned/neutral nodes
    locals.pb.collection('nodes').getFullList({
      filter: 'owner = {:factionId}',
      filterValues: { factionId },
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

  if (!faction) {
    error(500, 'Faction not found');
  }

  // Count active wars involving this faction (for war upkeep modifier)
  const factionWarCount = wars.filter(
    (w) => w.faction_a === factionId || w.faction_b === factionId
  ).length;

  const nodeCount = rawNodes.length;

  // Fetch current-cycle submissions for all faction nodes in one query
  // Used to compute paidSP per node (sum of sp_value from submissions collection)
  let allSubmissions: Array<{ node: string; sp_value: number }> = [];
  if (nodeCount > 0) {
    try {
      const nodeIds = rawNodes.map((n) => `"${n.id}"`).join(',');
      allSubmissions = await locals.pb.collection('submissions').getFullList({
        filter: `node in (${nodeIds})`,
        fields: 'node,sp_value'
      });
    } catch {
      // submissions fetch failure is non-fatal — paidSP will show as 0
      allSubmissions = [];
    }
  }

  // Build a map of nodeId → total paid SP this cycle
  const paidSpByNode = new Map<string, number>();
  for (const sub of allSubmissions) {
    const prev = paidSpByNode.get(sub.node) ?? 0;
    paidSpByNode.set(sub.node, prev + (sub.sp_value as number));
  }

  // Military node tier labels (CLAUDE.md: T1=Watchtower, T2=Outpost, T3=Fort, T4=Bastion)
  const MILITARY_TIER_LABELS: Record<number, string> = {
    1: 'Watchtower', 2: 'Outpost', 3: 'Fort', 4: 'Bastion'
  };

  // Compute effective upkeep and cycle payment status for each node
  const nodes = rawNodes.map((node) => {
    // tier is stored as string select ("1","2","3","4") — parse to number
    const tier = parseInt(node.tier as string, 10) || 1;
    const isMilitary = node.type === 'Military Node';

    const effectiveUpkeep = calcUpkeep(
      (node.base_upkeep as number) ?? 0,
      nodeCount,
      factionWarCount,
      faction.type as 'PvP' | 'PvE',
      false // never neutral — filtered above (owner = factionId excludes unowned nodes)
    );

    const paidSP: number = paidSpByNode.get(node.id as string) ?? 0;
    const requiredSP: number = effectiveUpkeep;
    const paymentPct = requiredSP > 0 ? paidSP / requiredSP : 0;

    let upkeepStatus: 'Paid' | 'Partial' | 'Underfunded' | 'Unpaid';
    if (paymentPct >= 1) upkeepStatus = 'Paid';
    else if (paymentPct >= 0.5) upkeepStatus = 'Partial';
    else if (paymentPct > 0) upkeepStatus = 'Underfunded';
    else upkeepStatus = 'Unpaid';

    const tierLabel = isMilitary ? (MILITARY_TIER_LABELS[tier] ?? '') : '';

    return {
      id: node.id as string,
      name: node.name as string,
      type: node.type as string,
      tier,
      isMilitary,
      tierLabel,
      instability: (node.instability as number) ?? 0,
      upkeepStatus,
      paidSP,
      requiredSP,
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
