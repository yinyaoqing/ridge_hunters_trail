import { describe, it, expect } from 'vitest';
import {
  newSession, canMove, move, cycleMarkAt, toggleMute, resolveQte, nextSession, useBell,
  TERRAIN_COST, type SessionState,
} from '../src/core/session';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key } from '../src/core/clues';
import type { Level, TerrainType } from '../src/core/types';

// 手工關卡：5x5 全草地，目標 (4,4)，補給 (1,0)，scent 線索 (2,0)
function makeState(overrides: Partial<SessionState> = {}): SessionState {
  const terrain: TerrainType[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 'meadow' as TerrainType));
  const elevation: number[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 0.2)); // 低地：與 meadow 一致，視野不加成
  const level: Level = {
    round: 1, mapSize: 5, targetPos: { x: 4, y: 4 },
    clues: [{
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: false,
      data: { distance: 4, tolerance: 1, windBiasNeeded: false, biasDirection: 0 },
    }],
    terrain, elevation, supplies: [{ x: 1, y: 0 }], creatureId: 'mistfawn', weather: 'clear', iris: false,
  };
  return {
    round: 1, level, player: { x: 0, y: 0 }, stamina: 10,
    readClues: new Set(),
    marks: new Map(), path: [{ x: 0, y: 0 }], readLog: [], mutedClues: new Set(),
    phase: 'explore',
    steps: 0, mode: 'run', resolved: false, bellUsed: false, microEvents: 0,
    ...overrides,
  };
}

describe('newSession', () => {
  it('starts at a corner with full stamina in explore phase', () => {
    const s = newSession(1, mulberry32(11));
    expect(s.stamina).toBe(getDifficulty(1).staminaBudget);
    expect(s.phase).toBe('explore');
    const corners = [0, s.level.mapSize - 1];
    expect(corners).toContain(s.player.x);
    expect(corners).toContain(s.player.y);
  });
});

describe('canMove', () => {
  it('allows only chebyshev-adjacent in-bounds moves during explore', () => {
    const s = makeState();
    expect(canMove(s, { x: 1, y: 1 })).toBe(true);   // 斜向相鄰
    expect(canMove(s, { x: 2, y: 0 })).toBe(false);  // 距離2
    expect(canMove(s, { x: -1, y: 0 })).toBe(false); // 出界
    expect(canMove(s, { x: 0, y: 0 })).toBe(false);  // 原地
  });
  it('blocks moves the player cannot afford', () => {
    const s = makeState({ stamina: 0 });
    expect(canMove(s, { x: 1, y: 0 })).toBe(false);
  });
});

describe('move', () => {
  it('deducts terrain cost', () => {
    const s = makeState();
    move(s, { x: 0, y: 1 });
    expect(s.player).toEqual({ x: 0, y: 1 });
    expect(s.stamina).toBe(10 - TERRAIN_COST.meadow);
  });
  it('picks up supply: +10 stamina and supply removed', () => {
    const s = makeState();
    move(s, { x: 1, y: 0 });
    expect(s.stamina).toBe(10 - 1 + 10);
    expect(s.level.supplies.length).toBe(0);
  });
  it('reads a clue when stepping onto it', () => {
    const s = makeState({ player: { x: 1, y: 0 } });
    move(s, { x: 2, y: 0 });
    expect(s.readClues.has('2,0')).toBe(true);
  });
  it('triggers QTE when moving within chebyshev 1 of target', () => {
    const s = makeState({ player: { x: 3, y: 3 } });
    move(s, { x: 3, y: 4 }); // cheb((3,4),(4,4)) = 1
    expect(s.phase).toBe('qte');
  });
  it('exhausts when stamina hits zero away from target', () => {
    const s = makeState({ stamina: 1 });
    move(s, { x: 0, y: 1 });
    expect(s.stamina).toBe(0);
    expect(s.phase).toBe('exhausted');
  });
  it('QTE at last breath still triggers (checked before exhaustion)', () => {
    const s = makeState({ player: { x: 3, y: 3 }, stamina: 1 });
    move(s, { x: 3, y: 4 });
    expect(s.phase).toBe('qte');
  });
  it('exhausts on soft-lock when no remaining neighbor is affordable', () => {
    const s = makeState({ stamina: 2, player: { x: 0, y: 0 } });
    // Surround the destination (0,1) with rock (cost 2) so that after landing
    // there with 1 stamina left, no Chebyshev neighbor (including origin
    // (0,0)) is affordable. (0,1) itself stays meadow so it's cheap to enter.
    const terrain = s.level.terrain;
    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x <= 1; x++) {
        if (x === 0 && y === 1) continue; // keep destination itself meadow
        terrain[y][x] = 'rock';
      }
    }
    move(s, { x: 0, y: 1 });
    expect(s.player).toEqual({ x: 0, y: 1 });
    expect(s.stamina).toBe(1);
    expect(s.phase).toBe('exhausted');
  });
});

