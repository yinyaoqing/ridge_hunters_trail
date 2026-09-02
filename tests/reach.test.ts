import { describe, it, expect } from 'vitest';
import { reachableFrom, ensureReachable } from '../src/core/reach';
import { key } from '../src/core/clues';
import type { TerrainType } from '../src/core/types';

// 以字元圖建地形："." 草地、"#" 崖壁
function grid(rows: string[]): TerrainType[][] {
  return rows.map((r) => [...r].map((c) => (c === '#' ? 'cliff' : 'meadow') as TerrainType));
}

describe('reachableFrom', () => {
  it('walks diagonally through passable cells', () => {
    const t = grid(['...', '...', '...']);
    expect(reachableFrom(t, { x: 0, y: 0 }).size).toBe(9);
  });

  it('stops at a full cliff wall', () => {
    const t = grid(['..#..', '..#..', '..#..', '..#..', '..#..']);
    const seen = reachableFrom(t, { x: 0, y: 0 });
    expect(seen.has(key({ x: 1, y: 4 }))).toBe(true);
    expect(seen.has(key({ x: 3, y: 0 }))).toBe(false);
  });

  it('leaks through a diagonal gap — chebyshev movement allows it', () => {
    const t = grid(['.#', '#.']);
    expect(reachableFrom(t, { x: 0, y: 0 }).has(key({ x: 1, y: 1 }))).toBe(true);
  });

  it('returns an empty set when the origin itself is impassable', () => {
    expect(reachableFrom(grid(['#.', '..']), { x: 0, y: 0 }).size).toBe(0);
  });

  it('bounds x per row rather than reusing the row count on a non-square grid', () => {
    // 2 列 × 4 欄：若 x 邊界誤用 terrain.length（=2，列數），會把 x 也夾在 <2，
    // 漏掉整張圖右半邊。正確答案是全部 8 格互通。
    const t = grid(['....', '....']);
    expect(reachableFrom(t, { x: 0, y: 0 }).size).toBe(8);
  });
});

describe('ensureReachable', () => {
  it('carves a corridor to a required cell walled off by cliffs', () => {
    const t = grid(['..#..', '..#..', '..#..', '..#..', '..#..']);
    const target = { x: 4, y: 2 };
    expect(reachableFrom(t, { x: 0, y: 0 }).has(key(target))).toBe(false);
    ensureReachable(t, { x: 0, y: 0 }, [target]);
    expect(reachableFrom(t, { x: 0, y: 0 }).has(key(target))).toBe(true);
  });

  it('downgrades cliffs to rock rather than to meadow — the pass is still costly', () => {
    // 方形網格（避免 F1 那個非方形 bug 讓這條測試「假綠燈」：值對了，
    // 但走訪根本沒發生，postcondition 從沒被驗過）
    const t = grid(['.#.', '.#.', '.#.']);
    ensureReachable(t, { x: 0, y: 0 }, [{ x: 2, y: 0 }]);
    expect(t[0][1]).toBe('rock');
    expect(reachableFrom(t, { x: 0, y: 0 }).has(key({ x: 2, y: 0 }))).toBe(true);
  });

  it('leaves an already-connected map untouched', () => {
    const t = grid(['...', '.#.', '...']);
    const before = JSON.stringify(t);
    ensureReachable(t, { x: 0, y: 0 }, [{ x: 2, y: 2 }]);
    expect(JSON.stringify(t)).toBe(before);
  });

  it('makes the origin passable when it starts as a cliff', () => {
    const t = grid(['#.', '..']);
    ensureReachable(t, { x: 0, y: 0 }, [{ x: 1, y: 1 }]);
    expect(t[0][0]).not.toBe('cliff');
  });

  it('connects several required cells at once', () => {
    const t = grid(['.####', '.####', '.####', '.####', '.####']);
    const required = [{ x: 4, y: 0 }, { x: 4, y: 4 }];
    ensureReachable(t, { x: 0, y: 0 }, required);
    const seen = reachableFrom(t, { x: 0, y: 0 });
    for (const p of required) expect(seen.has(key(p))).toBe(true);
  });
});
