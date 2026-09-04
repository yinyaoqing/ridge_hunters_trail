# 教學全機制覆蓋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把遊戲中 25+ 項機制全部補進教學——首見提示教一次性事件、說明頁當字典、示範課教推理。

**Architecture:** 三層分工，各有一個擴充點。新增 `src/core/coach.ts` 管理「首見旗標」，各場景以一行 `coachOnce(...)` 掛點；`HelpScene` 的圖例列由 flat array 改為分組；`demo.ts` 的單一腳本泛化為 `DemoScript`，再加一份教「會走的獵物」的第二課。

**Tech Stack:** TypeScript 5.6 · Phaser 3.90 · Vite 6 · Vitest 3

**Spec:** `docs/superpowers/specs/2026-09-04-tutorial-full-coverage-design.md`

## Global Constraints

- **不新增任何執行期相依。** `package.json` 的 `dependencies` 只有 `phaser`，本計畫全程不動它。
- **所有玩家可見文字一律走 i18n**，不得在場景裡硬寫字面字串。
- **每個新 i18n key 必須同時補 `en` 與 `zh-TW`。** `tests/i18n.test.ts` 斷言兩表鍵集合完全相同且無空字串——漏一邊就會紅。
- **`MsgKey` 是顯式聯集型別**（`src/core/i18n.ts` 開頭）。新增字串必須同時在聯集裡加上該 key，否則 `tsc --noEmit` 會擋。
- **storage 存取一律包 try/catch，失敗靜默退回記憶體備援。** 見 `src/core/tools.ts` 的 `load`／`save`。不得讓 storage 例外冒到場景層。
- **世界觀邊界：全架空山域、無傷害、無戰鬥**（設計規格書 §2）。文案不得出現獵殺、傷害、武器。
- **場景層測不到。** `vite.config.ts` 設 `test: { environment: 'node' }`，Phaser 場景無法在測試中實例化。任何值得測的邏輯都要抽到 `src/core/` 的純函式。
- **既有 36 支測試檔不得改動語意。** 只允許改 import 路徑／常數名稱（Task 8）。任何一條斷言的期望值需要改動，都是改壞了行為的訊號，停下來回報。
- **每個 Task 結束前必須跑過** `npm test`（全綠）與 `npm run build`（含 `tsc --noEmit`，無錯）。
- **既有旗標 `rht.tut.v1`／`rht.help.v1` 不得改名、不得升版。** 舊存檔玩家不重跑第 1 局引導。

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `src/core/coach.ts` | 建立 | 首見旗標的唯一來源：`CoachId`、`CoachStore`、`createCoach`、`coachOnce` |
| `tests/coach.test.ts` | 建立 | 旗標讀寫、冪等、storage 失效、損毀 JSON、reset |
| `src/core/i18n.ts` | 修改 | `MsgKey` 聯集 ＋ en／zh-TW 兩表新字串（約 44 對） |
| `src/main.ts` | 修改 | `preBoot` 建立 coach 放進 registry |
| `src/core/deduction.ts` | 修改 | 新增純函式 `distinctReadAges`（供 `age.second` 觸發判斷） |
| `src/scenes/MapScene.ts` | 修改 | JIT 掛點：三則隨機事件、補給、齡別、道具 |
| `src/scenes/ResultScene.ts` | 修改 | JIT 掛點：Bank/Push、iris、路線、品質門檻、infoAt（走 `flowY`） |
| `src/scenes/HelpScene.ts` | 修改 | 圖例列 flat → 分組 ＋ 新列 ＋ 兩顆示範入口 |
| `src/core/demo.ts` | 修改 | 泛化為 `DemoScript`；`DEDUCTION_SCRIPT` ＋ `QUARRY_SCRIPT` |
| `src/scenes/DemoScene.ts` | 修改 | `init({ scriptId, from })` 選腳本；支援 `heatAge` 與 `pick-age` |
| `tests/demo.test.ts` | 修改 | 常數引用改為 `DEDUCTION_SCRIPT.*`（語意不變） |
| `tests/demo-quarry.test.ts` | 建立 | 第二課的四條資料性質 |
| `tests/deduction.test.ts` | 修改 | 新增 `distinctReadAges` 的測試 |
| `src/scenes/CampScene.ts` | 修改 | JIT 掛點：委託、每日挑戰 |
| `src/scenes/CodexScene.ts` | 修改 | JIT 掛點：研究點 |

---

# Phase 1 — 首見提示基礎設施與局內／結算掛點

## Task 1: `coach.ts` 首見旗標

**Files:**
- Create: `src/core/coach.ts`
- Create: `tests/coach.test.ts`
- Modify: `src/main.ts:40-59`（`preBoot` callback）

**Interfaces:**
- Consumes: 無（本專案第一個 task）
- Produces:
  - `type CoachId`（15 個字面聯集，見 Step 3）
  - `interface CoachStore { seen(id: CoachId): boolean; markSeen(id: CoachId): void; reset(): void }`
  - `function createCoach(storage?: Pick<Storage, 'getItem' | 'setItem'>): CoachStore`
  - `function coachOnce(coach: CoachStore, id: CoachId, show: () => void): boolean`
  - registry 鍵 `'coach'`，型別 `CoachStore`

- [ ] **Step 1: 寫失敗的測試**

建立 `tests/coach.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { createCoach, coachOnce } from '../src/core/coach';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

function throwingStorage() {
  return {
    getItem: (): string | null => { throw new Error('denied'); },
    setItem: (): void => { throw new Error('denied'); },
  };
}

describe('createCoach', () => {
  it('starts with nothing seen', () => {
    const coach = createCoach(fakeStorage());
    expect(coach.seen('supply')).toBe(false);
    expect(coach.seen('bankpush')).toBe(false);
  });

  it('remembers what was marked seen', () => {
    const coach = createCoach(fakeStorage());
    coach.markSeen('supply');
    expect(coach.seen('supply')).toBe(true);
    expect(coach.seen('bankpush')).toBe(false);
  });

  it('markSeen is idempotent', () => {
    const store = fakeStorage();
    const coach = createCoach(store);
    coach.markSeen('supply');
    const after1 = JSON.stringify(store.dump());
    coach.markSeen('supply');
    expect(JSON.stringify(store.dump())).toBe(after1);
    expect(coach.seen('supply')).toBe(true);
  });

  it('persists through a fresh store over the same storage', () => {
    const store = fakeStorage();
    createCoach(store).markSeen('iris');
    expect(createCoach(store).seen('iris')).toBe(true);
  });

  it('reset clears every flag', () => {
    const coach = createCoach(fakeStorage());
    coach.markSeen('iris');
    coach.markSeen('supply');
    coach.reset();
    expect(coach.seen('iris')).toBe(false);
    expect(coach.seen('supply')).toBe(false);
  });

  it('falls back to memory when storage throws', () => {
    const coach = createCoach(throwingStorage());
    expect(coach.seen('supply')).toBe(false);
    expect(() => coach.markSeen('supply')).not.toThrow();
    expect(coach.seen('supply')).toBe(true);
  });

  it('falls back to defaults on corrupt JSON', () => {
    const coach = createCoach(fakeStorage({ 'rht.seen.v1': '{not json' }));
    expect(coach.seen('supply')).toBe(false);
  });

  it('falls back to defaults when the stored value is not an object', () => {
    const coach = createCoach(fakeStorage({ 'rht.seen.v1': '42' }));
    expect(coach.seen('supply')).toBe(false);
  });

  it('works with no storage at all', () => {
    const coach = createCoach();
    coach.markSeen('daily');
    expect(coach.seen('daily')).toBe(true);
  });
});

describe('coachOnce', () => {
  it('runs show and marks seen the first time', () => {
    const coach = createCoach(fakeStorage());
    let calls = 0;
    expect(coachOnce(coach, 'supply', () => { calls++; })).toBe(true);
    expect(calls).toBe(1);
    expect(coach.seen('supply')).toBe(true);
  });

  it('does nothing on later calls', () => {
    const coach = createCoach(fakeStorage());
    let calls = 0;
    coachOnce(coach, 'supply', () => { calls++; });
    expect(coachOnce(coach, 'supply', () => { calls++; })).toBe(false);
    expect(calls).toBe(1);
  });

  it('keeps ids independent', () => {
    const coach = createCoach(fakeStorage());
    coachOnce(coach, 'supply', () => {});
    let shown = false;
    expect(coachOnce(coach, 'iris', () => { shown = true; })).toBe(true);
    expect(shown).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認它失敗**

Run: `npx vitest run tests/coach.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/coach"`

- [ ] **Step 3: 寫實作**

建立 `src/core/coach.ts`：

```ts
// 首見旗標：每一則教學提示只在玩家第一次遇到該機制時出現一次。
// 刻意不與 rht.tut.v1／rht.help.v1 共用旗標——那兩把是「第 1 局引導」與
// 「說明頁彈過了」，語意是進度；這裡的每一把都對應一個具體機制，語意是「教過了」。
// 舊存檔玩家因此會照常看到新提示，而不會被拉回重跑第 1 局引導。
export type CoachId =
  | 'event.startle' | 'event.supply' | 'event.oldtrail'
  | 'supply' | 'bankpush' | 'iris'
  | 'tool.windstone' | 'tool.glowbell'
  | 'age.second' | 'reveal.route' | 'reveal.infoAt' | 'quality'
  | 'codex' | 'commission' | 'daily';

export interface CoachStore {
  seen(id: CoachId): boolean;
  markSeen(id: CoachId): void;
  reset(): void;
}

const KEY = 'rht.seen.v1';
type Data = Partial<Record<CoachId, true>>;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function createCoach(storage?: Store): CoachStore {
  // 記憶體備援：storage 缺席或讀寫拋例外時，本局仍然只教一次（重新載入才會再教）。
  // 比照 tools.ts 的慣例——寧可少記一次，也不讓 storage 例外冒到場景層。
  let mem: Data = {};

  const load = (): Data => {
    if (!storage) return mem;
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return mem;
    }
    if (raw === null) return {};
    try {
      const p: unknown = JSON.parse(raw);
      // typeof null === 'object'，且陣列也是 object——兩者都不是我們寫出去的形狀
      return p !== null && typeof p === 'object' && !Array.isArray(p) ? (p as Data) : {};
    } catch {
      return {};
    }
  };

  const save = (d: Data): void => {
    mem = d;
    if (!storage) return;
    try {
      storage.setItem(KEY, JSON.stringify(d));
    } catch {
      // 靜默退回記憶體
    }
  };

  return {
    seen: (id) => load()[id] === true,
    markSeen(id) {
      const data = load();
      if (data[id] === true) return; // 冪等：已見過就不重寫，storage 不必要地被動到
      data[id] = true;
      save(data);
    },
    reset() {
      save({});
    },
  };
}

// 首見提示的唯一呼叫形狀。各場景的掛點一律是一行，不各自寫 if (!coach.seen(...))。
// 回傳是否真的顯示了——呼叫端若要在同一幀決定「還要不要顯示第二則」會用到。
export function coachOnce(coach: CoachStore, id: CoachId, show: () => void): boolean {
  if (coach.seen(id)) return false;
  coach.markSeen(id);
  show();
  return true;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/coach.test.ts`
