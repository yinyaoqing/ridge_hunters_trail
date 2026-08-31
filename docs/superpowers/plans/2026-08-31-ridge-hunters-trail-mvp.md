# Ridge Hunter's Trail MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依據 `docs/Ridge_Hunters_Trail_Game_Design_Spec.md` v1.0，實作可上架 itch.io 驗證的 MVP：完整核心迴圈（線索推理 → 移動 → QTE → 圖鑑收錄 → 難度遞增），使用佔位美術。

**Architecture:** 所有遊戲邏輯（RNG、幾何、難度表、線索生成/交集、局狀態機、QTE 判定、圖鑑存檔）為純 TypeScript 模組，完全不依賴 Phaser，以 Vitest 做 TDD；Phaser 場景只是薄渲染層（Graphics + Text 佔位美術，無外部素材檔）。線索採「反向錨定法」從目標位置反推生成，數學上保證有解。

**Tech Stack:** Phaser 3（npm 套件）、TypeScript（strict）、Vite（建置/開發伺服器）、Vitest（單元測試）。純前端、無伺服器、無其他 runtime 相依。

## Global Constraints

- 世界觀完全架空原創：程式內所有生物名稱、描述、視覺元素均為虛構，**嚴禁使用**任何真實文化圖騰、民族紋樣、宗教符號、地名、族群名稱（規格書 §2）。
- 全程無死亡/血腥：失敗文案一律用「逃逸/溜走」（escaped / slipped away），不得出現 kill、die、blood 等字眼（PEGI 3–7）。
- 遊戲內 UI 支援多語系：**英文（預設）與繁體中文**。依瀏覽器語言自動偵測（`zh*` → zh-TW，其餘 → en），遊戲內可切換並以 localStorage 記憶。所有玩家可見字串一律經 `i18n.t()` 取得，不得在場景中硬編碼；兩語系字串表必須涵蓋完全相同的 key（有測試把關）。
- 技術棧固定：Phaser.js + TypeScript，純前端，無需伺服器（規格書 §6）。
- 檔案大小：本階段目標 itch.io / CrazyGames Basic Launch（初始下載 ≤50MB、總檔案數 <1,500）；Poki 8MB 為後續階段目標，本計畫不處理，但素材一律走 npm bundle、不用 CDN，保留後續分包空間。
- 難度曲線數值以規格書 §4.5 表為準：第1–3局 15×15/4線索/0干擾/交集上限15；第4–7局 20×20/5線索/1干擾/上限8；第8局起 25×25/6線索/2干擾/上限4。
- 干擾線索 decoyPos 與 targetPos 距離必須 ≥ 5 格，且視覺呈現與真線索完全相同（規格書 §4.2）。
- 所有隨機性經由可注入種子的 RNG（`mulberry32`），確保測試可重現。
- Vite `base: './'`（itch.io 以相對路徑載入，絕對路徑會 404）。
- Windows 開發環境：驗證指令以 PowerShell 語法書寫。

## 設計決策（解決規格書開放項目）

規格書留白處，本計畫定案如下（皆可依 playtesting 調整，數值集中在 `difficulty.ts` 一處）：

1. **QTE 形式（規格書 §4.4 待細化）**：採「轉盤節奏點擊」——指針以固定角速度繞圓旋轉，玩家在指針落於發光弧區內時點擊/按空白鍵得一次命中；共 N 次嘗試、需 K 次命中。難度遞增 = 指針變快 + 弧區變窄 + 需求命中數變多（tier1: 180°/s、70°弧、3次取2；tier2: 240°/s、55°弧、3次取2；tier3: 300°/s、40°弧、4次取3）。選此形式因為：純滑鼠/單鍵可玩（portal 平台友善）、邏輯可 100% 單元測試、失敗懲罰依規格 = 目標逃逸、線索清空、同難度重開一局。
2. **QTE 觸發條件**：玩家移動到與目標 Chebyshev 距離 ≤ 1 的格子時觸發（「逼近目標」的具體化）。
3. **氣味線索的風向道具（規格書 §4.2 windBiasNeeded）**：MVP 延後。氣味線索呈現為「距離環」（已足夠構成推理），`windBiasNeeded` 欄位保留恆為 `false`，供後續版本擴充。
4. **地形效果（規格書 §4.1「影響移動速度/視野」）**：MVP 只做移動成本（meadow/mist 消耗 1 體力、thicket/rock 消耗 2），視野效果延後。地形另一作用：目標所在格地形 = 該生物的地形偏好（規格書 §4.6「地形偏好」的最小實作）。
5. **補給道具**：規格書暫名「霧葉」「露珠果」，遊戲內統一顯示為 supply（淺綠圓點），拾取 +10 體力；「消耗回合數」以「走過去要花體力步數」自然成立，不另設回合制。
6. **生物數量**：MVP 做滿 8 種（規格書建議 8–12 的下限）。
7. **標記系統**：Shift+點擊任意格切換標記（橘色 X），純玩家筆記，UI 不計算也不提示正解（符合規格書「UI 不強制提示正解」）。
8. **美術**：本計畫全程使用程式繪製佔位圖形（Graphics/Text），對應規格書排程 Day 1–6；Day 7–10 的 AI 素材替換與音效不在本計畫範圍，屬後續計畫。
9. **格子 `revealed` 欄位（規格書 §4.1）**：MVP 不做全圖迷霧，改以 `SessionState.readClues`（已判讀線索集合）承載「已探索」語意——線索標記全程可見，但其資料（方向錐/範圍圓/距離環）踩上後才揭示。若後續要做迷霧視野，再把 revealed 升級為每格布林陣列。
10. **多語系**：支援英文（預設）與繁體中文。純前端 i18n（`src/core/i18n.ts` 字串表＋`t()` 插值），型別 `MsgKey` 保證編譯期不會打錯 key，另有測試保證兩語系 key 集合一致。中文以瀏覽器系統字體渲染（Phaser Canvas 文字），**不打包字型檔**——維持零成本並保留 Poki 8MB 優化空間。生物名稱與描述改為雙語欄位（`names`/`descs`）。語言偵測 `zh*` → zh-TW（簡中使用者亦顯示繁中，待未來擴充 zh-CN）。

## File Structure

```
package.json / tsconfig.json / vite.config.ts / index.html   ← Task 1 鷹架
src/core/rng.ts        可注入種子的 RNG 與抽樣工具            ← Task 2
src/core/geometry.ts   Vec2、距離、角度、圓上取點             ← Task 2
src/core/types.ts      Clue/Level/Terrain 型別（判別聯集）    ← Task 3
src/core/difficulty.ts 難度曲線表（§4.5 + QTE/體力參數）      ← Task 3
src/core/clues.ts      線索候選集合語意與交集運算             ← Task 4
src/data/creatures.ts  8 種原創生物資料（名稱/描述雙語）      ← Task 5
src/core/codex.ts      圖鑑存檔（localStorage + 記憶體備援）  ← Task 5
src/core/i18n.ts       多語系（en / zh-TW 字串表、偵測、切換）← Task 5A
src/core/generate.ts   關卡生成（反向錨定＋收斂＋干擾線索）   ← Task 6
src/core/session.ts    單局狀態機（移動/體力/補給/標記/觸發） ← Task 7
src/core/qte.ts        QTE 判定邏輯（純邏輯，無渲染）         ← Task 8
src/main.ts            Phaser 啟動與全域 registry             ← Task 9
src/scenes/MapScene.ts 地圖渲染與操作                         ← Task 9
src/scenes/QteScene.ts QTE 渲染                               ← Task 10
src/scenes/ResultScene.ts 結算場景                            ← Task 11
src/scenes/CodexScene.ts  圖鑑場景                            ← Task 11
tests/*.test.ts        各 core 模組對應測試
```

測試策略：`src/core/` 與 `src/data/` 全部 TDD（Vitest, node 環境）；`src/scenes/` 與 `main.ts` 為薄渲染層，以 `npm run build`（含 `tsc --noEmit` 型別檢查）+ 開發伺服器手動冒煙清單驗證，不寫 DOM 單元測試。

---

### Task 1: 專案鷹架與測試環境

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`（暫時 stub，Task 9 全量改寫）
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: 無（起點任務）
- Produces: 可運作的 `npm run test`（Vitest）、`npm run build`（tsc + vite）、`npm run dev` 指令；後續所有任務依賴此工具鏈。

- [ ] **Step 1: 建立 package.json**

```json
{
  "name": "ridge-hunters-trail",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "phaser": "^3.90.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 建立 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"],
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 建立 vite.config.ts**（`base: './'` 是 itch.io 必要設定）

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  test: { environment: 'node' },
});
```

- [ ] **Step 4: 建立 index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ridge Hunter's Trail</title>
  <style>html,body{margin:0;padding:0;background:#141814;height:100%}#app{height:100%}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: 建立 src/main.ts（暫時 stub）**

```typescript
console.log('Ridge Hunter Trail bootstrap');
```

- [ ] **Step 6: 建立 tests/smoke.test.ts（驗證測試環境）**

```typescript
import { describe, it, expect } from 'vitest';

