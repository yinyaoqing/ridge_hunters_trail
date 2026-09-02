import { describe, it, expect } from 'vitest';
import { unmutedReadClues, heatMap, maxHeat } from '../src/core/deduction';
import type { Clue, Level, TerrainType } from '../src/core/types';

const disturbance = (x: number, y: number, radius: number, isDecoy = false): Clue =>
  ({ type: 'disturbance', position: { x, y }, isDecoy, data: { radius } });

function makeLevel(clues: Clue[], mapSize = 12): Level {
  const terrain: TerrainType[][] = Array.from({ length: mapSize }, () =>
    Array.from({ length: mapSize }, () => 'meadow' as TerrainType));
  return {
    round: 1, mapSize, targetPos: { x: 6, y: 5 }, clues, terrain,
    supplies: [], creatureId: 'mistfawn', weather: 'clear', iris: false,
  };
}

describe('unmutedReadClues', () => {
  const level = makeLevel([disturbance(1, 1, 2), disturbance(5, 5, 2), disturbance(9, 9, 2)]);

  it('returns only clues that were actually read, in read order', () => {
    const out = unmutedReadClues(level, [{ clueIndex: 2, step: 4 }, { clueIndex: 0, step: 9 }], new Set());
    expect(out.map((c) => c.position)).toEqual([{ x: 9, y: 9 }, { x: 1, y: 1 }]);
  });

  it('drops muted clue indices', () => {
    const out = unmutedReadClues(
      level, [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 2 }], new Set([0]));
    expect(out).toHaveLength(1);
    expect(out[0].position).toEqual({ x: 5, y: 5 });
  });

  it('includes decoys — the player cannot tell them apart yet', () => {
    const withDecoy = makeLevel([disturbance(1, 1, 2, true)]);
    expect(unmutedReadClues(withDecoy, [{ clueIndex: 0, step: 1 }], new Set())).toHaveLength(1);
  });

  it('ignores read log entries pointing at a missing clue index', () => {
    expect(unmutedReadClues(level, [{ clueIndex: 99, step: 1 }], new Set())).toHaveLength(0);
  });
});

describe('heatMap', () => {
  it('counts how many clues each cell satisfies', () => {
    // 兩個半徑 2 的圓域，圓心 (5,5) 與 (7,5)：(6,5) 同時在兩者內
    const heat = heatMap([disturbance(5, 5, 2), disturbance(7, 5, 2)], 12);
    expect(heat.get('6,5')).toBe(2);
    expect(heat.get('4,5')).toBe(1);  // 只在第一個裡
    expect(heat.has('0,0')).toBe(false); // 兩個都不符合的格不進 Map
  });

  it('returns an empty map for no clues', () => {
    expect(heatMap([], 12).size).toBe(0);
  });
});

describe('maxHeat', () => {
  it('returns the highest count in the map', () => {
    expect(maxHeat(heatMap([disturbance(5, 5, 2), disturbance(7, 5, 2)], 12))).toBe(2);
  });
  it('returns 0 for an empty map', () => {
    expect(maxHeat(new Map())).toBe(0);
  });
});