Expected: PASS — 12 passed

- [ ] **Step 5: 接進 registry**

在 `src/main.ts` 加 import（放在 `createScoreStore` 那行之後）：

```ts
import { createCoach } from './core/coach';
```

在 `preBoot` 內 `game.registry.set('score', createScoreStore(storage));` 之後加一行：

```ts
        game.registry.set('coach', createCoach(storage));
```

- [ ] **Step 6: 跑完整驗證**

Run: `npm test && npm run build`
Expected: 全部測試通過；build 無 TypeScript 錯誤

- [ ] **Step 7: Commit**

```bash
git add src/core/coach.ts tests/coach.test.ts src/main.ts
git commit -m "feat: track which mechanics the player has already been taught

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `distinctReadAges` 純函式

齡別提示要在「玩家讀到第二種齡別的線索」時觸發。這個判斷屬於推理邏輯、不屬於場景，抽成純函式才測得到（場景層在本專案測不到）。

**Files:**
- Modify: `src/core/deduction.ts`（檔尾附加）
- Modify: `tests/deduction.test.ts`（檔尾附加）

**Interfaces:**
- Consumes: `Level`、`ClueRead`（已存在於 `src/core/types.ts` 與 `src/core/session.ts`）
- Produces: `function distinctReadAges(level: Level, readLog: ClueRead[]): number`

- [ ] **Step 1: 寫失敗的測試**

在 `tests/deduction.test.ts` 檔尾附加（同檔既有 import 若尚未含 `distinctReadAges`，補進去）：

```ts
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
```

- [ ] **Step 2: 跑測試確認它失敗**

Run: `npx vitest run tests/deduction.test.ts`
Expected: FAIL — `distinctReadAges is not defined`

- [ ] **Step 3: 寫實作**

在 `src/core/deduction.ts` 檔尾附加：

```ts
// 玩家讀到的線索橫跨幾種齡別。齡別教學的觸發條件是「讀到第二種齡」——
// 在那之前玩家看到的線索全部同齡，新鮮度 chip 切了也沒差別，講了等於沒講。
// 幌子照樣計入：玩家在揭曉之前無從分辨，牠對玩家而言就是一條有齡別的線索。
export function distinctReadAges(level: Level, readLog: ClueRead[]): number {
  const ages = new Set<ClueAge>();
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue) ages.add(clue.age);
  }
  return ages.size;
}
```

`Level`、`ClueAge`、`ClueRead` 已在該檔頂部 import，不需新增 import。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/deduction.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/deduction.ts tests/deduction.test.ts
git commit -m "feat: count how many clue ages the player has read

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Phase 1 的教學文案

先把 Phase 1 掛點要用的字串全部補齊，Task 4／5 才有東西可以引用。

**Files:**
- Modify: `src/core/i18n.ts`（`MsgKey` 聯集 ＋ `en` 表 ＋ `zh-TW` 表）

**Interfaces:**
- Produces: 10 個新 `MsgKey`：`coach.event.startle`、`coach.event.supply`、`coach.event.oldtrail`、`coach.supply`、`coach.age`、`coach.bankpush`、`coach.iris`、`coach.route`、`coach.quality`、`coach.infoAt`

- [ ] **Step 1: 擴充 `MsgKey` 聯集**

在 `src/core/i18n.ts` 的 `MsgKey` 聯集尾端（`| 'rule.lowland' | ... | 'rule.doubling';` 那行之前）插入一行，並把原本結尾的分號留在最後一行：

```ts
  | 'coach.event.startle' | 'coach.event.supply' | 'coach.event.oldtrail'
  | 'coach.supply' | 'coach.age' | 'coach.bankpush' | 'coach.iris'
  | 'coach.route' | 'coach.quality' | 'coach.infoAt'
```

- [ ] **Step 2: 補 `en` 表**

在 `STRINGS.en` 內 `'rule.doubling': 'Doubles back on itself',` 之後加入：

```ts
    'coach.event.startle': 'Birds burst from cover — they flew away from where it is.',
    'coach.event.supply': 'You found extra forage at your feet. Stamina restored.',
    'coach.event.oldtrail': 'An old print underfoot. The bearing is rough — take it as a hint, not evidence.',
    'coach.supply': 'Mistleaf and dewfruit restore stamina. Plan your route through them.',
    'coach.age': 'These two clues are different ages. Only same-age clues can be crossed — use the freshness chip to pick one age at a time.',
    'coach.bankpush': 'Bank to keep the haul and rest. Push on to multiply it — but lose it all if the next trail goes cold.',
    'coach.iris': 'An iridescent one. Rare, and worth double.',
    'coach.route': 'It was walking the whole time. Clues sit where it passed, not where it went — read the freshest and lead it.',
    'coach.quality': 'Your call lands the record: dead on is gold, within two cells is silver, further is bronze.',
    'coach.infoAt': 'That step is when your clues first pinned one cell. Everything after it was walking, not deducing.',
```

- [ ] **Step 3: 補 `zh-TW` 表**

在 `STRINGS['zh-TW']` 內 `'rule.doubling': ...` 之後加入：

```ts
    'coach.event.startle': '一群鳥被驚起——牠們飛離的方向，就是牠所在的大致方位。',
    'coach.event.supply': '你在腳邊發現了額外的補給，體力已經補回。',
    'coach.event.oldtrail': '腳下有一道舊足跡，方向很粗略——當作參考，別當作證據。',
    'coach.supply': '霧葉與露珠果可以回復體力。規劃路線時把它們算進去。',
    'coach.age': '這兩條線索的齡別不同。只有同齡的線索能求交集——用新鮮度 chip 一次只看一齡。',
    'coach.bankpush': '歇腳＝把收穫入袋收工。續追＝倍率疊高再走一局，但下一趟落空就全部散掉。',
    'coach.iris': '異彩變種。少見，而且值兩倍。',
    'coach.route': '牠一路都在走。線索留在牠經過的地方，不是牠去的地方——讀最新的那一齡，然後往前帶。',
    'coach.quality': '押注決定記錄品質：正中是金，相距兩格內是銀，再遠是銅。',
    'coach.infoAt': '那一步是你的線索第一次鎖定單一格。在那之後你都在走路，不是在推理。',
```

- [ ] **Step 4: 跑測試確認鍵集合對稱**

Run: `npx vitest run tests/i18n.test.ts`
Expected: PASS — 「en and zh-TW cover exactly the same keys」與「no string is empty」皆通過

- [ ] **Step 5: 跑型別檢查**

Run: `npm run build`
Expected: 無 TypeScript 錯誤

- [ ] **Step 6: Commit**

```bash
git add src/core/i18n.ts
git commit -m "feat: write the first-encounter copy for in-run and result mechanics

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `MapScene` 局內掛點

**Files:**
- Modify: `src/scenes/MapScene.ts`（import 區、`create()`、`playMicroEvent`、`doMove` 的 `onComplete`）

**Interfaces:**
- Consumes: `coachOnce`、`CoachStore`（Task 1）；`distinctReadAges`（Task 2）；10 個 `coach.*` 字串（Task 3）
- Produces: 無（場景層終點）

- [ ] **Step 1: 加 import 與欄位**

在 import 區加入：

```ts
import { coachOnce, type CoachStore } from '../core/coach';
import { distinctReadAges } from '../core/deduction';
```

`deduction` 若已被 import（`heatMap` 等），把 `distinctReadAges` 併進既有的 import 大括號，不要開第二行 import。

在 `private tutStep = -1;` 附近加欄位：

```ts
  private coach!: CoachStore;
```

- [ ] **Step 2: 在 `create()` 取出 coach**

在 `this.tools = this.registry.get('tools');` 之後加一行：

```ts
    this.coach = this.registry.get('coach');
```

- [ ] **Step 3: 加一個統一的顯示入口**

在 `showTut`／`hideTut` 之後加入：

```ts
  // 首見教學提示：與新手引導共用底部橫條，但兩者絕不同時存在——
  // showTut 共用同一個 Text/Graphics 物件，引導期間再寫進去會把 tut.* 的文案蓋掉。
  // 引導本身只跑第 1 局的前幾步，讓它先講完是正確的優先序。
  private coachTip(id: CoachId, key: MsgKey): void {
    if (this.tutStep >= 0) return;
    coachOnce(this.coach, id, () => {
      this.showTut(key);
      // 提示不阻擋操作，也不需要玩家關掉——8 秒後自行淡出，讓畫面回到乾淨狀態
      this.time.delayedCall(8000, () => this.hideTut());
    });
  }
```

`CoachId` 要併進 Task 1 那行 import：

```ts
import { coachOnce, type CoachId, type CoachStore } from '../core/coach';
```

- [ ] **Step 4: 掛三則隨機事件**

在 `playMicroEvent` 內，`bird-startle` 分支的 `return;` 之前加一行：

```ts
      this.coachTip('event.startle', 'coach.event.startle');
```

`bonus-supply` 分支的 `return;` 之前加一行：

```ts
      this.coachTip('event.supply', 'coach.event.supply');
```

`old-trail`（函式最後那段，`this.audio.play('reveal');` 之後）加一行：

```ts
    this.coachTip('event.oldtrail', 'coach.event.oldtrail');
```

> 注意：`doMove` 的呼叫端是 `if (this.tutStep < 0 && s.phase === 'explore')`，引導期間本來就不擲事件，`coachTip` 的 `tutStep` 守衛在此是重複保險而非唯一防線——保留它，因為 `playMicroEvent` 是 private 但不保證未來只有這一個呼叫端。

- [ ] **Step 5: 掛補給與齡別**

在 `doMove` 的 `onComplete` 內，`if (gotSupply) { ... }` 區塊的 `this.audio.play('pickup');` 之後加一行：

```ts
          this.coachTip('supply', 'coach.supply');
```

在同一個 `onComplete` 內，`if (s.readClues.size > readBefore) { ... }` 區塊的**結尾**（`}` 之前、既有 `tutStep` 分支之後）加入：

```ts
          // 齡別提示：讀到第二種齡別的那一刻才有意義——在那之前所有線索同齡，
          // 切新鮮度 chip 看不出任何差別。
          if (distinctReadAges(s.level, s.readLog) >= 2) {
            this.coachTip('age.second', 'coach.age');
          }
```

- [ ] **Step 6: 跑完整驗證**

Run: `npm test && npm run build`
Expected: 全綠、無型別錯誤

- [ ] **Step 7: 手動驗收**

Run: `npm run dev`，開瀏覽器 DevTools Console 執行 `localStorage.removeItem('rht.seen.v1')` 後重新載入。走路直到觸發一次微事件，確認底部出現對應文案且 8 秒後消失；再觸發同類事件確認**不再**出現。

