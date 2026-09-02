import { describe, it, expect } from 'vitest';
import { getDifficulty } from '../src/core/difficulty';

describe('getDifficulty follows spec 4.5 table', () => {
  it('rounds 1-3: 15x15, 4 clues, 0 decoys, max intersection 15', () => {
    for (const r of [1, 2, 3]) {
      const p = getDifficulty(r);
      expect(p.mapSize).toBe(15);
      expect(p.clueCount).toBe(4);
      expect(p.decoyCount).toBe(0);
      expect(p.maxIntersection).toBe(15);
      expect(p.typeRatio).toEqual({ footprint: 60, disturbance: 30, scent: 10 });
    }
  });

  it('rounds 4-7: 20x20, 5 clues, 1 decoy, max intersection 8', () => {
    for (const r of [4, 7]) {
      const p = getDifficulty(r);
      expect(p.mapSize).toBe(20);
      expect(p.clueCount).toBe(5);
      expect(p.decoyCount).toBe(1);
      expect(p.maxIntersection).toBe(8);
      expect(p.typeRatio).toEqual({ footprint: 40, disturbance: 35, scent: 25 });
    }
  });

  it('rounds 8+: 25x25, 6 clues, 2 decoys, max intersection 4', () => {
    for (const r of [8, 20, 100]) {
      const p = getDifficulty(r);
      expect(p.mapSize).toBe(25);
      expect(p.clueCount).toBe(6);
      expect(p.decoyCount).toBe(2);
      expect(p.maxIntersection).toBe(4);
      expect(p.typeRatio).toEqual({ footprint: 20, disturbance: 30, scent: 50 });
    }
  });

  it('error/range shrinks as difficulty rises', () => {
    const [t1, t2, t3] = [getDifficulty(1), getDifficulty(4), getDifficulty(8)];
    expect(t1.footprintSpread).toBeGreaterThan(t2.footprintSpread);
    expect(t2.footprintSpread).toBeGreaterThan(t3.footprintSpread);
    expect(t1.scentTolerance).toBeGreaterThan(t3.scentTolerance);
    expect(t1.qte.arcSize).toBeGreaterThan(t3.qte.arcSize);
    expect(t1.qte.speed).toBeLessThan(t3.qte.speed);
  });
});

describe('stamina budget vs terrain cost', () => {
  it('stays within a sane step range for its tier', () => {
    // 新地形分布的加權平均成本約 1.6/步（草地霧谷 1、密叢 2、岩坡 4）。
    // 預算除以平均成本應落在「夠走完一趟推理、但不夠亂走」的區間。
    for (const round of [1, 5, 9]) {
      const steps = getDifficulty(round).staminaBudget / 1.6;
      expect(steps).toBeGreaterThan(30);
      expect(steps).toBeLessThan(90);
    }
  });

  it('grows monotonically with the difficulty tiers', () => {
    expect(getDifficulty(1).staminaBudget).toBeLessThan(getDifficulty(5).staminaBudget);
    expect(getDifficulty(5).staminaBudget).toBeLessThan(getDifficulty(9).staminaBudget);
  });
});
