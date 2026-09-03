# 版面重排、行動裝置輸入與 QTE 效能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓營地與結算兩個畫面隨視窗高度流動而非固定座標、移除手機上的觸控輸入延遲、並拿掉 QTE 每幀最大的一項 GPU 成本。

**Architecture:** 版面的算術抽成 `src/core/layout.ts` 的純函式 `flowY()`，因此可單元測試；兩個場景改為宣告「區塊與理想間距」，由 `flowY()` 決定實際座標。QTE 拿掉兩個 post-FX 並把每幀重畫的內容縮到只剩指針。手機輸入延遲在 `index.html` 修正。

**Tech Stack:** Phaser 3.90、TypeScript 5.6（strict）、Vite 6、Vitest 3。

## Global Constraints

- **Phaser 場景無法單元測試**：`vite.config.ts` 的 `test.environment` 為 `node`。場景層的把關是 `npx tsc --noEmit`、`npx vite build`，加人工冒煙。**不要為場景寫測試。**
- 註解一律繁體中文，寫「**為什麼**」。
- **不得改動遊戲規則**：`generate.ts`、`difficulty.ts`、`session.ts`、`quirks.ts`、`terrain.ts`、`qte.ts` 的邏輯一行都不要動（`qte.ts` 是純狀態機，本次只動渲染）。
- 基準：`npx vitest run` → **394 tests / 32 files**；`npx tsc --noEmit` exit 0；`npx vite build` exit 0。
- **已知環境問題**：`npm run build` 偶發以 `-1073741819` 結束（esbuild 環境問題，非程式錯誤）。改跑 `npx tsc --noEmit` 與 `npx vite build` 兩段，皆 exit 0 即通過。
- 指令用 PowerShell 工具在**前景**執行，一次一個。**不要開背景 Monitor 等待——你不會被喚回。**
- 每個 Task 結束時 commit，訊息結尾加：
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## 背景：為什麼要做這件事

玩家實測回報三件事，全部已定位到具體成因：

1. **QTE 有延遲感。** `QteScene` 對兩個物件呼叫 `addGlowIfWebGL`，其中一個是**每幀清空重畫**的 Graphics。Phaser 的 Glow 後製以 `SIZE = 1/(quality×distance) = 1/(0.1×10) = 1.0` 編譯 shader，角度迴圈 `ceil(2π/1.0)=7` 步 × 半徑迴圈 10 步 = **每像素 70 次貼圖取樣**。轉盤約 340×340 CSS px，手機 DPR 2 下約 68 萬 fragment，單這一層每幀 3200 萬次取樣，加上剪影層合計約 4000 萬，再加兩次 render target 來回。中階手機 GPU 約 1–2 Gtexel/s，等於每幀 20–40ms 只花在光暈上。
2. **手機觸控延遲。** Phaser **從不設定 `touch-action`**（`node_modules/phaser/src/input/` 與 `scale/` 全域搜尋零命中），`index.html` 也沒設。瀏覽器因此要先判斷這次觸控是否為捲動/縮放手勢才派送 `pointerdown`。同時影響 QTE、地圖點擊與說明頁拖曳。
3. **兩個畫面版面錯亂。** 成因是同一畫面混用三種定位方式。已量出的實際重疊：

| 畫面 | 問題 | 數字 |
|---|---|---|
| Result | 「研究度 n / m」被主鈕蓋住 | 文字 y=526，主鈕上緣也是 526 |
| Camp | 委託第三列被工具列壓到 | 列底 720.8，工具列命中區上緣 708.8——疊 12px |
| Camp | 工具列坐在營火光暈裡 | 工具列 730.8，光暈 696–816 |
| Camp | 標題與第一顆按鈕間大片空白 | 標題 `0.16h`、按鈕 `0.42h`——恆定 26% 高度是空的 |

`ResultScene` 自 y=336 起全為固定座標，`CampScene` 上半百分比、下半流式累加、營火又回百分比。高視窗留白、矮視窗擠爆，是同一個根因的兩面。

## File Structure

| 檔案 | 職責 |
|---|---|
| `src/core/layout.ts`（新增） | `flowY()`：把「區塊高度＋理想間距」排進一段可用高度，空間多就均分、不夠就壓縮間距。純函式，零 Phaser 依賴 |
| `tests/layout.test.ts`（新增） | 釘住 `flowY()` 的性質：不重疊、不超界、間距不低於下限、順序遞增 |
| `index.html`（修改） | 觸控行為與視窗高度 |
| `src/scenes/QteScene.ts`（修改） | 移除兩個 post-FX；靜態／動態繪圖分層 |
| `src/scenes/CampScene.ts`（修改） | 改用 `flowY()`；營火位置改由工具列推導 |
| `src/scenes/ResultScene.ts`（修改） | 改用 `flowY()` |

---

## Task 1: flowY 版面流

**Files:**
- Create: `src/core/layout.ts`
- Test: `tests/layout.test.ts`

**Interfaces:**
- Consumes: 無（純函式，不依賴專案其他模組）
- Produces: `FlowBlock` 介面、`flowY(blocks, top, bottom): number[]`

- [ ] **Step 1: 寫失敗的測試**

