import { describe, it, expect } from 'vitest';
import { rollMicroEvent, EVENT_CHANCE, MAX_EVENTS_PER_RUN } from '../src/core/events';
import type { SessionState, SessionMode } from '../src/core/session';
import { cheb, angleDeg, type Vec2 } from '../src/core/geometry';
import type { Clue, Level, TerrainType } from '../src/core/types';
import type { Rng } from '../src/core/rng';
import { ROUTE_START_INDEX } from '../src/core/route';

function scentClueAt(pos: Vec2): Clue {
  return {
    type: 'scent', position: pos, isDecoy: false, age: 2,
    data: { distance: 1, tolerance: 1, windBiasNeeded: false, biasDirection: 0 },
  };
}

interface Opts {
  player?: Vec2;
  mode?: SessionMode;
  microEvents?: number;
  clues?: Clue[];
  supplies?: Vec2[];
  target?: Vec2;
  mapSize?: number;
}

// 手工關卡：15x15 全草地，預設玩家 (0,0)、目標右下角，無線索/補給，遠離目標
function makeState(opts: Opts = {}): SessionState {
  const size = opts.mapSize ?? 15;
  const terrain: TerrainType[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'meadow' as TerrainType));
  const elevation: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0.2)); // 低地：與 meadow 一致，視野不加成
  const target = opts.target ?? { x: size - 1, y: size - 1 };
  const level: Level = {
    round: 1, mapSize: size,
    // 這批測試不涉及獵物移動，退化成五個節點都停在同一點的路線即可。
    route: { waypoints: Array(5).fill(target), rule: 'straight' },
    clues: opts.clues ?? [], terrain, elevation, supplies: opts.supplies ?? [],
    creatureId: 'mistfawn', trailheadIndex: 0, weather: 'clear', iris: false,
  };
  const player = opts.player ?? { x: 0, y: 0 };
  return {
    round: 1, level, player, stamina: 10,
    readClues: new Set(),
    marks: new Map(), path: [player], readLog: [], mutedClues: new Set(),
    seen: new Set(), surveyed: new Set(),
    phase: 'explore',
    steps: 0, mode: opts.mode ?? 'run', resolved: false, bellUsed: false,
    microEvents: opts.microEvents ?? 0,
  };
}

// 固定序列 rng：依序回傳給定值，超出序列後重複最後一個值；calls() 回報實際消耗次數
function seqRng(vals: number[]): { rng: Rng; calls: () => number } {
  let n = 0;
  const rng: Rng = () => {
    const v = vals[Math.min(n, vals.length - 1)];
    n++;
    return v;
  };
  return { rng, calls: () => n };
}

describe('constants', () => {
  it('exposes the tuned chance and cap', () => {
    expect(EVENT_CHANCE).toBe(0.04);
    expect(MAX_EVENTS_PER_RUN).toBe(2);
  });
});

describe('rollMicroEvent — mode gate', () => {
  it('daily mode never produces an event and never consumes rng', () => {
    const s = makeState({ mode: 'daily' });
    const { rng, calls } = seqRng([0]); // 即使 rng 永遠有利也不觸發
    for (let i = 0; i < 200; i++) {
      expect(rollMicroEvent(s, rng)).toBeNull();
    }
    expect(calls()).toBe(0);
  });
});

describe('rollMicroEvent — cap', () => {
  it('stops after MAX_EVENTS_PER_RUN even with rng favorable to events', () => {
    const s = makeState();
    const rng: Rng = () => 0.001; // chance passes; pickWeighted lands on bird-startle
    expect(rollMicroEvent(s, rng)).not.toBeNull();
    expect(s.microEvents).toBe(1);
    expect(rollMicroEvent(s, rng)).not.toBeNull();
    expect(s.microEvents).toBe(2);
    expect(rollMicroEvent(s, rng)).toBeNull(); // third roll capped
    expect(s.microEvents).toBe(2);
  });
});

describe('rollMicroEvent — proximity gate', () => {
  it('excludes rolling when within chebyshev distance 2 of target', () => {
    const s = makeState({ player: { x: 13, y: 13 } }); // cheb to (14,14) = 1
    expect(cheb(s.player, s.level.route.waypoints[ROUTE_START_INDEX])).toBe(1);
    expect(rollMicroEvent(s, () => 0.001)).toBeNull();
    expect(s.microEvents).toBe(0);
  });
  it('excludes exactly at chebyshev distance 2', () => {
    const s = makeState({ player: { x: 12, y: 12 } }); // cheb to (14,14) = 2
    expect(cheb(s.player, s.level.route.waypoints[ROUTE_START_INDEX])).toBe(2);
    expect(rollMicroEvent(s, () => 0.001)).toBeNull();
  });
  it('allows rolling at chebyshev distance 3', () => {
    const s = makeState({ player: { x: 11, y: 11 } }); // cheb to (14,14) = 3
    expect(cheb(s.player, s.level.route.waypoints[ROUTE_START_INDEX])).toBe(3);
    expect(rollMicroEvent(s, () => 0.001)).not.toBeNull();
  });
});

