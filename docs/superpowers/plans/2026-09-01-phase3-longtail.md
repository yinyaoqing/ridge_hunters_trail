# Phase 3: 長線內容（W0–W5）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作已核准的 `docs/superpowers/specs/2026-09-01-phase3-longtail-design.md`（D11–D17 全採建議）：每日重試修正與帳本收尾、天氣系統、異彩變種、押注續追計分、途中微事件、音效擴充與最終打磨。

**Architecture:** 延續既有架構：天氣/異彩/計分/微事件全為純 TypeScript 模組（Vitest TDD、注入 rng/storage）；場景層薄渲染。生成修飾順序 **base → quirk → weather**；天氣與異彩由關卡 rng 決定（每日同種子＝同結果，D17 接受消耗序改變）；微事件僅 run 模式（D14）。Result 副作用一律在 `resolved` 防重塊內，跨重繪顯示走 registry 暫存（lastGain/lastLoss 比照 lastUnlocks 模式）。

**Tech Stack:** 既有（Phaser 3.90、TS strict、Vite、Vitest、WebAudio 程序合成）。無新相依。

## Global Constraints

- 世界觀架空原創、無 kill/die/blood 字眼、PEGI 3–7；所有玩家可見字串走 `i18n.t()`（既有圖標豁免 ? ♪ ✓ ☆★ ×n 🌈）。
- 隨機性一律注入 `mulberry32`（音訊噪音與粒子散佈的 Math.random 豁免需附註解）。
- localStorage 讀寫失敗靜默降級（getItem throw→mem、壞 JSON→預設），比照 runstate.ts。
- 可解性 200 種子性質測試全程續過；每日決定性以測試把關（重試同圖、微事件於 daily 絕不觸發）。
- Result 副作用（score 變動）一律在 `if (!s.resolved)` 內；顯示資料經 registry 暫存並於 Camp/Map create 清空。
- 粒子維持 D7 邊界（caps/motionOK/guardLowFps）；音訊零素材檔＋unlock 手勢機制不得破壞。
- 不做伺服器排行榜、不做付費/抽卡/FOMO、不引入 DOM 疊層。
- 數值集中：天氣表在 `weather.ts`、異彩率在 `generate.ts` 常數、計分在 `score.ts`、微事件在 `events.ts`。
- Windows/PowerShell 驗證指令；Vite base './' 不動。基準測試數 **164**。

## 設計決策落地備忘（D11–D17）

1. **rng 消耗序（D17）**：`generateLevelFor` 於 `applyQuirk` 之後、`targetPos` 之前依序抽 **weather**（pickWeighted）與 **iris**（`rng() < IRIS_RATE`）；params 最終 = `applyWeather(applyQuirk(getDifficulty(round), creatureId), weather)`。
2. **既有測試衝擊**：generate 的 quirk e2e 斷言（mistfawn tolerance ×2、dewhopper supplies）現須以「quirk＋weather 後」參數為準——weather 不動 decoyCount/supplyCount（表僅調 scentTolerance/footprintSpread/disturbanceRadius），故 decoys/supplies 斷言不變；**tolerance 斷言必改**（詳 Task 3）。
3. **每日重試（D15）**：`createDailySessionFromKey(dateKey)` 新增於 daily.ts；ResultScene retry 分支 daily 模式改用它（以既有 dk 變數，跨午夜一致）。
4. **計分（D13）**：`catchScore = round × 100 × 品質係數(1/1.2/1.5) × (iris?2:1)`；階梯 `MULTIPLIERS = [1, 1.5, 2, 2.5]`；addCatch 以**當下**倍率入 pot、push 提升**下一局**倍率；bank 時 `bestRun = max(bestRun, banked)`；escaped/exhausted → `loseRun()`（pot 歸零、倍率歸 1、banked 不動）。僅 run 模式。
5. **微事件（D14）**：`EVENT_CHANCE = 0.04`、每局上限 2（`SessionState.microEvents`）；排除 daily 模式、教學進行中（場景層檢查）、cheb≤2、線索/補給格。
6. **異彩（D12）**：`IRIS_RATE = 0.05`；`Level.iris`；`CodexEntry.irisSeen`（additive 預設 false，免遷移）；分享卡 caught+iris 追加 🌈。

## File Structure