Create `tests/layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flowY, type FlowBlock } from '../src/core/layout';

// 由回傳的中心 y 還原每個區塊的上下緣，測試多半在檢查這些邊界的關係
const edges = (blocks: FlowBlock[], ys: number[]) =>
  ys.map((y, i) => ({ top: y - blocks[i].h / 2, bottom: y + blocks[i].h / 2 }));

const B = (h: number, gap: number, extra: Partial<FlowBlock> = {}): FlowBlock =>
  ({ h, gap, ...extra });

describe('flowY: 空間充足時', () => {
  const blocks = [B(40, 20), B(50, 30), B(50, 30)];

  it('回傳每個區塊的中心 y，順序遞增', () => {
    const ys = flowY(blocks, 0, 600);
    expect(ys).toHaveLength(3);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('任兩個區塊都不重疊', () => {
    const e = edges(blocks, flowY(blocks, 0, 600));
    for (let i = 1; i < e.length; i++) expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
  });

  it('整疊都待在 [top, bottom] 之內', () => {
    const e = edges(blocks, flowY(blocks, 100, 700));
    expect(e[0].top).toBeGreaterThanOrEqual(100);
    expect(e[e.length - 1].bottom).toBeLessThanOrEqual(700);
  });

  it('多出來的空間分給每一道間距，而不是全部堆在最上面', () => {
    // 這條測的是營地畫面的實際缺陷：舊版把所有寬裕都留在標題與第一顆按鈕之間，
    // 高視窗因此恆有 26% 的高度是空的。
    const ys = flowY(blocks, 0, 900);
    const e = edges(blocks, ys);
    const firstGap = e[0].top - 0;
    const laterGaps = [e[1].top - e[0].bottom, e[2].top - e[1].bottom];
    for (const g of laterGaps) expect(g).toBeGreaterThan(30); // 都拿到了額外空間
    expect(firstGap).toBeLessThan(200);                        // 沒有把寬裕全塞進第一道
  });

  it('間距不會被撐到無限大——每一道都有上限', () => {
    const e = edges(blocks, flowY(blocks, 0, 5000));
    const gaps = [e[0].top - 0, e[1].top - e[0].bottom, e[2].top - e[1].bottom];
    for (const g of gaps) expect(g).toBeLessThanOrEqual(80); // 預設上限 = gap + 40，此處最大 70
  });
});

describe('flowY: 空間不足時', () => {
  const blocks = [B(40, 20), B(50, 30), B(50, 30), B(44, 30)];

  it('壓縮間距而不是讓區塊互相重疊', () => {
    const e = edges(blocks, flowY(blocks, 0, 260));
    for (let i = 1; i < e.length; i++) expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
  });

  it('間距壓縮到下限就停住', () => {
    const e = edges(blocks, flowY(blocks, 0, 200));
    const gaps = [e[0].top - 0, e[1].top - e[0].bottom, e[2].top - e[1].bottom, e[3].top - e[2].bottom];
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(4); // 預設 minGap
  });

  it('尊重個別區塊指定的 minGap', () => {
    // 按鈕之間需要比文字之間更大的最小間距，否則兩顆按鈕的 44px 命中區會相黏
    const tight = [B(40, 20), B(50, 30, { minGap: 14 }), B(50, 30, { minGap: 14 })];
    const e = edges(tight, flowY(tight, 0, 190));
    expect(e[1].top - e[0].bottom).toBeGreaterThanOrEqual(14);
    expect(e[2].top - e[1].bottom).toBeGreaterThanOrEqual(14);
  });

  it('連下限都塞不下時，回報溢出而不是靜默重疊', () => {
    // 這種視窗本來就放不下；重要的是呼叫端拿得到「已經溢出」的事實，
    // 而不是拿到一組看似正常、實際互疊的座標。
    const e = edges(blocks, flowY(blocks, 0, 100));
    for (let i = 1; i < e.length; i++) expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
    expect(e[e.length - 1].bottom).toBeGreaterThan(100); // 誠實地超出 bottom
  });
});

describe('flowY: 邊界情形', () => {
  it('空陣列回傳空陣列', () => {
    expect(flowY([], 0, 600)).toEqual([]);
  });

  it('單一區塊也照常運作', () => {
    const ys = flowY([B(50, 20)], 0, 600);
    expect(ys).toHaveLength(1);
    expect(ys[0] - 25).toBeGreaterThanOrEqual(0);
  });

  it('gap 省略時視為 0', () => {
    const ys = flowY([{ h: 40 }, { h: 40 }], 0, 80);
    expect(ys[1] - ys[0]).toBe(40);
  });

  it('同樣的輸入永遠得到同樣的輸出', () => {
    const b = [B(40, 20), B(50, 30)];
    expect(flowY(b, 0, 400)).toEqual(flowY(b, 0, 400));
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/layout.test.ts`
Expected: FAIL — `Failed to resolve import "../src/core/layout"`

- [ ] **Step 3: 實作**

Create `src/core/layout.ts`:

