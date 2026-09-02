import { describe, it, expect } from 'vitest';
import { findPath, pathCost, routeCostsFrom } from '../src/core/path';
import { cheb, type Vec2 } from '../src/core/geometry';
import { key } from '../src/core/clues';
import type { TerrainType } from '../src/core/types';

// "." 草地(1)、"t" 密叢(2)、"r" 岩坡(4)、"#" 崖壁(不可通行)
const CH: Record<string, TerrainType> = {
  '.': 'meadow', t: 'thicket', r: 'rock', '#': 'cliff',
};
const grid = (rows: string[]): TerrainType[][] => rows.map((r) => [...r].map((c) => CH[c]));

// 多數測試在意的是地形，不是迷霧——這個輔助函式代表「整張圖都看過」。
// 迷霧限制本身另有專屬的 describe 區塊。
const seenAll = (t: TerrainType[][]): Set<string> => {
  const s = new Set<string>();
  for (let y = 0; y < t.length; y++) {
    for (let x = 0; x < t[y].length; x++) s.add(key({ x, y }));
  }
  return s;
};
const route = (t: TerrainType[][], from: Vec2, to: Vec2, seen?: Set<string>) =>
  findPath(t, from, to, seen ?? seenAll(t));

describe('findPath', () => {
  it('returns the destination only, for an adjacent step', () => {
    expect(route(grid(['..', '..']), { x: 0, y: 0 }, { x: 1, y: 0 }))
      .toEqual([{ x: 1, y: 0 }]);
  });

  it('excludes the origin and ends on the destination', () => {
    const p = route(grid(['....', '....']), { x: 0, y: 0 }, { x: 3, y: 1 })!;
    expect(p).not.toContainEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 3, y: 1 });
  });

  it('every consecutive step is chebyshev-adjacent', () => {
    const p = route(grid(['.....', '.....', '.....']), { x: 0, y: 0 }, { x: 4, y: 2 })!;
    let prev = { x: 0, y: 0 };
    for (const step of p) {
      expect(cheb(prev, step)).toBe(1);
      prev = step;
    }
  });

  it('routes around a cliff wall instead of through it', () => {
    const t = grid(['..#..', '..#..', '..#..', '..#..', '.....']);
    const p = route(t, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(p).not.toBeNull();
    for (const c of p) expect(t[c.y][c.x]).not.toBe('cliff');
  });

  it('prefers a longer cheap route over a shorter expensive one', () => {
    // 直行穿過三格岩坡(4×3=12)，繞下方走六格草地(1×6=6)
    const t = grid(['.rrr.', '.....', '.....']);
    const p = route(t, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(pathCost(t, p)).toBeLessThan(12);
    expect(p.some((c) => c.y > 0)).toBe(true);
  });

  it('returns null when the destination is walled off', () => {
    expect(route(grid(['.#.', '.#.', '.#.']), { x: 0, y: 0 }, { x: 2, y: 1 })).toBe(null);
  });

  it('returns null for an impassable destination', () => {
    expect(route(grid(['..', '.#']), { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(null);
  });

  it('returns an empty path when origin and destination are the same', () => {
    expect(route(grid(['..', '..']), { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });

  it('is deterministic — the same query yields the same path', () => {
    const t = grid(['.....', '..t..', '.....']);
    expect(route(t, { x: 0, y: 0 }, { x: 4, y: 2 }))
      .toEqual(route(t, { x: 0, y: 0 }, { x: 4, y: 2 }));
  });
});

describe('findPath: only routes over ground the player has seen', () => {
  // 迷霧的完整性：預覽線若能繞開玩家還沒看見的崖壁，那條線本身就洩漏了未探索區的地形。
  // 因此尋路一律把未看過的格視同不可通行。
  const t = grid(['.....', '.....', '.....']);

  it('refuses a shortcut through unseen ground even when the terrain allows it', () => {
    const seen = new Set([key({ x: 0, y: 0 }), key({ x: 1, y: 0 }), key({ x: 2, y: 0 })]);
    expect(findPath(t, { x: 0, y: 0 }, { x: 2, y: 2 }, seen)).toBe(null);
  });

  it('routes fine once the intervening ground has been seen', () => {
    const seen = new Set([key({ x: 0, y: 0 }), key({ x: 1, y: 1 }), key({ x: 2, y: 2 })]);
    expect(findPath(t, { x: 0, y: 0 }, { x: 2, y: 2 }, seen))
      .toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  });

  it('refuses an unseen destination', () => {
    const seen = new Set([key({ x: 0, y: 0 }), key({ x: 1, y: 0 })]);
    expect(findPath(t, { x: 0, y: 0 }, { x: 4, y: 0 }, seen)).toBe(null);
  });

  it('never returns a path containing an unseen cell', () => {
    const seen = seenAll(t);
    seen.delete(key({ x: 2, y: 1 }));
    const p = findPath(t, { x: 0, y: 0 }, { x: 4, y: 1 }, seen);
    if (p) for (const c of p) expect(seen.has(key(c))).toBe(true);
  });
});

describe('findPath: handles ragged grids with per-row bounds', () => {
  // 非方陣時 x 邊界應看「該列自己的」長度，不是全局的第一列長度。
  // 否則：
  // - 第一列短、後列長時：後列的有效格會被誤判為越界（BLOCKED）
  // - 第一列長、後列短時：後列超出其範圍的位置會讀到 undefined（BUG）
  it('routes correctly when a row is shorter than the first row', () => {
    // 第一列 4 格，第二列 6 格。目標在第二列超出第一列範圍的位置。
    const t: TerrainType[][] = [
      ['meadow', 'meadow', 'meadow', 'meadow'],
      ['meadow', 'meadow', 'meadow', 'meadow', 'meadow', 'meadow'],
    ];
    const seen = seenAll(t);
    // 起點 (0,0)，目標 (5,1) ——在第二列內但超出第一列的 4 格
    const p = findPath(t, { x: 0, y: 0 }, { x: 5, y: 1 }, seen);
    expect(p).not.toBeNull();
    expect(p![p!.length - 1]).toEqual({ x: 5, y: 1 });
  });

  it('refuses to route to a cell beyond a shorter row', () => {
    // 第一列 6 格，第二列 4 格。試圖尋路到第二列超出其範圍的位置。
    const t: TerrainType[][] = [
      ['meadow', 'meadow', 'meadow', 'meadow', 'meadow', 'meadow'],
      ['meadow', 'meadow', 'meadow', 'meadow'],
    ];
    const seen = seenAll(t);
    // 起點 (0,0)，目標 (5,1) ——在第一列內但超出第二列的 4 格，應回傳 null
    const p = findPath(t, { x: 0, y: 0 }, { x: 5, y: 1 }, seen);
    expect(p).toBeNull();
  });
});

describe('routeCostsFrom', () => {
  // F2：起始蹤跡挑選要用「走過去要付的體力」而非直線距離，這裡直接測 Dijkstra 本身。
  // 生成期還沒有迷霧，所以不吃 seen 參數——全圖都算得到成本。

  it('gives the origin a cost of zero', () => {
    const t = grid(['...', '...', '...']);
    const costs = routeCostsFrom(t, { x: 1, y: 1 });
    expect(costs.get(key({ x: 1, y: 1 }))).toBe(0);
  });

  it('routes around a cliff wall instead of assuming a straight line', () => {
    const t = grid(['..#..', '..#..', '..#..', '..#..', '.....']);
    const costs = routeCostsFrom(t, { x: 0, y: 0 });
    // 直線距離是 4，但牆只在最下一列有缺口，最省路線要繞下去再繞回來
    expect(costs.get(key({ x: 4, y: 0 }))).toBeGreaterThan(4);
  });

  it('prefers a cheap detour over an expensive straight line', () => {
    // 直行穿三格岩坡成本 4×3=12；繞下方草地走（可走對角，八方向）成本僅 4
    // （(0,0)→(1,1)→(2,1)→(3,1)→(4,0)，每步草地 1）——遠低於直線的 12。
    const t = grid(['.rrr.', '.....', '.....']);
    const costs = routeCostsFrom(t, { x: 0, y: 0 });
    expect(costs.get(key({ x: 4, y: 0 }))).toBe(4);
    expect(costs.get(key({ x: 4, y: 0 }))).toBeLessThan(12);
  });

  it('omits impassable cells from the result', () => {
    const t = grid(['.#.', '.#.', '.#.']);
    const costs = routeCostsFrom(t, { x: 0, y: 0 });
    expect(costs.has(key({ x: 1, y: 0 }))).toBe(false);
    expect(costs.has(key({ x: 1, y: 1 }))).toBe(false);
    expect(costs.has(key({ x: 1, y: 2 }))).toBe(false);
  });

  it('does not include unreachable cells cut off by a full wall', () => {
    const t = grid(['..#..', '..#..', '..#..', '..#..', '..#..']);
    const costs = routeCostsFrom(t, { x: 0, y: 0 });
    expect(costs.has(key({ x: 3, y: 0 }))).toBe(false);
  });
});

describe('pathCost', () => {
  it('sums the cost of each entered cell, ignoring the origin', () => {
    const t = grid(['.tr']);
    expect(pathCost(t, [{ x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(2 + 4);
  });
  it('is zero for an empty path', () => {
    expect(pathCost(grid(['..']), [])).toBe(0);
  });
});
