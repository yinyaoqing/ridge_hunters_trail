# Ridge Hunter's Trail — 遊戲設計規格書 v1.1

> 本文件為初步開發規劃，供接續開發的 AI / 工程師直接參考執行。所有數值為建議起始值，實作時可依playtesting結果微調。

---

## 1. 專案概述

| 項目 | 內容 |
|---|---|
| 遊戲名稱（暫譯） | Ridge Hunter's Trail |
| 品類 | 輕量生存探索 + 推理解謎（單人） |
| 目標平台 | itch.io（優先驗證）→ CrazyGames（Basic Launch → Full Launch）→ Poki（後續申請） |
| 目標市場 | 全球（不鎖定特定地區），美術與世界觀為完全原創架空設定 |
| 單局時長 | 5–8 分鐘 |
| 內容分級目標 | PEGI 3–7（闔家向，無殺戮畫面） |
| 技術棧 | Phaser.js + TypeScript，純前端，無需伺服器 |
| 核心原則 | 零成本開發、AI輔助素材生成、世界觀完全虛構（不指涉任何真實文化/地域/族群） |

---

## 2. 世界觀設定（重要：內容邊界）

- 遊戲世界為**完全架空的奇幻山林**，所有生物、植物、地形、工具、符號均為原創虛構設計。
- **嚴禁使用**任何真實存在的文化圖騰、民族紋樣、宗教符號、地名、族群名稱或可辨識的現實文化元素。
- 美術風格可保留「東方氛圍感」（水墨暈染、特定色溫），但**符號系統（圖案/生物/工具造型）必須為原創演算法生成或原創繪製**，不得取材自任何真實紋樣資料庫。
- 玩法核心強調「觀察、推理、記錄」而非戰鬥/獵殺；結局呈現為「圖鑑收藏完成」，全程不出現死亡或血腥畫面。
- 開發過程中若需要靈感參考，僅作內部私人創作養分，**對外行銷文案、開發者訪談一律不提及任何真實文化的靈感來源**，世界觀對外一律定調為「原創架空世界」。

---

## 3. 核心遊戲迴圈（Game Loop）

```
進入地圖
  → 觀察環境線索（足跡 / 環境擾動 / 氣味殘留）
  → 標記可能路徑（玩家自行判斷，UI 不強制提示正解）
  → 消耗體力值移動至選定地點
  → 獲得新線索 或 撲空（線索消失，需重新推理）
  → 逼近目標後觸發「近距離判讀」QTE 小遊戲
  → 成功：記錄圖鑑 → 結算 → 進入下一局（難度遞增）
  → 失敗：目標生物「逃逸」，本輪線索清空，需重新開始追蹤
```

---

## 4. 系統規格

### 4.1 地圖與座標系統

```
資料結構：
Grid[N][N]，每格屬性：
{
  terrain: TerrainType,   // 地形類型，影響移動速度/視野
  isTarget: boolean,      // 是否為目標生物實際位置
  revealed: boolean       // 是否已被玩家探索過
}

地圖尺寸依難度遞增（見 4.5 難度曲線表）
```

### 4.2 線索系統（核心解謎機制）

**三種線索類型：**

```typescript
type ClueType = 'footprint' | 'disturbance' | 'scent';

interface Clue {
  type: ClueType;
  position: { x: number; y: number };
  data: FootprintData | DisturbanceData | ScentData;
}

// 足跡：方向性線索
interface FootprintData {
  direction: number;      // 0-360度，指向目標的粗略方向
  angleSpread: number;    // 錐形誤差範圍（度數），難度越高越大
}

// 擾動：範圍性線索
interface DisturbanceData {
  radius: number;         // 可能範圍半徑
}

// 氣味：距離性線索（需搭配風向道具解讀方向）
interface ScentData {
  distance: number;       // 與目標的實際距離（格數）
  windBiasNeeded: boolean;
}
```

**生成演算法（反向錨定法）：**

> 核心原則：線索一律從目標位置反推生成，而非獨立隨機放置，確保數學上必定有解，無需事後驗證。

```typescript
function generateLevel(difficulty: number): Level {
  const targetPos = randomPosition(mapSize);
  let clues: Clue[] = [];

  const clueCount = getClueCountByDifficulty(difficulty);
  const typeRatio = getTypeRatioByDifficulty(difficulty);

  for (let i = 0; i < clueCount; i++) {
    const type = pickTypeByRatio(typeRatio);
    const distance = randomDistanceByDifficulty(difficulty);
    const anglePos = randomAngle();
    const cluePos = calculatePositionOnCircle(targetPos, distance, anglePos);
    clues.push(createClue(type, cluePos, targetPos, distance, difficulty));
  }

  // 可解性收斂檢查（交集範圍需落在合理區間，避免太模糊或太簡單）
  let intersection = calculateIntersection(clues);
  while (intersection.size > getMaxIntersectionByDifficulty(difficulty)) {
    clues.push(generateAdditionalClue(targetPos, difficulty));
    intersection = calculateIntersection(clues);
  }

  // 干擾線索（難度2以上）
  if (difficulty >= 2) {
    const decoyPos = randomPositionFarFrom(targetPos, /* minDistance */ 5);
    clues.push(...generateDecoyClues(decoyPos, difficulty));
  }

  return { targetPos, clues, mapSize: getMapSizeByDifficulty(difficulty) };
}
```

