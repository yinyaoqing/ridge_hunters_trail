import { cheb, type Vec2 } from './geometry';
import type { Level, TerrainType } from './types';
import { getDifficulty } from './difficulty';
import { generateLevel } from './generate';
import { key } from './clues';
import type { Rng } from './rng';
import { cycleMark, toggleWager, type MarkMap } from './marks';
import { TERRAIN_COST, isPassable, startCorner } from './terrain';
import { visionRadius, cellsWithin, SURVEY_COST, SURVEY_BONUS } from './vision';
import { targetAt, ROUTE_START_INDEX } from './route';

// 實作已移至 terrain.ts 以打斷 session → generate → reach → session 的循環匯入；
// 既有呼叫端（MapScene、測試）沿用 session 的匯入點不變
export { TERRAIN_COST, isPassable, startCorner };

// 玩家所在格的 terrain/elevation：revealAround 與 survey 都要查這一對值，
// 抽成共用小函式避免兩處各自重複同一段查詢（F1 順帶整併）。
function groundUnderPlayer(s: SessionState): { terrain: TerrainType; elevation: number } {
  return {
    terrain: s.level.terrain[s.player.y][s.player.x],
    elevation: s.level.elevation[s.player.y][s.player.x],
  };
}

// 獵物「現在」在哪。整個專案唯一的來源——Phase 6a 之後「牠在哪」不再是常數，
// 任何直接讀路線節點的地方都會在獵物移動後說謊。
export function currentTarget(s: SessionState): Vec2 {
  return targetAt(s.level.route, s.steps);
}

// 獵物是否落在玩家「當前」的視野半徑內。
// 刻意不用 s.seen：那是單向累積的「看過的地」，而獵物會離開——
// 用 seen 判斷會讓牠走掉之後仍畫在原地，玩家會追一個已經不在那裡的影子。
export function isTargetVisible(s: SessionState): boolean {
  const { terrain, elevation } = groundUnderPlayer(s);
  return cheb(s.player, currentTarget(s)) <= visionRadius(terrain, elevation);
}

// 把玩家當前視野內的格加進 seen。單向累積：看過的地就不會再變回未知。
export function revealAround(s: SessionState): void {
  const { terrain, elevation } = groundUnderPlayer(s);
  for (const k of cellsWithin(s.player, visionRadius(terrain, elevation), s.level.mapSize)) s.seen.add(k);
}

// 駐足眺望：花體力掃過比站著更寬的一圈。同一格只能眺望一次——第二次不會有新資訊，
// 讓它白扣體力只是懲罰誤觸。體力不足或非探索階段時不執行、不扣款。
export function survey(s: SessionState): boolean {
  if (s.phase !== 'explore') return false;
  const k = key(s.player);
  if (s.surveyed.has(k)) return false;
  if (s.stamina < SURVEY_COST) return false;
  s.stamina -= SURVEY_COST;
  s.surveyed.add(k);
  const { terrain, elevation } = groundUnderPlayer(s);
  const r = visionRadius(terrain, elevation) + SURVEY_BONUS;
  for (const kk of cellsWithin(s.player, r, s.level.mapSize)) s.seen.add(kk);
  // F1：眺望花光體力（或花完後已無負擔得起的鄰格移動）卻不宣告力竭，會把玩家鎖進一個
  // 永遠回不到 'exhausted'、也做不了任何動作的 'explore' 狀態。套用與 move() 結尾
  // 相同的兩項判斷，讓眺望也能正常觸發力竭收尾。
  if (s.stamina <= 0 || !hasAffordableMove(s)) s.phase = 'exhausted';
  return true;
}

export type Phase = 'explore' | 'qte' | 'caught' | 'escaped' | 'exhausted';
export type SessionMode = 'run' | 'daily';

// 線索判讀記錄：哪一條線索、在第幾步被踩到。供揭曉畫面回推「資訊在第幾步就已完備」
export interface ClueRead {
  clueIndex: number;
  step: number;
}

export interface SessionState {
  round: number;
  level: Level;
  player: Vec2;
  stamina: number;
  readClues: Set<string>; // 已判讀（踩過）的線索位置鍵
  marks: MarkMap;         // 玩家標記：排除／存疑／押注（押注全域唯一）
  path: Vec2[];           // 走過的每一格（含起點），揭曉畫面回放用
  readLog: ClueRead[];    // 線索判讀順序與步數（同一條線索只記一次）
  mutedClues: Set<number>; // 被玩家靜音、不計入候選熱區的線索索引
  seen: Set<string>;      // 曾進入視野的格（單向累積，看過就不會忘）
  surveyed: Set<string>;  // 已在此格眺望過，避免重複花體力卻沒有新資訊
  phase: Phase;
  steps: number;          // 本局累計移動步數（分享卡用）
  mode: SessionMode;      // 主線 run / 每日挑戰 daily
  resolved: boolean;      // Result 已記帳（防場景重啟重複記錄）
  bellUsed: boolean;      // 微光鈴本局是否已使用（一局一次）
  microEvents: number;    // 微事件本局計數
}

