import { describe, it, expect } from 'vitest';
import { applyQuirk, terrainPoolFor } from '../src/core/quirks';
import { getDifficulty } from '../src/core/difficulty';
import { CREATURES } from '../src/data/creatures';

describe('applyQuirk', () => {
  const base = getDifficulty(5); // tier 2：有 decoy
  it('mistfawn doubles scent tolerance', () => {
    expect(applyQuirk(base, 'mistfawn').scentTolerance).toBe(base.scentTolerance * 2);
  });
  it('emberquill shrinks disturbance radius with floor 1', () => {
    expect(applyQuirk(base, 'emberquill').disturbanceRadius).toBe(Math.max(1, base.disturbanceRadius - 1));
  });
  it('thicketloom halves footprint spread with floor 6', () => {
    expect(applyQuirk(base, 'thicketloom').footprintSpread).toBe(Math.max(6, Math.round(base.footprintSpread / 2)));
  });
  it('dewhopper adds two supplies', () => {
    expect(applyQuirk(base, 'dewhopper').supplyCount).toBe(base.supplyCount + 2);
  });
  it('veilmoth adds a decoy only when decoys exist', () => {
    expect(applyQuirk(base, 'veilmoth').decoyCount).toBe(base.decoyCount + 1);
    const t1 = getDifficulty(1);
    expect(applyQuirk(t1, 'veilmoth').decoyCount).toBe(0);
  });
  it('lanternshrew tightens clue distance with floors', () => {
    const q = applyQuirk(base, 'lanternshrew');
    expect(q.minClueDist).toBe(Math.max(2, base.minClueDist - 1));
    expect(q.maxClueDist).toBe(Math.max(4, base.maxClueDist - 2));
  });
  it('plumetail widens clue distance', () => {
    const q = applyQuirk(base, 'plumetail');
    expect(q.minClueDist).toBe(base.minClueDist + 1);
    expect(q.maxClueDist).toBe(base.maxClueDist + 2);
  });
  it('unknown id and ridgecrest leave params unchanged', () => {
    expect(applyQuirk(base, 'nobody')).toEqual(base);
    expect(applyQuirk(base, 'ridgecrest')).toEqual(base);
  });
  it('never mutates the input', () => {
    const before = JSON.stringify(base);
    applyQuirk(base, 'mistfawn');
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('terrainPoolFor', () => {
  it('ridgecrest triples rock weight; others use the base pool', () => {
    const rock = (pool: [string, number][]) => pool.find(([t]) => t === 'rock')![1];
    expect(rock(terrainPoolFor('ridgecrest'))).toBe(3);
    expect(rock(terrainPoolFor('mistfawn'))).toBe(1);
  });
});

describe('quirk hints', () => {
  it('every creature has bilingual quirk hints', () => {
    for (const c of CREATURES) {
      expect(c.quirkHints.en.length).toBeGreaterThan(0);
      expect(c.quirkHints['zh-TW'].length).toBeGreaterThan(0);
    }
  });
});
