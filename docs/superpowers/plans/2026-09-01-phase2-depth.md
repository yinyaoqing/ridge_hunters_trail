# Phase 2: 玩法深度×表現力（W0–W6）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作已核准的 `docs/superpowers/specs/2026-09-01-phase2-depth-design.md`（D1–D10 全採建議）：Phase 1 收尾、氛圍層（粒子/postFX/音效）、生物個性、道具＋資訊層、委託板、互動引導、素材管線。

**Architecture:** 延續既有架構：新玩法邏輯（個性修飾、道具、委託、音效狀態、run 持久化）為純 TypeScript 模組（Vitest TDD、可注入 storage/rng/AudioContext）；場景層薄渲染以 build＋冒煙驗證。粒子/postFX 一律帶 Canvas/reduced-motion/低幀降級。工作流順序 W0→W5→W1→W2→W3→W4→W6，每個工作流結束都是可上架版本。

**Tech Stack:** Phaser 3.90（ParticleEmitter、postFX）、TypeScript strict、Vite、Vitest、WebAudio（程序合成，零素材檔）。無新 npm 相依。

## Global Constraints

- 世界觀完全架空原創；嚴禁真實文化符號。無死亡/血腥字眼（escaped/slipped away）。PEGI 3–7。
- 所有玩家可見字串走 `i18n.t()`，en/zh-TW key 平價（既有測試把關）。既有例外：遊戲名、「EN / 中」、`×{n}`、單字符圖標（`?` 慣例，本階段新增 `♪` 同級）。
- 隨機性一律經注入的 `mulberry32`；localStorage 讀寫失敗靜默降級（getItem throw → 回 in-memory `mem`；壞 JSON → 回預設），比照 `codex.ts` 現行寫法。
- **粒子規則（D7 修訂）**：低密度氛圍粒子允許——總量上限寫成常數；`prefers-reduced-motion: reduce` 全停用；fps<40 持續 3 秒自動停用。禁高密度粒子雨。
- **postFX（D8）**：僅 `renderer.type === Phaser.WEBGL` 時啟用；Canvas 沿用現行疊圈畫法（程式已是 fallback，不得刪除）。
- **音效（D9）**：WebAudio 程序合成、零素材檔；首次使用者互動後才建立 AudioContext；HUD 可靜音（`rht.audio.v1` 記憶）。
- **素材（D10）**：`public/assets/` 慣例、缺檔必須無害降級（剪影 fallback 保留）；體積預算：初始 ≤50MB、單生物 sprite ≤64KB。
- 不引入 DOM 疊層（例外：既有 clipboard 暫時 textarea）、不打包字型檔、不做小地圖/自動尋路、不做 FOMO/付費捷徑。
- 數值集中：難度在 `difficulty.ts`；個性修飾集中 `quirks.ts`；粒子上限集中 `fx.ts` 常數；研究度/里程碑在 `codex.ts`。
- 記帳防重：Result 副作用一律在 `if (!s.resolved)` 內（委託判定、道具解鎖同樣適用）。
- Windows/PowerShell 驗證指令；Vite `base: './'` 不動。

## 設計決策落地備忘（來自 D1–D10）

1. **D1 歇腳符**：符不足時**保留剩餘符**、連勝 `floor(n/2)+1`。
2. **D2 run 持久化**：`rht.run.v1` 存 `{round, wins}`；wins（任一模式 caught）供提示自動退場（≥3）。
3. **D3** `MILESTONE_QUIRK = 15`；研究度條上限 8→15。
4. **D4** 風向石＝總收錄 ≥5；微光鈴＝任一 `bestQuality === 'gold'`。
5. **D5/D6** 委託與每日均由日期種子派生；每日套用生物個性（同種子＝同個性）。
6. **風向石資料策略**：`ScentData` 恆帶 `biasDirection`（真實方位 ±30° 抖動、`windBiasNeeded: true`）；持有風向石才**渲染**為 240° 偏心弧。生成純函式不讀 storage，每日公平性由「同關卡、資訊呈現差異」定義。
7. **微光鈴**：`SessionState.bellUsed`＋`useBell(s, rng)` 純函式；UI 一局一次。
8. **個性修飾順序**：`applyQuirk(getDifficulty(round), creatureId)`；地形權重經 `terrainPoolFor(creatureId)`。反向錨定在修飾後執行 → 求解性保證不變。

## File Structure

```
src/core/daily.ts        修改：D1 保留剩餘符                          ← Task 1
src/core/runstate.ts     新增：round/wins 持久化                      ← Task 1
src/scenes/paint.ts      修改：displayFont(locale)、stripBrackets     ← Task 2
src/core/audio.ts        新增：程序合成 SFX＋環境聲＋靜音狀態          ← Task 3
（各場景）               修改：SFX 接線＋♪靜音 chip                   ← Task 4
src/scenes/fx.ts         修改：粒子 helpers＋motionOK＋低幀守衛＋glow  ← Task 5
src/core/quirks.ts       新增：applyQuirk/terrainPoolFor              ← Task 6
src/data/creatures.ts    修改：quirkHints 雙語欄位                    ← Task 6
src/core/generate.ts     修改：generateLevelFor＋quirk 接入＋scent bias← Task 6, 8
src/core/codex.ts        修改：MILESTONE_QUIRK=15                     ← Task 7
src/scenes/CodexScene.ts 修改：研究度條 15＋個性提示列                 ← Task 7
src/core/types.ts        修改：ScentData.biasDirection                ← Task 8
src/core/tools.ts        新增：道具存檔與解鎖判定                     ← Task 8
src/core/session.ts      修改：bellUsed＋useBell                      ← Task 8
src/scenes/MapScene.ts   修改：偏心弧渲染、鈴 chip、U4 資訊層、引導   ← Task 9, 10, 13
src/scenes/ResultScene.ts修改：道具解鎖卡、委託判定顯示、里程碑數學    ← Task 7, 9, 12
src/core/commissions.ts  新增：每日委託生成/判定/存檔                 ← Task 11
src/scenes/CampScene.ts  修改：委託三卡                               ← Task 12
src/scenes/BootScene.ts  修改：可選素材載入（loaderror 容忍）          ← Task 14
docs/ASSETS.md           新增：素材規格與內容審查清單                 ← Task 14
src/core/i18n.ts         修改：各 task 隨用隨加 key（平價測試把關）
tests/…                  對應核心模組測試
```

---

### Task 1: D1 歇腳符放寬＋run 持久化（W0）

**Files:**
- Modify: `src/core/daily.ts`、`tests/daily.test.ts`
- Create: `src/core/runstate.ts`、`tests/runstate.test.ts`
- Modify: `src/main.ts`、`src/scenes/ResultScene.ts`

**Interfaces:**
- Consumes: 既有 `createStreak`、registry `runRound`
- Produces:
  - daily.ts 行為變更：符不足分支不再 `freezes = 0`
  - `createRunState(storage?): RunState`，`interface RunState { round(): number; setRound(n: number): void; wins(): number; addWin(): void }`，key `rht.run.v1`，JSON `{round, wins}`，預設 `{round:1, wins:0}`
  - registry 新鍵 `'runState'`；`'runRound'` 開機自 `runState.round()` 還原
  - ResultScene：caught 時 `runState.addWin()`；run 模式另 `runState.setRound(s.round + 1)`（皆在 resolved 防重塊內）

- [ ] **Step 1: daily.ts 測試調整（失敗先行）**

`tests/daily.test.ts` 追加（並確認既有「without enough freezes」測試的 freezes 斷言——該案例本來就是 0 符，不受影響）：

```typescript
  it('insufficient freezes are kept, streak still halves (D1)', () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 7; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`); // streak 7, freezes 1
    const s = store.recordPlay('2026-08-21'); // 漏 3 天 > 1 符
    expect(s).toMatchObject({ streak: Math.floor(7 / 2) + 1, freezes: 1 });
  });
