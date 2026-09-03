import { describe, it, expect } from 'vitest';
import { terrainFor, buildTerrain, elevationFor, startCorner } from '../src/core/terrain';
import { mulberry32, type Rng } from '../src/core/rng';
import { elevationBiasFor } from '../src/core/quirks';
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

  // F6：上面那條測試只約束 60 顆種子的總體平均比例，會把「單張地圖崖壁多到切碎」
  // 和「單張地圖一格崖壁都沒有」兩個極端一起平均掉。這裡逐張地圖分別檢查。
  it('bounds cliff share on every individual map, not just the aggregate (F6)', () => {
    // 實測（100 顆種子，size 20，elevationBias 0，與上面既有測試同一套參數慣例）：
    // p90 ≈ 5.5%，單張最糟 14.75%。0.30 訂在目前最糟值之上，但仍遠低於「把地圖切碎」
    // 的程度，BAND_CLIFF 哪天被調鬆到明顯退化時這裡會紅。
    for (let seed = 1; seed <= 100; seed++) {
      const { terrain } = buildTerrain(mulberry32(seed), 20, 0);
      let cliff = 0;
      let total = 0;
      for (const row of terrain) {
        for (const t of row) {
          total++;
          if (t === 'cliff') cliff++;
        }
      }
      expect(cliff / total).toBeLessThan(0.30);
    }
  });

  // ridgecrest 專屬：F6 的 0.30 上界是針對 bias 0（觀測最糟 14.75%）訂的，headroom
  // 是觀測值的兩倍多，對 ridgecrest 的 elevationBias（歷史：0.15 → 0.08，見
  // quirks.ts）太鬆——這正是 G1 這次要補的洞：0.15 在 round-1、無霧的 300 顆種子
  // 上量到均值 15.9%、單張最糟 44.4%，本測試改用同一套 seed 1..100、size 20
  // 慣例，逐張地圖檢查下修後的 bias 是否真的把崖壁佔比拉回可玩範圍。
  //
  // Phase 6a 的攔截路追加後，0.08 在 round-1、1000 顆種子上讓理想路線超預算率
  // 衝到 6.20%（見 quirks.ts 最新一段歷史），owner 再次核准下修，這次調到
  // 0.04。三個 bias 在同一套 seed 1..100、size 20 慣例下實測：0.15 最糟
  // 44.75%、0.08 最糟 27.25%（seed 92）、目前的 0.04 均值 4.19%、單張最糟
  // 20.00%（seed 70）。上界隨之收緊到 0.24：仍在最糟值之上留約 4 個百分點
  // headroom，但比舊的 0.30 更貼——bias 若被打回 0.08（最糟 27.25%）或更高，
  // 這裡會立刻紅；BAND_CLIFF 被調鬆時同理。
  it("bounds ridgecrest's cliff share on every individual map at the lowered bias (G1)", () => {
    const bias = elevationBiasFor('ridgecrest');
    for (let seed = 1; seed <= 100; seed++) {
      const { terrain } = buildTerrain(mulberry32(seed), 20, bias);
      let cliff = 0;
      let total = 0;
      for (const row of terrain) {
        for (const t of row) {
          total++;
          if (t === 'cliff') cliff++;
        }
      }
      expect(cliff / total).toBeLessThan(0.24);
    }
  });

  it('consumes exactly 160 rng calls, independent of map size (F6 — daily-determinism guard)', () => {
    // BASE_GRID/DETAIL_GRID 是寫死的常數：rng 消耗次數只該取決於它們，不該取決於 size。
    // 這條測試用計數用的假 rng，對兩個不同的 size 各建一次地圖，斷言呼叫次數相同且為 160——
    // 這是每日挑戰決定性的護欄：BASE_GRID/DETAIL_GRID 哪天被動到，這裡會立刻紅。
    function countingRng(): { rng: Rng; count: () => number } {
      let n = 0;
      const rng: Rng = () => { n++; return 0.5; };
      return { rng, count: () => n };
    }
    const a = countingRng();
    buildTerrain(a.rng, 15, 0);
    const b = countingRng();
    buildTerrain(b.rng, 25, 0);
    expect(a.count()).toBe(160);
    expect(b.count()).toBe(160);
    expect(a.count()).toBe(b.count());
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

describe('elevationFor', () => {
  it('round-trips through terrainFor back to the same terrain type', () => {
    // meadow/mist 兩者都落在同一個高程帶，只靠濕度分岔——分別用乾、濕兩種濕度驗證
    expect(terrainFor(elevationFor('meadow'), 0.2)).toBe('meadow');
    expect(terrainFor(elevationFor('mist'), 0.8)).toBe('mist');
    expect(terrainFor(elevationFor('thicket'), 0.5)).toBe('thicket');
    expect(terrainFor(elevationFor('rock'), 0.5)).toBe('rock');
    expect(terrainFor(elevationFor('cliff'), 0.5)).toBe('cliff');
  });

  it('returns the documented band midpoints', () => {
    expect(elevationFor('meadow')).toBeCloseTo(0.19);
    expect(elevationFor('mist')).toBeCloseTo(0.19);
    expect(elevationFor('thicket')).toBeCloseTo(0.50);
    expect(elevationFor('rock')).toBeCloseTo(0.72);
    expect(elevationFor('cliff')).toBeCloseTo(0.91);
  });
});

// F8：startCorner 現在同時被 generate.ts（可達性保證的錨點）與 newSession（玩家開局位置）
// 使用，是兩個保證的共同地基，之前只透過 newSession 間接覆蓋，這裡補上直接測試。
describe('startCorner', () => {
  const mapSize = 10; // s = 9
  const s = mapSize - 1;

  it('picks the bottom-right corner when the target sits at top-left', () => {
    expect(startCorner(mapSize, { x: 0, y: 0 })).toEqual({ x: s, y: s });
  });

  it('picks the top-left corner when the target sits at bottom-right', () => {
    expect(startCorner(mapSize, { x: s, y: s })).toEqual({ x: 0, y: 0 });
  });

  it('picks the bottom-left corner when the target sits at top-right', () => {
    expect(startCorner(mapSize, { x: s, y: 0 })).toEqual({ x: 0, y: s });
  });

  it('picks the top-right corner when the target sits at bottom-left', () => {
    expect(startCorner(mapSize, { x: 0, y: s })).toEqual({ x: s, y: 0 });
  });

  it('breaks ties deterministically — same input always yields the same corner', () => {
    // mapSize 3、target (1,0)：左下 (0,2) 與右下 (2,2) 到 target 的歐氏距離恰好相等
    // (sqrt(1²+2²) 兩邊算式相同)。輸出必須每次都是同一個角，不能因平手而漂移。
    // G2：原本只互相比對五次呼叫的結果，任何純函式都會通過，根本沒釘住平手時
    // 選的是哪一角——把 reduce 的 > 改成 >=（平手時改選後者）會讓 (0,2) 變成
    // (2,2)，出生角整個換邊，但這條測試仍然全綠。改成直接斷言 (0,2)：reduce
    // 從 (0,0) 開始比對 (2,0)（距離相同，> 為 false，維持 (0,0)）、再比對 (0,2)
    // （距離變大，> 為 true，換成 (0,2)）、最後比對 (2,2)（距離又打平，> 為
    // false，維持 (0,2)）——實際跑過 src/core/terrain.ts 目前的實作確認過。
    const target = { x: 1, y: 0 };
    expect(startCorner(3, target)).toEqual({ x: 0, y: 2 });
    for (let i = 0; i < 5; i++) expect(startCorner(3, target)).toEqual({ x: 0, y: 2 });
  });
});
