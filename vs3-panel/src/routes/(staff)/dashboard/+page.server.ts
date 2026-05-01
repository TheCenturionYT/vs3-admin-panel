import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const [factions, nodes, wars] = await Promise.all([
    locals.pb.collection('factions').getFullList({ sort: 'name' }),
    locals.pb.collection('nodes').getFullList({ expand: 'owner' }),
    locals.pb.collection('wars').getFullList({
      filter: 'status = "active"',
      expand: 'faction_a,faction_b',
      sort: '-start_date'
    })
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

  return {
    factionCount,
    nodeCount,
    activeWarCount,
    unstableNodes,
    activeWars
  };
};
