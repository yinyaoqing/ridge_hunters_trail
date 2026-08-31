# Phase 1: 黏著基礎（玩法 P1/P2/P3 ＋ UI U1/U2/U3/U5/U6）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 整合已核准的兩份提案（`docs/superpowers/specs/2026-08-31-gameplay-retention-optimization-design.md` 與 `2026-08-31-ui-optimization-design.md`），實作 Phase 1「黏著基礎」：失敗軟著陸（觀察筆記／研究度）、記錄品質（銅銀金）、每日挑戰（連勝＋分享卡），以及承載它們的 UI——響應式＋觸控、回饋層、結算改版、圖鑑改版、營地主選單。

**Architecture:** 延續 MVP 架構：所有新玩法邏輯（品質判定、圖鑑 v2 存檔、每日種子、連勝規則、分享文字）為純 TypeScript 模組，Vitest TDD；場景層為薄渲染（Graphics/Text，無外部素材），以 `npm run build`＋冒煙清單驗證。場景流程改為 Boot → Camp（營地）→ Map，Result 不再自動推進 session，改由按鈕明確建立下一局。

**Tech Stack:** Phaser 3、TypeScript（strict）、Vite、Vitest（皆已安裝，無新相依）。

## Global Constraints

- 世界觀完全架空原創；**嚴禁**真實文化圖騰／族群／宗教／地名（規格書 §2）。
- 全程無死亡/血腥字眼；失敗一律「逃逸/溜走」（escaped / slipped away），PEGI 3–7。
- 所有玩家可見字串一律 `i18n.t()`，en 與 zh-TW key 集合必須一致（既有測試把關）；不得在場景硬編碼字串。
- 不打包字型檔、不加外部素材檔、不引入 DOM 疊層 UI（維持 Poki 8MB 優化空間；UI 報告 §6）。
- 不做常駐循環動畫（低體力脈動為狀態指示，屬例外；UI 報告 §6）。
- 所有隨機性經可注入種子的 RNG（`mulberry32`）。
- 數值集中：難度數值在 `difficulty.ts`；本計畫新增的研究度/連勝數值集中在 `codex.ts`/`daily.ts` 常數。
- 連勝規則家庭向軟化：漏一天以歇腳符抵扣，抵扣不足**減半不歸零**（藍圖 §4 倫理紅線）。
- Windows 開發環境：驗證指令以 PowerShell 語法書寫。
- Vite `base: './'` 維持不動（itch.io 相對路徑）。

## 設計決策（整合兩份提案的落地細節）

1. **品質判定（P3）**：QTE 增記每次命中的「弧心偏移」`offsets[]`（0=正中、1=弧緣）。品質 = 有失手 → 銅；全中 → 銀；全中且平均偏移 ≤ 0.5 → 金。理由：現行參數下最多只能失手一次，單用失手數只有兩級可達，加入精準度才有三級與精熟目標。
2. **研究度（P2）**：筆記 +1 分、成功記錄 +3 分。里程碑：3 分揭示名稱（未收錄也可）、8 分揭示描述與地形偏好。失敗掉落筆記數：已判讀 0 條線索 → 1 枚、1–2 條 → 2 枚、≥3 條 → 3 枚。
3. **圖鑑存檔 v2**：`rht.codex.v2` 儲存 `{count, research, bestQuality}`；啟動時自動遷移 v1（count → research=count×3、bestQuality='bronze'）。
4. **每日挑戰（P1）**：UTC 日期 `YYYYMMDD` 為種子、固定第 5 局難度（tier 2）。連勝：每連續 7 天 +1 歇腳符（上限 3）；漏 n 天扣 n 符；不足則連勝減半+1。同日重玩不重複計數。
5. **場景流程**：Boot → Camp。Result 不再呼叫 `nextSession` 自動推進；主線進度存 registry `runRound`，按鈕明確建立新 session。`SessionState` 增 `resolved` 旗標防止 Result 因 resize 重啟而重複記帳。
6. **響應式（U1）**：`Scale.RESIZE` ＋ 各場景 resize 後 debounce 150ms 重啟（`scene.restart()`；session 都在 registry，安全）。QTE 中途 resize 會重開小遊戲，屬可接受邊角。
7. **觸控標記（U1）**：長按 350ms 或 HUD「標記模式」切換鈕；桌面保留 Shift+點擊。所有可點元素命中區 ≥ 44px。

## File Structure

```
src/core/qte.ts          修改：QteState 增 offsets[]（命中精準度）        ← Task 1
src/core/quality.ts      新增：Quality 型別與 qualityFromQte/maxQuality  ← Task 1
src/core/codex.ts        改寫：v2 schema（研究度/品質/遷移）＋notesForRun ← Task 2
src/core/session.ts      修改：steps/mode/resolved 欄位                  ← Task 3
src/core/daily.ts        新增：每日種子/日期鍵/連勝存檔/每日 session      ← Task 4
src/core/share.ts        新增：分享成績卡文字                            ← Task 5
src/core/i18n.ts         修改：新 UI 全部字串 key（camp/quality/share…） ← Task 5
src/scenes/fx.ts         新增：fadeIn/fadeToScene/floatText/restartOnResize ← Task 6
src/main.ts              修改：RESIZE、Camp 場景註冊、streak registry     ← Task 6, 12
src/scenes/MapScene.ts   修改：響應式佈局、觸控標記、移動tween、揭示演出   ← Task 6, 7, 8, 9
src/scenes/QteScene.ts   修改：命中/失手回饋、收尾演出、qteOutcome 傳遞    ← Task 9
src/scenes/paint.ts      修改：QUALITY_COLORS                            ← Task 10
src/scenes/ResultScene.ts 改寫：品質蓋印/筆記掉落/進度點列/每日分享       ← Task 10, 13
src/scenes/CodexScene.ts 改寫：捲動列表/研究度條/里程碑揭示/品質章        ← Task 11
src/scenes/CampScene.ts  新增：營地主選單                               ← Task 12
src/scenes/HelpScene.ts  修改：resume 目標參數化（Camp/Map 皆可開啟）     ← Task 12
src/scenes/BootScene.ts  修改：Boot → Camp、dev jump 增列 Camp           ← Task 12
tests/qte.test.ts        修改：offsets 行為
tests/quality.test.ts    新增
tests/codex.test.ts      改寫：v2 API＋遷移
tests/session.test.ts    修改：steps/mode/resolved
tests/daily.test.ts      新增
tests/share.test.ts      新增
```

---

### Task 1: QTE 命中精準度與品質判定（P3 核心）

**Files:**
- Modify: `src/core/qte.ts`
- Create: `src/core/quality.ts`
- Modify: `tests/qte.test.ts`（追加測試，不動既有）
- Test: `tests/quality.test.ts`

**Interfaces:**
- Consumes: `QteState`/`newQte`/`press`（既有）、`QteParams`（difficulty.ts）
- Produces:
  - `QteState.offsets: number[]`（每次命中的弧心偏移，0=正中、1=弧緣）
  - `type Quality = 'bronze' | 'silver' | 'gold'`
  - `const QUALITY_RANK: Record<Quality, number>`（bronze:0, silver:1, gold:2）
  - `qualityFromQte(q: QteState): Quality`
  - `maxQuality(a: Quality | null, b: Quality): Quality`

- [ ] **Step 1: 在 tests/qte.test.ts 追加失敗測試**

```typescript
// 追加於既有 describe 之後
describe('offsets (hit precision)', () => {
  const cfg = { speed: 180, arcSize: 40, rounds: 3, needed: 2 };
  it('records offset 0 for a dead-center hit and ~1 near the edge', () => {
    const rng = () => 0.5; // arcStart = 0.5 * (360-40) = 160, 弧心 = 180
    const q = newQte(cfg, rng);
    q.pointer = 180; // 正中
    press(q, cfg, rng);
    expect(q.offsets).toHaveLength(1);
    expect(q.offsets[0]).toBeCloseTo(0);
    q.pointer = 160.5; // 貼近弧緣（新弧同樣 160–200）
    press(q, cfg, rng);
    expect(q.offsets[1]).toBeCloseTo(0.975);
  });
  it('does not record offsets on misses', () => {
    const rng = () => 0.5;
    const q = newQte(cfg, rng);
    q.pointer = 10; // 弧區外
    press(q, cfg, rng);
    expect(q.offsets).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/qte.test.ts`
Expected: FAIL — `q.offsets` undefined

- [ ] **Step 3: 修改 src/core/qte.ts**

```typescript
export interface QteState {
  attempt: number;
  hits: number;
  arcStart: number;        // 命中弧區起始角（度）
  pointer: number;         // 指針目前角度（度）
  done: boolean;
  success: boolean | null; // done 前為 null
  lastHit: boolean | null; // 供渲染層做回饋
  offsets: number[];       // 每次命中的弧心偏移（0=正中、1=弧緣），供品質判定
}
```

`newQte` 回傳物件加入 `offsets: []`。`press` 的命中分支改為：

```typescript
  const hit = q.pointer >= q.arcStart && q.pointer <= q.arcStart + cfg.arcSize;
  q.lastHit = hit;
  if (hit) {
    q.hits++;
    const center = q.arcStart + cfg.arcSize / 2;
    q.offsets.push(Math.abs(q.pointer - center) / (cfg.arcSize / 2));
  }
  q.attempt++;
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/qte.test.ts`
Expected: PASS（既有＋新增全部）

- [ ] **Step 5: 寫失敗測試 tests/quality.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { qualityFromQte, maxQuality, QUALITY_RANK } from '../src/core/quality';
import type { QteState } from '../src/core/qte';

const q = (attempt: number, hits: number, offsets: number[]): QteState =>
  ({ attempt, hits, arcStart: 0, pointer: 0, done: true, success: true, lastHit: true, offsets });