```
src/core/daily.ts        修改：createDailySessionFromKey                ← Task 1
src/scenes/ResultScene.ts修改：daily 重試同圖、計分雙卡、消散行          ← Task 1, 8
docs/ARCHITECTURE-NOTES.md 新增：儲存鍵＋registry 鍵生命週期            ← Task 2
src/scenes/MapScene.ts   修改：圖例推導、天氣徽章、微事件接線           ← Task 2, 4, 10
src/scenes/CampScene.ts  修改：委託 wordWrap、每日卡天氣、bestRun chip  ← Task 2, 4, 8
src/core/weather.ts      新增：Weather 型別/權重/applyWeather           ← Task 3
src/core/types.ts        修改：Level.weather、Level.iris                ← Task 3, 5
src/core/generate.ts     修改：weather/iris 抽取＋applyWeather          ← Task 3, 5
src/core/palette.ts      修改：iris 色（三循環）                        ← Task 5
src/core/codex.ts        修改：irisSeen＋addRecord 選參                 ← Task 5
src/core/share.ts        修改：iris 🌈                                  ← Task 5
src/scenes/QteScene.ts   修改：異彩剪影 tint＋glow                      ← Task 6
src/scenes/CodexScene.ts 修改：異彩星位                                 ← Task 6
src/core/score.ts        新增：catchScore＋ScoreStore                   ← Task 7
src/core/events.ts       新增：MicroEvent＋rollMicroEvent               ← Task 9
src/core/session.ts      修改：microEvents 欄位                         ← Task 9
src/core/audio.ts        修改：新音色＋天氣環境聲變體                   ← Task 11
src/core/i18n.ts         修改：各 task 隨用隨加（平價測試把關）
tests/…                  對應核心模組測試
```

---

### Task 1: 每日重試同圖（W0，D15 必修）

**Files:**
- Modify: `src/core/daily.ts`、`tests/daily.test.ts`、`src/scenes/ResultScene.ts`

**Interfaces:**
- Produces: `createDailySessionFromKey(dateKey: string): SessionState`（`newSession(DAILY_ROUND, mulberry32(Number(dateKey.replaceAll('-',''))), 'daily')`）；ResultScene retry 分支 daily 模式改用它（帶既有 `dk`）。

- [ ] **Step 1: 失敗測試（tests/daily.test.ts 追加）**

```typescript
describe('createDailySessionFromKey', () => {
  it('same key reproduces the same level; matches createDailySession for that date', () => {
    const a = createDailySessionFromKey('2026-09-01');
    const b = createDailySessionFromKey('2026-09-01');
    expect(a.level).toEqual(b.level);
    const c = createDailySession(new Date(Date.UTC(2026, 8, 1)));
    expect(a.level).toEqual(c.level);
    expect(a.mode).toBe('daily');
  });
});
```

- [ ] **Step 2: 確認失敗** → **Step 3: 實作 daily.ts**

```typescript
// 每日重試／跨午夜一致：由 dateKey 直接重建同一張圖（D15）
export function createDailySessionFromKey(dateKey: string): SessionState {
  return newSession(DAILY_ROUND, mulberry32(Number(dateKey.replaceAll('-', ''))), 'daily');
}
```

- [ ] **Step 4: 確認通過** → **Step 5: ResultScene retry 分支**

現行（run/daily 共用）：`this.registry.set('session', newSession(s.round, rng, s.mode));` 改為：

```typescript
        this.registry.set('session',
          s.mode === 'daily' ? createDailySessionFromKey(dk) : newSession(s.round, rng));
```

（`dk` 為該檔既有的每日日期鍵變數；import `createDailySessionFromKey`。）

- [ ] **Step 6: 全測試＋建置** — `npx vitest run`（165）、`npm run build` exit 0
- [ ] **Step 7: Commit** — `fix: daily retry replays the same seeded level`

---

### Task 2: 架構筆記與小項收尾（W0）

**Files:**
- Create: `docs/ARCHITECTURE-NOTES.md`
- Modify: `src/scenes/MapScene.ts`（圖例成本推導）、`src/scenes/CampScene.ts`（委託描述 wordWrap）

**Interfaces / 內容要求:**
- ARCHITECTURE-NOTES.md 兩張表：
  1. localStorage 鍵（8＋本期新增 rht.score.v1 共 9）：key／schema／降級規則／owner 模組。
  2. registry 鍵（session/rng/storage/codex/i18n/runRound/runState/streak/audio/tools/commissions/qteOutcome/dailyKey/lastUnlocks/lastComms＋本期 score/lastGain/lastLoss）：誰設定、誰讀取、誰清空。
  註明「新增鍵時必須同步本表」。
