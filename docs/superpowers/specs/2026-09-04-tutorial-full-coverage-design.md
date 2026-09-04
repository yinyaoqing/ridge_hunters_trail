# Ridge Hunter's Trail — 教學全機制覆蓋 v1.0

> 上游文件：`2026-09-03-deduction-demo-design.md`（推理示範）與
> `2026-09-03-phase6a-living-quarry-design.md`（活的獵物）。
> 前者建立了「示範才能示範」的第三個教學面，後者加進了整個遊戲最難、
> 卻完全沒有教學的核心機制。本文件把兩者的缺口一次補齊。

---

## 1. 這一階為什麼要做

遊戲累積到 Phase 6a，機制有 25 項以上，教學卻只覆蓋其中約一半，而且
**最新、最核心的那一項覆蓋率是零**：獵物會沿覓食路線移動、線索分三齡、
交集只在同齡內成立——這是 Phase 6a 重寫地基換來的玩法，玩家從三個教學面
都學不到。

更糟的是它不是「少一行說明」而已。現有推理示範在 `demo.ts` 的註解裡明文寫死
「示範關卡是單一固定目標（無路線），全部線索都錨定在同一個『現在』的位置」——
結構上就教不了移動。要教，只能開第二份腳本。

---

## 2. 現況盤點

### 2.1 三個教學面

**A. 首局內嵌引導**（`MapScene.initTutorialFlag` → `finishTutorial`）

只在 `mode='run'` ＋ `round===1` ＋ `phase==='explore'` ＋ `rht.tut.v1` 未設時啟動，共 4 句：

| 步 | 觸發 | 文案鍵 |
|---|---|---|
| 0 | 進場，`pulseHighlight` 高亮起始蹤跡 | `tut.move` |
| 1 | 讀到第一條線索 | `tut.read` |
| 2 | 讀到兩條**同齡**真線索，閃交集格 | `tut.cross` |
| 3 | 走到目標 2 格內 | `tut.qte` |

進 QTE 即 `finishTutorial()`，同時寫入 `rht.tut.v1` 與 `rht.help.v1`。

**B. 玩法說明 `HelpScene`**

首次啟動自動彈出（`rht.help.v1`），之後由 HUD `?` chip 開啟。13 列可捲動圖例：
足跡／擾動／氣味／幌子／體力地形／三態標記／QTE／圖層／揭曉／天氣／視野／眺望／路線預覽。
含 EN/中 切換與「示範」入口。

**C. 推理示範 `DemoScene`**

固定 9×9、4 條線索（1 幌子）、14 步 / 4 章，3 個必須動手的關卡：
`exclude`、`mute`、`wager`。可從 Help 與 Result 進入。

### 2.2 缺口

**Tier 1 — 核心機制，三面全無或僅半句**

1. **獵物會移動**（Phase 6a）＋ 5 種路線習性 `rule.lowland/highland/cover/straight/doubling`
   ＋「線索錨在過去節點、要外推攔截」。Help 無此列；Demo 結構上教不了；
   引導只有 `tut.read` 一句擦邊。
2. **線索齡別**（`age.fresh/night/older/all`）與 HUD 新鮮度 chip。`help.layer`
   只有半句「chip 選哪一齡」；Demo 全同齡；`tut.cross` 用了「同齡」這個詞卻沒解釋它是什麼。
3. **分數與 Bank/Push** — `pot`／`banked`／倍率 1→2.5、失敗清空未存分。三面完全沒提。
4. **iris 異彩變種**（2 倍分）— 只有 `iris.prefix` 名字前綴。

**Tier 2 — 元進程無教學**

5. 圖鑑／研究點／`codex.rumored`
6. 道具：風向石（5 筆記錄解鎖）、輝鈴（任一金質解鎖，每局一次消掉假線索）— 只有解鎖 toast
7. 每日委託 3 條與獎勵
8. 每日挑戰／連勝／歇腳符（7 天贈 1、上限 3）／分享卡
9. 局數難度遞增（15/20/25、幌子第 4 局起）

**Tier 3 — 局內細節薄弱**

10. **行走時的隨機事件**（驚鳥指路／額外補給／舊足跡，4%、每局上限 2）— 只有一個
    `!` 或 `+` 的浮字，玩家不知道剛才發生了什麼
11. 補給（`help.stamina` 半句，引導與示範都沒出現）
12. 押注精度→品質門檻（0 格金／≤2 銀／其餘銅）
13. 「靜音」是標記**已判讀的線索格**、與標記地圖格操作相同語意不同
14. `reveal.infoAt` 最佳資訊點指標
15. 天氣四種各自效果只有一句總結
16. 生物個性 quirks 會改本局線索參數

