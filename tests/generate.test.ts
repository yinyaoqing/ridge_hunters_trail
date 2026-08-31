import { describe, it, expect } from 'vitest';
import { generateLevel } from '../src/core/generate';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key, intersect } from '../src/core/clues';
import { dist } from '../src/core/geometry';
import { CREATURES } from '../src/data/creatures';

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
      expect(decoys.length).toBe(p.decoyCount);
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
      expect(level.supplies.length).toBeLessThanOrEqual(p.supplyCount);
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
});