```

- [ ] **Step 2: 確認失敗** — Run: `npx vitest run tests/daily.test.ts` → 新測試 FAIL（freezes 為 0）

- [ ] **Step 3: 實作** — `daily.ts` 的 else 分支移除 `freezes = 0;`（保留剩餘符），註解改為「符不足：保留剩餘符，連勝減半+1（D1）」

- [ ] **Step 4: 確認通過** — `npx vitest run tests/daily.test.ts` → 全 PASS

- [ ] **Step 5: 寫失敗測試 tests/runstate.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { createRunState } from '../src/core/runstate';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createRunState', () => {
  it('defaults to round 1, zero wins', () => {
    const rs = createRunState(fakeStorage());
    expect(rs.round()).toBe(1);
    expect(rs.wins()).toBe(0);
  });
  it('persists round and wins through storage', () => {
    const storage = fakeStorage();
    const rs = createRunState(storage);
    rs.setRound(4);
    rs.addWin();
    rs.addWin();
    const again = createRunState(storage);
    expect(again.round()).toBe(4);
    expect(again.wins()).toBe(2);
  });
  it('recovers from corrupted data', () => {
    const rs = createRunState(fakeStorage({ 'rht.run.v1': '{{{' }));
    expect(rs.round()).toBe(1);
  });
  it('keeps in-memory state when reads throw after a write', () => {
    let armed = false;
    const rs = createRunState({
      getItem: () => { if (armed) throw new Error('sec'); return null; },
      setItem: () => { armed = true; },
    });
    rs.setRound(3);
    expect(rs.round()).toBe(3);
  });
  it('works without storage', () => {
    const rs = createRunState();
    rs.addWin();
    expect(rs.wins()).toBe(1);
  });
});
```

- [ ] **Step 6: 確認失敗** — `npx vitest run tests/runstate.test.ts` → 模組不存在

- [ ] **Step 7: 實作 src/core/runstate.ts**（load/save 結構與 `codex.ts` 相同：getItem throw → 回 `mem`；壞 JSON/形狀 → 預設）

```typescript
export interface RunState {
  round(): number;
  setRound(n: number): void;
  wins(): number;
  addWin(): void;
}

const KEY = 'rht.run.v1';
interface Data { round: number; wins: number }
const DEFAULTS: Data = { round: 1, wins: 0 };

export function createRunState(storage?: Pick<Storage, 'getItem' | 'setItem'>): RunState {
  let mem: Data = { ...DEFAULTS };

  const load = (): Data => {
    if (!storage) return mem;
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return mem; // 讀取失敗：退回記憶體備援
    }
    if (raw === null) return { ...DEFAULTS };
    try {
      const p = JSON.parse(raw);
      return p && typeof p.round === 'number' && typeof p.wins === 'number' ? p : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
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
    round: () => load().round,
    setRound: (n) => save({ ...load(), round: n }),
    wins: () => load().wins,
    addWin: () => { const d = load(); save({ ...d, wins: d.wins + 1 }); },
  };
}
```

- [ ] **Step 8: 確認通過** — `npx vitest run tests/runstate.test.ts` → PASS

- [ ] **Step 9: 接線**

`main.ts` preBoot（import `createRunState`）：

```typescript
        const runState = createRunState(storage);
        game.registry.set('runState', runState);
        game.registry.set('runRound', runState.round());
```

（原 `game.registry.set('runRound', 1)` 移除。）

`ResultScene.ts` resolved 防重塊內（caught 分支）：

```typescript
        const runState = this.registry.get('runState') as RunState;
        runState.addWin();
        if (s.mode === 'run') {
          this.registry.set('runRound', s.round + 1);
          runState.setRound(s.round + 1);
        }
```

（import `type RunState`；原 `registry.set('runRound', ...)` 行併入。）

- [ ] **Step 10: 全測試＋建置** — `npx vitest run` 全 PASS；`npm run build` exit 0

- [ ] **Step 11: Commit**

```powershell
git add src/core/daily.ts src/core/runstate.ts src/main.ts src/scenes/ResultScene.ts tests/daily.test.ts tests/runstate.test.ts
git commit -m "feat: gentler freeze rule and persistent run progress with win counter"
```

---

### Task 2: 中文展示字體與 stripBrackets 統一（W0）

**Files:**
- Modify: `src/scenes/paint.ts`、`src/scenes/CampScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CodexScene.ts`、`src/scenes/MapScene.ts`、`src/scenes/QteScene.ts`、`src/scenes/HelpScene.ts`

**Interfaces:**
- Produces:
  - `paint.ts`：`FONTS.displayZh = '"Noto Serif TC", "MingLiU", "Microsoft JhengHei", serif'`；`displayFont(locale: Locale): string`（zh-TW → displayZh，否則 display）；`export const stripBrackets = (s: string) => s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');`
- 場景整合：所有「展示字」標題（Map roundText、Qte 標題、Result 標題、Codex 標題、Help 標題、Codex 行名稱、Camp 遊戲名**除外**——拉丁遊戲名固定用 `FONTS.display`）改 `displayFont(i18n.locale())`；Camp/Result 刪本地 `stripBrackets`、Codex 行內 regex 改用共用版。

- [ ] **Step 1: paint.ts 實作**（`Fonts` interface 加 `displayZh`；新增 `displayFont`、`stripBrackets`；import `type Locale` from '../core/types'）
- [ ] **Step 2: 各場景替換**（逐一：texts 的 `fontFamily: FONTS.display` → `displayFont(loc)`，該場景已有 i18n/loc 變數；語言切換後場景各自 restart/redraw 既有機制會重建文字）
- [ ] **Step 3: 驗證** — `npx vitest run` 全 PASS（無核心變更）；`npm run build` exit 0；冒煙（交人類）：zh-TW 標題呈現襯線感
- [ ] **Step 4: Commit**

```powershell
git add src/scenes/paint.ts src/scenes/CampScene.ts src/scenes/ResultScene.ts src/scenes/CodexScene.ts src/scenes/MapScene.ts src/scenes/QteScene.ts src/scenes/HelpScene.ts
git commit -m "feat: locale-aware display font and shared stripBrackets helper"
```

---

### Task 3: 音效核心模組（W5）

**Files:**
- Create: `src/core/audio.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Produces:
  - `type SfxName = 'click' | 'reveal' | 'pickup' | 'hit' | 'miss' | 'caught' | 'escaped'`
  - `interface AudioBus { enabled(): boolean; toggle(): boolean; play(name: SfxName): void; ambient(on: boolean): void }`
  - `createAudio(storage?: Pick<Storage,'getItem'|'setItem'>, ctxFactory?: () => AudioContext): AudioBus`
  - 行為：預設 enabled=true；狀態存 `rht.audio.v1`（'0'/'1'）；`play`/`ambient` 在 disabled 或 ctxFactory 缺席/throw 時**靜默 no-op**；AudioContext 於首次 play/ambient 時才建立（lazy）；`toggle()` 回傳新狀態並在關閉時停掉 ambient。

- [ ] **Step 1: 寫失敗測試 tests/audio.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { createAudio } from '../src/core/audio';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createAudio', () => {
  it('defaults enabled; toggle flips and persists', () => {
    const storage = fakeStorage();
    const a = createAudio(storage);
    expect(a.enabled()).toBe(true);
    expect(a.toggle()).toBe(false);
    expect(createAudio(storage).enabled()).toBe(false);
  });
  it('play/ambient are silent no-ops without a context factory', () => {
    const a = createAudio(fakeStorage());
    expect(() => { a.play('hit'); a.ambient(true); a.ambient(false); }).not.toThrow();
  });
  it('does not create context until first play, and not when disabled', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    expect(created).toBe(0);
    a.toggle(); // off
    a.play('click');
    expect(created).toBe(0); // disabled 不建立
    a.toggle(); // on
    a.play('click'); // factory throw 也要被吞掉
    expect(created).toBe(1);
    a.play('click');
    expect(created).toBe(1); // 失敗後不重試轟炸（記憶失敗）
  });
  it('ignores corrupted stored flag', () => {
    expect(createAudio(fakeStorage({ 'rht.audio.v1': 'xx' })).enabled()).toBe(true);
  });
});
```