---

## 3. 決策紀錄

| 分歧 | 裁定 | 落選項與理由 |
|---|---|---|
| 教學範圍 | **局內玩法 + 元進程全包** | 只補局內會讓 Bank/Push 這種「按錯一次就損失整趟分數」的機制繼續沒人教 |
| 承載方式 | **三層分工**：Help 字典／Demo 推理課／JIT 首見提示 | 「全塞 Demo」＝40+ 步沒人走得完，且元進程在假關卡裡示範不真實；「全塞 Help」＝會走的獵物用一行字教不會，違反 `HelpScene` 自己註解裡的「說明頁只能告訴，示範才能示範」 |
| JIT 觸發模型 | **首見觸發** | 道具解鎖看記錄數與金質、幌子看局數、隨機事件是機率——每個玩家碰到的順序都不同，用局數硬排會教到還沒發生的東西 |
| 舊存檔玩家 | **首見旗標從零算，`rht.tut.v1`／`rht.help.v1` 不動** | 旗標升版 v1→v2 會把熟練玩家拉回重跑第 1 局引導；新增「重置教學」按鈕則是為極少數人多一條清旗標路徑 |
| 新 Demo 課要不要含幌子 | **不含** | 幌子由第一課教完；第二課要專心教齡別，兩件難事同時上等於兩件都沒教會 |

---

## 4. 架構

```
src/core/coach.ts      首見旗標的唯一來源（新）          ← 純函式 + storage，可單元測試
src/core/demo.ts       泛化為 DemoScript，兩份腳本       ← 現有腳本零行為變動搬入
src/scenes/DemoScene   init({ scriptId, from }) 選腳本
src/scenes/HelpScene   rows: flat → sections 分組
src/scenes/MapScene    JIT 掛點：隨機事件、補給、齡別、道具
src/scenes/ResultScene JIT 掛點：Bank/Push、iris
src/scenes/RevealScene JIT 掛點：路線揭曉、品質門檻、infoAt
src/scenes/CampScene   JIT 掛點：委託、每日挑戰
src/scenes/CodexScene  JIT 掛點：研究點
```

### 4.1 `src/core/coach.ts`

```ts
export type CoachId =
  | 'event.startle' | 'event.supply' | 'event.oldtrail'
  | 'supply' | 'bankpush' | 'iris' | 'tool.windstone' | 'tool.glowbell'
  | 'age.second' | 'reveal.route' | 'reveal.infoAt' | 'quality'
  | 'codex' | 'commission' | 'daily';

export interface CoachStore {
  seen(id: CoachId): boolean;
  markSeen(id: CoachId): void;   // 冪等
  reset(): void;                 // 測試與未來的「重看教學」用
}

export function createCoach(storage?: Pick<Storage, 'getItem' | 'setItem'>): CoachStore;

// 首見提示的呼叫契約，與 createCoach 同檔匯出：未見過就跑 show() 並記下，
// 見過則什麼都不做。回傳是否顯示了。各場景共用同一個形狀，不各寫一套。
export function coachOnce(coach: CoachStore, id: CoachId, show: () => void): boolean;
```

單一 `rht.seen.v1` JSON key，比照 `tools.ts` 的 load/save 慣例：讀寫失敗一律
靜默退回記憶體備援，不讓 storage 例外冒到場景層。建立於 `BootScene`，放進
registry 供各場景取用（同 `tools`／`storage`／`i18n` 的既有慣例）。

掛點的寫法一律是一行：

```ts
coachOnce(coach, 'event.startle', () => this.showTut('coach.event.startle'));
```

### 4.2 `demo.ts` 泛化

現有 `DemoScene` 全檔直接 import `DEMO_SIZE`／`DEMO_CLUES`／`DEMO_STEPS`／
`DEMO_TARGET`／`DEMO_PAIR` 等模組層常數，因此新增第二課必須先把腳本收成一個物件：

```ts
export interface DemoScript {
  id: 'deduction' | 'quarry';
  size: number;
  start: Vec2;
  target: Vec2;              // 第二課＝外推攔截點
  clues: readonly Clue[];
  steps: readonly DemoStep[];
  fogRows: number;
  titleKey: MsgKey;
  checkCell(action: DemoCellAction, cell: Vec2): MsgKey | null;
  checkClue(clueIndex: number): MsgKey | null;
}
```

現有 14 步原封搬進 `DEDUCTION_SCRIPT`，**零行為變動**——既有 `tests/demo.test.ts`
只需把常數引用改成 `DEDUCTION_SCRIPT.*`，任何一條斷言若需要改語意，代表泛化改壞了行為。