- [ ] **Step 8: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat: explain the walking events, supplies and clue ages the first time they happen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `ResultScene` 結算掛點

Reveal 的文字區已到版面預算上限（原始碼註解載明只有 3 行變動空間，`reveal.route` 當初就被迫從兩行併成一行），因此路線／品質／infoAt 三則改在 Result 說明——`btn.continue` 從 Reveal 直接進 Result，玩家仍是在下一屏讀到解釋，而 `flowY` 會自行壓縮吸收多出來的一行。

**Files:**
- Modify: `src/scenes/ResultScene.ts`（import 區、blocks 組裝區 `:190-220`、繪製區）

**Interfaces:**
- Consumes: `coachOnce`、`CoachStore`（Task 1）；`coach.bankpush`／`coach.iris`／`coach.route`／`coach.quality`／`coach.infoAt`（Task 3）
- Produces: 無

- [ ] **Step 1: 加 import**

```ts
import { coachOnce, type CoachId, type CoachStore } from '../core/coach';
import { infoCompleteStep } from '../core/deduction';
```

`infoCompleteStep` 若已被 import 就併入既有大括號；若 `RevealScene` 是唯一使用者，確認它的匯出來源後再 import（`grep -n "infoCompleteStep" src/core/*.ts`）。

- [ ] **Step 2: 決定本次要教哪一則**

在 `const blocks: FlowBlock[] = [];` 之前插入：

```ts
    // 首見教學：一次最多教一則，依優先度挑。三則都成立時硬塞會把 Result 排爆，
    // 且玩家一屏讀三段教學等於一段都沒讀。未顯示者不標記為已見，留到下一局再教。
    const coach: CoachStore = this.registry.get('coach');
    const wagerCell = wagerKey(s.marks);
    const routeReady = caught && s.mode === 'run';
    const infoStep = infoCompleteStep(s.level, s.readLog);
    const candidates: [CoachId, MsgKey][] = [];
    if (caught && s.level.iris) candidates.push(['iris', 'coach.iris']);
    if (routeReady) candidates.push(['reveal.route', 'coach.route']);
    if (wagerCell !== null) candidates.push(['quality', 'coach.quality']);
    if (caught && s.mode === 'run') candidates.push(['bankpush', 'coach.bankpush']);
    if (infoStep !== null && s.steps > infoStep) candidates.push(['reveal.infoAt', 'coach.infoAt']);
    const coachPick = candidates.find(([id]) => !coach.seen(id)) ?? null;
```

`wagerKey`、`MsgKey` 若尚未 import 要補上（`wagerKey` 來自 `../core/marks`，`MsgKey` 來自 `../core/i18n`）。

- [ ] **Step 3: 把它排進 `flowY`**

在 `add('primary', { h: 52, gap: 26, minGap: 16 });` **之前**插入：

```ts
    // 教學行排在按鈕之前：玩家的視線在按下去之前會掃過它。h 取 34 容納兩行 12px 字。
    if (coachPick) add('coach', { h: 34, gap: 16, minGap: 8 });
```

- [ ] **Step 4: 畫出來並標記已見**

在按鈕列繪製之前（`const runRound: number = this.registry.get('runRound');` 那行之前）插入：

```ts
    if (coachPick) {
      const [coachId, coachKey] = coachPick;
      coachOnce(coach, coachId, () => {
        this.add.text(cx, at('coach'), i18n.t(coachKey), {
          fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
          wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
      });
    }
```

- [ ] **Step 5: 跑完整驗證**

Run: `npm test && npm run build`
Expected: 全綠、無型別錯誤

- [ ] **Step 6: 手動驗收**

Run: `npm run dev`。DevTools Console：`localStorage.removeItem('rht.seen.v1')`，重新載入，完成一局主線狩獵。確認結算畫面出現**一則**教學行、按鈕未被推出畫面（把瀏覽器高度縮到 600px 再確認一次）。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/ResultScene.ts
git commit -m "feat: explain banking, iridescents, the route and record quality at the reveal's next screen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — 說明頁分組與補列

## Task 6: `HelpScene` 圖例列改分組（行為不變）

先做純結構改動、不加任何新列，讓「分組排版壞了」與「新文案不對」兩種失敗不會混在一起。

**Files:**
- Modify: `src/scenes/HelpScene.ts:120-280`（`rows` 陣列與其下的列表建構、遮罩、捲動範圍）
- Modify: `src/core/i18n.ts`（4 個分組標題 key）

**Interfaces:**
- Consumes: 無
- Produces: `help.sec.track`／`help.sec.deduce`／`help.sec.ground`／`help.sec.longRun` 四個 `MsgKey`

- [ ] **Step 1: 加四個標題字串**

`MsgKey` 聯集加一行：

```ts
  | 'help.sec.track' | 'help.sec.deduce' | 'help.sec.ground' | 'help.sec.longRun'
```

`en` 表：

```ts
    'help.sec.track': 'READING THE TRAIL',
    'help.sec.deduce': 'WORKING IT OUT',
    'help.sec.ground': 'GROUND & STAMINA',
    'help.sec.longRun': 'THE LONG RUN',
```

`zh-TW` 表：

```ts
    'help.sec.track': '判讀蹤跡',
    'help.sec.deduce': '推理工具',
    'help.sec.ground': '地形與體力',
    'help.sec.longRun': '收分與長線',
```

- [ ] **Step 2: 把現有 13 列改成分組結構**

把 `const rows: { y: number; key: ...; icon: ... }[] = [...]` 換成不含 `y` 的分組陣列——`y` 改由建構迴圈算出，手寫 `i * 44 + 22` 在有標題列之後會全部錯位：

```ts
    type HelpRow = { key: Parameters<I18n['t']>[0]; icon: (y: number) => void };
    const sections: { titleKey: Parameters<I18n['t']>[0]; rows: HelpRow[] }[] = [
      {
        titleKey: 'help.sec.track',
        rows: [
          { key: 'help.footprint', icon: (y) => drawClueToken(icons, rowX, y, 15, 'footprint', pal) },
          { key: 'help.disturbance', icon: (y) => drawClueToken(icons, rowX, y, 15, 'disturbance', pal) },
          { key: 'help.scent', icon: (y) => drawClueToken(icons, rowX, y, 15, 'scent', pal) },
          { key: 'help.decoy', icon: (y) => { /* 原 help.decoy 的 icon 內容，逐字搬過來 */ } },
          { key: 'help.weather', icon: (y) => { /* 原 help.weather 的 icon 內容 */ } },
        ],
      },
      {
        titleKey: 'help.sec.deduce',
        rows: [
          { key: 'help.marks', icon: (y) => { /* 原 help.marks 的 icon 內容 */ } },
          { key: 'help.layer', icon: (y) => { /* 原 help.layer 的 icon 內容 */ } },
          { key: 'help.reveal', icon: (y) => { /* 原 help.reveal 的 icon 內容 */ } },
        ],
      },
      {
        titleKey: 'help.sec.ground',
        rows: [
          { key: 'help.stamina', icon: (y) => { /* 原 help.stamina 的 icon 內容 */ } },
          { key: 'help.vision', icon: (y) => { /* 原 help.vision 的 icon 內容 */ } },
          { key: 'help.survey', icon: (y) => { /* 原 help.survey 的 icon 內容 */ } },
          { key: 'help.route', icon: (y) => { /* 原 help.route 的 icon 內容 */ } },
        ],
      },
      {
        titleKey: 'help.sec.longRun',
        rows: [
          { key: 'help.qte', icon: (y) => { /* 原 help.qte 的 icon 內容 */ } },
        ],
      },
    ];
```

**每個 `icon` 的函式主體逐字沿用現有 `rows` 陣列裡對應那一筆的內容，一個像素都不要改。** 唯一的差別是刪掉 `y:` 欄位。13 列全部要出現，一筆都不能漏——搬完後對照原檔清點：footprint、disturbance、scent、decoy、stamina、marks、qte、layer、reveal、weather、vision、survey、route，共 13 筆。

- [ ] **Step 3: 改建構迴圈與捲動範圍**

把原本的 `this.listTop = py0 + 208; ... this.minY = ...` 那一段換成：

```ts
    const TITLE_H = 30;
    const ROW_H = 44;
    this.listTop = py0 + 208;
    this.list = this.add.container(0, this.listTop);
    this.list.add(icons);

    let cursor = 0;
    for (const sec of sections) {
      // 標題基線落在該區塊垂直中央，與圖例列同一套 origin(0, 0.5) 慣例
      this.list.add(this.add.text(px0 + 30, cursor + TITLE_H / 2, i18n.t(sec.titleKey), {
        fontFamily: FONTS.body, fontSize: '11.5px', color: cssHex(pal.gold),
      }).setOrigin(0, 0.5).setLetterSpacing(1.5));
      cursor += TITLE_H;
      for (const row of sec.rows) {
        const y = cursor + ROW_H / 2;
        row.icon(y);
        this.list.add(this.add.text(textX, y, i18n.t(row.key), {
          fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paperDim),
          wordWrap: { width: pw - (textX - px0) - 40, useAdvancedWrap: true }, lineSpacing: 4,
        }).setOrigin(0, 0.5));
        cursor += ROW_H;
      }
    }

    // 可視區：py0+208 到 py0+ph-92，之下留給開始按鈕。
    // 總高度改由 cursor 累加而來（標題 30 + 圖例 44），不再是 rows.length * 44 + 22——
    // 新增列或新增分組時這裡自動跟上，不必再動任何常數。
    const viewH = (py0 + ph - 92) - this.listTop;
    this.minY = Math.min(0, viewH - cursor) + this.listTop;
```

刪掉原本 `const viewH = ...` 與 `this.minY = ...` 兩行，以及原本的 `for (const row of rows) { ... }` 迴圈與 `this.list = this.add.container(...)`／`this.list.add(icons)`（已併入上面）。

- [ ] **Step 4: 型別檢查與手動驗收**

Run: `npm run build`
Expected: 無錯誤

Run: `npm run dev`，開說明頁。確認：13 列全在、分成四組且各有金色標題、捲動到底看得到最後一列、首列圖示未被遮罩上緣裁掉。把瀏覽器高度縮到 600px 再確認一次。

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n.ts src/scenes/HelpScene.ts
git commit -m "refactor: group the how-to-play rows into four sections

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 說明頁新列的文案

**Files:**
- Modify: `src/core/i18n.ts`

**Interfaces:**
- Produces: 19 個新 `MsgKey`：`help.quarry`、`help.habit`、`help.age`、`help.score`、`help.iris`、`help.events`、`help.supply`、`help.mute`、`help.infoAt`、`help.quirk`、`help.progress`、`help.tools`、`help.codex`、`help.commission`、`help.daily`、`help.wx.clear`、`help.wx.mist`、`help.wx.wind`、`help.wx.drizzle`

- [ ] **Step 1: 擴充 `MsgKey` 聯集**