```ts
// 垂直版面流：把一疊區塊排進 [top, bottom] 這段高度。
//
// 為什麼要有這個模組：CampScene 與 ResultScene 原本混用固定座標、百分比與流式累加
// 三種定位方式，結果是高視窗留下大片死區、矮視窗直接重疊（研究度文字被主鈕蓋住、
// 委託列被工具列壓到）。把「哪個區塊排在哪裡」的算術抽成純函式，它就能被單元測試——
// 而場景層在本專案是測不到的（vite.config.ts 的 test.environment 為 node）。

export interface FlowBlock {
  h: number;        // 區塊高度
  gap?: number;     // 與前一個區塊之間的理想間距；第一個區塊的 gap 是與 top 的距離。預設 0
  minGap?: number;  // 空間不足時的壓縮下限。預設 4
  maxGap?: number;  // 空間有餘時的放大上限。預設 gap + 40
}

const DEFAULT_MIN_GAP = 4;
const DEFAULT_MAX_GAP_SLACK = 40;

// 回傳每個區塊的**中心 y**（多數 Phaser 文字與按鈕以 setOrigin(0.5) 定位，
// 中心比上緣好用；需要上緣的呼叫端自行減去 h/2）。
//
// 空間有餘：把寬裕平均分給每一道間距，各自不超過 maxGap。刻意不做「整疊置中」——
// 置中會讓標題浮到畫面中央；平均分配則讓內容自然撐開，剩下的留在最下方給背景美術。
// 空間不足：把每一道間距朝 minGap 等比壓縮。
// 連 minGap 都放不下時不再壓縮，讓結果誠實地超出 bottom——回傳一組看似正常、
// 實際互疊的座標會讓呼叫端以為沒事，那比溢出更難查。
export function flowY(blocks: FlowBlock[], top: number, bottom: number): number[] {
  if (blocks.length === 0) return [];

  const gaps = blocks.map((b) => b.gap ?? 0);
  const mins = blocks.map((b, i) => Math.min(b.minGap ?? DEFAULT_MIN_GAP, gaps[i]));
  const maxes = blocks.map((b, i) => b.maxGap ?? gaps[i] + DEFAULT_MAX_GAP_SLACK);

  const content = blocks.reduce((sum, b) => sum + b.h, 0);
  const wanted = gaps.reduce((sum, g) => sum + g, 0);
  const avail = bottom - top;

  let actual: number[];
  if (avail >= content + wanted) {
    // 有餘：逐輪把剩餘空間平均加到還沒到上限的間距上，直到分完或全部觸頂
    actual = [...gaps];
    let slack = avail - content - wanted;
    let open = actual.map((g, i) => g < maxes[i]);
    while (slack > 0.01 && open.some(Boolean)) {
      const n = open.filter(Boolean).length;
      const share = slack / n;
      let used = 0;
      for (let i = 0; i < actual.length; i++) {
        if (!open[i]) continue;
        const add = Math.min(share, maxes[i] - actual[i]);
        actual[i] += add;
        used += add;
        if (actual[i] >= maxes[i] - 0.01) open[i] = false;
      }
      if (used <= 0.01) break; // 全部觸頂，剩下的空間留在最下方
      slack -= used;
    }
  } else {
    // 不足：把每一道間距朝各自的 minGap 等比壓縮。
    // t=1 為完全不壓縮、t=0 為全部壓到下限；解 content + Σ(min + t*(gap-min)) = avail。
    const minTotal = mins.reduce((sum, g) => sum + g, 0);
    const shrinkable = wanted - minTotal;
    const t = shrinkable <= 0 ? 0
      : Math.max(0, Math.min(1, (avail - content - minTotal) / shrinkable));
    actual = gaps.map((g, i) => mins[i] + t * (g - mins[i]));
  }

  const out: number[] = [];
  let cursor = top;
  for (let i = 0; i < blocks.length; i++) {
    cursor += actual[i];
    out.push(cursor + blocks[i].h / 2);
    cursor += blocks[i].h;
  }
  return out;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/layout.test.ts`
Expected: PASS，13 個測試全綠

- [ ] **Step 5: 全套測試與型別檢查**

Run: `npx vitest run` → 407 passing（394 + 13）
Run: `npx tsc --noEmit` → exit 0

- [ ] **Step 6: Commit**

```bash
git add src/core/layout.ts tests/layout.test.ts
git commit -m "feat: add flowY, a testable vertical layout flow

Both screens that misbehaved mixed fixed coordinates, percentages and running
accumulation in one layout. Moving the arithmetic into a pure function makes it
unit-testable, which the scenes themselves can never be.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: QTE 效能與手機觸控輸入

**Files:**
- Modify: `index.html`
- Modify: `src/scenes/QteScene.ts`

**Interfaces:**
- Consumes: 無新介面
- Produces: 無新介面

- [ ] **Step 1: 修正 index.html 的觸控與視窗行為**

把 `<meta name="viewport" ...>` 那一行改成：

```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

把 `<style>` 那一行改成：

```html
  <style>
    /* height:100dvh 讓行動瀏覽器網址列收合時不會反覆改變版面高度（100% 會）；
       舊瀏覽器落回前一行的 100%。 */
    html, body { margin: 0; padding: 0; background: #131a17; height: 100%; height: 100dvh; }
    /* overflow/overscroll：擋掉下拉重新整理與橡皮筋捲動，兩者都會搶走遊戲的觸控。 */
    body { overflow: hidden; overscroll-behavior: none; }
    #app { height: 100%; }
    /* touch-action:none 是本專案手機輸入延遲的主因——Phaser 從不設定它
       （node_modules/phaser 的 input/ 與 scale/ 全域搜尋零命中），
       瀏覽器因此要先判斷這次觸控是不是捲動或縮放手勢，才把 pointerdown 派送出去。
       tap-highlight 則是點擊時的灰色閃框，在遊戲畫面上只是雜訊。 */
    #app canvas { touch-action: none; -webkit-tap-highlight-color: transparent; }
  </style>
```

- [ ] **Step 2: 移除 QteScene 的兩個 post-FX**

在 `src/scenes/QteScene.ts` 中刪除這兩行：