**線索類型比例（依難度）：**

| 難度 | footprint | disturbance | scent |
|---|---|---|---|
| 1（新手） | 60% | 30% | 10% |
| 2（中階） | 40% | 35% | 25% |
| 3（進階） | 20% | 30% | 50% |

**干擾線索（Decoy）規則：**
- 難度 2 以上額外生成 1–2 個假線索，計算基準改為隨機「幌子點」（decoyPos）
- decoyPos 與 targetPos 距離需 ≥ 5 格，避免意外洩題
- 視覺呈現與真線索完全相同，玩家須靠交叉比對排除

### 4.3 資源管理

- **體力值**：每次移動消耗固定值，歸零則本局結束
- **補給道具**（原創虛構植物，暫名「霧葉」「露珠果」）：散落地圖，撿取回復體力但消耗回合數，形成「直衝線索」vs「繞路補給」的策略取捨

### 4.4 近距離判讀（QTE 小遊戲）— 待細化

> 本節為下一階段規劃範疇，建議接續設計：
> - 操作形式（節奏點擊 / 方向連續判斷，待定）
> - 成功率曲線與難度遞增邏輯
> - 失敗後的懲罰機制（線索清空 vs 部分保留，待playtesting決定）

### 4.5 難度曲線（局數遞增）

| 局數 | 地圖大小 | 線索數量 | 誤差/範圍 | 干擾線索 | 允許交集格數上限 |
|---|---|---|---|---|---|
| 第1–3局 | 15×15 | 4個 | 大（易讀） | 0個 | 15格 |
| 第4–7局 | 20×20 | 5個 | 中 | 1個 | 8格 |
| 第8局以後 | 25×25 | 6個 | 小（精確） | 2個 | 4格 |

### 4.6 圖鑑收集系統

- MVP 建議設計 8–12 種原創生物
- 每種生物有獨特線索組合模式與地形偏好，鼓勵玩家透過多局遊玩累積判讀經驗
- 後續版本可持續擴充生物種類（有助於 portal 平台的更新頻率評分）

---

## 5. 美術與音效規格（控制成本）

| 項目 | 規格 | 備註 |
|---|---|---|
| 地形 | 2D 俯視、低多邊形/平面化 | 色調循環：霧綠 / 赭石 / 暮色紫三套配色 |
| 生物 | 剪影+局部發光細節（如發光眼睛/紋理） | AI 生成概念圖 → 手動簡化為 sprite；需人工檢查避免與真實動物/文化符號產生視覺聯想 |
| 音效 | 環境音（風聲/樹葉聲）+ 極簡打擊音效標示線索發現 | 免費音效庫或 AI 生成，零成本 |
| UI | 手繪風格圖標（羅盤、腳印、體力條） | 避免任何具體真實紋樣符號 |

---

## 6. 技術規格

- **引擎**：Phaser.js
- **語言**：TypeScript
- **地圖邏輯**：簡單網格座標系統，不需複雜路徑演算法
- **多語系**：支援英文（預設）與繁體中文；依瀏覽器語言自動偵測（`zh*` → 繁中），遊戲內可切換並記憶。所有 UI 字串走字串表（`t()`），生物名稱/描述為雙語欄位；中文以系統字體渲染、不打包字型檔（維持零成本與 Poki 8MB 優化空間）。架構預留後續語言擴充
- **檔案大小限制**（提交平台前需壓縮至符合）：
  - itch.io：無嚴格限制，建議仍控制在合理範圍
  - CrazyGames：Basic Launch 初始下載 ≤50MB，總檔案數 <1,500個
  - Poki：初始下載 ≤8MB（門檻最嚴格，最後階段才需優化到此標準）
- **內容分級**：PEGI 3 或 7

---

## 7. 開發排程（建議 14 天 MVP）