```ts
  | 'help.quarry' | 'help.habit' | 'help.age' | 'help.score' | 'help.iris'
  | 'help.events' | 'help.supply' | 'help.mute' | 'help.infoAt' | 'help.quirk'
  | 'help.progress' | 'help.tools' | 'help.codex' | 'help.commission' | 'help.daily'
  | 'help.wx.clear' | 'help.wx.mist' | 'help.wx.wind' | 'help.wx.drizzle'
```

- [ ] **Step 2: 補 `en` 表**

```ts
    'help.quarry': 'It does not sit still. It walks a foraging route, so a clue marks where it passed — not where it went.',
    'help.habit': 'Each species walks its own way: the valley floor, the ridgeline, the thickets, a straight line, or doubling back. The reveal names it.',
    'help.age': 'Clues carry a freshness: morning, night, older. Only same-age clues can be crossed — the chip beside Layer picks which age you are reading.',
    'help.score': 'A record banks points. Rest to keep them, or push on to multiply the next haul — a failed hunt scatters everything unbanked.',
    'help.iris': 'Iridescent variants are rare and score double. You only know once you have recorded one.',
    'help.events': 'The mountain moves around you. Startled birds fly away from it, forage turns up underfoot, and old prints give a rough bearing.',
    'help.supply': 'Mistleaf and dewfruit restore stamina where they grow. Route through them on a long crossing.',
    'help.mute': 'Marking a cell you already read mutes that clue — it drops out of Layer. Use it on a trail you believe is lying.',
    'help.infoAt': 'The reveal names the step your clues first pinned one cell. Walking past it costs stamina and buys nothing.',
    'help.quirk': 'Species differ in how they read: some scatter their scent, some leave a tighter print. The field guide records each habit.',
    'help.progress': 'Ground widens as you go — 15 cells, then 20, then 25 — and from round 4 some trails lie.',
    'help.tools': 'Records unlock tools. The windstone leans scent rings toward the source; the glowbell rings out one false trail per hunt.',
    'help.codex': 'Every record adds field notes. Notes raise a research level, and traces you have found but not recorded show as rumors.',
    'help.commission': 'Three commissions post each day — a species, a stamina margin, a record quality. Each one pays field notes.',
    'help.daily': "Today's Trail is the same map for everyone. Finishing it builds a streak; every seventh day earns a rest token that covers a missed day.",
    'help.wx.clear': 'Clear — clues read exactly as they are.',
    'help.wx.mist': 'Mist — scent spreads and footprint cones widen. Everything reads looser.',
    'help.wx.wind': 'Wind — scent scatters furthest of all, but disturbances tighten to a smaller circle.',
    'help.wx.drizzle': 'Drizzle — prints press sharp and narrow, while scent smears a little.',
```

- [ ] **Step 3: 補 `zh-TW` 表**

```ts
    'help.quarry': '牠不會待在原地。牠沿覓食路線走，所以線索標的是牠「經過」的地方，不是牠去的地方。',
    'help.habit': '每個物種走法不同：谷底、稜線、密叢、直線、或者折返。揭曉時會告訴你牠是哪一種。',
    'help.age': '線索帶有新鮮度：晨間、夜間、更早。只有同齡的線索能求交集——「圖層」旁的 chip 決定你在讀哪一齡。',
    'help.score': '記錄會累積分數。歇腳把它入袋收工，續追則把下一趟的倍率疊高——但落空一次，未入袋的全部散掉。',
    'help.iris': '異彩變種少見，分數兩倍。要記錄到才會知道遇上了。',
    'help.events': '山會在你身邊動。驚起的鳥會朝反方向飛離牠、腳邊會冒出補給、舊足跡會給你一個粗略方位。',
    'help.supply': '霧葉與露珠果長在原地、回復體力。長距離橫越時把路線繞過去。',
    'help.mute': '標記一格你已判讀過的線索＝把那條線索靜音，它會退出「圖層」。用在你認為在說謊的那條蹤跡上。',
    'help.infoAt': '揭曉會告訴你「第幾步就足以鎖定」。走過那一步之後的每一步都在花體力，換不到資訊。',
    'help.quirk': '物種的判讀難度各不相同：有的氣味散得開，有的足跡收得緊。圖鑑會記下每一種的習性。',
    'help.progress': '地圖會愈走愈大——15 格、20 格、25 格——而且從第 4 局起，有些蹤跡會說謊。',
    'help.tools': '記錄會解鎖道具。風向石讓氣味環朝源頭偏心；輝鈴每局可以敲掉一條假蹤跡。',
    'help.codex': '每筆記錄都會累積田野筆記。筆記推高研究度，而找到痕跡卻尚未記錄的物種會顯示為傳聞。',
    'help.commission': '每天張貼三則委託——指定物種、體力餘裕、記錄品質。每完成一則都付田野筆記。',
    'help.daily': '「今日行蹤」全世界同一張圖。完成會累積連勝；每滿七天贈一枚歇腳符，可以補一天沒跑的空缺。',
    'help.wx.clear': '晴——線索如實呈現，不增不減。',
    'help.wx.mist': '霧——氣味擴散、足跡錐形變寬。整體都讀得比較鬆。',
    'help.wx.wind': '風——氣味散得最開，但擾動的圓域反而收得更小。',
    'help.wx.drizzle': '細雨——足跡壓得又深又窄，氣味則稍微糊掉。',
```

- [ ] **Step 4: 驗證**

Run: `npx vitest run tests/i18n.test.ts && npm run build`
Expected: PASS、無型別錯誤

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n.ts
git commit -m "feat: write the how-to-play copy for the mechanics it never covered

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 把新列放進說明頁

**Files:**
- Modify: `src/scenes/HelpScene.ts`（Task 6 建立的 `sections` 陣列）

**Interfaces:**
- Consumes: Task 6 的 `sections` 結構、Task 7 的 15 個字串
- Produces: 無

- [ ] **Step 1: 加圖示輔助**

在 `drawWeatherGlyph` 之後加入三個新圖示畫法：

```ts
    // 覓食路線：三個由淡到濃的節點連成一條折線，末端箭頭指向「牠要去的地方」
    const drawRouteGlyph = (gy: number) => {
      const pts = [[rowX - 16, gy + 6], [rowX - 4, gy - 4], [rowX + 8, gy + 2]];
      icons.lineStyle(1.6, pal.gold, 0.8);
      icons.lineBetween(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      icons.lineBetween(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      icons.lineStyle(1.4, pal.gold, 0.4);
      icons.lineBetween(pts[2][0], pts[2][1], rowX + 18, gy - 5);
      pts.forEach(([px, py], i) => {
        icons.fillStyle(pal.gold, 0.3 + i * 0.35).fillCircle(px, py, 3);
      });
    };

    // 新鮮度：三格由淡到濃，最濃的加一圈外框代表「目前選中這一齡」
    const drawAgeGlyph = (gy: number) => {
      const sq = 9;
      let x = rowX - 16;
      for (const a of [0.2, 0.45, 0.9]) {
        icons.fillStyle(pal.gold, a).fillRect(x, gy - sq / 2, sq, sq);
        x += sq + 3;
      }
      icons.lineStyle(1.2, pal.paper, 0.9).strokeRect(rowX - 16 + (sq + 3) * 2, gy - sq / 2 - 2, sq + 4, sq + 4);
    };

    // 分數：三枚由小到大的金點，代表倍率疊高
    const drawScoreGlyph = (gy: number) => {
      icons.fillStyle(pal.gold, 0.5).fillCircle(rowX - 14, gy, 2.5);
      icons.fillStyle(pal.gold, 0.75).fillCircle(rowX, gy, 4);
      icons.fillStyle(pal.gold, 1).fillCircle(rowX + 16, gy, 5.5);
    };
```

- [ ] **Step 2: 插入新列**

在四個分組裡分別插入（其餘既有列位置不動）：

`help.sec.track` 的 `rows` 末端追加：

```ts
          { key: 'help.quarry', icon: (y) => drawRouteGlyph(y) },
          { key: 'help.habit', icon: (y) => drawRouteGlyph(y) },
          { key: 'help.events', icon: (y) => {
            icons.lineStyle(1.6, pal.mark, 0.9);
            icons.lineBetween(rowX, y - 8, rowX, y + 2);
            icons.fillStyle(pal.mark, 0.9).fillCircle(rowX, y + 7, 1.6);
          } },
          { key: 'help.wx.clear', icon: (y) => drawWeatherGlyph(rowX, y, 'clear') },
          { key: 'help.wx.mist', icon: (y) => drawWeatherGlyph(rowX, y, 'mist') },
          { key: 'help.wx.wind', icon: (y) => drawWeatherGlyph(rowX, y, 'wind') },
          { key: 'help.wx.drizzle', icon: (y) => drawWeatherGlyph(rowX, y, 'drizzle') },
```

`help.sec.deduce` 的 `rows` 末端追加：

```ts
          { key: 'help.age', icon: (y) => drawAgeGlyph(y) },
          { key: 'help.mute', icon: (y) => {
            drawClueToken(icons, rowX, y, 15, 'scent', pal);
            icons.lineStyle(2, pal.paperDim, 0.8).lineBetween(rowX - 14, y + 12, rowX + 14, y - 12);
          } },
          { key: 'help.infoAt', icon: (y) => {
            icons.lineStyle(1.4, pal.paperDim, 0.85).lineBetween(rowX - 16, y + 6, rowX + 16, y + 6);
            icons.fillStyle(pal.gold, 1).fillCircle(rowX - 2, y + 6, 3.5);
          } },
          { key: 'help.quirk', icon: (y) => {
            icons.lineStyle(1.4, pal.paperDim, 0.9).strokeCircle(rowX - 8, y, 5);
            icons.lineStyle(1.4, pal.paperDim, 0.9).strokeCircle(rowX + 8, y, 9);
          } },
```

`help.sec.ground` 的 `rows` 末端追加：

```ts
          { key: 'help.supply', icon: (y) => {
            drawSupply(icons, rowX - 10, y, 34, 0, pal);
            drawSupply(icons, rowX + 10, y, 34, 1, pal);
          } },
```

`help.sec.longRun` 的 `rows` 末端追加：

