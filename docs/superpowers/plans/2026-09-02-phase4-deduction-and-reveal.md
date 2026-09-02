# Phase 4「判讀與揭曉」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓玩家能用三態標記與候選熱區主動表達推論，並在每一局結束時一律看見真相——牠在哪、你差幾格、哪條假蹤跡騙了你、資訊在第幾步就已完備。

**Architecture:** 所有新邏輯落在 `src/core/`（`marks.ts` 標記狀態機、`deduction.ts` 熱區與事後分析、`quality.ts` 評分軸置換），以純函式 TDD 覆蓋；場景層只做接線。揭曉不塞進已經擁擠的 `ResultScene`，而是新增一個 `RevealScene`，插在 QTE／力竭與結算之間，讓小地圖有完整版面。

**Tech Stack:** Phaser 3.90、TypeScript 5.6（strict）、Vite 6、Vitest 3（`environment: 'node'`）。

## Global Constraints

- 不新增任何 runtime 相依；`package.json` 的 `dependencies` 僅保留 `phaser`。
- `vite.config.ts` 的 `test.environment` 為 `node`，**Phaser 場景無法單元測試**。新邏輯一律抽成 `src/core/` 純函式並 TDD；場景層以 `npm run build`（＝`tsc --noEmit && vite build`）＋ 人工冒煙把關。
- 所有面向玩家的字串走 `i18n.t()`，`en` 與 `zh-TW` 同步新增。`tests/i18n.test.ts` 已有鍵值對等測試，漏一邊會直接紅燈。
- 反向錨定生成不得改動：本階段完全不碰 `src/core/generate.ts`。
- 線索金光 `CLUE_GOLD = 0xd8c874` 恆定。新增顏色不得與其相近。三態標記沿用既有 `pal.mark`（排除）、`pal.supply`（存疑）、`pal.gold`（押注）。
- 無傷害定位：揭曉畫面不得出現死亡、受傷、捕捉暴力的措辭或圖形。
- 失敗軟著陸保留：`notesForRun` 與研究度累積邏輯不得移除。
- 新增 registry 鍵必須同步 `docs/ARCHITECTURE-NOTES.md` 的兩張表（Task 11）。
- TypeScript strict：不得使用 `any`，不得用 `!` 掩蓋真正可能為 undefined 的存取。

---

### Task 1: 八方向鍵盤移動

修復 A-07：`canMove` 用 Chebyshev 距離允許斜走，但鍵盤只綁四方向，純鍵盤玩家走對角要多付約四成體力。

**Files:**
- Modify: `src/scenes/MapScene.ts:248-259`（`update()` 方法全體）

**Interfaces:**
- Consumes: 既有 `doMove(to: Vec2)`、`session(): SessionState`
- Produces: 無新介面（純場景行為修正）

- [ ] **Step 1: 替換 `update()` 方法**

在 `src/scenes/MapScene.ts` 找到現有的 `update()`：

```ts
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
    if (to) this.doMove(to);
  }
```

整段換成：

```ts
  update() {
    if (!this.cursors) return;
    const s = this.session();
    if (s.phase !== 'explore') return;
    const c = this.cursors;
    const jd = Phaser.Input.Keyboard.JustDown;
    // 任一方向鍵按下的那一幀才動作（維持既有「一次按鍵走一格」手感）
    if (!(jd(c.left) || jd(c.right) || jd(c.up) || jd(c.down))) return;
    // 八方向（A-07）：以「此刻按住」的四鍵合成位移向量，讓「上＋右」這類同時按住的組合
    // 走對角，與滑鼠點擊的 Chebyshev 相鄰規則一致。原本四方向版本會讓純鍵盤玩家
    // 走同一段對角路多付約四成體力。
    const dx = (c.right.isDown ? 1 : 0) - (c.left.isDown ? 1 : 0);
    const dy = (c.down.isDown ? 1 : 0) - (c.up.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) return; // 左右或上下同時按住互相抵消
    this.doMove({ x: s.player.x + dx, y: s.player.y + dy });
  }
```

- [ ] **Step 2: 確認 `Vec2` 匯入是否仍被使用**

Run: `grep -n "Vec2" src/scenes/MapScene.ts | head -5`
Expected: 仍有多處使用（`toGrid`、`drawHover`、`playEventCone` 等），匯入保留不動。若輸出顯示只剩 import 一行，才把 `Vec2` 從 import 移除。

- [ ] **Step 3: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤，`dist/` 產出成功。

- [ ] **Step 4: 人工冒煙**

Run: `npm run dev`，開瀏覽器進入第一局，按住 ↑ 再按 →。
Expected: 玩家往右上斜走一格，體力扣一格地形成本（非兩格）。

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "fix: eight-direction keyboard movement to match click rules"
```

---

### Task 2: 三態標記狀態機

建立 `marks.ts`。玩家的標記從單一 `Set<string>` 升級為三態：排除 → 存疑 → 押注 → 無。押注格全域唯一，因為它是 Task 6 判讀精準度評分的唯一輸入。

**Files:**
- Create: `src/core/marks.ts`
- Test: `tests/marks.test.ts`

**Interfaces:**
- Consumes: `Vec2` from `src/core/geometry`
- Produces:
  - `type MarkKind = 'exclude' | 'suspect' | 'wager'`
  - `type MarkMap = Map<string, MarkKind>`
  - `nextMark(current: MarkKind | undefined): MarkKind | null`
  - `cycleMark(marks: MarkMap, k: string): void`（就地修改）
  - `wagerKey(marks: MarkMap): string | null`
  - `parseKey(k: string): Vec2`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/marks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nextMark, cycleMark, wagerKey, parseKey, type MarkMap } from '../src/core/marks';

describe('nextMark', () => {
  it('cycles none -> exclude -> suspect -> wager -> none', () => {
    expect(nextMark(undefined)).toBe('exclude');
    expect(nextMark('exclude')).toBe('suspect');
    expect(nextMark('suspect')).toBe('wager');
    expect(nextMark('wager')).toBe(null);
  });
});

describe('cycleMark', () => {
  it('adds then advances then removes a mark in place', () => {
    const m: MarkMap = new Map();
    cycleMark(m, '3,4');
    expect(m.get('3,4')).toBe('exclude');
    cycleMark(m, '3,4');
    expect(m.get('3,4')).toBe('suspect');
    cycleMark(m, '3,4');
    expect(m.get('3,4')).toBe('wager');
    cycleMark(m, '3,4');
    expect(m.has('3,4')).toBe(false);
  });

  it('keeps the wager unique by clearing any previous wager', () => {
    const m: MarkMap = new Map([['1,1', 'wager']]);
    cycleMark(m, '2,2'); // exclude
    cycleMark(m, '2,2'); // suspect
    cycleMark(m, '2,2'); // wager -> 舊押注須被清掉
    expect(m.has('1,1')).toBe(false);
    expect(m.get('2,2')).toBe('wager');
  });

  it('leaves other marks untouched when a new wager is set', () => {
    const m: MarkMap = new Map([['0,0', 'exclude'], ['1,1', 'wager']]);
    cycleMark(m, '5,5');
    cycleMark(m, '5,5');
    cycleMark(m, '5,5');
    expect(m.get('0,0')).toBe('exclude');
    expect(m.get('5,5')).toBe('wager');
    expect(m.size).toBe(2);
  });
});

describe('wagerKey', () => {
  it('returns the single wager key', () => {
    expect(wagerKey(new Map([['0,0', 'exclude'], ['7,2', 'wager']]))).toBe('7,2');
  });
  it('returns null when no wager is placed', () => {
    expect(wagerKey(new Map([['0,0', 'suspect']]))).toBe(null);
    expect(wagerKey(new Map())).toBe(null);
  });
});

describe('parseKey', () => {
  it('round-trips the "x,y" format used by clues.key', () => {
    expect(parseKey('12,3')).toEqual({ x: 12, y: 3 });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/marks.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/marks"`

- [ ] **Step 3: 實作**

Create `src/core/marks.ts`:

```ts
import type { Vec2 } from './geometry';

// 玩家標記三態（設計提案 R3）：排除＝這格不可能、存疑＝待驗證、押注＝我認為牠在這。
// 押注是 Task 6 判讀精準度評分的唯一輸入，因此全域唯一。
export type MarkKind = 'exclude' | 'suspect' | 'wager';
export type MarkMap = Map<string, MarkKind>;

// 循環序：末項 null 代表「清除標記」，讓同一格反覆點擊可以繞回未標記狀態
const CYCLE: readonly (MarkKind | null)[] = ['exclude', 'suspect', 'wager', null];

export function nextMark(current: MarkKind | undefined): MarkKind | null {
  const idx = current === undefined ? -1 : CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

// 就地推進一格的標記狀態（沿用 session.toggleMark 的 mutate 慣例，不回傳新 Map）
export function cycleMark(marks: MarkMap, k: string): void {
  const next = nextMark(marks.get(k));
  if (next === null) {
    marks.delete(k);
    return;
  }
  if (next === 'wager') {
    // 押注唯一：先清掉舊押注，避免評分時出現兩個候選
    for (const [ck, kind] of marks) {
      if (kind === 'wager') marks.delete(ck);
    }
  }
  marks.set(k, next);
}

export function wagerKey(marks: MarkMap): string | null {
  for (const [k, kind] of marks) {
    if (kind === 'wager') return k;
  }
  return null;
}

// clues.key() 的反向操作："x,y" → Vec2
export function parseKey(k: string): Vec2 {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/marks.test.ts`
Expected: PASS（4 個 describe、共 7 個測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/core/marks.ts tests/marks.test.ts
git commit -m "feat: three-state mark model with a unique wager cell"
```

---

### Task 3: session 接上三態標記、路徑、判讀記錄與線索靜音

`SessionState` 需要四項新資料：三態標記、玩家路徑（揭曉回放用）、線索判讀順序與步數（Task 5 的資訊完備步數用）、被靜音的線索索引（Task 4 的熱區用）。`toggleMark` 由 `cycleMarkAt` 取代——這是破壞性改動，同一個 task 內必須一併修好 `MapScene` 的呼叫端，否則建置會紅。

**Files:**
- Modify: `src/core/session.ts`
- Modify: `src/scenes/MapScene.ts`（`toggleMark` 呼叫端、`redraw()` 的 marks 迭代）
- Test: `tests/session.test.ts`

**Interfaces:**
- Consumes: `MarkMap`, `cycleMark` from `src/core/marks`（Task 2）
- Produces:
  - `interface ClueRead { clueIndex: number; step: number }`
  - `SessionState` 新欄位：`marks: MarkMap`、`path: Vec2[]`、`readLog: ClueRead[]`、`mutedClues: Set<number>`
  - `cycleMarkAt(s: SessionState, p: Vec2): void`（取代 `toggleMark`）
  - `toggleMute(s: SessionState, clueIndex: number): void`

- [ ] **Step 1: 寫失敗的測試**

在 `tests/session.test.ts` 的 import 區塊，把 `toggleMark` 換成 `cycleMarkAt, toggleMute`：

```ts
import {
  newSession, canMove, move, cycleMarkAt, toggleMute, resolveQte, nextSession, useBell,
  TERRAIN_COST, type SessionState,
} from '../src/core/session';
```

在同檔的 `makeState` 工廠中，把回傳物件的 `marks: new Set(),` 換成下列四行：

```ts
    marks: new Map(), path: [{ x: 0, y: 0 }], readLog: [], mutedClues: new Set(),
```

（`readClues: new Set(),` 保留不動——它仍供 `notesForRun` 與地圖繪製使用。）

檔案末尾追加：

```ts
describe('cycleMarkAt', () => {
  it('advances a cell through the three mark states', () => {
    const s = makeState();
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.get('2,2')).toBe('exclude');
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.get('2,2')).toBe('suspect');
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.get('2,2')).toBe('wager');
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.has('2,2')).toBe(false);
  });
});

describe('move: path and clue read log', () => {
  it('records every visited cell in order, starting from the spawn', () => {
    const s = makeState();
    move(s, { x: 0, y: 1 });
    move(s, { x: 1, y: 1 });
    expect(s.path).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
  });

  it('logs the clue index and the step it was read at', () => {
    const s = makeState({ player: { x: 1, y: 0 } }); // 線索在 (2,0)
    move(s, { x: 2, y: 0 });
    expect(s.readLog).toEqual([{ clueIndex: 0, step: 1 }]);
    expect(s.readClues.has('2,0')).toBe(true);
  });

  it('does not log the same clue twice', () => {
    const s = makeState({ player: { x: 1, y: 0 } });
    move(s, { x: 2, y: 0 });
    move(s, { x: 1, y: 0 });
    move(s, { x: 2, y: 0 });
    expect(s.readLog).toHaveLength(1);
  });
});

describe('toggleMute', () => {
  it('toggles a clue index in and out of the muted set', () => {
    const s = makeState();
    toggleMute(s, 0);
    expect(s.mutedClues.has(0)).toBe(true);
    toggleMute(s, 0);
    expect(s.mutedClues.has(0)).toBe(false);
  });
});

