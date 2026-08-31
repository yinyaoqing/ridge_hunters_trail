import { cheb, dist, type Vec2 } from './geometry';
import type { Level, TerrainType } from './types';
import { getDifficulty } from './difficulty';
import { generateLevel } from './generate';
import { key } from './clues';
import type { Rng } from './rng';

export type Phase = 'explore' | 'qte' | 'caught' | 'escaped' | 'exhausted';

export const TERRAIN_COST: Record<TerrainType, number> = {
  meadow: 1, mist: 1, thicket: 2, rock: 2,
};

export interface SessionState {
  round: number;
  level: Level;
  player: Vec2;
  stamina: number;
  readClues: Set<string>; // 已判讀（踩過）的線索位置鍵
  marks: Set<string>;     // 玩家自行標記的格
  phase: Phase;
}

function startPos(level: Level): Vec2 {
  const s = level.mapSize - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, level.targetPos) > dist(a, level.targetPos) ? b : a));
}

export function newSession(round: number, rng: Rng): SessionState {
  const level = generateLevel(round, rng);
  return {
    round,
    level,
    player: startPos(level),
    stamina: getDifficulty(round).staminaBudget,
    readClues: new Set(),
    marks: new Set(),
    phase: 'explore',
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
  s.stamina -= TERRAIN_COST[s.level.terrain[to.y][to.x]];
  s.player = to;

  const k = key(to);
  const supplyIdx = s.level.supplies.findIndex((p) => key(p) === k);
  if (supplyIdx >= 0) {
    s.level.supplies.splice(supplyIdx, 1);
    s.stamina += getDifficulty(s.round).supplyRestore;
  }
  if (s.level.clues.some((c) => key(c.position) === k)) s.readClues.add(k);

  // 逼近目標的判定先於力竭判定：最後一步逼近仍可觸發 QTE
  if (cheb(to, s.level.targetPos) <= 1) {
    s.phase = 'qte';
    return;
  }
  if (s.stamina <= 0 || !hasAffordableMove(s)) s.phase = 'exhausted';
}

export function toggleMark(s: SessionState, p: Vec2): void {
  const k = key(p);
  if (s.marks.has(k)) s.marks.delete(k);
  else s.marks.add(k);
}

export function resolveQte(s: SessionState, success: boolean): void {
  s.phase = success ? 'caught' : 'escaped';
}

// caught → 下一局（難度遞增）；escaped / exhausted → 同難度整局重生（線索清空，規格 3）
export function nextSession(s: SessionState, rng: Rng): SessionState {
  return newSession(s.phase === 'caught' ? s.round + 1 : s.round, rng);
}