```ts
          { key: 'help.score', icon: (y) => drawScoreGlyph(y) },
          { key: 'help.iris', icon: (y) => {
            icons.fillStyle(pal.iris, 1).fillCircle(rowX, y, 5);
            icons.lineStyle(1.4, pal.iris, 0.5).strokeCircle(rowX, y, 10);
          } },
          { key: 'help.progress', icon: (y) => {
            let x = rowX - 18;
            for (const sz of [7, 10, 13]) {
              icons.lineStyle(1.2, pal.paperDim, 0.85).strokeRect(x, y - sz / 2, sz, sz);
              x += sz + 4;
            }
          } },
          { key: 'help.tools', icon: (y) => {
            icons.lineStyle(1.5, pal.gold, 0.9).strokeCircle(rowX - 8, y, 5);
            icons.lineStyle(1.5, pal.gold, 0.9);
            icons.beginPath();
            icons.arc(rowX + 8, y, 6, Math.PI, Math.PI * 2);
            icons.strokePath();
            icons.fillStyle(pal.gold, 1).fillCircle(rowX + 8, y + 3, 1.8);
          } },
          { key: 'help.codex', icon: (y) => {
            icons.lineStyle(1.4, pal.paperDim, 0.9).strokeRect(rowX - 10, y - 8, 20, 16);
            icons.lineBetween(rowX, y - 8, rowX, y + 8);
          } },
          { key: 'help.commission', icon: (y) => {
            for (let i = 0; i < 3; i++) {
              icons.lineStyle(1.3, pal.paperDim, 0.85).lineBetween(rowX - 12, y - 5 + i * 5, rowX + 12, y - 5 + i * 5);
            }
          } },
          { key: 'help.daily', icon: (y) => {
            icons.lineStyle(1.4, pal.supply, 0.9).strokeCircle(rowX, y, 8);
            icons.lineStyle(1.4, pal.supply, 0.9).lineBetween(rowX, y - 4, rowX, y);
            icons.lineBetween(rowX, y, rowX + 4, y + 2);
          } },
```

既有的 `help.weather` 總結列保留在追蹤組內、四個逐項列緊接其後——總結說「天氣會影響判讀」，四列說「各自怎麼影響」，兩者不重複。

`help.qte` 留在 `help.sec.longRun` 的第一筆。最終列數：追蹤 12、推理 7、地形 5、長線 8，共 **32 列 + 4 標題**。

- [ ] **Step 3: 驗證**

Run: `npm run build`
Expected: 無錯誤

Run: `npm run dev`，開說明頁。確認 32 列全數可見（需捲動）、無列被裁切、四個標題各就各位、EN/中 切換後兩邊都完整。

- [ ] **Step 4: Commit**

```bash
git add src/scenes/HelpScene.ts
git commit -m "feat: fill the how-to-play page out to every mechanic in the game

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

# Phase 3 — 示範腳本泛化與「會走的獵物」新課

## Task 9: `demo.ts` 泛化為 `DemoScript`（零行為變動）

**Files:**
- Modify: `src/core/demo.ts`（全檔）
- Modify: `src/scenes/DemoScene.ts`（import 與常數引用）
- Modify: `tests/demo.test.ts`（import 與常數引用）

**Interfaces:**
- Consumes: 無
- Produces:
  - `type DemoCellAction = 'exclude' | 'wager'`
  - `type DemoAction = 'exclude' | 'mute' | 'wager' | 'pick-age'`
  - `interface DemoStep`（新增選用欄位 `heatAge?: 0 | 1 | 2 | null`）
  - `interface DemoScript { id; size; start; target; clues; steps; fogRows; titleKey; pair; checkCell(action, cell); checkClue(i); unseen(step) }`
  - `const DEDUCTION_SCRIPT: DemoScript`
  - `function demoScript(id: DemoScriptId): DemoScript`
  - `type DemoScriptId = 'deduction' | 'quarry'`（此 task 只實作 `'deduction'`）

- [ ] **Step 1: 定義 `DemoScript` 並把現有腳本包進去**

在 `src/core/demo.ts` 現有的 `DEMO_STEPS` 之後加入：

```ts
export type DemoScriptId = 'deduction' | 'quarry';
export type DemoCellAction = 'exclude' | 'wager';

export interface DemoScript {
  id: DemoScriptId;
  size: number;
  start: Vec2;
  target: Vec2;
  clues: readonly Clue[];
  steps: readonly DemoStep[];
  fogRows: number;
  titleKey: MsgKey;
  // 第二章自動標存疑的那一組格子。第一課是「前兩條線索的交集」，
  // 第二課是「最新齡兩條的交集」——語意不同，值由腳本自己算好交出來。
  pair: Set<string>;
  checkCell(action: DemoCellAction, cell: Vec2): MsgKey | null;
  checkClue(clueIndex: number): MsgKey | null;
  unseen(step: DemoStep): Set<string>;
}

export const DEDUCTION_SCRIPT: DemoScript = {
  id: 'deduction',
  size: DEMO_SIZE,
  start: DEMO_START,
  target: DEMO_TARGET,
  clues: DEMO_CLUES,
  steps: DEMO_STEPS,
  fogRows: DEMO_FOG_ROWS,
  titleKey: 'demo.title',
  pair: DEMO_PAIR,
  checkCell: checkCellAction,
  checkClue: checkMuteAction,
  unseen: demoUnseen,
};

export function demoScript(id: DemoScriptId): DemoScript {
  // 第二課於 Task 12 加入；在那之前任何未知 id 一律退回第一課，
  // 而不是丟例外——示範是教學入口，壞掉時應該退化成「教到一部分」而非白畫面。
  return id === 'deduction' ? DEDUCTION_SCRIPT : DEDUCTION_SCRIPT;
}
```

現有的 `DEMO_*` 匯出**全部保留**，不刪不改——這一 task 只加一層包裝，讓下一 task 有東西可以換。

`MsgKey` 已在該檔頂部 import。

- [ ] **Step 2: `DemoStep` 加選用欄位**

在 `DemoStep` 介面內加一行（放在 `overlay` 之後）：

```ts
  // 本步的新鮮度 chip 選擇（null = 全部齡別）。第一課全部為 undefined，
  // 渲染時視同 null，逐格結果與加這個欄位之前完全相同。
  heatAge?: 0 | 1 | 2 | null;
```

並把 `DemoAction` 擴充：

```ts
export type DemoAction = 'exclude' | 'mute' | 'wager' | 'pick-age';
```

- [ ] **Step 3: 讓測試改用腳本物件**

在 `tests/demo.test.ts` 的 import 加入 `DEDUCTION_SCRIPT`，並在檔尾附加一組「包裝與常數一致」的斷言——**既有斷言一條都不改**：

```ts
describe('DEDUCTION_SCRIPT', () => {
  it('wraps the deduction lesson without changing it', () => {
    expect(DEDUCTION_SCRIPT.id).toBe('deduction');
    expect(DEDUCTION_SCRIPT.size).toBe(DEMO_SIZE);
    expect(DEDUCTION_SCRIPT.start).toEqual(DEMO_START);
    expect(DEDUCTION_SCRIPT.target).toEqual(DEMO_TARGET);
    expect(DEDUCTION_SCRIPT.clues).toBe(DEMO_CLUES);
    expect(DEDUCTION_SCRIPT.steps).toBe(DEMO_STEPS);
    expect(DEDUCTION_SCRIPT.pair).toBe(DEMO_PAIR);
  });

  it('routes its checks to the same functions', () => {
    expect(DEDUCTION_SCRIPT.checkCell('exclude', { x: 0, y: 0 }))
      .toBe(checkCellAction('exclude', { x: 0, y: 0 }));
    expect(DEDUCTION_SCRIPT.checkClue(DECOY_INDEX)).toBe(checkMuteAction(DECOY_INDEX));
  });

  it('leaves every deduction step on no particular age', () => {
    for (const step of DEDUCTION_SCRIPT.steps) {
      expect(step.heatAge ?? null).toBeNull();
    }
  });
});
```

- [ ] **Step 4: 跑測試**

Run: `npx vitest run tests/demo.test.ts`
Expected: PASS — 既有斷言全綠 ＋ 3 條新斷言通過

- [ ] **Step 5: 跑完整驗證**

Run: `npm test && npm run build`
Expected: 全綠、無型別錯誤

> **停下來回報的條件：** 若既有 `tests/demo.test.ts` 有任何一條斷言變紅，不要改期望值——那代表包裝改到了行為。回頭比對 `DEDUCTION_SCRIPT` 各欄位是否確實指向同一個物件。

- [ ] **Step 6: Commit**

```bash
git add src/core/demo.ts tests/demo.test.ts
git commit -m "refactor: collect the deduction walkthrough into a script object

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `DemoScene` 改吃腳本

**Files:**
- Modify: `src/scenes/DemoScene.ts`（全檔的常數引用）

**Interfaces:**
- Consumes: `DemoScript`、`demoScript`、`DemoScriptId`（Task 9）
- Produces: `DemoScene.init({ scriptId?: DemoScriptId; from?: DemoFrom })`

- [ ] **Step 1: 換 import 與加欄位**

把 `import { DEMO_SIZE, DEMO_CLUES, DEMO_PAIR, DEMO_TARGET, DEMO_STEPS, demoUnseen, type DemoStep, ... } from '../core/demo';` 換成：

```ts
import {
  demoScript, type DemoScript, type DemoScriptId, type DemoStep,
} from '../core/demo';
```

加欄位（放在 `private from: DemoFrom = 'Camp';` 之後）：

```ts
  private script: DemoScript = demoScript('deduction');
```

- [ ] **Step 2: 改 `init`**

```ts
  init(data: { from?: DemoFrom; scriptId?: DemoScriptId }) {
    this.from = data?.from ?? 'Camp';
    this.script = demoScript(data?.scriptId ?? 'deduction');
  }
```

- [ ] **Step 3: 全檔換掉常數引用**

逐一替換（`grep -n "DEMO_" src/scenes/DemoScene.ts` 找出全部）：

| 舊 | 新 |
|---|---|
| `DEMO_SIZE` | `this.script.size` |
| `DEMO_CLUES` | `this.script.clues` |
| `DEMO_STEPS` | `this.script.steps` |
| `DEMO_TARGET` | `this.script.target` |
| `DEMO_PAIR` | `this.script.pair` |
| `demoUnseen(step)` | `this.script.unseen(step)` |
| `checkCellAction(a, c)` | `this.script.checkCell(a, c)` |
| `checkMuteAction(i)` | `this.script.checkClue(i)` |

標題文字改用 `i18n.t(this.script.titleKey)`。

- [ ] **Step 4: 讓渲染吃 `heatAge`**

在算 `live` 線索的那一行（`const live = step.clues.filter((i) => !step.muted.includes(i)).map((i) => this.script.clues[i]);`）之後加上齡別篩選：

```ts
    // 新鮮度篩選：heatAge 為 null／undefined 時不篩（第一課全程如此，行為與加這段之前相同）
    const age = step.heatAge ?? null;
    const shown = age === null ? live : live.filter((c) => c.age === age);
```

其後所有原本用 `live` 的地方（`heatMap(live, ...)`、`intersect(live, ...)`）改用 `shown`。線索**記號**的繪製仍用 `step.clues` 全集，不受齡別影響——齡別只影響熱區與交集，不影響「地上有沒有這個記號」。

- [ ] **Step 5: 支援 `pick-age` 互動**