`DemoStep` 新增兩個欄位供第二課使用：

- `heatAge?: 0 | 1 | 2 | null` — 本步的新鮮度 chip 選擇（`null`＝全部）
- `action` 的聯集擴充：`'exclude' | 'mute' | 'wager' | 'pick-age'`

第一課的所有步驟 `heatAge` 皆為 `null`，渲染結果與現況逐格相同。

### 4.3 `HelpScene` 分組

`rows` 從 flat array 改成：

```ts
const sections: { titleKey: MsgKey; rows: HelpRow[] }[] = [
  { titleKey: 'help.sec.track',   rows: [...] },  // 追蹤線索
  { titleKey: 'help.sec.deduce',  rows: [...] },  // 推理工具
  { titleKey: 'help.sec.ground',  rows: [...] },  // 地形與體力
  { titleKey: 'help.sec.longRun', rows: [...] },  // 收分與長線
];
```

標題列高 30px、圖例列維持 44px。捲動邏輯不動——`minY` 本來就由列數推導，
換成「標題列 × 30 + 圖例列 × 44」的總高度即可；面板高度 `ph` 不需要碰
（`HelpScene` 註解已載明捲動範圍依 `rows.length` 自動重算的性質）。預設全展開，
點標題摺疊該組（摺疊狀態不持久化，關掉面板即復位）。

### 4.4 JIT 提示的顯示

不新建 UI 元件：

- **地圖內**：沿用 `MapScene.showTut()` 的底部橫條（已存在、`depth 80/81`、全程不攔輸入）。
  引導期間（`tutStep >= 0`）不觸發 JIT，避免兩套文案互相覆蓋同一個 Text 物件。
- **Result／Reveal／Camp／Codex**：一行 `paperDim` 說明文字，併入各場景既有的
  `flowY` 疊層流（`ResultScene` 已有此機制處理 `score.gain`／`score.lost` 等可選區塊）。

---

## 5. 機制指派表

| # | 機制 | Help | Demo | JIT 首見 |
|---|---|---|---|---|
| 1 | 獵物會移動 + 5 種習性 | `help.quarry`、`help.habit` | **新課三章** | `reveal.route`：首次揭曉看到路線 |
| 2 | 線索齡別 + 新鮮度 chip | `help.age` | 新課第 2 章 | `age.second`：首次讀到第二種齡別，指向 chip |
| 3 | Bank / Push 分數 | `help.score` | — | `bankpush`：Result 首次出現兩顆按鈕 |
| 4 | iris 異彩 | `help.iris` | — | `iris`：首次**記錄到**時（不在進場爆雷） |
| 5 | **行走隨機事件** ×3 | `help.events` | — | `event.startle`／`event.supply`／`event.oldtrail` 三個獨立旗標 |
| 6 | 補給 | 從 `help.stamina` 拆出 `help.supply` | 新課帶一顆 | `supply`：首次撿到 |
| 7 | 品質門檻 | 修 `help.marks` 寫明 0 格金／≤2 銀 | — | `quality`：Reveal 首次 |
| 8 | 靜音語意 | 從 `help.layer` 拆出 `help.mute` | 第一課 s9 已教 | — |
| 9 | 天氣四種 | `help.weather` 展開成 4 子項 | — | — |
| 10 | `reveal.infoAt` | `help.infoAt` | — | `reveal.infoAt`：Reveal 首次 |
| 11 | 生物個性 quirks | `help.quirk` | — | — |
| 12 | 局數難度遞增 | `help.progress` | — | — |
| 13 | 道具 ×2 | `help.tool.windstone`／`help.tool.glowbell` | — | `tool.*`：首次持有進獵局，指 HUD bell chip |
| 14 | 圖鑑／研究點／rumored | `help.codex` | — | `codex`：首次開 Codex |
| 15 | 每日委託 | `help.commission` | — | `commission`：Camp 首次有委託 |
| 16 | 每日挑戰／連勝／歇腳符／分享 | `help.daily` | — | `daily`：Camp 首次 |

Help 由 13 列 → **約 26 列分四組**。天氣的 4 個子項沿用既有的 `drawWeatherGlyph`，
不需要新圖示。

### 5.1 隨機事件的三則文案

三種事件目前只在 `MapScene` 畫一個 `!`（驚鳥／舊足跡）或 `+`（額外補給）浮字，
玩家無從得知剛才發生了什麼。三則首見文案各自說清楚「發生了什麼」與「怎麼用」：

