# Phase 5「有地方的山」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把探索段從「一次一格點擊穿越一片電視雜訊」換成「在一張有稜線、溪谷與林線的地圖上，用視野與尋路做出幾次真正的路線決策」。

**Architecture:** 地形不再逐格獨立抽樣，改由兩張種子化雜訊場（高程、濕度）推導，並新增不可通行的 `cliff` 型別讓成本層級真正咬合；生成後跑一次連通性保證，把被崖壁隔開的必要格挖通，維持「反向錨定必定有解」的地基。視野、駐足觀察與 A\* 尋路各自是 `src/core/` 的純函式模組，場景層只做渲染與互動接線。

**Tech Stack:** Phaser 3.90、TypeScript 5.6（strict）、Vite 6、Vitest 3（`environment: 'node'`）。

## Global Constraints

- 不新增任何 runtime 相依；`package.json` 的 `dependencies` 僅保留 `phaser`。
- `vite.config.ts` 的 `test.environment` 為 `node`，**Phaser 場景無法單元測試**。新邏輯一律抽成 `src/core/` 純函式並 TDD；場景層以 `npm run build`（＝`tsc --noEmit && vite build`）＋ 人工冒煙把關。
- 所有面向玩家的字串走 `i18n.t()`，`en` 與 `zh-TW` 同步新增。`tests/i18n.test.ts` 已有鍵值對等與非空測試，漏一邊直接紅燈。
- **反向錨定不可破壞**：線索一律由目標／幌子點反推生成。本階段改的是地形與移動，`makeClue`、`generateLevelFor` 的線索生成順序與 rng 消耗次序**不得**變動——只在地形段落之後追加新邏輯。
- **每日挑戰決定性**：同一顆種子必須產出同一張地圖。所有 rng 消耗次數必須與輸入無關（不可用 `while (rng() < x)` 這類不定次數迴圈）。
- 線索金光 `CLUE_GOLD = 0xd8c874` 恆定；新增顏色不得與其相近。
- 無傷害定位：不得出現死亡、受傷、暴力的措辭或圖形。崖壁是「走不過去」，不是「掉下去」。
- 失敗軟著陸保留：`notesForRun` 與研究度累積邏輯不得移除。
- `readClues` 的語意是「踩過的**線索**格」，不是「踩過的每一格」——它是 `notesForRun` 與新手引導 `tut.read`／`tut.cross` 的共用計數（Phase 4 的 C1 回歸就是踩到這裡）。任何動到 `move()` 的任務都必須守住這條。
- TypeScript strict：不得使用 `any`，不得用 `!` 掩蓋真正可能為 undefined 的存取。
- 新增儲存鍵／registry 鍵必須同步 `docs/ARCHITECTURE-NOTES.md` 的兩張表（Task 14）。

## 數值屬第一版，待實測調整

設計規格書 §0 明訂「所有數值為建議起始值，實作時可依 playtesting 結果微調」。本計畫的地形分帶門檻、地形成本、體力預算、視野半徑與駐足成本全部屬於這一類。實作時照抄，不要自行改動；調整留給人工實測之後。

## 出貨檢查點

**Task 6 結束時，分支處於可獨立出貨的狀態**：地圖有了地貌、成本層級與崖壁，路線第一次值得計算，視野與尋路都還沒進來。若需要中途暫停或先讓人試玩，那裡是乾淨的切點。Task 7 之後才動玩家的感知與操作。

---

### Task 1: 種子化雜訊場

地形的地基。兩張獨立的 value noise 場（高程、濕度）取代逐格 `pickWeighted`。建構期消耗固定次數的 rng，讓每日挑戰的決定性不受影響。

**Files:**
- Create: `src/core/noise.ts`
- Test: `tests/noise.test.ts`

**Interfaces:**
- Consumes: `Rng` from `src/core/rng`
- Produces:
  - `interface NoiseField { at(u: number, v: number): number }`（`u`/`v` 為 0..1 正規化座標，回傳 0..1）
  - `valueNoise(rng: Rng, gridSize: number): NoiseField`
  - `layered(base: NoiseField, detail: NoiseField): NoiseField`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/noise.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { valueNoise, layered } from '../src/core/noise';
import { mulberry32 } from '../src/core/rng';