```ts
    // WebGL 時疊加發光後製；Canvas fallback 完全不受影響（弧線/剪影疊圈畫法照舊）
    addGlowIfWebGL(this, this.g, this.pal.gold);
    if (this.sil) addGlowIfWebGL(this, this.sil, s.level.iris ? this.pal.iris : this.pal.glow);
```

換成：

```ts
    // 這裡刻意不掛 Glow 後製。Phaser 的 Glow shader 以
    // SIZE = 1/(quality×distance) = 1/(0.1×10) = 1.0 編譯，角度迴圈 ceil(2π/1)=7 步
    // × 半徑迴圈 10 步 = 每像素 70 次貼圖取樣；轉盤約 340×340 CSS px，手機 DPR 2 下
    // 單這一層每幀就是 3200 萬次取樣，還要加一次 render target 來回。而它掛的又是
    // 每幀清空重畫的 Graphics——這正是玩家回報「指針有延遲感」的來源。
    // 弧區的光暈改由下方 drawArc() 的「寬幅低透明度 ＋ 窄幅實線」兩道描邊手繪，
    // 視覺接近而成本可忽略。
```

並把最上方的 import 從

```ts
import { fadeIn, fadeToScene, addGlowIfWebGL } from './fx';
```

改成

```ts
import { fadeIn, fadeToScene } from './fx';
```

（`addGlowIfWebGL` 仍由 `ResultScene` 使用，**不要**從 `fx.ts` 刪除它。）

- [ ] **Step 3: 把每幀重畫的內容縮到只剩指針**

`draw()` 目前每幀重建弧區、指針、命中點列並重設進度文字，但其中只有指針每幀會變：弧區只在 `press()` 換位置時變，命中點列與進度文字只在命中數／嘗試數變動時變。

把欄位宣告

```ts
  private g!: Phaser.GameObjects.Graphics;
  private dots!: Phaser.GameObjects.Graphics;
```

改成

```ts
  private arcG!: Phaser.GameObjects.Graphics;    // 弧區：只在弧區換位置時重畫
  private needleG!: Phaser.GameObjects.Graphics; // 指針與軸心：每幀重畫
  private dots!: Phaser.GameObjects.Graphics;    // 命中點列：只在命中數變動時重畫
  private shownArc = -1;   // 上次畫出的 arcStart，用來判斷弧區要不要重畫
  private shownHits = -1;  // 上次畫出的命中數
  private shownAttempt = -1;
```

在 `create()` 中，把

```ts
    this.g = this.add.graphics();
    this.dots = this.add.graphics();
```

改成

```ts
    this.arcG = this.add.graphics();
    this.needleG = this.add.graphics();
    this.dots = this.add.graphics();
    // 場景實例跨局存活，這些「上次畫了什麼」的快取必須明確重設，
    // 否則第二局的弧區會因為與上一局的殘值相同而不重畫
    this.shownArc = -1;
    this.shownHits = -1;
    this.shownAttempt = -1;
```

然後把整個 `draw()` 方法換成下面四個方法：

```ts
  private draw() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 20;

    if (this.shownArc !== this.q.arcStart) {
      this.shownArc = this.q.arcStart;
      this.drawArc(cx, cy);
    }
    if (this.shownHits !== this.q.hits || this.shownAttempt !== this.q.attempt) {
      this.shownHits = this.q.hits;
      this.shownAttempt = this.q.attempt;
      this.drawDots(cx, cy);
      this.info.setText(this.i18n.t('qte.progress', {
        hits: this.q.hits, needed: this.cfg.needed,
        attempt: this.q.attempt, rounds: this.cfg.rounds,
      }));
    }
    this.drawNeedle(cx, cy);
  }

  // 發光弧區：寬幅低透明度模擬光暈＋窄幅實線（手繪光暈，取代成本高昂的 Glow 後製）
  private drawArc(cx: number, cy: number) {
    const pal = this.pal;
    const a0 = Phaser.Math.DegToRad(this.q.arcStart);
    const a1 = Phaser.Math.DegToRad(this.q.arcStart + this.cfg.arcSize);
    this.arcG.clear();
    this.arcG.lineStyle(18, pal.gold, 0.3);
    this.arcG.beginPath();
    this.arcG.arc(cx, cy, R, a0, a1);
    this.arcG.strokePath();
    this.arcG.lineStyle(8, pal.gold, 1);
    this.arcG.beginPath();
    this.arcG.arc(cx, cy, R, a0, a1);
    this.arcG.strokePath();
  }

  // 指針與軸心：全場唯一每幀都要重畫的東西
  private drawNeedle(cx: number, cy: number) {
    const pal = this.pal;
    const pr = Phaser.Math.DegToRad(this.q.pointer);
    this.needleG.clear();
    this.needleG.lineStyle(4, pal.paper, 1);
    this.needleG.lineBetween(
      cx - 22 * Math.cos(pr), cy - 22 * Math.sin(pr),
      cx + (R - 8) * Math.cos(pr), cy + (R - 8) * Math.sin(pr),
    );
    this.needleG.fillStyle(pal.paper, 1).fillCircle(cx, cy, 7);
    this.needleG.lineStyle(1.2, pal.paper, 0.4).strokeCircle(cx, cy, 10.5);
  }

  // 命中點列（needed 顆，命中者填金）
  private drawDots(cx: number, cy: number) {
    const pal = this.pal;
    this.dots.clear();
    const gap = 26;
    const startX = cx - ((this.cfg.needed - 1) * gap) / 2;
    for (let i = 0; i < this.cfg.needed; i++) {
      const x = startX + i * gap;
      const y = cy + R + 34;
      if (i < this.q.hits) {
        this.dots.fillStyle(pal.gold, 0.25).fillCircle(x, y, 10);
        this.dots.fillStyle(pal.gold, 1).fillCircle(x, y, 6.5);
      } else {
        this.dots.lineStyle(1.5, pal.paper, 0.4).strokeCircle(x, y, 6.5);
      }
    }
  }
```

