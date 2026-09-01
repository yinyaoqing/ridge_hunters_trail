import { describe, it, expect } from 'vitest';
import { generateLevel, generateLevelFor } from '../src/core/generate';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key, intersect } from '../src/core/clues';
import { dist, angleDiff, angleDeg } from '../src/core/geometry';
import { CREATURES } from '../src/data/creatures';
import { applyQuirk } from '../src/core/quirks';
import { applyWeather } from '../src/core/weather';

describe('generateLevel (property tests over 200 seeds)', () => {
  const cases = Array.from({ length: 200 }, (_, i) => ({
    seed: i * 7 + 1,
    round: (i % 10) + 1, // 涵蓋三個難度 tier
  }));

  it('target is always inside the intersection of real clues (solvable)', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      const real = level.clues.filter((c) => !c.isDecoy);
      expect(intersect(real, level.mapSize).has(key(level.targetPos))).toBe(true);
    }
  });

  it('intersection converges below cap (or hits the extra-clue safety limit)', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      const real = level.clues.filter((c) => !c.isDecoy);
      const size = intersect(real, level.mapSize).size;
      expect(size <= p.maxIntersection || real.length >= p.clueCount + 5).toBe(true);
    }
  });

  it('decoy count matches difficulty and decoys sit far from target', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      const decoys = level.clues.filter((c) => c.isDecoy);
      const pq = applyQuirk(p, level.creatureId);
      expect(decoys.length).toBe(pq.decoyCount);
    }
  });

  it('map, terrain, supplies and creature are consistent', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      expect(level.mapSize).toBe(p.mapSize);
      expect(level.terrain.length).toBe(p.mapSize);
      expect(level.terrain[0].length).toBe(p.mapSize);
      const creature = CREATURES.find((c) => c.id === level.creatureId);
      expect(creature).toBeDefined();
      expect(level.terrain[level.targetPos.y][level.targetPos.x]).toBe(creature!.terrain);
      const pq = applyQuirk(p, level.creatureId);
      expect(level.supplies.length).toBeLessThanOrEqual(pq.supplyCount);
      for (const s of level.supplies) {
        expect(key(s)).not.toBe(key(level.targetPos));
      }
    }
  });

  it('same seed reproduces the same level', () => {
    const a = generateLevel(5, mulberry32(99));
    const b = generateLevel(5, mulberry32(99));
    expect(a).toEqual(b);
  });

  it('every clue position differs from its anchor evidence: no clue on top of target', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues.filter((c) => !c.isDecoy)) {
        expect(key(c.position)).not.toBe(key(level.targetPos));
      }
    }
  });

  it('generateLevelFor applies creature quirks end-to-end', () => {
    const a = generateLevelFor(5, mulberry32(7), 'dewhopper');
    const b = generateLevelFor(5, mulberry32(7), 'mistfawn');
    expect(a.supplies.length).toBeLessThanOrEqual(getDifficulty(5).supplyCount + 2);
    const scent = b.clues.find((c) => c.type === 'scent' && !c.isDecoy);
    if (scent && scent.type === 'scent') {
      expect(scent.data.tolerance).toBeCloseTo(
        applyWeather(applyQuirk(getDifficulty(5), 'mistfawn'), b.weather).scentTolerance,
      );
    }
  });

  it('every level has a weather drawn from the known pool', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      expect(['clear', 'mist', 'wind', 'drizzle']).toContain(level.weather);
    }
  });

  it('scent clues carry a bias within 30° of the true bearing', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues) {
        if (c.type !== 'scent') continue;
        expect(c.data.windBiasNeeded).toBe(true);
        expect(c.data.biasDirection).toBeGreaterThanOrEqual(0);
        expect(c.data.biasDirection).toBeLessThan(360);
      }
    }
  });

  it('scent bias points within 30° of the true bearing from clue to target', () => {
    // 舊版只試 seed=1，若該 seed 剛好沒生出非幌子氣味線索，assertion 就被 if 悄悄跳過
    // （測試恆為綠燈，等於沒測到）。改為掃過 seed 1..50，找到第一個有非幌子氣味線索的
    // level 才斷言，並用 expect(found).toBe(true) 強制斷言必然執行，不會靜默通過。
    let found = false;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const level = generateLevelFor(5, mulberry32(seed), 'mistfawn');
      const scent = level.clues.find((c) => c.type === 'scent' && !c.isDecoy);
      if (scent && scent.type === 'scent') {
        found = true;
        const trueBearing = angleDeg(scent.position, level.targetPos);
        expect(angleDiff(scent.data.biasDirection, trueBearing)).toBeLessThanOrEqual(30);
      }
    }
    expect(found).toBe(true);
  });
});