- MapScene HUD 圖例：`const costs = ['1','1','2','2']` 改由 `TERRAIN_COST` 推導（`[meadow, mist, thicket, rock].map(t => String(TERRAIN_COST[t]))`，import 既有）。
- CampScene 委託描述 text 加 `wordWrap: { width: 卡寬 − 完成標籤保留區(約110), useAdvancedWrap: true }` 並驗算兩行時卡高（必要時卡高 34→40，順移後續 by；報告列數字）。
- [ ] Steps: 實作 → `npx vitest run`（165）＋`npm run build` → Commit `docs: architecture notes for storage and registry keys; hud/commission polish`

---

### Task 3: 天氣核心（W1）

**Files:**
- Create: `src/core/weather.ts`、`tests/weather.test.ts`
- Modify: `src/core/types.ts`、`src/core/generate.ts`、`tests/generate.test.ts`

**Interfaces:**
- Produces:
  - `type Weather = 'clear' | 'mist' | 'wind' | 'drizzle'`
  - `const WEATHER_POOL: [Weather, number][] = [['clear', 4], ['mist', 2], ['wind', 2], ['drizzle', 2]];`
  - `applyWeather(p: DifficultyParams, w: Weather): DifficultyParams`（不變異輸入；表：mist `scentTolerance ×1.5`＋`footprintSpread ×1.5`；wind `scentTolerance ×1.75`＋`disturbanceRadius = max(1, r−1)`；drizzle `footprintSpread ×0.75`＋`scentTolerance ×1.25`；clear 原樣）
  - `Level.weather: Weather`
  - generate：抽序 = applyQuirk → `const weather = pickWeighted(rng, WEATHER_POOL);` → `const p2 = applyWeather(p, weather);` 之後全部用 `p2`；Level 回傳含 weather。

- [ ] **Step 1: 失敗測試 tests/weather.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { applyWeather, WEATHER_POOL } from '../src/core/weather';
import { getDifficulty } from '../src/core/difficulty';