describe('newSession', () => {
  it('seeds the path with the spawn cell and empty deduction state', () => {
    const s = newSession(1, mulberry32(11));
    expect(s.path).toEqual([s.player]);
    expect(s.marks.size).toBe(0);
    expect(s.readLog).toHaveLength(0);
    expect(s.mutedClues.size).toBe(0);
  });
});
```

同時把檔案裡既有的 `toggleMark` 測試區塊整段刪除（搜尋 `describe('toggleMark'`），以及 `useBell` 測試中對 `s.marks.has(...)` 的斷言改為：

```ts
    expect(s.marks.get(key(pos!))).toBe('exclude');
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL — `cycleMarkAt is not exported` / `toggleMute is not exported`

- [ ] **Step 3: 實作 session 變更**

在 `src/core/session.ts` 頂部的 import 區塊追加：

```ts
import { cycleMark, type MarkMap } from './marks';
```

在 `SessionState` 介面上方新增型別，並改寫介面的四個欄位：

```ts
// 線索判讀記錄：哪一條線索、在第幾步被踩到。供揭曉畫面回推「資訊在第幾步就已完備」
export interface ClueRead {
  clueIndex: number;
  step: number;
}

export interface SessionState {
  round: number;
  level: Level;
  player: Vec2;
  stamina: number;
  readClues: Set<string>; // 已判讀（踩過）的線索位置鍵
  marks: MarkMap;         // 玩家標記：排除／存疑／押注（押注全域唯一）
  path: Vec2[];           // 走過的每一格（含起點），揭曉畫面回放用
  readLog: ClueRead[];    // 線索判讀順序與步數（同一條線索只記一次）
  mutedClues: Set<number>; // 被玩家靜音、不計入候選熱區的線索索引
  phase: Phase;
  steps: number;          // 本局累計移動步數（分享卡用）
  mode: SessionMode;      // 主線 run / 每日挑戰 daily
  resolved: boolean;      // Result 已記帳（防場景重啟重複記錄）
  bellUsed: boolean;      // 微光鈴本局是否已使用（一局一次）
  microEvents: number;    // 微事件本局計數
}
```

`newSession` 的回傳物件改為：

```ts
export function newSession(round: number, rng: Rng, mode: SessionMode = 'run'): SessionState {
  const level = generateLevel(round, rng);
  const player = startPos(level);
  return {
    round,
    level,
    player,
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Map(),
    path: [player],
    readLog: [],
    mutedClues: new Set(),
    phase: 'explore',
    steps: 0,
    mode,
    resolved: false,
    bellUsed: false,
    microEvents: 0,
  };
}
```

`move()` 中，把記錄玩家位置與線索判讀的兩段改寫。原本：

```ts
  s.steps++;
  s.stamina -= TERRAIN_COST[s.level.terrain[to.y][to.x]];
  s.player = to;
```

改為（追加 path 記錄）：

```ts
  s.steps++;
  s.stamina -= TERRAIN_COST[s.level.terrain[to.y][to.x]];
  s.player = to;
  s.path.push(to);
```

原本：

```ts
  if (s.level.clues.some((c) => key(c.position) === k)) s.readClues.add(k);
```

改為（同時記錄索引與步數，且不重複記錄）：

```ts
  const clueIndex = s.level.clues.findIndex((c) => key(c.position) === k);
  if (clueIndex >= 0 && !s.readClues.has(k)) {
    s.readClues.add(k);
    s.readLog.push({ clueIndex, step: s.steps });
  }
```

把 `toggleMark` 整個函式：

```ts
export function toggleMark(s: SessionState, p: Vec2): void {
  const k = key(p);
  if (s.marks.has(k)) s.marks.delete(k);
  else s.marks.add(k);
}
```

換成：

```ts
// 三態標記推進：排除 → 存疑 → 押注 → 無（押注唯一性由 marks.cycleMark 保證）
export function cycleMarkAt(s: SessionState, p: Vec2): void {
  cycleMark(s.marks, key(p));
}

// 線索靜音：把一條已判讀的線索排除在候選熱區之外，用來檢驗「如果這條是假的呢」
export function toggleMute(s: SessionState, clueIndex: number): void {
  if (s.mutedClues.has(clueIndex)) s.mutedClues.delete(clueIndex);
  else s.mutedClues.add(clueIndex);
}
```

`useBell` 中的 `s.marks.add(key(pick.position));` 改為（鈴聲指出的是假蹤跡，語意上就是「排除」）：

```ts
  s.marks.set(key(pick.position), 'exclude');
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/session.test.ts`
Expected: PASS

- [ ] **Step 5: 修好 MapScene 呼叫端**

在 `src/scenes/MapScene.ts` 的 import，把 `toggleMark` 換成 `cycleMarkAt`：

```ts
import { canMove, move, cycleMarkAt, useBell, TERRAIN_COST, type SessionState } from '../core/session';
```

`onPointerUp` 中的 `toggleMark(s, cellPos);` 改為 `cycleMarkAt(s, cellPos);`。

`redraw()` 中的標記繪製迴圈——原本：

```ts
    for (const m of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      const r = cs * 0.32;
      this.g.lineStyle(3, pal.mark, 0.9);
      this.g.lineBetween(p.x - r, p.y - r, p.x + r, p.y + r);
      this.g.lineBetween(p.x + r, p.y - r, p.x - r, p.y + r);
    }
```

暫時改成只處理 Map 的 entry 形狀（三態的完整繪製在 Task 8 才做，此處先讓建置通過且行為不退步）：

```ts
    for (const [m] of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      const r = cs * 0.32;
      this.g.lineStyle(3, pal.mark, 0.9);
      this.g.lineBetween(p.x - r, p.y - r, p.x + r, p.y + r);
      this.g.lineBetween(p.x + r, p.y - r, p.x - r, p.y + r);
    }
```

- [ ] **Step 6: 全量測試與建置**

Run: `npm run test && npm run build`
Expected: 全部測試 PASS，建置無錯誤。

- [ ] **Step 7: Commit**

```bash
git add src/core/session.ts src/scenes/MapScene.ts tests/session.test.ts
git commit -m "feat: session tracks three-state marks, path, clue read log and muted clues"
```

---

### Task 4: 候選熱區計算

把 `intersect()` 從新手引導專用升格為玩家工具。熱區不是二元的交集，而是「每格符合幾條線索」——這樣即使有幌子干擾，玩家也能看見「大多數線索指向這一帶」，並用靜音功能逐一檢驗。

**Files:**
- Create: `src/core/deduction.ts`
- Test: `tests/deduction.test.ts`

**Interfaces:**
- Consumes: `candidates` from `src/core/clues`；`Clue`, `Level` from `src/core/types`；`ClueRead` from `src/core/session`
- Produces:
  - `unmutedReadClues(level: Level, readLog: ClueRead[], muted: Set<number>): Clue[]`
  - `heatMap(clues: Clue[], mapSize: number): Map<string, number>`
  - `maxHeat(heat: Map<string, number>): number`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/deduction.test.ts`:

```ts
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/deduction.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/deduction"`

- [ ] **Step 3: 實作**

Create `src/core/deduction.ts`:

```ts
import { candidates } from './clues';
import type { Clue, Level } from './types';
import type { ClueRead } from './session';

// 玩家目前可用來推理的線索：已判讀、且未被靜音者，維持判讀順序。
// 幌子線索照樣列入——玩家在揭曉之前無從分辨，這正是靜音功能存在的理由。
export function unmutedReadClues(
  level: Level, readLog: ClueRead[], muted: Set<number>,
): Clue[] {
  const out: Clue[] = [];
  for (const entry of readLog) {
    if (muted.has(entry.clueIndex)) continue;
    const clue = level.clues[entry.clueIndex];
    if (clue) out.push(clue);
  }
  return out;
}

// 候選熱度：每格符合幾條線索。不用二元交集，是因為有幌子時交集常常是空集合，
// 而「多數線索指向這一帶」才是玩家實際在做的判斷。零符合的格不寫進 Map，保持稀疏。
export function heatMap(clues: Clue[], mapSize: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const clue of clues) {
    for (const k of candidates(clue, mapSize)) {
      out.set(k, (out.get(k) ?? 0) + 1);
    }
  }
  return out;
}

// 熱區最高值：渲染層據此把熱度正規化為透明度
export function maxHeat(heat: Map<string, number>): number {
  let max = 0;
  for (const n of heat.values()) if (n > max) max = n;
  return max;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/deduction.test.ts`
Expected: PASS（3 個 describe、共 8 個測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/core/deduction.ts tests/deduction.test.ts
git commit -m "feat: candidate heat map from unmuted read clues"
```

---

### Task 5: 資訊完備步數與誤導幌子

揭曉畫面的兩句關鍵台詞需要的分析函式。

**「資訊完備步數」的精確定義**：依判讀順序重播玩家讀到的**真線索**，逐條累積交集；第一次讓交集大小等於「全部已讀真線索的最終交集大小」的那一步，就是資訊完備步數。白話：從這一步之後，玩家再多走的路都沒有為他帶來更精確的資訊。這個定義對任何難度都有解（不像「交集縮到 1 格」在第 1 局幾乎不會發生），且直接指出過度行走。

**Files:**
- Modify: `src/core/deduction.ts`
- Test: `tests/deduction.test.ts`

**Interfaces:**
- Consumes: `intersect`, `key` from `src/core/clues`；Task 4 的既有匯出
- Produces:
  - `infoCompleteStep(level: Level, readLog: ClueRead[]): number | null`
  - `misleadingDecoy(level: Level, readLog: ClueRead[], wager: Vec2 | null): Clue | null`

- [ ] **Step 1: 寫失敗的測試**

在 `tests/deduction.test.ts` 的 import 追加兩個函式：

```ts
import {
  unmutedReadClues, heatMap, maxHeat, infoCompleteStep, misleadingDecoy,
} from '../src/core/deduction';
```

檔案末尾追加：

```ts
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
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/deduction.test.ts`
Expected: FAIL — `infoCompleteStep is not a function`

- [ ] **Step 3: 實作**

在 `src/core/deduction.ts` 的 import 補上 `intersect` 與 `key`，並改為：

```ts
import { candidates, intersect, key } from './clues';
import type { Vec2 } from './geometry';
import type { Clue, Level } from './types';
import type { ClueRead } from './session';
```

在檔案末尾追加：

```ts
// 資訊完備步數：依判讀順序重播真線索，交集大小第一次達到「最終交集大小」的那一步。
// 從這一步之後，玩家再走的路都沒有帶來更精確的資訊——揭曉畫面用它指出過度行走。
// 幌子不計入：它們不是關於目標的資訊。玩家未讀到任何真線索時回傳 null。
export function infoCompleteStep(level: Level, readLog: ClueRead[]): number | null {
  const real: { clue: Clue; step: number }[] = [];
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue && !clue.isDecoy) real.push({ clue, step: entry.step });
  }
  if (real.length === 0) return null;

  const finalSize = intersect(real.map((r) => r.clue), level.mapSize).size;
  const acc: Clue[] = [];
  for (const r of real) {
    acc.push(r.clue);
    if (intersect(acc, level.mapSize).size === finalSize) return r.step;
  }
  // 理論上不可達（最後一輪必定等於 finalSize），保底回傳最後一次判讀的步數
  return real[real.length - 1].step;
}

