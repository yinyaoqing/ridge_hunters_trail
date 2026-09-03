# Phase 6a 活的獵物 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓獵物沿一條依物種規則生成的覓食路線移動，並讓線索帶上「錨定在路線哪個節點」的新鮮度，使干擾線索第一次可以被推理排除。

**Architecture:** 反向錨定不拆、只廣義化——錨點從單一 `targetPos` 變成路線節點 `W0…W4`，線索的 `age` 就是它錨定的節點索引，同齡線索的交集因此仍精確包含該齡位置。路線生成與「第 n 步時牠在哪」放進純函式 `src/core/route.ts`，因此可單元測試；場景層只負責呈現。

**Tech Stack:** TypeScript 5.6（strict）、Vite 6、Vitest 3、Phaser 3.90。

## Global Constraints

- 上游規格：`docs/superpowers/specs/2026-09-03-phase6a-living-quarry-design.md`。與規格衝突時以規格為準；若發現規格有錯，**停下來回報**，不要自行改設計。
- **Phaser 場景無法單元測試**（`vite.config.ts` 的 `test.environment` 為 `node`）。場景層把關是 `npx tsc --noEmit` ＋ `npx vite build` ＋人工冒煙。**不要為場景寫測試。**
- 註解一律繁體中文，寫「**為什麼**」。
- **不得改動** `difficulty.ts` 的難度數值、`qte.ts`、`quirks.ts` 的 `applyQuirk`（規格 §4.1 明確保留）。
- 新增字串一律雙語同步；`tests/i18n.test.ts` 已有雙語鍵一致性測試。
- 基準：`npx vitest run` → **408 tests / 33 files**；`npx tsc --noEmit` exit 0；`npx vite build` exit 0。
- **已知環境問題**：`npm run build` 偶發以 `-1073741819` 結束（esbuild 環境問題）。改跑 `npx tsc --noEmit` 與 `npx vite build` 兩段，皆 exit 0 即通過。
- 指令一律用 **PowerShell 工具在前景**執行，一次一個。**不要開背景 Monitor 等待——你不會被喚回。**
- 每個 Task 結束時 commit，訊息結尾加：
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| 檔案 | 職責 |
|---|---|
| `src/core/route.ts`（新增） | 物種移動規則、路線生成、依步數求當前位置。純函式，零 Phaser 依賴 |
| `tests/route.test.ts`（新增） | 釘住路線的性質：長度、可通行、節距、各規則的偏好、決定性 |
| `src/core/types.ts`（修改） | `Clue` 新增 `age`；`Level` 新增 `route` |
| `src/core/generate.ts`（修改） | 先建地形再生路線；線索依齡錨定；逐齡收斂；幌子必須造成矛盾 |
| `src/core/session.ts`（修改） | `currentTarget` / `isTargetVisible`；捕獲判定改用當前位置 |
| `src/core/events.ts`（修改） | 微事件方位改用當前位置 |
| `src/core/deduction.ts`（修改） | `misleadingDecoy` 改為外部傳入目標位置 |
| `tests/solvability.test.ts`（新增） | 跨種子掃描：理想路線必須在體力預算內（規格 §8） |
| `src/core/i18n.ts`（修改） | 新鮮度標籤、HUD chip、揭曉畫面的路線說明 |
| `src/scenes/MapScene.ts`（修改） | 線索依齡濃淡、獵物顯形、新鮮度切換 chip、熱區逐齡 |
| `src/scenes/RevealScene.ts`（修改） | 畫出完整路線與各節點的齡 |
| `src/scenes/ResultScene.ts`（修改） | 押注品質改比對當前位置 |

---

## Task 1: route.ts —— 物種移動規則與路線生成

**Files:**
- Create: `src/core/route.ts`
- Test: `tests/route.test.ts`

**Interfaces:**
- Consumes: `clampToMap`/`pointOnCircle`/`angleDeg`/`angleDiff`/`dist`/`Vec2`（`src/core/geometry.ts`）、`isPassable`（`src/core/terrain.ts`）、`Rng`（`src/core/rng.ts`）、`TerrainType`（`src/core/types.ts`）
- Produces: `RouteRule`、`Route`、`ROUTE_WAYPOINTS = 5`、`ROUTE_START_INDEX = 2`、`MOVE_EVERY = 12`、`routeRuleFor(creatureId): RouteRule`、`buildRoute(rng, terrain, elevation, size, rule): Route`、`targetAt(route, steps): Vec2`、`finalTarget(route): Vec2`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/route.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { buildTerrain, isPassable } from '../src/core/terrain';
import { angleDeg, angleDiff, dist } from '../src/core/geometry';
import {
  buildRoute, targetAt, finalTarget, routeRuleFor,
  ROUTE_WAYPOINTS, ROUTE_START_INDEX, MOVE_EVERY, type RouteRule,
} from '../src/core/route';

const SIZE = 20;

// 以種子造一張真地形，再在上面走一條路線。用真的 buildTerrain 而非人造網格，
// 是因為「沿稜線走」「沿溪谷走」這些規則只有在真實高程場上才有意義。
const routeFor = (seed: number, rule: RouteRule) => {
  const rng = mulberry32(seed);
  const { terrain, elevation } = buildTerrain(rng, SIZE, 0);
  return { route: buildRoute(rng, terrain, elevation, SIZE, rule), terrain, elevation };
};

const RULES: RouteRule[] = ['lowland', 'highland', 'cover', 'straight', 'doubling'];

describe('buildRoute: 結構', () => {
  it('每條規則都生出固定長度的路線', () => {
    for (const rule of RULES) {
      expect(routeFor(1, rule).route.waypoints).toHaveLength(ROUTE_WAYPOINTS);
    }
  });

  it('所有節點都在圖內且可通行', () => {
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route, terrain } = routeFor(seed, rule);
        for (const w of route.waypoints) {
          expect(w.x).toBeGreaterThanOrEqual(0);
          expect(w.y).toBeGreaterThanOrEqual(0);
          expect(w.x).toBeLessThan(SIZE);
          expect(w.y).toBeLessThan(SIZE);
          expect(isPassable(terrain[w.y][w.x])).toBe(true);
        }
      }
    }
  });

  it('相鄰節點永遠不同格', () => {
    // 節點重複代表獵物「原地不動一個週期」，玩家會看到牠停下又走，
    // 而外推方向的推理會落空。生成階段就不該產出這種路線。
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route } = routeFor(seed, rule);
        for (let i = 1; i < route.waypoints.length; i++) {
          expect(route.waypoints[i]).not.toEqual(route.waypoints[i - 1]);
        }
      }
    }
  });

  it('節距不超過該規則的上限', () => {
    // 只驗上限：靠近地圖邊緣時 clampToMap 會把候選點拉近，下限因此無法保證
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route } = routeFor(seed, rule);
        for (let i = 1; i < route.waypoints.length; i++) {
          expect(dist(route.waypoints[i - 1], route.waypoints[i])).toBeLessThanOrEqual(7.5);
        }
      }
    }
  });

  it('route 帶著自己的規則，供揭曉畫面說明物種走法', () => {
    expect(routeFor(1, 'doubling').route.rule).toBe('doubling');
  });
});