| 階段 | 內容 | 天數 |
|---|---|---|
| Day 1–2 | 核心迴圈原型（純邏輯，方格系統，無美術） | 2天 |
| Day 3–4 | 線索生成演算法（三種線索的隨機分布與交叉驗證邏輯，見第4.2節） | 2天 |
| Day 5–6 | 近距離判讀 QTE 小遊戲 + 圖鑑收集系統 | 2天 |
| Day 7–8 | 美術素材替換（AI生成素材匯入取代佔位圖形） | 2天 |
| Day 9–10 | 音效/UI整合、8–12種生物內容填充 | 2天 |
| Day 11–12 | 效能優化、檔案體積壓縮、跨瀏覽器測試 | 2天 |
| Day 13–14 | 提交 itch.io 驗證 → 修正 → 提交 CrazyGames Basic Launch | 2天 |

**精簡版 MVP（若時程需壓縮）**：先做「4種生物、單一地形、無圖鑑系統」的最小版本上 itch.io 測試核心迴圈是否好玩，驗證後再擴充內容，可將首次驗證時間壓縮至 5–6 天。

---

## 8. 風險與待確認事項（給接續開發者）

1. **QTE 手感為成敗關鍵**：直接影響 CrazyGames Basic Launch 階段的留存數據評估，建議完成後找至少 3–5 位測試者實測手感再提交。
2. **生物與符號設計需人工複查**：AI 生成的概念草圖必須經過人工目視檢查，確保不會與任何真實動物、族群符號、宗教圖騰產生視覺聯想或誤讀。
3. **對外文案口徑一致性**：行銷素材、開發者部落格、社群貼文皆須維持「完全原創架空世界」的定調，不得提及任何真實文化作為靈感來源。
4. **QTE 小遊戲的具體規則尚未定案**（見4.4節），為下一階段待補規劃項目。
5. **平台檔案大小限制**為分階段目標，開發初期不需要立即壓到 Poki 的 8MB 標準，但架構設計時建議預留優化空間（例如素材採用可延遲載入的分包架構）。

---

## 9. 文件版本

- v1.0 — 初版規劃，涵蓋核心迴圈、線索生成演算法、美術/技術規格、14天開發排程
- v1.1 — 新增 §10 商業化路徑（廣告分潤策略、獎勵式廣告掛載點、每日挑戰、中期路徑）
- v1.2 — 新增多語系需求（§6）：繁體中文／英文，瀏覽器偵測＋遊戲內切換
- v1.3 — 新增 §11 部署與上架（itch.io／CrazyGames／Poki 提交流程、前置修改清單、發版自動化）
- 待補：QTE小遊戲細部設計、生物圖鑑內容清單（8–12種生物的具體屬性表）、UI線框稿

---

## 10. 商業化路徑

> 原則：MVP 階段**不寫任何營利程式碼**，但架構需預留掛載點（本節標註處均已在實作計畫的純邏輯層天然存在）。營利功能一律在 itch.io 驗證核心好玩之後、依平台數據分階段投入。

### 10.1 收入主幹：Portal 廣告分潤（依平台路線圖遞進）

| 階段 | 平台 | 收入模式 | 前置條件 |
|---|---|---|---|
| 驗證期 | itch.io | 不求收入；可開 pay-what-you-want 收贊助 | MVP 上線 |
| 第一筆收入 | CrazyGames | 官方 SDK：局間插頁廣告（midroll）+ 獎勵式廣告分潤 | Basic Launch 通過；數據好升 Full Launch 分潤更佳 |
| 多管道 | Poki | 同型分潤，同一份遊戲多一條管道 | 檔案優化至 8MB（見 §6） |

- 每局結算畫面（Result）為天然插頁廣告點，不破壞體驗節奏。
- 務實預期：portal 品類為長尾+爆款驅動，關鍵變現指標為**留存率與單次遊玩時長**（呼應 §8.1 QTE 手感）。

### 10.2 獎勵式廣告掛載點（eCPM 最高，優先實作）

三個掛載點皆對應既有遊戲狀態，實作各為一個純函式（如 `reviveWithAd()`），可單元測試：

| 掛載點 | 對應狀態 | 玩家獲得 | 設計理由 |
|---|---|---|---|
| QTE 失敗續命 | `escaped` | 再試一次，線索不清空 | 直接緩解本規格最重的懲罰，觀看意願最高 |
| 體力續走 | `exhausted` | +20 體力繼續本局 | 挽救沉沒成本 |
| 排除干擾 | 推理中（難度≥2） | 標示出一個干擾線索 | 針對進階玩家的卡關解套 |

- 分級注意：PEGI 3–7 限制廣告類別，portal SDK 會自動過濾，此限制同時是維持闔家定位的護城河。

### 10.3 留存放大器：每日挑戰（零成本，商業化第一優先功能）

- 種子 RNG（mulberry32）以**當日日期為種子**即可讓全球玩家玩同一張圖、可比成績。
- 每日回訪 = 廣告曝光的直接乘數，也是 portal 演算法最重視的指標之一。
- 額外開發量約 1 天（UI 入口 + 成績顯示）。

### 10.4 中期路徑（留存數據驗證後才投入）