describe('valueNoise', () => {
  it('consumes a fixed number of rng draws regardless of how it is sampled', () => {
    let draws = 0;
    const counting = () => { draws++; return 0.5; };
    valueNoise(counting, 4); // (4+1)^2 = 25 個格點
    expect(draws).toBe(25);
    const field = valueNoise(counting, 4);
    draws = 0;
    field.at(0.1, 0.2);
    field.at(0.9, 0.7);
    expect(draws).toBe(0); // 取樣不再消耗 rng
  });

  it('is deterministic for the same seed', () => {
    const a = valueNoise(mulberry32(7), 4);
    const b = valueNoise(mulberry32(7), 4);
    for (const [u, v] of [[0, 0], [0.33, 0.66], [1, 1]] as const) {
      expect(a.at(u, v)).toBe(b.at(u, v));
    }
  });

  it('differs for different seeds', () => {
    const a = valueNoise(mulberry32(1), 4);
    const b = valueNoise(mulberry32(2), 4);
    expect(a.at(0.5, 0.5)).not.toBe(b.at(0.5, 0.5));
  });

  it('stays within 0..1 across the whole domain', () => {
    const f = valueNoise(mulberry32(3), 5);
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const n = f.at(i / 20, j / 20);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('clamps out-of-range coordinates instead of wrapping or returning NaN', () => {
    const f = valueNoise(mulberry32(3), 4);
    expect(f.at(-1, -1)).toBe(f.at(0, 0));
    expect(f.at(2, 2)).toBe(f.at(1, 1));
  });

  it('is spatially smooth — neighbouring samples differ far less than distant ones', () => {
    const f = valueNoise(mulberry32(11), 4);
    // 相鄰取樣（1/64 格距）與遠距取樣（半張圖）的平均變化量差距，用來確認這是
    // 有空間結構的雜訊場，而不是逐點獨立亂數
    let near = 0;
    let far = 0;
    for (let i = 0; i < 32; i++) {
      const u = i / 32;
      near += Math.abs(f.at(u, 0.5) - f.at(u + 1 / 64, 0.5));
      far += Math.abs(f.at(u, 0.5) - f.at((u + 0.5) % 1, 0.5));
    }
    expect(near).toBeLessThan(far / 3);
  });
});

describe('layered', () => {
  it('blends base and detail at 70/30', () => {
    const flat = (n: number) => ({ at: () => n });
    expect(layered(flat(1), flat(0)).at(0.5, 0.5)).toBeCloseTo(0.7, 10);
    expect(layered(flat(0), flat(1)).at(0.5, 0.5)).toBeCloseTo(0.3, 10);
  });

  it('stays within 0..1 when both inputs are in range', () => {
    const f = layered(valueNoise(mulberry32(5), 3), valueNoise(mulberry32(6), 7));
    for (let i = 0; i <= 10; i++) {
      const n = f.at(i / 10, 0.4);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/noise.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/noise"`

- [ ] **Step 3: 實作**

Create `src/core/noise.ts`:

```ts
import type { Rng } from './rng';

// 0..1 的二維雜訊場。u/v 為正規化座標（0=左/上緣、1=右/下緣），超出範圍一律夾限。
export interface NoiseField {
  at(u: number, v: number): number;
}

// smoothstep：讓格點之間的內插在邊界處導數為零，避免出現方格狀的稜線假象
const smooth = (t: number): number => t * t * (3 - 2 * t);

// 種子化 value noise：建構期一次抽完 (gridSize+1)^2 個格點值，之後 at() 純內插、
// 不再碰 rng。rng 消耗次數只取決於 gridSize（呼叫端寫死），與地圖大小、取樣次數
// 都無關——這是每日挑戰「同一顆種子必得同一張地圖」的前提。
export function valueNoise(rng: Rng, gridSize: number): NoiseField {
  const n = gridSize + 1;
  const lattice = new Array<number>(n * n);
  for (let i = 0; i < n * n; i++) lattice[i] = rng();

  const get = (ix: number, iy: number): number => {
    const cx = Math.min(n - 1, Math.max(0, ix));
    const cy = Math.min(n - 1, Math.max(0, iy));
    return lattice[cy * n + cx];
  };

  return {
    at(u: number, v: number): number {
      const x = Math.min(1, Math.max(0, u)) * gridSize;
      const y = Math.min(1, Math.max(0, v)) * gridSize;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = smooth(x - ix);
      const fy = smooth(y - iy);
      const top = get(ix, iy) + (get(ix + 1, iy) - get(ix, iy)) * fx;
      const bottom = get(ix, iy + 1) + (get(ix + 1, iy + 1) - get(ix, iy + 1)) * fx;
      return top + (bottom - top) * fy;
    },
  };
}

// 兩層疊加：低頻 base 決定大地貌（山脊走向），高頻 detail 加上局部起伏。
// 70/30 的權重讓大結構仍然清楚可讀——玩家要能一眼看出「那邊是一條稜線」。
export function layered(base: NoiseField, detail: NoiseField): NoiseField {
  return { at: (u, v) => base.at(u, v) * 0.7 + detail.at(u, v) * 0.3 };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/noise.test.ts`
Expected: PASS（2 個 describe、共 8 個測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/core/noise.ts tests/noise.test.ts
git commit -m "feat: seeded value noise fields for terrain generation"
```

---

### Task 2: 地形推導與不可通行的崖壁

把「逐格獨立抽樣」換成「由高程與濕度推導」，並新增第五種地形 `cliff`。地圖第一次有稜線、溪谷與林線。

`cliff` 沒有美術素材，`BootScene` 的 `terr-` 缺檔已靜默降級（`BootScene.ts` 的 `FILE_LOAD_ERROR` 處理），`MapScene` 會退回純色塊——不需要新增任何圖檔。

**Files:**
- Create: `src/core/terrain.ts`
- Modify: `src/core/types.ts`（`TerrainType` 加 `'cliff'`、`TERRAIN_TYPES` 加 `'cliff'`、`Level` 加 `elevation`）
- Modify: `src/core/palette.ts`（三套配色各加 `cliff` 色）
- Test: `tests/terrain.test.ts`

**Interfaces:**
- Consumes: `NoiseField`, `valueNoise`, `layered` from `src/core/noise`（Task 1）
- Produces:
  - `terrainFor(elevation: number, moisture: number): TerrainType`
  - `buildTerrain(rng: Rng, size: number, elevationBias: number): { terrain: TerrainType[][]; elevation: number[][] }`
  - `TerrainType` 新增 `'cliff'`；`Level` 新增 `elevation: number[][]`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/terrain.test.ts`:

```ts
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/terrain.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/terrain"`

- [ ] **Step 3: 擴充 `types.ts`**

在 `src/core/types.ts` 把地形型別與執行期清單各加一項：

```ts
export type TerrainType = 'meadow' | 'mist' | 'thicket' | 'rock' | 'cliff';

// 地形型別的執行期清單（載入地形紋理、逐型別繪製時需要可列舉的來源）
export const TERRAIN_TYPES: readonly TerrainType[] = ['meadow', 'mist', 'thicket', 'rock', 'cliff'];
```

並在 `Level` 介面的 `terrain` 欄位下方新增高程網格（視野加成在執行期要讀，不能只留在生成期）：

```ts
  terrain: TerrainType[][]; // terrain[y][x]
  elevation: number[][];    // elevation[y][x]，0..1；地形由它推導，視野加成也讀它
```

- [ ] **Step 4: 三套配色各加 `cliff` 色**

在 `src/core/palette.ts` 的三個 Palette 常數中，各為 `terrain` 記錄加上 `cliff`。崖壁是比 `rock` 更深、更冷的裸岩，且必須與線索金光 `0xd8c874` 拉開距離：

```ts
// MIST_GREEN
  terrain: { meadow: 0x24352c, mist: 0x2c3f42, thicket: 0x3a5244, rock: 0x4a3c2c, cliff: 0x1e2622 },
```

```ts
// OCHRE
  terrain: { meadow: 0x33271d, mist: 0x3a352f, thicket: 0x3d3420, rock: 0x55402c, cliff: 0x241d16 },
```

```ts
// DUSK_VIOLET
  terrain: { meadow: 0x2a2438, mist: 0x333048, thicket: 0x443a58, rock: 0x4a3b44, cliff: 0x1d1826 },
```

- [ ] **Step 5: 實作 `terrain.ts`**

Create `src/core/terrain.ts`:

```ts
import { valueNoise, layered } from './noise';
import type { Rng } from './rng';
import type { TerrainType } from './types';

// 高程分帶門檻（第一版，待實測調整）。value noise 的取值集中在 0.5 附近，
// 因此 0.82 以上只佔少數——崖壁要夠稀少才不會把地圖切碎，但必須真的存在，
// 否則「不可通行」這一層成本層級形同虛設。
export const BAND_CLIFF = 0.82;
export const BAND_ROCK = 0.62;
export const BAND_THICKET = 0.38;
// 低地的乾濕分界：濕的成霧谷、乾的成草坡
export const BAND_MOIST = 0.55;

// 地形由「高程＋濕度」推導，不再逐格獨立抽樣。分帶由高到低：
// 崖壁（不可通行的稜脊）→ 岩坡 → 密叢（林線）→ 低地（依濕度分成霧谷／草坡）。
export function terrainFor(elevation: number, moisture: number): TerrainType {
  if (elevation >= BAND_CLIFF) return 'cliff';
  if (elevation >= BAND_ROCK) return 'rock';
  if (elevation >= BAND_THICKET) return 'thicket';
  return moisture >= BAND_MOIST ? 'mist' : 'meadow';
}

// 低頻格數：整張圖切成 3×3 的大地貌骨架，細節層 7×7 疊上局部起伏。
// 寫死而非依 size 縮放——同一套骨架比例讓 15×15 與 25×25 讀起來是同一個世界。
const BASE_GRID = 3;
const DETAIL_GRID = 7;

// rng 消耗次數固定為 (3+1)^2 + (7+1)^2 + (3+1)^2 + (7+1)^2 = 160，與地圖大小無關。
// elevationBias 為生物個性用的高程偏移（見 quirks.ts），夾限後仍落在 0..1。
export function buildTerrain(
  rng: Rng, size: number, elevationBias: number,
): { terrain: TerrainType[][]; elevation: number[][] } {
  const elev = layered(valueNoise(rng, BASE_GRID), valueNoise(rng, DETAIL_GRID));
  const moist = layered(valueNoise(rng, BASE_GRID), valueNoise(rng, DETAIL_GRID));

  const terrain: TerrainType[][] = [];
  const elevation: number[][] = [];
  // size 為 1 時 (size-1) 會是 0，除法產生 NaN；以 1 保底讓單格地圖仍取樣到 (0,0)
  const span = Math.max(1, size - 1);
  for (let y = 0; y < size; y++) {
    const trow: TerrainType[] = [];
    const erow: number[] = [];
    for (let x = 0; x < size; x++) {
      const u = x / span;
      const v = y / span;
      const e = Math.min(1, Math.max(0, elev.at(u, v) + elevationBias));
      erow.push(e);
      trow.push(terrainFor(e, moist.at(u, v)));
    }
    terrain.push(trow);
    elevation.push(erow);
  }
  return { terrain, elevation };
}
```

- [ ] **Step 6: 執行測試確認通過**

Run: `npx vitest run tests/terrain.test.ts`
Expected: PASS（2 個 describe、共 10 個測試全綠）

- [ ] **Step 7: 全量測試（預期會紅，這是下一個 Step 要修的）**

Run: `npm run test`
Expected: FAIL — `tests/palette.test.ts` 可能斷言地形色鍵數量；`tests/session.test.ts`／`tests/events.test.ts`／`tests/deduction.test.ts` 的手工 `Level` 常數缺 `elevation` 欄位而型別不符。

- [ ] **Step 8: 補齊所有手工 `Level` 常數的 `elevation` 欄位**

Run: `grep -rn "mapSize:" tests/ | grep -v "expect"`
Expected: 列出所有自造 `Level` 的測試檔。

對每一個自造 `Level` 的地方，在 `terrain` 欄位旁補上同尺寸的高程網格。以 `tests/session.test.ts` 的 `makeState` 為例（5×5 全草地）：

```ts
  const terrain: TerrainType[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 'meadow' as TerrainType));
  const elevation: number[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 0.2)); // 低地：與 meadow 一致，視野不加成
```

並把 `elevation` 加進 `level` 物件字面值。`tests/deduction.test.ts` 的 `makeLevel` 與 `tests/events.test.ts` 的對應處同樣處理，高程值皆用 `0.2`。

`tests/palette.test.ts:23` 的 `it('every cycle defines all four terrain colors, mutually distinct', ...)` 會因為第五種地形而失敗。把它改成：

```ts
  it('every cycle defines all five terrain colors, mutually distinct', () => {
    for (const r of [1, 5, 9]) {
      const t = getPalette(r).terrain;
      const values = TERRAIN_TYPES.map((type) => t[type]);
      expect(values).toHaveLength(5);
      expect(new Set(values).size).toBe(5); // 互不相同：崖壁必須與岩坡分得開
    }
  });
```

並把 `TERRAIN_TYPES` 加進該檔的 import。用 `TERRAIN_TYPES` 逐項取值而非寫死四個鍵名，日後再加地形時這條測試會自己跟上。

- [ ] **Step 9: 全量測試與建置**

Run: `npm run test && npm run build`
Expected: 全綠、建置無錯。此時 `generate.ts` 尚未改用 `buildTerrain`（Task 4 才接），但 `Level.elevation` 已是必填欄位，因此 `generate.ts` 也必須先補上一個暫時的高程網格才能編譯——在 `generateLevelFor` 的 `return` 之前加：

```ts
  // 暫時的均一高程（Task 4 改用 buildTerrain 之後即被取代）
  const elevation: number[][] = terrain.map((row) => row.map(() => 0.2));
```

並把 `elevation` 加進回傳物件。

- [ ] **Step 10: Commit**

```bash
git add src/core/terrain.ts src/core/types.ts src/core/palette.ts src/core/generate.ts tests/
git commit -m "feat: derive terrain from elevation and moisture noise, add impassable cliffs"
```

---

### Task 3: 成本層級與體力再平衡

崖壁要真的走不過去，岩坡要真的值得繞路。`TERRAIN_COST` 的 `cliff` 用 `Infinity`——`canMove` 既有的 `s.stamina >= TERRAIN_COST[...]` 判斷對 `Infinity` 恆為 false，不需要額外的通行判斷分支。

**Files:**
- Modify: `src/core/session.ts`（`TERRAIN_COST`、新增 `isPassable`）
- Modify: `src/core/difficulty.ts`（`staminaBudget` 三檔）
- Test: `tests/session.test.ts`, `tests/difficulty.test.ts`

**Interfaces:**
- Produces: `isPassable(t: TerrainType): boolean`；`TERRAIN_COST` 值改為 `{ meadow: 1, mist: 1, thicket: 2, rock: 4, cliff: Infinity }`

- [ ] **Step 1: 寫失敗的測試**

在 `tests/session.test.ts` 的 import 加入 `isPassable`，並於檔案末尾追加：

```ts
describe('terrain cost tiers', () => {
  it('spreads cost across three passable tiers plus an impassable one', () => {
    expect(TERRAIN_COST.meadow).toBe(1);
    expect(TERRAIN_COST.mist).toBe(1);
    expect(TERRAIN_COST.thicket).toBe(2);
    expect(TERRAIN_COST.rock).toBe(4);
    expect(Number.isFinite(TERRAIN_COST.cliff)).toBe(false);
  });

  it('isPassable rejects only cliffs', () => {
    expect(isPassable('meadow')).toBe(true);
    expect(isPassable('rock')).toBe(true);
    expect(isPassable('cliff')).toBe(false);
  });
});

describe('canMove: cliffs', () => {
  it('refuses to enter a cliff no matter how much stamina remains', () => {
    const s = makeState({ stamina: 9999 });
    s.level.terrain[1][0] = 'cliff';
    expect(canMove(s, { x: 0, y: 1 })).toBe(false);
  });

  it('a blocked move changes nothing — no step, no stamina, no phase change', () => {
    const s = makeState({ stamina: 10 });
    s.level.terrain[1][1] = 'cliff';
    move(s, { x: 1, y: 1 });
    expect(s.player).toEqual({ x: 0, y: 0 });
    expect(s.stamina).toBe(10);
    expect(s.steps).toBe(0);
    expect(s.phase).toBe('explore');
  });

  it('cliffs alone never strand the player — retreat is always available', () => {
    const s = makeState({ stamina: 50 });
    // 除了來路 (0,0) 之外，把 (1,1) 的所有界內鄰格封死
    for (const [x, y] of [[1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]] as const) {
      s.level.terrain[y][x] = 'cliff';
    }
    move(s, { x: 1, y: 1 });
    expect(s.player).toEqual({ x: 1, y: 1 });
    // 還退得回 (0,0)，所以不算力竭——力竭永遠來自體力歸零，不是被崖壁圍死
    expect(s.phase).toBe('explore');
  });
});
```

在 `tests/difficulty.test.ts` 末尾追加：

```ts
describe('stamina budget vs terrain cost', () => {
  it('scales with the new cost tiers — roughly 45-55 steps per tier', () => {
    // 新地形分布的加權平均成本約 1.6/步（草地霧谷 1、密叢 2、岩坡 4）。
    // 預算除以平均成本應落在「夠走完一趟推理、但不夠亂走」的區間。
    for (const round of [1, 5, 9]) {
      const steps = getDifficulty(round).staminaBudget / 1.6;
      expect(steps).toBeGreaterThan(30);
      expect(steps).toBeLessThan(90);
    }
  });

  it('grows monotonically with the difficulty tiers', () => {
    expect(getDifficulty(1).staminaBudget).toBeLessThan(getDifficulty(5).staminaBudget);
    expect(getDifficulty(5).staminaBudget).toBeLessThan(getDifficulty(9).staminaBudget);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/session.test.ts tests/difficulty.test.ts`
Expected: FAIL — `isPassable is not exported`，以及 `TERRAIN_COST.rock` 為 2 而非 4

- [ ] **Step 3: 實作成本層級（定義在 `terrain.ts`，`session.ts` 轉出）**

> **為什麼不直接寫在 `session.ts`：** Task 4 的 `reach.ts` 需要 `isPassable`、`generate.ts` 需要
> `startCorner`，而 `session.ts` 匯入 `generate.ts`——實作若留在 session，會形成
> `session → generate → reach → session` 的循環匯入。ESM 下能跑但很脆弱。三者一次
> 落在 `terrain.ts`，`session.ts` 只保留 re-export，既有呼叫端（MapScene、測試）不必動。

把 `src/core/session.ts` 中的 `TERRAIN_COST` 常數與私有的 `startPos` 函式**刪除**，
並在 `src/core/terrain.ts` 末尾追加三者的實作：

```ts
import { dist, type Vec2 } from './geometry';

// 地形成本四層（第一版，待實測調整）：草地／霧谷 1、密叢 2、岩坡 4、崖壁不可通行。
// 拉開層級是為了讓「繞路」真的值得算——舊版只有 1 和 2 兩檔，省下的體力太少，
// 玩家兩局後就不再思考路線。cliff 用 Infinity 而非旗標：canMove 既有的
// 「stamina >= cost」判斷對 Infinity 恆為 false，通行性因此自動成立，
// 不需要在每個呼叫點多一條分支。
export const TERRAIN_COST: Record<TerrainType, number> = {
  meadow: 1, mist: 1, thicket: 2, rock: 4, cliff: Infinity,
};

export const isPassable = (t: TerrainType): boolean => Number.isFinite(TERRAIN_COST[t]);

// 出生角：離目標最遠的那個角落。Task 4 的可達性保證（generate.ts）與 session 的
// 開局位置共用同一份定義——兩邊各算一次遲早會不一致。
export function startCorner(mapSize: number, target: Vec2): Vec2 {
  const s = mapSize - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, target) > dist(a, target) ? b : a));
}
```

在 `src/core/session.ts` 頂部改為匯入並轉出（保留既有呼叫端的匯入路徑）：

```ts
import { TERRAIN_COST, isPassable, startCorner } from './terrain';

// 實作已移至 terrain.ts 以打斷 session → generate → reach → session 的循環匯入；
// 既有呼叫端（MapScene、測試）沿用 session 的匯入點不變
export { TERRAIN_COST, isPassable, startCorner };
```

`newSession` 中的 `const player = startPos(level);` 改為：

```ts
  const player = startCorner(level.mapSize, level.targetPos);
```

`session.ts` 若因此不再使用 `dist`，把它從 `./geometry` 的匯入清單移除（`cheb` 仍有用）。

- [ ] **Step 4: 調整體力預算**

在 `src/core/difficulty.ts` 把三檔的 `staminaBudget` 依新的平均成本上調（第一版，待實測調整）：

- 第 1–3 局：`staminaBudget: 45` → `staminaBudget: 60`
- 第 4–7 局：`staminaBudget: 70` → `staminaBudget: 95`
- 第 8 局以後：`staminaBudget: 95` → `staminaBudget: 130`

在 `getDifficulty` 上方加一行說明：

```ts
// 體力預算對應 Phase 5 的四層地形成本（平均約 1.6/步，舊版為 1.3）。
// 三檔皆換算約 37–81 步，與改動前的步數區間相當——變的是「每一步值多少」，
// 不是「總共能走幾步」。
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run tests/session.test.ts tests/difficulty.test.ts`
Expected: PASS

- [ ] **Step 6: 全量測試與建置**

Run: `npm run test && npm run build`
Expected: 全綠、建置無錯。

- [ ] **Step 7: Commit**

```bash
git add src/core/session.ts src/core/difficulty.ts tests/session.test.ts tests/difficulty.test.ts
git commit -m "feat: four-tier terrain cost with impassable cliffs, rebalance stamina"
```

---

### Task 4: 連通性保證與生成接線

把 `generate.ts` 的逐格抽樣換成 `buildTerrain`，並在其後跑一次連通性保證——崖壁不得把目標、線索或補給隔在玩家走不到的地方。這是「反向錨定必定有解」在 Phase 5 的延伸：線索的**幾何**可解性由反向錨定保證，**物理**可達性由這裡保證。

`quirks.terrainPoolFor` 隨之退場——地形不再從池中抽樣，`ridgecrest`「岩坡遍布」的個性改為高程偏移。

**Files:**
- Modify: `src/core/geometry.ts`（新增 `bresenham`）
- Create: `src/core/reach.ts`
- Modify: `src/core/generate.ts`
- Modify: `src/core/quirks.ts`（`terrainPoolFor` → `elevationBiasFor`）
- Modify: `src/core/events.ts`（`findNearbyEmptyCell` 排除不可通行格）
- Test: `tests/reach.test.ts`, `tests/geometry.test.ts`, `tests/generate.test.ts`, `tests/quirks.test.ts`

**Interfaces:**
- Consumes: `buildTerrain` from `src/core/terrain`（Task 2）；`isPassable` from `src/core/session`（Task 3）
- Produces:
  - `bresenham(a: Vec2, b: Vec2): Vec2[]`（含端點）
  - `reachableFrom(terrain: TerrainType[][], from: Vec2): Set<string>`
  - `ensureReachable(terrain: TerrainType[][], from: Vec2, required: Vec2[]): void`（就地把阻隔的 `cliff` 降級為 `rock`）
  - `elevationBiasFor(creatureId: string): number`（取代 `terrainPoolFor`）

- [ ] **Step 1: 寫失敗的測試**

在 `tests/geometry.test.ts` 末尾追加：

```ts
describe('bresenham', () => {
  it('includes both endpoints', () => {
    const line = bresenham({ x: 0, y: 0 }, { x: 3, y: 0 });
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 3, y: 0 });
  });
  it('walks a diagonal one cell at a time', () => {
    expect(bresenham({ x: 0, y: 0 }, { x: 2, y: 2 }))
      .toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
  });
  it('returns a single cell when both ends are the same', () => {
    expect(bresenham({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([{ x: 4, y: 4 }]);
  });
  it('every consecutive pair is chebyshev-adjacent', () => {
    const line = bresenham({ x: 0, y: 0 }, { x: 7, y: 3 });
    for (let i = 1; i < line.length; i++) {
      expect(cheb(line[i - 1], line[i])).toBe(1);
    }
  });
});
```

（`bresenham` 與 `cheb` 需加進該檔的 import。）

Create `tests/reach.test.ts`:

```ts
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
    const t = grid(['.#.']);
    ensureReachable(t, { x: 0, y: 0 }, [{ x: 2, y: 0 }]);
    expect(t[0][1]).toBe('rock');
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
```

在 `tests/generate.test.ts` 末尾追加：

```ts
describe('generateLevel: physical reachability', () => {
  it('every clue, supply and the target is walkable from the spawn corner', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const s = level.mapSize - 1;
        const corners = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
        const start = corners.reduce((a, b) =>
          (dist(b, level.targetPos) > dist(a, level.targetPos) ? b : a));
        const seen = reachableFrom(level.terrain, start);
        expect(seen.has(key(level.targetPos))).toBe(true);
        for (const c of level.clues) expect(seen.has(key(c.position))).toBe(true);
        for (const p of level.supplies) expect(seen.has(key(p))).toBe(true);
      }
    }
  });

  it('never places the target on an impassable cell', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const level = generateLevel(5, mulberry32(seed));
      expect(level.terrain[level.targetPos.y][level.targetPos.x]).not.toBe('cliff');
    }
  });

  it('stays deterministic for a given seed', () => {
    expect(generateLevel(5, mulberry32(33))).toEqual(generateLevel(5, mulberry32(33)));
  });
});
```

（該檔需補入 `reachableFrom`、`key`、`dist` 的 import。）

在 `tests/quirks.test.ts` 中，把針對 `terrainPoolFor` 的測試整段換成：

```ts
describe('elevationBiasFor', () => {
  it('lifts ridgecrest onto higher ground', () => {
    expect(elevationBiasFor('ridgecrest')).toBeGreaterThan(0);
  });
  it('leaves every other creature at the default elevation', () => {
    for (const id of ['mistfawn', 'dewhopper', 'veilmoth', 'plumetail']) {
      expect(elevationBiasFor(id)).toBe(0);
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/reach.test.ts tests/geometry.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/reach"`、`bresenham is not a function`

- [ ] **Step 3: 實作 `bresenham`**

在 `src/core/geometry.ts` 末尾追加：

```ts
// 兩點間的整數格連線（含端點），相鄰兩格恆為 Chebyshev 相鄰——
// 與玩家的八方向移動規則一致，因此挖出來的通道保證走得通。
export function bresenham(a: Vec2, b: Vec2): Vec2[] {
  const out: Vec2[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - x);
  const dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) return out;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
```

- [ ] **Step 4: 實作 `reach.ts`**

Create `src/core/reach.ts`:

```ts
import { bresenham, type Vec2 } from './geometry';
import { key } from './clues';
import { isPassable } from './terrain';
import type { TerrainType } from './types';

// 從 from 出發、以八方向走訪所有可通行格。起點本身不可通行時回傳空集合
// （呼叫端應先確保起點可通行——ensureReachable 會處理）。
export function reachableFrom(terrain: TerrainType[][], from: Vec2): Set<string> {
  const size = terrain.length;
  const seen = new Set<string>();
  if (!isPassable(terrain[from.y][from.x])) return seen;
  const queue: Vec2[] = [from];
  seen.add(key(from));
  while (queue.length > 0) {
    const p = queue.pop()!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < 0 || q.y < 0 || q.x >= size || q.y >= size) continue;
        const k = key(q);
        if (seen.has(k) || !isPassable(terrain[q.y][q.x])) continue;
        seen.add(k);
        queue.push(q);
      }
    }
  }
  return seen;
}

// 物理可達性保證：反向錨定保證線索在「幾何上」有解，這裡保證它們在「物理上」走得到。
// 對每一個從起點走不到的必要格，沿它與起點的直線把崖壁降級為岩坡，然後重新走訪。
// 降級為 rock（成本 4）而非 meadow：挖出來的隘口仍然昂貴，繞不繞路依舊是個決定。
export function ensureReachable(
  terrain: TerrainType[][], from: Vec2, required: Vec2[],
): void {
  // 起點必須先能站人，否則 reachableFrom 一律回空集合
  if (!isPassable(terrain[from.y][from.x])) terrain[from.y][from.x] = 'rock';

  // 每輪最多解決一格，故迴圈上限即必要格數；每輪都重算可達集合，
  // 因為挖通一格常常順帶接上其他格
  for (let pass = 0; pass <= required.length; pass++) {
    const seen = reachableFrom(terrain, from);
    const stranded = required.find((p) => !seen.has(key(p)));
    if (!stranded) return;
    for (const c of bresenham(stranded, from)) {
      if (terrain[c.y][c.x] === 'cliff') terrain[c.y][c.x] = 'rock';
    }
  }
}
```

- [ ] **Step 5: 把 `quirks.terrainPoolFor` 換成 `elevationBiasFor`**

在 `src/core/quirks.ts` 刪除 `BASE_POOL` 常數與整個 `terrainPoolFor` 函式，換成：

```ts
// 生物個性的地形面向：稜脊獸漫遊的山域整體抬高，岩坡與崖壁因此格外遍布。
// 舊版是「調整地形抽樣權重」，地形改由高程推導後，等價的作法是位移高程場本身——
// 這樣抬高的是連續的地貌（更多稜線），而不是散落的岩塊。
export function elevationBiasFor(creatureId: string): number {
  return creatureId === 'ridgecrest' ? 0.15 : 0;
}
```

同時把 `src/data/creatures.ts` 中 `ridgecrest` 的 `terrain` 偏好保持 `'rock'` 不變——它仍是目標所在格的強制地形。

- [ ] **Step 6: 接進 `generate.ts`**

在 `src/core/generate.ts` 的 import 調整：

```ts
import { applyQuirk, elevationBiasFor } from './quirks';
import { buildTerrain } from './terrain';
import { ensureReachable } from './reach';
import { startCorner } from './terrain';
```

把原本的地形生成段落（`const pool = terrainPoolFor(creatureId);` 起，到 `terrain[targetPos.y][targetPos.x] = creature.terrain;` 止）整段換成：

```ts
  const { terrain, elevation } = buildTerrain(rng, size, elevationBiasFor(creatureId));
  // 目標所在格強制為該生物的偏好地形——這也順帶保證目標永遠不落在崖壁上
  terrain[targetPos.y][targetPos.x] = creature.terrain;
```

補給生成的 `randomPos` 迴圈中，加入不可通行格的排除（`taken` 之外再加一條）：

```ts
  const taken = new Set([key(targetPos), ...clues.map((c) => key(c.position))]);
  const supplies: Vec2[] = [];
  for (let i = 0; i < 200 && supplies.length < p2.supplyCount; i++) {
    const s = randomPos(rng, size);
    // 崖壁上放補給等於放不到——ensureReachable 只保證走得到，不會把崖壁變成好走的路
    if (!taken.has(key(s)) && terrain[s.y][s.x] !== 'cliff') {
      taken.add(key(s));
      supplies.push(s);
    }
  }
```

線索格若落在崖壁上同樣走不到，在 `ensureReachable` 之前先降級：

```ts
  // 線索必須踩得到才能判讀；落在崖壁上的線索格先降級為岩坡（代價高但走得到）
  for (const c of clues) {
    if (terrain[c.position.y][c.position.x] === 'cliff') {
      terrain[c.position.y][c.position.x] = 'rock';
    }
  }

  // 物理可達性保證（見 reach.ts）：目標、所有線索、所有補給都必須從出生角走得到
  const start = startCorner(size, targetPos);
  ensureReachable(terrain, start, [targetPos, ...clues.map((c) => c.position), ...supplies]);
```

最後把回傳物件的暫時高程換成真的（刪掉 Task 2 Step 9 加的那兩行）：

```ts
  return {
    round, mapSize: size, targetPos, clues, terrain, elevation, supplies,
    creatureId: creature.id, weather, iris,
  };
```

- [ ] **Step 7: 微事件排除不可通行格**

在 `src/core/events.ts` 的 `isOccupiedCell` 加入地形判斷（額外補給不能落在崖壁上）：

```ts
function isOccupiedCell(level: Level, p: Vec2): boolean {
  const k = key(p);
  if (key(level.targetPos) === k) return true;
  if (level.clues.some((c) => key(c.position) === k)) return true;
  if (level.supplies.some((s) => key(s) === k)) return true;
  // 崖壁上的補給撿不到——視同已佔用，讓 findNearbyEmptyCell 換下一格
  if (!isPassable(level.terrain[p.y][p.x])) return true;
  return false;
}
```

並補上 `import { isPassable } from './terrain';`。

- [ ] **Step 8: 執行測試確認通過**

Run: `npm run test`
Expected: PASS。`tests/generate.test.ts` 的可達性測試（40 顆種子 × 3 個難度）是本任務的核心驗收。

- [ ] **Step 9: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。若出現 `terrainPoolFor` 找不到，表示還有殘留呼叫端：`grep -rn "terrainPoolFor" src/ tests/` 後一併清掉。

- [ ] **Step 10: Commit**

```bash
git add src/core/ tests/
git commit -m "feat: noise-derived terrain with a physical reachability guarantee"
```

---

### Task 5: Phase 5 的 i18n 字串

Task 6、10、11、13 需要的所有面向玩家文字，一次補齊。

**Files:**
- Modify: `src/core/i18n.ts`

**Interfaces:**
- Produces: `terrain.cliff`、`hud.survey`、`hud.surveyCost`、`hud.pathCost`、`help.vision`、`help.survey`、`help.route`

- [ ] **Step 1: 擴充 MsgKey 聯集**

在 `src/core/i18n.ts` 的 `MsgKey` 聯集末尾（`| 'help.marks' | 'help.layer' | 'help.reveal'` 之後）插入：

```ts
  | 'terrain.cliff'
  | 'hud.survey' | 'hud.surveyCost' | 'hud.pathCost'
  | 'help.vision' | 'help.survey' | 'help.route'
```

- [ ] **Step 2: 新增 en 字串**

在 `STRINGS.en` 的 `'help.reveal'` 那一行之後插入：

```ts
    'terrain.cliff': 'Cliff — no way through.',
    'hud.survey': 'Look',
    'hud.surveyCost': '-{n} to look around',
    'hud.pathCost': '{n}',
    'help.vision': 'You only see the ground near you. High ground sees further; thickets close in.',
    'help.survey': 'Look costs stamina and sweeps the ground around you, uncovering clues you have not walked past.',
    'help.route': 'Click a distant cell to preview the route and its cost, then click again to walk it. Walking stops the moment you read something new.',
```

- [ ] **Step 3: 新增 zh-TW 字串**

在 `STRINGS['zh-TW']` 的 `'help.reveal'` 那一行之後插入：

```ts
    'terrain.cliff': '崖壁——過不去。',
    'hud.survey': '眺望',
    'hud.surveyCost': '眺望 -{n}',
    'hud.pathCost': '{n}',
    'help.vision': '你只看得見身邊的地面。高處望得遠，密叢裡看不遠。',
    'help.survey': '「眺望」消耗體力，掃過身邊一圈地面，找出你還沒走過的線索。',
    'help.route': '點遠處的格子會先預覽路線與總花費，再點一次才會走。一讀到新東西就會立刻停下。',
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/i18n.test.ts`
Expected: PASS——特別是 `en and zh-TW cover exactly the same keys` 這條。

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n.ts
git commit -m "feat: add i18n strings for cliffs, vision, survey and routing"
```

---

### Task 6: 地形呈現與說明頁圖例

讓新地貌看得出來，並把崖壁加進說明頁的地形圖例。**這一步結束時分支可獨立出貨**（見上方「出貨檢查點」）。

**Files:**
- Modify: `src/scenes/MapScene.ts`（HUD 地形圖例、背景繪製的崖壁描邊）
- Modify: `src/scenes/HelpScene.ts`（地形列加入崖壁）

**Interfaces:**
- Consumes: `TERRAIN_TYPES`（已含 `cliff`）；`terrain.cliff` 字串（Task 5）

- [ ] **Step 1: HUD 迷你圖例納入崖壁**

`MapScene.buildHud()` 的圖例區塊目前寫死四種地形並顯示 `TERRAIN_COST` 數字，`cliff` 的成本是 `Infinity` 會渲染成 `"Infinity"`。把該區塊的 `order` 與成本字串改為：

```ts
      const order: TerrainType[] = ['meadow', 'mist', 'thicket', 'rock', 'cliff'];
      // 崖壁成本為 Infinity，直接印會變成 "Infinity"——改用 ✕ 表示不可通行
      const costs = order.map((t) => (isPassable(t) ? String(TERRAIN_COST[t]) : '✕'));
```

並把 `isPassable` 加進該檔自 `../core/session` 的匯入。圖例現在有五格，`lx` 起點由 250 改為 232 讓整列仍容納得下。

- [ ] **Step 2: 崖壁的視覺區辨**

崖壁若只靠色塊，暗色調下與岩坡不易分辨。在 `MapScene.buildBackground()` 的地形色塊迴圈之後、`paintTerrainTexture` 之前，補一段崖壁描邊：

```ts
    // 崖壁：色塊之外再描一道細亮邊。純色差在暗色調配色下不夠可讀，
    // 而「哪裡過不去」是玩家每一步都要判斷的事，不能靠猜。
    ctx.filter = 'none';
    ctx.strokeStyle = cssRgba(this.pal.paper, 0.22);
    ctx.lineWidth = 1;
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        if (L.terrain[y][x] !== 'cliff') continue;
        ctx.strokeRect(x * cs + 1.5, y * cs + 1.5, cs - 3, cs - 3);
      }
    }
```

（注意這段必須放在 `ctx.filter = 'none';` 之後，否則描邊會被模糊掉。既有程式碼在色塊迴圈後已有一行 `ctx.filter = 'none';`，把本段接在它下面即可，不要重複設定。）

- [ ] **Step 3: hover 顯示不可通行**

`MapScene.drawHover()` 目前顯示地形成本數字。崖壁要顯示 `✕` 而非 `Infinity`：

```ts
    const t = s.level.terrain[c.y][c.x];
    this.hoverCostText?.setText(isPassable(t) ? String(TERRAIN_COST[t]) : '✕')
      .setPosition(x + cs - 3, y + cs - 3).setVisible(true);
```

- [ ] **Step 4: 說明頁地形列納入崖壁**

`HelpScene` 的 `rows` 陣列中，`help.stamina` 那一列的 icon 目前畫兩顆補給。地形成本的說明已於 Phase 4 併入 `help.stamina` 的文字，但圖例只在 HUD 出現。在 `help.stamina` 之後、`help.marks` 之前**不新增列**（版面預算已滿，見該檔 `ph` 註解）——改為把崖壁併進既有 `help.stamina` 那一列的 icon：

```ts
      {
        y: py0 + 354, key: 'help.stamina',
        icon: (y) => {
          drawSupply(icons, rowX - 14, y, 34, 0, pal);
          drawSupply(icons, rowX + 2, y, 34, 1, pal);
          // 崖壁小方塊＋叉：與 HUD 圖例同一套語彙
          icons.fillStyle(pal.terrain.cliff, 1).fillRect(rowX + 14, y - 5, 10, 10);
          icons.lineStyle(1.4, pal.paperDim, 0.9);
          icons.lineBetween(rowX + 16, y - 3, rowX + 22, y + 3);
          icons.lineBetween(rowX + 22, y - 3, rowX + 16, y + 3);
        },
      },
```

並把 `help.stamina` 的兩份字串改寫，納入新的成本層級與崖壁：

en:
```ts
    'help.stamina': 'Every step costs stamina — meadow and fog 1, thicket 2, scree 4. Cliffs cannot be crossed. Mistleaf and dewfruit restore it.',
```

zh-TW:
```ts
    'help.stamina': '每一步都消耗體力：草地／霧谷 1，密叢 2，岩坡 4，崖壁過不去。霧葉與露珠果可以回復。',
```

- [ ] **Step 5: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。

- [ ] **Step 6: 人工冒煙**

Run: `npm run dev`，進入第一局。
Expected:
1. 地圖看得出連續的地貌——有成片的草坡、成條的林線、成脊的岩區，而不是散點。
2. 崖壁是最暗的色塊且有細亮邊，hover 顯示 `✕`。
3. HUD 圖例五格，最後一格是崖壁配 `✕`。
4. 點擊崖壁不會移動、不扣體力。
5. 第 4 局（赭石配色）與第 8 局（暮色紫）下崖壁仍可辨識。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/MapScene.ts src/scenes/HelpScene.ts src/core/i18n.ts
git commit -m "feat: render cliffs and fold the cost tiers into the help panel"
```

---

### Task 7: 視野模型

玩家不再一開局就看見整張地圖上的所有線索 token。這是診斷 A-01／A-05 的核心修正：探索段第一次有「未知」。

**Files:**
- Create: `src/core/vision.ts`
- Test: `tests/vision.test.ts`

**Interfaces:**
- Consumes: `TerrainType` from `src/core/types`；`Vec2`, `cheb` from `src/core/geometry`；`key` from `src/core/clues`
- Produces:
  - `visionRadius(terrain: TerrainType, elevation: number): number`
  - `cellsWithin(center: Vec2, radius: number, mapSize: number): string[]`
  - 常數 `BASE_VISION`、`SURVEY_COST`、`SURVEY_BONUS`

> **刻意不做遮蔽（line of sight）。** 視野是半徑，不做射線遮擋。密叢以「縮小半徑」表達，而不是「擋住身後的格子」。完整 LOS 會讓玩家難以預期自己看得到什麼，而本階段的目的是讓探索有方向感，不是做戰術視野。

- [ ] **Step 1: 寫失敗的測試**

Create `tests/vision.test.ts`:

```ts
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/vision.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/vision"`

- [ ] **Step 3: 實作**

Create `src/core/vision.ts`:

```ts
import { key } from './clues';
import type { Vec2 } from './geometry';
import type { TerrainType } from './types';

// 視野與眺望的數值（第一版，待實測調整）
export const BASE_VISION = 3;
export const SURVEY_COST = 4;
export const SURVEY_BONUS = 3; // 眺望半徑 = 當前視野半徑 + 此值

// 站在哪裡決定看得多遠：高處望得遠（最多 +2），密叢裡看不遠（-1），下限 2 格。
// 刻意不做射線遮蔽——視野是半徑而非可視錐，玩家才能預期自己看得到什麼。
export function visionRadius(terrain: TerrainType, elevation: number): number {
  let r = BASE_VISION;
  if (elevation >= 0.5) r += Math.min(2, Math.floor((elevation - 0.5) * 8));
  if (terrain === 'thicket') r -= 1;
  return Math.max(2, r);
}

// 以 center 為中心、半徑 radius 的 Chebyshev 方形，夾限在地圖界內，回傳位置鍵。
export function cellsWithin(center: Vec2, radius: number, mapSize: number): string[] {
  const out: string[] = [];
  const x0 = Math.max(0, center.x - radius);
  const x1 = Math.min(mapSize - 1, center.x + radius);
  const y0 = Math.max(0, center.y - radius);
  const y1 = Math.min(mapSize - 1, center.y + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push(key({ x, y }));
  }
  return out;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/vision.test.ts`
Expected: PASS（2 個 describe、共 9 個測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/core/vision.ts tests/vision.test.ts
git commit -m "feat: terrain- and elevation-aware vision radius"
```

---

### Task 8: 起始線索

視野一旦收窄，出生角附近通常一條線索都看不到——線索是繞著目標生成的，而出生角是離目標最遠的角落。開局面對一片空白會變成漫無目的地亂走，比原本的問題更糟。

解法：生成期指定一條真線索為「起始蹤跡」，開局即可見。玩家永遠有一條線可以拉，其餘的要靠走與眺望去找。

**Files:**
- Modify: `src/core/types.ts`（`Level` 加 `trailheadIndex`）
- Modify: `src/core/generate.ts`
- Test: `tests/generate.test.ts`

**Interfaces:**
- Produces: `Level.trailheadIndex: number`——非幌子線索的索引，開局即揭示

- [ ] **Step 1: 寫失敗的測試**

在 `tests/generate.test.ts` 末尾追加：

```ts
describe('generateLevel: trailhead', () => {
  it('always names a real clue as the trailhead', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const clue = level.clues[level.trailheadIndex];
        expect(clue).toBeDefined();
        expect(clue.isDecoy).toBe(false);
      }
    }
  });

  it('picks the real clue nearest the spawn corner, so there is a thread to pull', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const level = generateLevel(5, mulberry32(seed));
      const start = startCorner(level.mapSize, level.targetPos);
      const chosen = level.clues[level.trailheadIndex];
      for (const c of level.clues) {
        if (c.isDecoy) continue;
        expect(dist(start, chosen.position)).toBeLessThanOrEqual(dist(start, c.position));
      }
    }
  });
});
```

（該檔需補入 `startCorner` 的 import。）

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/generate.test.ts`
Expected: FAIL — `level.trailheadIndex` 為 `undefined`

