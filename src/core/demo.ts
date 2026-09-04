import { candidates, intersect, key } from './clues';
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
    // age: 2——示範關卡是單一固定目標（無路線），全部線索都錨定在同一個「現在」的位置，
    // 對應到有路線的關卡裡最新的一齡。
    type: 'footprint', position: { x: 2, y: 7 }, isDecoy: false, age: 2,
    data: { direction: 309, angleSpread: 25 }, // 309° = round(angleDeg((2,7) → 目標))
  },
  {
    type: 'scent', position: { x: 8, y: 8 }, isDecoy: false, age: 2,
    // biasDirection 只在持有風向石時才會被畫成偏心弧；示範沒有道具系統，
    // 這裡仍填真實方位（252° = round(angleDeg((8,8) → 目標))），
    // 免得日後若接上道具還得回頭補一個假值
    data: {
      distance: DEMO_SCENT_DISTANCE, tolerance: 0.75,
      windBiasNeeded: false, biasDirection: 252,
    },
  },
  {
    type: 'footprint', position: { x: 3, y: 4 }, isDecoy: true, age: 2,
    data: { direction: 225, angleSpread: 25 }, // 朝西北，與真相的東北恰好相背
  },
  {
    type: 'disturbance', position: { x: 6, y: 0 }, isDecoy: false, age: 2,
    data: { radius: 2 },
  },
];

// 前兩條線索的交集（11 格）。腳本的旁白數字、第二章的自動存疑標記、
// 以及 DEMO_MID 的位置驗證都讀它——單一來源，不手寫 11。
export const DEMO_PAIR: Set<string> = intersect([DEMO_CLUES[0], DEMO_CLUES[1]], DEMO_SIZE);

// 三個動手點。它們各自對應遊戲裡最容易被完全錯過的功能：
// 排除標記、線索靜音、押注。靜音尤其——它目前只存在於說明頁一行字裡，
// 沒人教就永遠不會有人用。
export type DemoAction = 'exclude' | 'mute' | 'wager' | 'pick-age';

export interface DemoStep {
  chapter: 1 | 2 | 3 | 4;
  narration: MsgKey;
  // 旁白裡的數字。全部由 candidates()/intersect() 於模組載入時算出，一個都不手寫——
  // 文案與畫面因此在結構上不可能對不上（tests/demo.test.ts 有佔位符對稱測試把關）。
  vars?: Record<string, number>;
  clues: readonly number[];   // 本步已判讀的線索索引
  muted: readonly number[];   // 本步已靜音的線索索引（必為 clues 的子集）
  overlay: 'none' | 'heat' | 'intersect';
  // 本步的新鮮度 chip 選擇（null = 全部齡別）。第一課全部為 undefined，
  // 渲染時視同 null，逐格結果與加這個欄位之前完全相同。
  heatAge?: 0 | 1 | 2 | null;
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
    // 記號在，但範圍還沒解出來：overlay 為 'none' 時 DemoScene 只畫線索記號、
    // 不畫範圍圈，所以這裡列 clues: [0] 不會讓畫面提早爆雷答案，只是讓足跡標記
    // 出現在地圖上——第 2 步的旁白「判讀足跡」才有一個已經看得到的東西可以指。
    chapter: 1, narration: 'demo.s1', vars: { n: TOTAL_CELLS },
    clues: [0], muted: [], overlay: 'none', seen: 'near', player: DEMO_START,
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
  // 界外一律當成答錯。CONE 只含格內座標，所以少了這道守衛時，界外的格子
  // 會因為「不在錐形裡」而被判成正確的排除——一個永遠不該回答「對」的輸入。
  // 場景層的點擊處理另有自己的邊界檢查；這裡守的是這個匯出函式自身的契約。
  const inside = cell.x >= 0 && cell.y >= 0 && cell.x < DEMO_SIZE && cell.y < DEMO_SIZE;
  if (action === 'exclude') return !inside || CONE.has(key(cell)) ? 'demo.hint.exclude' : null;
  return inside && key(cell) === key(DEMO_TARGET) ? null : 'demo.hint.wager';
}