describe('buildRoute: 每條規則真的表現出它宣稱的偏好', () => {
  const meanElevation = (rule: RouteRule): number => {
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { route, elevation } = routeFor(seed, rule);
      for (const w of route.waypoints) { sum += elevation[w.y][w.x]; n++; }
    }
    return sum / n;
  };

  it('沿溪谷走的平均高程顯著低於沿稜線走', () => {
    // 這是「物種個性可觀察」的實測：兩條規則若走出一樣的地形，玩家就學不到東西
    expect(meanElevation('lowland')).toBeLessThan(meanElevation('highland') - 0.1);
  });

  it('貼著掩蔽走的路線經過的密叢比直行多', () => {
    const thicketShare = (rule: RouteRule): number => {
      let hit = 0;
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { route, terrain } = routeFor(seed, rule);
        for (const w of route.waypoints) { if (terrain[w.y][w.x] === 'thicket') hit++; n++; }
      }
      return hit / n;
    };
    expect(thicketShare('cover')).toBeGreaterThan(thicketShare('straight'));
  });

  const meanLateTurn = (rule: RouteRule): number => {
    // 後半段（W2→W3、W3→W4）相對於前一段的平均轉角
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { route } = routeFor(seed, rule);
      const w = route.waypoints;
      for (let i = 3; i < w.length; i++) {
        sum += angleDiff(angleDeg(w[i - 1], w[i]), angleDeg(w[i - 2], w[i - 1]));
        n++;
      }
    }
    return sum / n;
  };

  it('直行的後段轉角很小，折返的後段轉角很大', () => {
    // 這一條是 doubling 存在的理由：玩家不能對牠直線外推
    expect(meanLateTurn('straight')).toBeLessThan(45);
    expect(meanLateTurn('doubling')).toBeGreaterThan(90);
  });
});

describe('targetAt', () => {
  const route = routeFor(7, 'straight').route;

  it('開局站在 W2', () => {
    expect(targetAt(route, 0)).toEqual(route.waypoints[ROUTE_START_INDEX]);
  });

  it('不滿一個週期不前進', () => {
    expect(targetAt(route, MOVE_EVERY - 1)).toEqual(route.waypoints[ROUTE_START_INDEX]);
  });

  it('每滿一個週期前進一個節點', () => {
    expect(targetAt(route, MOVE_EVERY)).toEqual(route.waypoints[ROUTE_START_INDEX + 1]);
    expect(targetAt(route, MOVE_EVERY * 2)).toEqual(route.waypoints[ROUTE_START_INDEX + 2]);
  });

  it('走到覓食地就停住，再多步也不會出界', () => {
    expect(targetAt(route, MOVE_EVERY * 3)).toEqual(finalTarget(route));
    expect(targetAt(route, 100000)).toEqual(finalTarget(route));
  });
});

describe('routeRuleFor', () => {
  it('八隻生物各有規則，且五條規則都有生物在用', () => {
    const ids = ['mistfawn', 'emberquill', 'thicketloom', 'dewhopper',
      'veilmoth', 'lanternshrew', 'ridgecrest', 'plumetail'];
    const used = new Set(ids.map(routeRuleFor));
    expect(used).toEqual(new Set(RULES));
  });

  it('未知生物落回直行而不是崩潰', () => {
    expect(routeRuleFor('no-such-creature')).toBe('straight');
  });
});