- [ ] **Step 3: 擴充 `Level`**

在 `src/core/types.ts` 的 `Level` 介面補一欄：

```ts
  creatureId: string;
  trailheadIndex: number; // 開局即揭示的真線索索引——玩家永遠有一條線可以拉
  weather: Weather;
```

- [ ] **Step 4: 實作**

在 `src/core/generate.ts` 的 `ensureReachable` 呼叫之後、`return` 之前插入：

```ts
  // 起始蹤跡：離出生角最近的真線索。視野收窄後，出生角附近通常一條線索都看不見，
  // 開局面對全空的地圖會變成亂走——給玩家一條線可以拉，其餘的靠走與眺望自己找。
  let trailheadIndex = 0;
  let best = Infinity;
  clues.forEach((c, i) => {
    if (c.isDecoy) return;
    const d = dist(start, c.position);
    if (d < best) { best = d; trailheadIndex = i; }
  });
```

並把 `trailheadIndex` 加進回傳物件。

> 真線索一定存在：`p2.clueCount` 在所有難度皆 ≥ 4，且幌子是在真線索之後才追加的，因此 `clues` 的前 `clueCount` 筆必為真線索，迴圈必定至少命中一次。

- [ ] **Step 5: 執行測試確認通過**

Run: `npm run test`
Expected: PASS。其他測試檔中自造的 `Level` 常數需補 `trailheadIndex: 0`——`npm run test` 的型別錯誤會指出位置。

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/generate.ts tests/
git commit -m "feat: reveal one real clue as the trailhead so the map is never blank"
```

---

### Task 9: session 接上視野與眺望

**Files:**
- Modify: `src/core/session.ts`
- Test: `tests/session.test.ts`

**Interfaces:**
- Consumes: `visionRadius`, `cellsWithin`, `SURVEY_COST`, `SURVEY_BONUS` from `src/core/vision`（Task 7）
- Produces:
  - `SessionState` 新增 `seen: Set<string>`、`surveyed: Set<string>`
  - `revealAround(s: SessionState): void`（就地把當前視野內的格加入 `seen`）
  - `survey(s: SessionState): boolean`（花體力掃視一圈；已在此格眺望過或體力不足時回傳 `false`）

- [ ] **Step 1: 寫失敗的測試**

在 `tests/session.test.ts` 的 import 加入 `survey`，`makeState` 的回傳物件補上兩欄：

```ts
    seen: new Set(), surveyed: new Set(),