export function checkMuteAction(clueIndex: number): MsgKey | null {
  return clueIndex === DECOY_INDEX ? null : 'demo.hint.mute';
}

// ── 第二課：會走的獵物 ──────────────────────────────────────────
// 獵物走 W0 → W1 → W2 三個節點，每齡兩條線索反向錨定在「當時」所在的節點上，
// 與真實關卡的 route.ts + generate.ts 是同一套幾何。無幌子：幌子由第一課教完，
// 這一課要專心教齡別，兩件難事同時上等於兩件都沒教會。
//
// 這組資料由 scripts/find-quarry-lesson.mjs 窮舉找出，性質釘在
// tests/demo-quarry.test.ts。動任何一個數字之前，先跑測試。
//
// 這是第三次重找。第一版三個節點與外推點全落在 y=0（貼著格線邊緣，
// 讀不出「一條線」的方向感），而且線索位置跟別齡的節點重合（教學要講
// 「線索標的是牠經過的地方，不是牠現在的位置」，結果線索畫在下一齡的
// 節點正上方，混淆了正要教的區別）。第二版補了：
//   ⑤ 任何線索位置都不得與「任何一個」節點重合——不只是自己那一齡的節點
//   ⑥ 三個節點與外推點都離邊界至少 1 格（x、y 落在 1..size-2＝1..7）
// 但第二版漏了一條：六條線索的位置本身互相之間可以重合。窮舉只拿「離節點
// 多遠」當條件，是從 (0,0) 往外一格一格找，於是四條線索全疊在 (0,0)——
// drawClueToken（src/scenes/paint.ts）畫的是不透明底盤，疊在一起時只有
// 最後畫的那個看得見，玩家在畫面上數到的線索記號只有三個，卻聽旁白說
// 「六條線索」「三組」「只剩兩條」，畫面與文案對不上。這一版再補一條：
//   ⑦ 六條線索的位置必須兩兩相異
// 並且加了一條非硬性的偏好：六個位置盡量互相拉開（兩兩 Chebyshev 距離
// ≥ 2），讀起來才像散在地圖上的六個點，不是擠在同一個角落——這一版窮舉
// 第一輪（只試對角線、不放寬任何參數）就同時滿足了硬約束與這條偏好，
// 未曾放寬 SPREADS／RADII／混搭優先序，也未曾關掉對角線偏好。
export const QUARRY_SIZE = 9;
export const QUARRY_NODES: readonly [Vec2, Vec2, Vec2] = [
  { x: 1, y: 1 },
  { x: 3, y: 3 },
  { x: 5, y: 5 },
];
export const QUARRY_TARGET: Vec2 = { x: 7, y: 7 };
export const QUARRY_START: Vec2 = { x: 0, y: 8 }; // 左下角，離對角線路徑最遠的角落
export const QUARRY_CLUES: readonly Clue[] = [
  {
    type: 'footprint', position: { x: 0, y: 0 }, isDecoy: false, age: 0,
    data: { direction: 45, angleSpread: 20 },
  },
  {
    type: 'scent', position: { x: 6, y: 4 }, isDecoy: false, age: 0,
    data: { distance: 6, tolerance: 0.5, windBiasNeeded: false, biasDirection: 211 },
  },
  {
    type: 'scent', position: { x: 2, y: 0 }, isDecoy: false, age: 1,
    data: { distance: 3, tolerance: 0.5, windBiasNeeded: false, biasDirection: 72 },
  },
  {
    type: 'footprint', position: { x: 2, y: 2 }, isDecoy: false, age: 1,
    data: { direction: 45, angleSpread: 20 },
  },
  {
    type: 'scent', position: { x: 4, y: 0 }, isDecoy: false, age: 2,
    data: { distance: 5, tolerance: 0.5, windBiasNeeded: false, biasDirection: 79 },
  },
  {
    type: 'footprint', position: { x: 5, y: 6 }, isDecoy: false, age: 2,
    data: { direction: 270, angleSpread: 20 },
  },
];

