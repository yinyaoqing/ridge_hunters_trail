# Ridge Hunter's Trail — Phase 3「長線內容」設計提案 v1.0

> 狀態：**提案待審**。依據：Phase 2 設計提案 §「Phase 3 預告」（已核准方向）、Phase 1/2 執行帳本遺留項、main 現況（commit d949a7d，164/164 測試）。經核准後依 superpowers:writing-plans 拆解為實作計畫。

---

## 1. 範圍總覽（六個工作流）

依已核准順序：收尾 → 天氣（P7）→ 異彩變種（P9）→ 押注續追（P5）→ 途中微事件（P10）→ 音效擴充。每個工作流結束都是可上架版本。

### W0 收尾與帳本清零

1. **每日重試修正（必修 bug）**：`ResultScene` 重試分支目前對 daily 模式用全域 rng 重新生成（`newSession(s.round, rng, s.mode)`）——重試會拿到**不同的圖**，違反全球同題。修正：daily 模式改 `createDailySession(new Date())`（沿用 registry `dailyKey` 的日期以跨午夜一致）。
2. **架構筆記文件化**：`docs/ARCHITECTURE-NOTES.md`——8 個 localStorage key（schema/降級規則）＋ 15 個 registry key（誰設、誰清、生命週期）。Phase 2 最終審查明言重建此圖花了四個場景的追讀，Phase 3 之後只會更多。
3. 小項：HUD 圖例成本數字改由 `TERRAIN_COST` 推導；委託卡描述加 wordWrap（Task 12 遺留的窄幅風險）。
- 估 1 天。

### W1 天氣系統（P7）

- `src/core/weather.ts`：`type Weather = 'clear' | 'mist' | 'wind' | 'drizzle'`；`applyWeather(p: DifficultyParams, w: Weather): DifficultyParams`（純函式、不變異輸入）。修飾順序（Phase 2 已核准）：**base → quirk → weather**（乘法疊加）。
- 天氣表（唯一資料來源在 weather.ts）：

| 天氣 | 權重 | 修飾 | 敘事 |
|---|---|---|---|
| clear 晴 | 4 | 無 | 尋常的一天 |
| mist 霧日 | 2 | `scentTolerance ×1.5`、`footprintSpread ×1.5` | 萬物朦朧 |
| wind 風日 | 2 | `scentTolerance ×1.75`、`disturbanceRadius −1（下限 1）` | 氣味吹散、擾動更緊 |
| drizzle 細雨 | 2 | `footprintSpread ×0.75`、`scentTolerance ×1.25` | 濕地留痕清晰、氣味微淡 |

- `Level` 增 `weather: Weather` 欄位；`generateLevelFor` 於抽生物後、其餘生成前抽天氣（rng 消耗序改變＝新版本關卡佈局與 Phase 2 不同——僅影響跨版本重放，單日全球同題不受影響）。
- 可解性保證不變：反向錨定在（quirk＋weather）修飾後執行；200 種子性質測試需仍過。
- UI：Map HUD 天氣徽章（圖形符號＋i18n 名稱）；霧日時 W5 霧粒子 frequency 減半值（更密但仍受 caps 上限）；營地每日卡顯示今日天氣（由 `createDailySession` 生成一次取 `level.weather`，成本可忽略）。Help 增一列說明。
- 估 2.5 天。

### W2 異彩變種（P9）

- `generateLevelFor` 內以關卡 rng 擲 5%（`IRIS_RATE = 0.05` 常數）→ `Level.iris: boolean`。每日同種子＝同結果（公平）。
- `Palette` 增 `iris: number`（三循環各一：霧綠 0xd6a8e0／赭石 0xe0b8d0／暮紫 0xa8d8e0 —— 虹彩感、與線索金光/生物 glow 均有區辨度，實作時以對比檢查微調）。
- 呈現：QTE 剪影 tint iris 色＋glow；Result 肖像 iris tint＋標題前綴（i18n `iris.prefix`：'Iridescent '/'異彩·'）；分享卡 caught 且 iris 時第 2 行追加 🌈。
- 圖鑑：`CodexEntry` 增 `irisSeen: boolean`（**additive、預設 false**，v2 schema 相容不遷移）；`addRecord` 增選參 `iris?: boolean`；圖鑑行右側星位 `☆`（未見）→ `★`（iris 色，已見）。
- 計分掛鉤：iris 收錄分 ×2（見 W3）。純遊玩獎勵、無任何付費/抽卡。
- 估 2 天。

### W3 押注續追（P5）＋計分