```

檔案末尾追加：

```ts
describe('vision', () => {
  it('seeds seen with the spawn vision and the trailhead cell', () => {
    const s = newSession(1, mulberry32(11));
    expect(s.seen.has(key(s.player))).toBe(true);
    expect(s.seen.has(key(s.level.clues[s.level.trailheadIndex].position))).toBe(true);
  });

  it('does not start with the whole map revealed', () => {
    const s = newSession(9, mulberry32(11)); // 25x25 = 625 格
    expect(s.seen.size).toBeLessThan(s.level.mapSize * s.level.mapSize);
  });

  it('reveals new ground as the player moves', () => {
    const s = makeState();
    const before = s.seen.size;
    move(s, { x: 1, y: 1 });
    expect(s.seen.size).toBeGreaterThan(before);
  });

  it('never forgets ground already seen', () => {
    const s = makeState();
    move(s, { x: 1, y: 1 });
    const far = [...s.seen];
    move(s, { x: 0, y: 0 });
    for (const k of far) expect(s.seen.has(k)).toBe(true);
  });
});

describe('survey', () => {
  it('spends stamina and reveals a wider ring than standing vision', () => {
    const s = makeState({ stamina: 20 });
    const before = s.seen.size;
    expect(survey(s)).toBe(true);
    expect(s.stamina).toBe(20 - SURVEY_COST);
    expect(s.seen.size).toBeGreaterThan(before);
  });

  it('refuses a second look from the same cell — no stamina drain for nothing', () => {
    const s = makeState({ stamina: 20 });
    survey(s);
    const after = s.stamina;
    expect(survey(s)).toBe(false);
    expect(s.stamina).toBe(after);
  });

  it('allows another look after moving somewhere new', () => {
    const s = makeState({ stamina: 20 });
    survey(s);
    move(s, { x: 1, y: 1 });
    expect(survey(s)).toBe(true);
  });

  it('refuses when stamina would not cover it', () => {
    const s = makeState({ stamina: SURVEY_COST - 1 });
    expect(survey(s)).toBe(false);
    expect(s.stamina).toBe(SURVEY_COST - 1);
  });

  it('does not count as a step — steps measure walking', () => {
    const s = makeState({ stamina: 20 });
    survey(s);
    expect(s.steps).toBe(0);
  });

  it('is refused outside the explore phase', () => {
    const s = makeState({ stamina: 20, phase: 'qte' });
    expect(survey(s)).toBe(false);
  });
});
```

（該檔需補入 `SURVEY_COST` 的 import。）

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL — `survey is not exported`

- [ ] **Step 3: 實作**

在 `src/core/session.ts` 的 import 追加：

```ts
import { visionRadius, cellsWithin, SURVEY_COST, SURVEY_BONUS } from './vision';
```

`SessionState` 介面在 `mutedClues` 之後新增兩欄：

```ts
  seen: Set<string>;      // 曾進入視野的格（單向累積，看過就不會忘）
  surveyed: Set<string>;  // 已在此格眺望過，避免重複花體力卻沒有新資訊
