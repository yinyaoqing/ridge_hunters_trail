import { cheb, angleDeg, type Vec2 } from './geometry';
import { pickWeighted, type Rng } from './rng';
import { key } from './clues';
import type { SessionState } from './session';
import type { Level } from './types';

export type MicroEvent =
  | { kind: 'bird-startle'; direction: number }  // 指向目標的精確方位（顯示層加寬呈現）
  | { kind: 'bonus-supply'; pos: Vec2 }
  | { kind: 'old-trail'; direction: number };    // 玩家所在格的一次性弱足跡（顯示層 spread 60）

export const EVENT_CHANCE = 0.04;
export const MAX_EVENTS_PER_RUN = 2;

function isOccupiedCell(level: Level, p: Vec2): boolean {
  const k = key(p);
  if (key(level.targetPos) === k) return true;
  if (level.clues.some((c) => key(c.position) === k)) return true;
  if (level.supplies.some((s) => key(s) === k)) return true;
  return false;
}

// 玩家半徑 2 內、界內、非線索/補給/目標格的最近空格；不消耗 rng，順序固定由近而遠、同距離依 y→x
function findNearbyEmptyCell(s: SessionState): Vec2 | null {
  const { player, level } = s;
  const candidates: Vec2[] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const p: Vec2 = { x: player.x + dx, y: player.y + dy };
      if (p.x < 0 || p.y < 0 || p.x >= level.mapSize || p.y >= level.mapSize) continue;
      candidates.push(p);
    }
  }
  candidates.sort((a, b) => {
    const da = cheb(player, a);
    const db = cheb(player, b);
    if (da !== db) return da - db;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  for (const p of candidates) {
    if (!isOccupiedCell(level, p)) return p;
  }
  return null;
}

export function rollMicroEvent(s: SessionState, rng: Rng): MicroEvent | null {
  if (s.mode !== 'run') return null;
  if (s.microEvents >= MAX_EVENTS_PER_RUN) return null;
  if (cheb(s.player, s.level.targetPos) <= 2) return null;
  const playerKey = key(s.player);
  const onClueOrSupply =
    s.level.clues.some((c) => key(c.position) === playerKey) ||
    s.level.supplies.some((p) => key(p) === playerKey);
  if (onClueOrSupply) return null;
  if (rng() >= EVENT_CHANCE) return null;

  const kind = pickWeighted<MicroEvent['kind']>(rng, [
    ['bird-startle', 2],
    ['bonus-supply', 2],
    ['old-trail', 1],
  ]);

  if (kind === 'bonus-supply') {
    const pos = findNearbyEmptyCell(s);
    if (pos) {
      s.level.supplies.push(pos);
      s.microEvents++;
      return { kind: 'bonus-supply', pos };
    }
    // 保底：找不到空格時改回傳 bird-startle
    const direction = angleDeg(s.player, s.level.targetPos);
    s.microEvents++;
    return { kind: 'bird-startle', direction };
  }

  const direction = angleDeg(s.player, s.level.targetPos);
  s.microEvents++;
  return { kind, direction };
}
