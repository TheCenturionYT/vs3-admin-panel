import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { calcUpkeep } from '$lib/upkeep';

export const load: PageServerLoad = async ({ locals }) => {
  const [factions, nodes, wars, jobRunList, deadlineConfigList, allSubmissions, cycleHistory, spCatalogue] = await Promise.all([
    locals.pb.collection('factions').getFullList({ sort: 'name' }),
    locals.pb.collection('nodes').getFullList({ expand: 'owner' }),
    locals.pb.collection('wars').getFullList({
      filter: 'status = "active"',
      expand: 'faction_a,faction_b',
      sort: '-start_date'
    }),
    locals.pb.collection('job_run_log').getList(1, 1, {
      filter: 'type = "upkeep_deadline_processor"',
      sort: '-created'
    }).catch(() => ({ items: [] as Array<{ created: string; status: string; details: string }> })),
    locals.pb.collection('deadline_config').getList(1, 1, {})
      .catch(() => ({ items: [] as Array<Record<string, unknown>> })),
    locals.pb.collection('submissions').getFullList({
      fields: 'id,node,sp_value,category,submission_type'
    }).catch(() => [] as Array<{ node: string; sp_value: number; category: string; submission_type: string }>),
    // Fetch last-cycle history for all nodes — needed to show correct paid status
    // after confirmCycle clears in-flight submissions (same fallback logic as portal).
    locals.pb.collection('submission_history').getFullList({
      sort: '-deadline_ts',
      fields: 'node,outcome,paid_sp,required_sp'
    }).catch(() => [] as Array<{ node: string; outcome: string; paid_sp: number; required_sp: number }>),
    locals.pb.collection('sp_catalogue').getFullList({
      sort: 'category,name',
      fields: 'id,name,category,sp_value'
    }).catch(() => [] as Array<{ id: string; name: string; category: string; sp_value: number }>)
  ]);

  const factionCount = factions.length;
  const nodeCount = nodes.length;
  const activeWarCount = wars.length;

  const unstableNodes = nodes
    .filter(n => (n.instability as number) > 0)
    .sort((a, b) => (b.instability as number) - (a.instability as number))
    .map(n => ({
      id: n.id as string,
      name: n.name as string,
      type: n.type as string,
      tier: n.tier as number,
      instability: n.instability as number,
      owner_name: (n.expand?.owner?.name as string) ?? 'Unowned'
    }));

  const activeWars = wars.map(w => ({
    id: w.id as string,
    faction_a_name: (w.expand?.faction_a?.name as string) ?? '—',
    faction_b_name: (w.expand?.faction_b?.name as string) ?? '—',
    casus_belli: (w.casus_belli as string) ?? '',
    start_date: (w.start_date as string) ?? ''
  }));

  // Scheduler health
  const lastRun = (jobRunList as { items: Array<{ created: string; status: string; details: string }> }).items[0] ?? null;
  const lastRunIso = lastRun?.created ?? null;
  const daysSinceLastRun = lastRunIso
    ? (Date.now() - new Date(lastRunIso).getTime()) / 86_400_000
    : Infinity;
  const schedulerOverdue = daysSinceLastRun > 8;
  const schedulerActive = ((deadlineConfigList as { items: Array<Record<string, unknown>> }).items[0]?.is_active as boolean | undefined) ?? false;

  // Build per-node paid SP totals (upkeep submissions only — repair/upgrade must not
  // reduce the upkeep total) and per-category breakdowns for cap preview.
  const paidByNode = new Map<string, number>();
  const hasSubsByNode = new Set<string>();
  const paidCategoryByNode = new Map<string, { rr: number; c: number }>();
  for (const s of allSubmissions as Array<{ node: string; sp_value: number; category: string; submission_type: string }>) {
    hasSubsByNode.add(s.node);
    // Only upkeep submissions count toward the paid-SP total
    if (s.submission_type === 'upkeep') {
      paidByNode.set(s.node, (paidByNode.get(s.node) ?? 0) + s.sp_value);
    }
    const cur = paidCategoryByNode.get(s.node) ?? { rr: 0, c: 0 };
    if (s.category === 'Raw Renewable') cur.rr += s.sp_value;
    if (s.category === 'Currency') cur.c += s.sp_value;
    paidCategoryByNode.set(s.node, cur);
  }

  // Build last-cycle-per-node map (list is sorted -deadline_ts so first entry wins).
  // Used as fallback when a node has no in-flight submissions (cycle was just pushed).
  const lastCycleByNode = new Map<string, { outcome: string; paid_sp: number; required_sp: number }>();
  for (const h of cycleHistory as Array<{ node: string; outcome: string; paid_sp: number; required_sp: number }>) {
    if (!lastCycleByNode.has(h.node)) {
      lastCycleByNode.set(h.node, { outcome: h.outcome, paid_sp: h.paid_sp, required_sp: h.required_sp });
    }
  }

  // Compute overdue nodes (paid < required, owner != Neutral and != null)
  const factionsById = new Map(factions.map((f: { id: string }) => [f.id, f]));
  const ownerCountByFaction = new Map<string, number>();
  for (const n of nodes) {
    const ownerId = (n as { owner?: string }).owner;
    if (ownerId) ownerCountByFaction.set(ownerId, (ownerCountByFaction.get(ownerId) ?? 0) + 1);
  }
  const warCountByFaction = new Map<string, number>();
  for (const w of wars) {
    const a = (w as { faction_a?: string }).faction_a, b = (w as { faction_b?: string }).faction_b;
    if (a) warCountByFaction.set(a, (warCountByFaction.get(a) ?? 0) + 1);
    if (b) warCountByFaction.set(b, (warCountByFaction.get(b) ?? 0) + 1);
  }
  const neutral = factions.find((f: { name: string }) => f.name === 'Neutral Territory');

  const overdueNodes = nodes
    .filter((n: { owner?: string }) => n.owner && n.owner !== neutral?.id)
    .map((n) => {
      const f = factionsById.get((n as { owner: string }).owner) as { id: string; name: string; type?: 'PvP' | 'PvE'; color?: string } | undefined;
      const eff = calcUpkeep(
        (n as { base_upkeep: number }).base_upkeep,
        ownerCountByFaction.get((n as { owner: string }).owner) ?? 0,
        warCountByFaction.get((n as { owner: string }).owner) ?? 0,
        f?.type ?? 'PvE',
        false
      );
      const nodeId = (n as { id: string }).id;
      const hasCurrent = hasSubsByNode.has(nodeId);
      const lastCycle = lastCycleByNode.get(nodeId) ?? null;

      // Mirror portal fallback logic:
      // - If there are in-flight submissions, use live paid SP (upkeep only).
      // - If no in-flight submissions exist (cycle was just confirmed/cleared),
      //   fall back to the most recent completed cycle record so a freshly-pushed
      //   node doesn't incorrectly appear as overdue.
      let paid: number;
      let required: number;
      if (hasCurrent) {
        paid = paidByNode.get(nodeId) ?? 0;
        required = eff;
      } else if (lastCycle) {
        paid = lastCycle.paid_sp;
        required = lastCycle.required_sp;
      } else {
        paid = 0;
        required = eff;
      }

      const catTotals = paidCategoryByNode.get(nodeId) ?? { rr: 0, c: 0 };
      return {
        node: {
          id: nodeId,
          name: (n as { name: string }).name,
          type: (n as { type: string }).type,
          tier: (n as { tier: number }).tier,
          instability: (n as { instability: number }).instability ?? 0
        },
        paid,
        required,
        rrPaid: catTotals.rr,
        cPaid: catTotals.c,
        faction: f ? { id: f.id, name: f.name, color: f.color ?? null } : null
      };
    })
    .filter(x => x.paid < x.required)
    .sort((a, b) => (a.required > 0 ? a.paid / a.required : 0) - (b.required > 0 ? b.paid / b.required : 0));

  return {
    factionCount,
    nodeCount,
    activeWarCount,
    unstableNodes,
    activeWars,
    schedulerHealth: {
      lastRunIso,
      daysSinceLastRun,
      schedulerOverdue,
      schedulerActive,
      status: lastRun?.status ?? null,
      details: lastRun?.details ?? null
    },
    deadlineConfig: (deadlineConfigList as { items: Array<Record<string, unknown>> }).items[0] ?? null,
    overdueNodes,
    spCatalogue
  };
};

export const actions: Actions = {
  processOverdue: async ({ locals, fetch }) => {
    try {
      const pbUrl = 'http://localhost:8090';
      const token = locals.pb.authStore.token;
      const res = await fetch(`${pbUrl}/api/vs3/process-deadlines`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        return fail(500, { action: 'processOverdue', errors: { _global: ['Bulk processing failed.'] } });
      }
      const data = await res.json();
      return { success: true, action: 'processOverdue', result: data };
    } catch {
      return fail(500, { action: 'processOverdue', errors: { _global: ['Bulk processing failed. Please try again.'] } });
    }
  }
};
