import { describe, it, expect } from 'vitest';
import {
  unmutedReadClues, heatMap, maxHeat, infoCompleteStep, misleadingDecoy,
} from '../src/core/deduction';
import type { Clue, Level, TerrainType } from '../src/core/types';

const disturbance = (x: number, y: number, radius: number, isDecoy = false): Clue =>
  ({ type: 'disturbance', position: { x, y }, isDecoy, data: { radius } });

function makeLevel(clues: Clue[], mapSize = 12): Level {
  const terrain: TerrainType[][] = Array.from({ length: mapSize }, () =>
    Array.from({ length: mapSize }, () => 'meadow' as TerrainType));
  const elevation: number[][] = Array.from({ length: mapSize }, () =>
    Array.from({ length: mapSize }, () => 0.2)); // 低地：與 meadow 一致，視野不加成
  return {
    round: 1, mapSize, targetPos: { x: 6, y: 5 }, clues, terrain, elevation,
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

describe('infoCompleteStep', () => {
  it('returns the step after which no further real clue narrowed the answer', () => {
    // 三條真線索：前兩條把交集收斂到最終大小，第三條完全包住前兩者、不再收斂
    const level = makeLevel([
      disturbance(5, 5, 2),
      disturbance(7, 5, 2),
      disturbance(6, 5, 9), // 半徑極大，涵蓋前兩者的交集，不提供新資訊
    ]);
    const step = infoCompleteStep(level, [
      { clueIndex: 0, step: 4 },
      { clueIndex: 1, step: 11 },
      { clueIndex: 2, step: 26 },
    ]);
    expect(step).toBe(11);
  });

  it('ignores decoys — they are not information about the target', () => {
    const level = makeLevel([disturbance(5, 5, 2), disturbance(0, 0, 1, true)]);
    expect(infoCompleteStep(level, [
      { clueIndex: 0, step: 3 },
      { clueIndex: 1, step: 8 },
    ])).toBe(3);
  });

  it('returns null when no real clue was ever read', () => {
    const level = makeLevel([disturbance(0, 0, 1, true)]);
    expect(infoCompleteStep(level, [{ clueIndex: 0, step: 2 }])).toBe(null);
    expect(infoCompleteStep(level, [])).toBe(null);
  });
});

describe('misleadingDecoy', () => {
  const level = makeLevel([
    disturbance(5, 5, 2),
    disturbance(1, 1, 2, true), // 幌子，涵蓋 (1,2)
  ]);
  const readLog = [{ clueIndex: 0, step: 3 }, { clueIndex: 1, step: 7 }];

  it('names the read decoy whose candidate set contains the wager cell', () => {
    const found = misleadingDecoy(level, readLog, { x: 1, y: 2 });
    expect(found?.position).toEqual({ x: 1, y: 1 });
  });

  it('returns null when the wager sits outside every read decoy', () => {
    expect(misleadingDecoy(level, readLog, { x: 6, y: 5 })).toBe(null);
  });

  it('returns null when the player placed no wager', () => {
    expect(misleadingDecoy(level, readLog, null)).toBe(null);
  });

  it('ignores decoys the player never read', () => {
    expect(misleadingDecoy(level, [{ clueIndex: 0, step: 3 }], { x: 1, y: 2 })).toBe(null);
  });

  it('returns null when the wager landed exactly on the target, even if a read decoy covers it', () => {
    // 幌子 (1,1) 半徑2 涵蓋目標本身 (6,5)？不涵蓋；改造一個涵蓋目標的幌子並押中目標
    const coveringTarget = makeLevel([
      disturbance(5, 5, 2),
      disturbance(6, 5, 9, true), // 幌子候選集合極大，涵蓋目標與押注格
    ]);
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 2 }];
    expect(misleadingDecoy(coveringTarget, log, { x: 6, y: 5 })).toBe(null);
  });

  it('returns null when the decoy candidate set also covers the true target (it did not mislead)', () => {
    const coversBoth = makeLevel([
      disturbance(5, 5, 2),
      disturbance(6, 5, 9, true), // 涵蓋押注格 (1,2)？半徑9從(6,5)幾乎涵蓋全圖，含(1,2)與目標(6,5)
    ]);
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 2 }];
    expect(misleadingDecoy(coversBoth, log, { x: 1, y: 2 })).toBe(null);
  });

  it('picks the earlier-read decoy when two read decoys both cover the wager and neither covers the target', () => {
    const twoDecoys = makeLevel([
      disturbance(1, 1, 2, true),  // 涵蓋 (1,2)，不涵蓋目標 (6,5)
      disturbance(0, 3, 2, true),  // 也涵蓋 (1,2)，不涵蓋目標 (6,5)
    ]);
    const log = [{ clueIndex: 1, step: 3 }, { clueIndex: 0, step: 7 }]; // 判讀順序：index1先、index0後
    const found = misleadingDecoy(twoDecoys, log, { x: 1, y: 2 });
    expect(found?.position).toEqual({ x: 0, y: 3 }); // 判讀順序在前的那一條（index1）
  });
});