// 誤導你的那條假蹤跡：玩家已判讀的幌子中，候選集合涵蓋押注格的第一條。
// 沒有押注、或押注不落在任何已讀幌子的範圍內時回傳 null（揭曉畫面就不顯示這一行）。
export function misleadingDecoy(
  level: Level, readLog: ClueRead[], wager: Vec2 | null,
): Clue | null {
  if (!wager) return null;
  const wk = key(wager);
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue && clue.isDecoy && candidates(clue, level.mapSize).has(wk)) return clue;
  }
  return null;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/deduction.test.ts`
Expected: PASS（5 個 describe、共 15 個測試全綠）

- [ ] **Step 5: Commit**

```bash
git add src/core/deduction.ts tests/deduction.test.ts
git commit -m "feat: information-complete step and misleading-decoy analysis"
```

---

### Task 6: 判讀精準度取代 QTE 成為評分軸

C-03 的解方：銅／銀／金改由「押注格與真實位置的 Chebyshev 距離」決定。QTE 本階段仍決定成敗，但不再決定品質。`qualityFromQte` 及其測試一併移除（YAGNI）。

**Files:**
- Modify: `src/core/quality.ts`
- Modify: `src/scenes/ResultScene.ts`
- Test: `tests/quality.test.ts`

**Interfaces:**
- Consumes: `cheb` from `src/core/geometry`；`wagerKey`, `parseKey` from `src/core/marks`
- Produces: `qualityFromAccuracy(wager: Vec2 | null, target: Vec2): Quality`
- Removes: `qualityFromQte`

- [ ] **Step 1: 改寫測試**

把 `tests/quality.test.ts` 整檔換成：

```ts
import { describe, it, expect } from 'vitest';
import { qualityFromAccuracy, maxQuality, QUALITY_RANK } from '../src/core/quality';

const target = { x: 10, y: 10 };

describe('qualityFromAccuracy', () => {
  it('an exact call yields gold', () => {
    expect(qualityFromAccuracy({ x: 10, y: 10 }, target)).toBe('gold');
  });
  it('within two cells yields silver', () => {
    expect(qualityFromAccuracy({ x: 12, y: 10 }, target)).toBe('silver');
    expect(qualityFromAccuracy({ x: 11, y: 12 }, target)).toBe('silver'); // 對角距離 2
  });
  it('beyond two cells yields bronze', () => {
    expect(qualityFromAccuracy({ x: 13, y: 10 }, target)).toBe('bronze');
  });
  it('no wager yields bronze', () => {
    expect(qualityFromAccuracy(null, target)).toBe('bronze');
  });
});