- [ ] **Step 2: 確認失敗** — `npx vitest run tests/audio.test.ts`

- [ ] **Step 3: 實作 src/core/audio.ts**

```typescript
// 程序合成音效：零素材檔。所有失敗（無 AudioContext、被瀏覽器擋）一律靜默。
export type SfxName = 'click' | 'reveal' | 'pickup' | 'hit' | 'miss' | 'caught' | 'escaped';

export interface AudioBus {
  enabled(): boolean;
  toggle(): boolean;
  play(name: SfxName): void;
  ambient(on: boolean): void;
}

const KEY = 'rht.audio.v1';

// 各音色配方：type/頻率序列/時值。集中一處便於調音。
const RECIPES: Record<SfxName, { type: OscillatorType; freqs: number[]; dur: number; gain: number }> = {
  click:   { type: 'sine',     freqs: [800],            dur: 0.05, gain: 0.12 },
  reveal:  { type: 'sine',     freqs: [520, 880],       dur: 0.22, gain: 0.15 },
  pickup:  { type: 'sine',     freqs: [660, 990],       dur: 0.16, gain: 0.15 },
  hit:     { type: 'triangle', freqs: [880],            dur: 0.09, gain: 0.18 },
  miss:    { type: 'square',   freqs: [180],            dur: 0.12, gain: 0.10 },
  caught:  { type: 'sine',     freqs: [523, 659, 784],  dur: 0.34, gain: 0.16 },
  escaped: { type: 'sine',     freqs: [440, 220],       dur: 0.40, gain: 0.12 },
};

export function createAudio(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
  ctxFactory?: () => AudioContext,
): AudioBus {
  let on = true;
  if (storage) {
    try {
      const saved = storage.getItem(KEY);
      if (saved === '0' || saved === '1') on = saved === '1';
    } catch { /* 沿用預設 */ }
  }
  let ctx: AudioContext | null = null;
  let ctxFailed = false;
  let windGain: GainNode | null = null;

  const persist = () => {
    if (!storage) return;
    try { storage.setItem(KEY, on ? '1' : '0'); } catch { /* 靜默 */ }
  };

  const getCtx = (): AudioContext | null => {
    if (ctx) return ctx;
    if (ctxFailed || !ctxFactory) return null;
    try {
      ctx = ctxFactory();
      return ctx;
    } catch {
      ctxFailed = true; // 記憶失敗，不重試轟炸
      return null;
    }
  };

  const stopAmbient = () => {
    if (windGain && ctx) {
      try { windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); } catch { /* 靜默 */ }
      windGain = null;
    }
  };

  return {
    enabled: () => on,
    toggle() {
      on = !on;
      if (!on) stopAmbient();
      persist();
      return on;
    },
    play(name) {
      if (!on) return;
      const c = getCtx();
      if (!c) return;
      try {
        const r = RECIPES[name];
        const t0 = c.currentTime;
        const g = c.createGain();
        g.gain.setValueAtTime(r.gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + r.dur);
        g.connect(c.destination);
        const step = r.dur / r.freqs.length;
        r.freqs.forEach((f, i) => {
          const o = c.createOscillator();
          o.type = r.type;
          o.frequency.setValueAtTime(f, t0 + i * step);
          o.connect(g);
          o.start(t0 + i * step);
          o.stop(t0 + r.dur + 0.02);
        });
      } catch { /* 靜默 */ }
    },
    ambient(onOff) {
      if (!onOff) { stopAmbient(); return; }
      if (!on || windGain) return;
      const c = getCtx();
      if (!c) return;
      try {
        // 風聲：2 秒白噪音 buffer 循環 + lowpass + 微弱增益
        const len = c.sampleRate * 2;
        const buf = c.createBuffer(1, len, c.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // 平滑化噪音（風感）
          data[i] = last * 6;
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 400;
        windGain = c.createGain();
        windGain.gain.setValueAtTime(0, c.currentTime);
        windGain.gain.setTargetAtTime(0.05, c.currentTime, 0.8);
        src.connect(lp).connect(windGain).connect(c.destination);
        src.start();
      } catch { windGain = null; }
    },
  };
}
```

（`Math.random` 僅用於噪音波形——非遊戲邏輯隨機性，不受種子 RNG 約束；註明於註解。）

- [ ] **Step 4: 確認通過** — `npx vitest run tests/audio.test.ts` → PASS
- [ ] **Step 5: Commit**

```powershell
git add src/core/audio.ts tests/audio.test.ts
git commit -m "feat: procedurally synthesized audio bus with mute persistence"
```

---

### Task 4: 音效接線與靜音 chip（W5）

**Files:**
- Modify: `src/main.ts`、`src/scenes/MapScene.ts`、`src/scenes/QteScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CampScene.ts`

**Interfaces:**
- Consumes: `createAudio`/`AudioBus`（Task 3）
- Produces: registry `'audio'`; 播放點——按鈕 pointerup=`click`、線索揭示=`reveal`、補給=`pickup`、QTE lastHit=`hit`/`miss`、playEnding=`caught`/`escaped`；`ambient(true)` 於 Camp/Map create（enabled 時）、Qte/Result create 時 `ambient(false)`；Camp 工具列與 Map chip 列各加 `♪` 靜音切換（開=金色、關=暗色斜線），44px 命中區。

- [ ] **Step 1: main.ts** — preBoot：`game.registry.set('audio', createAudio(storage, () => new AudioContext()));`（`window.AudioContext` 缺席環境由 createAudio 靜默處理——factory 內 throw 即可；用 `() => new (window.AudioContext || (window as any).webkitAudioContext)()`）
- [ ] **Step 2: 播放點接線**（各場景 `const audio = this.registry.get('audio') as AudioBus;`）：
  - MapScene `doMove` onComplete：`gotSupply` 時 `audio.play('pickup')`；`playReveal` 呼叫處 `audio.play('reveal')`。
  - QteScene `onPress`：flash 分支 `audio.play('hit')`、shake 分支 `audio.play('miss')`；`playEnding`：success→`caught`、else→`escaped`；create 時 `audio.ambient(false)`。
  - Result create：`audio.ambient(false)`；按鈕 helper 的 pointerup 內 `audio.play('click')`（Camp/Result 兩處 button helper 都加）。
  - Camp/Map create 尾端：`audio.ambient(true)`。
- [ ] **Step 3: ♪ chip** — Map：chip 列左移一格新增（沿 `xMark` 左側 `xSound = xMark - 8 - 32`，樣式同 `?` chip、寬 32），點擊 `audio.toggle()` 後重繪自身（開：金色 `♪`；關：`paperDim` 色 `♪`＋斜線）；`markChip` 模式的既有重繪函式擴充或並列 `drawSoundChip`。Camp：工具列 `?`/`EN / 中` 旁同型 44px 鈕。皆 `stopPropagation`。
- [ ] **Step 4: 驗證** — `npx vitest run` 全 PASS、`npm run build` exit 0；冒煙（人類）：音量小、靜音記憶、iOS 首次點擊後才出聲。
- [ ] **Step 5: Commit**

```powershell
git add src/main.ts src/scenes/MapScene.ts src/scenes/QteScene.ts src/scenes/ResultScene.ts src/scenes/CampScene.ts
git commit -m "feat: wire synthesized sfx and ambient wind with mute chips"
```

---

### Task 5: 氛圍粒子與 postFX glow（W5）

**Files:**
- Modify: `src/scenes/fx.ts`、`src/scenes/MapScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CampScene.ts`、`src/scenes/QteScene.ts`

**Interfaces:**
- Produces（fx.ts）：
  - `export const PARTICLE_CAPS = { mist: 20, spore: 30, ember: 8 } as const;`
  - `motionOK(): boolean`（`matchMedia('(prefers-reduced-motion: reduce)')` 不 match；API 缺席→true；try/catch）
  - `ensureDotTexture(scene, key: string, color: number, radius: number): void`（graphics.generateTexture，存在即跳過）
  - `guardLowFps(scene, emitter): void`（create 後 3 秒檢查 `scene.game.loop.actualFps < 40` → `emitter.stop(); emitter.setVisible(false);`）
  - `addGlowIfWebGL(scene, obj, color: number): void`（`scene.game.renderer.type === Phaser.WEBGL` 才 `obj.postFX?.addGlow(color, 4, 0)`；try/catch）
