# 架構筆記：儲存鍵一覽（Storage & Registry Key Reference）

Phase 2 最終審查曾指出，重建「哪個鍵存什麼、誰讀誰清」的全貌得追讀四個場景檔。
本文件把 `localStorage`（跨瀏覽器工作階段持久化）與 Phaser `game.registry`
（單一頁面生命週期內的跨場景共享狀態）兩層通通列表建檔，供之後每個工作流開場時查閱，
不必再重新考古。

兩層的差異：**localStorage** 的內容重新整理頁面後還在（供玩家下次回來延續進度）；
**registry** 只活在單次頁面載入內，重新整理即清空（用於場景間傳遞當下這局的狀態，
例如目前 session、本局剛解鎖的道具卡）。多數 registry 鍵背後就是一個包著
`localStorage` 讀寫的 store（如 `codex`、`tools`、`streak`），registry 本身只存
store 的參照；也有幾個是純粹的暫存旗標（如 `lastUnlocks`、`dailyKey`）。

---

## 1. localStorage 鍵

enumerate 方式：`grep -rn "rht\." src/`。降級規則欄位的兩個子項統一定義：

- **讀取降級**（`getItem` 拋例外，例如隱私模式/瀏覽器封鎖）→ 退回記憶體內建的預設值，
  當次工作階段仍可正常運作，只是不會記住上一次的資料。
- **格式降級**（`JSON.parse` 失敗，或解析出的形狀不符預期）→ 視同「沒有資料」，
  套用模組自帶的預設值；壞資料**不會**造成例外往外拋。

| Key | Schema | 降級規則 | Owner 模組 |
|---|---|---|---|
| `rht.codex.v1`（僅遷移來源，不再寫入）／`rht.codex.v2`（現行） | v1：`Record<creatureId, count:number>`（舊版純計數表）。v2：`Record<creatureId, {count:number; research:number; bestQuality:'bronze'\|'silver'\|'gold'\|null}>` | 讀取降級 → 退回記憶體 `mem`。v2 不存在時嘗試 `migrateV1`：解析失敗或非物件 → `{}`；v1 逐筆轉換時 `count<=0` 的項目捨棄，並補算 `research = count×3`、`bestQuality:'bronze'`（近似值，非真實歷史品質）。v2 存在但 JSON 壞掉 → `{}`（**不**退回 v1，等同放棄舊資料）。寫入降級（`setItem` 拋例外）→ 靜默吞下，僅記憶體生效。 | `src/core/codex.ts` |
| `rht.locale.v1` | 純字串：`'en' \| 'zh-TW'`（非 JSON，直接存字串本體） | 讀取降級 → 沿用建構時傳入的 `initial` locale。值不是 `'en'`/`'zh-TW'`（含壞值、`null`）→ 同樣沿用 `initial`（無 default 常數，型別即白名單）。寫入降級 → 靜默吞下，僅本次瀏覽階段語系正確，重整後退回瀏覽器語系偵測結果。 | `src/core/i18n.ts` |
| `rht.tut.v1`／`rht.help.v1`（一組：同一函式 `finishTutorial()` 同時寫入兩者，同一場景擁有，降級規則相同，故合併一列） | 各自純字串 sentinel：`'1'` 表示「已完成/已看過」，其餘值（含不存在）視為未完成 | 讀取降級（`try/catch` 包住 `getItem`）→ 視為未完成（`done`/`seen` = `false`），效果：本局仍會重新觸發新手引導／自動彈出說明。寫入降級 → 靜默吞下（`finishTutorial`／`maybeShowFirstRunHelp` 皆有註解「無法記憶時下次仍會重新引導/顯示，可接受」）。 | `src/scenes/MapScene.ts` |
| `rht.daily.v1` | JSON：`{ streak:number; freezes:number; lastPlayed:string\|null }`（`StreakState`） | 讀取降級 → 退回記憶體 `mem`。JSON 解析失敗，或解析結果 `typeof streak !== 'number'` → `EMPTY`（`{streak:0, freezes:0, lastPlayed:null}`）。寫入降級 → 靜默吞下，僅記憶體生效（本次工作階段連勝計數仍運作，但不會保存）。 | `src/core/daily.ts` |
| `rht.run.v1` | JSON：`{ round:number; wins:number }` | 讀取降級 → 退回記憶體 `mem`。JSON 解析失敗，或 `round`/`wins` 非有限數、`round<1`、`wins<0`（防禦壞資料造成 NaN 擴散）→ `DEFAULTS`（`{round:1, wins:0}`）。寫入降級 → 靜默吞下。 | `src/core/runstate.ts` |
| `rht.tools.v1` | JSON：`Record<'windstone'\|'glowbell', boolean>` | 讀取降級 → 退回記憶體 `mem`。JSON 解析失敗或非物件 → `DEFAULTS`（皆 `false`）；解析出的部分物件會與 `DEFAULTS` 做 spread 合併（缺的鍵補 `false`，不因少一個欄位整體作廢）。寫入降級 → 靜默吞下。 | `src/core/tools.ts` |
| `rht.commissions.v1` | JSON：`{ date:string; done:[boolean,boolean,boolean] }` | 讀取降級 → 退回記憶體 `mem`。JSON 解析失敗，或形狀不符（`date` 非字串／`done` 非長度 3 陣列）→ `null`（`statusFor` 對任何日期一律回傳 `[false,false,false]`）；形狀正確但陣列元素非布林（如外部工具寫入 `1`/`0`）→ 逐格 `Boolean()` 轉型，不整體作廢。寫入降級 → 靜默吞下。 | `src/core/commissions.ts` |
| `rht.audio.v1` | 純字串 sentinel：`'0'` \| `'1'`（開關） | 讀取降級（`try/catch`）→ 沿用預設 `on = true`。值不是 `'0'`/`'1'` → 同樣沿用預設。寫入降級（`persist()` 內 `try/catch`）→ 靜默吞下，僅本次工作階段的開關正確。 | `src/core/audio.ts` |
| `rht.score.v1` **（本期 Task 7 新增，尚未實作，此列為 Phase 3 W3 押注續追設計預告）** | 依 `docs/superpowers/specs/2026-09-01-phase3-longtail-design.md` §W3：JSON `{ banked:number; pot:number; multiplier:number; bestRun:number }`（`banked`＝已入袋分數、`pot`＝本輪未入袋分數、`multiplier`＝連追倍率 `1→1.5→2→2.5` 封頂、`bestRun`＝歷史最佳入袋） | 設計文件明言「降級同 runstate」：預期比照 `rht.run.v1` 模式（讀取拋例外 → 退回記憶體；JSON 壞掉或形狀不符 → 預設值 `{banked:0, pot:0, multiplier:1, bestRun:0}`；寫入拋例外 → 靜默吞下）。**實際實作以屆時程式碼為準**，此處僅記錄設計意圖，新增時務必回頭校正本列。 | 預計 `src/core/score.ts`（尚未建立） |

