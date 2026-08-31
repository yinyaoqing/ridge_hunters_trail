import type { QteParams } from './difficulty';
import type { Rng } from './rng';

export interface QteState {
  attempt: number;
  hits: number;
  arcStart: number;        // 命中弧區起始角（度）
  pointer: number;         // 指針目前角度（度）
  done: boolean;
  success: boolean | null; // done 前為 null
  lastHit: boolean | null; // 供渲染層做回饋
}

const rollArc = (cfg: QteParams, rng: Rng): number => rng() * (360 - cfg.arcSize);

export function newQte(cfg: QteParams, rng: Rng): QteState {
  return {
    attempt: 0, hits: 0,
    arcStart: rollArc(cfg, rng), pointer: 0,
    done: false, success: null, lastHit: null,
  };
}

export function tick(q: QteState, cfg: QteParams, dtMs: number): void {
  if (q.done) return;
  q.pointer = (q.pointer + (cfg.speed * dtMs) / 1000) % 360;
}

export function press(q: QteState, cfg: QteParams, rng: Rng): void {
  if (q.done) return;
  const hit = q.pointer >= q.arcStart && q.pointer <= q.arcStart + cfg.arcSize;
  q.lastHit = hit;
  if (hit) q.hits++;
  q.attempt++;

  if (q.hits >= cfg.needed) {
    q.done = true;
    q.success = true;
    return;
  }
  if (q.attempt >= cfg.rounds) {
    q.done = true;
    q.success = false;
    return;
  }
  q.arcStart = rollArc(cfg, rng);
}