注意 `shownArc` 的初值 `-1`：`rollArc` 回傳 `rng() * (360 - arcSize)`，恆為非負，所以第一幀必定與 `-1` 不同而觸發首次繪製。

- [ ] **Step 4: 型別檢查與建置**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build` → exit 0

- [ ] **Step 5: 全套測試**

Run: `npx vitest run` → 407 passing（本任務不改測試）

- [ ] **Step 6: Commit**

```bash
git add index.html src/scenes/QteScene.ts
git commit -m "perf: drop the QTE's glow post-FX and unset touch-action on mobile

The dial's Graphics is cleared and rebuilt every frame, and it carried a Glow
post-FX compiled at seventy texture samples per fragment — about thirty-two
million samples a frame on a DPR-2 phone, plus a render-target round trip, for
a bloom the arc already draws by hand with a wide translucent stroke.

Phaser never sets touch-action, so the browser was holding pointerdown back
while it decided whether each touch was a scroll or a pinch. That one is not
specific to the QTE; it delayed every tap in the game.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: CampScene 改用 flowY

**Files:**
- Modify: `src/scenes/CampScene.ts`

**Interfaces:**
- Consumes: `flowY`、`FlowBlock`（Task 1）
- Produces: 無新介面

> **要修的三件事：**標題與第一顆按鈕之間恆有 26% 高度的死區（`0.16h` 對 `0.42h`）；
> 委託第三列與工具列重疊 12px；工具列坐在營火光暈裡（工具列 730.8、光暈 696–816，h=840 時）。

- [ ] **Step 1: 把垂直定位改成 flowY**

在 `src/scenes/CampScene.ts` 的 import 加入：

```ts
import { flowY, type FlowBlock } from '../core/layout';
```

`create()` 中，目前依序以 `h * 0.16`（標題）與 `by = h * 0.42` 起算、之後不斷 `by +=` 的那一整段垂直定位，改為**先宣告區塊、再一次算出座標**。在畫標題之前插入：

```ts
    // 版面改由 flowY 排定（見 src/core/layout.ts）。舊版標題釘在 0.16h、按鈕列從 0.42h
    // 起算，兩者之間因此恆有 26% 的高度是空的；而下半部又是流式累加，內容一長就撞進
    // 營火光暈。現在整疊由同一套規則排列，寬裕平均分給各道間距，不足時等比壓縮。
    const showRows = h >= 692; // 委託板是否展開成三列（矮視窗收合為單行）
    const blocks: FlowBlock[] = [
      { h: 44, gap: 40, maxGap: 96 },          // 標題
      { h: 54, gap: 56, minGap: 24 },          // 上山追蹤
      { h: 50, gap: 14, minGap: 10 },          // 今日行蹤
      { h: 50, gap: 14, minGap: 10 },          // 生態圖鑑
      ...(showRows
        ? [
          { h: 14, gap: 34, minGap: 16 } as FlowBlock, // 「委託板」小標
          { h: 44, gap: 8, minGap: 6 } as FlowBlock,
          { h: 44, gap: 6, minGap: 6 } as FlowBlock,
          { h: 44, gap: 6, minGap: 6 } as FlowBlock,
        ]
        : [{ h: 16, gap: 34, minGap: 16 } as FlowBlock]), // 收合成單行「委託板 n/3」
      { h: 44, gap: 26, minGap: 16 },          // 工具列（命中區高 44）
    ];
    // 底界留 96px 給營火：光暈半徑 60，加上工具列與它之間該有的呼吸空間
    const ys = flowY(blocks, 0, h - 96);
    let bi = 0;
```

接著把各個元素的 y 改為依序從 `ys` 取用。標題那一行

```ts
    this.add.text(cx, h * 0.16, "RIDGE HUNTER'S TRAIL", {
```

改成

```ts
    this.add.text(cx, ys[bi++], "RIDGE HUNTER'S TRAIL", {
```

刪除 `let by = h * 0.42;` 這一行（連同它上方 `const bw = ...` **保留**）。三顆主按鈕的呼叫改為：

```ts
    this.button(cx, ys[bi++], bw, 54, stripBrackets(i18n.t('camp.continue', { n: runRound })), true, () => {
```
```ts
    this.button(cx, ys[bi++], bw, 50, dailyLabel, false, () => {
```
```ts
    this.button(cx, ys[bi++], bw, 50,
      `${stripBrackets(i18n.t('btn.guide'))} ${found}/${CREATURES.length}`, false,
      () => fadeToScene(this, 'Codex'));
```

並刪掉這三顆按鈕之間原本的 `by += 68;`、`by += 64;`、`by += 72;`。

委託板那一段，把

```ts
    if (h < 692) {
```

改成

```ts
    if (!showRows) {
```

收合分支中的 `this.add.text(cx, by, ...)` 改為 `this.add.text(cx, ys[bi++], ...)`，並刪除其後的 `by += 28;`。