export function newSession(round: number, rng: Rng, mode: SessionMode = 'run'): SessionState {
  const level = generateLevel(round, rng);
  const player = startCorner(level.mapSize, level.route.waypoints[ROUTE_START_INDEX]);
  const s: SessionState = {
    round,
    level,
    player,
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Map(),
    path: [player],
    readLog: [],
    mutedClues: new Set(),
    seen: new Set(),
    surveyed: new Set(),
    phase: 'explore',
    steps: 0,
    mode,
    resolved: false,
    bellUsed: false,
    microEvents: 0,
  };
  revealAround(s);
  // 起始蹤跡永遠可見（見 generate.ts 的 trailheadIndex 註解）
  s.seen.add(key(level.clues[level.trailheadIndex].position));
  return s;
}

function hasAffordableMove(s: SessionState): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const to = { x: s.player.x + dx, y: s.player.y + dy };
      if (to.x < 0 || to.y < 0 || to.x >= s.level.mapSize || to.y >= s.level.mapSize) continue;
      if (s.stamina >= TERRAIN_COST[s.level.terrain[to.y][to.x]]) return true;
    }
  }
  return false;
}

export function canMove(s: SessionState, to: Vec2): boolean {
  if (s.phase !== 'explore') return false;
  if (to.x < 0 || to.y < 0 || to.x >= s.level.mapSize || to.y >= s.level.mapSize) return false;
  if (cheb(s.player, to) !== 1) return false;
  return s.stamina >= TERRAIN_COST[s.level.terrain[to.y][to.x]];
}

export function move(s: SessionState, to: Vec2): void {
  if (!canMove(s, to)) return;
  s.steps++;
  s.stamina -= TERRAIN_COST[s.level.terrain[to.y][to.x]];
  s.player = to;
  s.path.push(to);
  revealAround(s); // 走到新位置立即揭示視野，供本次移動後的所有判斷共用

  const k = key(to);
  const supplyIdx = s.level.supplies.findIndex((p) => key(p) === k);
  if (supplyIdx >= 0) {
    s.level.supplies.splice(supplyIdx, 1);
    s.stamina += getDifficulty(s.round).supplyRestore;
  }
  // 同格可能不只一條線索（generate.ts 的 clampToMap 會把出界點夾到同一邊緣格）；
  // 用 findIndex 只記第一條會讓熱區少算、靜音留下漏網線索、揭曉畫面誤判幌子為真線索
  // （見 F1）。改為一次記錄該格「所有」尚未記錄的線索索引，全部掛同一個 step。
  // C1 回歸：這格必須真的落有線索才算「判讀」——readClues 是 codex 研究筆記數、
  // MapScene 教學提示（tut.read／tut.cross）共用的「已讀線索」計數，若對空地也
  // 累加，會在玩家什麼都沒讀到時就灌爆這些下游判斷（見再審報告 C1）。
  const hasClueHere = s.level.clues.some((c) => key(c.position) === k);
  if (hasClueHere && !s.readClues.has(k)) {
    s.readClues.add(k);
    s.level.clues.forEach((c, clueIndex) => {
      if (key(c.position) === k) s.readLog.push({ clueIndex, step: s.steps });
    });
  }

  // 逼近目標的判定先於力竭判定：最後一步逼近仍可觸發 QTE
  // steps 已於本函式開頭遞增，因此這裡取到的是「這一步之後」獵物的位置——
  // 牠可能剛好在這一步換了節點而落到玩家旁邊，那也算逼近成功。
  if (cheb(to, currentTarget(s)) <= 1) {
    s.phase = 'qte';
    return;
  }
  if (s.stamina <= 0 || !hasAffordableMove(s)) s.phase = 'exhausted';
}

// 三態標記推進：排除 → 存疑 → 押注 → 無（押注唯一性由 marks.cycleMark 保證）
export function cycleMarkAt(s: SessionState, p: Vec2): void {
  cycleMark(s.marks, key(p));
}

// 只切換押注（F3 設計裁定）：押注是計分承諾，不像排除／存疑受限於看過的格，
// 讓玩家能在走過去之前先押注——這正是判讀精準度評分要考驗的推理能力。
export function toggleWagerAt(s: SessionState, p: Vec2): void {
  toggleWager(s.marks, key(p));
}

// 線索靜音：把一條已判讀的線索排除在候選熱區之外，用來檢驗「如果這條是假的呢」
export function toggleMute(s: SessionState, clueIndex: number): void {
  if (s.mutedClues.has(clueIndex)) s.mutedClues.delete(clueIndex);
  else s.mutedClues.add(clueIndex);
}

export function resolveQte(s: SessionState, success: boolean): void {
  if (s.phase !== 'qte') return;
  s.phase = success ? 'caught' : 'escaped';
}

// 微光鈴：一局一次，隨機標記一個幌子線索位置（未持有幌子時回傳 null）
export function useBell(s: SessionState, rng: Rng): Vec2 | null {
  if (s.bellUsed) return null;
  const decoys = s.level.clues.filter((c) => c.isDecoy);
  if (decoys.length === 0) return null;
  const pick = decoys[Math.floor(rng() * decoys.length)];
  s.marks.set(key(pick.position), 'exclude');
  s.bellUsed = true;
  return pick.position;
}

// caught → 下一局（難度遞增）；escaped / exhausted → 同難度整局重生（線索清空，規格 3）
export function nextSession(s: SessionState, rng: Rng): SessionState {
  return newSession(s.phase === 'caught' ? s.round + 1 : s.round, rng);
}
