import { cheb, dist, type Vec2 } from './geometry';
import type { Level, TerrainType } from './types';
import { getDifficulty } from './difficulty';
import { generateLevel } from './generate';
import { key } from './clues';
import type { Rng } from './rng';
import { cycleMark, type MarkMap } from './marks';

export type Phase = 'explore' | 'qte' | 'caught' | 'escaped' | 'exhausted';
export type SessionMode = 'run' | 'daily';

export const TERRAIN_COST: Record<TerrainType, number> = {
  meadow: 1, mist: 1, thicket: 2, rock: 2,
};

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
  phase: Phase;
  steps: number;          // 本局累計移動步數（分享卡用）
  mode: SessionMode;      // 主線 run / 每日挑戰 daily
  resolved: boolean;      // Result 已記帳（防場景重啟重複記錄）
  bellUsed: boolean;      // 微光鈴本局是否已使用（一局一次）
  microEvents: number;    // 微事件本局計數
}

function startPos(level: Level): Vec2 {
  const s = level.mapSize - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, level.targetPos) > dist(a, level.targetPos) ? b : a));
}

export function newSession(round: number, rng: Rng, mode: SessionMode = 'run'): SessionState {
  const level = generateLevel(round, rng);
  const player = startPos(level);
  return {
    round,
    level,
    player,
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Map(),
    path: [player],
    readLog: [],
    mutedClues: new Set(),
    phase: 'explore',
    steps: 0,
    mode,
    resolved: false,
    bellUsed: false,
    microEvents: 0,
  };
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

  const k = key(to);
  const supplyIdx = s.level.supplies.findIndex((p) => key(p) === k);
  if (supplyIdx >= 0) {
    s.level.supplies.splice(supplyIdx, 1);
    s.stamina += getDifficulty(s.round).supplyRestore;
  }
  const clueIndex = s.level.clues.findIndex((c) => key(c.position) === k);
  if (clueIndex >= 0 && !s.readClues.has(k)) {
    s.readClues.add(k);
    s.readLog.push({ clueIndex, step: s.steps });
  }

  // 逼近目標的判定先於力竭判定：最後一步逼近仍可觸發 QTE
  if (cheb(to, s.level.targetPos) <= 1) {
    s.phase = 'qte';
    return;
  }
  if (s.stamina <= 0 || !hasAffordableMove(s)) s.phase = 'exhausted';
}

// 三態標記推進：排除 → 存疑 → 押注 → 無（押注唯一性由 marks.cycleMark 保證）
export function cycleMarkAt(s: SessionState, p: Vec2): void {
  cycleMark(s.marks, key(p));
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