describe('applyWeather', () => {
  const base = getDifficulty(5);
  it('clear leaves params unchanged', () => {
    expect(applyWeather(base, 'clear')).toEqual(base);
  });
  it('mist widens scent tolerance and footprint spread', () => {
    const w = applyWeather(base, 'mist');
    expect(w.scentTolerance).toBeCloseTo(base.scentTolerance * 1.5);
    expect(w.footprintSpread).toBeCloseTo(base.footprintSpread * 1.5);
  });
  it('wind scatters scent and tightens disturbance with floor 1', () => {
    const w = applyWeather(base, 'wind');
    expect(w.scentTolerance).toBeCloseTo(base.scentTolerance * 1.75);
    expect(w.disturbanceRadius).toBe(Math.max(1, base.disturbanceRadius - 1));
  });
  it('drizzle sharpens footprints, slightly fades scent', () => {
    const w = applyWeather(base, 'drizzle');
    expect(w.footprintSpread).toBeCloseTo(base.footprintSpread * 0.75);
    expect(w.scentTolerance).toBeCloseTo(base.scentTolerance * 1.25);
  });
  it('never mutates the input', () => {
    const before = JSON.stringify(base);
    applyWeather(base, 'wind');
    expect(JSON.stringify(base)).toBe(before);
  });
  it('pool weights: clear 4, others 2', () => {
    expect(WEATHER_POOL).toEqual([['clear', 4], ['mist', 2], ['wind', 2], ['drizzle', 2]]);
  });
});
```

- [ ] **Step 2: 確認失敗** → **Step 3: 實作 weather.ts**（結構比照 quirks.ts：spread 複製含 typeRatio/qte 子物件、switch 修飾、附天氣表註解）
- [ ] **Step 4: generate 接入**（依落地備忘 1；`Level` 加 `weather` 欄位）
- [ ] **Step 5: 更新既有 generate 測試**：
  - quirk e2e（mistfawn tolerance）斷言改：`expect(scent.data.tolerance).toBeCloseTo(applyWeather(applyQuirk(getDifficulty(5), 'mistfawn'), b.weather).scentTolerance);`（import applyWeather）。
  - 追加性質測試：200 案例 `expect(['clear','mist','wind','drizzle']).toContain(level.weather);`＋同種子重現（既有測試自動涵蓋 weather 欄位 toEqual）。
  - 可解性/收斂/decoys/supplies 斷言不動且必須續過（weather 不觸 decoyCount/supplyCount/clueCount/maxIntersection）。
- [ ] **Step 6: 全測試＋建置**（171 上下；以實際為準）→ **Step 7: Commit** `feat: seeded per-level weather modifying clue readability, solvability preserved`

---

### Task 4: 天氣 UI（W1）

**Files:**
- Modify: `src/scenes/MapScene.ts`、`src/scenes/CampScene.ts`、`src/scenes/HelpScene.ts`、`src/core/i18n.ts`

**Interfaces:**
- i18n（兩語系）：`weather.clear` 'Clear'/'晴'；`weather.mist` 'Misty'/'霧日'；`weather.wind` 'Windy'/'風日'；`weather.drizzle` 'Drizzle'/'細雨'；`help.weather` 'Weather shifts how clues read: mist blurs, wind scatters scent, drizzle sharpens tracks.'/'天氣影響判讀：霧日朦朧、風日氣味散逸、細雨足跡清晰。'
- MapScene HUD 天氣徽章：round 文字右側（`roundText` 後）小字 `t('weather.'+s.level.weather)`（顯式 key map 比照 QUALITY_KEY 模式）＋前置小圖形（graphics：晴=小圓、霧=兩短橫、風=三斜線、雨=兩斜點；≤14px、paperDim 色）；compact（<560）僅圖形不帶字。
- 霧日粒子：`spawnMistParticles` 於 `s.level.weather === 'mist'` 時 frequency 900→450（密度倍增、caps 不變）。
- CampScene 每日卡：label 追加 `｜${t(weatherKey)}`——天氣以 `createDailySessionFromKey(today).level.weather` 取得（成本可忽略；直接生成一次、僅取欄位，勿存 session）。
- HelpScene：新增一列（圖形＝四天氣小圖示、文字 help.weather）；版面預算依現檔驗算（第 9 列與開始鈕間距 ≥18px，必要時 ph 增高並順移按鈕；報告列數字）。
- [ ] Steps: 實作 → 驗證（vitest 續過、build exit 0；冒煙交人類）→ Commit `feat: weather badge, misty-day particles and daily-card forecast`

---

### Task 5: 異彩核心（W2）

**Files:**
- Modify: `src/core/generate.ts`、`src/core/types.ts`、`src/core/palette.ts`、`src/core/codex.ts`、`src/core/share.ts`
- Tests: `tests/generate.test.ts`、`tests/codex.test.ts`、`tests/share.test.ts`

**Interfaces:**
- Produces:
  - `export const IRIS_RATE = 0.05;`（generate.ts）；`Level.iris: boolean`（weather 之後抽：`const iris = rng() < IRIS_RATE;`）
  - `Palette.iris: number`：MIST_GREEN 0xd6a8e0、OCHRE 0xe0b8d0、DUSK_VIOLET 0xa8d8e0
  - `CodexEntry.irisSeen: boolean`（EMPTY 預設 false；載入舊資料缺欄位時視為 false——`entry()`/操作路徑以 `?? false` 正規化）；`addRecord(id: string, quality: Quality, iris?: boolean): void`（iris true 時 `irisSeen = true`，false/缺省不降級既有 true）
  - `ShareInput.iris: boolean`；`shareText` caught 且 iris 時第 2 行尾加 `🌈`
- 測試：
  - generate：200 案例 `typeof level.iris === 'boolean'`；同種子重現含 iris；1000 種子統計 iris 率落在 [0.02, 0.09]（粗健全性）。
  - codex：addRecord 帶 iris:true 置真且不被後續 false 蓋掉；舊 v2 資料（無 irisSeen 欄位）載入後 entry() 回 false 不炸。
  - share：iris 行含 🌈、非 iris 不含。
- [ ] Steps: TDD → 全測試＋建置 → Commit `feat: iridescent variant roll with codex flag and share marker`

---

### Task 6: 異彩 UI（W2）

**Files:**
- Modify: `src/scenes/QteScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CodexScene.ts`、`src/core/i18n.ts`

**Interfaces:**
- i18n：`iris.prefix` en 'Iridescent ' / zh '異彩·'（結算標題前綴：`(s.level.iris ? i18n.t('iris.prefix') : '') + i18n.t('result.recorded', {...})`——en 尾空格、zh 間隔號，直接字串相接）。
- QteScene：`s.level.iris` 時剪影 `setTint(pal.iris)`（非 tintFill——保留形狀明暗）＋ glow 色改 pal.iris；接近揭示的驚喜時刻。
- ResultScene caught：iris 時肖像剪影 tint pal.iris、光暈色改 iris、標題加前綴；`codex.addRecord(creature.id, quality ?? 'bronze', s.level.iris)`（Task 5 簽名）。shareText 呼叫端補 `iris: s.level.iris`。
- CodexScene 行右側（×count 左邊 24px）星位：`e.irisSeen` → `★`（pal.iris 色）否則 discovered 時 `☆`（paperDim 0.5）——未 discovered 不顯示。
- [ ] Steps: 實作 → 驗證 → Commit `feat: iridescent reveal, portrait tint and codex star`

---

### Task 7: 計分核心（W3）

**Files:**
- Create: `src/core/score.ts`、`tests/score.test.ts`

**Interfaces:**
- Produces:

```typescript
export const QUALITY_MULT: Record<Quality, number> = { bronze: 1, silver: 1.2, gold: 1.5 };
export const MULTIPLIERS = [1, 1.5, 2, 2.5] as const;
export function catchScore(round: number, quality: Quality, iris: boolean): number; // round*100*QUALITY_MULT*(iris?2:1)，四捨五入整數
export interface ScoreState { banked: number; pot: number; multiplier: number; bestRun: number }
export interface ScoreStore {
  state(): ScoreState;
  addCatch(points: number): number; // pot += round(points * multiplier)；回傳實得
  bank(): ScoreState;               // banked+=pot; pot=0; multiplier=1; bestRun=max(bestRun, banked)
  push(): ScoreState;               // multiplier 升至 MULTIPLIERS 下一檔（封頂 2.5）
  loseRun(): ScoreState;            // pot=0; multiplier=1（banked/bestRun 不動）
}
export function createScoreStore(storage?: Pick<Storage,'getItem'|'setItem'>): ScoreStore; // key 'rht.score.v1'
```

- 降級同 runstate（getItem throw→mem、壞 JSON/形狀→預設 `{banked:0,pot:0,multiplier:1,bestRun:0}`；shape guard 用 `Number.isFinite` ≥0、multiplier ∈ MULTIPLIERS 否則重置 1）。
- 測試涵蓋：catchScore 各組合（銅/銀/金 × iris）；addCatch 以當下倍率、push 後下一次 addCatch 用新倍率；階梯 1→1.5→2→2.5→2.5；bank 更新 bestRun 且歸位；loseRun 保 banked/bestRun；持久化 round-trip；壞資料/throw-after-write；無 storage。
- [ ] Steps: TDD → 全測試＋建置 → Commit `feat: run scoring with push-your-luck multiplier ladder and banked safety`

---

### Task 8: 押注 UI（W3）

**Files:**
- Modify: `src/main.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CampScene.ts`、`src/core/i18n.ts`

**Interfaces:**
- registry：`'score'`（main preBoot `createScoreStore(storage)`）；`'lastGain'`/`'lastLoss'`: number（resolved 塊內設定、Camp/Map create 清空——與 lastUnlocks/lastComms 同一行清）。
- i18n（兩語系）：`score.gain` '+{n} pts'/'得分 +{n}'；`score.pot` 'Unbanked {n}'/'待入袋 {n}'；`score.lost` 'The unbanked haul faded into the mist... banked points are safe.'/'這趟未入袋的收穫散進霧裡了……已入袋的安然無恙。'；`btn.bank` '[ Rest & Bank ]'/'［安全歇腳］'；`btn.push` '[ Push On x{m} ]'/'［乘勝續追 ×{m}］'；`camp.best` 'Best run {n}'/'最佳連追 {n}'；`camp.carry` 'Banked {b} · Unbanked {p}'/'入袋 {b}｜待入袋 {p}'。
- ResultScene：
  - resolved 塊內（run 且 caught）：`const gained = score.addCatch(catchScore(s.round, quality ?? 'bronze', s.level.iris)); this.registry.set('lastGain', gained);`；（run 且 !caught）：`score.loseRun(); this.registry.set('lastLoss', 先前 state().pot);`——注意 loseRun 前先讀 pot 存 lastLoss。
  - 顯示（塊外）：caught(run) 於分數區（工具卡/委託行同一堆疊流）顯示 `score.gain {n}`（金色）＋`score.pot {n}`（paperDim 小字）；escaped/exhausted(run) 且 lastLoss>0 顯示 `score.lost`（paperDim、溫柔語氣）。
  - 按鈕改版（run caught 分支）：主鈕改雙卡——`btn.bank`（實心金，onClick：`score.bank(); fadeToScene('Camp')`）與 `btn.push`（描邊，label 帶下一檔倍率 `{m}` = 下一檔（已封頂則現值），onClick：`score.push(); this.registry.set('session', newSession(runRound, rng)); fadeToScene('Map')`）；`btn.camp` 次鈕移除（歇腳即回營地）。y 佈局沿用既有 yPrimary/ySecondary 夾制。daily 分支不變。
  - 防重註記：bank/push 為使用者動作、fadeToScene 有 isRunning 防雙擊；resize-restart 不重算（addCatch 在 resolved 塊內、顯示走 lastGain）。
- CampScene：streak chip 下方（右上區）兩行小字：`camp.best`（bestRun>0 時）與 `camp.carry`（banked+pot>0 時）；讀 `score.state()`。
- [ ] Steps: 實作 → 驗證（vitest 續過、build exit 0；冒煙交人類）→ Commit `feat: bank-or-push result flow with score display and camp best-run`

---

### Task 9: 微事件核心（W4）

**Files:**
- Create: `src/core/events.ts`、`tests/events.test.ts`
- Modify: `src/core/session.ts`、`tests/session.test.ts`

**Interfaces:**
- Produces:

```typescript
export type MicroEvent =
  | { kind: 'bird-startle'; direction: number }  // 指向目標的精確方位（顯示層加寬呈現）
  | { kind: 'bonus-supply'; pos: Vec2 }
  | { kind: 'old-trail'; direction: number };    // 玩家所在格的一次性弱足跡（顯示層 spread 60）