展開分支中，小標的 `this.add.text(cx, by, ...)` 改為 `this.add.text(cx, ys[bi++], ...)`，刪除其後的 `by += 20;`；三列委託改為：

```ts
      const rowH = 44;
      comms.forEach((c, i) => {
        // drawCommissionRow 的 y 是卡片「上緣」，flowY 回傳的是中心，故減去半高
        this.drawCommissionRow(cx, ys[bi++] - rowH / 2, bw, rowH, c, commStatus[i], i18n);
      });
```

刪除 `const rowGap = 6;`、迴圈內的 `by += rowH + rowGap;` 與其後的 `by += 4;`。

工具列那一段，把

```ts
    const xSound = cx - 101;
```

之前插入：

```ts
    const by = ys[bi++];
```

（工具列內部四個元素都已經用 `by` 定位，因此只要把 `by` 換成 flowY 算出的值即可，不必再動。）

- [ ] **Step 2: 讓營火位置由工具列推導**

營火目前畫在 `drawRidges` 裡的 `h * 0.9`，而 `drawRidges` 在版面排定之前就被呼叫，所以它無從得知工具列會落在哪裡。把營火拆成獨立方法，於工具列之後呼叫。

把 `drawRidges` 方法簽章與內容中「營火微光」到方法結尾的那一段搬出來。具體做法：在 `drawRidges` 中，刪除從註解 `// 營火微光（靜態，不做循環動畫）` 起、到 `guardLowFps(this, emitter);` 與其後 `}` 為止的整段（即 `glow` 的三行 fill、以及 `if (motionOK()) { ... }` 整塊），只保留三層山稜。

然後在 `drawRidges` 之後新增：

```ts
  // 營火：位置由版面決定而非固定在 0.9h——工具列在內容變長時會下移，
  // 舊版的百分比定位因此會讓工具列坐進營火光暈裡（h=840 時工具列 730.8、光暈 696–816）。
  private drawCampfire(w: number, h: number, minY: number) {
    const pal = this.pal;
    // 光暈半徑 60，因此中心至少要在 minY + 60 才不會碰到上方元素；
    // 同時不低於畫面底部 30px，避免整團被裁掉
    const fy = Math.min(Math.max(h * 0.9, minY + 60), h - 30);
    const glow = this.add.graphics();
    glow.fillStyle(pal.gold, 0.12).fillCircle(w / 2, fy, 60);
    glow.fillStyle(pal.gold, 0.25).fillCircle(w / 2, fy, 22);
    glow.fillStyle(0xe8b06a, 0.9).fillTriangle(w / 2 - 7, fy + 8, w / 2 + 7, fy + 8, w / 2, fy - 12);

    // 營火火星：低密度上飄粒子，減少動態偏好時完全不生成
    if (motionOK()) {
      ensureDotTexture(this, 'dot-ember', 0xe8b06a, 3);
      const emitter = this.add.particles(w / 2, fy - 6, 'dot-ember', {
        frequency: 400,
        lifespan: 1400,
        speedY: { min: -40, max: -15 },
        speedX: { min: -8, max: 8 },
        alpha: { start: 0.8, end: 0 },
        maxAliveParticles: PARTICLE_CAPS.ember,
      });
      guardLowFps(this, emitter);
    }
  }
```

在 `create()` 中，工具列全部畫完之後、`this.audio.ambient(true);` 之前插入：

```ts
    // 營火最後畫：它的位置取決於工具列落在哪裡（見 drawCampfire）。
    // 它是背景美術，畫在最上層不影響觀感——三層山稜仍由 drawRidges 在最開頭畫好。
    this.drawCampfire(w, h, by + 22);
```

- [ ] **Step 3: 型別檢查與建置**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build` → exit 0

若 `tsc` 回報 `by` 或 `rowGap` 等變數已無使用，依錯誤訊息移除。**先跑型別檢查再決定，不要憑猜測刪。**

- [ ] **Step 4: 手算驗證並寫進報告**

依 `flowY` 的規則，算出 h = 900 / 840 / 768 / 700 / 640 / 600 六個高度下，每個區塊的中心 y 與上下緣，並回報：

- 委託第三列的下緣與工具列命中區（高 44）上緣之間的間距
- 工具列命中區下緣與營火光暈上緣（`fy - 60`）之間的間距
- 標題下緣與第一顆按鈕上緣之間的間距（確認高視窗下不再是 190px 以上的死區）
- 整疊是否還在畫面內

明確指出有沒有任何高度會重疊。

- [ ] **Step 5: 全套測試**

Run: `npx vitest run` → 407 passing

- [ ] **Step 6: Commit**

```bash
git add src/scenes/CampScene.ts
git commit -m "fix: reflow the camp screen so it adapts to window height

The title was pinned at 16% and the button stack started at 42%, so a quarter
of the screen was always empty between them, while the lower half accumulated
positions and ran into the campfire glow — at 840px the toolbar sat 12px into
the third commission row and inside the glow. Everything now flows through one
rule, and the campfire is placed from the toolbar rather than from a fixed
fraction of the height.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: ResultScene 改用 flowY

**Files:**
- Modify: `src/scenes/ResultScene.ts`

**Interfaces:**
- Consumes: `flowY`、`FlowBlock`（Task 1）
- Produces: 無新介面

> **要修的核心缺陷：**「研究度 n / m」文字在 y=526，主鈕上緣也在 526——玩家實測截圖中該行有一半被金色按鈕蓋住。
> 成因是這個畫面自 y=336 起全是固定座標，只有按鈕列有 `Math.min(..., h - 96)` 這類夾限；
> 內容一長就從下方溢出撞上按鈕，而高視窗時上方又空著約 150px。