describe('rollMicroEvent — player-on-cell gate', () => {
  it('excludes rolling when player stands on a clue cell', () => {
    const s = makeState({ player: { x: 5, y: 5 }, clues: [scentClueAt({ x: 5, y: 5 })] });
    expect(rollMicroEvent(s, () => 0.001)).toBeNull();
    expect(s.microEvents).toBe(0);
  });
  it('excludes rolling when player stands on a supply cell', () => {
    const s = makeState({ player: { x: 5, y: 5 }, supplies: [{ x: 5, y: 5 }] });
    expect(rollMicroEvent(s, () => 0.001)).toBeNull();
    expect(s.microEvents).toBe(0);
  });
});

describe('rollMicroEvent — chance gate', () => {
  it('rolls null when the chance check fails, consuming exactly one rng call', () => {
    const s = makeState();
    const { rng, calls } = seqRng([0.5]); // 0.5 >= EVENT_CHANCE(0.04)
    expect(rollMicroEvent(s, rng)).toBeNull();
    expect(calls()).toBe(1);
    expect(s.microEvents).toBe(0);
  });
  it('produces an event when the chance check passes', () => {
    const s = makeState();
    const { rng } = seqRng([0.01, 0.01]);
    expect(rollMicroEvent(s, rng)).not.toBeNull();
    expect(s.microEvents).toBe(1);
  });
});

describe('rollMicroEvent — bird-startle / old-trail direction', () => {
  it('bird-startle direction points from player to target', () => {
    const s = makeState({ player: { x: 5, y: 5 } });
    const rng: Rng = () => 0.001; // chance passes; pickWeighted -> bird-startle
    const ev = rollMicroEvent(s, rng);
    expect(ev).toEqual({ kind: 'bird-startle', direction: angleDeg({ x: 5, y: 5 }, s.level.route.waypoints[ROUTE_START_INDEX]) });
  });
  it('old-trail direction points from player to target', () => {
    const s = makeState({ player: { x: 5, y: 5 } });
    const { rng } = seqRng([0.01, 0.9]); // chance passes; pickWeighted -> old-trail
    const ev = rollMicroEvent(s, rng);
    expect(ev).toEqual({ kind: 'old-trail', direction: angleDeg({ x: 5, y: 5 }, s.level.route.waypoints[ROUTE_START_INDEX]) });
  });
});

describe('rollMicroEvent — bonus-supply', () => {
  it('adds a legal nearby cell to level.supplies and increments the counter', () => {
    const s = makeState({ player: { x: 5, y: 5 } });
    const { rng } = seqRng([0.01, 0.5]); // chance passes; pickWeighted -> bonus-supply
    const ev = rollMicroEvent(s, rng);
    expect(ev?.kind).toBe('bonus-supply');
    if (ev?.kind !== 'bonus-supply') throw new Error('expected bonus-supply');
    expect(cheb(s.player, ev.pos)).toBeGreaterThanOrEqual(1);
    expect(cheb(s.player, ev.pos)).toBeLessThanOrEqual(2);
    expect(ev.pos.x).toBeGreaterThanOrEqual(0);
    expect(ev.pos.y).toBeGreaterThanOrEqual(0);
    expect(ev.pos.x).toBeLessThan(s.level.mapSize);
    expect(ev.pos.y).toBeLessThan(s.level.mapSize);
    expect(s.level.supplies).toContainEqual(ev.pos);
    expect(s.microEvents).toBe(1);
  });

  it('degrades to bird-startle when no empty cell exists within the scan radius', () => {
    const player: Vec2 = { x: 7, y: 7 };
    const ringCells: Vec2[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        ringCells.push({ x: player.x + dx, y: player.y + dy });
      }
    }
    const s = makeState({ player, supplies: ringCells });
    const { rng } = seqRng([0.01, 0.5]); // chance passes; pickWeighted -> bonus-supply
    const ev = rollMicroEvent(s, rng);
    expect(ev).toEqual({ kind: 'bird-startle', direction: angleDeg(player, s.level.route.waypoints[ROUTE_START_INDEX]) });
    expect(s.microEvents).toBe(1);
    expect(s.level.supplies.length).toBe(ringCells.length); // 未新增補給
  });
});