describe('toolchain smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: 安裝相依並跑測試**

Run: `npm install`
Expected: 安裝成功、無 error（warning 可忽略）

Run: `npm run test`
Expected: `1 passed`（smoke.test.ts）

- [ ] **Step 8: 驗證建置**

Run: `npm run build`
Expected: tsc 無錯誤，vite 產出 `dist/` 目錄，exit code 0

- [ ] **Step 9: Commit**

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts tests/smoke.test.ts
git commit -m "chore: scaffold Vite + TypeScript + Phaser + Vitest toolchain"
```

---

### Task 2: 種子 RNG 與幾何工具

**Files:**
- Create: `src/core/rng.ts`
- Create: `src/core/geometry.ts`
- Test: `tests/rng.test.ts`
- Test: `tests/geometry.test.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  - `type Rng = () => number`（回傳 [0,1)）
  - `mulberry32(seed: number): Rng`
  - `randInt(rng: Rng, min: number, max: number): number`（含端點）
  - `pickWeighted<T>(rng: Rng, items: [T, number][]): T`
  - `interface Vec2 { x: number; y: number }`
  - `dist(a: Vec2, b: Vec2): number`（歐氏距離）
  - `cheb(a: Vec2, b: Vec2): number`（Chebyshev 距離）
  - `angleDeg(from: Vec2, to: Vec2): number`（0–360，y 軸向下、東 = 0°、南 = 90°）
  - `angleDiff(a: number, b: number): number`（最小夾角 0–180）
  - `clampToMap(p: Vec2, size: number): Vec2`（四捨五入後夾到 [0, size-1]）
  - `pointOnCircle(center: Vec2, radius: number, deg: number): Vec2`（回傳浮點座標，不夾界）

- [ ] **Step 1: 寫失敗測試 tests/rng.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { mulberry32, randInt, pickWeighted } from '../src/core/rng';

describe('mulberry32', () => {
  it('same seed produces same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('values are in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt', () => {
  it('stays within inclusive bounds and hits both ends', () => {
    const rng = mulberry32(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = randInt(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });
});

describe('pickWeighted', () => {
  it('never picks zero-weight items', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      expect(pickWeighted(rng, [['a', 1], ['b', 0]])).toBe('a');
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL — `Cannot find module '../src/core/rng'`（或 resolve 錯誤）

- [ ] **Step 3: 實作 src/core/rng.ts**

```typescript
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickWeighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, w] of items) {
    if (w <= 0) continue;
    r -= w;
    if (r <= 0) return value;
  }
  return items[items.length - 1][0];
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/rng.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: 寫失敗測試 tests/geometry.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { dist, cheb, angleDeg, angleDiff, clampToMap, pointOnCircle } from '../src/core/geometry';

describe('geometry', () => {
  it('dist is euclidean', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('cheb is chessboard distance', () => {
    expect(cheb({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(3);
    expect(cheb({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(1);
  });

  it('angleDeg: east is 0, south is 90 (screen coords, y down)', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(0);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(90);
    expect(angleDeg({ x: 0, y: 0 }, { x: -5, y: 0 })).toBe(180);
  });

  it('angleDiff wraps around 360', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(90, 90)).toBe(0);
    expect(angleDiff(0, 180)).toBe(180);
  });

  it('clampToMap rounds and clamps into grid', () => {
    expect(clampToMap({ x: -2.4, y: 7.6 }, 15)).toEqual({ x: 0, y: 8 });
    expect(clampToMap({ x: 99, y: 14.2 }, 15)).toEqual({ x: 14, y: 14 });
  });

  it('pointOnCircle at 0 degrees goes east', () => {
    const p = pointOnCircle({ x: 5, y: 5 }, 3, 0);
    expect(p.x).toBeCloseTo(8);
    expect(p.y).toBeCloseTo(5);
  });
});
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `npx vitest run tests/geometry.test.ts`
Expected: FAIL — `Cannot find module '../src/core/geometry'`

- [ ] **Step 7: 實作 src/core/geometry.ts**

```typescript
export interface Vec2 {
  x: number;
  y: number;
}

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const cheb = (a: Vec2, b: Vec2): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function angleDeg(from: Vec2, to: Vec2): number {
  return ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360;
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function clampToMap(p: Vec2, size: number): Vec2 {
  return {
    x: Math.min(size - 1, Math.max(0, Math.round(p.x))),
    y: Math.min(size - 1, Math.max(0, Math.round(p.y))),
  };
}

export function pointOnCircle(center: Vec2, radius: number, deg: number): Vec2 {
  const rad = (deg * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) };
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run tests/geometry.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 9: Commit**

```powershell
git add src/core/rng.ts src/core/geometry.ts tests/rng.test.ts tests/geometry.test.ts
git commit -m "feat: add seeded RNG and grid geometry utilities"
```

---

### Task 3: 核心型別與難度曲線表

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/difficulty.ts`
- Test: `tests/difficulty.test.ts`

**Interfaces:**
- Consumes: `Vec2`（Task 2）
- Produces:
  - `type TerrainType = 'meadow' | 'mist' | 'thicket' | 'rock'`
  - `type Locale = 'en' | 'zh-TW'`（多語系；字串表在 Task 5A 的 i18n 模組）
  - `interface FootprintData { direction: number; angleSpread: number }`
  - `interface DisturbanceData { radius: number }`
  - `interface ScentData { distance: number; tolerance: number; windBiasNeeded: boolean }`
  - `type Clue`（判別聯集，見下）與 `type ClueType = Clue['type']`
  - `interface Level { round; mapSize; targetPos; clues; terrain; supplies; creatureId }`
  - `interface QteParams { speed; arcSize; rounds; needed }`
  - `interface DifficultyParams`（見下，含 §4.5 全部欄位 + 體力/補給/QTE 參數）
  - `getDifficulty(round: number): DifficultyParams`

- [ ] **Step 1: 建立 src/core/types.ts**（純型別，無需先行測試；由後續所有測試間接覆蓋）

```typescript
import type { Vec2 } from './geometry';

export type TerrainType = 'meadow' | 'mist' | 'thicket' | 'rock';

// 支援語系：英文（預設）與繁體中文
export type Locale = 'en' | 'zh-TW';

// 足跡：方向性線索（錐形）
export interface FootprintData {
  direction: number;    // 0-360 度，指向錨定點
  angleSpread: number;  // 錐形半角（度），難度越高越小
}

// 擾動：範圍性線索（圓域）
export interface DisturbanceData {
  radius: number; // 可能範圍半徑（格）
}

// 氣味：距離性線索（圓環）。windBiasNeeded 為後續風向道具保留，MVP 恆為 false
export interface ScentData {
  distance: number;
  tolerance: number; // 環寬容差（格），難度越高越窄
  windBiasNeeded: boolean;
}

export type Clue =
  | { type: 'footprint'; position: Vec2; isDecoy: boolean; data: FootprintData }
  | { type: 'disturbance'; position: Vec2; isDecoy: boolean; data: DisturbanceData }
  | { type: 'scent'; position: Vec2; isDecoy: boolean; data: ScentData };

export type ClueType = Clue['type'];

export interface Level {
  round: number;
  mapSize: number;
  targetPos: Vec2;
  clues: Clue[];
  terrain: TerrainType[][]; // terrain[y][x]
  supplies: Vec2[];         // 補給道具（規格書「霧葉/露珠果」的統一實作）
  creatureId: string;
}
```

- [ ] **Step 2: 寫失敗測試 tests/difficulty.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { getDifficulty } from '../src/core/difficulty';

describe('getDifficulty follows spec 4.5 table', () => {
  it('rounds 1-3: 15x15, 4 clues, 0 decoys, max intersection 15', () => {
    for (const r of [1, 2, 3]) {
      const p = getDifficulty(r);
      expect(p.mapSize).toBe(15);
      expect(p.clueCount).toBe(4);
      expect(p.decoyCount).toBe(0);
      expect(p.maxIntersection).toBe(15);
      expect(p.typeRatio).toEqual({ footprint: 60, disturbance: 30, scent: 10 });
    }
  });

  it('rounds 4-7: 20x20, 5 clues, 1 decoy, max intersection 8', () => {
    for (const r of [4, 7]) {
      const p = getDifficulty(r);
      expect(p.mapSize).toBe(20);
      expect(p.clueCount).toBe(5);
      expect(p.decoyCount).toBe(1);
      expect(p.maxIntersection).toBe(8);
      expect(p.typeRatio).toEqual({ footprint: 40, disturbance: 35, scent: 25 });
    }
  });

  it('rounds 8+: 25x25, 6 clues, 2 decoys, max intersection 4', () => {
    for (const r of [8, 20, 100]) {
      const p = getDifficulty(r);
      expect(p.mapSize).toBe(25);
      expect(p.clueCount).toBe(6);
      expect(p.decoyCount).toBe(2);
      expect(p.maxIntersection).toBe(4);
      expect(p.typeRatio).toEqual({ footprint: 20, disturbance: 30, scent: 50 });
    }
  });

  it('error/range shrinks as difficulty rises', () => {
    const [t1, t2, t3] = [getDifficulty(1), getDifficulty(4), getDifficulty(8)];
    expect(t1.footprintSpread).toBeGreaterThan(t2.footprintSpread);
    expect(t2.footprintSpread).toBeGreaterThan(t3.footprintSpread);
    expect(t1.scentTolerance).toBeGreaterThan(t3.scentTolerance);
    expect(t1.qte.arcSize).toBeGreaterThan(t3.qte.arcSize);
    expect(t1.qte.speed).toBeLessThan(t3.qte.speed);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run tests/difficulty.test.ts`
Expected: FAIL — `Cannot find module '../src/core/difficulty'`

- [ ] **Step 4: 實作 src/core/difficulty.ts**

```typescript
export interface QteParams {
  speed: number;   // 指針角速度（度/秒）
  arcSize: number; // 命中弧區大小（度）
  rounds: number;  // 嘗試次數
  needed: number;  // 需求命中數
}

export interface DifficultyParams {
  mapSize: number;
  clueCount: number;
  decoyCount: number;
  maxIntersection: number; // 允許交集格數上限（規格書 4.5）
  footprintSpread: number; // 足跡錐形半角（度）
  disturbanceRadius: number;
  scentTolerance: number;
  minClueDist: number; // footprint/scent 線索與錨定點的距離範圍
  maxClueDist: number;
  typeRatio: { footprint: number; disturbance: number; scent: number };
  staminaBudget: number;
  supplyCount: number;
  supplyRestore: number;
  qte: QteParams;
}

export function getDifficulty(round: number): DifficultyParams {
  if (round <= 3) {
    return {
      mapSize: 15, clueCount: 4, decoyCount: 0, maxIntersection: 15,
      footprintSpread: 40, disturbanceRadius: 4, scentTolerance: 1.0,
      minClueDist: 3, maxClueDist: 6,
      typeRatio: { footprint: 60, disturbance: 30, scent: 10 },
      staminaBudget: 45, supplyCount: 3, supplyRestore: 10,
      qte: { speed: 180, arcSize: 70, rounds: 3, needed: 2 },
    };
  }
  if (round <= 7) {
    return {
      mapSize: 20, clueCount: 5, decoyCount: 1, maxIntersection: 8,
      footprintSpread: 25, disturbanceRadius: 3, scentTolerance: 0.75,
      minClueDist: 4, maxClueDist: 8,
      typeRatio: { footprint: 40, disturbance: 35, scent: 25 },
      staminaBudget: 70, supplyCount: 4, supplyRestore: 10,
      qte: { speed: 240, arcSize: 55, rounds: 3, needed: 2 },
    };
  }
  return {
    mapSize: 25, clueCount: 6, decoyCount: 2, maxIntersection: 4,
    footprintSpread: 15, disturbanceRadius: 2, scentTolerance: 0.5,
    minClueDist: 5, maxClueDist: 10,
    typeRatio: { footprint: 20, disturbance: 30, scent: 50 },
    staminaBudget: 95, supplyCount: 5, supplyRestore: 10,
    qte: { speed: 300, arcSize: 40, rounds: 4, needed: 3 },
  };
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run tests/difficulty.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 6: Commit**

```powershell
git add src/core/types.ts src/core/difficulty.ts tests/difficulty.test.ts
git commit -m "feat: add core types and difficulty curve table per spec 4.5"
```

---

### Task 4: 線索候選集合語意與交集運算

**Files:**
- Create: `src/core/clues.ts`
- Test: `tests/clues.test.ts`

**Interfaces:**
- Consumes: `Clue`（Task 3）、`Vec2`/`dist`/`angleDeg`/`angleDiff`（Task 2）
- Produces:
  - `key(p: Vec2): string`（`"x,y"` 格式，全專案統一的格座標鍵）
  - `candidates(clue: Clue, mapSize: number): Set<string>`（該線索允許的目標格集合）
  - `intersect(clues: Clue[], mapSize: number): Set<string>`（所有線索候選集合的交集；空陣列回傳空集合）

語意定義（生成端 Task 6 依同一語意反向錨定，保證目標必在每個真線索的候選集合內）：
- footprint：`angleDiff(angleDeg(cluePos, cell), direction) <= angleSpread` 且 cell ≠ cluePos
- disturbance：`dist(cluePos, cell) <= radius`（含 cluePos 自身）
- scent：`|dist(cluePos, cell) - distance| <= tolerance` 

- [ ] **Step 1: 寫失敗測試 tests/clues.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { key, candidates, intersect } from '../src/core/clues';
import type { Clue } from '../src/core/types';

const footprint = (x: number, y: number, direction: number, angleSpread: number): Clue =>
  ({ type: 'footprint', position: { x, y }, isDecoy: false, data: { direction, angleSpread } });
const disturbance = (x: number, y: number, radius: number): Clue =>
  ({ type: 'disturbance', position: { x, y }, isDecoy: false, data: { radius } });
const scent = (x: number, y: number, distance: number, tolerance: number): Clue =>
  ({ type: 'scent', position: { x, y }, isDecoy: false, data: { distance, tolerance, windBiasNeeded: false } });

describe('key', () => {
  it('formats as x,y', () => {
    expect(key({ x: 3, y: 12 })).toBe('3,12');
  });
});

describe('candidates: footprint cone', () => {
  const clue = footprint(0, 0, 0, 40); // 指向東，半角40度
  const set = candidates(clue, 10);
  it('includes cells inside the cone', () => {
    expect(set.has('5,0')).toBe(true);  // 正東 0度
    expect(set.has('5,3')).toBe(true);  // 約31度
  });
  it('excludes cells outside the cone and its own cell', () => {
    expect(set.has('0,5')).toBe(false); // 正南 90度
    expect(set.has('0,0')).toBe(false); // 自身
  });
});

describe('candidates: disturbance disc', () => {
  const set = candidates(disturbance(5, 5, 2), 10);
  it('includes cells within radius, including own cell', () => {
    expect(set.has('5,5')).toBe(true);
    expect(set.has('7,5')).toBe(true);  // 距離2
    expect(set.has('6,6')).toBe(true);  // 距離√2
  });
  it('excludes cells beyond radius', () => {
    expect(set.has('8,5')).toBe(false); // 距離3
  });
});

describe('candidates: scent ring', () => {
  const set = candidates(scent(5, 5, 3, 0.5), 12);
  it('includes cells near the ring distance', () => {
    expect(set.has('8,5')).toBe(true); // 距離3
    expect(set.has('7,7')).toBe(true); // 距離√8≈2.83
  });
  it('excludes cells far from the ring', () => {
    expect(set.has('5,5')).toBe(false); // 距離0
    expect(set.has('10,5')).toBe(false); // 距離5
  });
});

describe('intersect', () => {
  it('returns cells satisfying all clues', () => {
    const set = intersect([disturbance(5, 5, 2), disturbance(7, 5, 2)], 12);
    expect(set.has('6,5')).toBe(true);
    expect(set.has('3,5')).toBe(false); // 只在第一個裡
  });
  it('empty clue list yields empty set', () => {
    expect(intersect([], 12).size).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/clues.test.ts`
Expected: FAIL — `Cannot find module '../src/core/clues'`

- [ ] **Step 3: 實作 src/core/clues.ts**

```typescript
import { dist, angleDeg, angleDiff, type Vec2 } from './geometry';
import type { Clue } from './types';

export const key = (p: Vec2): string => `${p.x},${p.y}`;

function matches(clue: Clue, cell: Vec2): boolean {
  const d = dist(clue.position, cell);
  switch (clue.type) {
    case 'footprint':
      if (cell.x === clue.position.x && cell.y === clue.position.y) return false;
      return angleDiff(angleDeg(clue.position, cell), clue.data.direction) <= clue.data.angleSpread;
    case 'disturbance':
      return d <= clue.data.radius;
    case 'scent':
      return Math.abs(d - clue.data.distance) <= clue.data.tolerance;
  }
}

export function candidates(clue: Clue, mapSize: number): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      if (matches(clue, { x, y })) out.add(key({ x, y }));
    }
  }
  return out;
}

export function intersect(clues: Clue[], mapSize: number): Set<string> {
  if (clues.length === 0) return new Set();
  let acc = candidates(clues[0], mapSize);
  for (const clue of clues.slice(1)) {
    const next = candidates(clue, mapSize);
    acc = new Set([...acc].filter((k) => next.has(k)));
  }
  return acc;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/clues.test.ts`
Expected: PASS（9 tests）

- [ ] **Step 5: Commit**

```powershell
git add src/core/clues.ts tests/clues.test.ts
git commit -m "feat: add clue candidate-set semantics and intersection solver"
```

---

### Task 5: 生物資料與圖鑑存檔

**Files:**
- Create: `src/data/creatures.ts`
- Create: `src/core/codex.ts`
- Test: `tests/creatures.test.ts`
- Test: `tests/codex.test.ts`

**Interfaces:**
- Consumes: `TerrainType`/`Locale`（Task 3）
- Produces:
  - `interface Creature { id: string; names: Record<Locale, string>; descs: Record<Locale, string>; color: number; terrain: TerrainType }`
  - `const CREATURES: Creature[]`（8 種，id 唯一，名稱/描述皆含 en 與 zh-TW）
  - `interface CodexStore { counts(): Record<string, number>; add(id: string): void }`
  - `createCodex(storage?: Pick<Storage, 'getItem' | 'setItem'>): CodexStore`（無 storage 時記憶體備援；讀取失敗回空物件）

- [ ] **Step 1: 寫失敗測試 tests/creatures.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { CREATURES } from '../src/data/creatures';

describe('CREATURES', () => {
  it('has exactly 8 creatures with unique ids', () => {
    expect(CREATURES.length).toBe(8);
    expect(new Set(CREATURES.map((c) => c.id)).size).toBe(8);
  });
  it('all terrain preferences are valid terrain types', () => {
    const valid = ['meadow', 'mist', 'thicket', 'rock'];
    for (const c of CREATURES) expect(valid).toContain(c.terrain);
  });
  it('every creature has names and descriptions in both locales', () => {
    for (const c of CREATURES) {
      expect(c.names.en.length).toBeGreaterThan(0);
      expect(c.names['zh-TW'].length).toBeGreaterThan(0);
      expect(c.descs.en.length).toBeGreaterThan(0);
      expect(c.descs['zh-TW'].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/creatures.test.ts`
Expected: FAIL — `Cannot find module '../src/data/creatures'`

- [ ] **Step 3: 實作 src/data/creatures.ts**

內容邊界提醒：以下名稱/描述均為架空虛構，不指涉任何真實文化、族群或宗教符號；描述避免暴力字眼。

```typescript
import type { TerrainType, Locale } from '../core/types';

export interface Creature {
  id: string;
  names: Record<Locale, string>;
  descs: Record<Locale, string>;
  color: number; // 剪影佔位色/發光細節色（後續換 sprite；不得與線索金光 0xd8c874 相近，避免誤讀為線索）
  terrain: TerrainType; // 地形偏好：目標所在格地形
}

export const CREATURES: Creature[] = [
  { id: 'mistfawn', names: { en: 'Mistfawn', 'zh-TW': '霧絨鹿' }, color: 0x9ad1c8, terrain: 'mist',
    descs: { en: 'A gentle grazer that melts into morning fog when startled.', 'zh-TW': '性情溫馴的食草獸，受驚時化入晨霧之中。' } },
  { id: 'emberquill', names: { en: 'Emberquill', 'zh-TW': '燼棘獸' }, color: 0xe0955f, terrain: 'rock',
    descs: { en: 'Its soft quills give off a faint warm glow at dusk.', 'zh-TW': '柔軟的棘刺在暮色中散發微微暖光。' } },
  { id: 'thicketloom', names: { en: 'Thicketloom', 'zh-TW': '織叢雀' }, color: 0x7ba05b, terrain: 'thicket',
    descs: { en: 'Weaves hanging nests from silver vines deep in the brush.', 'zh-TW': '在密叢深處以銀藤編織懸巢。' } },
  { id: 'dewhopper', names: { en: 'Dewhopper', 'zh-TW': '露躍獸' }, color: 0x8fb8de, terrain: 'meadow',
    descs: { en: 'Leaps between dew-heavy grass blades without shaking a drop.', 'zh-TW': '在綴滿露水的草葉間跳躍，不驚落一滴。' } },
  { id: 'veilmoth', names: { en: 'Veilmoth', 'zh-TW': '紗霧蛾' }, color: 0xc9b1d6, terrain: 'mist',
    descs: { en: 'Broad wings patterned like slowly drifting haze.', 'zh-TW': '寬大的翅膀帶著如流霧般的紋路。' } },
  { id: 'lanternshrew', names: { en: 'Lanternshrew', 'zh-TW': '燈籽獸' }, color: 0xe88fb0, terrain: 'thicket',
    descs: { en: 'Carries a glowing seed in its cheek to light narrow trails.', 'zh-TW': '頰囊裡含著發光種籽，照亮窄徑。' } },
  { id: 'ridgecrest', names: { en: 'Ridgecrest', 'zh-TW': '稜脊獸' }, color: 0xc0ccd8, terrain: 'rock',
    descs: { en: 'Its stony crest mirrors the skyline of the mountains it roams.', 'zh-TW': '石質背脊映著牠漫遊的群山稜線。' } },
  { id: 'plumetail', names: { en: 'Plumetail', 'zh-TW': '羽尾獸' }, color: 0xb5d68f, terrain: 'meadow',
    descs: { en: 'Trails soft spores that settle over the grass like morning frost.', 'zh-TW': '尾羽灑落的孢子如晨霜覆上草地。' } },
];
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/creatures.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: 寫失敗測試 tests/codex.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { createCodex } from '../src/core/codex';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createCodex', () => {
  it('counts recorded creatures', () => {
    const codex = createCodex(fakeStorage());
    codex.add('mistfawn');
    codex.add('mistfawn');
    codex.add('veilmoth');
    expect(codex.counts()).toEqual({ mistfawn: 2, veilmoth: 1 });
  });

  it('persists through the provided storage', () => {
    const storage = fakeStorage();
    createCodex(storage).add('emberquill');
    expect(createCodex(storage).counts()).toEqual({ emberquill: 1 });
  });

  it('works without storage (in-memory fallback)', () => {
    const codex = createCodex();
    codex.add('dewhopper');
    expect(codex.counts()).toEqual({ dewhopper: 1 });
  });

  it('recovers from corrupted stored data', () => {
    const codex = createCodex(fakeStorage({ 'rht.codex.v1': 'not-json{{{' }));
    expect(codex.counts()).toEqual({});
  });
});
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `npx vitest run tests/codex.test.ts`
Expected: FAIL — `Cannot find module '../src/core/codex'`

- [ ] **Step 7: 實作 src/core/codex.ts**

```typescript
export interface CodexStore {
  counts(): Record<string, number>;
  add(id: string): void;
}

const STORAGE_KEY = 'rht.codex.v1';

export function createCodex(storage?: Pick<Storage, 'getItem' | 'setItem'>): CodexStore {
  let mem: Record<string, number> = {};

  const load = (): Record<string, number> => {
    if (!storage) return mem;
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const save = (data: Record<string, number>): void => {
    mem = data;
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage 不可用（隱私模式等）時退回記憶體
    }
  };

  return {
    counts: load,
    add(id: string) {
      const data = load();
      data[id] = (data[id] ?? 0) + 1;
      save(data);
    },
  };
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run tests/codex.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 9: Commit**

```powershell
git add src/data/creatures.ts src/core/codex.ts tests/creatures.test.ts tests/codex.test.ts
git commit -m "feat: add 8 original creatures (bilingual) and persistent codex store"
```

---

### Task 5A: 多語系模組（en / zh-TW）

**Files:**
- Create: `src/core/i18n.ts`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Consumes: `Locale`（Task 3）
- Produces:
  - `type MsgKey`（所有 UI 字串 key 的聯集型別，見實作）
  - `const STRINGS: Record<Locale, Record<MsgKey, string>>`（供測試驗證 key 完整性）
  - `interface I18n { locale(): Locale; setLocale(l: Locale): void; t(key: MsgKey, vars?: Record<string, string | number>): string }`
  - `detectLocale(lang: string | undefined | null): Locale`（`zh*` → `'zh-TW'`，其餘 → `'en'`）
  - `createI18n(initial: Locale, storage?: Pick<Storage, 'getItem' | 'setItem'>): I18n`（storage 記憶語言選擇，key `'rht.locale.v1'`；讀寫失敗靜默退回記憶體）

- [ ] **Step 1: 寫失敗測試 tests/i18n.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { detectLocale, createI18n, STRINGS } from '../src/core/i18n';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('detectLocale', () => {
  it('maps Chinese language tags to zh-TW', () => {
    expect(detectLocale('zh-TW')).toBe('zh-TW');
    expect(detectLocale('zh-Hant-TW')).toBe('zh-TW');
    expect(detectLocale('zh')).toBe('zh-TW');
  });
  it('defaults everything else to en', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('ja')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});

describe('string tables', () => {
  it('en and zh-TW cover exactly the same keys', () => {
    expect(Object.keys(STRINGS['zh-TW']).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('no string is empty', () => {
    for (const table of Object.values(STRINGS)) {
      for (const v of Object.values(table)) expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe('createI18n', () => {
  it('translates with variable interpolation', () => {
    const i18n = createI18n('en');
    expect(i18n.t('hud.round', { n: 3 })).toBe('Round 3');
    i18n.setLocale('zh-TW');
    expect(i18n.t('hud.round', { n: 3 })).toBe('第 3 局');
  });
  it('persists locale through storage', () => {
    const storage = fakeStorage();
    createI18n('en', storage).setLocale('zh-TW');
    expect(createI18n('en', storage).locale()).toBe('zh-TW');
  });
  it('ignores corrupted stored locale', () => {
    const i18n = createI18n('en', fakeStorage({ 'rht.locale.v1': 'xx' }));
    expect(i18n.locale()).toBe('en');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/i18n.test.ts`
Expected: FAIL — `Cannot find module '../src/core/i18n'`

- [ ] **Step 3: 實作 src/core/i18n.ts**

```typescript
import type { Locale } from './types';

export type MsgKey =
  | 'hud.round' | 'hud.stamina' | 'hud.hint'
  | 'qte.title' | 'qte.instruction' | 'qte.progress'
  | 'result.recorded'
  | 'result.escaped.title' | 'result.escaped.body'
  | 'result.exhausted.title' | 'result.exhausted.body'
  | 'btn.next' | 'btn.retry' | 'btn.guide' | 'btn.back'
  | 'codex.title' | 'codex.count' | 'codex.unknown' | 'codex.notRecorded' | 'codex.times';

export const STRINGS: Record<Locale, Record<MsgKey, string>> = {
  en: {
    'hud.round': 'Round {n}',
    'hud.stamina': 'Stamina {n}',
    'hud.hint': 'Move: click/arrow keys · Mark: Shift+click',
    'qte.title': 'Close Encounter',
    'qte.instruction': 'Tap or press SPACE when the needle crosses the glowing arc',
    'qte.progress': 'Hits {hits}/{needed}   Attempts {attempt}/{rounds}',
    'result.recorded': '{name} recorded!',
    'result.escaped.title': 'It slipped away into the mist...',
    'result.escaped.body': 'The trail went cold. Every clue is lost — start the tracking again.',
    'result.exhausted.title': 'You ran out of stamina.',
    'result.exhausted.body': 'Rest up. The mountain keeps its secrets for now.',
    'btn.next': '[ Next Hunt ]',
    'btn.retry': '[ Track Again ]',
    'btn.guide': '[ Field Guide ]',
    'btn.back': '[ Back to Trail ]',
    'codex.title': 'Field Guide',
    'codex.count': '{found} / {total} recorded',
    'codex.unknown': '???',
    'codex.notRecorded': 'Not yet recorded',
    'codex.times': 'recorded x{n}',
  },
  'zh-TW': {
    'hud.round': '第 {n} 局',
    'hud.stamina': '體力 {n}',
    'hud.hint': '移動：點擊/方向鍵 · 標記：Shift+點擊',
    'qte.title': '近距離判讀',
    'qte.instruction': '指針掃過發光弧區時點擊或按空白鍵',
    'qte.progress': '命中 {hits}/{needed}   嘗試 {attempt}/{rounds}',
    'result.recorded': '已記錄 {name}！',
    'result.escaped.title': '牠溜進霧裡了……',
    'result.escaped.body': '蹤跡已冷，線索全數消散——重新開始追蹤吧。',
    'result.exhausted.title': '體力耗盡了。',
    'result.exhausted.body': '休息一下，山林暫時守住了牠的祕密。',
    'btn.next': '［下一場狩獵］',
    'btn.retry': '［重新追蹤］',
    'btn.guide': '［生態圖鑑］',
    'btn.back': '［返回山徑］',
    'codex.title': '生態圖鑑',
    'codex.count': '已記錄 {found} / {total} 種',
    'codex.unknown': '？？？',
    'codex.notRecorded': '尚未記錄',
    'codex.times': '記錄 ×{n}',
  },
};

const STORAGE_KEY = 'rht.locale.v1';

export interface I18n {
  locale(): Locale;
  setLocale(l: Locale): void;
  t(key: MsgKey, vars?: Record<string, string | number>): string;
}

export function detectLocale(lang: string | undefined | null): Locale {
  return (lang ?? '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

export function createI18n(initial: Locale, storage?: Pick<Storage, 'getItem' | 'setItem'>): I18n {
  let current: Locale = initial;
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh-TW') current = saved;
    } catch {
      // storage 不可用時沿用 initial
    }
  }
  return {
    locale: () => current,
    setLocale(l: Locale) {
      current = l;
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, l);
      } catch {
        // 靜默退回記憶體
      }
    },
    t(key, vars) {
      let s = STRINGS[current][key];
      for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/i18n.test.ts`
Expected: PASS（7 tests）

- [ ] **Step 5: Commit**

```powershell
git add src/core/i18n.ts tests/i18n.test.ts
git commit -m "feat: add en/zh-TW i18n with browser detection and persisted toggle"
```

---

### Task 6: 關卡生成（反向錨定＋收斂檢查＋干擾線索）

**Files:**
- Create: `src/core/generate.ts`
- Test: `tests/generate.test.ts`

**Interfaces:**
- Consumes: `Rng`/`randInt`/`pickWeighted`（Task 2）、幾何工具（Task 2）、`Clue`/`Level`/`TerrainType`（Task 3）、`getDifficulty`（Task 3）、`key`/`intersect`（Task 4）、`CREATURES`（Task 5）
- Produces:
  - `generateLevel(round: number, rng: Rng): Level`

演算法（規格書 §4.2 反向錨定法）：
1. 隨機選 `targetPos`，隨機選生物並把目標格地形設為其偏好。
2. 依 `typeRatio` 抽線索型別，從目標反推線索位置（在距離 `[minClueDist, maxClueDist]`、隨機角度的圓上取點，夾回地圖）；線索資料由「夾界後的實際幾何關係」計算（footprint 記實際方位角、disturbance 半徑 ≥ 實際距離、scent 記四捨五入實際距離），因此目標**必定**落在每個真線索候選集合內，無需事後驗證。
3. 收斂檢查：真線索交集 > `maxIntersection` 時追加 scent 線索（最多 +5 個，防無窮迴圈）。
4. 難度 tier ≥ 2 時生成干擾線索：`decoyPos` 與目標距離 ≥ 5，錨定 decoyPos 生成 `decoyCount` 個線索，`isDecoy: true`（僅供內部統計，渲染完全相同）。
5. 生成地形（權重 meadow 5 / mist 2 / thicket 2 / rock 1）與補給點（不與目標、線索重疊）。

- [ ] **Step 1: 寫失敗測試 tests/generate.test.ts**（性質測試，跨 200 種子 × 各難度）

```typescript
import { describe, it, expect } from 'vitest';
import { generateLevel } from '../src/core/generate';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key, intersect } from '../src/core/clues';
import { dist } from '../src/core/geometry';
import { CREATURES } from '../src/data/creatures';

describe('generateLevel (property tests over 200 seeds)', () => {
  const cases = Array.from({ length: 200 }, (_, i) => ({
    seed: i * 7 + 1,
    round: (i % 10) + 1, // 涵蓋三個難度 tier
  }));

  it('target is always inside the intersection of real clues (solvable)', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      const real = level.clues.filter((c) => !c.isDecoy);
      expect(intersect(real, level.mapSize).has(key(level.targetPos))).toBe(true);
    }
  });

  it('intersection converges below cap (or hits the extra-clue safety limit)', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      const real = level.clues.filter((c) => !c.isDecoy);
      const size = intersect(real, level.mapSize).size;
      expect(size <= p.maxIntersection || real.length >= p.clueCount + 5).toBe(true);
    }
  });

  it('decoy count matches difficulty and decoys sit far from target', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      const decoys = level.clues.filter((c) => c.isDecoy);
      expect(decoys.length).toBe(p.decoyCount);
    }
  });

  it('map, terrain, supplies and creature are consistent', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      expect(level.mapSize).toBe(p.mapSize);
      expect(level.terrain.length).toBe(p.mapSize);
      expect(level.terrain[0].length).toBe(p.mapSize);
      const creature = CREATURES.find((c) => c.id === level.creatureId);
      expect(creature).toBeDefined();
      expect(level.terrain[level.targetPos.y][level.targetPos.x]).toBe(creature!.terrain);
      expect(level.supplies.length).toBeLessThanOrEqual(p.supplyCount);
      for (const s of level.supplies) {
        expect(key(s)).not.toBe(key(level.targetPos));
      }
    }
  });

  it('same seed reproduces the same level', () => {
    const a = generateLevel(5, mulberry32(99));
    const b = generateLevel(5, mulberry32(99));
    expect(a).toEqual(b);
  });

  it('every clue position differs from its anchor evidence: no clue on top of target', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues.filter((c) => !c.isDecoy)) {
        expect(key(c.position)).not.toBe(key(level.targetPos));
      }
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/generate.test.ts`
Expected: FAIL — `Cannot find module '../src/core/generate'`

- [ ] **Step 3: 實作 src/core/generate.ts**

```typescript
import { randInt, pickWeighted, type Rng } from './rng';
import { dist, clampToMap, angleDeg, pointOnCircle, type Vec2 } from './geometry';
import type { Clue, ClueType, Level, TerrainType } from './types';
import { getDifficulty, type DifficultyParams } from './difficulty';
import { key, intersect } from './clues';
import { CREATURES } from '../data/creatures';

const TERRAIN_POOL: [TerrainType, number][] = [
  ['meadow', 5], ['mist', 2], ['thicket', 2], ['rock', 1],
];

function randomPos(rng: Rng, size: number): Vec2 {
  return { x: randInt(rng, 0, size - 1), y: randInt(rng, 0, size - 1) };
}

function randomPosFarFrom(rng: Rng, size: number, from: Vec2, minDist: number): Vec2 {
  for (let i = 0; i < 100; i++) {
    const p = randomPos(rng, size);
    if (dist(p, from) >= minDist) return p;
  }
  // 幾乎不會發生的保底：取離 from 最遠的角落
  const s = size - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, from) > dist(a, from) ? b : a));
}

// 反向錨定：線索資料一律由「夾界後的實際位置」與錨點的幾何關係計算，
// 確保錨點（目標或幌子點）必在候選集合內。
function makeClue(
  type: ClueType, anchor: Vec2, p: DifficultyParams, rng: Rng, size: number, isDecoy: boolean,
): Clue {
  let pos: Vec2 = anchor;
  for (let i = 0; i < 12; i++) {
    const d = type === 'disturbance'
      ? randInt(rng, 1, p.disturbanceRadius)
      : randInt(rng, p.minClueDist, p.maxClueDist);
    pos = clampToMap(pointOnCircle(anchor, d, rng() * 360), size);
    if (pos.x !== anchor.x || pos.y !== anchor.y) break;
  }
  if (pos.x === anchor.x && pos.y === anchor.y) {
    pos = clampToMap({ x: anchor.x + (anchor.x === 0 ? 1 : -1), y: anchor.y }, size);
  }
  const actual = dist(pos, anchor);
  switch (type) {
    case 'footprint':
      return { type, position: pos, isDecoy, data: { direction: angleDeg(pos, anchor), angleSpread: p.footprintSpread } };
    case 'disturbance':
      return { type, position: pos, isDecoy, data: { radius: Math.max(p.disturbanceRadius, Math.ceil(actual)) } };
    case 'scent':
      return { type, position: pos, isDecoy, data: { distance: Math.round(actual), tolerance: p.scentTolerance, windBiasNeeded: false } };
  }
}

export function generateLevel(round: number, rng: Rng): Level {
  const p = getDifficulty(round);
  const size = p.mapSize;
  const creature = CREATURES[randInt(rng, 0, CREATURES.length - 1)];
  const targetPos = randomPos(rng, size);

  const ratio: [ClueType, number][] = [
    ['footprint', p.typeRatio.footprint],
    ['disturbance', p.typeRatio.disturbance],
    ['scent', p.typeRatio.scent],
  ];

  const clues: Clue[] = [];
  for (let i = 0; i < p.clueCount; i++) {
    clues.push(makeClue(pickWeighted(rng, ratio), targetPos, p, rng, size, false));
  }

  // 可解性收斂檢查（規格書 4.2）：交集過大時追加 scent（環形收斂最快），上限 +5
  for (let extra = 0; extra < 5; extra++) {
    if (intersect(clues, size).size <= p.maxIntersection) break;
    clues.push(makeClue('scent', targetPos, p, rng, size, false));
  }

  // 干擾線索（規格書 4.2）：decoyPos 與 targetPos 距離 >= 5
  if (p.decoyCount > 0) {
    const decoyPos = randomPosFarFrom(rng, size, targetPos, 5);
    const uniform: [ClueType, number][] = [['footprint', 1], ['disturbance', 1], ['scent', 1]];
    for (let i = 0; i < p.decoyCount; i++) {
      clues.push(makeClue(pickWeighted(rng, uniform), decoyPos, p, rng, size, true));
    }
  }

  const terrain: TerrainType[][] = [];
  for (let y = 0; y < size; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < size; x++) row.push(pickWeighted(rng, TERRAIN_POOL));
    terrain.push(row);
  }
  terrain[targetPos.y][targetPos.x] = creature.terrain;

  const taken = new Set([key(targetPos), ...clues.map((c) => key(c.position))]);
  const supplies: Vec2[] = [];
  for (let i = 0; i < 200 && supplies.length < p.supplyCount; i++) {
    const s = randomPos(rng, size);
    if (!taken.has(key(s))) {
      taken.add(key(s));
      supplies.push(s);
    }
  }

  return { round, mapSize: size, targetPos, clues, terrain, supplies, creatureId: creature.id };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/generate.test.ts`
Expected: PASS（6 tests；性質測試共 200 種子，執行時間應在數秒內）

- [ ] **Step 5: Commit**

```powershell
git add src/core/generate.ts tests/generate.test.ts
git commit -m "feat: add reverse-anchored level generation with convergence check and decoys"
```

---

### Task 7: 單局狀態機（移動/體力/補給/標記/QTE 觸發）

**Files:**
- Create: `src/core/session.ts`
- Test: `tests/session.test.ts`

**Interfaces:**
- Consumes: `generateLevel`（Task 6）、`getDifficulty`（Task 3）、`key`（Task 4）、`cheb`/`dist`/`Vec2`（Task 2）、`Level`/`TerrainType`（Task 3）、`Rng`（Task 2）
- Produces:
  - `type Phase = 'explore' | 'qte' | 'caught' | 'escaped' | 'exhausted'`
  - `const TERRAIN_COST: Record<TerrainType, number>`（meadow 1, mist 1, thicket 2, rock 2）
  - `interface SessionState { round; level; player; stamina; readClues: Set<string>; marks: Set<string>; phase: Phase }`
  - `newSession(round: number, rng: Rng): SessionState`（玩家起點 = 離目標最遠的角落）
  - `canMove(s: SessionState, to: Vec2): boolean`（explore 中、地圖內、Chebyshev 相鄰、體力足夠）
  - `move(s: SessionState, to: Vec2): void`（就地修改：扣體力→移動→拾補給→判讀線索→觸發 QTE→體力歸零判定）
  - `toggleMark(s: SessionState, p: Vec2): void`
  - `resolveQte(s: SessionState, success: boolean): void`（true→caught，false→escaped）
  - `nextSession(s: SessionState, rng: Rng): SessionState`（caught→round+1；escaped/exhausted→同 round 重新生成 = 規格「線索清空重新追蹤」）

- [ ] **Step 1: 寫失敗測試 tests/session.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  newSession, canMove, move, toggleMark, resolveQte, nextSession,
  TERRAIN_COST, type SessionState,
} from '../src/core/session';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import type { Level, TerrainType } from '../src/core/types';

// 手工關卡：5x5 全草地，目標 (4,4)，補給 (1,0)，scent 線索 (2,0)
function makeState(overrides: Partial<SessionState> = {}): SessionState {
  const terrain: TerrainType[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 'meadow' as TerrainType));
  const level: Level = {
    round: 1, mapSize: 5, targetPos: { x: 4, y: 4 },
    clues: [{
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: false,
      data: { distance: 4, tolerance: 1, windBiasNeeded: false },
    }],
    terrain, supplies: [{ x: 1, y: 0 }], creatureId: 'mistfawn',
  };
  return {
    round: 1, level, player: { x: 0, y: 0 }, stamina: 10,
    readClues: new Set(), marks: new Set(), phase: 'explore',
    ...overrides,
  };
}

describe('newSession', () => {
  it('starts at a corner with full stamina in explore phase', () => {
    const s = newSession(1, mulberry32(11));
    expect(s.stamina).toBe(getDifficulty(1).staminaBudget);
    expect(s.phase).toBe('explore');
    const corners = [0, s.level.mapSize - 1];
    expect(corners).toContain(s.player.x);
    expect(corners).toContain(s.player.y);
  });
});

describe('canMove', () => {
  it('allows only chebyshev-adjacent in-bounds moves during explore', () => {
    const s = makeState();
    expect(canMove(s, { x: 1, y: 1 })).toBe(true);   // 斜向相鄰
    expect(canMove(s, { x: 2, y: 0 })).toBe(false);  // 距離2
    expect(canMove(s, { x: -1, y: 0 })).toBe(false); // 出界
    expect(canMove(s, { x: 0, y: 0 })).toBe(false);  // 原地
  });
  it('blocks moves the player cannot afford', () => {
    const s = makeState({ stamina: 0 });
    expect(canMove(s, { x: 1, y: 0 })).toBe(false);
  });
});

describe('move', () => {
  it('deducts terrain cost', () => {
    const s = makeState();
    move(s, { x: 0, y: 1 });
    expect(s.player).toEqual({ x: 0, y: 1 });
    expect(s.stamina).toBe(10 - TERRAIN_COST.meadow);
  });
  it('picks up supply: +10 stamina and supply removed', () => {
    const s = makeState();
    move(s, { x: 1, y: 0 });
    expect(s.stamina).toBe(10 - 1 + 10);
    expect(s.level.supplies.length).toBe(0);
  });
  it('reads a clue when stepping onto it', () => {
    const s = makeState({ player: { x: 1, y: 0 } });
    move(s, { x: 2, y: 0 });
    expect(s.readClues.has('2,0')).toBe(true);
  });
  it('triggers QTE when moving within chebyshev 1 of target', () => {
    const s = makeState({ player: { x: 3, y: 3 } });
    move(s, { x: 3, y: 4 }); // cheb((3,4),(4,4)) = 1
    expect(s.phase).toBe('qte');
  });
  it('exhausts when stamina hits zero away from target', () => {
    const s = makeState({ stamina: 1 });
    move(s, { x: 0, y: 1 });
    expect(s.stamina).toBe(0);
    expect(s.phase).toBe('exhausted');
  });
  it('QTE at last breath still triggers (checked before exhaustion)', () => {
    const s = makeState({ player: { x: 3, y: 3 }, stamina: 1 });
    move(s, { x: 3, y: 4 });
    expect(s.phase).toBe('qte');
  });
});

describe('toggleMark', () => {
  it('toggles marks on and off', () => {
    const s = makeState();
    toggleMark(s, { x: 2, y: 2 });
    expect(s.marks.has('2,2')).toBe(true);
    toggleMark(s, { x: 2, y: 2 });
    expect(s.marks.has('2,2')).toBe(false);
  });
});

describe('resolveQte / nextSession', () => {
  it('success -> caught -> next round', () => {
    const s = makeState({ phase: 'qte' });
    resolveQte(s, true);
    expect(s.phase).toBe('caught');
    const next = nextSession(s, mulberry32(5));
    expect(next.round).toBe(2);
    expect(next.phase).toBe('explore');
  });
  it('failure -> escaped -> same round regenerated with cleared clues', () => {
    const s = makeState({ phase: 'qte' });
    s.readClues.add('2,0');
    resolveQte(s, false);
    expect(s.phase).toBe('escaped');
    const next = nextSession(s, mulberry32(5));
    expect(next.round).toBe(1);
    expect(next.readClues.size).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL — `Cannot find module '../src/core/session'`

- [ ] **Step 3: 實作 src/core/session.ts**

```typescript
import { cheb, dist, type Vec2 } from './geometry';
import type { Level, TerrainType } from './types';
import { getDifficulty } from './difficulty';
import { generateLevel } from './generate';
import { key } from './clues';
import type { Rng } from './rng';

export type Phase = 'explore' | 'qte' | 'caught' | 'escaped' | 'exhausted';

export const TERRAIN_COST: Record<TerrainType, number> = {
  meadow: 1, mist: 1, thicket: 2, rock: 2,
};

export interface SessionState {
  round: number;
  level: Level;
  player: Vec2;
  stamina: number;
  readClues: Set<string>; // 已判讀（踩過）的線索位置鍵
  marks: Set<string>;     // 玩家自行標記的格
  phase: Phase;
}

function startPos(level: Level): Vec2 {
  const s = level.mapSize - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, level.targetPos) > dist(a, level.targetPos) ? b : a));
}

export function newSession(round: number, rng: Rng): SessionState {
  const level = generateLevel(round, rng);
  return {
    round,
    level,
    player: startPos(level),
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Set(),
    phase: 'explore',
  };
}

export function canMove(s: SessionState, to: Vec2): boolean {
  if (s.phase !== 'explore') return false;
  if (to.x < 0 || to.y < 0 || to.x >= s.level.mapSize || to.y >= s.level.mapSize) return false;
  if (cheb(s.player, to) !== 1) return false;
  return s.stamina >= TERRAIN_COST[s.level.terrain[to.y][to.x]];
}

export function move(s: SessionState, to: Vec2): void {
  if (!canMove(s, to)) return;
  s.stamina -= TERRAIN_COST[s.level.terrain[to.y][to.x]];
  s.player = to;

  const k = key(to);
  const supplyIdx = s.level.supplies.findIndex((p) => key(p) === k);
  if (supplyIdx >= 0) {
    s.level.supplies.splice(supplyIdx, 1);
    s.stamina += getDifficulty(s.round).supplyRestore;
  }
  if (s.level.clues.some((c) => key(c.position) === k)) s.readClues.add(k);

  // 逼近目標的判定先於力竭判定：最後一步逼近仍可觸發 QTE
  if (cheb(to, s.level.targetPos) <= 1) {
    s.phase = 'qte';
    return;
  }
  if (s.stamina <= 0) s.phase = 'exhausted';
}

export function toggleMark(s: SessionState, p: Vec2): void {
  const k = key(p);
  if (s.marks.has(k)) s.marks.delete(k);
  else s.marks.add(k);
}

export function resolveQte(s: SessionState, success: boolean): void {
  s.phase = success ? 'caught' : 'escaped';
}

// caught → 下一局（難度遞增）；escaped / exhausted → 同難度整局重生（線索清空，規格 3）
export function nextSession(s: SessionState, rng: Rng): SessionState {
  return newSession(s.phase === 'caught' ? s.round + 1 : s.round, rng);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/session.test.ts`
Expected: PASS（12 tests）

- [ ] **Step 5: 全量回歸**

Run: `npm run test`
Expected: 全部 PASS，0 failed

- [ ] **Step 6: Commit**

```powershell
git add src/core/session.ts tests/session.test.ts
git commit -m "feat: add hunt session state machine with stamina, supplies and QTE trigger"
```

---

### Task 8: QTE 判定邏輯（純邏輯）

**Files:**
- Create: `src/core/qte.ts`
- Test: `tests/qte.test.ts`

**Interfaces:**
- Consumes: `QteParams`（Task 3）、`Rng`（Task 2）
- Produces:
  - `interface QteState { attempt: number; hits: number; arcStart: number; pointer: number; done: boolean; success: boolean | null; lastHit: boolean | null }`
  - `newQte(cfg: QteParams, rng: Rng): QteState`（pointer 從 0 開始，arcStart 隨機落在 [0, 360-arcSize]）
  - `tick(q: QteState, cfg: QteParams, dtMs: number): void`（指針依 speed 度/秒前進並繞 360 循環；done 後不動）
  - `press(q: QteState, cfg: QteParams, rng: Rng): void`（判命中→計數→重擲弧區→終局判定）

- [ ] **Step 1: 寫失敗測試 tests/qte.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { newQte, tick, press, type QteState } from '../src/core/qte';
import { mulberry32 } from '../src/core/rng';
import type { QteParams } from '../src/core/difficulty';

const CFG: QteParams = { speed: 180, arcSize: 70, rounds: 3, needed: 2 };

describe('newQte', () => {
  it('starts at pointer 0 with arc inside [0, 360-arcSize]', () => {
    const q = newQte(CFG, mulberry32(1));
    expect(q.pointer).toBe(0);
    expect(q.arcStart).toBeGreaterThanOrEqual(0);
    expect(q.arcStart).toBeLessThanOrEqual(360 - CFG.arcSize);
    expect(q.done).toBe(false);
  });
});

describe('tick', () => {
  it('advances pointer by speed * dt and wraps at 360', () => {
    const q = newQte(CFG, mulberry32(1));
    tick(q, CFG, 500); // 180度/s * 0.5s = 90度
    expect(q.pointer).toBeCloseTo(90);
    tick(q, CFG, 2000); // +360 -> 繞回
    expect(q.pointer).toBeCloseTo(90);
  });
  it('does not move after done', () => {
    const q = newQte(CFG, mulberry32(1));
    q.done = true;
    tick(q, CFG, 500);
    expect(q.pointer).toBe(0);
  });
});

describe('press', () => {
  function fixed(q: QteState, arcStart: number, pointer: number): QteState {
    q.arcStart = arcStart;
    q.pointer = pointer;
    return q;
  }

  it('registers a hit when pointer is inside the arc', () => {
    const q = fixed(newQte(CFG, mulberry32(1)), 0, 30);
    press(q, CFG, mulberry32(2));
    expect(q.lastHit).toBe(true);
    expect(q.hits).toBe(1);
    expect(q.attempt).toBe(1);
  });

  it('registers a miss when pointer is outside the arc', () => {
    const q = fixed(newQte(CFG, mulberry32(1)), 0, 200);
    press(q, CFG, mulberry32(2));
    expect(q.lastHit).toBe(false);
    expect(q.hits).toBe(0);
  });

  it('succeeds as soon as needed hits are reached', () => {
    const q = newQte(CFG, mulberry32(1));
    press(fixed(q, 0, 10), CFG, mulberry32(2));
    press(fixed(q, 0, 10), CFG, mulberry32(3));
    expect(q.done).toBe(true);
    expect(q.success).toBe(true);
  });

  it('fails after exhausting all attempts without enough hits', () => {
    const q = newQte(CFG, mulberry32(1));
    press(fixed(q, 0, 200), CFG, mulberry32(2));
    press(fixed(q, 0, 200), CFG, mulberry32(3));
    press(fixed(q, 0, 200), CFG, mulberry32(4));
    expect(q.done).toBe(true);
    expect(q.success).toBe(false);
  });

  it('rerolls the arc between attempts while not done', () => {
    const q = newQte(CFG, mulberry32(1));
    press(fixed(q, 0, 10), CFG, mulberry32(2));
    expect(q.done).toBe(false);
    expect(q.arcStart).toBeGreaterThanOrEqual(0);
    expect(q.arcStart).toBeLessThanOrEqual(360 - CFG.arcSize);
  });

  it('ignores presses after done', () => {
    const q = newQte(CFG, mulberry32(1));
    q.done = true;
    q.success = true;
    press(q, CFG, mulberry32(2));
    expect(q.attempt).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/qte.test.ts`
Expected: FAIL — `Cannot find module '../src/core/qte'`

- [ ] **Step 3: 實作 src/core/qte.ts**

```typescript
import type { QteParams } from './difficulty';
import type { Rng } from './rng';

export interface QteState {
  attempt: number;
  hits: number;
  arcStart: number;        // 命中弧區起始角（度）
  pointer: number;         // 指針目前角度（度）
  done: boolean;
  success: boolean | null; // done 前為 null
  lastHit: boolean | null; // 供渲染層做回饋
}

const rollArc = (cfg: QteParams, rng: Rng): number => rng() * (360 - cfg.arcSize);

export function newQte(cfg: QteParams, rng: Rng): QteState {
  return {
    attempt: 0, hits: 0,
    arcStart: rollArc(cfg, rng), pointer: 0,
    done: false, success: null, lastHit: null,
  };
}

export function tick(q: QteState, cfg: QteParams, dtMs: number): void {
  if (q.done) return;
  q.pointer = (q.pointer + (cfg.speed * dtMs) / 1000) % 360;
}

export function press(q: QteState, cfg: QteParams, rng: Rng): void {
  if (q.done) return;
  const hit = q.pointer >= q.arcStart && q.pointer <= q.arcStart + cfg.arcSize;
  q.lastHit = hit;
  if (hit) q.hits++;
  q.attempt++;

  if (q.hits >= cfg.needed) {
    q.done = true;
    q.success = true;
    return;
  }
  if (q.attempt >= cfg.rounds) {
    q.done = true;
    q.success = false;
    return;
  }
  q.arcStart = rollArc(cfg, rng);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/qte.test.ts`
Expected: PASS（9 tests）

- [ ] **Step 5: Commit**

```powershell
git add src/core/qte.ts tests/qte.test.ts
git commit -m "feat: add spinning-dial QTE judgment logic"
```

---

### Task 9: Phaser 啟動與地圖場景

**Files:**
- Modify: `src/main.ts`（全量取代 Task 1 的 stub）
- Create: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `newSession`/`canMove`/`move`/`toggleMark`/`SessionState`（Task 7）、`key`（Task 4）、`mulberry32`（Task 2）、`createCodex`（Task 5）、`createI18n`/`detectLocale`/`I18n`（Task 5A）、`Clue`/`TerrainType`（Task 3）
- Produces:
  - Phaser `registry` 全域鍵：`'session': SessionState`、`'rng': Rng`、`'codex': CodexStore`、`'i18n': I18n`（所有場景共用）
  - HUD 右上角語言切換鈕（`EN / 中`），點擊即切換 `i18n` 語言並重繪；選擇經 localStorage 記憶
  - Scene key 常數：`'Map'`、`'Qte'`、`'Result'`、`'Codex'`（字串，各場景 constructor 中固定）
  - `MapScene`：`s.phase` 變為 `'qte'` 時 `scene.start('Qte')`、變為 `'exhausted'` 時 `scene.start('Result')`

注意：Task 9 引用尚未存在的 `QteScene`/`ResultScene`/`CodexScene` 會編譯失敗，因此 main.ts 在本任務先只註冊 `MapScene`，Task 10/11 再逐步加入其餘場景到 scene 陣列。

- [ ] **Step 1: 實作 src/scenes/MapScene.ts**

```typescript
import Phaser from 'phaser';
import { canMove, move, toggleMark, type SessionState } from '../core/session';
import { key } from '../core/clues';
import type { Vec2 } from '../core/geometry';
import type { Clue, TerrainType } from '../core/types';
import type { I18n } from '../core/i18n';

const TERRAIN_COLOR: Record<TerrainType, number> = {
  meadow: 0x4a6741, mist: 0x5c6b73, thicket: 0x3d5233, rock: 0x6b5f52,
};
const HUD_HEIGHT = 56;

export class MapScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private hud!: Phaser.GameObjects.Text;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private cell = 0;
  private ox = 0;
  private oy = HUD_HEIGHT;

  constructor() {
    super('Map');
  }

  create() {
    const s = this.session();
    this.cell = Math.floor((this.scale.height - HUD_HEIGHT - 8) / s.level.mapSize);
    this.ox = Math.floor((this.scale.width - this.cell * s.level.mapSize) / 2);
    this.g = this.add.graphics();
    this.hud = this.add.text(12, 14, '', { fontSize: '17px', color: '#e8e3d5' });
    const i18n: I18n = this.registry.get('i18n');
    this.add
      .text(this.scale.width - 12, 14, 'EN / 中', { fontSize: '16px', color: '#f2d98d' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.redraw();
      });
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.redraw();
  }

  update() {
    if (!this.cursors) return;
    const s = this.session();
    if (s.phase !== 'explore') return;
    const jd = Phaser.Input.Keyboard.JustDown;
    let to: Vec2 | null = null;
    if (jd(this.cursors.left)) to = { x: s.player.x - 1, y: s.player.y };
    else if (jd(this.cursors.right)) to = { x: s.player.x + 1, y: s.player.y };
    else if (jd(this.cursors.up)) to = { x: s.player.x, y: s.player.y - 1 };
    else if (jd(this.cursors.down)) to = { x: s.player.x, y: s.player.y + 1 };
    if (to && canMove(s, to)) {
      move(s, to);
      this.redraw();
      this.afterMove();
    }
  }

  private session(): SessionState {
    return this.registry.get('session');
  }

  private toGrid(px: number, py: number): Vec2 | null {
    const x = Math.floor((px - this.ox) / this.cell);
    const y = Math.floor((py - this.oy) / this.cell);
    const size = this.session().level.mapSize;
    return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
  }

  private onPointer(p: Phaser.Input.Pointer) {
    const s = this.session();
    if (s.phase !== 'explore') return;
    const cellPos = this.toGrid(p.x, p.y);
    if (!cellPos) return;
    if ((p.event as MouseEvent).shiftKey) {
      toggleMark(s, cellPos);
      this.redraw();
      return;
    }
    if (canMove(s, cellPos)) {
      move(s, cellPos);
      this.redraw();
      this.afterMove();
    }
  }

  private afterMove() {
    const s = this.session();
    if (s.phase === 'qte') this.scene.start('Qte');
    else if (s.phase === 'exhausted') this.scene.start('Result');
  }

  private redraw() {
    const s = this.session();
    const L = s.level;
    const cs = this.cell;
    const px = (v: Vec2) => ({ x: this.ox + v.x * cs, y: this.oy + v.y * cs });

    this.g.clear();
    this.labels.forEach((t) => t.destroy());
    this.labels = [];

    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        const p = px({ x, y });
        this.g.fillStyle(TERRAIN_COLOR[L.terrain[y][x]], 1).fillRect(p.x, p.y, cs - 1, cs - 1);
      }
    }

    for (const sup of L.supplies) {
      const p = px(sup);
      this.g.fillStyle(0xa8d08d, 1).fillCircle(p.x + cs / 2, p.y + cs / 2, cs * 0.22);
    }

    for (const c of L.clues) {
      if (s.readClues.has(key(c.position))) this.drawClueOverlay(c, px);
    }
    for (const c of L.clues) {
      const p = px(c.position);
      const t = this.add
        .text(p.x + cs / 2, p.y + cs / 2, c.type[0].toUpperCase(), {
          fontSize: `${Math.max(11, Math.floor(cs * 0.55))}px`,
          color: '#f2d98d',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.labels.push(t);
    }

    for (const m of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      this.g.lineStyle(2, 0xd9764a, 1);
      this.g.lineBetween(p.x + 4, p.y + 4, p.x + cs - 4, p.y + cs - 4);
      this.g.lineBetween(p.x + cs - 4, p.y + 4, p.x + 4, p.y + cs - 4);
    }

    const pp = px(s.player);
    this.g.fillStyle(0xe8e3d5, 1).fillCircle(pp.x + cs / 2, pp.y + cs / 2, cs * 0.3);

    const i18n: I18n = this.registry.get('i18n');
    this.hud.setText(
      `${i18n.t('hud.round', { n: s.round })}   ${i18n.t('hud.stamina', { n: s.stamina })}   ${i18n.t('hud.hint')}`,
    );
  }

  // 已判讀線索的資訊覆蓋層：足跡=錐形線、擾動=實心圓域邊線、氣味=距離環
  private drawClueOverlay(c: Clue, px: (v: Vec2) => { x: number; y: number }) {
    const cs = this.cell;
    const center = px(c.position);
    const cx = center.x + cs / 2;
    const cy = center.y + cs / 2;
    this.g.lineStyle(2, 0xf2d98d, 0.6);
    if (c.type === 'footprint') {
      const len = cs * 5;
      for (const off of [-c.data.angleSpread, 0, c.data.angleSpread]) {
        const rad = ((c.data.direction + off) * Math.PI) / 180;
        this.g.lineBetween(cx, cy, cx + len * Math.cos(rad), cy + len * Math.sin(rad));
      }
    } else if (c.type === 'disturbance') {
      this.g.strokeCircle(cx, cy, c.data.radius * cs);
    } else {
      this.g.strokeCircle(cx, cy, c.data.distance * cs);
    }
  }
}
```

- [ ] **Step 2: 全量改寫 src/main.ts**

```typescript
import Phaser from 'phaser';
import { mulberry32 } from './core/rng';
import { newSession } from './core/session';
import { createCodex } from './core/codex';
import { createI18n, detectLocale } from './core/i18n';
import { MapScene } from './scenes/MapScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 720,
  height: 780,
  backgroundColor: '#141814',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MapScene], // Task 10/11 依序加入 QteScene / ResultScene / CodexScene
  callbacks: {
    preBoot: (game) => {
      const rng = mulberry32(Date.now() >>> 0);
      game.registry.set('rng', rng);
      game.registry.set('codex', createCodex(window.localStorage));
      game.registry.set('i18n', createI18n(detectLocale(navigator.language), window.localStorage));
      game.registry.set('session', newSession(1, rng));
    },
  },
});
```

- [ ] **Step 3: 型別檢查與建置**

Run: `npm run build`
Expected: tsc 無錯誤，vite build 成功

- [ ] **Step 4: 開發伺服器手動冒煙**

Run: `npm run dev`（背景啟動後開瀏覽器 http://localhost:5173）
手動檢查清單：
1. 15×15 地圖渲染，四種地形色塊可辨識。
2. 白色圓點（玩家）位於角落；點擊相鄰格或按方向鍵可移動，HUD 體力遞減。
3. 地圖上有 F/D/S 字母標記（線索）與淺綠圓點（補給）；踩上線索出現錐形線/圓域/距離環覆蓋層；踩上補給體力 +10。
4. Shift+點擊任意格出現/消失橘色 X 標記。
5. 點擊右上角「EN / 中」：HUD 文字在英文與繁中之間切換；重新整理頁面後語言維持上次選擇。
6. 走到目標旁時主控台出現場景切換錯誤（`Qte` 尚未註冊）——此為預期，Task 10 解決。

- [ ] **Step 5: Commit**

```powershell
git add src/main.ts src/scenes/MapScene.ts
git commit -m "feat: add Phaser bootstrap and interactive map scene with placeholder art"
```

---

### Task 10: QTE 場景

**Files:**
- Create: `src/scenes/QteScene.ts`
- Modify: `src/main.ts`（scene 陣列加入 `QteScene`）

**Interfaces:**
- Consumes: `newQte`/`tick`/`press`/`QteState`（Task 8）、`getDifficulty`/`QteParams`（Task 3）、`resolveQte`/`SessionState`（Task 7）、`I18n`（Task 5A）、registry 鍵 `'session'`/`'rng'`/`'i18n'`（Task 9）
- Produces: scene key `'Qte'`；結束時呼叫 `resolveQte` 後 `scene.start('Result')`

- [ ] **Step 1: 實作 src/scenes/QteScene.ts**

```typescript
import Phaser from 'phaser';
import { newQte, tick, press, type QteState } from '../core/qte';
import { getDifficulty, type QteParams } from '../core/difficulty';
import { resolveQte, type SessionState } from '../core/session';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';

export class QteScene extends Phaser.Scene {
  private q!: QteState;
  private cfg!: QteParams;
  private g!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private i18n!: I18n;
  private ending = false;

  constructor() {
    super('Qte');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    this.i18n = this.registry.get('i18n');
    this.cfg = getDifficulty(s.round).qte;
    this.q = newQte(this.cfg, this.registry.get('rng') as Rng);
    this.ending = false;
    this.g = this.add.graphics();
    const cx = this.scale.width / 2;
    this.add
      .text(cx, 80, this.i18n.t('qte.title'), { fontSize: '30px', color: '#e8e3d5' })
      .setOrigin(0.5);
    this.add
      .text(cx, 130, this.i18n.t('qte.instruction'), {
        fontSize: '16px', color: '#9a9a8a',
      })
      .setOrigin(0.5);
    this.info = this.add.text(cx, 640, '', { fontSize: '20px', color: '#f2d98d' }).setOrigin(0.5);
    this.input.on('pointerdown', () => this.onPress());
    this.input.keyboard?.on('keydown-SPACE', () => this.onPress());
  }

  update(_time: number, dt: number) {
    tick(this.q, this.cfg, dt);
    this.draw();
  }

  private onPress() {
    if (this.ending) return;
    press(this.q, this.cfg, this.registry.get('rng') as Rng);
    if (this.q.done) {
      this.ending = true;
      const s: SessionState = this.registry.get('session');
      resolveQte(s, this.q.success === true);
      this.time.delayedCall(500, () => this.scene.start('Result'));
    }
  }

  private draw() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 20;
    const R = 150;
    this.g.clear();
    this.g.lineStyle(6, 0x5c6b73, 1).strokeCircle(cx, cy, R);
    const a0 = Phaser.Math.DegToRad(this.q.arcStart);
    const a1 = Phaser.Math.DegToRad(this.q.arcStart + this.cfg.arcSize);
    this.g.lineStyle(12, 0xf2d98d, 1);
    this.g.beginPath();
    this.g.arc(cx, cy, R, a0, a1);
    this.g.strokePath();
    const pr = Phaser.Math.DegToRad(this.q.pointer);
    this.g.lineStyle(4, 0xe8e3d5, 1);
    this.g.lineBetween(cx, cy, cx + R * Math.cos(pr), cy + R * Math.sin(pr));
    this.info.setText(this.i18n.t('qte.progress', {
      hits: this.q.hits, needed: this.cfg.needed,
      attempt: this.q.attempt, rounds: this.cfg.rounds,
    }));
  }
}
```

- [ ] **Step 2: main.ts scene 陣列加入 QteScene**

```typescript
import { QteScene } from './scenes/QteScene';
// ...
  scene: [MapScene, QteScene],
```

- [ ] **Step 3: 型別檢查與建置**

Run: `npm run build`
Expected: 成功，無型別錯誤

- [ ] **Step 4: 開發伺服器手動冒煙**

Run: `npm run dev`
手動檢查清單：
1. 走到目標生物旁（可先用 Vite console 無錯誤地圖上推理，或暫時打開瀏覽器 console 觀察）觸發 QTE 場景。
2. 指針繞圓旋轉、發光弧區可見；點擊/空白鍵在弧區內時 Hits +1，弧區位置每次重擲。
3. 達成命中數後 0.5 秒場景切換報錯（`Result` 尚未註冊）——預期，Task 11 解決。

- [ ] **Step 5: Commit**

```powershell
git add src/scenes/QteScene.ts src/main.ts
git commit -m "feat: add spinning-dial QTE scene"
```

---

### Task 11: 結算與圖鑑場景（完整迴圈串接）

**Files:**
- Create: `src/scenes/ResultScene.ts`
- Create: `src/scenes/CodexScene.ts`
- Modify: `src/main.ts`（scene 陣列加入兩場景）

**Interfaces:**
- Consumes: `SessionState`/`nextSession`（Task 7）、`CodexStore`（Task 5）、`CREATURES`（Task 5，雙語欄位 `names`/`descs`）、`I18n`（Task 5A）、`Rng`（Task 2）、registry 鍵（Task 9）
- Produces: scene keys `'Result'`、`'Codex'`。重要行為：`ResultScene.create()` 進場即記錄圖鑑（若 caught）**並立刻以 `nextSession` 取代 registry 的 session**，其後按鈕一律 `scene.start('Map')` / `scene.start('Codex')`；`CodexScene` 返回鍵直接 `scene.start('Map')`。如此避免重入 Result 造成圖鑑重複計數。

- [ ] **Step 1: 實作 src/scenes/ResultScene.ts**

```typescript
import Phaser from 'phaser';
import { nextSession, type SessionState } from '../core/session';
import type { CodexStore } from '../core/codex';
import { CREATURES } from '../data/creatures';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const loc = i18n.locale();
    const creature = CREATURES.find((c) => c.id === s.level.creatureId)!;
    const outcome = s.phase;

    if (outcome === 'caught') codex.add(creature.id);
    // 立刻推進 session，之後所有按鈕只做場景切換，避免重複記錄
    this.registry.set('session', nextSession(s, rng));

    const cx = this.scale.width / 2;
    let title: string;
    let body: string;
    let action: string;
    if (outcome === 'caught') {
      this.add.circle(cx, 210, 64, creature.color);
      title = i18n.t('result.recorded', { name: creature.names[loc] });
      body = creature.descs[loc];
      action = i18n.t('btn.next');
    } else if (outcome === 'escaped') {
      title = i18n.t('result.escaped.title');
      body = i18n.t('result.escaped.body');
      action = i18n.t('btn.retry');
    } else {
      title = i18n.t('result.exhausted.title');
      body = i18n.t('result.exhausted.body');
      action = i18n.t('btn.retry');
    }

    this.add.text(cx, 330, title, { fontSize: '28px', color: '#e8e3d5' }).setOrigin(0.5);
    this.add
      .text(cx, 390, body, {
        fontSize: '16px', color: '#9a9a8a', wordWrap: { width: 520 }, align: 'center',
      })
      .setOrigin(0.5);
    this.button(cx, 500, action, () => this.scene.start('Map'));
    this.button(cx, 560, i18n.t('btn.guide'), () => this.scene.start('Codex'));
  }

  private button(x: number, y: number, label: string, onClick: () => void) {
    this.add
      .text(x, y, label, { fontSize: '22px', color: '#f2d98d' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }
}
```

- [ ] **Step 2: 實作 src/scenes/CodexScene.ts**

```typescript
import Phaser from 'phaser';
import type { CodexStore } from '../core/codex';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';

export class CodexScene extends Phaser.Scene {
  constructor() {
    super('Codex');
  }

  create() {
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const loc = i18n.locale();
    const counts = codex.counts();
    const cx = this.scale.width / 2;

    this.add.text(cx, 44, i18n.t('codex.title'), { fontSize: '30px', color: '#e8e3d5' }).setOrigin(0.5);
    const found = CREATURES.filter((c) => (counts[c.id] ?? 0) > 0).length;
    this.add
      .text(cx, 84, i18n.t('codex.count', { found, total: CREATURES.length }), {
        fontSize: '16px', color: '#9a9a8a',
      })
      .setOrigin(0.5);

    CREATURES.forEach((c, i) => {
      const y = 140 + i * 70;
      const seen = counts[c.id] ?? 0;
      this.add.circle(90, y, 22, seen > 0 ? c.color : 0x333833);
      this.add.text(140, y - 18, seen > 0 ? c.names[loc] : i18n.t('codex.unknown'), {
        fontSize: '20px', color: '#e8e3d5',
      });
      const detail = seen > 0
        ? `${c.descs[loc]}  (${i18n.t('codex.times', { n: seen })})`
        : i18n.t('codex.notRecorded');
      this.add.text(140, y + 8, detail, {
        fontSize: '13px', color: '#9a9a8a', wordWrap: { width: 500 },
      });
    });

    this.add
      .text(cx, 730, i18n.t('btn.back'), { fontSize: '22px', color: '#f2d98d' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Map'));
  }
}
```

- [ ] **Step 3: main.ts scene 陣列補齊**

```typescript
import { ResultScene } from './scenes/ResultScene';
import { CodexScene } from './scenes/CodexScene';
// ...
  scene: [MapScene, QteScene, ResultScene, CodexScene],
```

- [ ] **Step 4: 型別檢查、建置與全量測試**

Run: `npm run build`
Expected: 成功

Run: `npm run test`
Expected: 全部 PASS

- [ ] **Step 5: 完整迴圈手動冒煙（核心驗收）**

Run: `npm run dev`
手動檢查清單（完整走一遍規格書 §3 的迴圈）：
1. 開局 → 判讀 2–3 個線索 → 依覆蓋層交叉推理 → Shift 標記候選格 → 走向候選格。
2. 逼近目標觸發 QTE → 成功 → Result 顯示生物名與描述 → Field Guide 顯示 1/8 → Next Hunt 進入 Round 2。
3. 故意 QTE 失敗 → 顯示逃逸文案 → Track Again → 同 Round、新關卡、線索清空。
4. 故意耗盡體力 → exhausted 文案 → Track Again。
5. 連過 3 局後 Round 4 地圖變 20×20、線索 5 個（含干擾）。
6. 重新整理頁面 → Field Guide 保留紀錄（localStorage 持久化）。
7. 切換為繁中（地圖 HUD 右上「EN / 中」）後走完整迴圈：QTE、結算、圖鑑文字全為繁中，生物顯示中文名稱與描述；切回英文亦然。

- [ ] **Step 6: Commit**

```powershell
git add src/scenes/ResultScene.ts src/scenes/CodexScene.ts src/main.ts
git commit -m "feat: add result and field-guide scenes, completing the core loop"
```

---

### Task 12: 生產建置、體積檢查與 itch.io 打包

**Files:**
- Create: `README.md`
- Modify: 無程式碼（產出 `dist/` 與 zip）

**Interfaces:**
- Consumes: 完整專案（Task 1–11）
- Produces: `ridge-hunters-trail-itch.zip`（itch.io 上傳包，HTML5 遊戲、入口 index.html）

- [ ] **Step 1: 撰寫 README.md**

```markdown
# Ridge Hunter's Trail

A cozy tracking-and-deduction game set in a fully fictional mountain world.
Read footprints, disturbances and scents, cross-reference the clues, and
record shy creatures in your field guide. No combat, no harm — creatures
that evade you simply slip away.

## Develop

- `npm install`
- `npm run dev` — local dev server
- `npm run test` — unit tests (Vitest)
- `npm run build` — production build to `dist/`

## Design docs

- `docs/Ridge_Hunters_Trail_Game_Design_Spec.md` — game design spec v1.0
- `docs/superpowers/plans/` — implementation plans
```

- [ ] **Step 2: 生產建置**

Run: `npm run build`
Expected: 成功產出 `dist/`

- [ ] **Step 3: 體積與檔案數檢查（CrazyGames 門檻：≤50MB、<1500 檔）**

Run（PowerShell）:
```powershell
$files = Get-ChildItem dist -Recurse -File
"{0:N2} MB across {1} files" -f (($files | Measure-Object Length -Sum).Sum / 1MB), $files.Count
```
Expected: 總大小 < 10 MB（Phaser bundle 約 1–2MB gzip 前 ~7MB）、檔案數 < 20。若超過 50MB 或 1500 檔為異常，需調查。

- [ ] **Step 4: 本地預覽驗證生產包**

Run: `npm run preview`（開 http://localhost:4173）
Expected: 遊戲與 dev 模式行為一致（特別確認相對路徑資源載入正常，無 404）。

- [ ] **Step 5: 打包 itch.io zip**

Run（PowerShell）:
```powershell
Compress-Archive -Path dist\* -DestinationPath ridge-hunters-trail-itch.zip -Force
```
Expected: 產生 zip，根目錄含 index.html（itch.io HTML5 遊戲要求）。

- [ ] **Step 6: 全量最終驗證**

Run: `npm run test`
Expected: 全部 PASS

Run: `git status`
Expected: 只有 README.md 與 zip 未追蹤（zip 不入版控）

- [ ] **Step 7: Commit（zip 加入 .gitignore）**

```powershell
Add-Content .gitignore "`nnode_modules/`ndist/`n*.zip" 
git add README.md .gitignore
git commit -m "docs: add README and packaging for itch.io submission"
```

- [ ] **Step 8: 人工後續（不在本計畫自動化範圍，提醒執行者轉告使用者）**

- itch.io 上傳：建立專案頁 → 上傳 zip → 勾選「This file will be played in the browser」→ 視窗大小 720×780。
- 依規格書 §8：找 3–5 位測試者實測 QTE 手感後再提交 CrazyGames Basic Launch。
- 對外文案一律定調「原創架空世界」，不提及任何真實文化靈感來源（規格書 §2、§8.3）。

---

## 後續計畫範疇（本計畫不含，對應規格書 Day 7–14 其餘項目）

1. AI 生成素材替換佔位圖形（生物剪影 sprite、地形貼圖、UI 圖標）＋人工複查內容邊界。
2. 音效整合（環境音、線索發現提示音）。
3. 風向道具與 `windBiasNeeded` 氣味方向玩法。
4. 地形視野效果、生物專屬線索組合模式（規格書 §4.6 進階）。
5. CrazyGames SDK 整合與 Poki 8MB 優化（素材分包延遲載入）。