export const EVENT_CHANCE = 0.04;
export const MAX_EVENTS_PER_RUN = 2;
export function rollMicroEvent(s: SessionState, rng: Rng): MicroEvent | null;
```

- `SessionState.microEvents: number`（newSession 初始 0）。
- rollMicroEvent 規則（依序）：`s.mode !== 'run'` → null；`s.microEvents >= MAX_EVENTS_PER_RUN` → null；`cheb(s.player, s.level.targetPos) <= 2` → null；玩家所在格為線索或補給格 → null；`rng() >= EVENT_CHANCE` → null；否則 pickWeighted `[['bird-startle',2],['bonus-supply',2],['old-trail',1]]`：
  - bird-startle / old-trail：`direction = angleDeg(s.player, s.level.targetPos)`；`s.microEvents++`。
  - bonus-supply：找鄰近空格（player 半徑 2 內、非線索/補給/目標格、界內；掃描順序固定由近而遠、同距離依 y→x，**不消耗 rng**）；無空格 → 改回傳 bird-startle（保底）；有 → `s.level.supplies.push(pos); s.microEvents++`。
- 測試：daily 模式恆 null（`newSession(5, rng, 'daily')` 迴圈 200 次 rng 全開也 null）；上限 2；cheb≤2 排除；線索格排除；機率門檻（rng stub 0.5 → null、0.01 → 事件）；bonus-supply 實際加補給且格子合法；bird/old-trail 方位正確；microEvents 累計。
- [ ] Steps: TDD → 全測試＋建置 → Commit `feat: capped mid-hunt micro events with daily-mode exclusion`

---

### Task 10: 微事件 UI（W4）

**Files:**
- Modify: `src/scenes/MapScene.ts`

**Interfaces:**
- doMove 的 tween onComplete 內（redraw 之後、afterMove 之前）：`if (this.tutStep < 0) { const ev = rollMicroEvent(s, this.registry.get('rng') as Rng); if (ev) this.playMicroEvent(ev); }`（教學進行中不觸發；rollMicroEvent 內部已排除 daily）。
- `playMicroEvent(ev)`：
  - bird-startle：玩家位置起、方向 ev.direction ±45° 的一次性錐形（複製 playReveal 的 footprint 容器縮放技法、長度 cs*6、gold 0.25、2500ms 淡出）＋數隻小點沿方向散飛（≤6 顆一次性粒子，caps 邊界內）＋`audio.play('reveal')`＋浮字 `!`（mark 色）。
  - bonus-supply：redraw 已畫出新補給；於該格 floatText `+`（supply 色）＋`audio.play('pickup')` 音量借用（或 reveal——擇一註明）。
  - old-trail：玩家格顯示一次性 footprint 覆蓋（direction、spread 60、playReveal 同技法、5000ms 淡出）＋`audio.play('reveal')`。
- 全部一次性演出、不留互動物件；reduced-motion（motionOK false）時跳過演出但事件效果保留（補給仍生成）。
- [ ] Steps: 實作 → 驗證 → Commit `feat: render micro events with one-shot flourishes`

---

### Task 11: 音效擴充（W5）

**Files:**
- Modify: `src/core/audio.ts`、`tests/audio.test.ts`、`src/scenes/MapScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/QteScene.ts`

**Interfaces:**
- `SfxName` 增 `'iris' | 'bank' | 'push'`；RECIPES 增：`iris { sine, [659, 784, 988], 0.4, 0.15 }`、`bank { sine, [523, 784], 0.25, 0.15 }`、`push { triangle, [440, 554], 0.2, 0.14 }`。
- `ambient(on: boolean, variant?: 'wind' | 'drizzle')`：可選參；wind → 目標增益 0.09（原 0.05）；drizzle → lowpass 1200＋噪音平滑係數改 0.90（雨感）；缺省維持現行。變體切換＝先 stopAmbient 再啟（既有淡出/onended 清理沿用）；`pendingAmbient` 暫存需帶 variant。
- 接線：MapScene create 的 `ambient(true)` 改帶 `s.level.weather === 'wind' ? 'wind' : s.level.weather === 'drizzle' ? 'drizzle' : undefined`；QteScene playEnding success 且 `s.level.iris` → 先 `play('iris')` 再 `play('caught')`；ResultScene bank/push 按鈕 onClick 各加 `play('bank')`/`play('push')`。
- 測試：新音色名 no-throw；ambient 帶 variant 在無 ctx 時 no-op；pendingAmbient 帶 variant 於 unlock 後補放（factory stub 驗證呼叫一次）。
- [ ] Steps: TDD（audio 核心部分）→ 接線 → 全測試＋建置 → Commit `feat: weather ambient variants and iris/bank/push sfx`

---

### Task 12: 最終打磨與驗收（W5）

**Files:**
- Modify: 視 Task 1–11 遺留微調（無新功能）；`README.md`（如有需要）

**驗收步驟:**
- [ ] **Step 1: 全測試** — `npx vitest run` 全 PASS（預期 ~185 上下，以實際為準）
- [ ] **Step 2: 建置** — `npm run build` exit 0
- [ ] **Step 3: 決定性抽查（node 腳本，非測試檔）** — 同一 dateKey 兩次 `createDailySessionFromKey` deep-equal（含 weather/iris）；輸出於報告。
- [ ] **Step 4: 整併三個 Phase 的人工冒煙清單**至報告（Phase1 8 項＋Phase2 清單＋Phase3：天氣徽章與每日卡、異彩揭示與星位、雙卡押注全流程、微事件觸發與每日不觸發、天氣環境聲變體、每日重試同圖）。
- [ ] **Step 5: Commit（如有微調）** — `chore: phase-3 final polish`

---

## Self-Review 紀錄

- **覆蓋**：W0（Task 1–2）、W1（3–4）、W2（5–6）、W3（7–8）、W4（9–10）、W5（11–12）。D11→T3、D12→T5/T6、D13→T7/T8、D14→T9、D15→T1、D16→T4、D17→T3（落地備忘 1）。
- **型別一致**：`Weather`/`applyWeather`（T3）供 T4/T11；`Level.weather/iris`（T3/T5）供 T4/T6/T8/T11；`addRecord` 第三參（T5）供 T6；`ScoreStore`（T7）供 T8；`MicroEvent`/`rollMicroEvent`（T9）供 T10；registry 新鍵 score/lastGain/lastLoss（T8）。
- **既有測試衝擊**：T3 明列 quirk-e2e tolerance 斷言更新；T5 share/codex 測試擴充；其餘性質測試不放寬。
- **防重**：score 變動與 lastGain/lastLoss 皆在 resolved 塊內（T8 明文）；bank/push 為塊外使用者動作、fadeToScene isRunning 防雙擊。