- [ ] **Step 1: 讀懂現況再動手**

`create()` 的垂直結構目前是：肖像 212（僅補獲）、標題 336、圖鑑點列 372、分隔線 402、內文 438、道具卡自 470/486 起、委託完成行、押注得分行、筆記掉落 486+offset、然後三種分流的按鈕列各自夾限。

改寫時**只動垂直座標的來源**，不要改任何繪製方法的內容（`drawCreaturePortrait`、`drawCodexDots`、`renderToolCard`、`renderCommissionLine`、`showNotesDrop`、`stampQuality`、`button`、`copyShare` 全部保持原樣）。

- [ ] **Step 2: 以 flowY 重排**

加入 import：

```ts
import { flowY, type FlowBlock } from '../core/layout';
```

在 `create()` 中，把「標題」之前既有的 `toolOffset` / `commStep` / `scoreStep` / `totalOffset` 計算保留（它們仍用於決定要顯示哪些區塊），但把之後所有寫死的 y 改為由一份區塊清單推導。在 `let title: string;` 宣告之前插入：

```ts
    // 版面改由 flowY 排定（見 src/core/layout.ts）。舊版自 y=336 起全是固定座標，
    // 只有按鈕列有 h-96 這類夾限，於是內容一長就從下方溢出撞進按鈕——實測截圖裡
    // 「研究度 n / m」正好被主鈕蓋掉一半（兩者都落在 y=526）。現在整疊同一套規則。
    const blocks: FlowBlock[] = [];
    const slot: Record<string, number> = {};
    const add = (name: string, b: FlowBlock) => { slot[name] = blocks.length; blocks.push(b); };

    if (caught) add('portrait', { h: 150, gap: 24, maxGap: 60 });
    add('title', { h: 38, gap: caught ? 20 : 56, maxGap: 96 });
    add('dots', { h: 14, gap: 18, minGap: 10 });
    add('divider', { h: 6, gap: 18, minGap: 10 });
    add('body', { h: bodyH, gap: 22, minGap: 12 });
    showTools.forEach((_, i) => add(`tool${i}`, { h: cardStep - 8, gap: 14, minGap: 8 }));
    lastComms.forEach((_, i) => add(`comm${i}`, { h: commStep - 6, gap: 10, minGap: 6 }));
    if (showLoss) add('loss', { h: 30, gap: 14, minGap: 8 });
    if (showScoreGain) add('gain', { h: 40, gap: 16, minGap: 10 });
    if (!caught) add('notes', { h: 58, gap: 18, minGap: 10 });
    if (s.mode === 'daily') add('streak', { h: 16, gap: 18, minGap: 10 });
    add('primary', { h: 52, gap: 26, minGap: 16 });
    add('secondary', { h: 48, gap: 14, minGap: 12 });
    if (!caught && s.mode === 'run') add('demo', { h: 34, gap: 16, minGap: 10 });

    const ys = flowY(blocks, 24, h - 20);
    const at = (name: string): number => ys[slot[name]];
```

其中 `bodyH` 需在此之前算出——內文是變高的區塊（1–3 行），加在既有 `compactCards` 附近：

```ts
    // 內文行高：16px 字、lineSpacing 6，wordWrap 460。中文多為 1 行、英文常 2 行，
    // 失敗文案最長 3 行。以量測值決定區塊高度，避免用猜的。
    const bodyProbe = this.add.text(0, -999, body, {
      fontFamily: FONTS.body, fontSize: '16px',
      wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 6,
    });
    const bodyH = bodyProbe.height;
    bodyProbe.destroy();
```

**注意順序**：`body` 字串在既有程式碼中是於 `if (caught) / else if (outcome === 'escaped') / else` 分支中決定的，因此上面這段量測與 `blocks` 清單都必須放在那組分支**之後**、真正 `this.add.text(cx, 336, title, ...)` 之前。若目前順序不符，把該分支整塊往上移到 `blocks` 清單之前即可，不要改分支內容。

接著逐一把固定座標換掉：

```ts
      this.drawCreaturePortrait(cx, at('portrait'), creature.id, s.level.iris ? pal.iris : creature.color, s.level.iris);
      if (quality) this.stampQuality(cx + 128, at('portrait') + 56, quality, i18n);
```
```ts
    this.add.text(cx, at('title'), title, { ... })
```
```ts
    this.drawCodexDots(cx, at('dots'), codex);
```

分隔線的 `402` 改為 `at('divider')`：把

```ts
    divider.moveTo(cx - 105, 402);
    for (let i = 1; i <= 6; i++) {
      divider.lineTo(cx - 105 + i * 35, 402 + (i % 2 === 0 ? 1.5 : -1.5));
    }
```

改成

```ts
    const dy = at('divider');
    divider.moveTo(cx - 105, dy);
    for (let i = 1; i <= 6; i++) {
      divider.lineTo(cx - 105 + i * 35, dy + (i % 2 === 0 ? 1.5 : -1.5));
    }
```

內文：

```ts
    this.add.text(cx, at('body'), body, { ... })
```

道具卡與委託完成行：

```ts
    showTools.forEach((id, i) => {
      this.renderToolCard(cx, at(`tool${i}`), id, i18n, compactCards);
    });
    lastComms.forEach((idx, i) => {
      this.renderCommissionLine(cx, at(`comm${i}`), commsToday[idx], i18n);
    });
```