// 最新齡兩條的交集（＝W2 一格）。第二章的自動存疑標記讀它——單一來源，不手寫。
export const QUARRY_PAIR: Set<string> = intersect(
  QUARRY_CLUES.filter((c) => c.age === 2), QUARRY_SIZE,
);

const QUARRY_ALL_AGREE = intersect([...QUARRY_CLUES], QUARRY_SIZE).size; // 恆為 0，由測試釘死

export const QUARRY_STEPS: readonly DemoStep[] = [
  // 第一章：牠沒有待在原地
  {
    chapter: 1, narration: 'demo2.s1', vars: { n: QUARRY_ALL_AGREE },
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  {
    chapter: 1, narration: 'demo2.s2',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  // 第二章：一次只看一齡
  {
    chapter: 2, narration: 'demo2.s3',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  {
    chapter: 2, narration: 'demo2.s4',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'heat', heatAge: 2,
    seen: 'all', player: QUARRY_START, action: 'pick-age',
  },
  {
    chapter: 2, narration: 'demo2.s5',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: 2,
    seen: 'all', player: QUARRY_START, autoSuspect: true,
  },
  // 第三章：往前帶
  {
    chapter: 3, narration: 'demo2.s6',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
  {
    chapter: 3, narration: 'demo2.s7',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: null,
    seen: 'all', player: QUARRY_START, action: 'wager',
  },
  {
    chapter: 3, narration: 'demo2.s8',
    clues: [0, 1, 2, 3, 4, 5], muted: [], overlay: 'intersect', heatAge: null,
    seen: 'all', player: QUARRY_START,
  },
];

export type DemoScriptId = 'deduction' | 'quarry';
export type DemoCellAction = 'exclude' | 'wager';

export interface DemoScript {
  id: DemoScriptId;
  size: number;
  start: Vec2;
  target: Vec2;
  clues: readonly Clue[];
  steps: readonly DemoStep[];
  fogRows: number;
  titleKey: MsgKey;
  // 第二章自動標存疑的那一組格子。第一課是「前兩條線索的交集」，
  // 第二課是「最新齡兩條的交集」——語意不同，值由腳本自己算好交出來。
  pair: Set<string>;
  checkCell(action: DemoCellAction, cell: Vec2): MsgKey | null;
  checkClue(clueIndex: number): MsgKey | null;
  unseen(step: DemoStep): Set<string>;
}

export const DEDUCTION_SCRIPT: DemoScript = {
  id: 'deduction',
  size: DEMO_SIZE,
  start: DEMO_START,
  target: DEMO_TARGET,
  clues: DEMO_CLUES,
  steps: DEMO_STEPS,
  fogRows: DEMO_FOG_ROWS,
  titleKey: 'demo.title',
  pair: DEMO_PAIR,
  checkCell: checkCellAction,
  checkClue: checkMuteAction,
  unseen: demoUnseen,
};

export const QUARRY_SCRIPT: DemoScript = {
  id: 'quarry',
  size: QUARRY_SIZE,
  start: QUARRY_START,
  target: QUARRY_TARGET,
  clues: QUARRY_CLUES,
  steps: QUARRY_STEPS,
  fogRows: 0, // 這一課不教視野；迷霧只會分散注意力
  titleKey: 'demo2.title',
  pair: QUARRY_PAIR,
  // 只接受外推點。押在任何一個節點上，代表「牠還在走」這件事還沒學會——
  // 此時給提示比給通過更有價值（同第一課 checkCellAction 的判準）。
  checkCell: (_action, cell) =>
    key(cell) === key(QUARRY_TARGET) ? null : 'demo2.hint.wager',
  // 這一課沒有幌子，靜音不在課程內。玩家點線索時給的提示必須說明「為什麼不必靜音」，
  // 不能沿用押注的提示——那句話對「點到線索」這個動作是文不對題的。
  checkClue: () => 'demo2.hint.mute',
  unseen: () => new Set<string>(),
};

export function demoScript(id: DemoScriptId): DemoScript {
  return id === 'quarry' ? QUARRY_SCRIPT : DEDUCTION_SCRIPT;
}