describe('決定性', () => {
  it('同一顆種子永遠得到同一條路線', () => {
    for (const rule of RULES) {
      expect(routeFor(12, rule).route).toEqual(routeFor(12, rule).route);
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/route.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/route"`

- [ ] **Step 3: 實作**

Create `src/core/route.ts`:

```ts
import { clampToMap, pointOnCircle, angleDeg, angleDiff, type Vec2 } from './geometry';
import type { Rng } from './rng';
import { isPassable } from './terrain';
import type { TerrainType } from './types';

// 物種的移動規則。這是 Phase 6a 把「個性」從隱形的生成參數乘法，換成
// 可觀察、可學習、可預測的行為——玩家玩過兩次就會知道「紗霧蛾會折返，別直線外推」。
export type RouteRule = 'lowland' | 'highland' | 'cover' | 'straight' | 'doubling';

export const ROUTE_WAYPOINTS = 5;   // W0..W4
export const ROUTE_START_INDEX = 2; // 開局時獵物站在 W2：W0/W1/W2 是過去（線索留在那裡），W3/W4 是未來
export const MOVE_EVERY = 12;       // 每 12 步前進一個節點

// 節距（格）。直行的走得遠，貼著掩蔽的走得短——節距本身也是個性的一部分。
const SPACING: Record<RouteRule, number> = {
  lowland: 4, highland: 4, cover: 3, straight: 5, doubling: 4,
};

const RULE_BY_CREATURE: Record<string, RouteRule> = {
  mistfawn: 'lowland',
  emberquill: 'highland',
  thicketloom: 'cover',
  dewhopper: 'straight',
  veilmoth: 'doubling',
  lanternshrew: 'cover',
  ridgecrest: 'highland',
  plumetail: 'straight',
};

export function routeRuleFor(creatureId: string): RouteRule {
  return RULE_BY_CREATURE[creatureId] ?? 'straight';
}

export interface Route {
  waypoints: Vec2[]; // 長度恆為 ROUTE_WAYPOINTS
  rule: RouteRule;   // 揭曉畫面用它說明這個物種怎麼走
}

// 獵物在第 steps 步時的位置。抵達最後一個節點（覓食地）後就停住——
// 有終點才有「牠最後會在哪」這個可被外推的答案，押注因此是預測而非描述。
export function targetAt(route: Route, steps: number): Vec2 {
  const i = Math.min(
    ROUTE_START_INDEX + Math.floor(steps / MOVE_EVERY),
    route.waypoints.length - 1,
  );
  return route.waypoints[i];
}

export function finalTarget(route: Route): Vec2 {
  return route.waypoints[route.waypoints.length - 1];
}

// 候選方位數：在節距半徑上取 16 個等分角。刻意不消耗 rng——
// 路線的隨機性全部來自起點，之後每一步都是規則的確定性結果，
// 玩家因此學得會「這個物種怎麼走」。若每一步都再擲一次骰，個性就退化成雜訊。
const CANDIDATE_ANGLES = 16;

export function buildRoute(
  rng: Rng, terrain: TerrainType[][], elevation: number[][], size: number, rule: RouteRule,
): Route {
  const waypoints: Vec2[] = [randomPassable(rng, terrain, size)];
  for (let i = 1; i < ROUTE_WAYPOINTS; i++) {
    waypoints.push(nextWaypoint(waypoints, SPACING[rule], rule, terrain, elevation, size));
  }
  return { waypoints, rule };
}

function randomPassable(rng: Rng, terrain: TerrainType[][], size: number): Vec2 {
  for (let i = 0; i < 60; i++) {
    const p = { x: Math.floor(rng() * size), y: Math.floor(rng() * size) };
    if (isPassable(terrain[p.y][p.x])) return p;
  }
  // 保底：整張圖幾乎全是崖壁時掃出第一個可通行格。純掃描、不再消耗 rng，
  // 因此不影響同一顆種子的決定性。
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (isPassable(terrain[y][x])) return { x, y };
  }
  return { x: 0, y: 0 };
}

// 下一個節點：在節距半徑上取等分方位為候選，夾進圖內、剔除崖壁與已用過的節點，
// 再依規則評分取最佳者。平手取索引最小者以維持決定性。
function nextWaypoint(
  sofar: Vec2[], spacing: number, rule: RouteRule,
  terrain: TerrainType[][], elevation: number[][], size: number,
): Vec2 {
  const from = sofar[sofar.length - 1];
  const prev = sofar.length >= 2 ? sofar[sofar.length - 2] : null;
  const heading = prev ? angleDeg(prev, from) : null;
  const used = new Set(sofar.map((w) => `${w.x},${w.y}`));

  const candidates: Vec2[] = [];
  for (let i = 0; i < CANDIDATE_ANGLES; i++) {
    const p = clampToMap(pointOnCircle(from, spacing, (360 / CANDIDATE_ANGLES) * i), size);
    if (!isPassable(terrain[p.y][p.x])) continue;
    if (used.has(`${p.x},${p.y}`)) continue;
    candidates.push(p);
  }
  if (candidates.length === 0) return nearestUnusedPassable(from, used, terrain, size);

  // 續行傾向：同分時偏好維持原方向。除了讓路線好看，也避免評分平手時
  // 永遠選到 0 度（正東）那個候選，讓路線退化成一律往右。
  const straightness = (p: Vec2): number =>
    heading === null ? 0 : -angleDiff(angleDeg(from, p), heading);

  const score = (p: Vec2): number => {
    switch (rule) {
      case 'lowland': return -elevation[p.y][p.x] + straightness(p) / 1000;
      case 'highland': return elevation[p.y][p.x] + straightness(p) / 1000;
      case 'cover': return (terrain[p.y][p.x] === 'thicket' ? 1 : 0) + straightness(p) / 1000;
      case 'straight': return straightness(p);
      // 折返：前兩段照直行走出去，後兩段反過來——轉角越大越好
      case 'doubling': return sofar.length <= 2 ? straightness(p) : -straightness(p);
    }
  };

  let best = candidates[0];
  let bestScore = score(best);
  for (const p of candidates.slice(1)) {
    const sc = score(p);
    if (sc > bestScore) { best = p; bestScore = sc; }
  }
  return best;
}

// 候選全被崖壁或重複擋掉時的保底：由近而遠掃出第一個可通行且未用過的格。
// 回傳「不同的格」很重要——相鄰節點相同會讓獵物原地停一個週期，
// 而玩家對方向的外推會落空。
function nearestUnusedPassable(
  from: Vec2, used: Set<string>, terrain: TerrainType[][], size: number,
): Vec2 {
  for (let r = 1; r < size; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: from.x + dx, y: from.y + dy };
        if (p.x < 0 || p.y < 0 || p.x >= size || p.y >= size) continue;
        if (used.has(`${p.x},${p.y}`)) continue;
        if (isPassable(terrain[p.y][p.x])) return p;
      }
    }
  }
  return from; // 全圖無處可去（實務上不可能，reach.ts 的挖通保證有通路）
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/route.test.ts`
Expected: PASS

若「沿溪谷／沿稜線」或「折返轉角」的測試沒過，**不要改測試的門檻來遷就實作**——
那兩條測的正是這一階存在的理由。回頭檢查評分函式的正負號與 `straightness` 的權重。

- [ ] **Step 5: 全套測試與型別檢查**

Run: `npx vitest run` → 408 + 新增數量
Run: `npx tsc --noEmit` → exit 0

- [ ] **Step 6: Commit**

```bash
git add src/core/route.ts tests/route.test.ts
git commit -m "feat: add foraging routes and per-species movement rules

Species personality stops being an invisible multiplier on generation
parameters and becomes something a player can watch, learn and predict. The
route's randomness lives entirely in its starting point; every step after that
is the rule playing out, which is what makes it learnable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 線索新鮮度與逐齡錨定

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/generate.ts`
- Test: `tests/generate.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Route`／`buildRoute`／`routeRuleFor`／`ROUTE_START_INDEX`／`finalTarget`
- Produces: `ClueAge = 0 | 1 | 2`；`Clue` 新增 `age: ClueAge`；`Level` 新增 `route: Route`；`PER_AGE_MAX_INTERSECTION`（自 `generate.ts` 匯出，供測試使用）

> **本任務刻意保留 `Level.targetPos`**，定義為 `route.waypoints[ROUTE_START_INDEX]`，
> 讓既有的十個消費端與五個測試檔在本任務結束時仍能編譯通過。Task 3 才把它移除。
> 這不是相容別名，是為了讓每個 Task 都能獨立驗證而存在的鷹架——Task 3 一定要拆掉。

- [ ] **Step 1: 擴充型別**

在 `src/core/types.ts`：加入 import 與型別。

```ts
// 檔案最上方加入：
import type { Route } from './route';

// 在 Clue 聯集之前加入：
// 線索的新鮮度＝它錨定在覓食路線的哪一個節點。0 最舊、2 最新（獵物開局所在）。
// 同齡線索的交集必定包含該齡位置——舊的「所有線索交集包含目標」是這條的特例。
export type ClueAge = 0 | 1 | 2;
```

把 `Clue` 聯集的三個成員各加上 `age: ClueAge`：

```ts
export type Clue =
  | { type: 'footprint'; position: Vec2; isDecoy: boolean; age: ClueAge; data: FootprintData }
  | { type: 'disturbance'; position: Vec2; isDecoy: boolean; age: ClueAge; data: DisturbanceData }
  | { type: 'scent'; position: Vec2; isDecoy: boolean; age: ClueAge; data: ScentData };
```

在 `Level` 介面中，把

```ts
  targetPos: Vec2;
```

換成

```ts
  route: Route;             // 覓食路線；獵物依步數沿它移動（見 core/route.ts）
  // 鷹架：Task 3 移除。等於 route.waypoints[ROUTE_START_INDEX]，
  // 存在的唯一理由是讓 Task 2 結束時既有消費端仍能編譯。
  targetPos: Vec2;
```

- [ ] **Step 2: 寫失敗的測試**

在 `tests/generate.test.ts` 檔尾追加（並把最上方的 import 補上所需符號）：

```ts
// 追加 import：
// import { intersect, key } from '../src/core/clues';
// import { generateLevelFor, PER_AGE_MAX_INTERSECTION } from '../src/core/generate';
// import { ROUTE_WAYPOINTS, ROUTE_START_INDEX } from '../src/core/route';
// import { mulberry32 } from '../src/core/rng';
// import type { ClueAge } from '../src/core/types';

const AGES: ClueAge[] = [0, 1, 2];

describe('generateLevelFor: 線索新鮮度', () => {
  const levels = () => {
    const out = [];
    for (let seed = 1; seed <= 60; seed++) {
      out.push(generateLevelFor(9, mulberry32(seed), 'plumetail'));
    }
    return out;
  };

  it('每一局的路線長度固定，且獵物開局站在 W2', () => {
    for (const L of levels()) {
      expect(L.route.waypoints).toHaveLength(ROUTE_WAYPOINTS);
      expect(L.targetPos).toEqual(L.route.waypoints[ROUTE_START_INDEX]);
    }
  });

  it('每一個齡都至少有一條真線索', () => {
    // 分組推理的前提：某一齡若一條真線索都沒有，那一組就無從比對，
    // 幌子藏在裡面也看不出來。
    for (const L of levels()) {
      for (const age of AGES) {
        expect(L.clues.filter((c) => !c.isDecoy && c.age === age).length).toBeGreaterThan(0);
      }
    }
  });

  it('同齡真線索的交集非空、包含該齡節點，且不超過每齡上限', () => {
    // 這是廣義化後的可解性保證。舊版是「所有線索的交集包含目標」，
    // 現在是「每一齡的交集包含該齡的位置」。
    for (const L of levels()) {
      for (const age of AGES) {
        const group = L.clues.filter((c) => !c.isDecoy && c.age === age);
        const cells = intersect(group, L.mapSize);
        expect(cells.size).toBeGreaterThan(0);
        expect(cells.has(key(L.route.waypoints[age]))).toBe(true);
        expect(cells.size).toBeLessThanOrEqual(PER_AGE_MAX_INTERSECTION);
      }
    }
  });

  it('幌子一定造成矛盾：它所在的齡，含它的交集為空；靜音它就恢復', () => {
    // 這是「干擾第一次可以被推理排除」的實際機制。若幌子沒有讓那一組矛盾，
    // 玩家就只能回到數量投票，而 Phase 4 的靜音功能仍然沒有明確用途。
    let checked = 0;
    for (const L of levels()) {
      for (const decoy of L.clues.filter((c) => c.isDecoy)) {
        const group = L.clues.filter((c) => c.age === decoy.age && !c.isDecoy);
        expect(intersect([...group, decoy], L.mapSize).size).toBe(0);
        expect(intersect(group, L.mapSize).size).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // 這個難度確實有幌子，測試不是空轉
  });

  it('放不出矛盾的幌子寧可不放，也不放一個沒有作用的', () => {
    // 上一條是硬性不變量，代價是有時候幌子數會少於難度設定。這條把代價量出來，
    // 讓它是一個已知的數字而不是一個驚喜。
    let want = 0;
    let got = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const L = generateLevelFor(9, mulberry32(seed), 'plumetail');
      want += 2; // round 9 的 decoyCount
      got += L.clues.filter((c) => c.isDecoy).length;
    }
    expect(got / want).toBeGreaterThan(0.8);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run tests/generate.test.ts`
Expected: FAIL — `PER_AGE_MAX_INTERSECTION` 不存在、`L.route` 為 undefined

- [ ] **Step 4: 改寫 generate.ts**

`makeClue` 加上 `age` 參數。把它的簽章與三個 return 改成：

```ts
function makeClue(
  type: ClueType, anchor: Vec2, p: DifficultyParams, rng: Rng, size: number,
  isDecoy: boolean, age: ClueAge,
): Clue {
```

三個 `return { type, position: pos, isDecoy, data: ... }` 各補上 `age`，例如足跡那一支變成：

```ts
      return { type, position: pos, isDecoy, age, data: { direction: angleDeg(pos, anchor), angleSpread: p.footprintSpread } };
```

在檔案最上方加入 import：

```ts
import { buildRoute, routeRuleFor, finalTarget, ROUTE_START_INDEX, type Route } from './route';
import type { Clue, ClueAge, ClueType, Level } from './types';
```

（原本的 `import type { Clue, ClueType, Level } from './types';` 併入上面那一行。）

在 `IRIS_RATE` 旁加入：

```ts
// 每一齡交集的上限。刻意與 difficulty 的 maxIntersection 脫鉤：分齡之後每一齡的
// 線索數只有全部的三分之一，沿用同一個門檻會逼生成器狂加線索，圖上到處是 token
// 反而更難讀。這個值由 tests/solvability.test.ts 的實測校準。
export const PER_AGE_MAX_INTERSECTION = 10;

// 真線索的齡分佈：先保證每一齡各一條，其餘偏向較新的齡——新鮮的痕跡本來就比較多，
// 而且讓玩家最常拿到的是最接近獵物現在位置的資訊。
const AGE_WEIGHTS: [ClueAge, number][] = [[0, 1], [1, 2], [2, 3]];
```

在 `generateLevelFor` 中，把從 `const targetPos = randomPos(rng, size);` 到幌子迴圈結束、
再到 `const { terrain, elevation } = buildTerrain(...)` 這一整段**重新排序並改寫**為下面的內容。
關鍵是地形必須先建好，路線才有地方可走：

```ts
  // 地形先建：路線要沿著稜線／溪谷／掩蔽走，沒有地形就無從決定往哪走。
  // 這也改變了 rng 的取用順序——本階段的關卡本來就與舊版不同，無需相容。
  const { terrain, elevation } = buildTerrain(rng, size, elevationBiasFor(creatureId));
  const route = buildRoute(rng, terrain, elevation, size, routeRuleFor(creatureId));
  const targetPos = route.waypoints[ROUTE_START_INDEX];

  const ratio: [ClueType, number][] = [
    ['footprint', p2.typeRatio.footprint],
    ['disturbance', p2.typeRatio.disturbance],
    ['scent', p2.typeRatio.scent],
  ];

  // 真線索：前三條各佔一齡（保證每一齡都有東西可比對），其餘依權重偏向較新的齡
  const clues: Clue[] = [];
  for (let i = 0; i < p2.clueCount; i++) {
    const age: ClueAge = i < 3 ? (i as ClueAge) : pickWeighted(rng, AGE_WEIGHTS);
    clues.push(makeClue(pickWeighted(rng, ratio), route.waypoints[age], p2, rng, size, false, age));
  }

  // 逐齡收斂（規格 §5.2）：全部線索的交集現在本來就是空的，舊的整體檢查已失去意義。
  // 改為每一齡各自收斂——環形的 scent 收斂最快，故追加時固定用它。
  for (const age of [0, 1, 2] as ClueAge[]) {
    for (let extra = 0; extra < 3; extra++) {
      const group = clues.filter((c) => !c.isDecoy && c.age === age);
      if (intersect(group, size).size <= PER_AGE_MAX_INTERSECTION) break;
      clues.push(makeClue('scent', route.waypoints[age], p2, rng, size, false, age));
    }
  }

  // 幌子（規格 §5.1）：指派到一個已經有真線索的齡，並且**必須真的讓那一齡的交集變空**。
  // 造不出矛盾的幌子等於沒有作用——玩家只會退回數量投票，而分齡推理這條路就白開了。
  // 有限次重抽後仍造不出矛盾時寧可不放：少一個幌子是安全的，放一個無效的不是。
  if (p2.decoyCount > 0) {
    const uniform: [ClueType, number][] = [['footprint', 1], ['disturbance', 1], ['scent', 1]];
    for (let i = 0; i < p2.decoyCount; i++) {
      const age = pickWeighted(rng, AGE_WEIGHTS);
      const group = clues.filter((c) => !c.isDecoy && c.age === age);
      for (let attempt = 0; attempt < 12; attempt++) {
        const decoyPos = randomPosFarFrom(rng, size, route.waypoints[age], 5);
        const d = makeClue(pickWeighted(rng, uniform), decoyPos, p2, rng, size, true, age);
        if (intersect([...group, d], size).size === 0) { clues.push(d); break; }
      }
    }
  }
```

接著把後續段落中所有以 `targetPos` 為準的地方改成以路線為準：

- 目標格地形強制那一段的兩行，把 `targetPos` 換成 `finalTarget(route)`，並在其上補註解：

```ts
  // 強制覓食地（路線終點）為該生物的偏好地形——牠最後停在哪，那裡就該是牠的地盤。
  // 這也順帶保證終點永遠不是崖壁。
  const forage = finalTarget(route);
  terrain[forage.y][forage.x] = creature.terrain;
  elevation[forage.y][forage.x] = elevationFor(creature.terrain);
```

- `const taken = new Set([key(targetPos), ...])` 改為 `const taken = new Set([...route.waypoints.map(key), ...clues.map((c) => key(c.position))]);`
- `const start = startCorner(size, targetPos);` 改為 `const start = startCorner(size, targetPos);`（不變——起始角仍以獵物開局位置的對角決定）
- `ensureReachable(terrain, start, [targetPos, ...])` 改為
  `ensureReachable(terrain, start, [...route.waypoints, ...clues.map((c) => c.position), ...supplies]);`
  並補註解：「路線上的每一個節點都要走得到——獵物會停在其中任何一個，玩家就得能追到那裡。」

最後把 return 物件的 `targetPos` 一行改為兩行：

```ts
    round, mapSize: size, route, targetPos, clues, terrain, elevation, supplies,
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run tests/generate.test.ts`
Expected: PASS

若「每齡交集不超過上限」大量失敗，代表 `PER_AGE_MAX_INTERSECTION = 10` 太緊。
**不要直接放寬到測試會過為止**——先把實際的交集大小分佈印出來，依數據選值，
並把你選的理由寫進報告。這個常數 Task 4 還會再校準一次。

- [ ] **Step 6: 全套測試與型別檢查**

Run: `npx vitest run`
Run: `npx tsc --noEmit` → exit 0

其他測試檔若因 `Clue` 多了必填的 `age` 而編譯失敗，補上 `age: 2`（最新齡）即可，
除非該測試本來就在測分齡行為。

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/generate.ts tests/generate.test.ts
git commit -m "feat: anchor clues to route waypoints and give them an age

The reverse-anchoring that guarantees solvability is generalised rather than
removed: a clue anchors to the waypoint it was left at, and same-age clues
still intersect exactly on that waypoint. The old guarantee is now the
single-age special case.

Decoys are placed on an age that already has real clues and must actually
empty that age's intersection — a decoy that leaves the group consistent
teaches nothing, so it is dropped rather than placed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 移除 targetPos，改用當前位置

**Files:**
- Modify: `src/core/types.ts`（移除鷹架欄位）
- Modify: `src/core/session.ts`
- Modify: `src/core/events.ts`
- Modify: `src/core/deduction.ts`
- Modify: `src/core/generate.ts`（移除 return 的 `targetPos`）
- Modify: `src/scenes/MapScene.ts`、`src/scenes/RevealScene.ts`、`src/scenes/ResultScene.ts`
- Test: `tests/session.test.ts`、`tests/daily.test.ts`、`tests/deduction.test.ts`、`tests/events.test.ts`

**Interfaces:**
- Consumes: `targetAt`（Task 1）、`Level.route`（Task 2）
- Produces: `currentTarget(s: SessionState): Vec2`、`isTargetVisible(s: SessionState): boolean`（皆自 `src/core/session.ts`）；`misleadingDecoy(level, readLog, wager, target)` 的第四個參數

- [ ] **Step 1: 寫失敗的測試**

在 `tests/session.test.ts` 檔尾追加：

```ts
describe('currentTarget: 獵物會沿路線移動', () => {
  it('開局時就是路線的起始節點', () => {
    const s = newSession(1, mulberry32(3));
    expect(currentTarget(s)).toEqual(s.level.route.waypoints[ROUTE_START_INDEX]);
  });

  it('步數累積到一個週期就換節點', () => {
    const s = newSession(1, mulberry32(3));
    const before = currentTarget(s);
    s.steps = MOVE_EVERY;
    const after = currentTarget(s);
    expect(after).toEqual(s.level.route.waypoints[ROUTE_START_INDEX + 1]);
    expect(after).not.toEqual(before);
  });

  it('走到覓食地就停住', () => {
    const s = newSession(1, mulberry32(3));
    s.steps = MOVE_EVERY * 50;
    expect(currentTarget(s)).toEqual(finalTarget(s.level.route));
  });
});

describe('isTargetVisible', () => {
  it('站在獵物身上一定看得見', () => {
    const s = newSession(1, mulberry32(5));
    s.player = { ...currentTarget(s) };
    expect(isTargetVisible(s)).toBe(true);
  });

  it('隔著整張地圖看不見', () => {
    const s = newSession(1, mulberry32(5));
    const t = currentTarget(s);
    s.player = { x: t.x >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1, y: t.y >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1 };
    expect(isTargetVisible(s)).toBe(false);
  });

  it('看得見與否只看當前位置，不受 seen 影響', () => {
    // seen 是單向累積的「看過的地」，而獵物會離開。用 seen 判斷會讓牠走掉之後
    // 還畫在原地——玩家會追一個已經不在那裡的影子。
    const s = newSession(1, mulberry32(5));
    const t = currentTarget(s);
    s.seen.add(key(t));
    s.player = { x: t.x >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1, y: t.y >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1 };
    expect(isTargetVisible(s)).toBe(false);
  });
});
```

檔案最上方的 import 補上 `currentTarget`、`isTargetVisible`（自 `../src/core/session`）、
`MOVE_EVERY`、`ROUTE_START_INDEX`、`finalTarget`（自 `../src/core/route`）、`key`（自 `../src/core/clues`）。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL — `currentTarget is not a function`

- [ ] **Step 3: 在 session.ts 加入兩個查詢**

`src/core/session.ts` 最上方 import 加入：

```ts
import { targetAt, ROUTE_START_INDEX } from './route';
```

在 `revealAround` 之前加入：

```ts
// 獵物「現在」在哪。整個專案唯一的來源——Phase 6a 之後「牠在哪」不再是常數，
// 任何直接讀路線節點的地方都會在獵物移動後說謊。
export function currentTarget(s: SessionState): Vec2 {
  return targetAt(s.level.route, s.steps);
}

// 獵物是否落在玩家「當前」的視野半徑內。
// 刻意不用 s.seen：那是單向累積的「看過的地」，而獵物會離開——
// 用 seen 判斷會讓牠走掉之後仍畫在原地，玩家會追一個已經不在那裡的影子。
export function isTargetVisible(s: SessionState): boolean {
  const { terrain, elevation } = groundUnderPlayer(s);
  return cheb(s.player, currentTarget(s)) <= visionRadius(terrain, elevation);
}
```

把 `newSession` 中的 `const player = startCorner(level.mapSize, level.targetPos);` 改成

```ts
  const player = startCorner(level.mapSize, level.route.waypoints[ROUTE_START_INDEX]);
```

把 `move()` 中的捕獲判定

```ts
  if (cheb(to, s.level.targetPos) <= 1) {
```

改成

```ts
  // steps 已於本函式開頭遞增，因此這裡取到的是「這一步之後」獵物的位置——
  // 牠可能剛好在這一步換了節點而落到玩家旁邊，那也算逼近成功。
  if (cheb(to, currentTarget(s)) <= 1) {
```

- [ ] **Step 4: 掃除其餘 targetPos**

`src/core/events.ts`：最上方加入 `import { targetAt } from './route';`。
`isOccupiedCell` 加第三個參數並改用它：

```ts
function isOccupiedCell(level: Level, p: Vec2, target: Vec2): boolean {
  const k = key(p);
  if (key(target) === k) return true;
```

`findNearbyEmptyCell(s)` 內呼叫處改為 `isOccupiedCell(level, p, targetAt(level.route, s.steps))`。
`rollMicroEvent` 中三處 `s.level.targetPos` 改為一個區域常數：在 `if (s.mode !== 'run') return null;` 之後加入

```ts
  const target = targetAt(s.level.route, s.steps);
```

並把 `cheb(s.player, s.level.targetPos)` 改為 `cheb(s.player, target)`、
兩處 `angleDeg(s.player, s.level.targetPos)` 改為 `angleDeg(s.player, target)`。

`src/core/deduction.ts`：`misleadingDecoy` 改為由呼叫端傳入目標位置。簽章與前兩行改成：

```ts
// target 由呼叫端傳入而非從 level 取：Phase 6a 之後獵物會移動，
// 「真實位置」只有在結算那一刻才確定，deduction 不該自己猜是哪一刻。
export function misleadingDecoy(
  level: Level, readLog: ClueRead[], wager: Vec2 | null, target: Vec2,
): Clue | null {
  if (!wager) return null;
  if (cheb(wager, target) === 0) return null; // 押中了，沒有東西騙到你
  const wk = key(wager);
  const tk = key(target);
```

`src/core/types.ts`：移除 `Level` 中的鷹架欄位 `targetPos` 與其註解。
`src/core/generate.ts`：移除 return 物件中的 `targetPos`，並移除已無用的區域變數
`const targetPos = route.waypoints[ROUTE_START_INDEX];`（`startCorner` 改用
`route.waypoints[ROUTE_START_INDEX]`）。

三個場景：
- `src/scenes/MapScene.ts` 的 `cheb(s.player, s.level.targetPos) <= 2` → `cheb(s.player, currentTarget(s)) <= 2`，import 補 `currentTarget`。
- `src/scenes/RevealScene.ts` 的 `cheb(wager, s.level.targetPos)` 與 `px(L.targetPos)` → `currentTarget(s)`（先在 `create()` 取一次存成區域常數再用），import 補 `currentTarget`；`misleadingDecoy(...)` 的呼叫補上第四個參數。
- `src/scenes/ResultScene.ts` 的 `qualityFromAccuracy(wager, s.level.targetPos)` → `qualityFromAccuracy(wager, currentTarget(s))`，import 補 `currentTarget`。

四個測試檔：把 `level.targetPos` 改為 `level.route.waypoints[ROUTE_START_INDEX]`，
或改用 `currentTarget(session)`——依該測試原本在測什麼選擇。
`tests/deduction.test.ts` 的 `misleadingDecoy` 呼叫補上第四個參數。

- [ ] **Step 5: 確認掃乾淨**

Run: `npx tsc --noEmit` → exit 0
Run（Grep 工具）：在 `src/` 與 `tests/` 搜尋 `targetPos`，預期**零命中**。有命中就是漏掉。

- [ ] **Step 6: 全套測試與建置**

Run: `npx vitest run` → 全綠
Run: `npx vite build` → exit 0

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace targetPos with the quarry's current position

Where it is stopped being a constant, so a field holding one could only ever
be right at step zero. Everything now reads currentTarget(), and visibility
deliberately ignores the seen set — that set only grows, while the quarry
leaves, so drawing from it would show a shadow of something already gone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 可解性掃描與常數校準

**Files:**
- Create: `tests/solvability.test.ts`
- Modify（僅在數據要求時）: `src/core/route.ts` 的 `MOVE_EVERY`／`SPACING`、`src/core/generate.ts` 的 `PER_AGE_MAX_INTERSECTION`

**Interfaces:**
- Consumes: Task 1–3 的全部輸出、`routeCostsFrom`（`src/core/path.ts`）、`getDifficulty`（`src/core/difficulty.ts`）
- Produces: 無新介面

> 規格 §8：**節距、`MOVE_EVERY`、剩餘節點數直接決定這遊戲還能不能贏。**
> 先例是 `ridgecrest` 的 `elevationBias`——0.15 讓 11% 的首局在數學上走不完，
> 而型別檢查與既有測試全綠。這類問題只有量測抓得到。

- [ ] **Step 1: 寫掃描測試**

Create `tests/solvability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { generateLevelFor } from '../src/core/generate';
import { getDifficulty } from '../src/core/difficulty';
import { routeCostsFrom } from '../src/core/path';
import { startCorner } from '../src/core/terrain';
import { key } from '../src/core/clues';
import { targetAt, MOVE_EVERY, ROUTE_START_INDEX } from '../src/core/route';
import { CREATURES } from '../src/data/creatures';
import type { Level } from '../src/core/types';

// 理想路線的體力成本：出生角 → 起始蹤跡 → 另一條真線索 → 攔截點。
// 「攔截點」不是獵物現在的位置，而是玩家抵達時牠會在的節點——
// 這正是這一階要求玩家做的預測，成本估算若不含這一項就是在騙自己。
function idealCost(L: Level): number {
  const start = startCorner(L.mapSize, L.route.waypoints[ROUTE_START_INDEX]);
  const legCost = (from: { x: number; y: number }, to: { x: number; y: number }): number => {
    const c = routeCostsFrom(L.terrain, from).get(key(to));
    return c === undefined ? Infinity : c;
  };
  const real = L.clues.filter((c) => !c.isDecoy);
  const trailhead = L.clues[L.trailheadIndex].position;
  // 第二條線索取「離起始蹤跡最近的另一條真線索」——玩家的合理選擇
  let second = trailhead;
  let bestSecond = Infinity;
  for (const c of real) {
    if (key(c.position) === key(trailhead)) continue;
    const cost = legCost(trailhead, c.position);
    if (cost < bestSecond) { bestSecond = cost; second = c.position; }
  }
  const legA = legCost(start, trailhead);
  const legB = bestSecond;
  // 走到這裡已經花了多少步？以「每一步平均 1.6 點」回推（terrain 成本 1/2/4 的加權均值）
  const stepsSoFar = Math.round((legA + legB) / 1.6);
  const intercept = targetAt(L.route, stepsSoFar);
  return legA + legB + legCost(second, intercept);
}

describe('可解性掃描（規格 §8）', () => {
  it('理想路線在 98% 以上的種子裡走得完', () => {
    let total = 0;
    let ok = 0;
    const failures: string[] = [];
    for (const creature of CREATURES) {
      for (const round of [1, 5, 9]) {
        for (let seed = 1; seed <= 40; seed++) {
          const L = generateLevelFor(round, mulberry32(seed * 131 + round), creature.id);
          const budget = getDifficulty(round).staminaBudget;
          const cost = idealCost(L);
          total++;
          if (cost <= budget) ok++;
          else failures.push(`${creature.id} r${round} seed${seed}: ${Math.round(cost)} > ${budget}`);
        }
      }
    }
    // 失敗時把前幾筆印出來——知道是哪一隻生物、哪一個難度出事，比只知道比率有用得多
    if (ok / total < 0.98) console.log(failures.slice(0, 20).join('\n'));
    expect(ok / total).toBeGreaterThanOrEqual(0.98);
  });

  it('每一齡追加的線索數不失控', () => {
    // 逐齡收斂若逼生成器狂加線索，圖上會到處是 token，反而更難讀。
    // 把它量出來，讓 PER_AGE_MAX_INTERSECTION 是一個有數據的選擇。
    let maxClues = 0;
    for (const creature of CREATURES) {
      for (let seed = 1; seed <= 40; seed++) {
        const L = generateLevelFor(9, mulberry32(seed * 977), creature.id);
        maxClues = Math.max(maxClues, L.clues.length);
      }
    }
    expect(maxClues).toBeLessThanOrEqual(14);
  });
});
```

- [ ] **Step 2: 執行掃描**

Run: `npx vitest run tests/solvability.test.ts`

**兩條都通過就直接跳到 Step 4。** 任何一條沒過，進 Step 3。

- [ ] **Step 3: 依數據校準（僅在 Step 2 失敗時）**

**不要調整測試的門檻。** 98% 與 14 是規格與可讀性的要求，不是可以往下讓的數字。
按這個順序調整實作常數，每改一次就重跑掃描，並把每一輪的數字記進報告：

1. 可解率不足 → 先加大 `MOVE_EVERY`（`src/core/route.ts`，12 → 14 → 16）。
   這讓獵物走得慢，玩家追得上，且不動地圖結構。
2. 仍不足 → 縮小 `SPACING` 中偏大的項（`straight` 5 → 4）。節距短則整條路線短。
3. 線索數失控 → 放寬 `PER_AGE_MAX_INTERSECTION`（`src/core/generate.ts`，10 → 12 → 14）。

報告中必須寫出：最終選定的值、每一輪的可解率與最大線索數、以及哪一隻生物／哪一個難度
是最差的那一組。若調到上限仍不達標，**停下來回報，不要自行放寬測試門檻。**

- [ ] **Step 4: 全套測試**

Run: `npx vitest run` → 全綠
Run: `npx tsc --noEmit` → exit 0

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: sweep the living quarry for solvability across seeds

Movement spacing and cadence decide whether the game can be won at all, and
type checking cannot see that. The ridgecrest elevation bias was the precedent:
0.15 left eleven percent of first hunts mathematically unfinishable while every
gate stayed green.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: i18n 字串

**Files:**
- Modify: `src/core/i18n.ts`

**Interfaces:**
- Produces: 新 `MsgKey`：`age.fresh`、`age.night`、`age.older`、`age.all`、`hud.age`、`reveal.route`、`rule.lowland`、`rule.highland`、`rule.cover`、`rule.straight`、`rule.doubling`

> 本任務不新增測試：`tests/i18n.test.ts` 既有的「en 與 zh-TW 涵蓋完全相同的鍵」
> 與「沒有空字串」會自動涵蓋，漏一邊會直接紅。

- [ ] **Step 1: 擴充 MsgKey 聯集**

在 `src/core/i18n.ts` 的聯集尾端（`| 'btn.demo' | 'btn.next' | 'btn.prev';`）之前把分號移除，
並接上：

```ts
  | 'age.fresh' | 'age.night' | 'age.older' | 'age.all' | 'hud.age'
  | 'reveal.route'
  | 'rule.lowland' | 'rule.highland' | 'rule.cover' | 'rule.straight' | 'rule.doubling';
```

- [ ] **Step 2: 加入英文字串**

在 `STRINGS.en` 的最後一筆之後加入：

```ts
    'age.fresh': 'This morning',
    'age.night': 'Last night',
    'age.older': 'Older',
    'age.all': 'All',
    'hud.age': 'Freshness',
    'reveal.route': 'It was moving. The trail below is where it walked, oldest to newest.',
    'rule.lowland': 'Follows the valley floor',
    'rule.highland': 'Keeps to the ridgeline',
    'rule.cover': 'Hugs the thickets',
    'rule.straight': 'Travels in a straight line',
    'rule.doubling': 'Doubles back on itself',
```

- [ ] **Step 3: 加入中文字串**

在 `STRINGS['zh-TW']` 的最後一筆之後加入：

```ts
    'age.fresh': '今晨',
    'age.night': '昨夜',
    'age.older': '更早',
    'age.all': '全部',
    'hud.age': '新鮮度',
    'reveal.route': '牠一直在移動。下面這條就是牠走過的路，由舊到新。',
    'rule.lowland': '沿溪谷低處走',
    'rule.highland': '沿稜線高處走',
    'rule.cover': '貼著密叢走',
    'rule.straight': '一路直行',
    'rule.doubling': '走出去再折返',
```

- [ ] **Step 4: 驗證**

Run: `npx vitest run tests/i18n.test.ts` → PASS
Run: `npx tsc --noEmit` → exit 0

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n.ts
git commit -m "feat: add freshness and route-rule strings in both locales

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: MapScene —— 新鮮度呈現與獵物顯形

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `currentTarget`／`isTargetVisible`（Task 3）、`ClueAge`（Task 2）、Task 5 的字串
- Produces: 無新介面

> **場景無法單元測試。** 把關是 `npx tsc --noEmit`、`npx vite build` 與人工冒煙。不要寫測試。

- [ ] **Step 1: 線索 token 依齡分濃淡**

`redraw()` 中畫線索 token 的迴圈，把 `drawClueToken(this.g, p.x, p.y, r, c.type, pal)` 之前
加上依齡的透明度。`Graphics` 沒有逐次呼叫的 alpha 參數，改以在 token 之上疊一層底色遮罩表達：
在 `drawClueToken` 之後加入

```ts
      // 新鮮度：越舊的痕跡越淡。用底色半透明覆蓋而非改 alpha，是因為
      // drawClueToken 內部自帶多段 fillStyle，逐段調 alpha 會讓圖形散開。
      const fade = [0.45, 0.22, 0][c.age];
      if (fade > 0) this.g.fillStyle(pal.bg, fade).fillCircle(p.x, p.y, r + 1);
```

- [ ] **Step 2: 獵物在視野內顯形**

在 `redraw()` 中畫玩家（`this.drawPlayer(pp.x, pp.y)`）**之前**加入：

```ts
    // 獵物：只在當前視野半徑內顯形。迷霧仍在，所以看得到牠時你已經很近了——
    // 這讓追蹤的最後一段變得可讀，而不是憑空猜。
    if (isTargetVisible(s)) {
      const tp = px(currentTarget(s));
      this.g.fillStyle(pal.glow, 0.25).fillCircle(tp.x, tp.y, cs * 0.5);
      this.g.fillStyle(pal.glow, 1).fillCircle(tp.x, tp.y, cs * 0.22);
    }
```

import 補上 `isTargetVisible`（`currentTarget` 已於 Task 3 補入）。

- [ ] **Step 3: 新鮮度切換 chip 與逐齡熱區**

新增欄位（與既有的 `heatOn` 並列）：

```ts
  // 熱區要看哪一齡。分齡之後若把所有線索混在一起算熱度，圖層會糊成一片而失去意義。
  // null 代表「全部」——保留它是因為玩家有時就是想看整體密度。
  private heatAge: 0 | 1 | 2 | null = 2;
```

在 `create()` 既有的旗標重置區塊中加入 `this.heatAge = 2;`。

`redraw()` 中計算熱區那一段，把

```ts
      const heat = heatMap(unmutedReadClues(L, s.readLog, s.mutedClues), L.mapSize);
```

改成

```ts
      const live = unmutedReadClues(L, s.readLog, s.mutedClues)
        .filter((c) => this.heatAge === null || c.age === this.heatAge);
      const heat = heatMap(live, L.mapSize);
```

在既有的「圖層」chip 旁新增一個新鮮度 chip，沿用該檔既有的 chip 繪製慣例
（圓角矩形 ＋ 置中文字 ＋ 44px 命中矩形）。標籤取自
`i18n.t('hud.age')` 與當前齡對應的 `age.*` 字串；`pointerdown` 依
`2 → 1 → 0 → null → 2` 循環後 `this.redraw()`。chip 的 x 座標接在圖層 chip 左側，
沿用該列既有的 `xLayer - 8 - <寬度>` 推算方式。

- [ ] **Step 4: 型別檢查與建置**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build` → exit 0

- [ ] **Step 5: 全套測試**

Run: `npx vitest run` → 全綠（本任務不動測試）

- [ ] **Step 6: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat: show clue age, the quarry in view, and a per-age layer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: RevealScene —— 畫出路線

**Files:**
- Modify: `src/scenes/RevealScene.ts`

**Interfaces:**
- Consumes: `Level.route`、`currentTarget`、Task 5 的 `reveal.route` 與 `rule.*`
- Produces: 無新介面

> 規格 §7：**沒有這一步，`doubling` 與 `straight` 對玩家而言只是隨機。**
> 這是玩家學會物種行為的唯一地方。

- [ ] **Step 1: 畫出路線與各節點的齡**

在 `RevealScene` 既有畫出真實位置（`const t = px(...)`）那一段**之前**加入：

```ts
    // 覓食路線：由舊到新連成一線，節點越新畫得越亮。這是玩家唯一能學會
    // 「這個物種怎麼走」的地方——看不到路線，折返與直行對他而言只是隨機。
    const w = L.route.waypoints;
    for (let i = 1; i < w.length; i++) {
      const a = px(w[i - 1]);
      const b = px(w[i]);
      this.g.lineStyle(2, pal.glow, 0.25 + 0.15 * i);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
    }
    w.forEach((p, i) => {
      const q = px(p);
      this.g.fillStyle(pal.glow, 0.3 + 0.17 * i).fillCircle(q.x, q.y, cs * 0.16);
    });
```

（`pal`、`px`、`cs`、`this.g` 沿用該方法既有的區域變數名；若名稱不同，依現況調整。）

- [ ] **Step 2: 加上文字說明**

在既有揭曉文字區塊的最後一行之後，加入兩行：一行 `reveal.route`，一行該物種的走法名稱。
走法字串鍵用映射表取得（避免模板字面型別無法收斂為 `MsgKey`，同該專案既有的
`WEATHER_KEY`／`QUALITY_KEY` 手法）。在檔尾 class 之外加入：

```ts
const RULE_KEY: Record<RouteRule, MsgKey> = {
  lowland: 'rule.lowland', highland: 'rule.highland', cover: 'rule.cover',
  straight: 'rule.straight', doubling: 'rule.doubling',
};
```

並 import `type { RouteRule } from '../core/route'` 與 `type { MsgKey } from '../core/i18n'`。

文字的 y 座標沿用該檔既有的排版方式；若該區塊已無空間，把兩行併成一行顯示
（`reveal.route` ＋ 破折號 ＋ 走法名稱）。

- [ ] **Step 3: 型別檢查與建置**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build` → exit 0

- [ ] **Step 4: 全套測試**

Run: `npx vitest run` → 全綠

- [ ] **Step 5: Commit**

```bash
git add src/scenes/RevealScene.ts
git commit -m "feat: reveal the foraging route and name the species' habit

Without this the quarry's movement rule is indistinguishable from randomness,
and nothing about the species can be learned between hunts.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 人工冒煙

> **本任務無法由 agent 完成。** 場景層在本專案無法單元測試，而這一階同時改變了
> 難度曲線與畫面。規格 §11 明確指出：掃描只驗證「數學上走得完」，不驗證「人類玩得動」。

- [ ] **Step 1: 啟動**

Run: `npm run dev`

- [ ] **Step 2: 清單**

推理是否還成立：

- [ ] 讀到兩條不同齡的線索，能不能看出獵物往哪走
- [ ] 新鮮度 chip 切換時熱區確實改變，且切到「全部」時是混合的
- [ ] 有幌子的局（第 4 局起）：把某一齡的線索靜音後，該齡的熱區是否恢復收斂
- [ ] 線索 token 的濃淡差異看得出來，不是三種都差不多

獵物：

- [ ] 走到附近時獵物確實顯形，且會隨步數移動
- [ ] 追到牠旁邊能正常進入 QTE
- [ ] 同一物種玩兩局，走法是否認得出來（紗霧蛾折返、羽尾獸直行）

揭曉：

- [ ] 路線畫得出來、由舊到新的亮度差看得出來
- [ ] 走法名稱正確對應該物種

難度感受（**這一項最重要**）：

- [ ] 連玩五局，有沒有出現「推理正確卻追不上」的挫折
- [ ] 力竭的比例有沒有明顯上升

- [ ] **Step 3: 記錄結果**

寫入 `.superpowers/sdd/progress.md`。**若難度感受那一項出問題，回報而不要自行調參**——
`MOVE_EVERY` 與節距的調整必須連同 Task 4 的掃描一起重跑。

---

## 自我檢查紀錄

**規格覆蓋**：§3 架構 → Task 1–3；§4 路線與物種規則 → Task 1；§5 新鮮度與幌子矛盾 → Task 2；
§5.2 逐齡收斂 → Task 2；§6 捕獲／押注／可見性 → Task 3；§7 介面三項 → Task 6（前兩項）、Task 7（第三項）；
§8 可解性量測 → Task 4；§9 測試策略 → Task 1／2／4；§10 不做 → 全計畫未觸及 `applyQuirk`、`qte.ts`、`difficulty.ts`；§11 風險 → Task 8。

**型別一致性**：`RouteRule`／`Route`／`ROUTE_WAYPOINTS`／`ROUTE_START_INDEX`／`MOVE_EVERY`／
`routeRuleFor`／`buildRoute`／`targetAt`／`finalTarget` 於 Task 1 定義，Task 2–7 以相同拼寫使用；
`ClueAge` 於 Task 2 定義，Task 6 使用；`currentTarget`／`isTargetVisible` 於 Task 3 定義，Task 6／7 使用；
`misleadingDecoy` 的第四參數於 Task 3 加入，同任務內更新全部呼叫端。

**未決事項**：`PER_AGE_MAX_INTERSECTION`、`MOVE_EVERY`、`SPACING` 的最終值由 Task 4 的量測決定，
計畫給的是起始值而非結論。