押注得分兩行、押注軟著陸、筆記掉落：

```ts
    if (showScoreGain) {
      const lastGain = (this.registry.get('lastGain') as number | undefined) ?? 0;
      const gy = at('gain');
      this.add.text(cx, gy - 10, i18n.t('score.gain', { n: lastGain }), { ... }).setOrigin(0.5);
      this.add.text(cx, gy + 10, i18n.t('score.pot', { n: score.state().pot }), { ... }).setOrigin(0.5);
    }
    if (showLoss) {
      this.add.text(cx, at('loss'), i18n.t('score.lost'), { ... }).setOrigin(0.5);
    }
    if (!caught) this.showNotesDrop(cx, at('notes') - 20, creature.id, notes, codex, i18n);
```

（`showNotesDrop` 的 `y` 是它第一行文字的中心，其下 18–26px 是進度條、+40 是研究度文字，
整塊高約 58px，因此傳入 `at('notes') - 20` 讓整塊以 flowY 給的中心對齊。**不要改
`showNotesDrop` 內部的相對位移**——那組數字本身沒有問題，出事的是整塊被放得太低。）

最後把三種分流的按鈕列座標全部換掉：所有 `Math.min(552 + toolOffset, h - 96)` 之類的
夾限運算式刪除，改用 `at('primary')`、`at('secondary')`；每日分支的連勝列用 `at('streak')`；
主線失敗分支的示範連結用 `at('demo')`，並把「空間不夠就不畫」的判斷改為：

```ts
      // flowY 會在空間不足時誠實地把區塊排到 bottom 之外，此處據此決定畫不畫
      const demoLinkY = at('demo');
      if (demoLinkY + 18 <= h) {
```

- [ ] **Step 3: 型別檢查與建置**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build` → exit 0

依錯誤訊息移除因改寫而未使用的變數（例如 `totalOffset` 若已無使用）。**先跑型別檢查再決定。**

- [ ] **Step 4: 手算驗證並寫進報告**

針對「主線失敗、無道具卡、無委託」這個最常見的分支，算出 h = 900 / 844 / 780 / 700 / 640 / 600 六個高度下每個區塊的中心 y 與上下緣，並回報：

- 筆記掉落區塊（研究度文字在其下緣）與主鈕上緣之間的間距——**這是本任務要修的那個重疊，必須為正**
- 主鈕與次鈕之間的間距
- 示範連結是否畫出、與次鈕的間距
- 整疊是否還在畫面內

另外針對「補獲、有一張道具卡」再算 h = 780 一組，確認肖像與標題不重疊。

- [ ] **Step 5: 全套測試**

Run: `npx vitest run` → 407 passing

- [ ] **Step 6: Commit**

```bash
git add src/scenes/ResultScene.ts
git commit -m "fix: reflow the result screen so it adapts to window height

Everything from the title down was pinned to fixed coordinates while only the
button rows were clamped, so a long stack ran out of the bottom and into them:
the research-progress line and the primary button both landed on y 526 and the
player saw one drawn over the other. Tall windows meanwhile wasted 150px above
the title. One rule now places the whole stack.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 人工冒煙

> **本任務無法由 agent 完成。** 場景層在本專案無法單元測試。

- [ ] **Step 1: 啟動**

Run: `npm run dev`，並用手機或瀏覽器的裝置模擬器開啟。

- [ ] **Step 2: 清單**

行動裝置輸入：

- [ ] 手機上點擊地圖、按鈕、QTE 都沒有可感知的延遲
- [ ] 頁面不會被下拉重新整理或橡皮筋捲動帶走
- [ ] 點擊時沒有灰色閃框
- [ ] 網址列收合／展開時版面重排正常，沒有元素跑出畫面

QTE：

- [ ] 指針轉動流暢，點擊當下的判定與看到的位置一致
- [ ] 弧區換位置時正常重畫，命中點列與進度文字正確更新
- [ ] 連續玩兩局，第二局的弧區與點列都正常（快取有被重設）
- [ ] 少了 Glow 之後弧區仍看得出是「發光的目標區」

營地：

- [ ] 標題與第一顆按鈕之間不再有大片空白
- [ ] 委託三列與工具列不重疊
- [ ] 工具列不在營火光暈裡，營火也沒有被畫面底部裁掉
- [ ] 視窗高度從 900 拉到 600 的過程中，沒有任何一刻出現重疊

結算：

- [ ] 主線失敗時「研究度 n / m」完整可見，沒有被按鈕蓋住
- [ ] 補獲、每日挑戰、主線失敗三種分流都排得下
- [ ] 有道具解鎖卡與委託完成行時仍不重疊
- [ ] 高視窗時標題上方不再空一大片

- [ ] **Step 3: 記錄結果**

把結果與任何延後項寫入 `.superpowers/sdd/progress.md`。發現缺陷就逐一開修正任務，不要直接合併。

---

## 自我檢查紀錄

**覆蓋**：QTE 延遲 → Task 2；手機觸控 → Task 2；營地三個版面缺陷 → Task 3；結算重疊與上方留白 → Task 4；版面算術的可測試性 → Task 1；實測 → Task 5。

**型別一致性**：`flowY(blocks, top, bottom): number[]` 與 `FlowBlock`（`h` 必填，`gap`/`minGap`/`maxGap` 選用）在 Task 1 定義，Task 3 與 Task 4 以相同簽章使用。

**未決事項**：無。