```

在 `startCorner` 的 re-export 之後新增視野函式：

```ts
// 把玩家當前視野內的格加進 seen。單向累積：看過的地就不會再變回未知。
export function revealAround(s: SessionState): void {
  const t = s.level.terrain[s.player.y][s.player.x];
  const e = s.level.elevation[s.player.y][s.player.x];
  for (const k of cellsWithin(s.player, visionRadius(t, e), s.level.mapSize)) s.seen.add(k);
}

// 駐足眺望：花體力掃過比站著更寬的一圈。同一格只能眺望一次——第二次不會有新資訊，
// 讓它白扣體力只是懲罰誤觸。體力不足或非探索階段時不執行、不扣款。
export function survey(s: SessionState): boolean {
  if (s.phase !== 'explore') return false;
  const k = key(s.player);
  if (s.surveyed.has(k)) return false;
  if (s.stamina < SURVEY_COST) return false;
  s.stamina -= SURVEY_COST;
  s.surveyed.add(k);
  const t = s.level.terrain[s.player.y][s.player.x];
  const e = s.level.elevation[s.player.y][s.player.x];
  const r = visionRadius(t, e) + SURVEY_BONUS;
  for (const kk of cellsWithin(s.player, r, s.level.mapSize)) s.seen.add(kk);
  return true;
}
```

`newSession` 的回傳物件補上兩欄並在建立後揭示起點視野：

```ts
export function newSession(round: number, rng: Rng, mode: SessionMode = 'run'): SessionState {
  const level = generateLevel(round, rng);
  const player = startCorner(level.mapSize, level.targetPos);
  const s: SessionState = {
    round,
    level,
    player,
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Map(),
    path: [player],
    readLog: [],
    mutedClues: new Set(),
    seen: new Set(),
    surveyed: new Set(),
    phase: 'explore',
    steps: 0,
    mode,
    resolved: false,
    bellUsed: false,
    microEvents: 0,
  };
  revealAround(s);
  // 起始蹤跡永遠可見（見 generate.ts 的 trailheadIndex 註解）
  s.seen.add(key(level.clues[level.trailheadIndex].position));
  return s;
}
```

在 `move()` 中，把 `s.path.push(to);` 之後補一行：

```ts
  s.path.push(to);
  revealAround(s); // 走到新位置立即揭示視野，供本次移動後的所有判斷共用
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm run test`
Expected: PASS。其他測試檔自造 `SessionState` 之處需補 `seen`／`surveyed` 兩欄。

- [ ] **Step 5: Commit**

```bash
git add src/core/session.ts tests/
git commit -m "feat: session tracks seen ground and the survey action"
```

---

### Task 10: 迷霧渲染與教學修正

視野在畫面上生效。這是本階段玩家感受最強烈的一步。

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `SessionState.seen`（Task 9）；`Level.trailheadIndex`（Task 8）

- [ ] **Step 1: 未見格暗化**

在 `MapScene.redraw()` 的熱區區塊之後、補給繪製之前，插入迷霧層。沿用既有的 `this.heatG`／`this.g` 分層慣例，新增一個專用圖層——在 `create()` 中把它建在 `this.g` **之後**（迷霧要蓋住線索與標記）：

```ts
    this.heatG = this.add.graphics(); // 熱區在最底層
    this.g = this.add.graphics();
    this.fogG = this.add.graphics(); // 迷霧蓋在線索與標記之上、玩家層之下
    this.pg = this.add.graphics();