describe('qualityFromQte', () => {
  it('any miss yields bronze', () => {
    expect(qualityFromQte(q(3, 2, [0.1, 0.1]))).toBe('bronze');
  });
  it('all hits with loose precision yields silver', () => {
    expect(qualityFromQte(q(2, 2, [0.9, 0.4]))).toBe('silver'); // 平均 0.65 > 0.5
  });
  it('all hits with tight precision yields gold', () => {
    expect(qualityFromQte(q(2, 2, [0.3, 0.5]))).toBe('gold'); // 平均 0.4 ≤ 0.5
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

- [ ] **Step 6: 執行測試確認失敗**

Run: `npx vitest run tests/quality.test.ts`
Expected: FAIL — `Cannot find module '../src/core/quality'`

- [ ] **Step 7: 實作 src/core/quality.ts**

```typescript
import type { QteState } from './qte';

export type Quality = 'bronze' | 'silver' | 'gold';

export const QUALITY_RANK: Record<Quality, number> = { bronze: 0, silver: 1, gold: 2 };

// 有失手 → 銅；全中 → 銀；全中且平均弧心偏移 ≤ 0.5 → 金
export function qualityFromQte(q: QteState): Quality {
  if (q.attempt - q.hits > 0) return 'bronze';
  const avg = q.offsets.reduce((s, o) => s + o, 0) / Math.max(1, q.offsets.length);
  return avg <= 0.5 ? 'gold' : 'silver';
}

export function maxQuality(a: Quality | null, b: Quality): Quality {
  return a !== null && QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b;
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run tests/quality.test.ts tests/qte.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```powershell
git add src/core/qte.ts src/core/quality.ts tests/qte.test.ts tests/quality.test.ts
git commit -m "feat: record QTE hit precision and derive bronze/silver/gold record quality"
```

---

### Task 2: 圖鑑 v2（研究度／品質／v1 遷移）與筆記掉落（P2 核心）

**Files:**
- Rewrite: `src/core/codex.ts`
- Rewrite: `tests/codex.test.ts`

**Interfaces:**
- Consumes: `Quality`/`maxQuality`（Task 1）
- Produces:
  - `interface CodexEntry { count: number; research: number; bestQuality: Quality | null }`
  - `const RESEARCH_NOTE = 1`、`const RESEARCH_RECORD = 3`
  - `const MILESTONE_NAME = 3`（揭示名稱）、`const MILESTONE_DETAIL = 8`（揭示描述＋地形偏好）
  - `interface CodexStore { entries(): Record<string, CodexEntry>; entry(id): CodexEntry; counts(): Record<string, number>; addRecord(id, quality): void; addNotes(id, notes): void }`
  - `createCodex(storage?): CodexStore`（v2 key `rht.codex.v2`；無 v2 時自動遷移 v1 `rht.codex.v1`）
  - `notesForRun(readClueCount: number): number`（0→1、1–2→2、≥3→3）

- [ ] **Step 1: 改寫 tests/codex.test.ts 為失敗測試**

```typescript
import { describe, it, expect } from 'vitest';
import {
  createCodex, notesForRun, RESEARCH_NOTE, RESEARCH_RECORD,
  MILESTONE_NAME, MILESTONE_DETAIL,
} from '../src/core/codex';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

describe('createCodex v2', () => {
  it('addRecord tracks count, research and best quality', () => {
    const codex = createCodex(fakeStorage());
    codex.addRecord('mistfawn', 'silver');
    codex.addRecord('mistfawn', 'bronze'); // 較差品質不覆蓋
    expect(codex.entry('mistfawn')).toEqual({
      count: 2, research: 2 * RESEARCH_RECORD, bestQuality: 'silver',
    });
  });

  it('addNotes accumulates research without count', () => {
    const codex = createCodex(fakeStorage());
    codex.addNotes('veilmoth', 2);
    expect(codex.entry('veilmoth')).toEqual({
      count: 0, research: 2 * RESEARCH_NOTE, bestQuality: null,
    });
  });

  it('entry of unknown id is the empty entry', () => {
    expect(createCodex().entry('nobody')).toEqual({ count: 0, research: 0, bestQuality: null });
  });

  it('counts() derives id -> count for discovered creatures only', () => {
    const codex = createCodex(fakeStorage());
    codex.addRecord('emberquill', 'gold');
    codex.addNotes('veilmoth', 1);
    expect(codex.counts()).toEqual({ emberquill: 1 });
  });

  it('persists via storage under v2 key', () => {
    const storage = fakeStorage();
    createCodex(storage).addRecord('dewhopper', 'gold');
    expect(createCodex(storage).entry('dewhopper').bestQuality).toBe('gold');
    expect(storage.dump()['rht.codex.v2']).toBeDefined();
  });

  it('migrates v1 counts (research = count*RECORD, bronze quality)', () => {
    const storage = fakeStorage({ 'rht.codex.v1': JSON.stringify({ mistfawn: 2 }) });
    const codex = createCodex(storage);
    expect(codex.entry('mistfawn')).toEqual({
      count: 2, research: 2 * RESEARCH_RECORD, bestQuality: 'bronze',
    });
  });

  it('recovers from corrupted stored data', () => {
    const codex = createCodex(fakeStorage({ 'rht.codex.v2': 'not-json{{{' }));
    expect(codex.entries()).toEqual({});
  });

  it('works without storage (in-memory fallback)', () => {
    const codex = createCodex();
    codex.addRecord('plumetail', 'bronze');
    expect(codex.counts()).toEqual({ plumetail: 1 });
  });
});

describe('notesForRun', () => {
  it('always drops at least one note, capped at three', () => {
    expect(notesForRun(0)).toBe(1);
    expect(notesForRun(1)).toBe(2);
    expect(notesForRun(2)).toBe(2);
    expect(notesForRun(3)).toBe(3);
    expect(notesForRun(9)).toBe(3);
  });
});

describe('milestones', () => {
  it('name unlocks before detail', () => {
    expect(MILESTONE_NAME).toBeLessThan(MILESTONE_DETAIL);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/codex.test.ts`
Expected: FAIL — 匯出不存在

- [ ] **Step 3: 改寫 src/core/codex.ts**

```typescript
import { maxQuality, type Quality } from './quality';

export interface CodexEntry {
  count: number;               // 成功記錄次數
  research: number;            // 研究度（筆記＋記錄累積）
  bestQuality: Quality | null; // 歷史最佳記錄品質
}

export const RESEARCH_NOTE = 1;   // 一枚觀察筆記的研究度
export const RESEARCH_RECORD = 3; // 一次成功記錄的研究度
export const MILESTONE_NAME = 3;  // 達標揭示：名稱
export const MILESTONE_DETAIL = 8; // 達標揭示：描述＋地形偏好

// 失敗軟著陸：依已判讀線索數掉落筆記（至少 1、至多 3）
export function notesForRun(readClueCount: number): number {
  if (readClueCount <= 0) return 1;
  return readClueCount <= 2 ? 2 : 3;
}

export interface CodexStore {
  entries(): Record<string, CodexEntry>;
  entry(id: string): CodexEntry;
  counts(): Record<string, number>;
  addRecord(id: string, quality: Quality): void;
  addNotes(id: string, notes: number): void;
}

const V1_KEY = 'rht.codex.v1';
const V2_KEY = 'rht.codex.v2';
const EMPTY: CodexEntry = { count: 0, research: 0, bestQuality: null };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function migrateV1(storage: Store): Record<string, CodexEntry> {
  try {
    const v1 = JSON.parse(storage.getItem(V1_KEY) ?? 'null');
    if (!v1 || typeof v1 !== 'object') return {};
    const out: Record<string, CodexEntry> = {};
    for (const [id, n] of Object.entries(v1)) {
      const count = typeof n === 'number' && n > 0 ? n : 0;
      if (count > 0) out[id] = { count, research: count * RESEARCH_RECORD, bestQuality: 'bronze' };
    }
    return out;
  } catch {
    return {};
  }
}

export function createCodex(storage?: Store): CodexStore {
  let mem: Record<string, CodexEntry> = {};

  const load = (): Record<string, CodexEntry> => {
    if (!storage) return mem;
    try {
      const raw = storage.getItem(V2_KEY);
      if (raw === null) return migrateV1(storage);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const save = (data: Record<string, CodexEntry>): void => {
    mem = data;
    if (!storage) return;
    try {
      storage.setItem(V2_KEY, JSON.stringify(data));
    } catch {
      // storage 不可用（隱私模式等）時退回記憶體
    }
  };

  return {
    entries: load,
    entry: (id) => load()[id] ?? { ...EMPTY },
    counts() {
      const out: Record<string, number> = {};
      for (const [id, e] of Object.entries(load())) if (e.count > 0) out[id] = e.count;
      return out;
    },
    addRecord(id, quality) {
      const data = load();
      const e = data[id] ?? { ...EMPTY };
      data[id] = {
        count: e.count + 1,
        research: e.research + RESEARCH_RECORD,
        bestQuality: maxQuality(e.bestQuality, quality),
      };
      save(data);
    },
    addNotes(id, notes) {
      const data = load();
      const e = data[id] ?? { ...EMPTY };
      data[id] = { ...e, research: e.research + notes * RESEARCH_NOTE };
      save(data);
    },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/codex.test.ts`
Expected: PASS

注意：此時 `ResultScene.ts`/`CodexScene.ts` 仍呼叫舊 API `codex.add()` → 編譯會壞。`counts()` 保留、`add()` 已移除；**本 task 先暫時修補場景讓 build 過**：`ResultScene.ts` 第 32 行 `codex.add(creature.id)` 改為 `codex.addRecord(creature.id, 'bronze')`（Task 10 會全面改寫此處）。

- [ ] **Step 5: 驗證建置**

Run: `npm run build`
Expected: tsc 無錯誤、exit 0

- [ ] **Step 6: Commit**

```powershell
git add src/core/codex.ts tests/codex.test.ts src/scenes/ResultScene.ts
git commit -m "feat: codex v2 with research points, best quality and v1 migration"
```

---

### Task 3: Session 擴充（steps／mode／resolved）

**Files:**
- Modify: `src/core/session.ts`
- Modify: `tests/session.test.ts`（追加測試）

**Interfaces:**
- Consumes: 既有 `SessionState`/`newSession`/`move`
- Produces:
  - `type SessionMode = 'run' | 'daily'`
  - `SessionState.steps: number`（累計移動步數）、`SessionState.mode: SessionMode`、`SessionState.resolved: boolean`（Result 記帳防重旗標）
  - `newSession(round: number, rng: Rng, mode?: SessionMode): SessionState`（mode 預設 `'run'`）

- [ ] **Step 1: 在 tests/session.test.ts 追加失敗測試**

```typescript
// 追加（沿用該檔既有的 import 與工具）
describe('steps / mode / resolved', () => {
  it('new session starts with zero steps, run mode, unresolved', () => {
    const s = newSession(1, mulberry32(1));
    expect(s.steps).toBe(0);
    expect(s.mode).toBe('run');
    expect(s.resolved).toBe(false);
  });
  it('mode can be set to daily', () => {
    expect(newSession(5, mulberry32(1), 'daily').mode).toBe('daily');
  });
  it('each successful move increments steps', () => {
    const s = newSession(1, mulberry32(2));
    const before = s.steps;
    const to = { x: s.player.x + (s.player.x === 0 ? 1 : -1), y: s.player.y };
    move(s, to);
    expect(s.steps).toBe(before + 1);
    move(s, { x: -99, y: -99 }); // 非法移動不計步
    expect(s.steps).toBe(before + 1);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL — `steps` undefined

- [ ] **Step 3: 修改 src/core/session.ts**

```typescript
export type SessionMode = 'run' | 'daily';

export interface SessionState {
  round: number;
  level: Level;
  player: Vec2;
  stamina: number;
  readClues: Set<string>;
  marks: Set<string>;
  phase: Phase;
  steps: number;      // 本局累計移動步數（分享卡用）
  mode: SessionMode;  // 主線 run / 每日挑戰 daily
  resolved: boolean;  // Result 已記帳（防場景重啟重複記錄）
}

export function newSession(round: number, rng: Rng, mode: SessionMode = 'run'): SessionState {
  const level = generateLevel(round, rng);
  return {
    round,
    level,
    player: startPos(level),
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Set(),
    phase: 'explore',
    steps: 0,
    mode,
    resolved: false,
  };
}
```

`move()` 開頭成功分支（`if (!canMove(s, to)) return;` 之後）加一行：

```typescript
  s.steps++;
```

- [ ] **Step 4: 執行全部測試確認通過**

Run: `npx vitest run`
Expected: 全部 PASS（`generate`/`session` 既有測試不受影響；若 session 測試有整物件比對需補上新欄位——依實際錯誤訊息修正）

- [ ] **Step 5: Commit**

```powershell
git add src/core/session.ts tests/session.test.ts
git commit -m "feat: session tracks steps, mode and resolved flag"
```

---

### Task 4: 每日挑戰核心（種子／日期鍵／連勝存檔）（P1 核心）

**Files:**
- Create: `src/core/daily.ts`
- Test: `tests/daily.test.ts`

**Interfaces:**
- Consumes: `mulberry32`（rng.ts）、`newSession`/`SessionState`（Task 3）
- Produces:
  - `const DAILY_ROUND = 5`
  - `dailyKey(d: Date): string`（UTC `YYYY-MM-DD`）
  - `dailySeed(d: Date): number`（`YYYYMMDD` 數值）
  - `createDailySession(d: Date): SessionState`（mode `'daily'`、種子固定）
  - `daysBetween(a: string, b: string): number`
  - `const FREEZE_EVERY = 7`、`const FREEZE_CAP = 3`
  - `interface StreakState { streak: number; freezes: number; lastPlayed: string | null }`
  - `interface StreakStore { state(): StreakState; recordPlay(dateKey: string): StreakState }`
  - `createStreak(storage?): StreakStore`（key `rht.daily.v1`；in-memory 備援同 codex）

- [ ] **Step 1: 寫失敗測試 tests/daily.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  dailyKey, dailySeed, createDailySession, createStreak, daysBetween,
  DAILY_ROUND, FREEZE_EVERY, FREEZE_CAP,
} from '../src/core/daily';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('daily seed', () => {
  it('dailyKey is the UTC date', () => {
    expect(dailyKey(new Date(Date.UTC(2026, 7, 31, 23, 59)))).toBe('2026-08-31');
  });
  it('dailySeed is YYYYMMDD as a number', () => {
    expect(dailySeed(new Date(Date.UTC(2026, 7, 31)))).toBe(20260831);
  });
  it('same date reproduces the same level; different dates differ', () => {
    const d = new Date(Date.UTC(2026, 7, 31));
    const a = createDailySession(d);
    const b = createDailySession(d);
    expect(a.level).toEqual(b.level);
    expect(a.mode).toBe('daily');
    expect(a.round).toBe(DAILY_ROUND);
    const c = createDailySession(new Date(Date.UTC(2026, 8, 1)));
    expect(c.level.targetPos).not.toEqual(a.level.targetPos);
  });
});

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-08-30', '2026-08-31')).toBe(1);
    expect(daysBetween('2026-08-28', '2026-08-31')).toBe(3);
  });
});

describe('streak', () => {
  it('first play starts streak at 1', () => {
    const s = createStreak(fakeStorage()).recordPlay('2026-08-31');
    expect(s).toEqual({ streak: 1, freezes: 0, lastPlayed: '2026-08-31' });
  });
  it('consecutive days increment; same day is idempotent', () => {
    const store = createStreak(fakeStorage());
    store.recordPlay('2026-08-30');
    store.recordPlay('2026-08-31');
    expect(store.recordPlay('2026-08-31').streak).toBe(2);
  });
  it(`every ${FREEZE_EVERY} streak days grants a freeze, capped at ${FREEZE_CAP}`, () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 7; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`);
    expect(store.state()).toMatchObject({ streak: 7, freezes: 1 });
  });
  it('a missed day consumes a freeze and keeps the streak going', () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 7; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`);
    const s = store.recordPlay('2026-08-19'); // 漏掉 08-18
    expect(s).toMatchObject({ streak: 8, freezes: 0 });
  });
  it('without enough freezes the streak halves plus today (never resets to zero)', () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 6; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`);
    const s = store.recordPlay('2026-08-20'); // 漏 3 天、無歇腳符
    expect(s).toMatchObject({ streak: Math.floor(6 / 2) + 1, freezes: 0 });
  });
  it('persists through storage and survives corruption', () => {
    const storage = fakeStorage();
    createStreak(storage).recordPlay('2026-08-31');
    expect(createStreak(storage).state().streak).toBe(1);
    expect(createStreak(fakeStorage({ 'rht.daily.v1': '{{{' })).state())
      .toEqual({ streak: 0, freezes: 0, lastPlayed: null });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/daily.test.ts`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作 src/core/daily.ts**

```typescript
import { mulberry32 } from './rng';
import { newSession, type SessionState } from './session';

export const DAILY_ROUND = 5; // 固定 tier 2：20×20、含干擾線索，適合全球同題
export const FREEZE_EVERY = 7; // 每連續 7 天贈 1 枚歇腳符
export const FREEZE_CAP = 3;

export function dailyKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dailySeed(d: Date): number {
  return Number(dailyKey(d).replaceAll('-', ''));
}

export function createDailySession(d: Date): SessionState {
  return newSession(DAILY_ROUND, mulberry32(dailySeed(d)), 'daily');
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export interface StreakState {
  streak: number;
  freezes: number;
  lastPlayed: string | null;
}

export interface StreakStore {
  state(): StreakState;
  recordPlay(dateKey: string): StreakState;
}

const KEY = 'rht.daily.v1';
const EMPTY: StreakState = { streak: 0, freezes: 0, lastPlayed: null };

export function createStreak(storage?: Pick<Storage, 'getItem' | 'setItem'>): StreakStore {
  let mem: StreakState = { ...EMPTY };

  const load = (): StreakState => {
    if (!storage) return mem;
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
      return parsed && typeof parsed.streak === 'number' ? parsed : { ...EMPTY };
    } catch {
      return { ...EMPTY };
    }
  };

  const save = (s: StreakState): StreakState => {
    mem = s;
    if (storage) {
      try {
        storage.setItem(KEY, JSON.stringify(s));
      } catch {
        // 退回記憶體
      }
    }
    return s;
  };

  return {
    state: load,
    recordPlay(dateKey) {
      const prev = load();
      if (prev.lastPlayed === dateKey) return prev; // 同日重玩不重複計數

      let streak: number;
      let freezes = prev.freezes;
      if (prev.lastPlayed === null) {
        streak = 1;
      } else {
        const gap = daysBetween(prev.lastPlayed, dateKey) - 1;
        if (gap <= 0) streak = prev.streak + 1;
        else if (gap <= freezes) {
          freezes -= gap; // 歇腳符逐日抵扣
          streak = prev.streak + 1;
        } else {
          freezes = 0;
          streak = Math.floor(prev.streak / 2) + 1; // 降級不歸零（家庭向）
        }
      }
      if (streak % FREEZE_EVERY === 0) freezes = Math.min(FREEZE_CAP, freezes + 1);
      return save({ streak, freezes, lastPlayed: dateKey });
    },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/daily.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/core/daily.ts tests/daily.test.ts
git commit -m "feat: daily challenge seed and gentle streak store with rest tokens"
```

---

### Task 5: 分享成績卡與 i18n 新字串

**Files:**
- Create: `src/core/share.ts`
- Modify: `src/core/i18n.ts`
- Test: `tests/share.test.ts`

**Interfaces:**
- Consumes: `I18n`/`createI18n`、`Quality`（Task 1）
- Produces:
  - `interface ShareInput { dateKey: string; caught: boolean; quality: Quality | null; steps: number; staminaLeft: number; streak: number }`
  - `shareText(i18n: I18n, s: ShareInput): string`（三行純文字＋emoji）
  - i18n 新 key（en/zh-TW 皆須）：`camp.continue`、`camp.daily`、`camp.dailyDone`、`camp.streak`、`hud.mark`、`quality.bronze`、`quality.silver`、`quality.gold`、`result.quality`、`result.notes`、`result.research`、`result.copied`、`btn.camp`、`btn.copy`、`codex.research`、`codex.rumored`、`share.stats`

- [ ] **Step 1: 寫失敗測試 tests/share.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { shareText } from '../src/core/share';
import { createI18n } from '../src/core/i18n';

describe('shareText', () => {
  it('renders a three-line card for a caught daily with medal and stats', () => {
    const text = shareText(createI18n('en'), {
      dateKey: '2026-08-31', caught: true, quality: 'gold',
      steps: 23, staminaLeft: 12, streak: 4,
    });
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Ridge Hunter's Trail");
    expect(lines[0]).toContain('2026-08-31');
    expect(lines[1]).toContain('🥇');
    expect(lines[2]).toContain('23');
    expect(lines[2]).toContain('12');
    expect(lines[2]).toContain('4');
  });
  it('renders an escape line without medal when not caught', () => {
    const text = shareText(createI18n('zh-TW'), {
      dateKey: '2026-08-31', caught: false, quality: null,
      steps: 9, staminaLeft: 0, streak: 1,
    });
    expect(text.split('\n')[1]).toContain('🌫️');
    expect(text).not.toContain('🥇');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/share.test.ts`
Expected: FAIL — 模組不存在

- [ ] **Step 3: i18n.ts 追加 MsgKey 與兩語系字串**

`MsgKey` 聯集追加：

```typescript
  | 'camp.continue' | 'camp.daily' | 'camp.dailyDone' | 'camp.streak'
  | 'hud.mark'
  | 'quality.bronze' | 'quality.silver' | 'quality.gold'
  | 'result.quality' | 'result.notes' | 'result.research' | 'result.copied'
  | 'btn.camp' | 'btn.copy'
  | 'codex.research' | 'codex.rumored'
  | 'share.stats'
```

`STRINGS.en` 追加：

```typescript
    'camp.continue': 'Hit the Trail · Round {n}',
    'camp.daily': "Today's Trail",
    'camp.dailyDone': 'Done today',
    'camp.streak': 'Streak {n}',
    'hud.mark': 'Mark',
    'quality.bronze': 'Bronze Record',
    'quality.silver': 'Silver Record',
    'quality.gold': 'Gold Record',
    'result.quality': 'Record quality',
    'result.notes': 'Field notes +{n}',
    'result.research': 'Research {cur} / {next}',
    'result.copied': 'Copied!',
    'btn.camp': '[ Back to Camp ]',
    'btn.copy': '[ Copy Result ]',
    'codex.research': 'Research',
    'codex.rumored': 'Traces found in the field...',
    'share.stats': 'Steps {steps} · Stamina {stam} · Streak {streak}',
```

`STRINGS['zh-TW']` 追加：

```typescript
    'camp.continue': '上山追蹤｜第 {n} 局',
    'camp.daily': '今日行蹤',
    'camp.dailyDone': '今日已完成',
    'camp.streak': '連勝 {n}',
    'hud.mark': '標記',
    'quality.bronze': '銅級記錄',
    'quality.silver': '銀級記錄',
    'quality.gold': '金級記錄',
    'result.quality': '記錄品質',
    'result.notes': '觀察筆記 +{n}',
    'result.research': '研究度 {cur} / {next}',
    'result.copied': '已複製！',
    'btn.camp': '［返回營地］',
    'btn.copy': '［複製成績］',
    'codex.research': '研究度',
    'codex.rumored': '山野間已見蹤跡……',
    'share.stats': '步數 {steps}｜剩餘體力 {stam}｜連勝 {streak}',
```

- [ ] **Step 4: 實作 src/core/share.ts**

```typescript
import type { I18n } from './i18n';
import type { Quality } from './quality';

const MEDAL: Record<Quality, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' };

export interface ShareInput {
  dateKey: string;
  caught: boolean;
  quality: Quality | null;
  steps: number;
  staminaLeft: number;
  streak: number;
}

// 每日挑戰分享卡：三行純文字，仿 Wordle 可貼進任何聊天室
export function shareText(i18n: I18n, s: ShareInput): string {
  const line1 = `Ridge Hunter's Trail · ${s.dateKey}`;
  const line2 = s.caught
    ? `🐾🐾🐾✨${s.quality ? MEDAL[s.quality] : ''}`
    : '🐾🐾🌫️';
  const line3 = i18n.t('share.stats', {
    steps: s.steps, stam: s.staminaLeft, streak: s.streak,
  });
  return `${line1}\n${line2}\n${line3}`;
}
```

- [ ] **Step 5: 執行測試確認通過（含 i18n key 一致性測試）**

Run: `npx vitest run tests/share.test.ts tests/i18n.test.ts`
Expected: PASS（i18n 的「兩語系 key 集合一致」測試自動涵蓋新 key）

- [ ] **Step 6: Commit**

```powershell
git add src/core/share.ts src/core/i18n.ts tests/share.test.ts
git commit -m "feat: daily share card text and bilingual strings for phase-1 UI"
```

---

### Task 6: U1a 響應式縮放與地圖佈局

**Files:**
- Create: `src/scenes/fx.ts`
- Modify: `src/main.ts`
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: Phaser Scale API、既有場景
- Produces:
  - `restartOnResize(scene: Phaser.Scene): void`（resize 後 debounce 150ms 重啟場景）
  - `fadeIn(scene, ms?)`、`fadeToScene(scene, key, ms?)`、`floatText(scene, x, y, msg, cssColor)`（本 task 先建檔含全部四個函式，Task 8 起使用）
  - main.ts 改 `Scale.RESIZE`
  - MapScene：cell 同時受寬高約束；窄螢幕（<560px）HUD 收合

- [ ] **Step 1: 建立 src/scenes/fx.ts**

```typescript
import Phaser from 'phaser';
import { FONTS } from './paint';

// resize 後 debounce 重啟場景：所有狀態都在 registry，重啟即重排
export function restartOnResize(scene: Phaser.Scene): void {
  let timer: Phaser.Time.TimerEvent | null = null;
  const handler = () => {
    timer?.remove();
    timer = scene.time.delayedCall(150, () => scene.scene.restart());
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.scale.off(Phaser.Scale.Events.RESIZE, handler));
}

export function fadeIn(scene: Phaser.Scene, ms = 240): void {
  scene.cameras.main.fadeIn(ms, 0, 0, 0);
}

export function fadeToScene(scene: Phaser.Scene, key: string, ms = 200): void {
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
    scene.scene.start(key));
}

// 一次性浮字（體力扣減/補給回復/筆記掉落）
export function floatText(
  scene: Phaser.Scene, x: number, y: number, msg: string, cssColor: string,
): void {
  const t = scene.add.text(x, y, msg, {
    fontFamily: FONTS.body, fontSize: '13px', color: cssColor, fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(50);
  scene.tweens.add({
    targets: t, y: y - 22, alpha: 0, duration: 600, ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}
```

- [ ] **Step 2: main.ts 改 RESIZE**

`launch()` 的 Game config 改為（其餘不動）：

```typescript
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#131a17',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
```

- [ ] **Step 3: MapScene 佈局適配**

`create()` 開頭的尺寸計算改為（同時受寬高約束、置中）：

```typescript
    const w = this.scale.width;
    const h = this.scale.height;
    this.pal = getPalette(s.round);
    this.cell = Math.max(10, Math.floor(Math.min(
      (h - HUD_HEIGHT - 12) / s.level.mapSize,
      (w - 8) / s.level.mapSize,
    )));
    this.ox = Math.floor((w - this.cell * s.level.mapSize) / 2);
    this.oy = HUD_HEIGHT + Math.max(4, Math.floor((h - HUD_HEIGHT - this.cell * s.level.mapSize) / 2));
```

（`oy` 由固定值改為動態：宣告處 `private oy = 0;`。）

`create()` 尾端（`this.maybeShowFirstRunHelp();` 前）加：

```typescript
    restartOnResize(this);
    fadeIn(this);
```

並 import：`import { restartOnResize, fadeIn } from './fx';`

`buildHud()` 窄螢幕收合——函式開頭加：

```typescript
    const compact = this.scale.width < 560;
```

- 副標題 `"RIDGE HUNTER'S TRAIL"` 一行：`if (!compact)` 才建立。
- `hintText`：`if (!compact)` 才建立（宣告改 `private hintText?: Phaser.GameObjects.Text;`，`updateHud` 對應改 `this.hintText?.setText(...)`）。
- 體力條寬度 `updateHud` 內 `const bw = 210;` 改 `const bw = Math.min(210, this.scale.width - 320);`（compact 下仍 ≥120：`Math.max(120, ...)` 包一層——完整為 `const bw = Math.max(120, Math.min(210, this.scale.width - 320));`）。

- [ ] **Step 4: 手動冒煙**

Run: `npm run dev`
以瀏覽器開啟，檢查：
1. 桌面全螢幕：地圖置中、HUD 完整。
2. 縮窄視窗至 <560px：副標題與提示消失、體力條縮短、場景在 150ms 後重排且局面不變（同一 session）。
3. DevTools 手機模擬（iPhone 直向）：整張地圖可見、無水平捲動。

- [ ] **Step 5: 建置驗證與 Commit**

Run: `npm run build`
Expected: exit 0

```powershell
git add src/scenes/fx.ts src/main.ts src/scenes/MapScene.ts
git commit -m "feat: responsive RESIZE scaling with debounced relayout and compact HUD"
```

---

### Task 7: U1b 觸控標記（長按＋標記模式鈕＋44px 命中區）

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- Consumes: `toggleMark`（session.ts）、Task 6 的佈局
- Produces: 三種標記路徑並存——Shift+點擊（桌面）、長按 350ms（觸控）、HUD「標記模式」切換鈕；HUD chips 命中區 44px 高

- [ ] **Step 1: 指標事件改為 down/up 配對**

MapScene 增欄位：

```typescript
  private markMode = false;
  private pressAt: { t: number; x: number; y: number } | null = null;
  private markChipG?: Phaser.GameObjects.Graphics;
  private markChipText?: Phaser.GameObjects.Text;
```

`create()` 中 `this.input.on('pointerdown', ...)` 一行改為：

```typescript
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pressAt = { t: p.time, x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
```

既有 `onPointer` 改名並改寫為：

```typescript
  private onPointerUp(p: Phaser.Input.Pointer) {
    const s = this.session();
    if (s.phase !== 'explore' || !this.pressAt) return;
    const held = p.time - this.pressAt.t;
    const moved = Math.hypot(p.x - this.pressAt.x, p.y - this.pressAt.y);
    this.pressAt = null;
    if (moved > 12) return; // 拖曳不動作
    const cellPos = this.toGrid(p.x, p.y);
    if (!cellPos) return;
    const wantMark = (p.event as MouseEvent).shiftKey || this.markMode || held >= 350;
    if (wantMark) {
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
```

- [ ] **Step 2: HUD 加「標記模式」chip**

`buildHud()` 中原本畫兩個 chip（語言＋?）處，改為三個 chip 佈局（由右至左：`?` 32 寬、語言 72 寬、標記 60 寬，全部高 30、間距 8，右邊界 12）。以變數計座標避免魔數：

```typescript
    const chipY = 13;
    const chipH = 30;
    const xHelp = w - 12 - 32;        // '?' chip 左緣
    const xLang = xHelp - 8 - 72;     // 語言 chip 左緣
    const xMark = xLang - 8 - 60;     // 標記 chip 左緣
    const chip = this.add.graphics();
    chip.lineStyle(1.2, pal.gold, 0.55);
    chip.strokeRoundedRect(xLang, chipY, 72, chipH, BRUSH_RADIUS);
    chip.strokeRoundedRect(xHelp, chipY, 32, chipH, { tl: 5, tr: 9, br: 4, bl: 8 });
```

標記 chip 需重繪（開/關填色不同），獨立 Graphics：

```typescript
    this.markChipG = this.add.graphics();
    this.markChipText = this.add.text(xMark + 30, chipY + chipH / 2, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.drawMarkChip(xMark, chipY, 60, chipH);
    this.add.rectangle(xMark + 30, chipY + chipH / 2, 60, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.markMode = !this.markMode;
        this.drawMarkChip(xMark, chipY, 60, chipH);
      });
```

新增方法：

```typescript
  private drawMarkChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.markChipG!;
    g.clear();
    if (this.markMode) {
      g.fillStyle(pal.mark, 0.85).fillRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.markChipText!.setColor(cssHex(pal.bg)).setText(this.i18n().t('hud.mark'));
    } else {
      g.lineStyle(1.2, pal.mark, 0.7).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.markChipText!.setColor(cssHex(pal.mark)).setText(this.i18n().t('hud.mark'));
    }
  }
```

語言與 `?` 的既有互動矩形也將高度放大為 44（`this.add.text(...).setInteractive(...)` 兩處改為與標記 chip 相同模式：文字照舊、另加 `this.add.rectangle(cx, cy, w, 44, 0, 0).setInteractive(...)` 承接點擊；文字本身移除 `setInteractive`）。座標依上面的 `xLang`/`xHelp` 調整（語言文字 x = `xLang + 36`、`?` 文字 x = `xHelp + 16`）。

- [ ] **Step 3: 手動冒煙**

Run: `npm run dev`
1. 桌面：Shift+點擊任意格出現/消除橘 X；點擊相鄰格移動。
2. 標記 chip：點一下變實心，之後任意點擊格子只標記不移動；再點恢復。
3. DevTools 觸控模擬：長按格子 ≥350ms 放開 → 標記；短按相鄰格 → 移動。
4. 語言鈕、`?` 鈕在觸控模擬下可輕鬆點中。

- [ ] **Step 4: 建置與 Commit**

Run: `npm run build` → exit 0

```powershell
git add src/scenes/MapScene.ts
git commit -m "feat: touch-friendly marking via long-press and mark-mode toggle"
```

---

### Task 8: U3a 移動 tween、浮字、低體力脈動、全域轉場

**Files:**
- Modify: `src/scenes/MapScene.ts`
- Modify: `src/scenes/QteScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CodexScene.ts`（轉場替換）

**Interfaces:**
- Consumes: `fx.ts`（Task 6）、`TERRAIN_COST`（session.ts）
- Produces: 玩家移動 100ms tween（期間鎖輸入）；體力 `-n`／補給 `+10` 浮字；體力 <25% 時體力條轉 `pal.mark` 色並脈動；Map↔Qte↔Result↔Codex 全部改 `fadeToScene`＋`fadeIn`

- [ ] **Step 1: 玩家繪製抽出獨立 Graphics 並支援 tween**

MapScene 增欄位：

```typescript
  private pg!: Phaser.GameObjects.Graphics; // 玩家專用層
  private animating = false;
  private lowTween?: Phaser.Tweens.Tween;
```

`create()` 中 `this.g = this.add.graphics();` 之後加 `this.pg = this.add.graphics();`。

`redraw()` 中玩家繪製四行（`const pp = px(s.player);` 起）搬到新方法：

```typescript
  private drawPlayer(x: number, y: number) {
    const cs = this.cell;
    const pal = this.pal;
    this.pg.clear();
    this.pg.fillStyle(pal.gold, 0.1).fillCircle(x, y, cs * 0.62);
    this.pg.fillStyle(pal.gold, 0.16).fillCircle(x, y, cs * 0.44);
    this.pg.lineStyle(1.2, pal.paper, 0.5).strokeCircle(x, y, cs * 0.36);
    this.pg.fillStyle(pal.paper, 1).fillCircle(x, y, cs * 0.26);
  }
```

`redraw()` 改為呼叫 `this.drawPlayer(pp.x, pp.y);`（pp 計算保留）。

- [ ] **Step 2: 移動包裝——tween＋浮字**

新增統一移動入口（鍵盤與指標都改走它；`update()` 與 `onPointerUp` 中的 `move(s,to); this.redraw(); this.afterMove();` 三行組合全部替換為 `this.doMove(to);`）：

```typescript
  private doMove(to: Vec2) {
    const s = this.session();
    if (this.animating || !canMove(s, to)) return;
    const cs = this.cell;
    const from = { x: this.ox + s.player.x * cs + cs / 2, y: this.oy + s.player.y * cs + cs / 2 };
    const dest = { x: this.ox + to.x * cs + cs / 2, y: this.oy + to.y * cs + cs / 2 };
    const cost = TERRAIN_COST[s.level.terrain[to.y][to.x]];
    const suppliesBefore = s.level.supplies.length;
    move(s, to);
    const gotSupply = s.level.supplies.length < suppliesBefore;

    this.animating = true;
    const pos = { ...from };
    this.tweens.add({
      targets: pos, x: dest.x, y: dest.y, duration: 100, ease: 'Sine.easeOut',
      onUpdate: () => this.drawPlayer(pos.x, pos.y),
      onComplete: () => {
        this.animating = false;
        floatText(this, dest.x, dest.y - cs * 0.5, `-${cost}`, cssRgba(this.pal.paper, 0.75));
        if (gotSupply) {
          floatText(this, dest.x, dest.y - cs, '+10', cssHex(this.pal.supply));
        }
        this.redraw();
        this.afterMove();
      },
    });
  }
```

import 增加：`TERRAIN_COST`（from '../core/session'）、`floatText`（from './fx'）。

- [ ] **Step 3: 低體力脈動**

`updateHud()` 的填色分支改為：

```typescript
    const low = ratio > 0 && ratio < 0.25;
    if (ratio > 0) {
      this.hudG.fillStyle(low ? pal.mark : pal.gold, 1)
        .fillRoundedRect(bx + 1, by + 1, Math.max(6, (bw - 2) * ratio), bh - 2, { tl: 7, tr: 2, br: 6, bl: 3 });
    }
    if (low && !this.lowTween) {
      this.lowTween = this.tweens.add({
        targets: this.hudG, alpha: { from: 1, to: 0.55 },
        duration: 700, yoyo: true, repeat: -1,
      });
    } else if (!low && this.lowTween) {
      this.lowTween.stop();
      this.lowTween = undefined;
      this.hudG.setAlpha(1);
    }
```

- [ ] **Step 4: 全域轉場替換**

各場景 import `fadeIn, fadeToScene`（from './fx'）並：
- MapScene `afterMove()`：`this.scene.start('Qte')` → `fadeToScene(this, 'Qte')`；`this.scene.start('Result')` → `fadeToScene(this, 'Result')`。
- QteScene：`create()` 開頭加 `fadeIn(this);`；`this.scene.start('Result')` → `fadeToScene(this, 'Result')`。
- ResultScene：`create()` 開頭加 `fadeIn(this);`；兩個按鈕的 `this.scene.start('Map')`/`start('Codex')` → `fadeToScene(this, 'Map')`/`fadeToScene(this, 'Codex')`。
- CodexScene：`create()` 開頭加 `fadeIn(this);`；返回鈕 → `fadeToScene(this, 'Map')`。

- [ ] **Step 5: 手動冒煙**

Run: `npm run dev`
1. 移動：玩家 100ms 滑move到新格、沿途 `-1`/`-2` 浮字；快速連點不會跳格穿越（animating 鎖）。
2. 撿補給：綠色 `+10` 浮字＋體力回升。
3. 體力壓到 <25%：條轉橘紅並緩慢呼吸；回復後恢復金色靜止。
4. 所有場景切換有淡出入，無黑屏卡死。

- [ ] **Step 6: 建置與 Commit**

Run: `npm run build` → exit 0

```powershell
git add src/scenes/MapScene.ts src/scenes/QteScene.ts src/scenes/ResultScene.ts src/scenes/CodexScene.ts
git commit -m "feat: movement tween, stamina float text, low-stamina pulse and scene fades"
```

---

### Task 9: U3b 線索揭示演出與 QTE 回饋

**Files:**
- Modify: `src/scenes/MapScene.ts`
- Modify: `src/scenes/QteScene.ts`

**Interfaces:**
- Consumes: Task 8 的 `doMove`、`QteState.lastHit`（既有）、剪影貼圖 `sil-<id>`
- Produces:
  - 踩上未讀線索：420ms 擴散演出（錐形/圓域/距離環各自形狀）後常駐覆蓋層出現
  - QTE：命中金色閃光、失手 70ms 微震；結束時剪影亮起（成功）或滑出淡去（失敗），900ms 後轉場
  - registry `'qteOutcome'`：QteScene 離場前存入 `QteState`（Task 10 讀取算品質）

- [ ] **Step 1: MapScene 揭示演出**

`doMove()` 中 `move(s, to);` 前記錄 `const readBefore = s.readClues.size;`，`onComplete` 內 `this.redraw();` 前加：

```typescript
        if (s.readClues.size > readBefore) {
          const clue = s.level.clues.find((c) => key(c.position) === key(to));
          if (clue) this.playReveal(clue);
        }
```

新增方法：

```typescript
  // 線索揭示：以容器縮放模擬形狀擴散，結束時 redraw 已畫出常駐覆蓋層
  private playReveal(c: Clue) {
    const cs = this.cell;
    const pal = this.pal;
    const center = {
      x: this.ox + c.position.x * cs + cs / 2,
      y: this.oy + c.position.y * cs + cs / 2,
    };
    const g = this.add.graphics();
    if (c.type === 'footprint') {
      const len = cs * 5;
      const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
      const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
      g.fillStyle(pal.gold, 0.35).fillTriangle(
        0, 0, len * Math.cos(a1), len * Math.sin(a1), len * Math.cos(a2), len * Math.sin(a2));
    } else if (c.type === 'disturbance') {
      g.lineStyle(3, pal.gold, 0.8).strokeCircle(0, 0, c.data.radius * cs);
    } else {
      g.lineStyle(3, pal.glow, 0.8).strokeCircle(0, 0, c.data.distance * cs);
    }
    const holder = this.add.container(center.x, center.y, [g]).setScale(0.25).setAlpha(0.9);
    this.tweens.add({
      targets: holder, scale: 1, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => holder.destroy(),
    });
  }
```

import 補 `type Clue`（已有）與 `key`（已有）。

- [ ] **Step 2: QTE 命中/失手回饋**

QteScene 增欄位存剪影引用：`private sil?: Phaser.GameObjects.Image;`——`create()` 中剪影建立處改為 `this.sil = this.add.image(cx, cy + 6, silKey).setScale(1.35).setAlpha(0.16);`

`onPress()` 改為：

```typescript
  private onPress() {
    if (this.ending) return;
    press(this.q, this.cfg, this.registry.get('rng') as Rng);
    if (this.q.lastHit) this.cameras.main.flash(110, 216, 200, 116);
    else this.cameras.main.shake(70, 0.004);
    if (this.q.done) {
      this.ending = true;
      const s: SessionState = this.registry.get('session');
      resolveQte(s, this.q.success === true);
      this.registry.set('qteOutcome', this.q);
      this.playEnding(this.q.success === true);
    }
  }

  // 成功：剪影亮起；失敗：剪影滑出淡去（溜走）。900ms 後入結算
  private playEnding(success: boolean) {
    if (this.sil) {
      this.tweens.add(success
        ? { targets: this.sil, alpha: 0.85, scale: 1.5, duration: 600, ease: 'Cubic.easeOut' }
        : { targets: this.sil, alpha: 0, x: this.sil.x + 60, duration: 600, ease: 'Cubic.easeIn' });
    }
    this.time.delayedCall(900, () => fadeToScene(this, 'Result'));
  }
```

（原 `delayedCall(500, ...)` 移除。）

- [ ] **Step 3: 手動冒煙**

Run: `npm run dev`（可用 `#scene=Qte` dev 捷徑）
1. 踩上線索：形狀由小擴散淡出、覆蓋層接著常駐；三種線索形狀各異。
2. QTE 命中：短促金閃；失手：畫面微震。
3. 成功結束：剪影浮現變亮後入結算；失敗：剪影向右溜走淡出。

- [ ] **Step 4: 建置與 Commit**

Run: `npm run build` → exit 0

```powershell
git add src/scenes/MapScene.ts src/scenes/QteScene.ts
git commit -m "feat: clue reveal animation and QTE hit/miss/ending feedback"
```

---

### Task 10: U6 結算改版（品質蓋印／筆記掉落／進度點列／明確 session 流轉）

**Files:**
- Modify: `src/scenes/paint.ts`
- Rewrite: `src/scenes/ResultScene.ts`
- Modify: `src/main.ts`（registry `runRound` 初始化）

**Interfaces:**
- Consumes: `qualityFromQte`/`Quality`（Task 1）、`CodexStore.addRecord/addNotes/entry`、`notesForRun`、`MILESTONE_NAME/DETAIL`（Task 2）、`SessionState.steps/mode/resolved`（Task 3）、registry `'qteOutcome'`（Task 9）、`newSession`
- Produces:
  - `paint.ts`：`export const QUALITY_COLORS: Record<Quality, number> = { bronze: 0xb08d57, silver: 0xc3ccd2, gold: 0xd8c874 }`
  - registry `'runRound'`: number（主線進度；main.ts 初始 1）
  - ResultScene：不再呼叫 `nextSession`；caught(run) 時 `runRound = s.round + 1`；記帳以 `s.resolved` 防重
  - 按鈕加 hover 狀態（本 task 改寫 `button()`，Task 12/13 沿用）

- [ ] **Step 1: paint.ts 加品質色**

```typescript
import { CLUE_GOLD } from '../core/palette';
import type { Quality } from '../core/quality';

export const QUALITY_COLORS: Record<Quality, number> = {
  bronze: 0xb08d57,
  silver: 0xc3ccd2,
  gold: CLUE_GOLD,
};
```

- [ ] **Step 2: main.ts registry 加 runRound**

`preBoot` 內加一行：

```typescript
        game.registry.set('runRound', 1);
```

- [ ] **Step 3: 改寫 ResultScene.ts**

```typescript
import Phaser from 'phaser';
import { newSession, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { notesForRun, MILESTONE_NAME, MILESTONE_DETAIL, type CodexStore } from '../core/codex';
import { qualityFromQte, type Quality } from '../core/quality';
import type { QteState } from '../core/qte';
import { CREATURES } from '../data/creatures';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import {
  cssHex, cssRgba, dashedCircle, BRUSH_RADIUS, FONTS, QUALITY_COLORS,
} from './paint';
import { fadeIn, fadeToScene } from './fx';

const GLOW_KEY = 'result-glow';

const stripBrackets = (s: string) => s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');

export class ResultScene extends Phaser.Scene {
  private pal!: Palette;

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
    const caught = outcome === 'caught';
    this.pal = getPalette(s.round);

    const qte = this.registry.get('qteOutcome') as QteState | undefined;
    const quality: Quality | null = caught && qte ? qualityFromQte(qte) : null;
    const notes = caught ? 0 : notesForRun(s.readClues.size);

    // 記帳一次（resize 造成的場景重啟不重複）
    if (!s.resolved) {
      s.resolved = true;
      if (caught) {
        codex.addRecord(creature.id, quality ?? 'bronze');
        if (s.mode === 'run') this.registry.set('runRound', s.round + 1);
      } else {
        codex.addNotes(creature.id, notes);
      }
    }

    const pal = this.pal;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    const cx = this.scale.width / 2;

    let title: string;
    let body: string;
    if (caught) {
      this.drawCreaturePortrait(cx, 212, creature.id, creature.color);
      if (quality) this.stampQuality(cx + 128, 268, quality, i18n);
      title = i18n.t('result.recorded', { name: creature.names[loc] });
      body = creature.descs[loc];
    } else if (outcome === 'escaped') {
      title = i18n.t('result.escaped.title');
      body = i18n.t('result.escaped.body');
    } else {
      title = i18n.t('result.exhausted.title');
      body = i18n.t('result.exhausted.body');
    }

    this.add.text(cx, 336, title, {
      fontFamily: FONTS.display, fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1);

    this.drawCodexDots(cx, 372, codex);

    const divider = this.add.graphics();
    divider.lineStyle(1.6, pal.gold, 0.5);
    divider.beginPath();
    divider.moveTo(cx - 105, 402);
    for (let i = 1; i <= 6; i++) {
      divider.lineTo(cx - 105 + i * 35, 402 + (i % 2 === 0 ? 1.5 : -1.5));
    }
    divider.strokePath();

    this.add.text(cx, 438, body, {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.paperDim),
      wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    if (!caught) this.showNotesDrop(cx, 486, creature.id, notes, codex, i18n);

    // 按鈕列（每日挑戰的按鈕在 Task 13 擴充；本 task 維持主線流程）
    const runRound: number = this.registry.get('runRound');
    if (caught) {
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.next')), true, () => {
        this.registry.set('session', newSession(runRound, rng));
        fadeToScene(this, 'Map');
      });
    } else {
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
        this.registry.set('session', newSession(s.round, rng, s.mode));
        fadeToScene(this, 'Map');
      });
    }
    this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.guide')), false,
      () => fadeToScene(this, 'Codex'));
  }

  // 品質墨章：蓋印動畫（縮放 1.8 → 1、Back ease）
  private stampQuality(x: number, y: number, q: Quality, i18n: I18n) {
    const color = QUALITY_COLORS[q];
    const g = this.add.graphics();
    g.lineStyle(2.5, color, 0.9).strokeCircle(0, 0, 30);
    g.lineStyle(1, color, 0.4).strokeCircle(0, 0, 24);
    const label = this.add.text(0, 0, i18n.t(`quality.${q}` as const).split(' ')[0], {
      fontFamily: FONTS.display, fontSize: '13px', color: cssHex(color),
    }).setOrigin(0.5);
    const holder = this.add.container(x, y, [g, label]).setScale(1.8).setAlpha(0);
    this.tweens.add({
      targets: holder, scale: 1, alpha: 1, duration: 350, delay: 400, ease: 'Back.easeOut',
    });
  }

  // 圖鑑進度點列：8 顆點，已發現者以生物色實心
  private drawCodexDots(cx: number, y: number, codex: CodexStore) {
    const g = this.add.graphics();
    const gap = 22;
    const x0 = cx - ((CREATURES.length - 1) * gap) / 2;
    CREATURES.forEach((c, i) => {
      const x = x0 + i * gap;
      if (codex.entry(c.id).count > 0) g.fillStyle(c.color, 1).fillCircle(x, y, 5);
      else g.lineStyle(1.2, this.pal.paperDim, 0.5).strokeCircle(x, y, 5);
    });
  }

  // 失敗軟著陸：筆記掉落＋該生物研究度（目前值 / 下一里程碑）
  private showNotesDrop(
    cx: number, y: number, creatureId: string, notes: number, codex: CodexStore, i18n: I18n,
  ) {
    const pal = this.pal;
    const e = codex.entry(creatureId);
    const next = e.research >= MILESTONE_DETAIL ? MILESTONE_DETAIL
      : e.research >= MILESTONE_NAME ? MILESTONE_DETAIL : MILESTONE_NAME;
    const t = this.add.text(cx, y, i18n.t('result.notes', { n: notes }), {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.supply), fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: y - 6, duration: 400, delay: 300 });

    const bw = 180;
    const g = this.add.graphics();
    g.fillStyle(0x0d1310, 1).fillRoundedRect(cx - bw / 2, y + 18, bw, 8, 4);
    const ratio = Math.min(1, e.research / next);
    if (ratio > 0) g.fillStyle(pal.glow, 0.9).fillRoundedRect(cx - bw / 2 + 1, y + 19, (bw - 2) * ratio, 6, 3);
    this.add.text(cx, y + 40, i18n.t('result.research', { cur: e.research, next }), {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5).setLetterSpacing(1.5);
  }

  private drawCreaturePortrait(cx: number, cy: number, creatureId: string, color: number) {
    const size = 250;
    if (this.textures.exists(GLOW_KEY)) this.textures.remove(GLOW_KEY);
    const tex = this.textures.createCanvas(GLOW_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, cssRgba(color, 0.28));
      grad.addColorStop(0.7, cssRgba(color, 0.08));
      grad.addColorStop(1, cssRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
      this.add.image(cx, cy, GLOW_KEY);
    }
    const ring = this.add.graphics();
    dashedCircle(ring, cx, cy, 92, color, 0.35, 1.4, 2, 8);
    const silKey = `sil-${creatureId}`;
    if (this.textures.exists(silKey)) {
      this.add.image(cx, cy + 4, silKey).setScale(1.05);
    } else {
      this.add.circle(cx, cy, 60, color);
    }
  }

  // 按鈕：hover 增亮、按下內縮
  private button(
    x: number, y: number, w: number, h: number,
    label: string, filled: boolean, onClick: () => void,
  ) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      if (filled) {
        g.fillStyle(pal.gold, hover ? 1 : 0.92)
          .fillRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      } else {
        g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65)
          .strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      }
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: filled ? '17px' : '16px',
      color: filled ? cssHex(pal.bg) : cssHex(pal.gold),
      fontStyle: filled ? 'bold' : 'normal',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); onClick(); });
  }
}
```

注意型別細節：`i18n.t(\`quality.${q}\` as const)` 若 tsc 不接受模板 as const，改為顯式映射：

```typescript
const QUALITY_KEY = { bronze: 'quality.bronze', silver: 'quality.silver', gold: 'quality.gold' } as const;
// 使用：i18n.t(QUALITY_KEY[q])
```

- [ ] **Step 4: session.ts 的 `nextSession` 已無場景使用**——保留函式與測試（API 相容），不動。

- [ ] **Step 5: 全測試＋建置**

Run: `npx vitest run` → 全 PASS
Run: `npm run build` → exit 0

- [ ] **Step 6: 手動冒煙**

Run: `npm run dev`（`#scene=Result&phase=caught` / `escaped` / `exhausted`）
1. caught：肖像＋墨章蓋印動畫（顏色依 QTE 表現）＋8 點進度列＋「下一場狩獵」進新難度。
2. escaped：筆記 +n 浮現＋研究度條；「重新追蹤」同難度重開。
3. 縮放視窗觸發場景重啟：圖鑑計數不重複增加（localStorage 檢查 `rht.codex.v2`）。
4. 按鈕 hover 增亮、按下微縮。

- [ ] **Step 7: Commit**

```powershell
git add src/scenes/paint.ts src/scenes/ResultScene.ts src/main.ts
git commit -m "feat: result scene quality stamp, notes drop, codex dots and explicit session flow"
```

---

### Task 11: U5 圖鑑改版（捲動／研究度／里程碑揭示／品質章／剪影 teaser）

**Files:**
- Rewrite: `src/scenes/CodexScene.ts`

**Interfaces:**
- Consumes: `CodexStore.entry/entries/counts`、`MILESTONE_NAME/DETAIL`（Task 2）、`QUALITY_COLORS`（Task 10）、剪影貼圖
- Produces: 可捲動圖鑑列表（滾輪＋拖曳）；每行：剪影（未發現=墨影 teaser）／名稱（研究度≥3 揭示）／描述＋地形（發現或研究度≥8 揭示）／研究度條／品質章／次數

- [ ] **Step 1: 改寫 CodexScene.ts**

```typescript
import Phaser from 'phaser';
import { MILESTONE_NAME, MILESTONE_DETAIL, type CodexStore } from '../core/codex';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';
import { cssHex, BRUSH_RADIUS, FONTS, QUALITY_COLORS } from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';

const ROW_H = 84;

export class CodexScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private minY = 0;
  private listTop = 112;
  private listBottom = 0;

  constructor() {
    super('Codex');
  }

  create() {
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const session: SessionState = this.registry.get('session');
    const pal = getPalette(session.round);
    const loc = i18n.locale();
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);

    this.add.text(cx, 42, i18n.t('codex.title'), {
      fontFamily: FONTS.display, fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1.5);
    const found = CREATURES.filter((c) => codex.entry(c.id).count > 0).length;
    this.add.text(cx, 80, i18n.t('codex.count', { found, total: CREATURES.length }).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5).setLetterSpacing(3);

    this.listBottom = h - 84;
    this.list = this.add.container(0, this.listTop);
    CREATURES.forEach((c, i) => this.list.add(this.buildRow(c.id, i, pal, codex, i18n, loc, w)));

    const viewH = this.listBottom - this.listTop;
    this.minY = Math.min(0, viewH - CREATURES.length * ROW_H) + this.listTop;

    // 遮罩：列表只在標題與返回鈕之間可見
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(0, this.listTop, w, viewH);
    this.list.setMask(maskShape.createGeometryMask());

    // 滾輪與拖曳捲動
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollBy(-dy * 0.6));
    let dragY: number | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY !== null && p.isDown) {
        this.scrollBy(p.y - dragY);
        dragY = p.y;
      }
    });
    this.input.on('pointerup', () => { dragY = null; });

    this.backButton(cx, h - 44, pal, i18n);
  }

  private scrollBy(dy: number) {
    this.list.y = Phaser.Math.Clamp(this.list.y + dy, this.minY, this.listTop);
  }

  // 單行：底盤圓＋剪影／名稱＋品質章／細節／研究度條／次數
  private buildRow(
    id: string, index: number, pal: Palette, codex: CodexStore,
    i18n: I18n, loc: 'en' | 'zh-TW', w: number,
  ): Phaser.GameObjects.Container {
    const c = CREATURES.find((x) => x.id === id)!;
    const e = codex.entry(id);
    const discovered = e.count > 0;
    const nameKnown = discovered || e.research >= MILESTONE_NAME;
    const detailKnown = discovered || e.research >= MILESTONE_DETAIL;
    const y = index * ROW_H + ROW_H / 2;
    const row = this.add.container(0, 0);
    const g = this.add.graphics();
    row.add(g);

    g.fillStyle(pal.panel, 1).fillCircle(92, y, 26);
    if (index < CREATURES.length - 1) {
      g.lineStyle(1, pal.paper, 0.09).lineBetween(60, y + ROW_H / 2, w - 60, y + ROW_H / 2);
    }

    const silKey = `sil-${id}`;
    if (this.textures.exists(silKey)) {
      const img = this.add.image(92, y + 2, silKey).setScale(0.3);
      if (!discovered) img.setTintFill(0x10160f).setAlpha(0.85); // 墨影 teaser
      row.add(img);
    } else {
      row.add(this.add.circle(92, y, 16, discovered ? c.color : 0x10160f));
    }

    const name = nameKnown ? c.names[loc] : i18n.t('codex.unknown');
    const nameText = this.add.text(134, y - 26, name, {
      fontFamily: FONTS.display, fontSize: '19px',
      color: discovered ? cssHex(pal.paper) : cssHex(pal.paperDim),
    });
    row.add(nameText);

    if (e.bestQuality) {
      const qg = this.add.graphics();
      qg.fillStyle(QUALITY_COLORS[e.bestQuality], 1)
        .fillCircle(140 + nameText.width + 14, y - 16, 6);
      row.add(qg);
    }

    const detail = detailKnown
      ? c.descs[loc]
      : e.research > 0 ? i18n.t('codex.rumored') : i18n.t('codex.notRecorded');
    row.add(this.add.text(134, y - 2, detail, {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.paperDim),
      wordWrap: { width: w - 300, useAdvancedWrap: true },
    }).setAlpha(detailKnown ? 1 : 0.6));

    // 研究度條：滿檔 = MILESTONE_DETAIL
    const bw = 150;
    const ratio = Math.min(1, e.research / MILESTONE_DETAIL);
    g.fillStyle(0x0d1310, 1).fillRoundedRect(134, y + 22, bw, 6, 3);
    if (ratio > 0) g.fillStyle(pal.glow, 0.9).fillRoundedRect(135, y + 23, (bw - 2) * ratio, 4, 2);
    g.lineStyle(1, pal.paper, 0.25)
      .lineBetween(134 + bw * (MILESTONE_NAME / MILESTONE_DETAIL), y + 20,
        134 + bw * (MILESTONE_NAME / MILESTONE_DETAIL), y + 30); // 里程碑刻度
    row.add(this.add.text(134 + bw + 10, y + 25, i18n.t('codex.research'), {
      fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1.5));

    if (discovered) {
      row.add(this.add.text(w - 68, y, `×${e.count}`, {
        fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.gold),
      }).setOrigin(1, 0.5));
    }
    return row;
  }

  private backButton(cx: number, by: number, pal: Palette, i18n: I18n) {
    const bw = 230;
    const bh = 46;
    const btn = this.add.graphics();
    btn.lineStyle(1.5, pal.gold, 0.65).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, BRUSH_RADIUS);
    this.add.text(cx, by, i18n.t('btn.back').replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '').toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx, by, bw, bh, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => fadeToScene(this, 'Map'));
  }
}
```

- [ ] **Step 2: 手動冒煙**

Run: `npm run dev`（`#scene=Codex`）
1. 滾輪與拖曳可捲動、列表不溢出標題/按鈕區。
2. 未發現生物顯示墨影剪影＋「尚未記錄」；有筆記者顯示「山野間已見蹤跡……」；研究度 ≥3 顯示名稱；≥8 顯示描述。
3. 已發現行有品質色點與 ×n；研究度條有里程碑刻度。
4. 縮放視窗：重排正常。

- [ ] **Step 3: 建置與 Commit**

Run: `npm run build` → exit 0

```powershell
git add src/scenes/CodexScene.ts
git commit -m "feat: scrollable codex with research progress, milestone reveals and quality badges"
```

---

### Task 12: U2-lite 營地主選單與流程接線

**Files:**
- Create: `src/scenes/CampScene.ts`
- Modify: `src/scenes/BootScene.ts`
- Modify: `src/scenes/HelpScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: registry `runRound`/`session`/`codex`/`i18n`/`rng`、`createStreak`（Task 4；main.ts 註冊 registry `'streak'`）、`dailyKey`、`newSession`、button 樣式（同 Task 10 的 `button()` 實作，複製為 CampScene 私有方法）
- Produces:
  - 場景流程 Boot → **Camp** → Map；dev jump 支援 `#scene=Camp`
  - registry `'streak'`: `StreakStore`
  - HelpScene 支援 `data.from`（'Camp' | 'Map'）決定 resume 對象
  - Camp 內容：標題＋山稜背景、上山追蹤（第 n 局）、今日行蹤（含已完成勾）、生態圖鑑、`?` 說明、EN/中、連勝 chip

- [ ] **Step 1: main.ts 註冊 streak 與 Camp**

```typescript
import { createStreak } from './core/daily';
import { CampScene } from './scenes/CampScene';
```

`scene:` 陣列改為 `[BootScene, CampScene, MapScene, QteScene, ResultScene, CodexScene, HelpScene]`。
`preBoot` 加：

```typescript
        game.registry.set('streak', createStreak(storage));
```

- [ ] **Step 2: BootScene 轉向 Camp**

`begin` 中 `this.scene.start(this.devTargetScene() ?? 'Map');` 改為 `?? 'Camp'`；
`devTargetScene` 允許清單改為 `['Camp', 'Map', 'Qte', 'Result', 'Codex']`。

- [ ] **Step 3: HelpScene 參數化 resume 目標**

```typescript
  private from: 'Camp' | 'Map' = 'Map';

  init(data: { from?: 'Camp' | 'Map' }) {
    this.from = data.from ?? 'Map';
  }
```

`close()` 改為：

```typescript
  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
```

MapScene 的 `openHelp()` 改為 `this.scene.launch('Help', { from: 'Map' });`。

- [ ] **Step 4: 建立 src/scenes/CampScene.ts**

```typescript
import Phaser from 'phaser';
import { newSession } from '../core/session';
import { createDailySession, dailyKey, type StreakStore } from '../core/daily';
import { getPalette, type Palette } from '../core/palette';
import { CREATURES } from '../data/creatures';
import type { CodexStore } from '../core/codex';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import { cssHex, BRUSH_RADIUS, FONTS } from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';

const stripBrackets = (s: string) => s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');

export class CampScene extends Phaser.Scene {
  private pal!: Palette;

  constructor() {
    super('Camp');
  }

  create() {
    const i18n: I18n = this.registry.get('i18n');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const streak: StreakStore = this.registry.get('streak');
    const runRound: number = this.registry.get('runRound');
    this.pal = getPalette(1); // 營地固定霧綠配色
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.scene.restart()); // Help 關閉後刷新語言

    this.drawRidges(w, h);

    this.add.text(cx, h * 0.16, "RIDGE HUNTER'S TRAIL", {
      fontFamily: FONTS.display, fontSize: '34px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(3);

    // 連勝 chip（右上，>0 才顯示）
    const st = streak.state();
    if (st.streak > 0) {
      this.add.text(w - 20, 24, i18n.t('camp.streak', { n: st.streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(1, 0.5).setLetterSpacing(2);
    }

    const today = dailyKey(new Date());
    const dailyDone = st.lastPlayed === today;
    const bw = Math.min(320, w - 48);
    let by = h * 0.42;

    this.button(cx, by, bw, 54, stripBrackets(i18n.t('camp.continue', { n: runRound })), true, () => {
      this.registry.set('session', newSession(runRound, rng));
      fadeToScene(this, 'Map');
    });
    by += 68;

    const dailyLabel = dailyDone
      ? `${i18n.t('camp.daily')} · ${i18n.t('camp.dailyDone')} ✓`
      : `${i18n.t('camp.daily')} · ${today}`;
    this.button(cx, by, bw, 50, dailyLabel, false, () => {
      this.registry.set('session', createDailySession(new Date()));
      fadeToScene(this, 'Map');
    });
    by += 64;

    const found = CREATURES.filter((c) => codex.entry(c.id).count > 0).length;
    this.button(cx, by, bw, 50,
      `${stripBrackets(i18n.t('btn.guide'))} ${found}/${CREATURES.length}`, false,
      () => fadeToScene(this, 'Codex'));
    by += 72;

    // 小工具列：說明＋語言
    this.add.text(cx - 40, by, '?', {
      fontFamily: FONTS.display, fontSize: '18px', color: cssHex(pal.gold),
    }).setOrigin(0.5);
    this.add.rectangle(cx - 40, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.launch('Help', { from: 'Camp' });
        this.scene.pause();
      });
    this.add.text(cx + 40, by, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.add.rectangle(cx + 40, by, 80, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.scene.restart();
      });
  }

  // 山稜背景：三層漸遠剪影（程式繪製，延續水墨方向）
  private drawRidges(w: number, h: number) {
    const pal = this.pal;
    const layers: { color: number; alpha: number; base: number; amp: number }[] = [
      { color: pal.panel, alpha: 1, base: 0.62, amp: 0.1 },
      { color: pal.terrain.mist, alpha: 0.7, base: 0.72, amp: 0.08 },
      { color: pal.terrain.meadow, alpha: 0.9, base: 0.84, amp: 0.05 },
    ];
    const g = this.add.graphics();
    layers.forEach((l, li) => {
      g.fillStyle(l.color, l.alpha);
      const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: h }];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = (w / n) * i;
        const jag = Math.sin(i * 2.7 + li * 1.3) * l.amp * h;
        pts.push({ x, y: h * l.base + jag });
      }
      pts.push({ x: w, y: h });
      g.fillPoints(pts, true);
    });
    // 營火微光（靜態，不做循環動畫）
    const glow = this.add.graphics();
    glow.fillStyle(pal.gold, 0.12).fillCircle(w / 2, h * 0.9, 60);
    glow.fillStyle(pal.gold, 0.25).fillCircle(w / 2, h * 0.9, 22);
    glow.fillStyle(0xe8b06a, 0.9).fillTriangle(
      w / 2 - 7, h * 0.9 + 8, w / 2 + 7, h * 0.9 + 8, w / 2, h * 0.9 - 12);
  }

  // 與 ResultScene.button 同樣式（hover 增亮、按下微縮）
  private button(
    x: number, y: number, w: number, h: number,
    label: string, filled: boolean, onClick: () => void,
  ) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      if (filled) {
        g.fillStyle(pal.gold, hover ? 1 : 0.92).fillRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      } else {
        g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65).strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      }
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: filled ? '16px' : '14.5px',
      color: filled ? cssHex(pal.bg) : cssHex(pal.gold),
      fontStyle: filled ? 'bold' : 'normal',
    }).setOrigin(0.5).setLetterSpacing(1.5);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); onClick(); });
  }
}
```

- [ ] **Step 5: 手動冒煙**

Run: `npm run dev`
1. 啟動進入營地：山稜三層剪影＋營火＋標題。
2. 「上山追蹤｜第 1 局」→ 地圖；完成一局回來（Task 13 前 Result 仍回 Map，先用 `#scene=Camp` 直達驗證）局數正確。
3. 「今日行蹤」→ 進入 20×20 每日局；同日重進同一張圖（線索佈局一致）。
4. `?` 開說明、關閉回營地；EN/中 切換後整頁刷新。
5. 手機模擬直向：按鈕寬度收縮、皆可點中。

- [ ] **Step 6: 建置與 Commit**

Run: `npm run build` → exit 0

```powershell
git add src/scenes/CampScene.ts src/scenes/BootScene.ts src/scenes/HelpScene.ts src/main.ts
git commit -m "feat: basecamp main menu with daily entry, streak chip and codex shortcut"
```

---

### Task 13: P1 接線——每日結算（連勝記錄＋分享卡＋返回營地）與最終驗收

**Files:**
- Modify: `src/scenes/ResultScene.ts`

**Interfaces:**
- Consumes: `s.mode === 'daily'`、`shareText`（Task 5）、`StreakStore`（registry `'streak'`）、`dailyKey`
- Produces: 每日模式結算——記錄連勝（勝敗都算「有玩」）、顯示連勝、`[複製成績]`（clipboard＋textarea 後備）、`[返回營地]`；主線結算也加小字返回營地入口

- [ ] **Step 1: ResultScene 記帳段落加入連勝**

`if (!s.resolved) { ... }` 區塊內（codex 記帳之後）加：

```typescript
      if (s.mode === 'daily') {
        (this.registry.get('streak') as StreakStore).recordPlay(dailyKey(new Date()));
      }
```

import 補：`import { dailyKey, type StreakStore } from '../core/daily';`、`import { shareText } from '../core/share';`。

- [ ] **Step 2: 按鈕列依 mode 分流**

Task 10 的按鈕段落改為：

```typescript
    const runRound: number = this.registry.get('runRound');
    if (s.mode === 'daily') {
      const streak: StreakStore = this.registry.get('streak');
      const text = shareText(i18n, {
        dateKey: dailyKey(new Date()), caught, quality,
        steps: s.steps, staminaLeft: Math.max(0, s.stamina), streak: streak.state().streak,
      });
      this.add.text(cx, 500, i18n.t('camp.streak', { n: streak.state().streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(2);
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.copy')), true,
        () => this.copyShare(text, i18n));
      this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else if (caught) {
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.next')), true, () => {
        this.registry.set('session', newSession(runRound, rng));
        fadeToScene(this, 'Map');
      });
      this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else {
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
        this.registry.set('session', newSession(s.round, rng, s.mode));
        fadeToScene(this, 'Map');
      });
      this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    }
```

（原本第二顆「生態圖鑑」鈕改由營地與 caught 畫面的圖鑑點列承擔入口；escaped/exhausted 的圖鑑鈕移除以讓位返回營地——營地內有圖鑑入口。）

新增複製方法：

```typescript
  // 剪貼簿優先，失敗退回 textarea+execCommand；成功顯示「已複製！」浮字
  private copyShare(text: string, i18n: I18n) {
    const done = () => {
      const cx = this.scale.width / 2;
      const t = this.add.text(cx, 500, i18n.t('result.copied'), {
        fontFamily: FONTS.body, fontSize: '13px', color: cssHex(this.pal.supply), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
    };
    try {
      navigator.clipboard.writeText(text).then(done, () => this.copyFallback(text, done));
    } catch {
      this.copyFallback(text, done);
    }
  }

  private copyFallback(text: string, done: () => void) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      // 複製不可用時靜默；分享卡文字仍顯示於畫面外不可見，不擋流程
    }
  }
```

- [ ] **Step 3: 全測試**

Run: `npx vitest run`
Expected: 全 PASS

- [ ] **Step 4: 建置**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 5: 最終冒煙清單（完整流程）**

Run: `npm run dev`

| # | 步驟 | 預期 |
|---|---|---|
| 1 | 啟動 | 營地；首次另彈玩法說明 |
| 2 | 今日行蹤 → 完成（成功或失敗） | 結算顯示連勝 1、複製成績出現三行卡（含 emoji），貼到記事本驗證 |
| 3 | 返回營地 → 再進今日行蹤 | 同一張圖；完成後連勝仍為 1（同日不重計）；營地按鈕顯示「今日已完成 ✓」 |
| 4 | 上山追蹤 → 成功收錄 | 品質墨章動畫；下一場狩獵 → 第 2 局；營地按鈕變「第 2 局」 |
| 5 | 故意失敗（逃逸） | 筆記 +n＋研究度條；圖鑑該生物顯示「山野間已見蹤跡……」 |
| 6 | 研究度刷到 ≥3（多次失敗同生物，可用 dev `#scene=Result&phase=escaped` 重複） | 圖鑑未收錄仍顯示名稱 |
| 7 | 手機模擬直向走完整局 | 觸控移動/長按標記/QTE 點擊全可操作，無不可點元素 |
| 8 | localStorage 清空後啟動 | 全新狀態不報錯；有 v1 圖鑑資料時自動遷移（手動塞 `rht.codex.v1` 驗證） |

- [ ] **Step 6: Commit**

```powershell
git add src/scenes/ResultScene.ts
git commit -m "feat: daily challenge result flow with streak recording and share card copy"
```

---

## Self-Review 紀錄

- **Spec 覆蓋**：P1（Task 4/5/12/13）、P2（Task 2/10/11）、P3（Task 1/10/11）、U1（Task 6/7）、U3（Task 8/9）、U5（Task 11）、U6（Task 10/13）、U2-lite（Task 12）。U4/U7 與 P4–P10 屬 Phase 2/3，不在本計畫。
- **型別一致性**：`Quality`（Task 1）供 Task 2/10/11 使用；`CodexStore` v2 介面（Task 2）為 Task 10/11/12 之依據；`SessionState.steps/mode/resolved`（Task 3）為 Task 10/13 之依據；registry key 統一：`session`、`rng`、`codex`、`i18n`、`storage`、`runRound`、`streak`、`qteOutcome`。
- **相容性**：Task 2 移除 `codex.add()` 時同步修補 ResultScene 呼叫點以保 build 綠燈；`counts()` 保留給過渡期。
- **防重記帳**：`resolved` 旗標（Task 3 定義、Task 10 使用）覆蓋 resize-restart 情境；連勝 `recordPlay` 同日冪等（Task 4 測試）。