describe('resolveQte / nextSession', () => {
  it('success -> caught -> next round', () => {
    const s = makeState({ phase: 'qte' });
    resolveQte(s, true);
    expect(s.phase).toBe('caught');
    const next = nextSession(s, mulberry32(5));
    expect(next.round).toBe(2);
    expect(next.phase).toBe('explore');
  });
  it('failure -> escaped -> same round regenerated with cleared clues', () => {
    const s = makeState({ phase: 'qte' });
    s.readClues.add('2,0');
    resolveQte(s, false);
    expect(s.phase).toBe('escaped');
    const next = nextSession(s, mulberry32(5));
    expect(next.round).toBe(1);
    expect(next.readClues.size).toBe(0);
  });
  it('is a no-op when phase is not qte (e.g. caught or explore)', () => {
    const caughtState = makeState({ phase: 'caught' });
    resolveQte(caughtState, true);
    expect(caughtState.phase).toBe('caught');

    const exploreState = makeState({ phase: 'explore' });
    resolveQte(exploreState, false);
    expect(exploreState.phase).toBe('explore');
  });
  it('still resolves normally when phase is qte', () => {
    const s = makeState({ phase: 'qte' });
    resolveQte(s, true);
    expect(s.phase).toBe('caught');
  });
});

describe('steps / mode / resolved', () => {
  it('new session starts with zero steps, run mode, unresolved', () => {
    const s = newSession(1, mulberry32(1));
    expect(s.steps).toBe(0);
    expect(s.mode).toBe('run');
    expect(s.resolved).toBe(false);
    expect(s.microEvents).toBe(0);
  });
  it('mode can be set to daily', () => {
    expect(newSession(5, mulberry32(1), 'daily').mode).toBe('daily');
  });
  it('each successful move increments steps', () => {
    const s = newSession(1, mulberry32(2));
    const before = s.steps;
    const to = { x: s.player.x + (s.player.x === 0 ? 1 : -1), y: s.player.y };
    move(s, to);
    expect(s.steps).toBe(before + 1);
    move(s, { x: -99, y: -99 }); // 非法移動不計步
    expect(s.steps).toBe(before + 1);
  });
});

describe('useBell', () => {
  it('marks one decoy once per session', () => {
    const s = newSession(5, mulberry32(11)); // tier2 必有 decoy（含 quirk 可能 +1）
    const decoys = s.level.clues.filter((c) => c.isDecoy);
    if (decoys.length === 0) return; // veilmoth 以外一定 >0；防禦性跳過
    const pos = useBell(s, mulberry32(1));
    expect(pos).not.toBeNull();
    expect(s.bellUsed).toBe(true);
    expect(s.marks.get(key(pos!))).toBe('exclude');
    expect(useBell(s, mulberry32(2))).toBeNull(); // 一局一次
  });
  it('returns null when no decoys exist', () => {
    const s = newSession(1, mulberry32(3)); // tier1 無 decoy
    expect(useBell(s, mulberry32(1))).toBeNull();
    expect(s.bellUsed).toBe(false);
  });
});

