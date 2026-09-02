import { describe, it, expect } from 'vitest';
import { terrainFor, buildTerrain } from '../src/core/terrain';
import { mulberry32 } from '../src/core/rng';
import type { TerrainType } from '../src/core/types';

describe('terrainFor', () => {
  it('maps the elevation bands to ridge, treeline and lowland', () => {
    expect(terrainFor(0.95, 0.5)).toBe('cliff');
    expect(terrainFor(0.70, 0.5)).toBe('rock');
    expect(terrainFor(0.50, 0.5)).toBe('thicket');
  });

  it('splits the lowland by moisture — wet valleys hold fog', () => {
    expect(terrainFor(0.20, 0.80)).toBe('mist');
    expect(terrainFor(0.20, 0.20)).toBe('meadow');
  });

  it('is total — every elevation/moisture pair yields a terrain', () => {
    for (let e = 0; e <= 1.0001; e += 0.05) {
      for (const m of [0, 0.5, 1]) {
        expect(typeof terrainFor(Math.min(1, e), m)).toBe('string');
      }
    }
  });
});

describe('buildTerrain', () => {
  it('fills the whole grid and returns a matching elevation grid', () => {
    const { terrain, elevation } = buildTerrain(mulberry32(1), 15, 0);
    expect(terrain).toHaveLength(15);
    expect(elevation).toHaveLength(15);
    for (let y = 0; y < 15; y++) {
      expect(terrain[y]).toHaveLength(15);
      expect(elevation[y]).toHaveLength(15);
      for (let x = 0; x < 15; x++) {
        expect(elevation[y][x]).toBeGreaterThanOrEqual(0);
        expect(elevation[y][x]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildTerrain(mulberry32(9), 20, 0).terrain;
    const b = buildTerrain(mulberry32(9), 20, 0).terrain;
    expect(a).toEqual(b);
  });

  it('produces spatially clustered terrain, not per-cell noise', () => {
    // 逐格獨立抽樣時，相鄰格同型別的比例約等於各型別機率平方和（遠低於 0.5）。
    // 雜訊推導出的地貌應該明顯高於此——這條測試就是「地圖不再是電視雜訊」的定義。
    const { terrain } = buildTerrain(mulberry32(4), 25, 0);
    let same = 0;
    let total = 0;
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 24; x++) {
        total++;
        if (terrain[y][x] === terrain[y][x + 1]) same++;
      }
    }
    expect(same / total).toBeGreaterThan(0.6);
  });

  it('keeps impassable cliffs to a small minority across many seeds', () => {
    let cliff = 0;
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { terrain } = buildTerrain(mulberry32(seed), 20, 0);
      for (const row of terrain) {
        for (const t of row) {
          total++;
          if (t === 'cliff') cliff++;
        }
      }
    }
    const share = cliff / total;
    expect(share).toBeGreaterThan(0.005); // 崖壁必須真的存在，否則成本層級沒有意義
    expect(share).toBeLessThan(0.20);     // 但不能多到把地圖切碎
  });

  it('elevationBias shifts the whole field upward, yielding more rock and cliff', () => {
    const count = (t: TerrainType, bias: number): number => {
      const { terrain } = buildTerrain(mulberry32(21), 20, bias);
      return terrain.flat().filter((c) => c === t).length;
    };
    expect(count('rock', 0.15) + count('cliff', 0.15))
      .toBeGreaterThan(count('rock', 0) + count('cliff', 0));
  });

  it('the same seed with a bias still differs from the unbiased field', () => {
    expect(buildTerrain(mulberry32(2), 15, 0.15).terrain)
      .not.toEqual(buildTerrain(mulberry32(2), 15, 0).terrain);
  });
});