```

並宣告欄位 `private fogG!: Phaser.GameObjects.Graphics;`。

在 `redraw()` 末尾、`this.drawPlayer(...)` 之前插入：

```ts
    // 迷霧：沒看過的地面壓暗。不是全黑——地形輪廓仍隱約可見，
    // 玩家才能規劃「往那片高地走」，而不是對著一片黑猜。
    this.fogG.clear();
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        if (s.seen.has(key({ x, y }))) continue;
        this.fogG.fillStyle(0x000000, 0.62).fillRect(this.ox + x * cs, this.oy + y * cs, cs, cs);
      }
    }
```

- [ ] **Step 2: 線索與補給只在看過之後顯示**

在 `redraw()` 中，補給繪製改為：

```ts
    L.supplies.forEach((sup, i) => {
      if (!s.seen.has(key(sup))) return;
      const p = px(sup);
      drawSupply(this.g, p.x, p.y, cs, sup.x + sup.y + i, pal);
    });
```

線索覆蓋層與 token 兩個迴圈同樣加上 `seen` 判斷：

```ts
    L.clues.forEach((c, i) => {
      if (!s.seen.has(key(c.position))) return;
      if (s.readClues.has(key(c.position)) && !s.mutedClues.has(i)) this.drawClueOverlay(c, px);
    });

    L.clues.forEach((c, i) => {
      if (!s.seen.has(key(c.position))) return;
      const p = px(c.position);
      const r = Math.max(8, cs * 0.34);
      drawClueToken(this.g, p.x, p.y, r, c.type, pal);
      if (s.readClues.has(key(c.position))) this.drawReadCheck(p.x, p.y, r);
      if (s.mutedClues.has(i)) {
        this.g.lineStyle(2, pal.paperDim, 0.95);
        this.g.lineBetween(p.x - r, p.y + r, p.x + r, p.y - r);
      }
    });
```

- [ ] **Step 3: 標記手勢限制在看過的格**

`onPointerUp` 的標記分支中，對未看過的格不應允許標記——玩家連那裡有什麼都還不知道。在 `wantMark` 分支開頭插入：

```ts
    if (wantMark) {
      // 沒看過的地不能標記：玩家還不知道那裡有什麼，標了也只是猜
      if (!s.seen.has(key(cellPos))) return;
```

- [ ] **Step 4: 教學只指向看得到的線索**

`startTutStep0` 目前挑「離玩家最近的未讀真線索」。視野收窄後那條可能還看不見。改為挑起始蹤跡——它保證可見：

```ts
  // 引導 step0：高亮起始蹤跡（generate 保證它是真線索且開局即可見）
  private startTutStep0(s: SessionState) {
    const nearest = s.level.clues[s.level.trailheadIndex];
    if (s.readClues.has(key(nearest.position))) return; // 防禦：已讀就不再引導
    const cs = this.cell;
    const p = {
      x: this.ox + nearest.position.x * cs + cs / 2,
      y: this.oy + nearest.position.y * cs + cs / 2,
    };
    pulseHighlight(this, p.x, p.y, cs * 0.6, this.pal.gold);
    this.showTut('tut.move');
  }
```

- [ ] **Step 5: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。

- [ ] **Step 6: 人工冒煙**

Run: `npm run dev`，進入第一局。
Expected:
1. 開局大部分地圖是壓暗的，地形輪廓隱約可見。
2. 玩家周圍一圈是亮的，且**恰好有一條線索 token 可見**（起始蹤跡），新手引導指向它。
3. 走動時亮區跟著擴張，走過的地不會變回暗的。
4. 走上岩坡（高處）時亮區明顯變大；走進密叢時變小。
5. 對壓暗的格 Shift+點擊沒有反應（不能標記）。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat: fog of war — clues must be found, not handed over"
```

---

### Task 11: 眺望的 HUD 與互動

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `survey` from `src/core/session`（Task 9）；`SURVEY_COST` from `src/core/vision`；`hud.survey`／`hud.surveyCost` 字串（Task 5）

- [ ] **Step 1: 新增眺望 chip**

`buildHud()` 的 chip 列目前由右至左為：`?`、語言、標記、靜音、（鈴）、熱區。眺望 chip 接在熱區之左。把熱區 chip 的座標計算改為：

```ts
    const xHeat = (hasBell ? xBell : xSound) - 8 - 60;
    const xSurvey = xHeat - 8 - 60;      // 眺望 chip 左緣
    this.chipRowLeft = xSurvey;          // 供 updateHud 計算體力條寬度時保持間距
```

並宣告欄位：

```ts
  private surveyChipG?: Phaser.GameObjects.Graphics;
  private surveyChipText?: Phaser.GameObjects.Text;
  private surveyChipX = 0;
  private surveyChipY = 0;
```

在熱區 chip 的建立區塊之後插入：

```ts
    // 眺望 chip：可用＝供給色描邊，已在此格眺望過或體力不足＝暗色描邊（僅視覺停用，
    // 點擊仍走同一路徑，由 survey() 內部 no-op）——沿用鈴 chip 的同款處理
    this.surveyChipX = xSurvey;
    this.surveyChipY = chipY;
    this.surveyChipG = this.add.graphics();
    this.surveyChipText = this.add.text(xSurvey + 30, chipY + chipH / 2, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.supply),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.drawSurveyChip(xSurvey, chipY, 60, chipH);
    this.add.rectangle(xSurvey + 30, chipY + chipH / 2, 60, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.doSurvey();
      });
```

- [ ] **Step 2: chip 繪製與可用判斷**

在 `drawHeatChip` 之後插入：

```ts
  // 眺望 chip：可用＝供給色描邊＋亮字，不可用＝暗描邊＋暗字
  private drawSurveyChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.surveyChipG!;
    g.clear();
    const usable = this.surveyUsable();
    g.lineStyle(1.2, usable ? pal.supply : pal.paperDim, usable ? 0.75 : 0.4)
      .strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
    this.surveyChipText!
      .setColor(cssHex(usable ? pal.supply : pal.paperDim))
      .setText(this.i18n().t('hud.survey'));
  }

  private surveyUsable(): boolean {
    const s = this.session();
    return s.phase === 'explore'
      && !s.surveyed.has(key(s.player))
      && s.stamina >= SURVEY_COST;
  }
```

並在 `updateHud()` 的 chip 重繪串列追加一行：

```ts
    if (this.surveyChipG) this.drawSurveyChip(this.surveyChipX, this.surveyChipY, 60, 30);
```

- [ ] **Step 3: 眺望動作**

在 `drawSurveyChip` 之後插入執行方法：

```ts
  // 眺望：花體力掃視一圈。成功時以擴張圓環演出掃視範圍＋浮字標示花費。
  private doSurvey() {
    const s = this.session();
    if (!survey(s)) return;
    this.audio.play('reveal');
    const cs = this.cell;
    const c = {
      x: this.ox + s.player.x * cs + cs / 2,
      y: this.oy + s.player.y * cs + cs / 2,
    };
    if (motionOK()) {
      const g = this.add.graphics();
      g.lineStyle(2, this.pal.supply, 0.8)
        .strokeCircle(0, 0, cs * (visionRadius(
          s.level.terrain[s.player.y][s.player.x],
          s.level.elevation[s.player.y][s.player.x],
        ) + SURVEY_BONUS));
      const holder = this.add.container(c.x, c.y, [g]).setScale(0.2).setAlpha(0.9);
      this.tweens.add({
        targets: holder, scale: 1, alpha: 0, duration: 520, ease: 'Cubic.easeOut',
        onComplete: () => holder.destroy(),
      });
    }
    floatText(this, c.x, c.y - cs * 0.5,
      this.i18n().t('hud.surveyCost', { n: SURVEY_COST }), cssHex(this.pal.supply));
    this.redraw();
  }
```

補上 import：`survey` 加進 `../core/session` 的匯入，並新增

```ts
import { visionRadius, SURVEY_COST, SURVEY_BONUS } from '../core/vision';
```

- [ ] **Step 4: 鍵盤捷徑**

`update()` 中，於方向鍵處理之前加入空白鍵眺望（與 QTE 的空白鍵不衝突——兩者不同場景）：

```ts
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.doSurvey();
      return;
    }
```

並在 `create()` 中建立按鍵：

```ts
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
```

宣告欄位 `private spaceKey?: Phaser.Input.Keyboard.Key;`。

- [ ] **Step 5: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。

- [ ] **Step 6: 人工冒煙**

Run: `npm run dev`
Expected:
1. HUD 出現「眺望」chip，可用時為供給色描邊。
2. 點擊後扣 4 體力、浮出「眺望 -4」、一圈綠環擴張、周圍一大片變亮。
3. 同一格再點一次無反應且不扣體力，chip 轉為暗色。
4. 走到別格後 chip 又亮起。
5. 按空白鍵與點 chip 效果相同。
6. 體力低於 4 時 chip 暗色且點擊無效。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat: the survey action, on a HUD chip and the space bar"
```

---

### Task 12: A\* 尋路

移動從「一次一格點擊」變成「點目的地」的前置邏輯。

**Files:**
- Create: `src/core/path.ts`
- Test: `tests/path.test.ts`

**Interfaces:**
- Consumes: `TERRAIN_COST`, `isPassable` from `src/core/terrain`；`cheb`, `Vec2` from `src/core/geometry`；`key` from `src/core/clues`
- Produces:
  - `findPath(terrain: TerrainType[][], from: Vec2, to: Vec2, seen: Set<string>): Vec2[] | null`（不含 `from`，含 `to`；無路時 `null`）
  - `pathCost(terrain: TerrainType[][], path: Vec2[]): number`

> **`seen` 不是選配參數。** 尋路只能經過玩家看過的地——這是專案負責人的裁定。若在整張地形上尋路，預覽出來的路線會自動繞開玩家還沒看見的崖壁，那條線本身就洩漏了未探索區的地形，迷霧在「地形」這一層等於白做。代價是開局能規劃的範圍很小，而這正是「眺望」的第二個用途：它不只是找線索，也是打開路線選項。

- [ ] **Step 1: 寫失敗的測試**

Create `tests/path.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findPath, pathCost } from '../src/core/path';
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

