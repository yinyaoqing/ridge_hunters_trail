# 推理說明與示範 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一個獨立的互動示範場景，用一個固定、數學已驗證的 9×9 小關卡，把「讀線索 → 疊交集 → 剔除幌子 → 眺望 → 押注」整套推理走一遍。

**Architecture:** 課程內容（關卡、14 步腳本、動手點驗證）放進 `src/core/demo.ts` 當純資料與純函式，因此可單元測試；`src/scenes/DemoScene.ts` 是薄渲染層，沿用 `HelpScene` 已驗證的並行疊層模式（呼叫端 `scene.pause()` + `scene.launch`，關閉時 `scene.resume`）。繪圖一律重用 `paint.ts`，並把 `MapScene` 私有的 `drawClueOverlay` 抽到 `paint.ts` 共用，讓示範與真實地圖的線索圖形**由建構保證相同**，而不是靠兩份程式碼各自維護。

**Tech Stack:** Phaser 3.90、TypeScript 5.6（strict）、Vite 6、Vitest 3。

## Global Constraints

- 上游規格：`docs/superpowers/specs/2026-09-03-deduction-demo-design.md`。與規格衝突時以規格為準，若發現規格有錯，**停下來回報**，不要自行改變設計。
- **Phaser 場景無法單元測試**：`vite.config.ts` 的 `test.environment` 為 `node`。場景層的把關方式是 `npm run build`（＝`tsc --noEmit && vite build`）＋人工冒煙。**不要為場景寫測試，也不要為了讓場景可測而改動架構。**
- 註解一律用繁體中文，寫「**為什麼**」而非「做什麼」。既有程式碼即是範例。
- **不得改動遊戲規則**：`generate.ts`、`difficulty.ts`、`session.ts`、`quirks.ts`、`terrain.ts` 一行都不要動。
- 新增字串一律雙語同步（`en` 與 `zh-TW`）。`tests/i18n.test.ts` 已有雙語鍵一致性測試，漏一邊會直接紅。
- 基準（開工前請自行確認）：`npx vitest run` → **360 tests / 31 files 全綠**；`npx tsc --noEmit` → exit 0；`npx vite build` → exit 0。
- **已知環境問題**：`npm run build` 在 Git Bash 下偶發以 `-1073741819`（0xC0000005）結束，這是 esbuild 的環境問題，不是程式錯誤（見 `.superpowers/sdd/progress.md:106`）。遇到時改跑 `npx tsc --noEmit` 與 `npx vite build` 兩段，兩者皆 exit 0 即視為通過。
- 指令一律用 PowerShell 形式執行：`powershell -NoProfile -Command "<cmd>; exit $LASTEXITCODE"`。
- **場景重啟／重開的欄位殘留**：Phaser 沿用同一個 Scene 實例，欄位值會存活但 GameObject 已被銷毀。凡是可變欄位，一律在 `init()` 或 `create()` 開頭明確重設。這是 Phase 5 付出過代價的教訓。
- 每個 Task 結束時 commit，訊息結尾加上：
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| 檔案 | 職責 |
|---|---|
| `src/core/demo.ts`（新增） | 示範關卡常數、14 步腳本、迷霧、三個動手點的驗證函式。純資料與純函式，零 Phaser 依賴 |
| `tests/demo.test.ts`（新增） | 釘住課程真值：交集大小、幌子不相交、收斂唯一、腳本結構、文案佔位符、動手點正解／反例 |
| `src/core/i18n.ts`（修改） | 新增 26 組 `demo.*` / `btn.*` 字串，雙語 |
| `src/scenes/paint.ts`（修改） | 接收從 MapScene 抽出的 `drawClueOverlay` |
| `src/scenes/MapScene.ts`（修改） | 刪除私有 `drawClueOverlay`，改呼叫 `paint.ts` 版本 |
| `src/scenes/DemoScene.ts`（新增） | 示範場景：面板、網格、疊層、導覽、三個動手點 |
| `src/main.ts`（修改） | 註冊 `DemoScene` |
| `src/scenes/HelpScene.ts`（修改） | 標題下方新增「看示範」按鈕，列表起點下移 |
| `src/scenes/CampScene.ts`（修改） | 工具列新增第四個入口 |
| `src/scenes/ResultScene.ts`（修改） | 主線失敗分支新增示範文字連結 |

---

## Task 1: 示範關卡常數與數學性質

**Files:**
- Create: `src/core/demo.ts`
- Test: `tests/demo.test.ts`

**Interfaces:**
- Consumes: `candidates`/`intersect`/`key`（`src/core/clues.ts`）、`heatMap`/`maxHeat`（`src/core/deduction.ts`）、`Vec2`（`src/core/geometry.ts`）、`Clue`（`src/core/types.ts`）
- Produces: `DEMO_SIZE: 9`、`DEMO_START: Vec2`、`DEMO_TARGET: Vec2`、`DEMO_MID: Vec2`、`DECOY_INDEX: 2`、`DEMO_SCENT_DISTANCE: 6`、`DEMO_CLUES: readonly Clue[]`、`DEMO_PAIR: Set<string>`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/demo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { candidates, intersect, key } from '../src/core/clues';
import { heatMap, maxHeat } from '../src/core/deduction';
import {
  DEMO_SIZE, DEMO_START, DEMO_TARGET, DEMO_MID, DEMO_CLUES, DECOY_INDEX, DEMO_PAIR,
} from '../src/core/demo';

const real = DEMO_CLUES.filter((c) => !c.isDecoy);
const decoy = DEMO_CLUES[DECOY_INDEX];

describe('demo level', () => {
  it('has four clues, exactly one of them a decoy', () => {
    expect(DEMO_CLUES).toHaveLength(4);
    expect(DEMO_CLUES.filter((c) => c.isDecoy)).toHaveLength(1);
    expect(decoy.isDecoy).toBe(true);
  });

  it('keeps every position inside the grid', () => {
    const all = [DEMO_START, DEMO_TARGET, DEMO_MID, ...DEMO_CLUES.map((c) => c.position)];
    for (const p of all) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(DEMO_SIZE);
      expect(p.y).toBeLessThan(DEMO_SIZE);
    }
  });

  it('has every honest clue covering the target', () => {
    for (const c of real) expect(candidates(c, DEMO_SIZE).has(key(DEMO_TARGET))).toBe(true);
  });

  it('has the decoy not covering the target', () => {
    expect(candidates(decoy, DEMO_SIZE).has(key(DEMO_TARGET))).toBe(false);
  });

  it('parks the mid-walk position inside the two-clue overlap', () => {
    // 第 10 步的旁白是「往交集區走過去」。玩家若停在交集區外，那句話就是假的。
    expect(DEMO_PAIR.has(key(DEMO_MID))).toBe(true);
  });
});

describe('demo level: chapter 2 — the overlap is the answer', () => {
  it('narrows to 11 cells once the first two clues are read', () => {
    expect(DEMO_PAIR.size).toBe(11);
    expect(DEMO_PAIR).toEqual(intersect([DEMO_CLUES[0], DEMO_CLUES[1]], DEMO_SIZE));
  });
});

describe('demo level: chapter 3 — the odd one out is the liar', () => {
  // 課程宣稱「兩條互相印證、剩下那條和誰都對不上」。這句話只有在幌子與兩條真線索
  // 皆不相交時才字面成立；若幌子與其中一條有交集，畫面上就會冒出第二塊「符合兩條」的
  // 區域，「落單」的推理當場失效——而玩家只會覺得自己被騙。
  it('has the decoy disjoint from both of the first two clues', () => {
    const d = candidates(decoy, DEMO_SIZE);
    for (const i of [0, 1]) {
      const c = candidates(DEMO_CLUES[i], DEMO_SIZE);
      expect([...d].filter((k) => c.has(k))).toEqual([]);
    }
  });

  it('leaves no cell matching all three, and exactly the 11 matching two', () => {
    const heat = heatMap([DEMO_CLUES[0], DEMO_CLUES[1], decoy], DEMO_SIZE);
    expect(maxHeat(heat)).toBe(2);
    const two = new Set([...heat.entries()].filter(([, n]) => n === 2).map(([k]) => k));
    expect(two).toEqual(DEMO_PAIR);
  });
});

