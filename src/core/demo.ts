import { candidates, intersect } from './clues';
import type { Vec2 } from './geometry';
import type { Clue } from './types';
import type { MsgKey } from './i18n';

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
    clues: [0, 1, 2, 3], muted: [DECOY_INDEX], overlay: 'heat', seen: 'all', player: DEMO_MID,
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