在既有的 `action` 分派處（處理 `exclude`／`mute`／`wager` 點擊的地方）加入 `pick-age` 分支：本步要求玩家點畫面上的新鮮度 chip。在 `pick-age` 步驟渲染一顆與 `MapScene` 同款的 chip（金色外框、標籤取 `age.fresh`／`age.night`／`age.older`／`age.all`），點下去依 `2 → 1 → 0 → null → 2` 循環；當玩家把它切到該步 `heatAge` 指定的值時視為通過並前進，否則不前進、不出錯誤提示（切錯只是還沒切到，不是答錯）。

- [ ] **Step 6: 驗證**

Run: `npm run build`
Expected: 無錯誤

Run: `npm run dev`，從說明頁進示範。走完 14 步，確認與改動前**逐步相同**：旁白、熱區、自動存疑、三個動手點、揭曉。

- [ ] **Step 7: Commit**

```bash
git add src/scenes/DemoScene.ts
git commit -m "refactor: let the walkthrough scene run any lesson script

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 找出第二課的關卡資料

第一課的四條線索是「掃過全部 81 個位置 × 半徑 {2,3} 後的唯一解」。第二課的約束更嚴（跨齡交集為空、最新齡交集恰為一格、三齡交集點共線等距），**不得手寫猜測**——先寫性質測試，再寫搜尋腳本，跑出結果再貼回程式碼。

**Files:**
- Create: `tests/demo-quarry.test.ts`
- Create: `scripts/find-quarry-lesson.mjs`（搜尋腳本，找到資料後保留在 repo，供日後調整重跑）
- Modify: `src/core/demo.ts`（貼入找到的資料）

**Interfaces:**
- Consumes: `candidates`、`intersect`、`key`（`src/core/clues.ts`）
- Produces:
  - `const QUARRY_SIZE = 9`
  - `const QUARRY_NODES: readonly [Vec2, Vec2, Vec2]`（W0／W1／W2，索引即齡別 0／1／2）
  - `const QUARRY_CLUES: readonly Clue[]`（6 條，每齡 2 條，全部 `isDecoy: false`）
  - `const QUARRY_START: Vec2`
  - `const QUARRY_TARGET: Vec2`（外推攔截點）
  - `const QUARRY_PAIR: Set<string>`（最新齡兩條的交集）

- [ ] **Step 1: 寫性質測試（此時必定失敗）**

建立 `tests/demo-quarry.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { intersect, key } from '../src/core/clues';
import {
  QUARRY_SIZE, QUARRY_NODES, QUARRY_CLUES, QUARRY_START, QUARRY_TARGET, QUARRY_PAIR,
} from '../src/core/demo';

const byAge = (age: number) => QUARRY_CLUES.filter((c) => c.age === age);

