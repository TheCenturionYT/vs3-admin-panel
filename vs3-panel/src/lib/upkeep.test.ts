import { describe, it, expect } from 'vitest';
import { overextensionMul, warMul, calcUpkeep } from './upkeep';

describe('overextensionMul', () => {
  it('returns 1.0 for 0 nodes', () => {
    expect(overextensionMul(0)).toBe(1.0);
  });
  it('returns 1.0 for 1 node', () => {
    expect(overextensionMul(1)).toBe(1.0);
  });
  it('returns 1.1 for 2 nodes', () => {
    expect(overextensionMul(2)).toBe(1.1);
  });
  it('returns 1.2 for 3 nodes', () => {
    expect(overextensionMul(3)).toBe(1.2);
  });
  it('returns 1.35 for 4 nodes', () => {
    expect(overextensionMul(4)).toBe(1.35);
  });
  it('returns 1.5 for 5 nodes', () => {
    expect(overextensionMul(5)).toBe(1.5);
  });
  it('returns 1.5 for 10 nodes (5+ cap)', () => {
    expect(overextensionMul(10)).toBe(1.5);
  });
});

describe('warMul', () => {
  it('returns 0 for 0 PvP wars', () => {
    expect(warMul(0, 'PvP')).toBe(0);
  });
  it('returns 0.15 for 1 PvP war', () => {
    expect(warMul(1, 'PvP')).toBe(0.15);
  });
  it('returns 0.30 for 2 PvP wars', () => {
    expect(warMul(2, 'PvP')).toBe(0.30);
  });
  it('returns 0.50 for 3 PvP wars', () => {
    expect(warMul(3, 'PvP')).toBe(0.50);
  });
  it('returns 0.50 for 5 PvP wars (3+ cap)', () => {
    expect(warMul(5, 'PvP')).toBe(0.50);
  });
  it('returns 0 for 0 PvE wars', () => {
    expect(warMul(0, 'PvE')).toBe(0);
  });
  it('returns 0 for 3 PvE wars (PvE always 0)', () => {
    expect(warMul(3, 'PvE')).toBe(0);
  });
});

describe('calcUpkeep', () => {
  it('T1 faction, 1 node, no wars => 40', () => {
    expect(calcUpkeep(40, 1, 0, 'PvP', false)).toBe(40);
  });
  it('T2 faction, 2 nodes, no wars => 88 (ceil(80 * 1.1 * 1.0))', () => {
    expect(calcUpkeep(80, 2, 0, 'PvP', false)).toBe(88);
  });
  it('T3 faction, 3 nodes, 1 war => 221 (ceil(160 * 1.2 * 1.15))', () => {
    expect(calcUpkeep(160, 3, 1, 'PvP', false)).toBe(221);
  });
  it('PvE ignores wars: 3 nodes, 2 wars => 48 (ceil(40 * 1.2 * 1.0))', () => {
    expect(calcUpkeep(40, 3, 2, 'PvE', false)).toBe(48);
  });
  it('Neutral Territory passthrough: isNeutral=true => base returned as-is', () => {
    expect(calcUpkeep(40, 1, 0, 'PvP', true)).toBe(40);
  });
  it('Zero base upkeep passthrough: returns 0', () => {
    expect(calcUpkeep(0, 3, 2, 'PvP', false)).toBe(0);
  });
});
