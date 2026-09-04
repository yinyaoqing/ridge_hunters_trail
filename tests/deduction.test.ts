import { describe, it, expect } from 'vitest';
import {
  unmutedReadClues, heatMap, maxHeat, infoCompleteStep, misleadingDecoy, distinctReadAges,
} from '../src/core/deduction';
import type { Clue, Level, TerrainType } from '../src/core/types';
import type { Vec2 } from '../src/core/geometry';

const disturbance = (x: number, y: number, radius: number, isDecoy = false): Clue =>
  ({ type: 'disturbance', position: { x, y }, isDecoy, age: 2, data: { radius } });

// 這批測試手工組出來的關卡固定用這一格當獵物位置：退化成五個節點都停在
// 同一點的路線，misleadingDecoy 現在不再自己從 level 讀它，呼叫端要把它傳進去。
const TARGET: Vec2 = { x: 6, y: 5 };

function makeLevel(clues: Clue[], mapSize = 12): Level {
  const terrain: TerrainType[][] = Array.from({ length: mapSize }, () =>
    Array.from({ length: mapSize }, () => 'meadow' as TerrainType));
  const elevation: number[][] = Array.from({ length: mapSize }, () =>
    Array.from({ length: mapSize }, () => 0.2)); // 低地：與 meadow 一致，視野不加成
  return {
    round: 1, mapSize, route: { waypoints: Array(5).fill(TARGET), rule: 'straight' },
    clues, terrain, elevation,
    supplies: [], creatureId: 'mistfawn', trailheadIndex: 0, weather: 'clear', iris: false,
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

  it('computes each age separately — a mixed-age read log must not intersect across ages', () => {
    // 兩條 age 2 的線索（index 0、1）交集需要兩條才收斂到最終大小（5 格）；
    // 一條 age 0 的線索（index 2）夾在中間讀到，讀取順序是 index 0, 2, 1
    // （步數 4, 11, 20）——age 2 的第二條、也是讓它收斂的那一條，被排到最後讀。
    // 這個順序是刻意的：舊版把全部三條線索交在一起算 finalSize，由於 age 0
    // 錨定的節點跟 age 2 的相距很遠、候選圓完全不重疊，三條的混合交集恆為 0；
    // 累加到「index0 + index2」兩條時，交集就已經是 0（＝混合 finalSize），
    // 舊版會在這裡（step 11）就回報「已完備」——但此時 age 2 那一組其實還沒收斂，
    // 决定 age 2 答案的第二條線索（index 1）要到 step 20 才讀到。
    // 新版逐齡計算：age 2 組要等 index 1（step 20）才收斂到 5 格，age 0 組只有
    // 一條、一讀（step 11）即完備；兩者取最大值，應回傳 20。
    // 兩個實作在這個讀取順序下給出不同答案（11 對 20），這條測試因此才真的
    // 會在舊版重新出現時失敗——原本的讀取順序（0,1,2）讓兩個實作剛好都算出 20，
    // 沒有分辨力。
    const level = makeLevel([
      disturbance(5, 5, 2),
      disturbance(7, 5, 2),
      { type: 'disturbance', position: { x: 1, y: 1 }, isDecoy: false, age: 0, data: { radius: 2 } },
    ]);
    const step = infoCompleteStep(level, [
      { clueIndex: 0, step: 4 },
      { clueIndex: 2, step: 11 },
      { clueIndex: 1, step: 20 },
    ]);
    expect(step).toBe(20);
  });
});

describe('misleadingDecoy', () => {
  const level = makeLevel([
    disturbance(5, 5, 2),
    disturbance(1, 1, 2, true), // 幌子，涵蓋 (1,2)
  ]);
  const readLog = [{ clueIndex: 0, step: 3 }, { clueIndex: 1, step: 7 }];

  it('names the read decoy whose candidate set contains the wager cell', () => {
    const found = misleadingDecoy(level, readLog, { x: 1, y: 2 }, TARGET);
    expect(found?.position).toEqual({ x: 1, y: 1 });
  });

  it('returns null when the wager sits outside every read decoy', () => {
    expect(misleadingDecoy(level, readLog, { x: 6, y: 5 }, TARGET)).toBe(null);
  });

  it('returns null when the player placed no wager', () => {
    expect(misleadingDecoy(level, readLog, null, TARGET)).toBe(null);
  });

  it('ignores decoys the player never read', () => {
    expect(misleadingDecoy(level, [{ clueIndex: 0, step: 3 }], { x: 1, y: 2 }, TARGET)).toBe(null);
  });

  it('returns null when the wager landed exactly on the target, even if a read decoy covers it', () => {
    // 幌子 (1,1) 半徑2 涵蓋目標本身 (6,5)？不涵蓋；改造一個涵蓋目標的幌子並押中目標
    const coveringTarget = makeLevel([
      disturbance(5, 5, 2),
      disturbance(6, 5, 9, true), // 幌子候選集合極大，涵蓋目標與押注格
    ]);
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 2 }];
    expect(misleadingDecoy(coveringTarget, log, { x: 6, y: 5 }, TARGET)).toBe(null);
  });

  it('returns null when the decoy candidate set also covers the true target (it did not mislead)', () => {
    const coversBoth = makeLevel([
      disturbance(5, 5, 2),
      disturbance(6, 5, 9, true), // 涵蓋押注格 (1,2)？半徑9從(6,5)幾乎涵蓋全圖，含(1,2)與目標(6,5)
    ]);
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 2 }];
    expect(misleadingDecoy(coversBoth, log, { x: 1, y: 2 }, TARGET)).toBe(null);
  });

  it('picks the earlier-read decoy when two read decoys both cover the wager and neither covers the target', () => {
    const twoDecoys = makeLevel([
      disturbance(1, 1, 2, true),  // 涵蓋 (1,2)，不涵蓋目標 (6,5)
      disturbance(0, 3, 2, true),  // 也涵蓋 (1,2)，不涵蓋目標 (6,5)
    ]);
    const log = [{ clueIndex: 1, step: 3 }, { clueIndex: 0, step: 7 }]; // 判讀順序：index1先、index0後
    const found = misleadingDecoy(twoDecoys, log, { x: 1, y: 2 }, TARGET);
    expect(found?.position).toEqual({ x: 0, y: 3 }); // 判讀順序在前的那一條（index1）
  });
});

describe('distinctReadAges', () => {
  const lvl = (ages: number[]) => ({
    clues: ages.map((age) => ({
      type: 'disturbance' as const, position: { x: 0, y: 0 },
      isDecoy: false, age: age as 0 | 1 | 2, data: { radius: 2 },
    })),
  });

  it('counts nothing when nothing has been read', () => {
    expect(distinctReadAges(lvl([2, 1, 0]) as never, [])).toBe(0);
  });

  it('counts one age when every read clue shares it', () => {
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 4 }];
    expect(distinctReadAges(lvl([2, 2, 0]) as never, log)).toBe(1);
  });

  it('counts two once a second age is read', () => {
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 2, step: 4 }];
    expect(distinctReadAges(lvl([2, 2, 0]) as never, log)).toBe(2);
  });

  it('counts decoys too — the player cannot tell them apart yet', () => {
    const level = lvl([2, 0]);
    level.clues[1].isDecoy = true;
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 1, step: 2 }];
    expect(distinctReadAges(level as never, log)).toBe(2);
  });

  it('ignores a log entry pointing at no clue', () => {
    const log = [{ clueIndex: 0, step: 1 }, { clueIndex: 99, step: 2 }];
    expect(distinctReadAges(lvl([2, 1]) as never, log)).toBe(1);
  });
});
