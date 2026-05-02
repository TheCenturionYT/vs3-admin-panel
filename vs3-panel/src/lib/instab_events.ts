/**
 * instab_events.ts — Instability events table and helper functions for VS3 Admin Panel.
 *
 * Ported directly from Admin Panel/VS3_Panel_1_2_1.html (INSTAB_EVENTS, INSTAB_CHANCE, pickEvent).
 * Do NOT re-derive from handbook prose — the v1 JS is the authoritative source.
 * JSVM scheduler does NOT use this file (TypeScript not importable in JSVM). UI-only.
 *
 * Cross-reference: pb_hooks/scheduler.js has its own copy of INSTAB_CHANCE as a plain JS array.
 * Do not change one without the other.
 */

// === Instability Chance Table ===
// Ported from v1 line 233: const INSTAB_CHANCE=[0,5,15,30,50,75];
// Key = instability level (0–5), Value = percent chance of event roll triggering
export const INSTAB_CHANCE: Record<number, number> = {
  0: 0,
  1: 5,
  2: 15,
  3: 30,
  4: 50,
  5: 75,
};

// === Instability Label Table ===
// Per REQUIREMENTS.md INSTAB-01 labels
export const INSTAB_LABEL: Record<number, string> = {
  0: 'Fully Controlled',
  1: 'Minor Unrest',
  2: 'Growing Disorder',
  3: 'Serious Instability',
  4: 'Near Revolt',
  5: 'Open Rebellion',
};

// === InstabEvent Interface ===
// Mirrors the shape of each entry in v1 INSTAB_EVENTS array (lines 241–319)
export interface InstabEvent {
  name: string;
  desc: string;
  effect: string;
  outputPenalty?: number;
  spCost?: number;
  instabAdd?: number;
  choice?: boolean;
  rp?: boolean;
  node: string;
}

// === Node Type Alias Map ===
// Ported from v1 lines 321–322: const NT_MAP={'Ranch':'Herd / Ranch','Harbor/River Landing':'Harbor / River Landing'};
// Normalizes alternative node type strings to the canonical INSTAB_EVENTS node names.
const NT_MAP: Record<string, string> = {
  'Ranch': 'Herd / Ranch',
  'Harbor/River Landing': 'Harbor / River Landing',
};

// Alias resolver — returns NT_MAP[t] if present, otherwise returns t unchanged.
// Ported from v1 line 322: function ntEvt(t){return NT_MAP[t]||t;}
function ntEvt(t: string): string {
  return NT_MAP[t] ?? t;
}