describe('maxQuality', () => {
  it('keeps the better of stored and new', () => {
    expect(maxQuality(null, 'bronze')).toBe('bronze');
    expect(maxQuality('gold', 'silver')).toBe('gold');
    expect(maxQuality('bronze', 'silver')).toBe('silver');
  });
  it('rank order is bronze < silver < gold', () => {
    expect(QUALITY_RANK.bronze).toBeLessThan(QUALITY_RANK.silver);
    expect(QUALITY_RANK.silver).toBeLessThan(QUALITY_RANK.gold);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/quality.test.ts`
Expected: FAIL — `qualityFromAccuracy is not a function`

- [ ] **Step 3: 實作 quality 變更**

把 `src/core/quality.ts` 整檔換成：

```ts
import { cheb, type Vec2 } from './geometry';

export type Quality = 'bronze' | 'silver' | 'gold';

export const QUALITY_RANK: Record<Quality, number> = { bronze: 0, silver: 1, gold: 2 };

// 判讀精準度＝押注格與真實位置的 Chebyshev 距離（設計提案 R3）。
// 取代原本的 qualityFromQte：品質應該獎勵推理，而不是反應速度（診斷 C-03）。
// 正中＝金、相距 ≤2 格＝銀、其餘或未下押注＝銅。
export function qualityFromAccuracy(wager: Vec2 | null, target: Vec2): Quality {
  if (!wager) return 'bronze';
  const d = cheb(wager, target);
  if (d === 0) return 'gold';
  return d <= 2 ? 'silver' : 'bronze';
}

export function maxQuality(a: Quality | null, b: Quality): Quality {
  return a !== null && QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/quality.test.ts`
Expected: PASS

- [ ] **Step 5: 接上 ResultScene**

在 `src/scenes/ResultScene.ts`：

匯入行 `import { qualityFromQte, type Quality } from '../core/quality';` 改為：

```ts
import { qualityFromAccuracy, type Quality } from '../core/quality';
import { wagerKey, parseKey } from '../core/marks';
```

刪除 `import type { QteState } from '../core/qte';`（若 `QteState` 已無其他用處，`grep -n "QteState" src/scenes/ResultScene.ts` 確認後移除）。

把品質計算兩行——原本：

```ts
    const qte = this.registry.get('qteOutcome') as QteState | undefined;
    const quality: Quality | null = caught && qte ? qualityFromQte(qte) : null;
```

改為：

```ts
    // 品質改由本局判讀精準度決定（Phase 4／診斷 C-03）：QTE 仍決定成敗，但不再決定品質
    const wk = wagerKey(s.marks);
    const wager = wk === null ? null : parseKey(wk);
    const quality: Quality | null = caught ? qualityFromAccuracy(wager, s.level.targetPos) : null;
```

- [ ] **Step 6: 全量測試與建置**

Run: `npm run test && npm run build`
Expected: 全綠、建置無錯。若 `tsc` 抱怨 `qteOutcome` registry 鍵已無讀者，那是預期的——保留 `QteScene` 的寫入不動（Phase 7 會整段移除 QTE），但把 `docs/ARCHITECTURE-NOTES.md` 的更新留到 Task 11。

- [ ] **Step 7: Commit**

```bash
git add src/core/quality.ts src/scenes/ResultScene.ts tests/quality.test.ts
git commit -m "feat: record quality now comes from deduction accuracy, not QTE timing"
```

---

### Task 7: 新增 i18n 字串

Task 8–10 的所有面向玩家文字。`tests/i18n.test.ts` 已有鍵值對等與非空測試，兩份語系必須同步。

**Files:**
- Modify: `src/core/i18n.ts`

**Interfaces:**
- Produces: 下列新 `MsgKey`，供 Task 8（MapScene）、Task 9（RevealScene）、Task 11（HelpScene）消費：
  `hud.layer`、`hud.muted`、`mark.exclude`、`mark.suspect`、`mark.wager`、
  `reveal.title`、`reveal.wasHere`、`reveal.yourCall`、`reveal.exact`、`reveal.offBy`、
  `reveal.noCall`、`reveal.decoy`、`reveal.infoAt`、`btn.continue`、
  `help.marks`、`help.layer`、`help.reveal`

- [ ] **Step 1: 擴充 MsgKey 聯集**

在 `src/core/i18n.ts` 的 `MsgKey` 型別最後一行（`| 'score.gain' | ... | 'camp.carry';`）之前插入：

```ts
  | 'hud.layer' | 'hud.muted'
  | 'mark.exclude' | 'mark.suspect' | 'mark.wager'
  | 'reveal.title' | 'reveal.wasHere' | 'reveal.yourCall' | 'reveal.exact' | 'reveal.offBy'
  | 'reveal.noCall' | 'reveal.decoy' | 'reveal.infoAt'
  | 'btn.continue'
  | 'help.marks' | 'help.layer' | 'help.reveal'
```

- [ ] **Step 2: 新增 en 字串**

在 `STRINGS.en` 物件的 `'camp.carry'` 那一行之後插入：

```ts
    'hud.layer': 'Layer',
    'hud.muted': 'Muted',
    'mark.exclude': 'Ruled out',
    'mark.suspect': 'Maybe',
    'mark.wager': 'My call',
    'reveal.title': 'The Reveal',
    'reveal.wasHere': 'It was here',
    'reveal.yourCall': 'Your call',
    'reveal.exact': 'You called it exactly.',
    'reveal.offBy': 'You were {n} cells off.',
    'reveal.noCall': 'You made no call this hunt — mark a cell gold next time.',
    'reveal.decoy': 'This false trail led you astray.',
    'reveal.infoAt': 'You had the sharpest reading available by step {n}, and walked to step {m}.',
    'btn.continue': '[ Continue ]',
    'help.marks': 'Mark a cell again and again to cycle it: ruled out, maybe, my call. Your call sets your record quality.',
    'help.layer': 'Layer shades each cell by how many read clues agree. Mark a clue you already read to mute it.',
    'help.reveal': 'Every hunt ends by revealing where it really was and how close your call landed.',
```

同時把既有的 `'help.stamina'` 那一行改寫為併入地形成本的版本（Task 11 會把 `help.terrain` 整列移除以騰出版面）：

```ts
    'help.stamina': 'Every step costs stamina — meadow and mist 1, thicket and rock 2. Mistleaf and dewfruit restore it.',
```

- [ ] **Step 3: 新增 zh-TW 字串**

在 `STRINGS['zh-TW']` 物件的 `'camp.carry'` 那一行之後插入：

```ts
    'hud.layer': '圖層',
    'hud.muted': '已靜音',
    'mark.exclude': '排除',
    'mark.suspect': '存疑',
    'mark.wager': '押注',
    'reveal.title': '揭曉',
    'reveal.wasHere': '牠在這裡',
    'reveal.yourCall': '你的押注',
    'reveal.exact': '你押得正中。',
    'reveal.offBy': '你差了 {n} 格。',
    'reveal.noCall': '這一局你沒有下押注——下次記得把一格標成金色。',
    'reveal.decoy': '這條假蹤跡把你帶偏了。',
    'reveal.infoAt': '你在第 {n} 步就取得了本局最精確的資訊，最後走到第 {m} 步。',
    'btn.continue': '［繼續］',
    'help.marks': '反覆標記同一格可循環：排除、存疑、押注。押注格決定你的記錄品質。',
    'help.layer': '「圖層」依符合的已判讀線索數為格子上色；標記已判讀的線索可將它靜音。',
    'help.reveal': '每一局結束都會揭曉牠實際在哪，以及你的押注差了幾格。',
```

同時把既有的 `'help.stamina'` 那一行改寫為併入地形成本的版本：

```ts
    'help.stamina': '每一步都消耗體力：草地／霧地 1，密叢／岩坡 2。霧葉與露珠果可以回復。',
```

> **為什麼要動 `help.stamina`：** 說明面板是固定 10 列的版面預算（見 Task 11）。既有的
> `help.stamina`（「密叢與岩坡消耗更多」）與 `help.terrain`（「草地／霧地 1・密叢／岩坡 2」）
>本來就重複，合併成一列既消除冗詞、也騰出本階段需要的列數。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/i18n.test.ts`
Expected: PASS——特別是 `en and zh-TW cover exactly the same keys` 這條。

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n.ts
git commit -m "feat: add i18n strings for marks, heat layer and the reveal"
```

---

### Task 8: MapScene 判讀工具接線

三態標記的視覺區分、候選熱區圖層開關、以及對已判讀線索格的靜音互動。

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `cycleMarkAt`, `toggleMute` from `src/core/session`（Task 3）；`unmutedReadClues`, `heatMap`, `maxHeat` from `src/core/deduction`（Task 4）；Task 7 的字串鍵
- Produces: 無新公開介面（場景內部狀態 `heatOn: boolean`）

- [ ] **Step 1: 新增 import 與欄位**

在 `src/scenes/MapScene.ts` 的 import 區塊追加：

```ts
import { unmutedReadClues, heatMap, maxHeat } from '../core/deduction';
```

並確認 session 的匯入包含 `toggleMute`：

```ts
import { canMove, move, cycleMarkAt, toggleMute, useBell, TERRAIN_COST, type SessionState } from '../core/session';
```

在 `private tutBg?: Phaser.GameObjects.Graphics;` 之後新增欄位：

```ts
  // 候選熱區圖層（診斷 B-01）：預設開啟，玩家可用 HUD chip 關掉以看清底圖
  private heatOn = true;
  private heatG!: Phaser.GameObjects.Graphics;
  private heatChipG?: Phaser.GameObjects.Graphics;
  private heatChipText?: Phaser.GameObjects.Text;
  private heatChipX = 0;
  private heatChipY = 0;
```

- [ ] **Step 2: 建立熱區圖層（在地圖層之下、玩家層之上不行——要在最底）**

在 `create()` 中，把原本的：

```ts
    this.g = this.add.graphics();
```

改為（熱區必須畫在線索與標記之下，故先建立）：

```ts
    this.heatG = this.add.graphics(); // 熱區在最底層，不遮蔽線索覆蓋層與標記
    this.g = this.add.graphics();
```

- [ ] **Step 3: 新增熱區 chip 到 HUD**

在 `buildHud()` 中，找到這一行：

```ts
    this.chipRowLeft = hasBell ? xBell : xSound; // 供 updateHud 計算體力條寬度時保持間距
```

換成：

```ts
    const xHeat = (hasBell ? xBell : xSound) - 8 - 60; // 熱區圖層 chip 左緣
    this.chipRowLeft = xHeat; // 供 updateHud 計算體力條寬度時保持間距
```

接著在 `buildHud()` 的 `if (hasBell) { ... }` 區塊之後、方法結尾的 `}` 之前，插入熱區 chip：

```ts
    // 候選熱區圖層 chip（診斷 B-01）：開＝金色填底，關＝金色描邊。位於鈴／♪ chip 左側。
    this.heatChipX = xHeat;
    this.heatChipY = chipY;
    this.heatChipG = this.add.graphics();
    this.heatChipText = this.add.text(xHeat + 30, chipY + chipH / 2, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.drawHeatChip(xHeat, chipY, 60, chipH);
    this.add.rectangle(xHeat + 30, chipY + chipH / 2, 60, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.heatOn = !this.heatOn;
        this.drawHeatChip(xHeat, chipY, 60, chipH);
        this.redraw();
      });
```

- [ ] **Step 4: 新增 chip 繪製方法**

在 `drawMarkChip` 方法之後插入：

```ts
  // 熱區圖層 chip：開＝金色填底＋暗字，關＝金色描邊＋金字（沿用標記 chip 的開關語彙）
  private drawHeatChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.heatChipG!;
    g.clear();
    const label = this.i18n().t('hud.layer');
    if (this.heatOn) {
      g.fillStyle(pal.gold, 0.85).fillRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.heatChipText!.setColor(cssHex(pal.bg)).setText(label);
    } else {
      g.lineStyle(1.2, pal.gold, 0.7).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.heatChipText!.setColor(cssHex(pal.gold)).setText(label);
    }
  }
```

並在 `updateHud()` 中，於既有的兩行 chip 重繪之後追加一行：

```ts
    if (this.markChipG) this.drawMarkChip(this.markChipX, this.markChipY, 60, 30);
    if (this.bellChipG) this.drawBellChip(this.bellChipX, this.bellChipY, 60, 30);
    if (this.heatChipG) this.drawHeatChip(this.heatChipX, this.heatChipY, 60, 30);
```

- [ ] **Step 5: 標記互動改為「線索格＝靜音、其餘＝三態循環」**

在 `onPointerUp` 中，把標記分支——原本：

```ts
    const wantMark = (p.event as MouseEvent).shiftKey || this.markMode || held >= 350;
    if (wantMark) {
      cycleMarkAt(s, cellPos);
      this.redraw();
      return;
    }
```

改為：

```ts
    const wantMark = (p.event as MouseEvent).shiftKey || this.markMode || held >= 350;
    if (wantMark) {
      // 已判讀的線索格：標記手勢改為切換該線索的靜音（在該格上做標記本來就沒有意義，
      // 而「暫時拿掉這條線索看看」是玩家最需要的假說檢驗動作——診斷 B-03）
      const ck = key(cellPos);
      const clueIndex = s.level.clues.findIndex((c) => key(c.position) === ck);
      if (clueIndex >= 0 && s.readClues.has(ck)) {
        toggleMute(s, clueIndex);
        this.audio.play('click');
      } else {
        cycleMarkAt(s, cellPos);
      }
      this.redraw();
      return;
    }
```

- [ ] **Step 6: 熱區與三態標記的繪製**

在 `redraw()` 中，於 `this.g.clear();` 之後、`L.supplies.forEach` 之前插入熱區繪製：

```ts
    // 候選熱區（診斷 B-01）：每格依「符合幾條未靜音的已判讀線索」上金色淡底，
    // 熱度以最大值正規化。玩家可用 HUD 的「圖層」chip 關閉。
    this.heatG.clear();
    if (this.heatOn) {
      const heat = heatMap(unmutedReadClues(L, s.readLog, s.mutedClues), L.mapSize);
      const peak = maxHeat(heat);
      if (peak > 0) {
        for (const [hk, n] of heat) {
          const [hx, hy] = hk.split(',').map(Number);
          this.heatG.fillStyle(pal.gold, 0.06 + 0.16 * (n / peak))
            .fillRect(this.ox + hx * cs, this.oy + hy * cs, cs, cs);
        }
      }
    }
```

把標記繪製迴圈（Task 3 暫時改成 `for (const [m] of s.marks)` 的那段）整段換成三態版本：

```ts
    // 三態標記：排除＝紅 ✕、存疑＝黃 ?、押注＝金色雙環（押注全場唯一）
    for (const [m, kind] of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      const r = cs * 0.32;
      if (kind === 'exclude') {
        this.g.lineStyle(3, pal.mark, 0.9);
        this.g.lineBetween(p.x - r, p.y - r, p.x + r, p.y + r);
        this.g.lineBetween(p.x + r, p.y - r, p.x - r, p.y + r);
      } else if (kind === 'suspect') {
        this.g.lineStyle(2.4, pal.supply, 0.9);
        this.g.strokeCircle(p.x, p.y, r * 0.85);
        this.g.lineBetween(p.x, p.y - r * 0.3, p.x, p.y + r * 0.2);
        this.g.fillStyle(pal.supply, 0.9).fillCircle(p.x, p.y + r * 0.5, 1.6);
      } else {
        this.g.lineStyle(2.6, pal.gold, 1).strokeCircle(p.x, p.y, r);
        this.g.lineStyle(1.4, pal.gold, 0.7).strokeCircle(p.x, p.y, r * 0.55);
        this.g.fillStyle(pal.gold, 1).fillCircle(p.x, p.y, r * 0.2);
      }
    }
```

- [ ] **Step 7: 靜音線索的視覺回饋**

在 `redraw()` 的線索 token 迴圈中，把——原本：

```ts
    for (const c of L.clues) {
      const p = px(c.position);
      const r = Math.max(8, cs * 0.34);
      drawClueToken(this.g, p.x, p.y, r, c.type, pal);
      if (s.readClues.has(key(c.position))) this.drawReadCheck(p.x, p.y, r);
    }
```

改為：

```ts
    L.clues.forEach((c, i) => {
      const p = px(c.position);
      const r = Math.max(8, cs * 0.34);
      drawClueToken(this.g, p.x, p.y, r, c.type, pal);
      if (s.readClues.has(key(c.position))) this.drawReadCheck(p.x, p.y, r);
      // 靜音線索：疊一道斜槓，與 ♪ chip 的靜音語彙一致
      if (s.mutedClues.has(i)) {
        this.g.lineStyle(2, pal.paperDim, 0.95);
        this.g.lineBetween(p.x - r, p.y + r, p.x + r, p.y - r);
      }
    });
```

同時把上方的線索覆蓋層迴圈改為跳過靜音者——原本：

```ts
    for (const c of L.clues) {
      if (s.readClues.has(key(c.position))) this.drawClueOverlay(c, px);
    }
```

改為：

```ts
    L.clues.forEach((c, i) => {
      if (s.readClues.has(key(c.position)) && !s.mutedClues.has(i)) this.drawClueOverlay(c, px);
    });
```

- [ ] **Step 8: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。

- [ ] **Step 9: 人工冒煙**

Run: `npm run dev`。第一局中：
1. Shift+點擊同一空格三次 → 依序看到紅 ✕、黃 ?、金色雙環；第四次消失。
2. 押注一格後再押注另一格 → 前一個金環消失（唯一性）。
3. 走上一個線索、Shift+點擊該線索格 → token 出現斜槓，該線索的虛線覆蓋層與熱區貢獻同時消失。
4. 點 HUD「圖層」chip → 金色淡底整片消失／恢復。

Expected: 四項皆如描述。

- [ ] **Step 10: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat: heat layer, three-state marks and clue muting on the map"
```

---

### Task 9: RevealScene 揭曉場景

不論成敗，一律先揭曉再結算（診斷 D-01）。獨立場景，避免擠進已有大量座標夾限註解的 `ResultScene`。

**Files:**
- Create: `src/scenes/RevealScene.ts`

**Interfaces:**
- Consumes: `SessionState` from registry `'session'`；`wagerKey`, `parseKey` from `src/core/marks`；`infoCompleteStep`, `misleadingDecoy` from `src/core/deduction`；`getPalette`；`fadeIn`, `fadeToScene`, `restartOnResize` from `./fx`；`cssHex`, `FONTS`, `displayFont`, `BRUSH_RADIUS`, `stripBrackets` from `./paint`
- Produces: `export class RevealScene extends Phaser.Scene`，scene key `'Reveal'`，結束時 `fadeToScene(this, 'Result')`

- [ ] **Step 1: 建立場景檔**

Create `src/scenes/RevealScene.ts`:

```ts
import Phaser from 'phaser';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { wagerKey, parseKey } from '../core/marks';
import { infoCompleteStep, misleadingDecoy } from '../core/deduction';
import { cheb, type Vec2 } from '../core/geometry';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';
import type { AudioBus } from '../core/audio';
import { cssHex, FONTS, displayFont, BRUSH_RADIUS, stripBrackets } from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';

// 揭曉畫面（診斷 D-01）：不論成敗都在結算前先看見真相——牠在哪、你差幾格、
// 哪條假蹤跡騙了你、資訊在第幾步就已完備。失敗不再只是「牠溜進霧裡了」。
export class RevealScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;

  constructor() {
    super('Reveal');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const i18n: I18n = this.registry.get('i18n');
    this.audio = this.registry.get('audio');
    this.audio.ambient(false); // 揭曉畫面停風聲，與結算一致
    this.pal = getPalette(s.round);
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);

    this.add.text(cx, 54, i18n.t('reveal.title'), {
      fontFamily: displayFont(i18n.locale()), fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(2);

    // 小地圖：夾在標題與文字區之間，正方形，最大 300px
    const mapTop = 92;
    const mapMax = Math.min(300, w - 48, h - 340);
    const size = s.level.mapSize;
    const cell = Math.max(4, Math.floor(mapMax / size));
    const span = cell * size;
    const ox = Math.floor(cx - span / 2);
    const oy = mapTop;
    this.drawMinimap(s, ox, oy, cell);

    // 文字區：距離、假蹤跡、資訊完備步數，三行由上而下堆疊（缺項自動不佔位）
    const wk = wagerKey(s.marks);
    const wager: Vec2 | null = wk === null ? null : parseKey(wk);
    let ty = oy + span + 30;

    if (wager === null) {
      ty = this.line(cx, ty, i18n.t('reveal.noCall'), pal.paperDim, 14);
    } else {
      const off = cheb(wager, s.level.targetPos);
      const msg = off === 0 ? i18n.t('reveal.exact') : i18n.t('reveal.offBy', { n: off });
      ty = this.line(cx, ty, msg, off === 0 ? pal.gold : pal.paper, 17);
    }

    const decoy = misleadingDecoy(s.level, s.readLog, wager);
    if (decoy) ty = this.line(cx, ty, i18n.t('reveal.decoy'), pal.mark, 14);

    const infoStep = infoCompleteStep(s.level, s.readLog);
    if (infoStep !== null && s.steps > infoStep) {
      ty = this.line(cx, ty, i18n.t('reveal.infoAt', { n: infoStep, m: s.steps }), pal.paperDim, 13);
    }

    // 圖例：牠在這裡／你的押注
    const legendY = Math.min(ty + 14, h - 108);
    this.legend(cx - 78, legendY, i18n.t('reveal.wasHere'), pal.gold, true);
    if (wager) this.legend(cx + 62, legendY, i18n.t('reveal.yourCall'), pal.paper, false);

    this.button(cx, h - 52, 250, 50, stripBrackets(i18n.t('btn.continue')),
      () => fadeToScene(this, 'Result'));
  }

  // 小地圖：地形底色 → 玩家路徑 → 已判讀線索（幌子在此才揭穿）→ 押注格 → 真實位置
  private drawMinimap(s: SessionState, ox: number, oy: number, cell: number) {
    const pal = this.pal;
    const L = s.level;
    const g = this.add.graphics();
    const px = (v: Vec2) => ({ x: ox + v.x * cell + cell / 2, y: oy + v.y * cell + cell / 2 });

    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        g.fillStyle(pal.terrain[L.terrain[y][x]], 1).fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    g.lineStyle(1, pal.paperDim, 0.25).strokeRect(ox, oy, cell * L.mapSize, cell * L.mapSize);

    // 玩家路徑：連續折線，讓玩家看見自己繞了多遠
    if (s.path.length > 1) {
      g.lineStyle(Math.max(1.2, cell * 0.16), pal.paper, 0.4);
      for (let i = 1; i < s.path.length; i++) {
        const a = px(s.path[i - 1]);
        const b = px(s.path[i]);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // 已判讀的線索：真線索金點、幌子紅點——真假在此刻才第一次公開（診斷 B-03 的學習迴圈）
    L.clues.forEach((c, i) => {
      if (!s.readLog.some((e) => e.clueIndex === i)) return;
      const p = px(c.position);
      g.fillStyle(c.isDecoy ? pal.mark : pal.gold, 0.9).fillCircle(p.x, p.y, Math.max(2, cell * 0.26));
    });

    // 玩家押注格：紙墨白空心方框
    const wk = wagerKey(s.marks);
    if (wk !== null) {
      const wp = parseKey(wk);
      g.lineStyle(2, pal.paper, 0.95)
        .strokeRect(ox + wp.x * cell, oy + wp.y * cell, cell, cell);
    }

    // 真實位置：生物色實心點＋金色脈動環
    const creature = CREATURES.find((c) => c.id === L.creatureId)!;
    const t = px(L.targetPos);
    g.fillStyle(creature.color, 1).fillCircle(t.x, t.y, Math.max(3, cell * 0.34));
    const ring = this.add.graphics();
    ring.lineStyle(2, pal.gold, 1).strokeCircle(t.x, t.y, Math.max(6, cell * 0.7));
    this.tweens.add({
      targets: ring, alpha: { from: 1, to: 0.25 },
      duration: 900, yoyo: true, repeat: -1,
    });
  }

  // 單行置中文字，回傳下一行的 y（行距隨字級調整）
  private line(cx: number, y: number, text: string, color: number, fontSize: number): number {
    const t = this.add.text(cx, y, text, {
      fontFamily: FONTS.body, fontSize: `${fontSize}px`, color: cssHex(color),
      wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    return y + t.height + 10;
  }

  // 圖例項：小色點＋標籤
  private legend(x: number, y: number, label: string, color: number, filled: boolean) {
    const g = this.add.graphics();
    if (filled) g.fillStyle(color, 1).fillCircle(x, y, 5);
    else g.lineStyle(1.8, color, 0.95).strokeRect(x - 5, y - 5, 10, 10);
    this.add.text(x + 12, y, label, {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(this.pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1);
  }

  // 按鈕：與 ResultScene 同款描邊樣式（hover 增亮、按下內縮）
  private button(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65)
        .strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); this.audio.unlock(); this.audio.play('click'); onClick(); });
  }
}
```

- [ ] **Step 2: 建置驗證**

Run: `npm run build`
Expected: 無 TypeScript 錯誤。（此時場景尚未註冊，不會被執行——Task 10 才接線。）

- [ ] **Step 3: Commit**

```bash
git add src/scenes/RevealScene.ts
git commit -m "feat: RevealScene showing the true position, your call and the lying trail"
```

---

### Task 10: 把揭曉接進遊戲流程

`Qte → Result` 與 `Map(exhausted) → Result` 兩條路徑改為先經 `Reveal`。

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scenes/QteScene.ts`
- Modify: `src/scenes/MapScene.ts`（`afterMove()`）

**Interfaces:**
- Consumes: `RevealScene`（Task 9）
- Produces: 場景清單新增 `'Reveal'`

- [ ] **Step 1: 註冊場景**

在 `src/main.ts` 的 import 區塊，於 `import { ResultScene } from './scenes/ResultScene';` 之後追加：

```ts
import { RevealScene } from './scenes/RevealScene';
```

把 scene 陣列：

```ts
    scene: [BootScene, CampScene, MapScene, QteScene, ResultScene, CodexScene, HelpScene],
```

改為：

```ts
    scene: [BootScene, CampScene, MapScene, QteScene, RevealScene, ResultScene, CodexScene, HelpScene],
```

- [ ] **Step 2: QTE 結束後改進揭曉**

在 `src/scenes/QteScene.ts` 的 `playEnding()`，把：

```ts
    this.time.delayedCall(900, () => fadeToScene(this, 'Result'));
```

改為：

```ts
    this.time.delayedCall(900, () => fadeToScene(this, 'Reveal'));
```

- [ ] **Step 3: 力竭後改進揭曉**

在 `src/scenes/MapScene.ts` 的 `afterMove()`，把：

```ts
    } else if (s.phase === 'exhausted') {
      fadeToScene(this, 'Result'); // 中途力竭不寫旗標：下次 round1 仍會重新引導
    }
```

改為：

```ts
    } else if (s.phase === 'exhausted') {
      // 力竭也一律先揭曉再結算（診斷 D-01）；不寫教學旗標：下次 round1 仍會重新引導
      fadeToScene(this, 'Reveal');
    }
```

- [ ] **Step 4: 建置與全量測試**

Run: `npm run test && npm run build`
Expected: 全綠、建置無錯。

- [ ] **Step 5: 人工冒煙——三條路徑各走一次**

Run: `npm run dev`

1. **成功**：押注一格 → 走到目標 → QTE 命中 → 應看到揭曉（真實位置脈動、押注框、距離文字）→ 點「繼續」→ 結算顯示的品質與你的押注精準度相符（正中＝金）。
2. **QTE 失手**：故意亂按 → 揭曉照常出現，顯示真實位置與「你差了 N 格」。
3. **力竭**：把體力走光 → 揭曉照常出現。
4. **假蹤跡**：進第 4 局以後，故意押注在幌子線索指向的區域 → 揭曉出現紅色「這條假蹤跡把你帶偏了」，小地圖上該線索為紅點。

Expected: 四條路徑皆正確；矮視窗（把瀏覽器高度拉到 700 以下）時小地圖與按鈕不重疊。

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/scenes/QteScene.ts src/scenes/MapScene.ts
git commit -m "feat: route every hunt outcome through the reveal before the result"
```

---

### Task 11: 說明更新、架構筆記同步與全量驗證

Phase 4 收尾。新機制必須進玩法說明，新 registry／流程變更必須進架構筆記——後者是專案明文規定的維護規則，不得延後。

**Files:**
- Modify: `src/scenes/HelpScene.ts`（面板高度 636→680、`rows` 陣列 9 列→10 列）
- Modify: `src/core/i18n.ts`（移除 `help.mark`、`help.terrain`）
- Modify: `docs/ARCHITECTURE-NOTES.md`

**Interfaces:**
- Consumes: Task 7 的 `help.marks`、`help.layer`、`help.reveal`、改寫後的 `help.stamina`
- Removes: `MsgKey` 的 `'help.mark'` 與 `'help.terrain'`

- [ ] **Step 1: 擴大說明面板高度**

`HelpScene` 的說明列是寫死 y 座標的固定版面預算：列起於 `py0 + 178`、列距 44px、
目前 9 列（末列 `py0 + 530`），末列與開始按鈕上緣（`py0 + ph - 56 - 24`）保有 26px 間距。
本階段要換掉 1 列、移除 1 列、新增 2 列，淨增 1 列，必須先把面板加高 44px。

在 `src/scenes/HelpScene.ts` 把：

```ts
    const ph = 636;
```

改為：

```ts
    // 10 列版面預算（Phase 4）：列距維持 44px，末列 y=py0+574，
    // 開始按鈕上緣＝py0+ph-56-24=py0+600，間距 26px（與 9 列版相同的淨空）。
    // 面板底緣 py0+ph = 78+680 = 758，仍在規格書 §11.1 的 720×780 embed 視窗內。
    const ph = 680;
```

> **已知限制（不在本階段修）：** 面板高度是固定值，視窗高度低於 758px 時底部會被裁切。
> 這在改動前（714px）就已存在，本次讓門檻上升 44px。Phase 5 若再增加說明列，
> 應比照 `CodexScene` 把說明列表改為可捲動，而不是繼續加高面板。

- [ ] **Step 2: 三處列面手術**

在同檔的 `rows` 陣列中：

**(a) 移除 `help.terrain` 整列**（文案已於 Task 7 併入 `help.stamina`）——刪掉這一整個物件：

```ts
      {
        y: py0 + 486, key: 'help.terrain',
        icon: (y) => {
          const order: TerrainType[] = ['meadow', 'mist', 'thicket', 'rock'];
          const sq = 6;
          const gap = 2;
          const totalW = order.length * sq + (order.length - 1) * gap;
          let x = rowX - totalW / 2;
          for (const t of order) {
            icons.fillStyle(pal.terrain[t], 1).fillRect(x, y - sq / 2, sq, sq);
            x += sq + gap;
          }
        },
      },
```

刪除後 `TerrainType` 若已無其他使用處，一併移除該檔頂端的 `import type { TerrainType } from '../core/types';`。
確認方式：`grep -n "TerrainType" src/scenes/HelpScene.ts`。

**(b) 把 `help.mark` 那一列換成三態版 `help.marks`**——原本：

```ts
      {
        y: py0 + 398, key: 'help.mark',
        icon: (y) => {
          icons.lineStyle(3, pal.mark, 0.9);
          icons.lineBetween(rowX - 9, y - 9, rowX + 9, y + 9);
          icons.lineBetween(rowX + 9, y - 9, rowX - 9, y + 9);
        },
      },
```

改為（三個小圖示並排，對應排除／存疑／押注，與 MapScene 的畫法同語彙）：

```ts
      {
        y: py0 + 398, key: 'help.marks',
        icon: (y) => {
          // 排除：紅 ✕
          icons.lineStyle(2.4, pal.mark, 0.9);
          icons.lineBetween(rowX - 20, y - 7, rowX - 8, y + 7);
          icons.lineBetween(rowX - 8, y - 7, rowX - 20, y + 7);
          // 存疑：黃圈＋點
          icons.lineStyle(2, pal.supply, 0.9).strokeCircle(rowX, y - 1, 6);
          icons.fillStyle(pal.supply, 0.9).fillCircle(rowX, y + 8, 1.6);
          // 押注：金色雙環
          icons.lineStyle(2.2, pal.gold, 1).strokeCircle(rowX + 18, y, 8);
          icons.fillStyle(pal.gold, 1).fillCircle(rowX + 18, y, 2.4);
        },
      },
```

**(c) 追加兩列，並把 `help.weather` 下移一格**——把原本的第 9 列（`help.weather`，`y: py0 + 530`）
的 `y` 改為 `py0 + 574`，然後在它**之前**插入兩個新列：

```ts
      {
        y: py0 + 486, key: 'help.layer',
        icon: (y) => {
          // 三格由淡到濃的金色方塊，對應熱區的熱度分級
          const sq = 9;
          const gap = 3;
          let x = rowX - (sq * 3 + gap * 2) / 2;
          for (const a of [0.12, 0.24, 0.38]) {
            icons.fillStyle(pal.gold, a).fillRect(x, y - sq / 2, sq, sq);
            x += sq + gap;
          }
          icons.lineStyle(1, pal.gold, 0.5).strokeRect(rowX - 16.5, y - sq / 2, sq * 3 + gap * 2, sq);
        },
      },
      {
        y: py0 + 530, key: 'help.reveal',
        icon: (y) => {
          // 揭曉：生物色實心點＋金色脈動環的靜態版（同 RevealScene 的真實位置圖示）
          icons.fillStyle(pal.glow, 1).fillCircle(rowX, y, 4);
          icons.lineStyle(2, pal.gold, 1).strokeCircle(rowX, y, 10);
        },
      },
```

改完之後 `rows` 應為 10 列，y 依序為 `py0 +` 178 / 222 / 266 / 310 / 354 / 398 / 442 / 486 / 530 / 574。

- [ ] **Step 3: 移除已無人使用的舊鍵**

Run: `grep -rn "'help.mark'\|'help.terrain'" src/`
Expected: 無輸出（若仍有輸出，回頭把 Step 2 改完）。

確認無輸出後，在 `src/core/i18n.ts` 的 `MsgKey` 聯集中刪除 `'help.mark'` 與 `'help.terrain'`
（注意 `'help.marks'` 要保留），並刪除兩份 `STRINGS` 中對應的那兩行。

Run: `npx vitest run tests/i18n.test.ts`
Expected: PASS（`en and zh-TW cover exactly the same keys` 仍綠）。

Run: `npm run build`
Expected: `tsc --noEmit` 無錯——若有 `Type '"help.mark"' is not assignable` 之類的殘留錯誤，
表示還有地方引用舊鍵，依錯誤位置補改。

- [ ] **Step 4: 更新架構筆記**

在 `docs/ARCHITECTURE-NOTES.md` 的「2. registry 鍵」表格中，把 `qteOutcome` 那一列的「誰讀取」欄位改為：

```
（Phase 4 起無讀者）——品質改由判讀精準度計算，`ResultScene` 不再讀取本鍵。`QteScene` 仍寫入，供 Phase 7 移除 QTE 時一併清理。
```

並在同表的 `session` 那一列的「誰讀取」欄位補上 `RevealScene`。

在該表之後新增一小節，記錄本階段的流程變更：

```markdown
### Phase 4 流程變更：揭曉插入結算之前

`Qte → Result` 與 `Map(exhausted) → Result` 兩條路徑，自 Phase 4 起一律先經
`RevealScene`（scene key `'Reveal'`）。`RevealScene` 為純呈現場景：只讀 registry 的
`session` / `i18n` / `audio`，**不做任何記帳**——`SessionState.resolved` 的記帳仍
完全由 `ResultScene` 負責，因此揭曉畫面被 resize 重啟不會造成重複記錄。
```

- [ ] **Step 5: 全量驗證**

Run: `npm run test`
Expected: 所有測試檔 PASS（含新增的 `marks.test.ts`、`deduction.test.ts`）。

Run: `npm run build`
Expected: `tsc --noEmit` 無錯，`vite build` 產出 `dist/`。

Run: `node -e "const s=require('fs').statSync('dist/assets');console.log('dist ok')"`
Expected: `dist ok`（確認建置產物存在；體積門檻 8MB 目前遠未逼近）。

- [ ] **Step 6: 完整迴圈人工驗收（雙語各一輪）**

Run: `npm run dev`

依 `docs/Ridge_Hunters_Trail_Game_Design_Spec.md` §11.1 的上傳前檢查清單，**英文與繁中各走一輪**完整迴圈（營地 → 地圖 → 判讀工具 → QTE → 揭曉 → 結算 → 圖鑑），確認：
- 三態標記、圖層 chip、線索靜音在兩種語系下文字皆正確且不溢出 chip。
- 揭曉畫面三行文字在兩種語系下皆不超出 420px 換行寬度。
- 說明頁（`?`）新增的三條說明在兩種語系下皆可讀完、不被裁切。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/HelpScene.ts src/core/i18n.ts docs/ARCHITECTURE-NOTES.md
git commit -m "docs: help entries and architecture notes for the Phase 4 deduction tools"
```

---

## 自我檢查結果

**規格覆蓋**（對照 `docs/superpowers/specs/2026-09-02-boredom-remediation-roadmap-design.md` §3 Phase 4）：

| 規格項目 | 實作任務 |
|---|---|
| 三態標記（排除／存疑／押注，押注唯一） | Task 2（模型）、Task 3（session）、Task 8（渲染與互動） |
| 候選熱區圖層（可開關） | Task 4（計算）、Task 8（圖層與 chip） |
| 線索靜音 | Task 3（`toggleMute`）、Task 4（`unmutedReadClues`）、Task 8（互動與斜槓） |
| 判讀精準度成為評分軸、`qualityFromQte` 移除 | Task 6 |
| 全揭曉（真實位置／路徑／押注距離／誤導幌子／資訊完備步數） | Task 5（分析）、Task 9（場景）、Task 10（接線） |
| A-07 八方向鍵盤 | Task 1 |
| 玩法說明涵蓋新機制（全域約束：面向玩家字串走 i18n） | Task 7（字串）、Task 11（版面） |
| 架構筆記同步（全域約束） | Task 11 |

**未涵蓋且為刻意**：Phase 4 不動 `generate.ts`、不動地形、不動獵物、不動 QTE 的成敗判定——這些分別屬於 Phase 5、6、7，見路線圖 §1 的相依圖。

**型別一致性**：`MarkKind`／`MarkMap`（Task 2）→ `SessionState.marks`（Task 3）→ `wagerKey`／`parseKey`（Task 6、9）；`ClueRead`（Task 3）→ `unmutedReadClues`／`infoCompleteStep`／`misleadingDecoy`（Task 4、5）→ `RevealScene`（Task 9）。函式名全程一致，無同義異名。

**已知的循環匯入風險**：`deduction.ts` 匯入 `session.ts` 的 `ClueRead` 型別，而 `session.ts` 不匯入 `deduction.ts`——單向，安全。若日後 `session.ts` 需要 `deduction` 的函式，應把 `ClueRead` 上移到 `types.ts`。
