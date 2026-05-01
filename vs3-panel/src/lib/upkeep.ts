/**
 * upkeep.ts — Pure upkeep formula functions for VS3 Admin Panel.
 *
 * Ported directly from Admin Panel/VS3_Panel_1_2_1.html (oemul, wmul, calcUp).
 * Do NOT re-derive from handbook prose — the v1 JS is the authoritative source.
 *
 * IMPORTANT: Never store the result of calcUpkeep in the database.
 * Always recalculate at read time from live faction/war state.
 */

/**
 * Overextension multiplier based on number of nodes owned by a faction.
 * Source: v1 oemul() — n<=1→1, 2→1.1, 3→1.2, 4→1.35, 5+→1.5
 */
export function overextensionMul(nodeCount: number): number {
  if (nodeCount <= 1) return 1.0;
  if (nodeCount === 2) return 1.1;
  if (nodeCount === 3) return 1.2;
  if (nodeCount === 4) return 1.35;
  return 1.5;
}

/**
 * War modifier multiplier for a faction's active war count.
 * PvE factions always return 0 regardless of war count.
 * Source: v1 wmul() — 0→0, 1→0.15, 2→0.3, 3+→0.5
 */
export function warMul(warCount: number, factionType: 'PvP' | 'PvE'): number {
  if (factionType === 'PvE') return 0;
  if (warCount === 0) return 0;
  if (warCount === 1) return 0.15;
  if (warCount === 2) return 0.3;
  return 0.5;
}

/**
 * Calculate effective weekly upkeep for a node.
 *
 * Formula: Math.ceil(baseUpkeep × overextensionMul(nodeCount) × (1 + warMul(warCount, factionType)))
 *
 * Passthrough conditions (return baseUpkeep unchanged):
 * - isNeutral is true (Neutral Territory nodes have no faction upkeep scaling)
 * - baseUpkeep is 0 or falsy
 *
 * Source: v1 calcUp() logic.
 */
export function calcUpkeep(
  baseUpkeep: number,
  nodeCount: number,
  warCount: number,
  factionType: 'PvP' | 'PvE',
  isNeutral: boolean
): number {
  if (isNeutral || !baseUpkeep) return baseUpkeep;
  return Math.ceil(baseUpkeep * overextensionMul(nodeCount) * (1 + warMul(warCount, factionType)));
}