- `src/core/score.ts`（純邏輯＋存檔 `rht.score.v1`，降級同 runstate）：
  - `catchScore(round, quality, iris): number` ＝ `round × 100 × 品質係數（銅 1／銀 1.2／金 1.5）× (iris ? 2 : 1)`。
  - 狀態 `{banked, pot, multiplier, bestRun}`；階梯 `×1 → ×1.5 → ×2 → ×2.5（封頂）`。
  - 流程（僅 run 模式；daily 一局定勝負不參與）：
    - caught → `pot += catchScore × multiplier`，結算畫面雙卡選擇：
      - **安全歇腳**（實心金）：`banked += pot; pot = 0; multiplier = 1`，回營地。
      - **乘勝續追**（描邊＋顯示下一檔倍率）：multiplier 升一檔，直接進下一局。
    - escaped / exhausted → `pot = 0; multiplier = 1`（**已入袋不動**——損失趨避的正向運用，家庭向文案：「這趟的收穫散進霧裡了……已入袋的安然無恙」）。
    - `bestRun = max(bestRun, banked)` 於入袋時更新。
  - 為未來排行榜鋪路（本階段無伺服器、無上傳）。
- UI：Result caught(run) 顯示本局得分與 pot；雙卡取代現行「下一場狩獵」單鈕（歇腳＝回營地、續追＝進下一局——既有按鈕 helper 直接複用）；escaped 顯示 pot 消散行；營地顯示 `bestRun` 與進行中 `banked/pot` chip。i18n 約 10 鍵。
- 估 3 天。

### W4 途中微事件（P10）

- `src/core/events.ts`：`rollMicroEvent(s, rng): MicroEvent | null`（純函式）。觸發規則：每步 4%、每局上限 2（`SessionState.microEvents: number` 計數）、排除：教學進行中、目標 cheb ≤ 2（不搶 QTE 戲）、線索/補給格上。
- 事件表：

| 事件 | 權重 | 效果 |
|---|---|---|
| bird-startle 驚起鳥群 | 2 | 顯示指向目標的粗方向錐（±45°、一次性顯示 2.5 秒後消失，不留存） |
| bonus-supply 意外補給 | 2 | 鄰近空格生成一枚補給 |
| old-trail 舊足跡 | 1 | 玩家所在格顯示一條弱足跡線索（spread ×2、一次性顯示 5 秒） |

- **每日模式停用**（D14）：微事件依移動路徑消耗 rng，無法全球同題；每日挑戰保持純推理。
- UI：浮字＋對應繪製＋`reveal` 音。
- 估 2 天。

### W5 音效擴充與最終打磨

- 天氣環境聲變體（風日：風聲增益提高；細雨：雨滴白噪變體——皆程序合成、零素材檔）；異彩揭示琶音；入袋／續追確認音；微事件提示音。
- 打磨：Result 雙卡 hover 狀態沿用既有 helper；營地 chip 版面驗算（既有 chipRowLeft 機制）。
- 最終冒煙清單整併（Phase 1–3 全部未執行的人工項一次列出）。
- 估 2 天。

Phase 3 估時合計約 **12.5 天**。

---

## 2. 設計決策（需核准）

| # | 決策 | 建議 | 理由 |
|---|---|---|---|
| D11 | 天氣表與權重 | 如 §W1 表（晴 4／其餘各 2） | 四成尋常日維持基準體感；三種天氣各推一種線索型別的判讀變化 |
| D12 | 異彩參數 | 機率 5%、計分 ×2、分享卡 🌈、圖鑑星位 | 變動比率增強的甜蜜點；不影響難度（僅視覺＋分數） |
| D13 | 計分公式與階梯 | `round×100×品質係數×iris`；`×1→1.5→2→2.5` 封頂；入袋重置倍率；逃逸只失 pot | 「保住 vs 翻倍」張力清晰；封頂防滾雪球；已入袋不罰守家庭向紅線 |
| D14 | 微事件在每日挑戰停用 | **停用** | 路徑依賴的 rng 無法全球同題；每日保持純推理可比性 |
| D15 | 每日重試＝同一張圖 | **是**（W0 修正） | 「全球同題」的完整性；重試改為練同一題 |
| D16 | 營地每日卡顯示天氣 | **是**（生成每日關卡取欄位） | 天氣成為當日話題點（Phase 2 提案原句） |
| D17 | rng 消耗序改變 | **接受**（新版本關卡佈局與舊版不同） | 無跨版本重放需求；單日內全球一致不受影響 |

---

## 3. 驗證指標與順序

| 順位 | 工作流 | 驗證 |
|---|---|---|
| 1 | W0 收尾 | 每日重試同圖（測試把關）；架構筆記存在 |
| 2 | W1 天氣 | 200 種子可解性續過；tier 內局間變化感（人工） |
| 3 | W2 異彩 | 種子重現含 iris；圖鑑星位；分享卡 🌈 |
| 4 | W3 押注 | score store 全路徑測試；雙卡流程冒煙 |
| 5 | W4 微事件 | 上限/排除規則測試；每日絕不觸發（測試把關） |
| 6 | W5 音效打磨 | 人工聽感；最終冒煙清單 |

## 4. 明確不做（承襲）

不做伺服器排行榜（僅本地 bestRun）、不做付費/抽卡/FOMO、不打包音訊素材檔、不引入 DOM 疊層、粒子總量維持 D7 邊界。