- 場景：Map 霧粒子（mist 格抽樣 ≤12 個發射點、alive ≤ mist cap、緩慢上飄大顆低透明）；Result caught 一次性孢子（`explode`）；Camp 營火火星 emitter（≤ ember cap）；Qte 弧 Graphics 與剪影、Result 肖像剪影 `addGlowIfWebGL`。全部先過 `motionOK()`，emitter 建立後掛 `guardLowFps`。

- [ ] **Step 1: fx.ts helpers**（依上述簽名；Phaser 3.60+ API：`scene.add.particles(x, y, textureKey, config)` 回傳 emitter GameObject）

```typescript
export const PARTICLE_CAPS = { mist: 20, spore: 30, ember: 8 } as const;

export function motionOK(): boolean {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export function ensureDotTexture(scene: Phaser.Scene, key: string, color: number, radius: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(color, 1).fillCircle(radius, radius, radius);
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
}

export function guardLowFps(scene: Phaser.Scene, emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
  scene.time.delayedCall(3000, () => {
    if (scene.game.loop.actualFps < 40) {
      emitter.stop();
      emitter.setVisible(false);
    }
  });
}

export function addGlowIfWebGL(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject & { postFX?: Phaser.GameObjects.Components.FX }, color: number): void {
  try {
    if (scene.game.renderer.type === Phaser.WEBGL) obj.postFX?.addGlow(color, 4, 0);
  } catch { /* 舊環境靜默 */ }
}
```

- [ ] **Step 2: MapScene 霧粒子** — `buildBackground` 後：`if (motionOK())` 抽 ≤12 個 mist 格中心為 `emitZone`（`Phaser.Geom.Rectangle` 隨機挑格亦可），單一 emitter：texture `dot-mist`（`ensureDotTexture(this, 'dot-mist', 0xcfe0da, 12)`）、`{ quantity: 1, frequency: 900, lifespan: 4000, alpha: { start: 0.08, end: 0 }, scale: { start: 1.4, end: 2.2 }, speedY: { min: -6, max: -2 }, maxAliveParticles: PARTICLE_CAPS.mist }`；掛 `guardLowFps`。
- [ ] **Step 3: Result 孢子** — `drawCreaturePortrait` 尾端：`if (motionOK())` `ensureDotTexture('dot-spore', creature 色, 4)` → emitter at 肖像座標 `{ lifespan: 1800, speedY: { min: 20, max: 60 }, speedX: { min: -30, max: 30 }, alpha: { start: 0.9, end: 0 }, scale: { start: 1, end: 0.4 }, emitting: false }` → `emitter.explode(PARTICLE_CAPS.spore)`。
- [ ] **Step 4: Camp 火星** — `drawRidges` 營火處：`if (motionOK())` `dot-ember`（0xe8b06a, 3）emitter `{ frequency: 400, lifespan: 1400, speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 }, alpha: { start: 0.8, end: 0 }, maxAliveParticles: PARTICLE_CAPS.ember }`＋`guardLowFps`。
- [ ] **Step 5: glow** — QteScene create：`addGlowIfWebGL(this, this.g, this.pal.gold)`、剪影存在時對 `this.sil` 用 `this.pal.glow`；ResultScene 肖像剪影同理。疊圈畫法一行都不刪（Canvas fallback）。
- [ ] **Step 6: 驗證** — `npx vitest run` 全 PASS、`npm run build` exit 0；冒煙（人類）：霧飄極淡不搶戲、fps 無感、reduced-motion 模擬下全無粒子。
- [ ] **Step 7: Commit**

```powershell
git add src/scenes/fx.ts src/scenes/MapScene.ts src/scenes/ResultScene.ts src/scenes/CampScene.ts src/scenes/QteScene.ts
git commit -m "feat: low-density ambient particles and WebGL glow with graceful degradation"
```

---

### Task 6: 生物個性核心（W1）

**Files:**
- Create: `src/core/quirks.ts`、`tests/quirks.test.ts`
- Modify: `src/data/creatures.ts`、`tests/creatures.test.ts`、`src/core/generate.ts`、`tests/generate.test.ts`

**Interfaces:**
- Consumes: `DifficultyParams`、`TERRAIN_POOL` 語意、`CREATURES`
- Produces:
  - `applyQuirk(p: DifficultyParams, creatureId: string): DifficultyParams`（回傳修改副本；未知 id 原樣）
  - `terrainPoolFor(creatureId: string): [TerrainType, number][]`（基底 meadow5/mist2/thicket2/rock1；ridgecrest rock ×3）
  - `Creature.quirkHints: Record<Locale, string>`（8 種雙語提示文，內容邊界同規格 §2）
  - `generateLevelFor(round: number, rng: Rng, creatureId: string): Level`（generateLevel 抽生物後委派；匯出供測試）
  - 個性表（唯一資料來源在 quirks.ts，逐字實作）：

| id | 修飾 |
|---|---|
| mistfawn | `scentTolerance ×2` |
| emberquill | `disturbanceRadius = max(1, r-1)` |
| thicketloom | `footprintSpread = max(6, round(spread/2))` |
| dewhopper | `supplyCount +2` |
| veilmoth | `decoyCount > 0 時 +1` |
| lanternshrew | `minClueDist = max(2, min-1)`、`maxClueDist = max(4, max-2)` |
| ridgecrest | terrainPool rock 權重 ×3 |
| plumetail | `minClueDist +1`、`maxClueDist +2` |

- [ ] **Step 1: 寫失敗測試 tests/quirks.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { applyQuirk, terrainPoolFor } from '../src/core/quirks';
import { getDifficulty } from '../src/core/difficulty';
import { CREATURES } from '../src/data/creatures';