---

## 2. registry 鍵

enumerate 方式：`grep -rn "registry\.\(set\|get\|remove\)" src/`。與 localStorage 不同，
registry 鍵沒有「格式降級」的概念——寫入方保證型別正確（TypeScript 編譯期檢查加上
唯一寫入來源），讀取方只需要處理「這個鍵這個時間點是否已經被設過」。

| Key | 誰設定（set） | 誰讀取（get） | 清空／生命週期 |
|---|---|---|---|
| `rng` | `main.ts`（boot 時建立一次，`mulberry32(Date.now())`） | `ResultScene`、`QteScene`（生成 QTE、判讀命中）、`MapScene`（風向石 `useBell`） | 從不清空／覆寫；整個頁面生命週期共用同一顆全域 RNG（daily 模式改用獨立種子 RNG，不經過此鍵）。 |
| `storage` | `main.ts`（`safeStorage()`：`window.localStorage` 或 `undefined`） | `MapScene`（教學／說明旗標的直接讀寫，未包成 store） | 從不清空；`undefined` 時代表整個頁面降級為純記憶體模式，各 store 建構時已各自處理。 |
| `codex` | `main.ts`（`createCodex(storage)`） | `ResultScene`、`CodexScene`、`CampScene` | 從不清空；store 本身是 `rht.codex.v2` 的薄包裝，registry 只存這個包裝物件的參照。 |
| `i18n` | `main.ts`（`createI18n(...)`） | `ResultScene`、`QteScene`、`MapScene`、`HelpScene`、`CodexScene`、`CampScene`（幾乎每個場景都讀） | 從不清空；`setLocale()` 改變的是物件內部狀態＋`rht.locale.v1`，registry 鍵本身恆指向同一物件，不需重設。 |
| `session` | `main.ts`（初始 `newSession(1, rng)`）／`ResultScene`（成功續追、daily 重試、run 重試時覆寫成下一局）／`CampScene`（點擊「上山追蹤」「今日行蹤」時覆寫） | `MapScene`、`QteScene`、`HelpScene`、`CodexScene`（僅讀已記錄的圖鑑進度用不到 session 內容，但介面一致）、`BootScene`（僅 dev 模式 `#scene=Result` 直達除錯路徑，直接改寫 `s.phase`） | 從不 `remove`，永遠是「覆寫成下一局的新 `SessionState`」；`SessionState.resolved` 旗標防止 `ResultScene` 因 resize 重啟而重複記帳，而非靠清空這個鍵。 |
| `runState` | `main.ts`（`createRunState(storage)`） | `ResultScene`（`addWin()`／`setRound()`）、`MapScene`（HUD 顯示 `wins()`） | 從不清空；store 是 `rht.run.v1` 的薄包裝。 |
| `runRound` | `main.ts`（初始 `runState.round()`）／`ResultScene`（主線捕獲成功時 `s.round + 1`，與 `runState.setRound()` 同步寫入） | `ResultScene`（「下一場狩獵」按鈕的目標局數）、`CampScene`（「上山追蹤．第 n 局」按鈕文字與進場局數） | 從不清空；是 `runState.round()` 在 registry 層的快取，兩者理論上應保持一致（`ResultScene` 記帳時同時寫兩處）。 |
| `streak` | `main.ts`（`createStreak(storage)`） | `ResultScene`（daily 模式記錄連勝、顯示連勝數／分享卡）、`CampScene`（連勝 chip、判斷今日是否已玩） | 從不清空；store 是 `rht.daily.v1` 的薄包裝。 |
| `tools` | `main.ts`（`createTools(storage)`） | `ResultScene`（`syncUnlocks(codex)` 判定本局是否新解鎖）、`MapScene`（HUD 判斷是否顯示鈴 chip） | 從不清空；store 是 `rht.tools.v1` 的薄包裝。 |
| `commissions` | `main.ts`（`createCommissionStore(storage)`） | `ResultScene`（結算判定＋標記完成）、`CampScene`（營地委託板讀狀態） | 從不清空；store 是 `rht.commissions.v1` 的薄包裝。 |
| `audio` | `main.ts`（`createAudio(storage, ctxFactory)`） | `ResultScene`、`QteScene`、`MapScene`、`CampScene`（每個場景各自持有 `this.audio` 快取，皆來自此鍵） | 從不清空；`toggle()`／`unlock()` 改變物件內部狀態＋ `rht.audio.v1`，registry 鍵本身恆指向同一物件。 |
| `lastUnlocks` | `ResultScene`（結算時算出「本次新解鎖的道具」清單並暫存） | `ResultScene`（同一次 `create()` 稍後渲染解鎖卡；resize 重啟時重讀，不重算） | `MapScene.create()`／`CampScene.create()` 開頭清空為 `[]`——代表「離開 Result 進入下一個場景」，避免卡片殘留到下一次進場。 |
| `lastComms` | `ResultScene`（結算時算出「本次新完成的委託」索引清單並暫存） | `ResultScene`（同上，渲染委託完成行；`describeCommission` 取回描述文字） | 同 `lastUnlocks`：`MapScene.create()`／`CampScene.create()` 開頭清空為 `[]`。 |
| `qteOutcome` | `QteScene`（判讀結束時寫入 `QteState`，含命中精準度） | `ResultScene`（換算品質 `qualityFromQte(qte)`） | 從不主動清空／`remove`；下一次進入 `QteScene` 時會被覆寫。若某局跳過 QTE（如失敗/逃跑），`ResultScene` 讀到的是上一局殘留值，但 `qte` 只在 `caught` 分支才會被使用，故不影響正確性。 |
| `dailyKey` | `CampScene`（點擊「今日行蹤」時，取樣當下日期一次存入，供本局與結算共用同一 dateKey） | `ResultScene`（`s.mode === 'daily'` 時讀取，取代現場重新取樣，避免跨 UTC 午夜分歧） | `CampScene.create()` 開頭 `registry.remove('dailyKey')`——代表「回到營地＝本次 daily（若有）已結算完畢」，防止下一局改走主線時誤讀到舊值。 |
| `score` **（本期新增，Task 8，尚未實作）** | 預計 `main.ts`（`registry.set('score', createScoreStore(storage))`，比照 `codex`/`tools`/`streak` 的 store 掛載方式） | 預計 `ResultScene`（caught 時計分＋雙卡「安全歇腳／乘勝續追」）、`CampScene`（顯示 `bestRun` 與進行中 `banked`/`pot`） | 預計從不清空，`rht.score.v1` 的薄包裝，比照現有 store 慣例。 |
| `lastGain` **（本期新增，Task 8，尚未實作）** | 預計 `ResultScene`（caught 時暫存本局 `catchScore(...)` 增量，供結算畫面顯示「+N 分」） | 預計 `ResultScene`（同一次 `create()` 內渲染） | 預計比照 `lastUnlocks`／`lastComms` 模式：離開 Result 時（`MapScene`／`CampScene` 開頭）清空，避免殘留到下一次進場。 |
| `lastLoss` **（本期新增，Task 8，尚未實作）** | 預計 `ResultScene`（escaped／exhausted 時暫存本輪 `pot` 消散量，供結算畫面顯示「散進霧裡了……」文案帶數字） | 預計 `ResultScene`（同一次 `create()` 內渲染） | 預計同 `lastGain`：離開 Result 時清空。 |

---

## 3. 維護規則

> **新增鍵時必須同步本表。** 不論是 `localStorage` 鍵（新增一個模組級 store）或
> `registry` 鍵（新增一個跨場景共享狀態），落地當下就要回來這裡加一列——降級規則、
> 讀寫位置、生命週期三項缺一不可。這份表格的價值只在「跟程式碼同步」的那一刻，
> 拖到下個工作流開場才補，等於重蹈 Phase 2 最終審查發現的覆轍。