// === INSTAB_EVENTS Table ===
// Ported verbatim from Admin Panel/VS3_Panel_1_2_1.html lines 241–319.
// 77 entries across 15 node types (~5 each; Military Node has 7).
// Do NOT re-derive descriptions — copy character-for-character from v1.
export const INSTAB_EVENTS: InstabEvent[] = [
  // --- Farm (5 events) ---
  { node: 'Farm', name: 'Blight Patch', desc: 'Crop disease spreads through fields.', effect: '-25% output this cycle.', outputPenalty: 25 },
  { node: 'Farm', name: 'Seed Spoilage', desc: 'Seed stores ruined or depleted.', effect: 'Pay 10 SP or lose one output bundle.', spCost: 10, choice: true },
  { node: 'Farm', name: 'Irrigation Failure', desc: 'Ditches or channels fail.', effect: 'Pay 15 SP or +1 instability.', spCost: 15, instabAdd: 1, choice: true },
  { node: 'Farm', name: 'Granary Fire', desc: 'Stored harvest burns.', effect: 'Lose output this cycle or pay 25 SP.', spCost: 25, outputPenalty: 100, choice: true },
  { node: 'Farm', name: 'Tax Riot', desc: 'Farmers resist collection.', effect: '+1 instability unless 25 SP paid.', instabAdd: 1, spCost: 25, choice: true },

  // --- Herd / Ranch (5 events) ---
  { node: 'Herd / Ranch', name: 'Sick Livestock', desc: 'Animals fall ill.', effect: '-25% output this cycle.', outputPenalty: 25 },
  { node: 'Herd / Ranch', name: 'Stray Herd', desc: 'Livestock scatter.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Herd / Ranch', name: 'Fence Break', desc: 'Containment fails.', effect: 'Pay 10 SP or +1 instability.', spCost: 10, instabAdd: 1, choice: true },
  { node: 'Herd / Ranch', name: 'Predator Raids', desc: 'Predators attack herds.', effect: '-50% output unless defense event.', outputPenalty: 50, rp: true },
  { node: 'Herd / Ranch', name: 'Breeding Loss', desc: 'Herd recovery damaged.', effect: '-25% output for two cycles.', outputPenalty: 25 },

  // --- Orchard (5 events) ---
  { node: 'Orchard', name: 'Early Frost', desc: 'Weather ruins blossoms.', effect: '-25% output this cycle.', outputPenalty: 25 },
  { node: 'Orchard', name: 'Pest Swarm', desc: 'Insects damage trees.', effect: 'Pay 10 SP or -25% output.', spCost: 10, outputPenalty: 25, choice: true },
  { node: 'Orchard', name: 'Rotten Press', desc: 'Processing equipment fails.', effect: 'No processed output unless 15 SP paid.', spCost: 15, outputPenalty: 100, choice: true },
  { node: 'Orchard', name: 'Tree Blight', desc: 'Disease threatens production.', effect: '+1 instability or pay 25 SP.', instabAdd: 1, spCost: 25, choice: true },
  { node: 'Orchard', name: 'Old Grove Collapse', desc: 'Major trees die.', effect: '-50% output and pay 40 SP to clear.', spCost: 40, outputPenalty: 50 },

  // --- Mine (5 events) ---
  { node: 'Mine', name: 'Shaft Collapse', desc: 'A tunnel gives way.', effect: '-25% output until 15 SP repairs.', spCost: 15, outputPenalty: 25 },
  { node: 'Mine', name: 'Bad Air', desc: 'Working face becomes unsafe.', effect: 'Lose one output bundle or pay 10 SP.', spCost: 10, outputPenalty: 100, choice: true },
  { node: 'Mine', name: 'Tool Shortage', desc: 'Broken tools slow production.', effect: '-25% output unless tools submitted.', outputPenalty: 25 },
  { node: 'Mine', name: 'Creature Nest', desc: 'Creatures infest lower levels.', effect: 'No output unless cleared.', outputPenalty: 100, rp: true },
  { node: 'Mine', name: 'Flooded Galleries', desc: 'Water breaches workings.', effect: '-50% output or pay 30 SP.', spCost: 30, outputPenalty: 50, choice: true },

  // --- Quarry (5 events) ---
  { node: 'Quarry', name: 'Loose Face', desc: 'Stone face unstable.', effect: '-25% output or pay 10 SP.', spCost: 10, outputPenalty: 25, choice: true },
  { node: 'Quarry', name: 'Broken Wedges', desc: 'Extraction tools break.', effect: 'Pay 8 SP or lose output bundle.', spCost: 8, outputPenalty: 100, choice: true },
  { node: 'Quarry', name: 'Cart Path Collapse', desc: 'Haul route fails.', effect: 'Pay 15 SP or output trapped.', spCost: 15, outputPenalty: 50, choice: true },
  { node: 'Quarry', name: 'Crane Failure', desc: 'Lifting equipment breaks.', effect: 'Lose output or pay 25 SP.', spCost: 25, outputPenalty: 100, choice: true },
  { node: 'Quarry', name: 'Rockslide', desc: 'Large section collapses.', effect: '-50% output and pay 40 SP.', spCost: 40, outputPenalty: 50 },

  // --- Clay Pit (5 events) ---
  { node: 'Clay Pit', name: 'Pit Flooding', desc: 'Water fills clay works.', effect: '-25% output or pay 8 SP.', spCost: 8, outputPenalty: 25, choice: true },
  { node: 'Clay Pit', name: 'Bad Firing Batch', desc: 'Kiln batch cracks.', effect: 'Lose processed output this cycle.', outputPenalty: 100 },
  { node: 'Clay Pit', name: 'Kiln Collapse', desc: 'Kiln structure fails.', effect: 'No brick output unless 15 SP paid.', spCost: 15, outputPenalty: 100, choice: true },
  { node: 'Clay Pit', name: 'Fuel Shortage', desc: 'Kilns lack fuel.', effect: '-50% output unless fuel submitted.', outputPenalty: 50 },
  { node: 'Clay Pit', name: 'Industrial Fire', desc: 'Kiln fire damages works.', effect: 'No output or pay 40 SP.', spCost: 40, outputPenalty: 100, choice: true },

  // --- Forest (5 events) ---
  { node: 'Forest', name: 'Poachers', desc: 'Illegal cutters strip timber.', effect: '-20% output or resolve patrol event.', outputPenalty: 20, rp: true },
  { node: 'Forest', name: 'Forager Disappearance', desc: 'Workers vanish.', effect: '+1 instability.', instabAdd: 1 },
  { node: 'Forest', name: 'Road Mudout', desc: 'Tracks unusable.', effect: 'Pay 15 SP or output trapped.', spCost: 15, outputPenalty: 50, choice: true },
  { node: 'Forest', name: 'Wildfire', desc: 'Fire damages stands.', effect: '-50% output this cycle.', outputPenalty: 50 },
  { node: 'Forest', name: 'Bandit Camp', desc: 'Outlaws use forest as cover.', effect: 'No output unless cleared.', outputPenalty: 100, rp: true },

  // --- Lumber Mill (5 events) ---
  { node: 'Lumber Mill', name: 'Broken Saw Teeth', desc: 'Machinery wears down.', effect: 'Pay 10 SP or -25% output.', spCost: 10, outputPenalty: 25, choice: true },
  { node: 'Lumber Mill', name: 'Log Jam', desc: 'Timber cannot move.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Lumber Mill', name: 'Belt Failure', desc: 'Drive system snaps.', effect: '-25% output until repaired.', outputPenalty: 25 },
  { node: 'Lumber Mill', name: 'Boiler Crack', desc: 'Major machine damage.', effect: 'Pay 25 SP or -50% output.', spCost: 25, outputPenalty: 50, choice: true },
  { node: 'Lumber Mill', name: 'Mill Fire', desc: 'Fire damages equipment.', effect: '-50% output and 50 SP to restore.', spCost: 50, outputPenalty: 50 },

  // --- Resin Farm (5 events) ---
  { node: 'Resin Farm', name: 'Dry Taps', desc: 'Trees produce poorly.', effect: '-25% output this cycle.', outputPenalty: 25 },
  { node: 'Resin Farm', name: 'Broken Pots', desc: 'Collection vessels break.', effect: 'Pay 8 SP or lose output.', spCost: 8, outputPenalty: 100, choice: true },
  { node: 'Resin Farm', name: 'Tree Scarring', desc: 'Improper tapping harms yield.', effect: '-25% output next cycle.', outputPenalty: 25 },
  { node: 'Resin Farm', name: 'Blighted Grove', desc: 'Resin trees diseased.', effect: '+1 instability or pay 25 SP.', instabAdd: 1, spCost: 25, choice: true },
  { node: 'Resin Farm', name: 'Grove Fire', desc: 'Fire damages trees.', effect: '-50% output and 40 SP.', spCost: 40, outputPenalty: 50 },

  // --- Peat Bog (5 events) ---
  { node: 'Peat Bog', name: 'Bog Flood', desc: 'Extraction pits fill.', effect: '-25% output or pay 8 SP.', spCost: 8, outputPenalty: 25, choice: true },
  { node: 'Peat Bog', name: 'Sinkhole', desc: 'Work area collapses.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Peat Bog', name: 'Midge Fever', desc: 'Workers sick in wet conditions.', effect: '-25% output or pay 15 SP.', spCost: 15, outputPenalty: 25, choice: true },
  { node: 'Peat Bog', name: 'Fuel Spoilage', desc: 'Peat too wet to use.', effect: '-50% output this cycle.', outputPenalty: 50 },
  { node: 'Peat Bog', name: 'Massive Flooding', desc: 'Whole works waterlogged.', effect: 'Node Failing unless 50 SP paid.', spCost: 50 },

  // --- Salt Works (5 events) ---
  { node: 'Salt Works', name: 'Brine Weakening', desc: 'Salt yield drops.', effect: '-25% output this cycle.', outputPenalty: 25 },
  { node: 'Salt Works', name: 'Cracked Pans', desc: 'Evaporation equipment breaks.', effect: 'Pay 10 SP or -25% output.', spCost: 10, outputPenalty: 25, choice: true },
  { node: 'Salt Works', name: 'Impure Batch', desc: 'Salt contaminated.', effect: 'Lose output unless 15 SP paid.', spCost: 15, outputPenalty: 100, choice: true },
  { node: 'Salt Works', name: 'Smuggled Salt', desc: 'Workers sell off-record.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Salt Works', name: 'Works Collapse', desc: 'Major production failure.', effect: 'No output or pay 60 SP.', spCost: 60, outputPenalty: 100, choice: true },

  // --- Workshop (5 events) ---
  { node: 'Workshop', name: 'Missing Parts', desc: 'Small components vanish.', effect: 'Pay 10 SP or -25% output.', spCost: 10, outputPenalty: 25, choice: true },
  { node: 'Workshop', name: 'Bad Batch', desc: 'Production run fails.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Workshop', name: 'Tool Breakage', desc: 'Workshop tools wear out.', effect: '-25% output unless hardware submitted.', outputPenalty: 25 },
  { node: 'Workshop', name: 'Machine Breakdown', desc: 'Key equipment fails.', effect: 'Pay 30 SP or -50% output.', spCost: 30, outputPenalty: 50, choice: true },
  { node: 'Workshop', name: 'Industrial Sabotage', desc: 'Act damages production.', effect: '+1 instability and 50 SP.', instabAdd: 1, spCost: 50 },

  // --- Trade Post (5 events) ---
  { node: 'Trade Post', name: 'Missing Ledger', desc: 'Records vanish.', effect: 'Lose SMD output this cycle.', outputPenalty: 100 },
  { node: 'Trade Post', name: 'Spoiled Goods', desc: 'Shipment rots or breaks.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Trade Post', name: 'Smuggling Ring', desc: 'Untaxed goods bypass tariffs.', effect: '-25% SMD output.', outputPenalty: 25 },
  { node: 'Trade Post', name: 'Merchant Boycott', desc: 'Traders avoid the market.', effect: '-50% SMD output this cycle.', outputPenalty: 50 },
  { node: 'Trade Post', name: 'Bank Panic', desc: 'Confidence collapses.', effect: '+1 instability or pay 40 SMD.', instabAdd: 1, spCost: 4, choice: true },

  // --- Military Node (7 events) ---
  { node: 'Military Node', name: 'Desertion', desc: 'Garrison members slip away.', effect: '+1 instability or lose mil benefit.', instabAdd: 1, rp: true },
  { node: 'Military Node', name: 'Dull Arms', desc: 'Weapons poorly maintained.', effect: 'Pay 15 SP military supplies or lose mil benefit.', spCost: 15, rp: true },
  { node: 'Military Node', name: 'Rotten Stores', desc: 'Food spoils in storage.', effect: 'Submit food goods or +1 instability.', instabAdd: 1, choice: true },
  { node: 'Military Node', name: 'Gate Damage', desc: 'Defensive structure weakened.', effect: 'Pay 25 SP or lose advantage next fight.', spCost: 25, rp: true, choice: true },
  { node: 'Military Node', name: 'Mutiny Plot', desc: 'Officers split the garrison.', effect: '+2 instability unless resolved by RP.', instabAdd: 2, rp: true },
  { node: 'Military Node', name: 'Checkpoint Failure', desc: 'Tolls not being collected.', effect: '-50% SMD output this cycle.', outputPenalty: 50 },
  { node: 'Military Node', name: 'Bastion Panic', desc: 'Garrison hears attack rumors.', effect: 'Node Strained unless 50 SP paid.', spCost: 50 },

  // --- Harbor / River Landing (5 events) ---
  { node: 'Harbor / River Landing', name: 'Broken Dock Planks', desc: 'Docking area unsafe.', effect: 'Pay 10 SP or -25% output.', spCost: 10, outputPenalty: 25, choice: true },
  { node: 'Harbor / River Landing', name: 'Lost Nets', desc: 'River gear lost.', effect: 'Lose one output bundle.', outputPenalty: 100 },
  { node: 'Harbor / River Landing', name: 'Silted Channel', desc: 'Boats struggle to pass.', effect: 'Pay 15 SP or output trapped.', spCost: 15, outputPenalty: 50, choice: true },
  { node: 'Harbor / River Landing', name: 'Dockside Fire', desc: 'Warehouses or boats damaged.', effect: 'Pay 30 SP or -50% output.', spCost: 30, outputPenalty: 50, choice: true },
  { node: 'Harbor / River Landing', name: 'Major Storm Damage', desc: 'Storm wrecks docks.', effect: 'No output or pay 60 SP.', spCost: 60, outputPenalty: 100, choice: true },
];

// === pickEvent ===
// Ported from v1 lines 323–326.
// Filters INSTAB_EVENTS by node type (applying NT_MAP aliases), then picks a random entry.
// Returns null if no events exist for the given node type.
export function pickEvent(nodeType: string): InstabEvent | null {
  const pool = INSTAB_EVENTS.filter(e => e.node === ntEvt(nodeType));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// END OF INSTAB_EVENTS — 77 entries, 15 node types