- `coach.event.startle` — 一群鳥被驚起。牠們飛離的方向就是牠所在的大致方位。
- `coach.event.supply` — 你在腳邊發現了額外的補給，體力已經補回。
- `coach.event.oldtrail` — 你腳下有一道舊足跡，方向很粗略——當作參考，別當作證據。

三則各有獨立旗標：三種事件出現機率相同（`EVENT_CHANCE = 0.04`、每局上限 2），
玩家可能玩很久才碰到其中一種，共用一個旗標會讓後面兩種永遠教不到。

---

## 6. 新 Demo 課程「會走的獵物」

### 6.1 為什麼要開第二份腳本

第一課的四條線索全部 `age: 2`、錨定同一個固定目標，這是它教「交集＝答案」時
唯一正確的設定。要教「跨齡不能交集、同齡才能交集、三齡連起來是方向」，就必須
有三個不同的錨點——這在第一課的資料結構上不成立。

### 6.2 課程設計

9×9，獵物走 W0 → W1 → W2 三節點，**6 條線索分三齡**（每齡 2 條），**無幌子**。

| 章 | 教什麼 | 互動點 |
|---|---|---|
| 1 | 六條線索攤開，交集是空的——因為牠不在同一個地方 | — |
| 2 | 線索有**齡別**。切新鮮度 chip 到「最新」，只留兩條，交集出「牠剛才在哪」 | `pick-age` 切 chip |
| 3 | 三齡的交集點連起來就是牠走的方向。牠還在走——押在**外推點** | `wager` 押外推點 |

收束句：「線索告訴你牠**去過**哪；齡別告訴你**什麼時候**；連起來才知道牠**要去**哪。」

### 6.3 資料地基（以測試釘死）

比照第一課那三條「動任何一個數字之前先跑測試」的性質：

1. 六條線索的**跨齡**交集為空 —— 第 1 章的旁白字面成立
2. 最新齡（age 2）兩條線索的交集**恰為 W2 一格**
3. 三齡的交集點共線且等距，外推點唯一、落在圖內、且不等於任何一個交集點
4. 每一步旁白的佔位符與該步 `vars` 的鍵完全對稱（沿用第一課的對稱測試）

旁白中的所有數字由 `candidates()`／`intersect()` 於模組載入時算出，一個都不手寫。

### 6.4 入口

`HelpScene` 的示範按鈕改為兩顆（推理課／獵物課），`ResultScene` 的 `demo.fromResult`
入口維持指向第一課。第二課在 Help 中永遠可進入，不設解鎖條件。

---

## 7. 分期

| 期 | 內容 | 為什麼是這個順序 |
|---|---|---|
| **P1** | `coach.ts` ＋ 隨機事件三則 ＋ 補給 ＋ Bank/Push ＋ iris ＋ 品質門檻 ＋ infoAt 的 JIT | 基礎設施先落地；這一期結束玩家走路時就真的會被教到，且不動任何既有結構 |
| **P2** | `HelpScene` 分組重構 ＋ 表中全部 Help 欄新列 | 查閱面補完。純加列與版面重排，風險與 P1 隔離 |
| **P3** | `DemoScript` 泛化 ＋「會走的獵物」新課 | 唯一需要動既有腳本結構的一期，單獨成期以便回歸驗證 |
| **P4** | 元進程 JIT（道具／圖鑑／委託／每日） | 跨 Camp／Codex 場景收尾，依賴 P1 的 `coach` |

---

## 8. 測試

**新增**

- `tests/coach.test.ts` — 旗標讀寫、`markSeen` 冪等、storage 讀寫失敗退回記憶體、
  損毀 JSON 退回預設、`reset()` 清空
- `tests/demo-quarry.test.ts` — §6.3 的四條性質

**修改**

- `tests/demo.test.ts` — 常數引用改為 `DEDUCTION_SCRIPT.*`。**任何一條斷言若需要
  改語意，即為泛化改壞了行為的訊號**

**自動涵蓋**

- `tests/i18n.test.ts` 已斷言 en／zh-TW 鍵集合完全相同且無空字串，約 40 對新 key 自動把關

**回歸底線**

既有 36 支測試檔不應有任何一支需要改動語意。

---

## 9. 明確不做

- 不做旗標升版重播（見 §3 決策紀錄）
- 不做教學進度 UI（「已學會 12/16 項」之類的收集面板）——這會把教學變成另一個要清的清單
- 不做可跳過／可關閉的教學開關：JIT 每則只出現一次，本身已是最低侵入
- 不重寫首局內嵌引導的 4 步。它教的是「移動→判讀→交集→逼近」這條主幹，
  仍然正確；新機制一律走 JIT，不塞進第 1 局