1. **內容擴充節奏**：生物 8 → 12 → 20 種、新地形配色；每次更新拉高 portal 更新頻率評分與回流（呼應 §4.6）。
2. **手機版**：Phaser + Capacitor 包裝上 Google Play / App Store，「廣告 + 一次性去廣告 IAP（$2.99）」模式；點擊操作已觸控友善。
3. **Steam 豪華版**：網頁版數據亮眼時，做擴充版（更多生態系、meta 進度、成就）售 $4.99–7.99，網頁版反向作為免費 demo 導流——portal 品類少數能突破分潤天花板的路徑。

### 10.5 不採用（本階段明確排除）

- **內購貨幣/抽卡**：與闔家分級及「觀察推理」核心體驗衝突，且單人無伺服器架構做經濟系統成本過高。
- **自行買量投放**：portal 模式的價值即平台自帶流量，此品類自行買量幾乎必虧。

### 10.6 執行順序摘要

```
itch.io 驗證（不求收入）
  → CrazyGames SDK + 局間廣告 + 三個 rewarded 掛載點（第一筆收入，約 2–3 天開發）
  → 每日挑戰拉留存（約 1 天）
  → Poki 多管道
  → 數據達標後評估手機版 / Steam 豪華版
```

---

## 11. 部署與上架

> 前提：本遊戲為純靜態前端（dist 約 1.5MB、無伺服器、無資料庫），部署本質是「將 dist 目錄放上目標平台」。重點不在基礎設施，而在各平台的提交規則與前置修改。

### 11.1 階段一：itch.io（驗證期，隨時可上）

**上傳流程：**
1. 建立專案頁 → Kind of project 選 **HTML** → 上傳 `ridge-hunters-trail-itch.zip`（zip 根目錄含 index.html，路徑分隔符已確認為正斜線）
2. 勾選「This file will be played in the browser」；Embed 設定 viewport **720×780**，建議開啟 Fullscreen button；Mobile friendly 待觸控支援完成後再勾
3. 定價 free 或 pay-what-you-want（§10.1 驗證期不求收入）

**迭代發版建議改用 butler CLI**（itch 官方工具）：`butler push dist <帳號>/ridge-hunters-trail:html5`——單指令部署、差量上傳、保留版本歷史。

**上傳前人工檢查清單：**
- 雙語各走一輪完整迴圈（地圖 → QTE → 結算 → 圖鑑）
- 瀏覽器封鎖第三方 cookie 情境下確認可正常啟動（沙箱 iframe 的 localStorage 防護已實作，需實測）
- 繁中系統字體渲染確認
- 3–5 位測試者 QTE 手感實測（§8.1）後再進入階段二

### 11.2 階段二：CrazyGames Basic Launch

體積（1.5MB ≪ 50MB）與檔案數已達標；經 developer portal 提交並通過官方 QA。**提交前必須完成的程式修改：**

| 項目 | 內容 | 預估 |
|---|---|---|
| CrazyGames SDK | 局間插頁廣告＋三個 rewarded 掛載點（§10.2，狀態機已預留） | 2–3 天 |
| 字體自託管 | Google Fonts 為外部請求，portal QA 通常禁止外部資源依賴；將 Marcellus/Karla 子集化為 woff2 打進 dist（約 30–50KB，不影響體積門檻） | 0.5 天 |
| 觸控標記 | Shift+點擊在觸控裝置不存在；HUD 增加「標記模式」切換鈕（portal 流量大宗為行動裝置） | 0.5 天 |

### 11.3 階段三：Poki

- **8MB 初始下載門檻現已達標**（1.5MB），原規劃的素材分包延遲載入暫不需要
- 需整合 Poki SDK 並通過其 QA；其餘與階段二共用同一份建置

### 11.4 自有版本與發版自動化（選配）

- 在 portal 之外保留自控網址（供測試者/社群/媒體）：**Cloudflare Pages 或 GitHub Pages**，零成本靜態託管
- repo 推上 GitHub 後可加 GitHub Actions：push tag → `npm ci` → 測試 → 建置 → 自動部署 Pages ＋ `butler push` 至 itch；之後每次發版即打一個 tag
- 前置：目前 repo 尚無 remote

### 11.5 本階段明確不採用

- 自架伺服器／VPS：無後端需求，純增成本
- 付費 CDN：portal 平台自帶分發
- Steam 上架：待網頁版留存數據驗證後再評估（§10.4）

### 11.6 執行順序摘要

```
人工冒煙驗證 → itch.io 上傳 → 3–5 位測試者實測 QTE
  → 字體自託管 + 觸控標記鈕 + CrazyGames SDK（約 3–4 天）→ Basic Launch 提交
  → 數據達標 → Poki 提交 →（選配）GitHub + Actions 自動化發版
```