describe('cycleMarkAt', () => {
  it('advances a cell through the three mark states', () => {
    const s = makeState();
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.get('2,2')).toBe('exclude');
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.get('2,2')).toBe('suspect');
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.get('2,2')).toBe('wager');
    cycleMarkAt(s, { x: 2, y: 2 });
    expect(s.marks.has('2,2')).toBe(false);
  });
});

describe('move: path and clue read log', () => {
  it('records every visited cell in order, starting from the spawn', () => {
    const s = makeState();
    move(s, { x: 0, y: 1 });
    move(s, { x: 1, y: 1 });
    expect(s.path).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
  });

  it('logs the clue index and the step it was read at', () => {
    const s = makeState({ player: { x: 1, y: 0 } }); // 線索在 (2,0)
    move(s, { x: 2, y: 0 });
    expect(s.readLog).toEqual([{ clueIndex: 0, step: 1 }]);
    expect(s.readClues.has('2,0')).toBe(true);
  });

  it('does not log the same clue twice', () => {
    const s = makeState({ player: { x: 1, y: 0 } });
    move(s, { x: 2, y: 0 });
    move(s, { x: 1, y: 0 });
    move(s, { x: 2, y: 0 });
    expect(s.readLog).toHaveLength(1);
  });

  it('logs every clue co-located on the same cell in one move, at the same step', () => {
    const s = makeState({ player: { x: 1, y: 0 } });
    // 關卡生成允許兩條線索落在同一格（clampToMap 夾邊界），在此手工重現該情境
    s.level.clues.push({
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: true,
      data: { distance: 4, tolerance: 1, windBiasNeeded: false, biasDirection: 0 },
    });
    move(s, { x: 2, y: 0 });
    expect(s.readLog).toHaveLength(2);
    expect(s.readLog[0].step).toBe(s.readLog[1].step);
    expect(s.readLog.map((r) => r.clueIndex).sort()).toEqual([0, 1]);
  });

  it('does not re-log a shared cell on repeat visits (readLog stays idempotent)', () => {
    const s = makeState({ player: { x: 1, y: 0 } });
    s.level.clues.push({
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: true,
      data: { distance: 4, tolerance: 1, windBiasNeeded: false, biasDirection: 0 },
    });
    move(s, { x: 2, y: 0 });
    move(s, { x: 1, y: 0 });
    move(s, { x: 2, y: 0 });
    expect(s.readLog).toHaveLength(2);
  });

  it('leaves readClues and readLog empty when stepping onto cells with no clue', () => {
    // C1 回歸釘子：線索唯一落在 (2,0)，(0,1)/(1,1)/(1,2) 都是空草地。
    // readClues 若少了「該格真的有線索」這個條件，會在每一步都被灌水，
    // 汙染 codex 研究筆記數、教學提示觸發時機（見 ResultScene / MapScene）。
    const s = makeState();
    move(s, { x: 0, y: 1 });
    move(s, { x: 1, y: 1 });
    move(s, { x: 1, y: 2 });
    expect(s.readClues.size).toBe(0);
    expect(s.readLog).toHaveLength(0);
  });
});

describe('toggleMute', () => {
  it('toggles a clue index in and out of the muted set', () => {
    const s = makeState();
    toggleMute(s, 0);
    expect(s.mutedClues.has(0)).toBe(true);
    toggleMute(s, 0);
    expect(s.mutedClues.has(0)).toBe(false);
  });
});

describe('newSession', () => {
  it('seeds the path with the spawn cell and empty deduction state', () => {
    const s = newSession(1, mulberry32(11));
    expect(s.path).toEqual([s.player]);
    expect(s.marks.size).toBe(0);
    expect(s.readLog).toHaveLength(0);
    expect(s.mutedClues.size).toBe(0);
  });
});