describe('applyQuirk', () => {
  const base = getDifficulty(5); // tier 2：有 decoy
  it('mistfawn doubles scent tolerance', () => {
    expect(applyQuirk(base, 'mistfawn').scentTolerance).toBe(base.scentTolerance * 2);
  });
  it('emberquill shrinks disturbance radius with floor 1', () => {
    expect(applyQuirk(base, 'emberquill').disturbanceRadius).toBe(Math.max(1, base.disturbanceRadius - 1));
  });
  it('thicketloom halves footprint spread with floor 6', () => {
    expect(applyQuirk(base, 'thicketloom').footprintSpread).toBe(Math.max(6, Math.round(base.footprintSpread / 2)));
  });
  it('dewhopper adds two supplies', () => {
    expect(applyQuirk(base, 'dewhopper').supplyCount).toBe(base.supplyCount + 2);
  });
  it('veilmoth adds a decoy only when decoys exist', () => {
    expect(applyQuirk(base, 'veilmoth').decoyCount).toBe(base.decoyCount + 1);
    const t1 = getDifficulty(1);
    expect(applyQuirk(t1, 'veilmoth').decoyCount).toBe(0);
  });
  it('lanternshrew tightens clue distance with floors', () => {
    const q = applyQuirk(base, 'lanternshrew');
    expect(q.minClueDist).toBe(Math.max(2, base.minClueDist - 1));
    expect(q.maxClueDist).toBe(Math.max(4, base.maxClueDist - 2));
  });
  it('plumetail widens clue distance', () => {
    const q = applyQuirk(base, 'plumetail');
    expect(q.minClueDist).toBe(base.minClueDist + 1);
    expect(q.maxClueDist).toBe(base.maxClueDist + 2);
  });
  it('unknown id and ridgecrest leave params unchanged', () => {
    expect(applyQuirk(base, 'nobody')).toEqual(base);
    expect(applyQuirk(base, 'ridgecrest')).toEqual(base);
  });
  it('never mutates the input', () => {
    const before = JSON.stringify(base);
    applyQuirk(base, 'mistfawn');
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('terrainPoolFor', () => {
  it('ridgecrest triples rock weight; others use the base pool', () => {
    const rock = (pool: [string, number][]) => pool.find(([t]) => t === 'rock')![1];
    expect(rock(terrainPoolFor('ridgecrest'))).toBe(3);
    expect(rock(terrainPoolFor('mistfawn'))).toBe(1);
  });
});

describe('quirk hints', () => {
  it('every creature has bilingual quirk hints', () => {
    for (const c of CREATURES) {
      expect(c.quirkHints.en.length).toBeGreaterThan(0);
      expect(c.quirkHints['zh-TW'].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 確認失敗** — `npx vitest run tests/quirks.test.ts`

- [ ] **Step 3: 實作 src/core/quirks.ts**

```typescript
import type { DifficultyParams } from './difficulty';
import type { TerrainType } from './types';

// 生物「判讀個性」唯一資料來源（設計提案 §2 W1 個性表）。
// 只調生成參數，不改線索語意——反向錨定在修飾後執行，求解性不變。
export function applyQuirk(p: DifficultyParams, creatureId: string): DifficultyParams {
  const q: DifficultyParams = { ...p, typeRatio: { ...p.typeRatio }, qte: { ...p.qte } };
  switch (creatureId) {
    case 'mistfawn':
      q.scentTolerance = p.scentTolerance * 2;
      break;
    case 'emberquill':
      q.disturbanceRadius = Math.max(1, p.disturbanceRadius - 1);
      break;
    case 'thicketloom':
      q.footprintSpread = Math.max(6, Math.round(p.footprintSpread / 2));
      break;
    case 'dewhopper':
      q.supplyCount = p.supplyCount + 2;
      break;
    case 'veilmoth':
      if (p.decoyCount > 0) q.decoyCount = p.decoyCount + 1;
      break;
    case 'lanternshrew':
      q.minClueDist = Math.max(2, p.minClueDist - 1);
      q.maxClueDist = Math.max(4, p.maxClueDist - 2);
      break;
    case 'plumetail':
      q.minClueDist = p.minClueDist + 1;
      q.maxClueDist = p.maxClueDist + 2;
      break;
  }
  return q;
}

const BASE_POOL: [TerrainType, number][] = [
  ['meadow', 5], ['mist', 2], ['thicket', 2], ['rock', 1],
];

export function terrainPoolFor(creatureId: string): [TerrainType, number][] {
  if (creatureId === 'ridgecrest') {
    return BASE_POOL.map(([t, w]) => [t, t === 'rock' ? w * 3 : w]);
  }
  return BASE_POOL.map(([t, w]) => [t, w]);
}
```

- [ ] **Step 4: creatures.ts 加 quirkHints**（`Creature` interface 加 `quirkHints: Record<Locale, string>`；八種各一句雙語，內容示例——逐字採用）：

```
mistfawn    en 'Its scent hangs wide and faint — read the ring loosely.'          zh '氣味淡薄而散，環帶要放寬著讀。'
emberquill  en 'A careful walker; its disturbances are unusually tight.'          zh '行走謹慎，擾動範圍格外收斂。'
thicketloom en 'Flies dead straight — footprint cones point true.'                zh '直線飛行，足跡錐指向格外精確。'
dewhopper   en 'Dew gathers where it passes; supplies are plentiful.'             zh '所經之處露水豐沛，補給更多。'
veilmoth    en 'Its scales confuse the senses — expect an extra false trail.'     zh '鱗粉迷惑感官，會多一條假蹤跡。'
lanternshrew en 'Never wanders far; its traces sit close together.'               zh '不走遠路，蹤跡彼此相近。'
ridgecrest  en 'Rocky ground spreads wherever it roams.'                          zh '牠漫遊的山域，岩坡格外遍布。'
plumetail   en 'Spores drift far on the wind; traces sit farther out.'            zh '孢子隨風飄遠，蹤跡落在更遠處。'
```

`tests/creatures.test.ts` 的雙語欄位測試比照 names/descs 加 quirkHints 斷言（quirks.test.ts 已覆蓋，creatures 測試僅補一致性——擇一即可，避免重複則略過此步）。

- [ ] **Step 5: generate.ts 接入**

```typescript
import { applyQuirk, terrainPoolFor } from './quirks';

export function generateLevelFor(round: number, rng: Rng, creatureId: string): Level {
  const p = applyQuirk(getDifficulty(round), creatureId);
  // …原 generateLevel 本體全部搬入，差異：
  //  - creature 由 id 查表：const creature = CREATURES.find((c) => c.id === creatureId)!;
  //  - 地形 pickWeighted 改用 terrainPoolFor(creatureId)（TERRAIN_POOL 常數移除，語意併入 quirks）
}

export function generateLevel(round: number, rng: Rng): Level {
  const creature = CREATURES[randInt(rng, 0, CREATURES.length - 1)];
  return generateLevelFor(round, rng, creature.id);
}
```

**注意 rng 消耗順序**：抽生物在最前（與現行相同——現行第 57 行先抽 creature 再 targetPos），同種子重現性測試維持通過。

- [ ] **Step 6: 更新 tests/generate.test.ts** — 兩處斷言改為以 quirk 後參數為準：

```typescript
      const pq = applyQuirk(p, level.creatureId);
      expect(decoys.length).toBe(pq.decoyCount);
      // …
      expect(level.supplies.length).toBeLessThanOrEqual(pq.supplyCount);
```

（import `applyQuirk`；其餘性質測試——可解性、交集收斂、同種子重現——不改動且必須續過。）

追加 quirk 效果的端到端測試：

```typescript
  it('generateLevelFor applies creature quirks end-to-end', () => {
    const a = generateLevelFor(5, mulberry32(7), 'dewhopper');
    const b = generateLevelFor(5, mulberry32(7), 'mistfawn');
    expect(a.supplies.length).toBeLessThanOrEqual(getDifficulty(5).supplyCount + 2);
    const scent = b.clues.find((c) => c.type === 'scent' && !c.isDecoy);
    if (scent && scent.type === 'scent') {
      expect(scent.data.tolerance).toBe(getDifficulty(5).scentTolerance * 2);
    }
  });
```

- [ ] **Step 7: 全測試** — `npx vitest run` 全 PASS（性質測試 200 種子 × quirk 仍需可解）
- [ ] **Step 8: 建置** — `npm run build` exit 0
- [ ] **Step 9: Commit**

```powershell
git add src/core/quirks.ts src/data/creatures.ts src/core/generate.ts tests/quirks.test.ts tests/creatures.test.ts tests/generate.test.ts
git commit -m "feat: per-creature clue quirks with bilingual hints, solvability preserved"
```

---

### Task 7: 研究度第三里程碑與圖鑑個性提示（W1）

**Files:**
- Modify: `src/core/codex.ts`、`tests/codex.test.ts`、`src/core/i18n.ts`、`src/scenes/CodexScene.ts`、`src/scenes/ResultScene.ts`

**Interfaces:**
- Produces:
  - `export const MILESTONE_QUIRK = 15;`（codex.ts；測試：`MILESTONE_DETAIL < MILESTONE_QUIRK`）
  - i18n key `codex.quirk`：en `'Field instinct'`／zh `'判讀心得'`
  - CodexScene：研究度條滿檔改 `MILESTONE_QUIRK`，刻度兩道（3/15、8/15 比例處）；`research >= MILESTONE_QUIRK` 時行內顯示 `codex.quirk`＋`c.quirkHints[loc]`（金色小字，desc 下一行；行高足夠——ROW_H 84 內排得下 10px 字，若擠改 ROW_H 96 並同步捲動計算）
  - ResultScene `showNotesDrop` 下一里程碑數學改三段：`research >= 15 → 15`、`>= 8 → 15`、`>= 3 → 8`、否則 `3`

- [ ] **Step 1: codex 測試追加**（`MILESTONE_QUIRK` 匯出＋排序斷言）→ 確認失敗 → 實作一行 → 通過
- [ ] **Step 2: i18n key**（兩語系，平價測試把關）
- [ ] **Step 3: CodexScene**（條上限/雙刻度/提示列）；**Step 4: ResultScene 里程碑數學**（改為 `const next = e.research >= MILESTONE_QUIRK ? MILESTONE_QUIRK : e.research >= MILESTONE_DETAIL ? MILESTONE_QUIRK : e.research >= MILESTONE_NAME ? MILESTONE_DETAIL : MILESTONE_NAME;` 並 import MILESTONE_QUIRK）
- [ ] **Step 5: 驗證** — `npx vitest run` 全 PASS、`npm run build` exit 0；冒煙（人類）：研究度 15 的生物顯示提示
- [ ] **Step 6: Commit**

```powershell
git add src/core/codex.ts tests/codex.test.ts src/core/i18n.ts src/scenes/CodexScene.ts src/scenes/ResultScene.ts
git commit -m "feat: third research milestone reveals creature quirk hints in codex"
```

---

### Task 8: 氣味方向偏移、道具存檔與微光鈴核心（W2）

**Files:**
- Modify: `src/core/types.ts`、`src/core/generate.ts`、`tests/generate.test.ts`、`tests/clues.test.ts`、`src/core/session.ts`、`tests/session.test.ts`
- Create: `src/core/tools.ts`、`tests/tools.test.ts`

**Interfaces:**
- Produces:
  - `ScentData` 增 `biasDirection: number`（0–360；生成時＝`angleDeg(cluePos, anchor)` ± ≤30° 抖動，`windBiasNeeded: true`）。`candidates()` 語意**不變**（bias 是呈現層提示，非約束）。
  - `type ToolId = 'windstone' | 'glowbell'`
  - `interface ToolStore { has(id: ToolId): boolean; syncUnlocks(codex: CodexStore): ToolId[] }`（回傳**本次新解鎖**清單並持久化；windstone：`Σ entry.count >= 5`；glowbell：任一 `bestQuality === 'gold'`；key `rht.tools.v1`）
  - `createTools(storage?): ToolStore`
  - `SessionState.bellUsed: boolean`（newSession 初始 false）；`useBell(s: SessionState, rng: Rng): Vec2 | null`（未用過且存在 decoy 時：隨機選一 decoy、`s.marks.add(key(pos))`、`bellUsed = true`、回傳位置；否則 null）

- [ ] **Step 1: 失敗測試**

`tests/tools.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { createTools } from '../src/core/tools';
import { createCodex } from '../src/core/codex';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createTools', () => {
  it('starts with nothing; unlocks windstone at 5 total records', () => {
    const tools = createTools(fakeStorage());
    const codex = createCodex(fakeStorage());
    for (let i = 0; i < 5; i++) codex.addRecord('mistfawn', 'bronze');
    expect(tools.has('windstone')).toBe(false);
    expect(tools.syncUnlocks(codex)).toEqual(['windstone']);
    expect(tools.has('windstone')).toBe(true);
    expect(tools.syncUnlocks(codex)).toEqual([]); // 已解鎖不重報
  });
  it('unlocks glowbell on any gold record', () => {
    const tools = createTools(fakeStorage());
    const codex = createCodex(fakeStorage());
    codex.addRecord('veilmoth', 'gold');
    expect(tools.syncUnlocks(codex)).toEqual(['glowbell']);
  });
  it('persists and survives corruption', () => {
    const storage = fakeStorage();
    const codex = createCodex(fakeStorage());
    codex.addRecord('veilmoth', 'gold');
    createTools(storage).syncUnlocks(codex);
    expect(createTools(storage).has('glowbell')).toBe(true);
    expect(createTools(fakeStorage({ 'rht.tools.v1': '{{{' })).has('windstone')).toBe(false);
  });
});
```

`tests/session.test.ts` 追加：

```typescript
describe('useBell', () => {
  it('marks one decoy once per session', () => {
    const s = newSession(5, mulberry32(11)); // tier2 必有 decoy（含 quirk 可能 +1）
    const decoys = s.level.clues.filter((c) => c.isDecoy);
    if (decoys.length === 0) return; // veilmoth 以外一定 >0；防禦性跳過
    const pos = useBell(s, mulberry32(1));
    expect(pos).not.toBeNull();
    expect(s.bellUsed).toBe(true);
    expect(s.marks.has(key(pos!))).toBe(true);
    expect(useBell(s, mulberry32(2))).toBeNull(); // 一局一次
  });
  it('returns null when no decoys exist', () => {
    const s = newSession(1, mulberry32(3)); // tier1 無 decoy
    expect(useBell(s, mulberry32(1))).toBeNull();
    expect(s.bellUsed).toBe(false);
  });
});
```

（session 測試檔需 import `useBell`、`key`。）

`tests/generate.test.ts` 追加：

```typescript
  it('scent clues carry a bias within 30° of the true bearing', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues) {
        if (c.type !== 'scent') continue;
        expect(c.data.windBiasNeeded).toBe(true);
        expect(c.data.biasDirection).toBeGreaterThanOrEqual(0);
        expect(c.data.biasDirection).toBeLessThan(360);
      }
    }
  });
```

（真實方位斷言在 makeClue 層不可直接取 anchor——以「0–360 有值」為性質斷言；±30° 由實作程式碼審查把關並加一個定向單元：對 `generateLevelFor(5, mulberry32(1), 'mistfawn')` 取真線索 scent，`angleDiff(bias, angleDeg(cluePos, level.targetPos)) <= 30`。）

- [ ] **Step 2: 確認失敗**（tools 模組不存在、ScentData 型別錯誤——`tests/clues.test.ts` 的 scent helper 需同步補 `biasDirection: 0`）

- [ ] **Step 3: 實作**

`types.ts`：`ScentData` 加 `biasDirection: number  // 目標方位提示（±30°），風向石持有時渲染為偏心弧`。

`generate.ts` makeClue scent 分支：

```typescript
    case 'scent': {
      const bias = (angleDeg(pos, anchor) + (rng() * 60 - 30) + 360) % 360;
      return { type, position: pos, isDecoy, data: { distance: Math.round(actual), tolerance: p.scentTolerance, windBiasNeeded: true, biasDirection: bias } };
    }
```

（**rng 消耗點新增**——同種子重現測試仍過，因兩次生成消耗序一致；既有 `windBiasNeeded: false` 斷言若存在需同步更新。）

`session.ts`：欄位＋

```typescript
export function useBell(s: SessionState, rng: Rng): Vec2 | null {
  if (s.bellUsed) return null;
  const decoys = s.level.clues.filter((c) => c.isDecoy);
  if (decoys.length === 0) return null;
  const pick = decoys[Math.floor(rng() * decoys.length)];
  s.marks.add(key(pick.position));
  s.bellUsed = true;
  return pick.position;
}
```

`tools.ts`：load/save 結構比照 runstate（getItem throw → mem；壞 JSON → `{}`）；`syncUnlocks` 計算條件、diff 已存、存檔、回傳新增清單。

- [ ] **Step 4: 全測試＋建置** — `npx vitest run` 全 PASS、`npm run build` exit 0（HelpScene 若引用 scent 物件建構亦同步補欄位——以編譯錯誤為準修）
- [ ] **Step 5: Commit**

```powershell
git add src/core/types.ts src/core/generate.ts src/core/session.ts src/core/tools.ts tests/tools.test.ts tests/session.test.ts tests/generate.test.ts tests/clues.test.ts
git commit -m "feat: scent bias data, persistent tool unlocks and one-shot glow bell"
```

---

### Task 9: 道具 UI——偏心弧、鈴 chip、解鎖卡（W2）

**Files:**
- Modify: `src/main.ts`、`src/scenes/MapScene.ts`、`src/scenes/ResultScene.ts`、`src/core/i18n.ts`

**Interfaces:**
- Consumes: `createTools`/`ToolStore`（Task 8）、`useBell`、`dashedCircle`
- Produces:
  - registry `'tools'`（main.ts preBoot `createTools(storage)`）
  - i18n keys：`tool.windstone.name`（'Windstone'/'風向石'）、`tool.windstone.desc`（'Scent rings now lean toward the source.'/'氣味環將偏向來源方向。'）、`tool.glowbell.name`（'Glowbell'/'微光鈴'）、`tool.glowbell.desc`（'Once per hunt, rings out one false trail.'/'每局一次，辨明一條假蹤跡。'）、`result.toolUnlocked`（'New tool: {name}'/'獲得道具：{name}'）、`hud.bell`（'Bell'/'鈴'）
  - MapScene：`tools.has('windstone')` 時 `drawClueOverlay` scent 分支改畫 240° 偏心弧（`dashedCircle` 改造或新 helper `dashedArc(g, cx, cy, r, centerDeg, spanDeg, color, alpha)` 加入 paint.ts——以 biasDirection 為中心 ±120°）；`tools.has('glowbell')` 時 chip 列再加「鈴」chip（60 寬、`hud.bell` 標籤、mark 色系），點擊 `useBell(s, rng)` 成功→`redraw()`＋浮字＋`audio.play('reveal')`、`bellUsed`/無 decoy 時 chip 呈停用態（灰、不可點）
  - ResultScene：resolved 塊內 `const newTools = tools.syncUnlocks(codex);`；非空時於 body 下方顯示 `result.toolUnlocked`（金色、淡入）逐一列出（Phase 2 至多同幀兩枚）

- [ ] **Step 1: paint.ts 加 `dashedArc`**（沿 `dashedCircle` 寫法、只畫 `[center-span/2, center+span/2]` 度區間）
- [ ] **Step 2: i18n keys**（兩語系）
- [ ] **Step 3: main.ts registry＋MapScene 偏心弧與鈴 chip**（chip 佈局：現行由右至左 `?`/語言/標記/♪，鈴 chip 接在 ♪ 左側；窄幅 <560 時鈴與 ♪ 保留、標記保留、語言 chip 讓位——語言切換仍可從 Camp/Help 進行，註明於報告）
- [ ] **Step 4: ResultScene 解鎖卡**
- [ ] **Step 5: 驗證** — `npx vitest run` 全 PASS、`npm run build` exit 0；冒煙（人類）：收錄 5 次後氣味變弧、金級後鈴可用一次
- [ ] **Step 6: Commit**

```powershell
git add src/scenes/paint.ts src/core/i18n.ts src/main.ts src/scenes/MapScene.ts src/scenes/ResultScene.ts
git commit -m "feat: windstone bias arc, glow bell chip and tool unlock ceremony"
```

---

### Task 10: U4 資訊層（W2）

**Files:**
- Modify: `src/scenes/MapScene.ts`、`src/scenes/HelpScene.ts`

**Interfaces:**
- Consumes: `TERRAIN_COST`、`RunState.wins()`（Task 1）、readClues
- Produces:
  - hover 高亮＋成本角標：`pointermove` 時（僅 `explore`、非觸控拖曳）目前格畫 1px 金框＋右下角成本數字（`hoverG` 專用 Graphics、離開地圖清除）
  - 已判讀線索 token 金色小勾：`redraw` 內 `s.readClues.has(key(c.position))` 時於 token 右上畫 ✓（兩段線）
  - HUD 迷你地形圖例：寬 ≥900 時 HUD 左下（副標題右側）畫四色塊＋成本數字（純圖形＋數字，無文案 key）；<900 不畫，圖例改加進 HelpScene 圖例列（新一行：四色塊＋`help.terrain` key：'Terrain costs: meadow/mist 1 · thicket/rock 2'/'地形消耗：草地/霧地 1 · 密叢/岩坡 2'）
  - 操作提示自動退場：`buildHud` 建 hintText 前檢查 `(this.registry.get('runState') as RunState).wins() >= 3` → 不建立
- [ ] **Step 1–4: 依序實作四項**；**Step 5: 驗證**（vitest 全過、build exit 0；冒煙交人類）；**Step 6: Commit**

```powershell
git add src/scenes/MapScene.ts src/scenes/HelpScene.ts src/core/i18n.ts
git commit -m "feat: terrain cost visibility, read-clue checkmarks and auto-hiding hints"
```

---

### Task 11: 委託核心（W3）

**Files:**
- Create: `src/core/commissions.ts`、`tests/commissions.test.ts`

**Interfaces:**
- Consumes: `mulberry32`/`randInt`/`pickWeighted`、`CREATURES`、`Quality`、`dailyKey` 格式
- Produces:
  - `type Commission = { kind: 'record-creature'; creatureId: string } | { kind: 'stamina-finish'; min: number } | { kind: 'quality-any'; quality: 'silver' | 'gold' }`
  - `seedFromKey(dateKey: string): number`（`YYYY-MM-DD` → `YYYYMMDD` 數值）
  - `dailyCommissions(dateKey: string): Commission[]`（恆 3 則：k=0 record-creature（生物由 `mulberry32(seed*31+1)` 均勻抽）、k=1 stamina-finish（min ∈ {15,20,25} 抽）、k=2 quality-any（silver/gold 抽）；同 dateKey 恆同結果）
  - `interface ResultCtx { caught: boolean; creatureId: string; staminaLeft: number; quality: Quality | null; mode: 'run' | 'daily' }`
  - `evaluate(c: Commission, ctx: ResultCtx): boolean`（record-creature：caught 且 id 符；stamina-finish：caught 且 staminaLeft ≥ min；quality-any：caught 且品質階 ≥ 指定——用 `QUALITY_RANK`）
  - `COMMISSION_REWARD_NOTES = 2`
  - `createCommissionStore(storage?): { statusFor(dateKey: string): boolean[]; markDone(dateKey: string, idx: number): void }`（key `rht.commissions.v1` 存 `{date, done:[b,b,b]}`；date 不符時重置為 `[false,false,false]`；load/save 降級比照 runstate）

- [ ] **Step 1: 失敗測試**（決定性：同 dateKey 兩次呼叫 `toEqual`；不同 dateKey 至少一欄不同（多試 3 組日期取「存在差異」性質）；evaluate 各 kind 真值表含未捕獲=false；store 換日重置、壞資料回預設、markDone 持久化）——測試碼依上述介面完整書寫
- [ ] **Step 2: 確認失敗 → Step 3: 實作 → Step 4: 通過**（實作依介面直寫；`quality-any` 用 `QUALITY_RANK[ctx.quality] >= QUALITY_RANK[c.quality]` 並先判 null）
- [ ] **Step 5: Commit**

```powershell
git add src/core/commissions.ts tests/commissions.test.ts
git commit -m "feat: deterministic daily commissions with evaluation and progress store"
```

---

### Task 12: 委託 UI——營地三卡與結算判定（W3）

**Files:**
- Modify: `src/main.ts`、`src/scenes/CampScene.ts`、`src/scenes/ResultScene.ts`、`src/core/i18n.ts`

**Interfaces:**
- Consumes: Task 11 全部、`dailyKey`、`codex.addNotes`
- Produces:
  - registry `'commissions'`（store）
  - i18n keys：`comm.title`（'Notice Board'/'委託板'）、`comm.record`（'Record {name}'/'記錄{name}'）、`comm.stamina`（'Finish a hunt with {n}+ stamina'/'以 ≥{n} 體力完成一局'）、`comm.quality`（'Earn a {q} record or better'/'取得{q}以上記錄'）、`comm.done`（'Done'/'已完成'）、`comm.reward`（'+{n} field notes'/'觀察筆記 +{n}'）
  - CampScene：圖鑑鈕下方「委託板」區——標題小字＋三張窄卡（每張：描述一行（依 kind 組字，{q} 用 `quality.*` 首詞/首字邏輯同 stampQuality）、右側完成勾或 `comm.reward`）；高度不足（h<640）時區塊折疊為單行「委託板 n/3」
  - ResultScene resolved 塊內：

```typescript
      const commStore = this.registry.get('commissions') as ReturnType<typeof createCommissionStore>;
      const dk2 = dailyKey(new Date());
      const comms = dailyCommissions(dk2);
      const status = commStore.statusFor(dk2);
      const ctx = { caught, creatureId: creature.id, staminaLeft: Math.max(0, s.stamina), quality, mode: s.mode };
      const newlyDone: number[] = [];
      comms.forEach((c, i) => {
        if (!status[i] && evaluate(c, ctx)) {
          commStore.markDone(dk2, i);
          codex.addNotes(creature.id, COMMISSION_REWARD_NOTES);
          newlyDone.push(i);
        }
      });
```

  顯示：newlyDone 非空時 body 下方逐一顯示 `comm.done`＋描述＋`comm.reward`（淡入、與道具解鎖卡同區塊堆疊，y 依序 +24）
- [ ] **Step 1–3: 實作**；**Step 4: 驗證**（vitest 全過、build exit 0；冒煙交人類：完成委託出現獎勵行、營地卡打勾、隔日重置）；**Step 5: Commit**

```powershell
git add src/main.ts src/scenes/CampScene.ts src/scenes/ResultScene.ts src/core/i18n.ts
git commit -m "feat: camp notice board with daily commissions and result rewards"
```

---

### Task 13: 互動式新手引導（W4）

**Files:**
- Modify: `src/scenes/MapScene.ts`、`src/scenes/fx.ts`、`src/core/i18n.ts`

**Interfaces:**
- Produces:
  - 儲存旗標 `rht.tut.v1`（'1'=已完成）；首次進 Map（旗標未設且 `mode === 'run'` 且 round 1）啟動引導並**跳過**既有 `maybeShowFirstRunHelp` 彈窗（引導完成時同時寫 `rht.help.v1`，Help 仍可由 `?` 開啟）
  - i18n keys：`tut.move`（'See that marker? Walk over and read it.'/'看到那個記號了嗎？走過去判讀。'）、`tut.read`（'A clue! The creature is somewhere it points to.'/'線索！牠就在這指向的範圍裡。'）、`tut.cross`（'Two clues overlap — the truth hides where both agree.'/'兩條線索重疊——真相藏在交集之處。'）、`tut.qte`（'You are close. Get ready to tap in rhythm!'/'很近了，準備節奏點擊！'）
  - fx.ts：`pulseHighlight(scene, x, y, r, color): Phaser.GameObjects.Container`（虛線圈 scale yoyo ×3 後自毀——有限次，非常駐）
  - MapScene 引導狀態機 `tutStep: 0..4`：step0 高亮最近未讀真線索＋底部引導字（半透明底條＋文字，跟 redraw 共存）；踩上任一線索→step1 顯示 `tut.read` 3 秒；讀滿 2 條→step2 計算 `intersect(已讀真線索, mapSize)` 交集格（讀入自 `clues.ts`）逐格 0.25 金色填色閃 1.5 秒一次＋`tut.cross`；phase 轉 qte 前（`cheb<=2` 首次）→`tut.qte`；QTE 觸發時寫旗標收尾。引導文字全程不阻擋輸入。
- [ ] **Step 1–3: 實作**；**Step 4: 驗證**（vitest 全過、build exit 0；冒煙交人類：清 storage 首局走完四步、第二局起無引導、`?` 手冊照常）；**Step 5: Commit**

```powershell
git add src/scenes/MapScene.ts src/scenes/fx.ts src/core/i18n.ts
git commit -m "feat: scripted first-hunt tutorial replacing the legend popup"
```

---

### Task 14: 素材管線與最終驗收（W6）

**Files:**
- Modify: `src/scenes/BootScene.ts`、`src/scenes/paint.ts`、`src/scenes/QteScene.ts`、`src/scenes/ResultScene.ts`、`src/scenes/CodexScene.ts`
- Create: `docs/ASSETS.md`

**Interfaces:**
- Produces:
  - BootScene 增 `preload()`：對每個 creature 嘗試 `this.load.image('spr-'+id, 'assets/creatures/'+id+'.png')`；`this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, ...)` 靜默吞缺檔（僅 log.debug）；載入不阻塞既有 create 流程（Phaser preload→create 天然順序）
  - paint.ts：`creatureTexKey(scene: Phaser.Scene, id: string): string`（`spr-` 存在→`spr-`，否則 `sil-`）
  - QteScene 剪影、ResultScene 肖像、CodexScene 行圖示改經 `creatureTexKey`（`sil-` fallback 不刪）
  - `docs/ASSETS.md`：素材規格（生物 128×128 透明 PNG ≤64KB、命名 `public/assets/creatures/<id>.png`；地形 64×64 可平鋪 ≤32KB `public/assets/terrain/<type>.png`——本階段僅生物接線，地形載入預留章節說明）；內容審查清單（規格 §2：不得聯想真實動物特定物種／族群符號／宗教圖騰；PEGI 3–7 無威嚇形象；由人工目視簽核後入庫）；體積預算表
- [ ] **Step 1–2: 實作＋文件**
- [ ] **Step 3: 無素材驗證** — `npx vitest run` 全 PASS、`npm run build` exit 0、`npm run preview` 遊戲行為與前一 commit 完全一致（無 console error）
- [ ] **Step 4: 假素材驗證** — 放一張任意 128×128 PNG 於 `public/assets/creatures/mistfawn.png` → dev 模式 Qte/Result/Codex 顯示該圖；移除後恢復剪影。驗畢刪除測試檔。
- [ ] **Step 5: 最終驗收** — 全測試、build、更新 README 開發段（一行：素材放置說明指向 ASSETS.md）
- [ ] **Step 6: Commit**

```powershell
git add src/scenes/BootScene.ts src/scenes/paint.ts src/scenes/QteScene.ts src/scenes/ResultScene.ts src/scenes/CodexScene.ts docs/ASSETS.md README.md
git commit -m "feat: optional sprite asset pipeline with silhouette fallback and asset guide"
```

**最終冒煙清單（交人類，含 Phase 1 未執行的 8 項）：**

| # | 步驟 | 預期 |
|---|---|---|
| 1 | 清 storage 首啟 | 營地 → 上山 → 四步引導完整 → QTE |
| 2 | 靜音鈕 | ♪ 切換即時生效且重啟記憶 |
| 3 | 霧地圖 | 霧粒子極淡飄動；reduced-motion 模擬下無粒子 |
| 4 | 連抓 5 隻 | 解鎖風向石卡 → 下一局氣味呈 240° 弧 |
| 5 | 金級一次 | 解鎖微光鈴 → tier2 局按鈴標出一條假線索、一局限一次 |
| 6 | 委託 | 營地三卡與結算完成行一致；隔日（改系統日期）重置 |
| 7 | 研究度 15 | 圖鑑顯示判讀心得 |
| 8 | 重新整理 | 主線局數不歸零 |
| 9 | Phase 1 舊清單 | 每日挑戰/連勝/分享卡/觸控/遷移 8 項一併走 |

---

## Self-Review 紀錄

- **覆蓋**：W0（Task 1–2）、W5（3–5）、W1（6–7）、W2（8–10）、W3（11–12）、W4（13）、W6（14）。D1–D10 全部落地（D1→T1、D2→T1、D3→T7、D4→T8、D5→T11、D6 由 generateLevel 內建 quirk 自然成立、D7→T5、D8→T5、D9→T3、D10→T14）。
- **型別一致**：`RunState`（T1）供 T10 wins 判斷；`AudioBus`（T3）供 T4/T9；`applyQuirk`（T6）供 T6 generate 測試更新；`ScentData.biasDirection`（T8）供 T9 渲染；`ToolStore.syncUnlocks`（T8）供 T9；`Commission`/`evaluate`（T11）供 T12；registry 新鍵：`runState`、`audio`、`tools`、`commissions`。
- **既有測試衝擊**：T6 改 generate 斷言（decoy/supply 以 quirk 後為準）；T8 改 clues 測試 helper（biasDirection 欄位）與 generate `windBiasNeeded` 斷言——皆在對應 task 步驟內明列。
- **防重**：委託判定與道具解鎖皆在 `resolved` 塊內（T9/T12 明文）。
