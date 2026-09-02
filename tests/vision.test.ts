import { describe, it, expect } from 'vitest';
import { visionRadius, cellsWithin, BASE_VISION } from '../src/core/vision';
import { TERRAIN_TYPES } from '../src/core/types';

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

  it('never returns less than two cells for any terrain or elevation', () => {
    // 視野下限 Math.max(2, r) 目前無法觸發（BASE_VISION=3，唯一懲罰-1），
    // 但留存作為未來防禦——第6、7階段將加入氣候和生物懲罰，可能突破現有上限。
    for (const terrain of TERRAIN_TYPES) {
      for (let elevation = 0; elevation <= 1; elevation += 0.05) {
        expect(visionRadius(terrain, elevation)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('grows gradually with elevation, not as a step function', () => {
    // 若改為簡單的 "elevation >= 0.5 則 +2" 階級函數，下列三個高度都會回傳 5，測試會失敗。
    // 驗證公式確實按 (elevation - 0.5) * 8 階梯式縮放，而非平坦 +2。
    expect(visionRadius('meadow', 0.6)).toBe(3);   // floor(0.1*8) = 0, no bonus
    expect(visionRadius('meadow', 0.65)).toBe(4);  // floor(0.15*8) = 1, +1 bonus
    expect(visionRadius('meadow', 0.75)).toBe(5);  // floor(0.25*8) = 2, capped at +2
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
