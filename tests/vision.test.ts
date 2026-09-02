import { describe, it, expect } from 'vitest';
import { visionRadius, cellsWithin, BASE_VISION } from '../src/core/vision';

describe('visionRadius', () => {
  it('uses the base radius on flat open ground', () => {
    expect(visionRadius('meadow', 0.2)).toBe(BASE_VISION);
  });

  it('sees further from high ground', () => {
    expect(visionRadius('rock', 0.9)).toBeGreaterThan(visionRadius('meadow', 0.2));
  });

  it('caps the high-ground bonus', () => {
    expect(visionRadius('rock', 1)).toBe(BASE_VISION + 2);
  });

  it('closes in inside a thicket', () => {
    expect(visionRadius('thicket', 0.45)).toBe(BASE_VISION - 1);
  });

  it('never drops below two cells, even in a high thicket', () => {
    expect(visionRadius('thicket', 0)).toBeGreaterThanOrEqual(2);
  });
});

describe('cellsWithin', () => {
  it('returns a chebyshev square clipped to the map', () => {
    const cells = cellsWithin({ x: 0, y: 0 }, 1, 5);
    expect(cells.sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('includes the centre itself', () => {
    expect(cellsWithin({ x: 3, y: 3 }, 0, 8)).toEqual(['3,3']);
  });

  it('covers (2r+1)^2 cells when fully inside the map', () => {
    expect(cellsWithin({ x: 5, y: 5 }, 2, 20)).toHaveLength(25);
  });

  it('never returns out-of-bounds keys', () => {
    for (const k of cellsWithin({ x: 9, y: 9 }, 3, 10)) {
      const [x, y] = k.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(10);
      expect(y).toBeLessThan(10);
    }
  });
});