describe('quarry lesson data', () => {
  it('has six honest clues, two per age', () => {
    expect(QUARRY_CLUES).toHaveLength(6);
    expect(QUARRY_CLUES.every((c) => !c.isDecoy)).toBe(true);
    for (const age of [0, 1, 2]) expect(byAge(age)).toHaveLength(2);
  });

  it('keeps every position inside the grid', () => {
    const all = [QUARRY_START, QUARRY_TARGET, ...QUARRY_NODES, ...QUARRY_CLUES.map((c) => c.position)];
    for (const p of all) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(QUARRY_SIZE);
      expect(p.y).toBeLessThan(QUARRY_SIZE);
    }
  });

  // 第 1 章「六條線索攤開，交集是空的」必須字面成立
  it('has no cell agreeing with all six clues', () => {
    expect(intersect([...QUARRY_CLUES], QUARRY_SIZE).size).toBe(0);
  });

  // 第 2 章「切到最新一齡，交集出牠剛才在哪」
  it('pins the newest age to exactly the newest node', () => {
    const fresh = intersect(byAge(2), QUARRY_SIZE);
    expect(fresh.size).toBe(1);
    expect([...fresh][0]).toBe(key(QUARRY_NODES[2]));
    expect(QUARRY_PAIR).toEqual(fresh);
  });

  // 每一齡都必須自己解得出來，否則第 3 章的「三個點」畫不出來
  it('pins each age to exactly its own node', () => {
    for (const age of [0, 1, 2] as const) {
      const cells = intersect(byAge(age), QUARRY_SIZE);
      expect(cells.size).toBe(1);
      expect([...cells][0]).toBe(key(QUARRY_NODES[age]));
    }
  });

  // 第 3 章「連起來就是方向」：三點共線且等距，外推才有唯一答案
  it('walks a straight, evenly spaced line', () => {
    const [w0, w1, w2] = QUARRY_NODES;
    const d1 = { x: w1.x - w0.x, y: w1.y - w0.y };
    const d2 = { x: w2.x - w1.x, y: w2.y - w1.y };
    expect(d2).toEqual(d1);
    expect(d1.x === 0 && d1.y === 0).toBe(false);
  });

  it('puts the extrapolated cell one more step along, inside the grid', () => {
    const [, w1, w2] = QUARRY_NODES;
    expect(QUARRY_TARGET).toEqual({ x: w2.x + (w2.x - w1.x), y: w2.y + (w2.y - w1.y) });
    expect(QUARRY_TARGET.x).toBeGreaterThanOrEqual(0);
    expect(QUARRY_TARGET.y).toBeGreaterThanOrEqual(0);
    expect(QUARRY_TARGET.x).toBeLessThan(QUARRY_SIZE);
    expect(QUARRY_TARGET.y).toBeLessThan(QUARRY_SIZE);
  });

  it('does not put the answer on any node — the player must extrapolate', () => {
    for (const node of QUARRY_NODES) {
      expect(key(QUARRY_TARGET)).not.toBe(key(node));
    }
  });

  // 線索參數必須落在 getDifficulty() 真實使用的區間內，否則教的是特例不是這個遊戲
  it('uses parameters the real game actually produces', () => {
    for (const c of QUARRY_CLUES) {
      if (c.type === 'footprint') {
        expect(c.data.angleSpread).toBeGreaterThanOrEqual(15);
        expect(c.data.angleSpread).toBeLessThanOrEqual(40);
      } else if (c.type === 'disturbance') {
        expect(c.data.radius).toBeGreaterThanOrEqual(2);
        expect(c.data.radius).toBeLessThanOrEqual(4);
      } else {
        expect(c.data.tolerance).toBeGreaterThanOrEqual(0.5);
        expect(c.data.tolerance).toBeLessThanOrEqual(1.0);
        expect(Number.isInteger(c.data.distance)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: 跑測試確認它失敗**

Run: `npx vitest run tests/demo-quarry.test.ts`
Expected: FAIL — `QUARRY_SIZE` 等匯出不存在

- [ ] **Step 3: 寫搜尋腳本**

建立 `scripts/find-quarry-lesson.mjs`。它要窮舉出滿足全部性質的一組資料——不要在腦中推導幾何：

```js
// 找出「會走的獵物」示範課的關卡資料。
// 約束（與 tests/demo-quarry.test.ts 一一對應）：
//   ① 9x9，三個節點共線等距，外推點落在圖內且不等於任何節點
//   ② 每一齡的兩條線索交集恰為該齡的節點
//   ③ 六條線索的跨齡交集為空
//   ④ 線索參數落在 getDifficulty() 的真實區間
// 找到第一組就印出來，貼回 src/core/demo.ts。
import { candidates, intersect, key } from '../src/core/clues.ts';

const SIZE = 9;
const SPREADS = [20, 25, 30];
const RADII = [2, 3];
const TOLERANCES = [0.5, 0.75, 1.0];

const angleDeg = (from, to) =>
  ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const inGrid = (p) => p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE;

// 反向錨定：線索位置固定，方向／距離由「該位置到節點」推導，
// 與 generate.ts 的 makeClue 同一套做法——節點因此必然落在候選集合內。
function makeFootprint(pos, node, age, spread) {
  return { type: 'footprint', position: pos, isDecoy: false, age,
    data: { direction: Math.round(angleDeg(pos, node)), angleSpread: spread } };
}
function makeDisturbance(pos, node, age, radius) {
  if (cheb(pos, node) > radius) return null;
  return { type: 'disturbance', position: pos, isDecoy: false, age, data: { radius } };
}
function makeScent(pos, node, age, tolerance) {
  const d = Math.round(Math.hypot(node.x - pos.x, node.y - pos.y));
  if (d < 2 || d > 7) return null;
  return { type: 'scent', position: pos, isDecoy: false, age,
    data: { distance: d, tolerance, windBiasNeeded: false, biasDirection: Math.round(angleDeg(pos, node)) } };
}

const cells = [];
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells.push({ x, y });

// 每一齡挑兩條線索，要求交集恰為該節點一格
function solveAge(node, age) {
  const pool = [];
  for (const pos of cells) {
    if (key(pos) === key(node)) continue;
    for (const s of SPREADS) pool.push(makeFootprint(pos, node, age, s));
    for (const r of RADII) { const c = makeDisturbance(pos, node, age, r); if (c) pool.push(c); }
    for (const t of TOLERANCES) { const c = makeScent(pos, node, age, t); if (c) pool.push(c); }
  }
  // 型別混搭優先（教學希望三種線索都出現過），故先試不同 type 的配對
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].type === pool[j].type) continue;
      const cut = intersect([pool[i], pool[j]], SIZE);
      if (cut.size === 1 && [...cut][0] === key(node)) return [pool[i], pool[j]];
    }
  }
  return null;
}

outer:
for (const w0 of cells) {
  for (const step of [{ x: 1, y: -1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }]) {
    const w1 = { x: w0.x + step.x * 2, y: w0.y + step.y * 2 };
    const w2 = { x: w1.x + step.x * 2, y: w1.y + step.y * 2 };
    const target = { x: w2.x + step.x * 2, y: w2.y + step.y * 2 };
    if (![w1, w2, target].every(inGrid)) continue;
    const nodes = [w0, w1, w2];
    const sets = nodes.map((n, age) => solveAge(n, age));
    if (sets.some((s) => s === null)) continue;
    const all = sets.flat();
    if (intersect(all, SIZE).size !== 0) continue;
    console.log(JSON.stringify({ nodes, target, clues: all }, null, 2));
    break outer;
  }
}
```

- [ ] **Step 4: 跑搜尋腳本**

Run: `npx vite-node scripts/find-quarry-lesson.mjs`

（若 `vite-node` 不可用，改用 `npx tsx scripts/find-quarry-lesson.mjs`；兩者皆不可用時把 `clues.ts` 的 `candidates`／`intersect`／`key` 三個函式複製進腳本，改成純 `.mjs` 後用 `node scripts/find-quarry-lesson.mjs` 跑。）

Expected: 印出一組 JSON，含 `nodes`（3 個）、`target`、`clues`（6 條）。

> **找不到解時：** 依序放寬——`SPREADS` 加入 `35`、`RADII` 加入 `4`、`step` 加入更多方向、把 `solveAge` 的「型別必須不同」限制拿掉。每次放寬後重跑，並確認放寬後的參數仍在 Step 1 的區間斷言內。

- [ ] **Step 5: 把結果貼進 `demo.ts`**

在 `src/core/demo.ts` 的 `DEDUCTION_SCRIPT` 之前加入（數值全部來自 Step 4 的輸出，一個都不手寫）：

```ts
// ── 第二課：會走的獵物 ──────────────────────────────────────────
// 獵物走 W0 → W1 → W2 三個節點，每齡兩條線索反向錨定在「當時」所在的節點上，
// 與真實關卡的 route.ts + generate.ts 是同一套幾何。無幌子：幌子由第一課教完，
// 這一課要專心教齡別，兩件難事同時上等於兩件都沒教會。
//
// 這組資料由 scripts/find-quarry-lesson.mjs 窮舉找出，四條性質釘在
// tests/demo-quarry.test.ts。動任何一個數字之前，先跑測試。
export const QUARRY_SIZE = 9;
export const QUARRY_NODES: readonly Vec2[] = [/* Step 4 的 nodes */];
export const QUARRY_TARGET: Vec2 = /* Step 4 的 target */;
export const QUARRY_START: Vec2 = { x: 0, y: 8 }; // 左下角起步，離三個節點都夠遠
export const QUARRY_CLUES: readonly Clue[] = [/* Step 4 的 clues */];

// 最新齡兩條的交集（＝W2 一格）。第二章的自動存疑標記讀它——單一來源，不手寫。
export const QUARRY_PAIR: Set<string> = intersect(
  QUARRY_CLUES.filter((c) => c.age === 2), QUARRY_SIZE,
);
```

若 `QUARRY_START` 落在某個節點或線索格上，改挑另一個角落，並確認 Step 1 的界內斷言通過。

- [ ] **Step 6: 跑測試確認通過**

Run: `npx vitest run tests/demo-quarry.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 7: Commit**

```bash
git add src/core/demo.ts tests/demo-quarry.test.ts scripts/find-quarry-lesson.mjs
git commit -m "feat: solve the level data for the walking-quarry lesson

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 第二課的旁白與腳本

**Files:**
- Modify: `src/core/i18n.ts`（旁白字串）
- Modify: `src/core/demo.ts`（`QUARRY_STEPS`、`QUARRY_SCRIPT`、`demoScript` 分派）
- Modify: `tests/demo-quarry.test.ts`（旁白佔位符對稱測試）

**Interfaces:**
- Consumes: Task 11 的 `QUARRY_*` 常數
- Produces: `const QUARRY_SCRIPT: DemoScript`；`demoScript('quarry')` 回傳它

- [ ] **Step 1: 加旁白字串**

`MsgKey` 聯集：

```ts
  | 'demo2.title' | 'demo2.ch1' | 'demo2.ch2' | 'demo2.ch3'
  | 'demo2.s1' | 'demo2.s2' | 'demo2.s3' | 'demo2.s4' | 'demo2.s5'
  | 'demo2.s6' | 'demo2.s7' | 'demo2.s8'
  | 'demo2.hint.wager' | 'btn.demo2'
```

`en` 表：

```ts
    'demo2.title': 'The Walking Quarry',
    'demo2.ch1': 'It did not stay put',
    'demo2.ch2': 'One age at a time',
    'demo2.ch3': 'Lead it',
    'demo2.s1': 'Six clues, all honest. Layer them all and {n} cells agree with everything — none.',
    'demo2.s2': 'Nothing is lying. The clues disagree because it was walking: each one marks where it passed.',
    'demo2.s3': 'Every clue carries a freshness. These six are three pairs — older, night, morning.',
    'demo2.s4': 'Set the freshness chip to the newest age. Only two clues left.',
    'demo2.s5': 'Those two agree on one cell. That is where it was this morning.',
    'demo2.s6': 'Do the same for the other two ages and you get three cells — where it was, in order.',
    'demo2.s7': 'Three cells in a line, evenly spaced. It is still walking. Call the next one.',
    'demo2.s8': 'There it was. Clues say where it has been; freshness says when; together they say where it is going.',
    'demo2.hint.wager': 'That is where it was, not where it is heading. Step one more along the line.',
    'btn.demo2': '[ Walkthrough: Moving Quarry ]',
```

`zh-TW` 表：

```ts
    'demo2.title': '會走的獵物',
    'demo2.ch1': '牠沒有待在原地',
    'demo2.ch2': '一次只看一齡',
    'demo2.ch3': '往前帶',
    'demo2.s1': '六條線索，全是真的。全部疊起來，符合每一條的格子有 {n} 個——一個也沒有。',
    'demo2.s2': '沒有人在說謊。線索彼此矛盾，是因為牠一路在走：每一條標的都是牠「經過」的地方。',
    'demo2.s3': '每條線索都帶有新鮮度。這六條是三組——更早、夜間、晨間。',
    'demo2.s4': '把新鮮度 chip 切到最新的一齡。只剩兩條了。',
    'demo2.s5': '這兩條交在同一格。那是牠今天早上所在的位置。',
    'demo2.s6': '另外兩齡照做，你會得到三個格子——牠依序待過的地方。',
    'demo2.s7': '三格成一直線、間距相等。牠還在走。押下一格。',
    'demo2.s8': '牠在這裡。線索說牠去過哪，新鮮度說那是什麼時候，合起來才知道牠要去哪。',
    'demo2.hint.wager': '那是牠待過的地方，不是牠要去的地方。沿著這條線再往前一格。',
    'btn.demo2': '［示範：會走的獵物］',
```

- [ ] **Step 2: 寫腳本步驟**

在 `src/core/demo.ts` 的 `QUARRY_PAIR` 之後加入：

```ts
const QUARRY_ALL_AGREE = intersect([...QUARRY_CLUES], QUARRY_SIZE).size; // 恆為 0，由測試釘死

export const QUARRY_STEPS: readonly DemoStep[] = [
  // 第一章：牠沒有待在原地
  {
    chapter: 1, narration: 'demo2.s1', vars: { n: QUARRY_ALL_AGREE },
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  {
    chapter: 1, narration: 'demo2.s2',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  // 第二章：一次只看一齡
  {
    chapter: 2, narration: 'demo2.s3',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  {
    chapter: 2, narration: 'demo2.s4',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: 2,
    seen: 'all', player: QUARRY_START, action: 'pick-age',
  },
  {
    chapter: 2, narration: 'demo2.s5',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: 2,
    seen: 'all', player: QUARRY_START, autoSuspect: true,
  },
  // 第三章：往前帶
  {
    chapter: 3, narration: 'demo2.s6',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  {
    chapter: 3, narration: 'demo2.s7',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: null,
    seen: 'all', player: QUARRY_START, action: 'wager',
  },
  {
    chapter: 3, narration: 'demo2.s8',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
];

export const QUARRY_SCRIPT: DemoScript = {
  id: 'quarry',
  size: QUARRY_SIZE,
  start: QUARRY_START,
  target: QUARRY_TARGET,
  clues: QUARRY_CLUES,
  steps: QUARRY_STEPS,
  fogRows: 0, // 這一課不教視野；迷霧只會分散注意力
  titleKey: 'demo2.title',
  pair: QUARRY_PAIR,
  // 只接受外推點。押在任何一個節點上，代表「牠還在走」這件事還沒學會——
  // 此時給提示比給通過更有價值（同第一課 checkCellAction 的判準）。
  checkCell: (_action, cell) =>
    key(cell) === key(QUARRY_TARGET) ? null : 'demo2.hint.wager',
  // 這一課沒有幌子，靜音不在課程內。保留介面完整性，一律回退提示。
  checkClue: () => 'demo2.hint.wager',
  unseen: () => new Set<string>(),
};
```

`DemoStep.chapter` 目前的型別是 `1 | 2 | 3 | 4`，第二課只用到 1–3，不需改型別。

- [ ] **Step 3: 接上 `demoScript`**

```ts
export function demoScript(id: DemoScriptId): DemoScript {
  return id === 'quarry' ? QUARRY_SCRIPT : DEDUCTION_SCRIPT;
}
```

- [ ] **Step 4: 加旁白對稱測試**

在 `tests/demo-quarry.test.ts` 檔尾附加：

```ts
describe('quarry lesson script', () => {
  it('covers three chapters in order', () => {
    const chapters = QUARRY_SCRIPT.steps.map((s) => s.chapter);
    expect(chapters[0]).toBe(1);
    expect(chapters.at(-1)).toBe(3);
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i]).toBeGreaterThanOrEqual(chapters[i - 1]);
    }
  });

  it('matches every narration placeholder to a var', () => {
    for (const step of QUARRY_SCRIPT.steps) {
      for (const table of Object.values(STRINGS)) {
        const text = table[step.narration];
        const placeholders = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(placeholders).toEqual(Object.keys(step.vars ?? {}).sort());
      }
    }
  });

  it('only accepts the extrapolated cell as the call', () => {
    expect(QUARRY_SCRIPT.checkCell('wager', QUARRY_TARGET)).toBeNull();
    for (const node of QUARRY_NODES) {
      expect(QUARRY_SCRIPT.checkCell('wager', node)).toBe('demo2.hint.wager');
    }
  });

  it('asks the player to pick an age, then to call it', () => {
    const actions = QUARRY_SCRIPT.steps.map((s) => s.action).filter(Boolean);
    expect(actions).toEqual(['pick-age', 'wager']);
  });
});
```

import 補上 `QUARRY_SCRIPT` 與 `STRINGS`。

- [ ] **Step 5: 跑測試**

Run: `npm test && npm run build`
Expected: 全綠、無型別錯誤

- [ ] **Step 6: 加第二顆示範入口**

在 `src/scenes/HelpScene.ts` 的示範按鈕處，把單顆按鈕改成上下兩顆（各高 32、間距 8，總高仍在原本 36px 的預算內加 40px；`this.listTop` 與 `viewH` 跟著往下 48px）：

```ts
    const demoButtons: { key: Parameters<I18n['t']>[0]; scriptId: 'deduction' | 'quarry' }[] = [
      { key: 'btn.demo', scriptId: 'deduction' },
      { key: 'btn.demo2', scriptId: 'quarry' },
    ];
    demoButtons.forEach((b, i) => {
      const by = py0 + 168 + i * 40;
      const g = this.add.graphics();
      g.lineStyle(1.5, pal.gold, 0.8).strokeRoundedRect(cx - dbw / 2, by - 16, dbw, 32, BRUSH_RADIUS);
      this.add.text(cx, by, stripBrackets(i18n.t(b.key)).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(1.5);
      this.add.rectangle(cx, by, dbw, Math.max(32, 44), 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          // 先 launch 再 stop：兩者都是排進 SceneManager 的操作，依序處理
          this.scene.launch('Demo', { from: this.from, scriptId: b.scriptId });
          this.scene.stop();
        });
    });
```

並把 `this.listTop = py0 + 208;` 改為 `this.listTop = py0 + 248;`。

- [ ] **Step 7: 手動驗收**

Run: `npm run dev`。從說明頁進第二課，走完 8 步：確認第 1 步熱區沒有任何格達到滿分、第 4 步必須切 chip 才前進、第 7 步押在節點上會出提示、押在外推點才過、第 8 步揭曉在外推點。再回第一課走一遍，確認 14 步毫無變化。

- [ ] **Step 8: Commit**

```bash
git add src/core/i18n.ts src/core/demo.ts src/scenes/HelpScene.ts tests/demo-quarry.test.ts
git commit -m "feat: teach the walking quarry with a second walkthrough lesson

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

# Phase 4 — 元進程首見提示

## Task 13: 元進程的教學文案

**Files:**
- Modify: `src/core/i18n.ts`

**Interfaces:**
- Produces: 4 個新 `MsgKey`：`coach.tool.windstone`、`coach.tool.glowbell`、`coach.codex`、`coach.commission`、`coach.daily`（5 個）

- [ ] **Step 1: 擴充 `MsgKey` 聯集**

```ts
  | 'coach.tool.windstone' | 'coach.tool.glowbell'
  | 'coach.codex' | 'coach.commission' | 'coach.daily'
```

- [ ] **Step 2: 補 `en` 表**

```ts
    'coach.tool.windstone': 'You are carrying the windstone. Scent rings now lean toward the source — the thick side of the arc is the near side.',
    'coach.tool.glowbell': 'You are carrying the glowbell. Tap its chip once a hunt to ring out one false trail.',
    'coach.codex': 'Each record adds field notes, and notes raise a research level. Traces you have found but not recorded show as rumors.',
    'coach.commission': 'Three commissions post each day. Meet one on any hunt and it pays field notes.',
    'coach.daily': "Today's Trail is the same map for everyone. Finish it to build a streak — every seventh day earns a rest token that covers a missed day.",
```

- [ ] **Step 3: 補 `zh-TW` 表**

```ts
    'coach.tool.windstone': '你帶著風向石。氣味環現在會朝源頭偏心——弧線較厚的那一側就是靠近的那一側。',
    'coach.tool.glowbell': '你帶著輝鈴。每局點它的 chip 一次，可以敲掉一條假蹤跡。',
    'coach.codex': '每筆記錄都會累積田野筆記，筆記推高研究度。找到痕跡卻尚未記錄的物種會顯示為傳聞。',
    'coach.commission': '每天張貼三則委託。任何一局達成都會付田野筆記。',
    'coach.daily': '「今日行蹤」全世界同一張圖。完成會累積連勝——每滿七天贈一枚歇腳符，可以補一天沒跑的空缺。',
```

- [ ] **Step 4: 驗證與 Commit**

Run: `npx vitest run tests/i18n.test.ts && npm run build`
Expected: PASS、無型別錯誤

```bash
git add src/core/i18n.ts
git commit -m "feat: write the first-encounter copy for tools, the guide, commissions and the daily

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: 道具、圖鑑、營地的掛點

**Files:**
- Modify: `src/scenes/MapScene.ts`（道具）
- Modify: `src/scenes/CodexScene.ts`（研究點）
- Modify: `src/scenes/CampScene.ts`（委託、每日）

**Interfaces:**
- Consumes: `coachOnce`／`CoachStore`（Task 1）、Task 13 的 5 個字串、Task 4 的 `coachTip` 私有方法
- Produces: 無

- [ ] **Step 1: 道具（`MapScene`）**

在 `create()` 的 `this.coach = this.registry.get('coach');` 之後、`fadeIn(this)` 之前加入：

```ts
    // 道具首見：持有中且進到獵局時教一次。解鎖 toast 只說了「解鎖了」，
    // 沒說它在這一局怎麼用——輝鈴尤其，玩家不會知道 HUD 上多出來的 chip 能點。
    if (this.tools.has('windstone')) this.coachTip('tool.windstone', 'coach.tool.windstone');
    else if (this.tools.has('glowbell')) this.coachTip('tool.glowbell', 'coach.tool.glowbell');
```

用 `else if` 而非兩個 `if`：`coachTip` 共用同一個底部橫條，同一幀寫兩次只有後者看得到，前者卻已被標記為已見，等於永久漏教。兩者都持有時風向石先教，輝鈴留到下一局。

- [ ] **Step 2: 圖鑑（`CodexScene`）**

在 `create()` 尾端（按鈕建立之後）加入：

```ts
    const coach: CoachStore = this.registry.get('coach');
    coachOnce(coach, 'codex', () => {
      this.add.text(this.scale.width / 2, this.scale.height - 74, i18n.t('coach.codex'), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
        wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
      }).setOrigin(0.5).setDepth(90);
    });
```

y 取 `height - 74`：`CodexScene` 的返回鈕在 `height - 52` 一帶，往上 22px 不會壓到它。實作時先 `grep -n "height - " src/scenes/CodexScene.ts` 確認返回鈕的實際座標，必要時調整。

加 import：`import { coachOnce, type CoachStore } from '../core/coach';`

- [ ] **Step 3: 營地（`CampScene`）**

`CampScene` 的按鈕列已由 `flowY` 排定（同 `ResultScene`）。在 blocks 組裝處加入一個教學區塊，並沿用 Result 的「一次只教一則」做法：

```ts
    const coach: CoachStore = this.registry.get('coach');
    const campCandidates: [CoachId, MsgKey][] = [];
    if (!dailyDone) campCandidates.push(['daily', 'coach.daily']);
    if (doneCount < 3) campCandidates.push(['commission', 'coach.commission']);
    const campPick = campCandidates.find(([id]) => !coach.seen(id)) ?? null;
```

在按鈕區塊之後、委託列之前 `add('coach', { h: 32, gap: 14, minGap: 8 })`（僅當 `campPick` 非 null），並在繪製處：

```ts
    if (campPick) {
      const [id, msgKey] = campPick;
      coachOnce(coach, id, () => {
        this.add.text(cx, at('coach'), i18n.t(msgKey), {
          fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
          wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
      });
    }
```

`dailyDone` 與 `doneCount` 是 `CampScene` 既有的區域變數（見 `camp.dailyDone` 與 `comm.title {doneCount}/3` 的繪製處）；實作時先確認確切名稱。

- [ ] **Step 4: 驗證**

Run: `npm test && npm run build`
Expected: 全綠、無型別錯誤

- [ ] **Step 5: 手動驗收**

Run: `npm run dev`。DevTools Console：`localStorage.removeItem('rht.seen.v1')`，重新載入。確認營地出現**一則**教學行、按鈕未被推出畫面；開圖鑑確認底部出現說明且未壓到返回鈕；把瀏覽器高度縮到 600px 再確認一次。

- [ ] **Step 6: Commit**

```bash
git add src/scenes/MapScene.ts src/scenes/CodexScene.ts src/scenes/CampScene.ts
git commit -m "feat: explain tools, the field guide, commissions and the daily on first sight

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: 全流程驗收

**Files:** 無（純驗證）

- [ ] **Step 1: 全套測試**

Run: `npm test`
Expected: 全部通過，含 `coach.test.ts`（12）、`demo-quarry.test.ts`（13）、既有 36 支檔案全綠

- [ ] **Step 2: 型別與建置**

Run: `npm run build`
Expected: `tsc --noEmit` 無錯誤；vite build 成功

- [ ] **Step 3: 清空所有旗標走一遍新玩家路徑**

Run: `npm run dev`。DevTools Console：

```js
['rht.seen.v1','rht.tut.v1','rht.help.v1','rht.run.v1','rht.score.v1','rht.tools.v1','rht.codex.v2']
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

依序確認：
1. 說明頁自動彈出，32 列分四組可捲動，兩顆示範按鈕
2. 第一課 14 步、第二課 8 步各走一遍
3. 第 1 局四句引導照常運作，引導期間**不出現**任何 coach 提示
4. 引導結束後走路，觸發微事件時出現對應說明，8 秒後消失，同類事件不再出現
5. 撿到補給出現說明；讀到第二種齡別出現齡別說明
6. 結算畫面出現一則教學行，按鈕完整可按
7. 回營地出現一則教學行

- [ ] **Step 4: 矮視窗回歸**

把瀏覽器高度調到 600px，重跑 Step 3 的第 1、6、7 項。確認說明頁列表可捲動、結算與營地的按鈕都在畫面內。

- [ ] **Step 5: 語系回歸**

在說明頁點 EN / 中 切換，確認兩種語系下所有新文案都有內容、無空白列、無字面 key 外洩。

- [ ] **Step 6: Commit（若前面步驟有任何修補）**

```bash
git add -A
git commit -m "fix: close the gaps found in the tutorial's end-to-end pass

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 紀錄

**規格覆蓋** — 規格 §5 機制指派表 16 項逐一對照：

| 規格項 | 落在 |
|---|---|
| 1 獵物移動＋習性 | Help（Task 8）、Demo 新課（Task 11–12）、JIT `coach.route`（Task 5） |
| 2 齡別＋chip | Help（Task 8）、Demo 第 2 章（Task 12）、JIT `age.second`（Task 4，靠 Task 2 的純函式） |
| 3 Bank/Push | Help（Task 8）、JIT（Task 5） |
| 4 iris | Help（Task 8）、JIT（Task 5） |
| 5 隨機事件 ×3 | Help（Task 8）、JIT 三個獨立旗標（Task 4） |
| 6 補給 | Help（Task 8）、JIT（Task 4） |
| 7 品質門檻 | Help `help.marks` 已存在、JIT `coach.quality`（Task 5） |
| 8 靜音語意 | Help `help.mute`（Task 7–8） |
| 9 天氣 | Help：`help.weather` 總結列保留，另加 `help.wx.*` 四個逐項列（Task 7–8） |
| 10 infoAt | Help（Task 8）、JIT（Task 5） |
| 11 quirks | Help（Task 8） |
| 12 難度遞增 | Help（Task 8） |
| 13 道具 ×2 | Help `help.tools`（Task 8）、JIT（Task 14） |
| 14 圖鑑 | Help（Task 8）、JIT（Task 14） |
| 15 委託 | Help（Task 8）、JIT（Task 14） |
| 16 每日 | Help（Task 8）、JIT（Task 14） |

規格 §5 的 16 項全部有對應 task，無缺口。

**佔位符掃描：** Task 6 Step 2 的 `/* 原 xxx 的 icon 內容 */` 是「逐字搬運既有程式碼」的指示，來源在同一個檔案的同一次編輯中就在眼前，不是要實作者自行發明內容——保留此形式以免把 130 行既有繪圖碼原樣複製進計畫。Task 11 Step 5 的 `/* Step 4 的 nodes */` 同理：那些數值必須由 Step 4 的搜尋腳本跑出來，寫死在計畫裡就是捏造。

**型別一致性：** `CoachId`（Task 1）在 Task 4／5／14 的用法一致；`DemoScript` 各欄位（Task 9）在 Task 10 的替換表與 Task 12 的 `QUARRY_SCRIPT` 一致；`heatAge` 型別 `0 | 1 | 2 | null` 在 Task 9 定義、Task 10 消費、Task 12 賦值三處相同。
