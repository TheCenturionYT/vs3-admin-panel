import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const [submissionHistory, factions, nodes] = await Promise.all([
    locals.pb.collection('submission_history').getFullList({
      sort: '-deadline_ts',
      fields: 'id,node,deadline_ts,paid_sp,required_sp,outcome,instab_delta,snapshot,created'
    }).catch(() => [] as Array<{
      id: string; node: string; deadline_ts: string; paid_sp: number;
      required_sp: number; outcome: string; instab_delta: number;
      snapshot: string; created: string;
    }>),
    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name,color,type'
    }).catch(() => [] as Array<{ id: string; name: string; color: string; type: 'PvP' | 'PvE' }>),
    locals.pb.collection('nodes').getFullList({
      sort: 'name',
      fields: 'id,name,type,tier,owner'
    }).catch(() => [] as Array<{ id: string; name: string; type: string; tier: number; owner: string }>)
  ]);

  return { submissionHistory, factions, nodes };
};