describe('demo level: chapter 4 — it converges', () => {
  it('collapses to exactly the target once all three honest clues are in', () => {
    expect(intersect(real, DEMO_SIZE)).toEqual(new Set([key(DEMO_TARGET)]));
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `powershell -NoProfile -Command "npx vitest run tests/demo.test.ts; exit $LASTEXITCODE"`
Expected: FAIL — `Failed to resolve import "../src/core/demo"`

- [ ] **Step 3: 實作**

Create `src/core/demo.ts`:

```ts
import { intersect } from './clues';
import type { Vec2 } from './geometry';
import type { Clue } from './types';

// 示範關卡：固定、可驗證、與真實關卡同一套規則。
// 9×9 而非真實的 15/20/25——示範要教的是推理，不是耐力，小圖才看得完整張。
export const DEMO_SIZE = 9;
export const DEMO_START: Vec2 = { x: 1, y: 8 };
export const DEMO_TARGET: Vec2 = { x: 6, y: 2 };

// 第四章玩家走到的位置。它必須落在兩條真線索的交集區內，否則
// 第 10 步「往交集區走過去」這句旁白會與畫面矛盾（有測試把關）。
export const DEMO_MID: Vec2 = { x: 4, y: 4 };

// 幌子在陣列中的固定索引。腳本與驗證都引用這個常數而非字面 2，
// 日後若調整線索順序，不會有某一處忘了跟著改。
export const DECOY_INDEX = 2;

// 氣味距離同時出現在線索資料與第 4 步的旁白裡，抽成常數以免兩處各寫一個數字。
export const DEMO_SCENT_DISTANCE = 6;

// 四條線索。參數全部落在 getDifficulty() 實際使用的區間內
// （錐半角 15–40、氣味容差 0.5–1.0、擾動半徑 2–4、氣味距離為整數），
// 不是為教學捏造的特例——玩家在真實關卡遇到的是同一種東西。
//
// 這組數字有三條性質是整套課程的地基，全部釘在 tests/demo.test.ts：
//   ① 線索 0 ∩ 線索 1 恰為 11 格
//   ② 幌子與線索 0、線索 1 皆不相交（第三章「落單的在說謊」才字面成立）
//   ③ 三條真線索的交集恰為 DEMO_TARGET 一格
// ③ 的擾動位置與半徑是掃過全部 81 個位置 × 半徑 {2,3} 後的**唯一解**。
// 動這四條線索的任何一個數字之前，先跑測試。
export const DEMO_CLUES: readonly Clue[] = [
  {
    type: 'footprint', position: { x: 2, y: 7 }, isDecoy: false,
    data: { direction: 309, angleSpread: 25 }, // 309° = round(angleDeg((2,7) → 目標))
  },
  {
    type: 'scent', position: { x: 8, y: 8 }, isDecoy: false,
    // biasDirection 只在持有風向石時才會被畫成偏心弧；示範沒有道具系統，
    // 這裡仍填真實方位（252° = round(angleDeg((8,8) → 目標))），
    // 免得日後若接上道具還得回頭補一個假值
    data: {
      distance: DEMO_SCENT_DISTANCE, tolerance: 0.75,
      windBiasNeeded: false, biasDirection: 252,
    },
  },
  {
    type: 'footprint', position: { x: 3, y: 4 }, isDecoy: true,
    data: { direction: 225, angleSpread: 25 }, // 朝西北，與真相的東北恰好相背
  },
  {
    type: 'disturbance', position: { x: 6, y: 0 }, isDecoy: false,
    data: { radius: 2 },
  },
];

// 前兩條線索的交集（11 格）。腳本的旁白數字、第二章的自動存疑標記、
// 以及 DEMO_MID 的位置驗證都讀它——單一來源，不手寫 11。
export const DEMO_PAIR: Set<string> = intersect([DEMO_CLUES[0], DEMO_CLUES[1]], DEMO_SIZE);
```

- [ ] **Step 4: 執行測試確認通過**

Run: `powershell -NoProfile -Command "npx vitest run tests/demo.test.ts; exit $LASTEXITCODE"`
Expected: PASS，9 個測試全綠

- [ ] **Step 5: 型別檢查**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/core/demo.ts tests/demo.test.ts
git commit -m "feat: add the demo level with its three load-bearing properties pinned

The disturbance position and radius are the unique solution over the whole
81-position x radius {2,3} search space, so the tests are the only thing
standing between a tuning tweak and a lesson that quietly teaches a falsehood.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: i18n 字串

**Files:**
- Modify: `src/core/i18n.ts`（`MsgKey` 聯集尾端、`STRINGS.en`、`STRINGS['zh-TW']`）

**Interfaces:**
- Consumes: 無
- Produces: 26 個新 `MsgKey`：`demo.title`、`demo.progress`、`demo.fromResult`、`demo.ch1`–`demo.ch4`、`demo.s1`–`demo.s14`、`demo.hint.exclude`、`demo.hint.mute`、`demo.hint.wager`、`btn.demo`、`btn.next`、`btn.prev`

> 本任務不新增測試：`tests/i18n.test.ts` 既有的「en 與 zh-TW 涵蓋完全相同的鍵」與「沒有空字串」兩條測試會自動涵蓋新字串，漏一邊會直接紅。

- [ ] **Step 1: 擴充 MsgKey 聯集**

在 `src/core/i18n.ts` 中，把聯集的最後一行

```ts
  | 'score.gain' | 'score.pot' | 'score.lost' | 'btn.bank' | 'btn.push' | 'camp.best' | 'camp.carry';
```

改成

```ts
  | 'score.gain' | 'score.pot' | 'score.lost' | 'btn.bank' | 'btn.push' | 'camp.best' | 'camp.carry'
  | 'demo.title' | 'demo.progress' | 'demo.fromResult'
  | 'demo.ch1' | 'demo.ch2' | 'demo.ch3' | 'demo.ch4'
  | 'demo.s1' | 'demo.s2' | 'demo.s3' | 'demo.s4' | 'demo.s5' | 'demo.s6' | 'demo.s7'
  | 'demo.s8' | 'demo.s9' | 'demo.s10' | 'demo.s11' | 'demo.s12' | 'demo.s13' | 'demo.s14'
  | 'demo.hint.exclude' | 'demo.hint.mute' | 'demo.hint.wager'
  | 'btn.demo' | 'btn.next' | 'btn.prev';
```

- [ ] **Step 2: 加入英文字串**

在 `STRINGS.en` 物件的最後一筆（`'help.route': ...`）之後加入：

```ts
    'demo.title': 'Deduction Walkthrough',
    'demo.progress': '{n} / {total}',
    'demo.fromResult': 'Not sure how to read the clues? Walk through a hunt step by step.',
    'demo.ch1': 'One clue only rules places out',
    'demo.ch2': 'The overlap is the answer',
    'demo.ch3': 'The odd one out is lying',
    'demo.ch4': 'Look around, then call it',
    'demo.s1': '{n} cells. It hides in one of them. A clue never names the cell — it only rules others out.',
    'demo.s2': 'Read the footprint: it heads northeast. It is somewhere inside this cone — {n} cells.',
    'demo.s3': 'So the {n} cells outside the cone are impossible. Pick one and rule it out.',
    'demo.s4': 'A second clue: scent. It sits on the ring, {n} cells out from here.',
    'demo.s5': 'Layer them. The more clues a cell agrees with, the brighter it burns — and only {n} cells agree with both. This is what the Layer button does.',
    'demo.s6': 'A third clue, another footprint. But this one points northwest.',
    'demo.s7': 'Now no cell on the map satisfies all three. They cannot all be true, so one of them is lying.',
    'demo.s8': 'Count the agreements: {n} cells match two clues, none match three. Two corroborate each other; the leftover agrees with nobody.',
    'demo.s9': 'Mute the one that lies. Click its marker.',
    'demo.s10': 'Still {n} cells — too many. And the far ground is dark to you. Walk toward the overlap.',
    'demo.s11': 'Look around. The mist pulls back and a fourth clue surfaces — looking is not only how you find clues, it is how you open up ground to plan through.',
    'demo.s12': 'Lay the disturbance circle over the rest and the three honest clues collapse to a single cell.',
    'demo.s13': 'That is the one. Call it.',
    'demo.s14': 'It was here. Read, layer, discard, look, call — every hunt is these five things.',
    'demo.hint.exclude': 'That cell is still inside the cone, so it is still possible. Pick one outside it.',
    'demo.hint.mute': 'That clue corroborates another one. Look again — which clue agrees with nobody?',
    'demo.hint.wager': 'That cell does not satisfy all three clues. Only one cell does.',
    'btn.demo': '[ Walkthrough ]',
    'btn.next': '[ Next ]',
    'btn.prev': '[ Back ]',
```

- [ ] **Step 3: 加入中文字串**

在 `STRINGS['zh-TW']` 物件的最後一筆（`'help.route': ...`）之後加入：

```ts
    'demo.title': '推理示範',
    'demo.progress': '{n} / {total}',
    'demo.fromResult': '不確定線索該怎麼讀？跟著走一遍完整的推理。',
    'demo.ch1': '一條線索只會排除',
    'demo.ch2': '交集才是答案',
    'demo.ch3': '落單的那條在說謊',
    'demo.ch4': '眺望，然後押注',
    'demo.s1': '{n} 格，牠躲在其中一格。線索從來不會直接指出是哪一格——它只負責把不可能的地方劃掉。',
    'demo.s2': '判讀足跡：牠往東北去了。牠在這片錐形裡的某一格——{n} 格。',
    'demo.s3': '所以錐形外的 {n} 格全都不可能。挑一格，把它標成排除。',
    'demo.s4': '第二條線索是氣味。牠就在離這裡 {n} 格遠的環帶上。',
    'demo.s5': '疊起來看。符合越多線索的格子越亮，而兩條都符合的只剩 {n} 格——這就是「圖層」鈕在做的事。',
    'demo.s6': '第三條線索，又是足跡。但這一枚朝西北。',
    'demo.s7': '現在整張圖沒有任何一格同時滿足三條。它們不可能都是真的，所以其中一條在說謊。',
    'demo.s8': '數符合數：{n} 格符合兩條，沒有一格符合三條。兩條互相印證，剩下那條和誰都對不上。',
    'demo.s9': '把說謊的那條靜音。點它的記號。',
    'demo.s10': '還有 {n} 格，太多了。而更遠的地方你根本看不見。往交集區走過去。',
    'demo.s11': '眺望。霧退開，第四條線索浮了出來——眺望不只是找線索，也是把你能規劃的地面打開。',
    'demo.s12': '把擾動圓域套上去，三條誠實的線索收斂成唯一一格。',
    'demo.s13': '就是這一格。押下去。',
    'demo.s14': '牠就在這裡。讀、疊、剔、望、押——每一局都是這五件事。',
    'demo.hint.exclude': '這格還在錐形裡，仍然有可能。挑錐形外的一格。',
    'demo.hint.mute': '這條和另一條互相吻合。再看一次——哪一條和誰都對不上？',
    'demo.hint.wager': '這格沒有滿足全部三條線索。只有一格滿足。',
    'btn.demo': '［看示範］',
    'btn.next': '［下一步］',
    'btn.prev': '［上一步］',
```

- [ ] **Step 4: 執行測試確認通過**

Run: `powershell -NoProfile -Command "npx vitest run tests/i18n.test.ts; exit $LASTEXITCODE"`
Expected: PASS。若「en 與 zh-TW 涵蓋完全相同的鍵」變紅，代表兩表有拼字不一致，比對錯誤訊息中的差集修正。

- [ ] **Step 5: 型別檢查**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0。若報「Property 'demo.xxx' is missing」，代表某一語系漏了那筆。

- [ ] **Step 6: Commit**

```bash
git add src/core/i18n.ts
git commit -m "feat: add the demo walkthrough strings in both locales

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 十四步腳本

**Files:**
- Modify: `src/core/demo.ts`
- Test: `tests/demo.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `DEMO_SIZE`/`DEMO_START`/`DEMO_MID`/`DEMO_CLUES`/`DECOY_INDEX`/`DEMO_SCENT_DISTANCE`/`DEMO_PAIR`；Task 2 的 `MsgKey`
- Produces: `DemoAction = 'exclude' | 'mute' | 'wager'`、`DemoStep` 介面、`DEMO_STEPS: readonly DemoStep[]`（14 筆）

- [ ] **Step 1: 寫失敗的測試**

在 `tests/demo.test.ts` 檔尾追加，並把最上方的 import 補上新符號：

```ts
// 檔案最上方的 import 改成（新增 STRINGS 與腳本符號）：
// import { STRINGS } from '../src/core/i18n';
// import { ..., DEMO_STEPS, type DemoStep } from '../src/core/demo';

describe('demo script', () => {
  it('is exactly fourteen steps', () => {
    expect(DEMO_STEPS).toHaveLength(14);
  });

  it('walks the four chapters in order without going back', () => {
    const chapters = DEMO_STEPS.map((s) => s.chapter);
    expect(chapters[0]).toBe(1);
    expect(chapters[chapters.length - 1]).toBe(4);
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i]).toBeGreaterThanOrEqual(chapters[i - 1]);
      expect(chapters[i] - chapters[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(new Set(chapters)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('only ever references clues that exist, and only mutes ones already read', () => {
    for (const step of DEMO_STEPS) {
      for (const i of step.clues) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(DEMO_CLUES.length);
      }
      for (const i of step.muted) expect(step.clues).toContain(i);
      expect(new Set(step.clues).size).toBe(step.clues.length);
    }
  });

  it('never un-reads a clue', () => {
    // 課程是單向累積的。若某一步的已讀集合比前一步小，代表腳本寫錯了，
    // 而畫面上會表現為「線索憑空消失」——玩家只會覺得程式壞了。
    for (let i = 1; i < DEMO_STEPS.length; i++) {
      for (const c of DEMO_STEPS[i - 1].clues) expect(DEMO_STEPS[i].clues).toContain(c);
    }
  });

  it('only ever mutes the decoy', () => {
    for (const step of DEMO_STEPS) {
      for (const i of step.muted) expect(i).toBe(DECOY_INDEX);
    }
  });

  it('has exactly three hands-on beats, in the taught order', () => {
    const actions = DEMO_STEPS.map((s) => s.action).filter(Boolean);
    expect(actions).toEqual(['exclude', 'mute', 'wager']);
  });

  it('gives every step a narration string in both locales', () => {
    for (const step of DEMO_STEPS) {
      for (const loc of ['en', 'zh-TW'] as const) {
        expect(STRINGS[loc][step.narration].length).toBeGreaterThan(0);
      }
    }
  });

  it('never uses the same narration twice', () => {
    const keys = DEMO_STEPS.map((s) => s.narration);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pairs every {n} placeholder with a vars value, in both locales', () => {
    // 這條測試是「文案與畫面在結構上不可能對不上」的實際保證：
    // 有 vars 卻沒有佔位符 → 算出來的數字不會被顯示；
    // 有佔位符卻沒有 vars → 玩家會看到字面的「{n}」。
    for (const step of DEMO_STEPS) {
      for (const loc of ['en', 'zh-TW'] as const) {
        expect(/\{n\}/.test(STRINGS[loc][step.narration])).toBe(step.vars !== undefined);
      }
    }
  });

  it('reveals the fourth clue only after the survey step lifts the fog', () => {
    const firstWithClue3 = DEMO_STEPS.findIndex((s) => s.clues.includes(3));
    const firstAllSeen = DEMO_STEPS.findIndex((s) => s.seen === 'all');
    expect(firstAllSeen).toBeGreaterThan(0);
    expect(firstWithClue3).toBeGreaterThan(firstAllSeen);
  });

  it('moves the player to the overlap before the survey', () => {
    const firstMid = DEMO_STEPS.findIndex((s) => s.player === DEMO_MID);
    const firstAllSeen = DEMO_STEPS.findIndex((s) => s.seen === 'all');
    expect(firstMid).toBeGreaterThan(0);
    expect(firstMid).toBeLessThanOrEqual(firstAllSeen);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `powershell -NoProfile -Command "npx vitest run tests/demo.test.ts; exit $LASTEXITCODE"`
Expected: FAIL — `DEMO_STEPS` 不存在（TypeScript 轉譯錯誤或 undefined）

- [ ] **Step 3: 實作**

在 `src/core/demo.ts` 檔尾追加（並把最上方的 import 補上 `MsgKey`）：

```ts
// 檔案最上方 import 追加：
// import type { MsgKey } from './i18n';

// 三個動手點。它們各自對應遊戲裡最容易被完全錯過的功能：
// 排除標記、線索靜音、押注。靜音尤其——它目前只存在於說明頁一行字裡，
// 沒人教就永遠不會有人用。
export type DemoAction = 'exclude' | 'mute' | 'wager';

export interface DemoStep {
  chapter: 1 | 2 | 3 | 4;
  narration: MsgKey;
  // 旁白裡的數字。全部由 candidates()/intersect() 於模組載入時算出，一個都不手寫——
  // 文案與畫面因此在結構上不可能對不上（tests/demo.test.ts 有佔位符對稱測試把關）。
  vars?: Record<string, number>;
  clues: readonly number[];   // 本步已判讀的線索索引
  muted: readonly number[];   // 本步已靜音的線索索引（必為 clues 的子集）
  overlay: 'none' | 'heat' | 'intersect';
  seen: 'near' | 'all';       // 'near' = 最上兩列仍是未探索的暗區
  player: Vec2;
  autoSuspect?: true;         // 為真時，DEMO_PAIR 的 11 格自動標成存疑
  action?: DemoAction;        // 有值時，此步必須玩家動手才能前進
}

const TOTAL_CELLS = DEMO_SIZE * DEMO_SIZE;
const CONE = candidates(DEMO_CLUES[0], DEMO_SIZE);

export const DEMO_STEPS: readonly DemoStep[] = [
  // 第一章：一條線索只會排除
  {
    chapter: 1, narration: 'demo.s1', vars: { n: TOTAL_CELLS },
    clues: [], muted: [], overlay: 'none', seen: 'near', player: DEMO_START,
  },
  {
    chapter: 1, narration: 'demo.s2', vars: { n: CONE.size },
    clues: [0], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
  },
  {
    chapter: 1, narration: 'demo.s3', vars: { n: TOTAL_CELLS - CONE.size },
    clues: [0], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
    action: 'exclude',
  },
  // 第二章：交集才是答案
  {
    chapter: 2, narration: 'demo.s4', vars: { n: DEMO_SCENT_DISTANCE },
    clues: [0, 1], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
  },
  {
    chapter: 2, narration: 'demo.s5', vars: { n: DEMO_PAIR.size },
    clues: [0, 1], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
    autoSuspect: true,
  },
  // 第三章：落單的那條在說謊
  {
    chapter: 3, narration: 'demo.s6',
    clues: [0, 1, 2], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
    autoSuspect: true,
  },
  {
    chapter: 3, narration: 'demo.s7',
    clues: [0, 1, 2], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
    autoSuspect: true,
  },
  {
    chapter: 3, narration: 'demo.s8', vars: { n: DEMO_PAIR.size },
    clues: [0, 1, 2], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
    autoSuspect: true,
  },
  {
    chapter: 3, narration: 'demo.s9',
    clues: [0, 1, 2], muted: [], overlay: 'heat', seen: 'near', player: DEMO_START,
    autoSuspect: true, action: 'mute',
  },
  // 第四章：眺望，然後押注
  {
    chapter: 4, narration: 'demo.s10', vars: { n: DEMO_PAIR.size },
    clues: [0, 1, 2], muted: [DECOY_INDEX], overlay: 'heat', seen: 'near', player: DEMO_MID,
    autoSuspect: true,
  },
  {
    chapter: 4, narration: 'demo.s11',
    clues: [0, 1, 2], muted: [DECOY_INDEX], overlay: 'heat', seen: 'all', player: DEMO_MID,
    autoSuspect: true,
  },
  {
    chapter: 4, narration: 'demo.s12',
    clues: [0, 1, 2, 3], muted: [DECOY_INDEX], overlay: 'intersect', seen: 'all', player: DEMO_MID,
    autoSuspect: true,
  },
  {
    chapter: 4, narration: 'demo.s13',
    clues: [0, 1, 2, 3], muted: [DECOY_INDEX], overlay: 'intersect', seen: 'all', player: DEMO_MID,
    autoSuspect: true, action: 'wager',
  },
  // 揭曉獨立成一步，而不是塞進押注的回呼裡：每一步恰好對應一個顯示狀態，
  // 渲染因此可以是 render(stepIndex) 的純函式，上一步／下一步不會累積狀態漂移。
  {
    chapter: 4, narration: 'demo.s14',
    clues: [0, 1, 2, 3], muted: [DECOY_INDEX], overlay: 'intersect', seen: 'all', player: DEMO_MID,
  },
];
```

注意：`src/core/demo.ts` 最上方的 import 需同時包含 `candidates` 與 `intersect`：

```ts
import { candidates, intersect } from './clues';
```

- [ ] **Step 4: 執行測試確認通過**

Run: `powershell -NoProfile -Command "npx vitest run tests/demo.test.ts; exit $LASTEXITCODE"`
Expected: PASS，全部 20 個測試綠

- [ ] **Step 5: 全套測試與型別檢查**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS
Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/core/demo.ts tests/demo.test.ts
git commit -m "feat: add the fourteen-step demo script

Every number in the narration is computed from the real candidates/intersect
rather than typed by hand, and a test asserts each step's {n} placeholder
matches whether that step supplies a value — so copy and picture cannot drift
apart.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 迷霧與動手點驗證

**Files:**
- Modify: `src/core/demo.ts`
- Test: `tests/demo.test.ts`

**Interfaces:**
- Consumes: Task 1 與 Task 3 的全部輸出
- Produces: `DEMO_FOG_ROWS: 2`、`demoUnseen(step: DemoStep): Set<string>`、`checkCellAction(action: 'exclude' | 'wager', cell: Vec2): MsgKey | null`、`checkMuteAction(clueIndex: number): MsgKey | null`

- [ ] **Step 1: 寫失敗的測試**

在 `tests/demo.test.ts` 檔尾追加（import 補上 `demoUnseen`、`checkCellAction`、`checkMuteAction`，以及 `parseKey`）：

```ts
// 追加 import：
// import { parseKey } from '../src/core/marks';
// import { ..., demoUnseen, checkCellAction, checkMuteAction } from '../src/core/demo';

describe('demoUnseen', () => {
  const nearStep = DEMO_STEPS.find((s) => s.seen === 'near')!;
  const allStep = DEMO_STEPS.find((s) => s.seen === 'all')!;

  it('hides the fourth clue before the survey', () => {
    expect(demoUnseen(nearStep).has(key(DEMO_CLUES[3].position))).toBe(true);
  });

  it('never hides any of the eleven overlap cells', () => {
    // 第二、三章整章都在講那 11 格。若迷霧蓋掉其中任何一格，
    // 玩家會在畫面上看到與旁白不同的數字。
    const unseen = demoUnseen(nearStep);
    for (const k of DEMO_PAIR) expect(unseen.has(k)).toBe(false);
  });

  it('never hides the target, the start, or the mid-walk position', () => {
    const unseen = demoUnseen(nearStep);
    for (const p of [DEMO_TARGET, DEMO_START, DEMO_MID]) expect(unseen.has(key(p))).toBe(false);
  });

  it('hides nothing once the survey has run', () => {
    expect(demoUnseen(allStep).size).toBe(0);
  });
});

describe('checkCellAction: exclude', () => {
  it('accepts a cell outside the cone', () => {
    expect(checkCellAction('exclude', { x: 0, y: 0 })).toBe(null);
  });

  it('rejects a cell inside the cone and says why', () => {
    const inside = parseKey([...candidates(DEMO_CLUES[0], DEMO_SIZE)][0]);
    expect(checkCellAction('exclude', inside)).toBe('demo.hint.exclude');
  });

  it('rejects excluding the target, which is inside the cone', () => {
    expect(checkCellAction('exclude', DEMO_TARGET)).toBe('demo.hint.exclude');
  });
});

describe('checkCellAction: wager', () => {
  it('accepts the target', () => {
    expect(checkCellAction('wager', DEMO_TARGET)).toBe(null);
  });

  it('rejects a cell that is merely in the overlap', () => {
    // 最容易踩的錯：玩家點了 11 格裡的另一格。這條確保提示會出現，而不是靜默接受。
    const other = parseKey([...DEMO_PAIR].find((k) => k !== key(DEMO_TARGET))!);
    expect(checkCellAction('wager', other)).toBe('demo.hint.wager');
  });

  it('rejects an empty cell', () => {
    expect(checkCellAction('wager', { x: 0, y: 0 })).toBe('demo.hint.wager');
  });
});

describe('checkMuteAction', () => {
  it('accepts the decoy', () => {
    expect(checkMuteAction(DECOY_INDEX)).toBe(null);
  });

  it('rejects every honest clue', () => {
    for (let i = 0; i < DEMO_CLUES.length; i++) {
      if (i === DECOY_INDEX) continue;
      expect(checkMuteAction(i)).toBe('demo.hint.mute');
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `powershell -NoProfile -Command "npx vitest run tests/demo.test.ts; exit $LASTEXITCODE"`
Expected: FAIL — `demoUnseen is not a function`（或轉譯期找不到匯出）

- [ ] **Step 3: 實作**

在 `src/core/demo.ts` 檔尾追加（import 補上 `key`）：

```ts
// 檔案最上方 import 改成：
// import { candidates, intersect, key } from './clues';

// 迷霧：示範不重現 vision.ts 的視野規則——那是 help.vision 的職責，在這裡只會分散注意力。
// 迷霧在此只需成立一件事：第四條線索藏在你看不見的地方。因此直接以最上面兩列為未探索區，
// 它剛好涵蓋線索 3 的 (6,0)，且完全不觸及 11 格交集區（其最小 y 為 2）——兩者皆有測試把關。
export const DEMO_FOG_ROWS = 2;

export function demoUnseen(step: DemoStep): Set<string> {
  const out = new Set<string>();
  if (step.seen === 'all') return out;
  for (let y = 0; y < DEMO_FOG_ROWS; y++) {
    for (let x = 0; x < DEMO_SIZE; x++) out.add(key({ x, y }));
  }
  return out;
}

// 動手點驗證。回傳 null 表示接受，否則回傳該顯示的提示 MsgKey。
// 拆成兩個函式而非一個吃 `Vec2 | number` 的聯集——格子動作與線索動作本來就是
// 不同的東西，讓型別替呼叫端擋掉傳錯的參數。
//
// 排除只接受錐形外的格子：這一步要教的正是「線索的作用是排除」，
// 點進錐形內就代表這件事還沒學會，此時給提示比給通過更有價值。
export function checkCellAction(action: 'exclude' | 'wager', cell: Vec2): MsgKey | null {
  if (action === 'exclude') return CONE.has(key(cell)) ? 'demo.hint.exclude' : null;
  return key(cell) === key(DEMO_TARGET) ? null : 'demo.hint.wager';
}

export function checkMuteAction(clueIndex: number): MsgKey | null {
  return clueIndex === DECOY_INDEX ? null : 'demo.hint.mute';
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `powershell -NoProfile -Command "npx vitest run tests/demo.test.ts; exit $LASTEXITCODE"`
Expected: PASS，全部 32 個測試綠

- [ ] **Step 5: 全套測試與型別檢查**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS
Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/core/demo.ts tests/demo.test.ts
git commit -m "feat: add demo fog and the three hands-on validators

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 把 drawClueOverlay 抽到 paint.ts

**Files:**
- Modify: `src/scenes/paint.ts`
- Modify: `src/scenes/MapScene.ts:1446-1470`（私有 `drawClueOverlay` 整段刪除，呼叫端改寫）

**Interfaces:**
- Consumes: `Clue`（`src/core/types.ts`）、`Palette`（`src/core/palette.ts`）、既有的 `dashedLine`/`dashedCircle`/`dashedArc`
- Produces: `drawClueOverlay(g, clue, center, cell, pal, windstone): void`（`src/scenes/paint.ts`）

> **為什麼要抽**：規格要求示範看到的線索圖形與真實地圖**逐像素相同**——那是教學能遷移的前提。
> 抄一份到 DemoScene 只能在抄的當下相同，之後任何一邊調整都會靜默分歧。抽成共用函式讓這件事
> 由建構保證。這是純粹的搬移，不改任何幾何。

- [ ] **Step 1: 在 paint.ts 新增共用函式**

在 `src/scenes/paint.ts` 的 `drawSupply` 之後加入（並把最上方 import 的 `../core/types` 補上 `Clue`）：

```ts
// 檔案最上方 import 改成：
// import type { Clue, ClueType, Locale, TerrainType } from '../core/types';

// 已判讀線索的覆蓋層（設計板）：足跡＝金色錐形（淡填色＋點描邊線）、
// 擾動＝金色虛線圓域、氣味＝發光色虛線距離環。
// 由 MapScene 與 DemoScene 共用——示範看到的圖形必須與真實地圖逐像素相同，
// 否則玩家在示範裡學到的形狀在真實地圖上認不出來。
// windstone 為真時，氣味的完整距離環收窄為 240° 偏心弧（風向石效果）。
export function drawClueOverlay(
  g: Gfx, c: Clue, center: { x: number; y: number }, cell: number,
  pal: Palette, windstone: boolean,
): void {
  if (c.type === 'footprint') {
    const len = cell * 5;
    const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
    const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
    const p1 = { x: center.x + len * Math.cos(a1), y: center.y + len * Math.sin(a1) };
    const p2 = { x: center.x + len * Math.cos(a2), y: center.y + len * Math.sin(a2) };
    g.fillStyle(pal.gold, 0.1).fillTriangle(center.x, center.y, p1.x, p1.y, p2.x, p2.y);
    dashedLine(g, center.x, center.y, p1.x, p1.y, pal.gold, 0.55);
    dashedLine(g, center.x, center.y, p2.x, p2.y, pal.gold, 0.55);
  } else if (c.type === 'disturbance') {
    g.fillStyle(pal.gold, 0.05).fillCircle(center.x, center.y, c.data.radius * cell);
    dashedCircle(g, center.x, center.y, c.data.radius * cell, pal.gold, 0.45, 2, 6, 9);
  } else if (windstone) {
    dashedArc(g, center.x, center.y, c.data.distance * cell, c.data.biasDirection, 240, pal.glow, 0.5, 2, 3, 8);
  } else {
    dashedCircle(g, center.x, center.y, c.data.distance * cell, pal.glow, 0.5, 2, 3, 8);
  }
}
```

- [ ] **Step 2: 刪除 MapScene 的私有版本**

在 `src/scenes/MapScene.ts` 中，刪除整個私有方法 `private drawClueOverlay(c: Clue, px: ...) { ... }`（含其上方的兩行註解，該註解已搬到 paint.ts）。

- [ ] **Step 3: 改寫 MapScene 的呼叫端**

把（約在 `redraw()` 中）

```ts
      if (s.readClues.has(key(c.position)) && !s.mutedClues.has(i)) this.drawClueOverlay(c, px);
```

改成

```ts
      if (s.readClues.has(key(c.position)) && !s.mutedClues.has(i)) {
        drawClueOverlay(this.g, c, px(c.position), cs, pal, this.tools.has('windstone'));
      }
```

並把 `src/scenes/MapScene.ts` 最上方從 `./paint` 的 import 清單加入 `drawClueOverlay`。

若 `dashedArc` 在 MapScene 中已無其他呼叫點，`tsc` 的 `noUnusedLocals`／lint 可能報未使用；此時把它從 MapScene 的 import 清單移除。**先跑型別檢查再決定，不要憑猜測刪 import。**

- [ ] **Step 4: 型別檢查與建置**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0
Run: `powershell -NoProfile -Command "npx vite build; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 5: 全套測試**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS（本任務為純搬移，測試數不應改變）

- [ ] **Step 6: Commit**

```bash
git add src/scenes/paint.ts src/scenes/MapScene.ts
git commit -m "refactor: lift drawClueOverlay from MapScene into paint

The demo scene must draw clue shapes pixel-identically to the real map or the
lesson does not transfer. Sharing one function makes that true by construction
instead of by two copies staying in step.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: DemoScene 骨架、註冊與說明頁入口

**Files:**
- Create: `src/scenes/DemoScene.ts`
- Modify: `src/main.ts`（import 與 `scene:` 陣列）
- Modify: `src/scenes/HelpScene.ts`（新增按鈕，`listTop` 由 `py0 + 160` 改為 `py0 + 208`）

**Interfaces:**
- Consumes: `DEMO_STEPS`（Task 3）、`btn.demo`/`demo.title`（Task 2）
- Produces: 場景鍵 `'Demo'`，以 `this.scene.launch('Demo', { from })` 開啟，`from: 'Camp' | 'Map' | 'Result'`

> 本任務的目標是**最小可見閉環**：從說明頁能開啟示範、看到面板與標題、按關閉能正確回到原場景。
> 網格與內容留給 Task 7。

- [ ] **Step 1: 建立場景骨架**

Create `src/scenes/DemoScene.ts`:

```ts
import Phaser from 'phaser';
import type { I18n } from '../core/i18n';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { DEMO_STEPS } from '../core/demo';
import { cssHex, BRUSH_RADIUS, FONTS, displayFont } from './paint';

type DemoFrom = 'Camp' | 'Map' | 'Result';

// 推理示範：以並行場景疊在暫停的來源場景上（同 HelpScene 的手法）。
// 課程內容全部在 src/core/demo.ts，本檔只負責把它畫出來與收玩家的點擊。
export class DemoScene extends Phaser.Scene {
  private pal!: Palette;
  private from: DemoFrom = 'Camp';
  private step = 0;

  constructor() {
    super('Demo');
  }

  // 場景實例跨次開啟存活，欄位初始值不會重新套用——每次進來都必須明確歸零，
  // 否則第二次打開會停在上一次離開的那一步（Phase 5 付過代價的同一類問題）。
  init(data: { from?: DemoFrom }) {
    this.from = data?.from ?? 'Camp';
    this.step = 0;
  }

  create() {
    const s: SessionState = this.registry.get('session');
    this.pal = getPalette(s.round);
    const pal = this.pal;
    const i18n = this.i18n();
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    // 遮罩：擋住下層場景的點擊
    this.add.rectangle(cx, h / 2, w, h, 0x000000, 0.72).setInteractive();

    const pw = Math.min(580, w - 24);
    const ph = Math.min(636, h - 32);
    const px0 = cx - pw / 2;
    const py0 = (h - ph) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(pal.panel, 1).fillRoundedRect(px0, py0, pw, ph, { tl: 14, tr: 8, br: 13, bl: 9 });
    panel.lineStyle(1.5, pal.gold, 0.55).strokeRoundedRect(px0, py0, pw, ph, { tl: 14, tr: 8, br: 13, bl: 9 });

    // 關閉鈕（右上角筆觸 X，同 HelpScene）
    const closeG = this.add.graphics();
    const cxx = px0 + pw - 30;
    const cxy = py0 + 30;
    closeG.lineStyle(2.5, pal.paperDim, 0.9);
    closeG.lineBetween(cxx - 8, cxy - 8, cxx + 8, cxy + 8);
    closeG.lineBetween(cxx + 8, cxy - 8, cxx - 8, cxy + 8);
    this.add.rectangle(cxx, cxy, 40, 40, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    this.add.text(cx, py0 + 34, i18n.t('demo.title'), {
      fontFamily: displayFont(i18n.locale()), fontSize: '23px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1.5);

    // 暫時的佔位：Task 7 會換成網格與旁白
    this.add.text(cx, py0 + ph / 2, `${DEMO_STEPS.length}`, {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    // BRUSH_RADIUS 於 Task 8 的導覽按鈕使用；此處先行引入以固定 import 清單
    void BRUSH_RADIUS;
  }

  private i18n(): I18n {
    return this.registry.get('i18n');
  }

  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
```

> `void BRUSH_RADIUS;` 是刻意的暫時行，Task 8 接上導覽按鈕後**必須刪掉**。

- [ ] **Step 2: 註冊場景**

在 `src/main.ts` 加入 import：

```ts
import { DemoScene } from './scenes/DemoScene';
```

並把 `scene:` 陣列改成：

```ts
    scene: [BootScene, CampScene, MapScene, QteScene, RevealScene, ResultScene, CodexScene, HelpScene, DemoScene],
```

- [ ] **Step 3: 在說明頁加入入口**

在 `src/scenes/HelpScene.ts` 中，於 `help.goal` 的 `this.add.text(...)` 之後、`const icons = this.add.graphics();` 之前，插入：

```ts
    // 示範入口：說明頁只能「告訴」，示範才能「示範」。放在列表之上、簡介之下，
    // 是進入這個畫面的人第一眼會看到的可點擊物件。
    const dbw = 210;
    const dbh = 36;
    const dby = py0 + 176;
    const demoBtn = this.add.graphics();
    demoBtn.lineStyle(1.5, pal.gold, 0.8).strokeRoundedRect(cx - dbw / 2, dby - dbh / 2, dbw, dbh, BRUSH_RADIUS);
    this.add.text(cx, dby, stripBrackets(i18n.t('btn.demo')).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx, dby, dbw, Math.max(dbh, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        // 先 launch 再 stop：兩者都是排進 SceneManager 的操作，
        // 依序處理；反過來寫會在自己已被標記關閉之後才要求開啟新場景。
        this.scene.launch('Demo', { from: this.from });
        this.scene.stop();
      });
```

同時把 `src/scenes/HelpScene.ts` 從 `./paint` 的 import 清單加入 `stripBrackets`。

- [ ] **Step 4: 下移說明列表起點**

在同檔中，把

```ts
    this.listTop = py0 + 160;
```

改成

```ts
    // 示範按鈕佔用 py0+158 到 py0+194 一帶，列表起點讓出 48px。
    // viewH 與 minY 都由 listTop 推導，列表本來就可捲動，因此不需要調整 ph。
    this.listTop = py0 + 208;
```

- [ ] **Step 5: 型別檢查與建置**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0
Run: `powershell -NoProfile -Command "npx vite build; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 6: 全套測試**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/scenes/DemoScene.ts src/main.ts src/scenes/HelpScene.ts
git commit -m "feat: add the demo scene shell and its help-panel entry

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 網格渲染

**Files:**
- Modify: `src/scenes/DemoScene.ts`

**Interfaces:**
- Consumes: `DEMO_SIZE`/`DEMO_CLUES`/`DEMO_PAIR`/`DEMO_TARGET`/`DEMO_STEPS`/`demoUnseen`（`src/core/demo.ts`）、`heatMap`/`maxHeat`（`src/core/deduction.ts`）、`intersect`/`key`（`src/core/clues.ts`）、`MarkMap`（`src/core/marks.ts`）、`drawClueOverlay`/`drawClueToken`（Task 5 與 `paint.ts`）
- Produces: `DemoScene` 私有的 `render()`，供 Task 8 的導覽與 Task 9 的動手點呼叫

- [ ] **Step 1: 加入欄位與版面計算**

在 `DemoScene` 的欄位區加入：

```ts
  private gridG!: Phaser.GameObjects.Graphics;
  private chapterText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private narrationText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private cell = 40;
  private gx = 0;   // 網格左上角
  private gy = 0;
  // 玩家在動手點 ① 選中的排除格。由玩家決定，因此必須存下來，
  // 之後每一步都要把那個紅 ✕ 畫回去。
  private excluded: Vec2 | null = null;
  // 已完成的動手步驟索引。用它讓「上一步」回頭後不必重做一次同樣的動作。
  private done = new Set<number>();
```

並把 `init()` 的重設區塊補齊：

```ts
  init(data: { from?: DemoFrom }) {
    this.from = data?.from ?? 'Camp';
    this.step = 0;
    this.excluded = null;
    this.done = new Set();
  }
```

import 補上：

```ts
import type { Vec2 } from '../core/geometry';
import { intersect, key } from '../core/clues';
import { heatMap, maxHeat } from '../core/deduction';
import type { MarkMap } from '../core/marks';
import {
  DEMO_SIZE, DEMO_CLUES, DEMO_PAIR, DEMO_TARGET, DEMO_STEPS, demoUnseen, type DemoStep,
} from '../core/demo';
import { cssHex, BRUSH_RADIUS, FONTS, displayFont, drawClueToken, drawClueOverlay } from './paint';
```

- [ ] **Step 2: 在 create() 中建立網格與文字物件**

把 Task 6 留下的佔位文字（`this.add.text(cx, py0 + ph / 2, ...)`）整段換成：

```ts
    this.chapterText = this.add.text(cx, py0 + 62, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);

    this.progressText = this.add.text(px0 + 30, py0 + 30, '', {
      fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1);

    // 網格尺寸同時受面板寬與可用高度限制：旁白最多三行（約 60px）、
    // 導覽列 56px、上方標題區 88px，其餘全歸網格。
    const gridTop = py0 + 88;
    const availH = ph - 88 - 60 - 56;
    this.cell = Math.max(16, Math.floor(Math.min((pw - 56) / DEMO_SIZE, availH / DEMO_SIZE)));
    this.gx = cx - (this.cell * DEMO_SIZE) / 2;
    this.gy = gridTop;

    this.gridG = this.add.graphics();

    const narrY = this.gy + this.cell * DEMO_SIZE + 30;
    this.narrationText = this.add.text(cx, narrY, '', {
      fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paper),
      wordWrap: { width: pw - 56, useAdvancedWrap: true }, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5, 0);

    // 提示行：只有動手點做錯時才有內容，平時為空字串，不佔視覺重量
    this.hintText = this.add.text(cx, narrY + 62, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.mark),
      wordWrap: { width: pw - 56, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);

    this.render();
```

- [ ] **Step 3: 實作 render() 與其輔助方法**

在 `close()` 之前加入：

```ts
  // 每一步的標記狀態由步驟索引重新算出，而非逐步累加——
  // 上一步／下一步因此永遠不會累積狀態漂移。
  private marksFor(i: number): MarkMap {
    const m: MarkMap = new Map();
    // 排除標記從玩家做完動手點 ① 的下一步開始出現
    if (this.excluded && i > 2) m.set(key(this.excluded), 'exclude');
    if (DEMO_STEPS[i].autoSuspect) {
      for (const k of DEMO_PAIR) if (!m.has(k)) m.set(k, 'suspect');
    }
    // 押注在揭曉那一步出現（覆蓋掉該格原本的存疑，同真實遊戲的三態語意）
    if (i === DEMO_STEPS.length - 1) m.set(key(DEMO_TARGET), 'wager');
    return m;
  }

  private px(v: Vec2): { x: number; y: number } {
    const cs = this.cell;
    return { x: this.gx + v.x * cs + cs / 2, y: this.gy + v.y * cs + cs / 2 };
  }

  private render() {
    const step: DemoStep = DEMO_STEPS[this.step];
    const i18n = this.i18n();
    const pal = this.pal;
    const g = this.gridG;
    const cs = this.cell;
    g.clear();

    // 底面：一律草地色。示範不教地形——那是 help.stamina 的職責，
    // 在這裡只會讓玩家以為地形也是推理的一部分。
    for (let y = 0; y < DEMO_SIZE; y++) {
      for (let x = 0; x < DEMO_SIZE; x++) {
        g.fillStyle(pal.terrain.meadow, 1).fillRect(this.gx + x * cs, this.gy + y * cs, cs, cs);
      }
    }
    g.lineStyle(1, pal.bg, 0.5);
    for (let i = 0; i <= DEMO_SIZE; i++) {
      g.lineBetween(this.gx + i * cs, this.gy, this.gx + i * cs, this.gy + DEMO_SIZE * cs);
      g.lineBetween(this.gx, this.gy + i * cs, this.gx + DEMO_SIZE * cs, this.gy + i * cs);
    }

    const live = step.clues.filter((i) => !step.muted.includes(i)).map((i) => DEMO_CLUES[i]);

    // 疊層：heat 沿用 MapScene 的正規化透明度公式，讓示範看到的濃淡與真實地圖一致；
    // intersect 用單一較高透明度，把「只剩這一格」講死。
    if (step.overlay === 'heat' && live.length > 0) {
      const heat = heatMap(live, DEMO_SIZE);
      const peak = maxHeat(heat);
      if (peak > 0) {
        for (const [hk, n] of heat) {
          const [hx, hy] = hk.split(',').map(Number);
          g.fillStyle(pal.gold, 0.06 + 0.16 * (n / peak))
            .fillRect(this.gx + hx * cs, this.gy + hy * cs, cs, cs);
        }
      }
    } else if (step.overlay === 'intersect' && live.length > 0) {
      for (const ik of intersect(live, DEMO_SIZE)) {
        const [ix, iy] = ik.split(',').map(Number);
        g.fillStyle(pal.gold, 0.3).fillRect(this.gx + ix * cs, this.gy + iy * cs, cs, cs);
      }
    }

    // 線索覆蓋層（未靜音者）與線索記號
    for (const i of step.clues) {
      if (step.muted.includes(i)) continue;
      drawClueOverlay(g, DEMO_CLUES[i], this.px(DEMO_CLUES[i].position), cs, pal, false);
    }
    const tokenR = Math.max(8, cs * 0.34);
    for (const i of step.clues) {
      const p = this.px(DEMO_CLUES[i].position);
      drawClueToken(g, p.x, p.y, tokenR, DEMO_CLUES[i].type, pal);
      if (step.muted.includes(i)) {
        // 靜音斜槓：與 MapScene 及 ♪ chip 同一套語彙
        g.lineStyle(2, pal.paperDim, 0.95);
        g.lineBetween(p.x - tokenR, p.y + tokenR, p.x + tokenR, p.y - tokenR);
      }
    }

    // 三態標記，畫法與 MapScene 相同
    const r = cs * 0.32;
    for (const [mk, kind] of this.marksFor(this.step)) {
      const [mx, my] = mk.split(',').map(Number);
      const p = this.px({ x: mx, y: my });
      if (kind === 'exclude') {
        g.lineStyle(3, pal.mark, 0.9);
        g.lineBetween(p.x - r, p.y - r, p.x + r, p.y + r);
        g.lineBetween(p.x + r, p.y - r, p.x - r, p.y + r);
      } else if (kind === 'suspect') {
        g.lineStyle(2.4, pal.supply, 0.9);
        g.strokeCircle(p.x, p.y, r * 0.85);
        g.lineBetween(p.x, p.y - r * 0.3, p.x, p.y + r * 0.2);
        g.fillStyle(pal.supply, 0.9).fillCircle(p.x, p.y + r * 0.5, 1.6);
      } else {
        g.lineStyle(2.6, pal.gold, 1).strokeCircle(p.x, p.y, r);
        g.lineStyle(1.4, pal.gold, 0.7).strokeCircle(p.x, p.y, r * 0.55);
        g.fillStyle(pal.gold, 1).fillCircle(p.x, p.y, r * 0.2);
      }
    }

    // 迷霧：同 MapScene 的壓暗而非全黑
    for (const uk of demoUnseen(step)) {
      const [ux, uy] = uk.split(',').map(Number);
      g.fillStyle(0x000000, 0.62).fillRect(this.gx + ux * cs, this.gy + uy * cs, cs, cs);
    }

    // 玩家：光暈＋紙墨白圓點
    const pp = this.px(step.player);
    g.fillStyle(pal.paper, 0.18).fillCircle(pp.x, pp.y, cs * 0.42);
    g.fillStyle(pal.paper, 1).fillCircle(pp.x, pp.y, cs * 0.2);

    // 揭曉：最後一步畫出真實位置（同 help.reveal 圖示的語彙）
    if (this.step === DEMO_STEPS.length - 1) {
      const t = this.px(DEMO_TARGET);
      g.fillStyle(pal.glow, 1).fillCircle(t.x, t.y, cs * 0.18);
      g.lineStyle(2.5, pal.gold, 1).strokeCircle(t.x, t.y, cs * 0.44);
    }

    this.chapterText.setText(i18n.t(CHAPTER_KEY[step.chapter]));
    this.progressText.setText(
      i18n.t('demo.progress', { n: this.step + 1, total: DEMO_STEPS.length }));
    this.narrationText.setText(i18n.t(step.narration, step.vars));
    this.hintText.setText('');
  }
```

並在檔尾（class 之外）加入：

```ts
// 章節字串鍵映射：同 MapScene 的 WEATHER_KEY 手法，
// 避免模板字面型別（`demo.ch${n}`）無法收斂為 MsgKey 聯集
const CHAPTER_KEY: Record<1 | 2 | 3 | 4, MsgKey> = {
  1: 'demo.ch1', 2: 'demo.ch2', 3: 'demo.ch3', 4: 'demo.ch4',
};
```

import 補上 `import type { I18n, MsgKey } from '../core/i18n';`（把既有的 `I18n` import 併入同一行）。

- [ ] **Step 4: 移除暫時行**

刪除 Task 6 留下的 `void BRUSH_RADIUS;`（`BRUSH_RADIUS` 會在 Task 8 用到，此時若 `tsc` 報未使用 import，先保留 import 不動，Task 8 會用到它；若 lint 立刻報錯則暫時移出 import，Task 8 再加回）。

- [ ] **Step 5: 型別檢查與建置**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0
Run: `powershell -NoProfile -Command "npx vite build; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 6: 全套測試**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/scenes/DemoScene.ts
git commit -m "feat: render the demo grid, overlays, fog and marks

Marks are recomputed from the step index rather than accumulated, so stepping
backwards can never leave stale state behind.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 導覽

**Files:**
- Modify: `src/scenes/DemoScene.ts`

**Interfaces:**
- Consumes: Task 7 的 `render()`、Task 2 的 `btn.next`/`btn.prev`
- Produces: `DemoScene` 私有的 `canAdvance()`、`goto(i)`、`drawNav()`

- [ ] **Step 1: 加入欄位**

```ts
  private prevG!: Phaser.GameObjects.Graphics;
  private prevTxt!: Phaser.GameObjects.Text;
  private nextG!: Phaser.GameObjects.Graphics;
  private nextTxt!: Phaser.GameObjects.Text;
  private navY = 0;
```

- [ ] **Step 2: 在 create() 中建立導覽列**

在 `this.render();` 這一行**之前**插入：

```ts
    // 導覽列：面板底部，上一步／下一步各半。關閉走右上角的 X 或 ESC。
    this.navY = py0 + ph - 34;
    const nbw = 150;
    const nbh = 42;
    this.prevG = this.add.graphics();
    this.prevTxt = this.add.text(cx - 82, this.navY, stripBrackets(i18n.t('btn.prev')).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx - 82, this.navY, nbw, Math.max(nbh, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goto(this.step - 1));

    this.nextG = this.add.graphics();
    this.nextTxt = this.add.text(cx + 82, this.navY, stripBrackets(i18n.t('btn.next')).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.bg), fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx + 82, this.navY, nbw, Math.max(nbh, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goto(this.step + 1));
```

並把 `stripBrackets` 加入 `./paint` 的 import 清單。

- [ ] **Step 3: 實作導覽方法**

在 `render()` 之後加入：

```ts
  // 動手步驟必須先完成才放行。做過一次之後（this.done 記著），
  // 回頭再前進就不必重做——玩家用「上一步」回去看畫面是常態，
  // 不該因此被罰再操作一次。
  private canAdvance(): boolean {
    const step = DEMO_STEPS[this.step];
    return !step.action || this.done.has(this.step);
  }

  private goto(i: number) {
    if (i < 0 || i >= DEMO_STEPS.length) return;
    if (i > this.step && !this.canAdvance()) return;
    this.step = i;
    this.render();
  }

  // 導覽鈕外觀：下一步在不可前進時以描邊＋暗色呈現，明確表示「還有事要做」。
  private drawNav() {
    const pal = this.pal;
    const cx = this.scale.width / 2;
    const nbw = 150;
    const nbh = 42;
    const box = (x: number) => ({ x: x - nbw / 2, y: this.navY - nbh / 2, w: nbw, h: nbh });

    const pb = box(cx - 82);
    this.prevG.clear();
    const canBack = this.step > 0;
    this.prevG.lineStyle(1.5, pal.gold, canBack ? 0.65 : 0.15)
      .strokeRoundedRect(pb.x, pb.y, pb.w, pb.h, BRUSH_RADIUS);
    this.prevTxt.setColor(cssHex(pal.gold)).setAlpha(canBack ? 1 : 0.3);

    const nb = box(cx + 82);
    const last = this.step === DEMO_STEPS.length - 1;
    const open = this.canAdvance() && !last;
    this.nextG.clear();
    if (open) {
      this.nextG.fillStyle(pal.gold, 0.92).fillRoundedRect(nb.x, nb.y, nb.w, nb.h, BRUSH_RADIUS);
      this.nextTxt.setColor(cssHex(pal.bg)).setAlpha(1);
    } else {
      this.nextG.lineStyle(1.5, pal.gold, 0.15).strokeRoundedRect(nb.x, nb.y, nb.w, nb.h, BRUSH_RADIUS);
      this.nextTxt.setColor(cssHex(pal.gold)).setAlpha(0.3);
    }
  }
```

- [ ] **Step 4: 在 render() 末尾呼叫 drawNav()**

把 `render()` 最後一行 `this.hintText.setText('');` 之後補上：

```ts
    this.drawNav();
```

- [ ] **Step 5: 型別檢查與建置**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0
Run: `powershell -NoProfile -Command "npx vite build; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 6: 全套測試**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/scenes/DemoScene.ts
git commit -m "feat: add demo step navigation with a gated next button

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 三個動手點

**Files:**
- Modify: `src/scenes/DemoScene.ts`

**Interfaces:**
- Consumes: `checkCellAction`/`checkMuteAction`（Task 4）、Task 7 的 `render()`/`px()`、Task 8 的 `goto()`
- Produces: 無對外新介面（`DemoScene` 內部的 `onGridClick`）

- [ ] **Step 1: 加入互動熱區**

在 `create()` 中、`this.gridG = this.add.graphics();` 之後插入：

```ts
    // 單一互動矩形覆蓋整個網格，由座標換算格子——比建立 81 個互動物件簡單，
    // 也與 MapScene 的做法一致。
    const gw = this.cell * DEMO_SIZE;
    this.add.rectangle(this.gx + gw / 2, this.gy + gw / 2, gw, gw, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => this.onGridClick(p));
```

- [ ] **Step 2: 實作點擊處理**

在 `drawNav()` 之後加入：

```ts
  // 網格點擊。只有在該步有動手點時才有作用——其餘步驟點格子不該有任何效果，
  // 免得玩家以為自己弄壞了什麼。
  private onGridClick(p: Phaser.Input.Pointer) {
    const step = DEMO_STEPS[this.step];
    if (!step.action || this.done.has(this.step)) return;

    const cs = this.cell;
    const cell = {
      x: Math.floor((p.x - this.gx) / cs),
      y: Math.floor((p.y - this.gy) / cs),
    };
    if (cell.x < 0 || cell.y < 0 || cell.x >= DEMO_SIZE || cell.y >= DEMO_SIZE) return;

    if (step.action === 'mute') {
      // 靜音要點的是線索記號，不是格子。先找出被點到的是哪一條已判讀的線索；
      // 點在空地上不給提示——那不是「答錯」，只是還沒點到東西。
      const hit = step.clues.find((i) => {
        const q = DEMO_CLUES[i].position;
        return q.x === cell.x && q.y === cell.y;
      });
      if (hit === undefined) return;
      this.resolve(checkMuteAction(hit));
      return;
    }

    this.resolve(checkCellAction(step.action, cell), cell);
  }

  // 動手點的共同收尾：答對就記下並自動前進到下一步（下一步的資料本身就是
  // 這個動作的結果，因此不需要任何中間狀態或計時器）；答錯就顯示提示，畫面不動。
  private resolve(hint: MsgKey | null, cell?: Vec2) {
    if (hint !== null) {
      this.hintText.setText(this.i18n().t(hint));
      return;
    }
    if (DEMO_STEPS[this.step].action === 'exclude' && cell) this.excluded = cell;
    this.done.add(this.step);
    this.goto(this.step + 1);
  }
```

import 補上 `checkCellAction`、`checkMuteAction`（自 `../core/demo`）。

- [ ] **Step 3: 型別檢查與建置**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0
Run: `powershell -NoProfile -Command "npx vite build; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 4: 全套測試**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scenes/DemoScene.ts
git commit -m "feat: wire the three hands-on beats of the demo

A correct action advances straight to the next step, whose declared data is
already the result of that action — no intermediate state and no timer to get
the ordering wrong.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 營地與結算入口

**Files:**
- Modify: `src/scenes/CampScene.ts`（工具列 x 座標與新增入口）
- Modify: `src/scenes/ResultScene.ts`（主線失敗分支）

**Interfaces:**
- Consumes: 場景鍵 `'Demo'`、`demo.fromResult`（Task 2）
- Produces: 無

> **與規格的一處收窄**：規格 §5 寫「`escaped` / `exhausted` 分支」，本任務只接主線失敗分支。
> 每日挑戰失敗分支的垂直預算已被連勝列＋重試鈕＋返回營地鈕佔滿（座標一路夾限到 `h - 30`），
> 硬塞第三個元素會重演 F7 的重疊問題。每日挑戰玩家仍可從營地與說明頁進入示範。
> **這是刻意的取捨，不是遺漏。**

- [ ] **Step 1: 重排營地工具列**

在 `src/scenes/CampScene.ts` 中，把

```ts
    // 小工具列：靜音＋說明＋語言（三鈕置中排列，18px 間距）
    const xSound = cx - 80;
    const xHelp = cx - 18;
    const xLang = cx + 62;
```

改成

```ts
    // 小工具列：靜音＋說明＋示範＋語言（四鈕置中排列）。
    // x 座標重排以容納示範入口，整列的視覺跨距維持對稱（-123 到 +123）。
    const xSound = cx - 101;
    const xHelp = cx - 45;
    const xDemo = cx + 11;
    const xLang = cx + 83;
```

- [ ] **Step 2: 加入示範入口**

在同檔中，於語言鈕（`this.add.text(xLang, by, 'EN / 中', ...)`）**之前**插入：

```ts
    // 示範入口：金色播放三角。營地是玩家在兩局之間停留的地方，
    // 也是唯一不會打斷任何進行中狩獵的入口。
    const demoG = this.add.graphics();
    demoG.fillStyle(pal.gold, 1);
    demoG.fillTriangle(xDemo - 6, by - 9, xDemo - 6, by + 9, xDemo + 10, by);
    this.add.rectangle(xDemo, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.launch('Demo', { from: 'Camp' });
        this.scene.pause();
      });
```

- [ ] **Step 3: 加入結算失敗分支的入口**

在 `src/scenes/ResultScene.ts` 中，找到最後一個 `else` 分支（註解為 `// Daily retry lives in the daily branch above; this is run mode only`），把

```ts
      const yPrimary = Math.min(552 + toolOffset, h - 96);
      const ySecondary = Math.min(614 + toolOffset, h - 34);
      this.button(cx, yPrimary, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
```

改成

```ts
      const yPrimary = Math.min(552 + toolOffset, h - 96);
      const ySecondary = Math.min(614 + toolOffset, h - 34);
      // 示範入口：剛失敗、最想知道「我到底該怎麼想」的那一刻。
      // 做成文字連結而非第三顆按鈕——本畫面的垂直預算已被夾限到 h-34，
      // 沒有再加一列的空間（見 F7 的重疊教訓）。座標綁在主鈕之上 40px，
      // 因此不論夾限把主鈕推到哪裡，兩者的相對關係都成立。
      const demoLinkY = yPrimary - 40;
      this.add.text(cx, demoLinkY, i18n.t('demo.fromResult'), {
        fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
        wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
      }).setOrigin(0.5);
      this.add.rectangle(cx, demoLinkY, 420, 44, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.scene.launch('Demo', { from: 'Result' });
          this.scene.pause();
        });
      this.button(cx, yPrimary, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
```

- [ ] **Step 4: 型別檢查與建置**

Run: `powershell -NoProfile -Command "npx tsc --noEmit; exit $LASTEXITCODE"`
Expected: exit 0
Run: `powershell -NoProfile -Command "npx vite build; exit $LASTEXITCODE"`
Expected: exit 0

- [ ] **Step 5: 全套測試**

Run: `powershell -NoProfile -Command "npx vitest run; exit $LASTEXITCODE"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/scenes/CampScene.ts src/scenes/ResultScene.ts
git commit -m "feat: add demo entries from camp and the run-mode failure screen

The failure entry is a text link rather than a third button: that screen's
vertical budget is already clamped to h-34, and stacking another row there is
how the F7 overlap happened.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 人工冒煙與文件

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-deduction-demo-design.md`（若實作過程有任何偏離，補記於此）
- Modify: `.superpowers/sdd/progress.md`（記錄本階段的延後項）

> **本任務無法由 agent 完成。** 場景層在本專案無法單元測試，以下清單必須由人在瀏覽器中執行。
> 本專案目前已累積 Phase 4、Phase 5 兩期未經實測的視覺改動，建議合併進行。

- [ ] **Step 1: 啟動開發伺服器**

Run: `powershell -NoProfile -Command "npm run dev"`
開啟終端印出的網址。

- [ ] **Step 2: 冒煙清單**

三處入口：

- [ ] 營地工具列出現四個項目（靜音／?／▶／EN 中），彼此不重疊，點 ▶ 能開啟示範
- [ ] 說明頁標題下方出現「看示範」鈕，點下後說明頁關閉、示範開啟
- [ ] 說明頁的 13 列仍可捲動，第一列圖示未被裁切，捲到底看得到最後一列
- [ ] 主線狩獵失敗（走到體力耗盡）後，結算畫面出現示範連結，且未與重試鈕重疊
- [ ] 從三處進入示範、按 X 或 ESC 關閉，都正確回到原本的畫面且該畫面仍可操作

示範內容：

- [ ] 14 步都能前進，進度顯示 `1 / 14` 到 `14 / 14`，章節名隨步驟更換
- [ ] 第 3 步：點錐形內的格子出現提示且不前進；點錐形外的格子出現紅 ✕ 並前進
- [ ] 第 5 步起，11 格交集出現黃色存疑圈
- [ ] 第 9 步：點兩條真線索的記號出現提示；點幌子記號後它轉灰、疊層回到兩條線索的狀態
- [ ] 第 10 步玩家移動到交集區；第 11 步最上兩列的暗區消失，第四條線索出現
- [ ] 第 13 步：點非目標格出現提示；點目標格前進到揭曉，金色雙環與生物點出現
- [ ] 任何一步按「上一步」都能正確回退，且畫面沒有殘留上一步的圖形
- [ ] 動手點做過之後，用「上一步」回去再「下一步」不需要重做

版面與雙語：

- [ ] 切成英文後重新走一遍，旁白沒有溢出面板、沒有出現字面的 `{n}`
- [ ] 視窗縮到 400×700 左右，網格與旁白仍在面板內
- [ ] 視窗縮到很矮（約 500px 高）時導覽列未被裁切

- [ ] **Step 3: 記錄結果**

把冒煙結果與任何延後項寫入 `.superpowers/sdd/progress.md`。若發現缺陷，逐一開修正任務處理，不要直接合併。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-deduction-demo-design.md .superpowers/sdd/progress.md
git commit -m "docs: record the demo walkthrough smoke pass

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 自我檢查紀錄

**規格覆蓋**：§2.1 分層 → Task 1/6；§2.2 介面 → Task 1/3/4（`vars` 由函式改為模組載入時算出的物件，同一保證、少一層間接，規格已同步）；§2.3 渲染層 → Task 5/6/7；§3 關卡 → Task 1；§3.2 迷霧 → Task 4；§4 十四步 → Task 3；§4 三個動手點 → Task 4/9；§5 入口 → Task 6/10（每日挑戰失敗分支刻意不接，理由記於 Task 10）；§6 測試 → Task 1/3/4，第 8 項由既有的 `tests/i18n.test.ts` 涵蓋；§7 版面 → Task 7；§8 不做 → 全計畫未觸及 `generate.ts`／`difficulty.ts`／`tut.*`；§9 風險 → Task 11。

**型別一致性**：`DEMO_STEPS`／`DemoStep`／`DemoAction`／`demoUnseen`／`checkCellAction`／`checkMuteAction`／`DEMO_PAIR`／`DEMO_MID`／`DECOY_INDEX`／`DEMO_SCENT_DISTANCE` 在定義處與所有使用處拼寫一致；`drawClueOverlay` 的六參數簽章在 paint.ts、MapScene、DemoScene 三處相同。

**未決事項**：無。