describe('pathCost', () => {
  it('sums the cost of each entered cell, ignoring the origin', () => {
    const t = grid(['.tr']);
    expect(pathCost(t, [{ x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(2 + 4);
  });
  it('is zero for an empty path', () => {
    expect(pathCost(grid(['..']), [])).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/path.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/path"`

- [ ] **Step 3: 實作**

Create `src/core/path.ts`:

```ts
import { key } from './clues';
import { cheb, type Vec2 } from './geometry';
import { TERRAIN_COST, isPassable } from './terrain';
import type { TerrainType } from './types';

// 八方向 A*。成本記在「踏入的那一格」，與 session.move() 的扣款規則一致，
// 因此預覽出來的花費就是玩家實際會付的數字。
// 啟發式用 Chebyshev 距離（等於最小地形成本 1 × 步數）——可採納（永不高估），
// 保證找到的是最省體力的路線，而不只是能走通的路線。
//
// seen 是迷霧的完整性保證：未看過的格一律視同不可通行。否則預覽線會自動繞開
// 玩家根本還沒看見的崖壁，那條線本身就洩漏了未探索區的地形。代價是開局能規劃的
// 範圍很小——這正是「眺望」存在的理由：它不只是找線索，也是打開路線選項。
export function findPath(
  terrain: TerrainType[][], from: Vec2, to: Vec2, seen: Set<string>,
): Vec2[] | null {
  const size = terrain.length;
  if (to.x < 0 || to.y < 0 || to.x >= size || to.y >= size) return null;
  if (!seen.has(key(to)) || !isPassable(terrain[to.y][to.x])) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const startKey = key(from);
  const goalKey = key(to);
  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, Vec2>();
  // 開放集以陣列＋線性取最小值實作：地圖最大 25×25＝625 格，
  // 二元堆的複雜度優勢在此規模下換不回它的實作成本（YAGNI）。
  const open: { p: Vec2; f: number }[] = [{ p: from, f: cheb(from, to) }];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIdx].f) bestIdx = i;
    const { p } = open.splice(bestIdx, 1)[0];
    const pk = key(p);

    if (pk === goalKey) {
      const out: Vec2[] = [];
      let cur: Vec2 | undefined = p;
      while (cur && key(cur) !== startKey) {
        out.push(cur);
        cur = cameFrom.get(key(cur));
      }
      return out.reverse();
    }

    const pg = gScore.get(pk) ?? Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < 0 || q.y < 0 || q.x >= size || q.y >= size) continue;
        const qk = key(q);
        if (!seen.has(qk)) continue; // 沒看過的地不能拿來規劃路線
        const t = terrain[q.y][q.x];
        if (!isPassable(t)) continue;
        const tentative = pg + TERRAIN_COST[t];
        if (tentative >= (gScore.get(qk) ?? Infinity)) continue;
        gScore.set(qk, tentative);
        cameFrom.set(qk, p);
        open.push({ p: q, f: tentative + cheb(q, to) });
      }
    }
  }
  return null;
}

// 路線總花費＝沿途每一格的地形成本（起點不計，因為玩家已經站在上面）
export function pathCost(terrain: TerrainType[][], path: Vec2[]): number {
  return path.reduce((sum, c) => sum + TERRAIN_COST[terrain[c.y][c.x]], 0);
}
```
- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/path.test.ts`
Expected: PASS（3 個 describe、共 15 個測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/core/path.ts tests/path.test.ts
git commit -m "feat: cost-aware A* pathfinding over the terrain grid"
```

---

### Task 13: 路線預覽與自動行走

診斷 A-02 的修正：把一局 20–60 次無決策點擊壓縮成數次真正的路線決策。

**核心規則：自動行走一讀到新東西就停。** 這讓自動化省掉的是搬運，而不是判斷——玩家永遠在「知道了新事情」的那一刻重新拿回控制權。

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `findPath`, `pathCost` from `src/core/path`（Task 12）；`hud.pathCost` 字串（Task 5）

- [ ] **Step 1: 新增預覽狀態欄位**

```ts
  private previewPath: Vec2[] | null = null;
  private previewTo: Vec2 | null = null;
  private previewG!: Phaser.GameObjects.Graphics;
  private walking = false;
```

在 `create()` 中把 `previewG` 建在 `fogG` 之後、`pg` 之前（路線畫在迷霧之上，玩家之下）：

```ts
    this.fogG = this.add.graphics();
    this.previewG = this.add.graphics();
    this.pg = this.add.graphics();
```

- [ ] **Step 2: 點擊改為「先預覽、再確認」**

把 `onPointerUp` 末尾的 `this.doMove(cellPos);` 換成：

```ts
    // 相鄰格維持單擊直走——近距離微調不該多一次確認
    if (cheb(s.player, cellPos) === 1) {
      this.clearPreview();
      this.doMove(cellPos);
      return;
    }
    // 遠處：第一次點擊預覽路線與花費，同一格再點一次才走。
    // 觸控裝置沒有 hover，這個兩段式是它唯一能看到花費的機會。
    if (this.previewTo && key(this.previewTo) === key(cellPos) && this.previewPath) {
      const path = this.previewPath;
      this.clearPreview();
      this.walkPath(path);
      return;
    }
    this.showPreview(cellPos);
```

（`cheb` 需加進該檔 import。）

- [ ] **Step 3: 預覽的計算與繪製**

```ts
  // 路線預覽：畫出行經格的金色連線與終點花費數字。
  // 目的地與整條路線都必須落在看過的地上——這條規則由 findPath 內部把關
  // （未看過的格視同不可通行），此處不重複判斷，避免兩套邏輯日後各自漂移。
  private showPreview(to: Vec2) {
    const s = this.session();
    const path = findPath(s.level.terrain, s.player, to, s.seen);
    if (!path || path.length === 0) { this.clearPreview(); return; }
    const cost = pathCost(s.level.terrain, path);
    this.previewPath = path;
    this.previewTo = to;

    const cs = this.cell;
    const pc = (v: Vec2) => ({ x: this.ox + v.x * cs + cs / 2, y: this.oy + v.y * cs + cs / 2 });
    this.previewG.clear();
    // 走不完的路線改用警示色，讓玩家一眼看出這條路會半途力竭
    const affordable = cost <= s.stamina;
    const color = affordable ? this.pal.gold : this.pal.mark;
    this.previewG.lineStyle(Math.max(2, cs * 0.12), color, 0.75);
    let prev = pc(s.player);
    for (const step of path) {
      const cur = pc(step);
      this.previewG.lineBetween(prev.x, prev.y, cur.x, cur.y);
      prev = cur;
    }
    const end = pc(path[path.length - 1]);
    this.previewG.fillStyle(color, 0.9).fillCircle(end.x, end.y, cs * 0.18);
    this.previewCostText ??= this.add.text(0, 0, '', {
      fontFamily: FONTS.body, fontSize: '13px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(60);
    this.previewCostText
      .setText(this.i18n().t('hud.pathCost', { n: cost }))
      .setColor(cssHex(color))
      .setPosition(end.x, end.y - cs * 0.7)
      .setVisible(true);
  }

  private clearPreview() {
    this.previewPath = null;
    this.previewTo = null;
    this.previewG.clear();
    this.previewCostText?.setVisible(false);
  }
```

宣告欄位 `private previewCostText?: Phaser.GameObjects.Text;`，並補 import：

```ts
import { findPath, pathCost } from '../core/path';
```

- [ ] **Step 4: 自動行走**

```ts
  // 沿預覽路線自動行走。每一步都走既有的 doMove，因此線索判讀、補給、微事件、
  // QTE 觸發與力竭判定全部照常發生——這裡只是替玩家連續按下同一個動作。
  // 停止條件是本任務的核心：一讀到新東西就交還控制權，讓自動化省掉的是搬運而非判斷。
  private walkPath(path: Vec2[]) {
    if (this.walking) return;
    this.walking = true;
    let i = 0;
    const stepOnce = () => {
      const s = this.session();
      if (i >= path.length || s.phase !== 'explore') { this.walking = false; return; }
      const readBefore = s.readClues.size;
      const eventsBefore = s.microEvents;
      const next = path[i++];
      if (!canMove(s, next)) { this.walking = false; return; }
      this.doMove(next);
      // doMove 的移動補間為 100ms，等它跑完再決定要不要續走
      this.time.delayedCall(130, () => {
        const now = this.session();
        const learnedSomething = now.readClues.size > readBefore
          || now.microEvents > eventsBefore;
        if (now.phase !== 'explore' || learnedSomething) { this.walking = false; return; }
        stepOnce();
      });
    };
    stepOnce();
  }
```

- [ ] **Step 5: 行走與預覽期間封鎖其他輸入**

`onPointerUp` 開頭加上：

```ts
    if (this.walking) return;
```

`update()` 的方向鍵處理同樣加上 `if (this.walking) return;`，並在任何鍵盤移動發生時 `this.clearPreview();`。

`doMove` 開頭既有的 `if (this.animating || !canMove(s, to)) return;` 維持不變——它是單步的防重入，與 `walking` 各司其職。

- [ ] **Step 6: hover 顯示路線花費（桌機）**

`onPointerMove` 目前只顯示單格成本。距離 > 1 時改為顯示整條路線的花費，讓桌機玩家不必先點一次：

在 `drawHover` 末尾追加：

```ts
    // 遠處：hover 直接預覽整條路線，桌機玩家不必先點一次
    if (cheb(s.player, c) > 1) this.showPreview(c);
    else this.previewG.clear();
```

- [ ] **Step 7: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。

- [ ] **Step 8: 人工冒煙**

Run: `npm run dev`
Expected:
1. 滑鼠移到遠處已看過的格，出現金色路線與花費數字；路線會繞開崖壁。
2. 路線花費超過剩餘體力時轉為警示色。
3. 點擊該格後玩家沿路線連續走動。
4. **踩到線索的那一步立刻停下**，不再繼續走完剩下的路。
5. 微事件觸發時同樣停下。
6. 逼近目標時正常進入 QTE。
7. 相鄰格單擊仍是直接走一步，沒有多一次確認。
8. 點沒看過的暗格沒有反應。
9. **對「看得到但只能繞過未探索區抵達」的格，不會顯示路線**——尋路只走看過的地。用「眺望」把中間打通之後，同一格才出現路線。
10. 行走途中點擊其他地方不會插隊。

- [ ] **Step 9: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat: route preview and auto-walk that stops on new information"
```

---

### Task 14: 揭曉相容、說明更新、架構筆記與全量驗證

Phase 5 收尾。

**Files:**
- Modify: `src/scenes/RevealScene.ts`
- Modify: `src/scenes/HelpScene.ts`
- Modify: `docs/ARCHITECTURE-NOTES.md`

- [ ] **Step 1: 揭曉小地圖畫出未探索區**

`RevealScene` 的迷你地圖目前畫出全部地形。加上「你走過的視野」對比，讓玩家看見自己漏掉了多少山域——這是「資訊完備步數」之外的第二種學習回饋：

在 `drawMinimap` 的地形迴圈之後、路徑折線之前插入：

```ts
    // 未探索區壓暗：讓玩家看見自己漏掉了多少山域。
    // 失敗的每日挑戰同樣要畫——這是玩家自己的探索紀錄，不洩漏答案。
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        if (s.seen.has(key({ x, y }))) continue;
        g.fillStyle(0x000000, 0.45).fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
```

並補上 `import { key } from '../core/clues';`。

> 這一段刻意不受 `hideAnswer` 影響：`seen` 是玩家自己走出來的紀錄，不含任何關於目標位置的資訊。

- [ ] **Step 2: 說明頁納入視野、眺望與路線**

`HelpScene` 的 `rows` 目前是 10 列的固定版面預算（`ph = 680`，末列 `py0 + 574`，與開始鈕保有 26px 淨空）。Phase 5 要再加三列，超出固定面板的能力範圍——**這是該檔註解裡預告過的時機**：改為可捲動列表，比照 `CodexScene` 的作法，而不是繼續加高面板。

依 `src/scenes/CodexScene.ts` 的 `create()` 手法改造 `HelpScene`：

1. `ph` 改回 `636`，並把面板底部保留給開始鈕。
2. 把 `rows` 的繪製包進一個 `Phaser.GameObjects.Container`，y 起點為 `py0 + 160`。
3. 以 `this.make.graphics({}, false)` 建立矩形遮罩，可視區為 `py0 + 160` 到 `py0 + ph - 92`，套 `createGeometryMask()`。
4. 掛上 `wheel` 與拖曳捲動，夾限在 `[minY, listTop]`，`minY = Math.min(0, viewH - rows.length * 44) + listTop`。
5. `rows` 的 y 改為相對容器的 `i * 44`（不再是絕對 `py0 + …`）。

然後在 `help.weather` 之後追加三列（icon 沿用該檔既有語彙）：

```ts
      {
        y: 10 * 44, key: 'help.vision',
        icon: (y) => {
          // 由亮到暗的三格，對應「近處看得見、遠處是暗的」
          const sq = 9;
          let x = rowX - 16;
          for (const a of [1, 0.45, 0.18]) {
            icons.fillStyle(pal.paper, a).fillRect(x, y - sq / 2, sq, sq);
            x += sq + 3;
          }
        },
      },
      {
        y: 11 * 44, key: 'help.survey',
        icon: (y) => {
          icons.fillStyle(pal.supply, 1).fillCircle(rowX, y, 3);
          icons.lineStyle(1.6, pal.supply, 0.85).strokeCircle(rowX, y, 8);
          icons.lineStyle(1.2, pal.supply, 0.45).strokeCircle(rowX, y, 13);
        },
      },
      {
        y: 12 * 44, key: 'help.route',
        icon: (y) => {
          icons.lineStyle(2, pal.gold, 0.85);
          icons.lineBetween(rowX - 14, y + 6, rowX - 4, y - 4);
          icons.lineBetween(rowX - 4, y - 4, rowX + 6, y + 2);
          icons.lineBetween(rowX + 6, y + 2, rowX + 14, y - 6);
          icons.fillStyle(pal.gold, 1).fillCircle(rowX + 14, y - 6, 3);
        },
      },
```

同時把該檔 `ph` 上方的「已知限制」註解改寫，記錄限制已由捲動解除。

- [ ] **Step 3: 更新架構筆記**

在 `docs/ARCHITECTURE-NOTES.md` 追加一節：

```markdown
### Phase 5 狀態變更：視野、地形與尋路

`SessionState` 新增兩個純記憶體欄位（不持久化、不進 registry，隨 session 生滅）：

- `seen: Set<string>` — 曾進入視野的格。單向累積，`revealAround()` 在 `newSession`
  與每次 `move()` 後寫入。`MapScene` 的迷霧層、線索/補給顯示、標記手勢限制，以及
  `RevealScene` 的未探索區壓暗，全部讀這一個來源。
- `surveyed: Set<string>` — 已眺望過的格，防止在同一格重複花體力換取零新資訊。

`Level` 新增兩個生成期欄位：

- `elevation: number[][]` — 0..1 高程場。地形由它推導（`terrain.terrainFor`），
  視野半徑也讀它（`vision.visionRadius`），因此必須隨 Level 一起保存而非生成後丟棄。
- `trailheadIndex: number` — 開局即揭示的真線索索引。視野收窄後出生角附近通常
  看不到任何線索，沒有它開局會是一張全空的圖。

**循環匯入的處置：** `TERRAIN_COST`／`isPassable`／`startCorner` 三者實作在
`src/core/terrain.ts`，`src/core/session.ts` 僅 re-export 以維持既有匯入點。
原因是 `reach.ts` 與 `generate.ts` 都需要它們，而 `session.ts` 匯入 `generate.ts`——
若把實作留在 session，會形成 `session → generate → reach → session` 的循環。

**每日挑戰的決定性：** `buildTerrain` 的 rng 消耗次數固定為 160（兩張場 × 兩層
× (gridSize+1)^2），與地圖大小、取樣次數皆無關。`ensureReachable` 完全不碰 rng。
因此同一顆日期種子仍必得同一張地圖。
```

- [ ] **Step 4: 全量驗證**

Run: `npm run test`
Expected: 所有測試檔 PASS（含新增的 `noise`／`terrain`／`reach`／`vision`／`path`）。

Run: `npm run build`
Expected: `tsc --noEmit` 無錯，`vite build` 產出 `dist/`。

- [ ] **Step 5: 決定性抽查**

Run:

```bash
node -e "
const { execSync } = require('child_process');
" 2>/dev/null; npx vitest run tests/generate.test.ts tests/terrain.test.ts
```

Expected: 決定性測試（`stays deterministic for a given seed`、`is deterministic for the same seed`）通過。這是每日挑戰「全球同題」的憑據。

- [ ] **Step 6: 完整迴圈人工驗收（雙語各一輪）**

Run: `npm run dev`

依設計規格書 §11.1 的上傳前檢查清單，**英文與繁中各走一輪**完整迴圈
（營地 → 地圖 → 視野／眺望／尋路 → 判讀工具 → QTE → 揭曉 → 結算 → 圖鑑），確認：
- 地貌在三套配色下都讀得出來，崖壁在每一套裡都與岩坡分得開。
- 起始蹤跡必定可見，新手引導指向它。
- 路線預覽的花費數字與實際扣除的體力一致。
- 自動行走在讀到線索時確實停下。
- 眺望 chip、路線花費、三條新說明在兩種語系下皆不溢出。
- 說明頁捲動在兩種語系下都能捲到最後一列。
- 每日挑戰同一天重進兩次得到同一張地圖。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/RevealScene.ts src/scenes/HelpScene.ts docs/ARCHITECTURE-NOTES.md
git commit -m "docs: scrollable help panel, unexplored ground in the reveal, Phase 5 architecture notes"
```

---

## 自我檢查結果

**規格覆蓋**（對照 `docs/superpowers/specs/2026-09-02-boredom-remediation-roadmap-design.md` §3 Phase 5）：

| 規格項目 | 實作任務 |
|---|---|
| 地形改用雜訊生成真實地貌（稜線、溪谷、林線、開闊草坡、裸岩區） | Task 1（雜訊）、Task 2（分帶推導）、Task 6（呈現） |
| 地形成本拉開層次（1 / 2 / 4 / 不可通行） | Task 3 |
| 視野與線索顯形（線索只在進入視野後顯示；高地加成、密叢遮蔽） | Task 7（模型）、Task 9（session）、Task 10（渲染） |
| 主動「駐足觀察」 | Task 7（常數）、Task 9（`survey`）、Task 11（HUD 與互動） |
| 點擊目的地自動尋路，確認前預覽總成本與行經地形 | Task 12（A\*，限於已看過的地）、Task 13（預覽與自動行走） |
| 維持反向錨定可解性（全域約束） | Task 4（物理可達性保證） |
| 每日挑戰決定性（全域約束） | Task 1（固定 rng 消耗）、Task 14 Step 5（抽查） |
| 架構筆記同步（全域約束） | Task 14 |

**未涵蓋且為刻意**：
- **不做視野遮蔽（LOS）**——視野是半徑，密叢以縮小半徑表達。理由見 Task 7 的說明。
- **不做地形美術素材**——`cliff` 沒有 PNG，靠 `BootScene` 既有的缺檔降級走純色塊＋描邊。若日後要補，`scripts/terrain-art.mjs` 是入口，屬美術管線而非本階段。
- **不動獵物、不動 QTE、不動生態系**——分別是 Phase 6、7、8。

**型別一致性**：`NoiseField`（Task 1）→ `buildTerrain`（Task 2）→ `generate.ts`（Task 4）；`TERRAIN_COST`／`isPassable`／`startCorner` 實作於 `terrain.ts`（Task 4 Step 7）並由 `session.ts` re-export，`reach.ts`／`path.ts`／`events.ts` 直接自 `terrain.ts` 匯入；`Level.elevation`（Task 2）→ `visionRadius`（Task 7）→ `revealAround`／`survey`（Task 9）→ `MapScene` 迷霧（Task 10）與眺望演出（Task 11）；`findPath`／`pathCost`（Task 12）→ `showPreview`／`walkPath`（Task 13）。函式名全程一致。

**已知的高風險處**，執行時請格外留意：
1. **Task 3 Step 3 的模組搬遷**是本計畫最容易出錯的一步。`TERRAIN_COST`／`isPassable`／`startCorner` 的**實作**必須真的移出 `session.ts`（只留 re-export），否則 Task 4 加入 `reach.ts` 之後會形成 `session → generate → reach → session` 的循環匯入。若 `npm run build` 出現匯入未定義，或執行期讀到 `undefined`，先回頭確認這一步。
2. **Task 3 的體力數值**與 **Task 2 的分帶門檻**互相牽動。若 Task 4 的可達性測試出現大量挖通（表示崖壁過多），先調 `BAND_CLIFF` 而不是改挖通演算法。
3. **Task 13 的自動行走**與既有的 `animating` 旗標、微事件演出、教學步驟都會互動。人工冒煙的第 4、5 項（讀到線索即停、微事件即停）是它的核心驗收，不可跳過。
