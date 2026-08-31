import { describe, it, expect } from 'vitest';
import { mulberry32, randInt, pickWeighted } from '../src/core/rng';

describe('mulberry32', () => {
  it('same seed produces same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('values are in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt', () => {
  it('stays within inclusive bounds and hits both ends', () => {
    const rng = mulberry32(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = randInt(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });
});

describe('pickWeighted', () => {
  it('never picks zero-weight items', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      expect(pickWeighted(rng, [['a', 1], ['b', 0]])).toBe('a');
    }
  });
});
