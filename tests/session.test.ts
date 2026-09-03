import { describe, it, expect } from 'vitest';
import {
  newSession, canMove, move, cycleMarkAt, toggleWagerAt, toggleMute, resolveQte, nextSession, useBell, survey,
  currentTarget, isTargetVisible,
  TERRAIN_COST, isPassable, type SessionState,
} from '../src/core/session';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key } from '../src/core/clues';
import { SURVEY_COST } from '../src/core/vision';
import { MOVE_EVERY, ROUTE_START_INDEX, finalTarget } from '../src/core/route';
import type { Level, TerrainType } from '../src/core/types';

// 手工關卡：5x5 全草地，目標 (4,4)，補給 (1,0)，scent 線索 (2,0)
function makeState(overrides: Partial<SessionState> = {}): SessionState {
  const terrain: TerrainType[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 'meadow' as TerrainType));
  const elevation: number[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => 0.2)); // 低地：與 meadow 一致，視野不加成
  // 這批測試不涉及獵物移動，退化成五個節點都停在同一點的路線即可。
  const target = { x: 4, y: 4 };
  const level: Level = {
    round: 1, mapSize: 5,
    route: { waypoints: Array(5).fill(target), rule: 'straight' },
    clues: [{
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: false, age: 2,
      data: { distance: 4, tolerance: 1, windBiasNeeded: false, biasDirection: 0 },
    }],
    terrain, elevation, supplies: [{ x: 1, y: 0 }], creatureId: 'mistfawn', trailheadIndex: 0, weather: 'clear', iris: false,
  };
  return {
    round: 1, level, player: { x: 0, y: 0 }, stamina: 10,
    readClues: new Set(),
    marks: new Map(), path: [{ x: 0, y: 0 }], readLog: [], mutedClues: new Set(),
    seen: new Set(), surveyed: new Set(),
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

describe('toggleWagerAt', () => {
  // F3（設計裁定）：押注不受迷霧限制——玩家可以在還沒看過的格下押注。
  it('places a wager on an unseen cell', () => {
    const s = makeState();
    expect(s.seen.has('4,4')).toBe(false);
    toggleWagerAt(s, { x: 4, y: 4 });
    expect(s.marks.get('4,4')).toBe('wager');
  });

  it('clears the wager when toggled again on the same cell', () => {
    const s = makeState();
    toggleWagerAt(s, { x: 4, y: 4 });
    toggleWagerAt(s, { x: 4, y: 4 });
    expect(s.marks.has('4,4')).toBe(false);
  });

  it('keeps the wager unique across seen and unseen cells', () => {
    const s = makeState();
    cycleMarkAt(s, { x: 0, y: 0 }); // exclude 一個看過的格
    toggleWagerAt(s, { x: 4, y: 4 }); // 未看過的格下押注
    toggleWagerAt(s, { x: 3, y: 3 }); // 另一個未看過的格改押注
    expect(s.marks.get('0,0')).toBe('exclude'); // 不受影響
    expect(s.marks.has('4,4')).toBe(false); // 舊押注被清掉
    expect(s.marks.get('3,3')).toBe('wager');
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
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: true, age: 2,
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
      type: 'scent', position: { x: 2, y: 0 }, isDecoy: true, age: 2,
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

describe('terrain cost tiers', () => {
  it('spreads cost across three passable tiers plus an impassable one', () => {
    expect(TERRAIN_COST.meadow).toBe(1);
    expect(TERRAIN_COST.mist).toBe(1);
    expect(TERRAIN_COST.thicket).toBe(2);
    expect(TERRAIN_COST.rock).toBe(4);
    expect(Number.isFinite(TERRAIN_COST.cliff)).toBe(false);
  });

  it('isPassable rejects only cliffs', () => {
    expect(isPassable('meadow')).toBe(true);
    expect(isPassable('rock')).toBe(true);
    expect(isPassable('cliff')).toBe(false);
  });
});

describe('canMove: cliffs', () => {
  it('refuses to enter a cliff no matter how much stamina remains', () => {
    const s = makeState({ stamina: 9999 });
    s.level.terrain[1][0] = 'cliff';
    expect(canMove(s, { x: 0, y: 1 })).toBe(false);
  });

  it('a blocked move changes nothing — no step, no stamina, no phase change', () => {
    const s = makeState({ stamina: 10 });
    s.level.terrain[1][1] = 'cliff';
    move(s, { x: 1, y: 1 });
    expect(s.player).toEqual({ x: 0, y: 0 });
    expect(s.stamina).toBe(10);
    expect(s.steps).toBe(0);
    expect(s.phase).toBe('explore');
  });

  it('cliffs alone never strand the player — retreat is always available', () => {
    const s = makeState({ stamina: 50 });
    // 除了來路 (0,0) 之外，把 (1,1) 的所有界內鄰格封死
    for (const [x, y] of [[1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]] as const) {
      s.level.terrain[y][x] = 'cliff';
    }
    move(s, { x: 1, y: 1 });
    expect(s.player).toEqual({ x: 1, y: 1 });
    // 還退得回 (0,0)，所以不算力竭——力竭永遠來自體力歸零，不是被崖壁圍死
    expect(s.phase).toBe('explore');
  });
});

describe('vision', () => {
  it('seeds seen with the spawn vision and the trailhead cell', () => {
    const s = newSession(1, mulberry32(11));
    expect(s.seen.has(key(s.player))).toBe(true);
    expect(s.seen.has(key(s.level.clues[s.level.trailheadIndex].position))).toBe(true);
  });

  it('does not start with the whole map revealed', () => {
    const s = newSession(9, mulberry32(11)); // 25x25 = 625 格
    expect(s.seen.size).toBeLessThan(s.level.mapSize * s.level.mapSize);
  });

  it('reveals new ground as the player moves', () => {
    const s = makeState();
    const before = s.seen.size;
    move(s, { x: 1, y: 1 });
    expect(s.seen.size).toBeGreaterThan(before);
  });

  it('never forgets ground already seen', () => {
    const s = makeState();
    move(s, { x: 1, y: 1 });
    const far = [...s.seen];
    move(s, { x: 0, y: 0 });
    for (const k of far) expect(s.seen.has(k)).toBe(true);
  });
});

describe('survey', () => {
  it('spends stamina and reveals a wider ring than standing vision', () => {
    const s = makeState({ stamina: 20 });
    const before = s.seen.size;
    expect(survey(s)).toBe(true);
    expect(s.stamina).toBe(20 - SURVEY_COST);
    expect(s.seen.size).toBeGreaterThan(before);
  });

  it('refuses a second look from the same cell — no stamina drain for nothing', () => {
    const s = makeState({ stamina: 20 });
    survey(s);
    const after = s.stamina;
    expect(survey(s)).toBe(false);
    expect(s.stamina).toBe(after);
  });

  it('allows another look after moving somewhere new', () => {
    const s = makeState({ stamina: 20 });
    survey(s);
    move(s, { x: 1, y: 1 });
    expect(survey(s)).toBe(true);
  });

  it('refuses when stamina would not cover it', () => {
    const s = makeState({ stamina: SURVEY_COST - 1 });
    expect(survey(s)).toBe(false);
    expect(s.stamina).toBe(SURVEY_COST - 1);
  });

  it('does not count as a step — steps measure walking', () => {
    const s = makeState({ stamina: 20 });
    survey(s);
    expect(s.steps).toBe(0);
  });

  it('is refused outside the explore phase', () => {
    const s = makeState({ stamina: 20, phase: 'qte' });
    expect(survey(s)).toBe(false);
  });

  it('exhausts when stamina lands at exactly the survey cost (F1 soft-lock boundary)', () => {
    // 體力恰好等於 SURVEY_COST：眺望花完體力歸零，此後沒有任何移動負擔得起。
    // survey() 必須和 move() 一樣在此時宣告 phase = 'exhausted'，否則玩家會卡在
    // 一個永遠回不到 'exhausted' 的 'explore' 狀態（見 F1 修正說明）。
    const s = makeState({ stamina: SURVEY_COST });
    expect(survey(s)).toBe(true);
    expect(s.stamina).toBe(0);
    expect(s.phase).toBe('exhausted');
  });

  it('exhausts on soft-lock when the post-survey remainder is positive but affords no neighbour (G3)', () => {
    // F1 的力竭收尾判斷是 `stamina <= 0 || !hasAffordableMove(s)` 兩個子句。上一條
    // 測試只驗證了 stamina 恰好歸零那一半；這裡補上另一半：眺望花完後體力還剩
    // 正數，但比周圍任何鄰格的地形成本都便宜——這正是刪掉 !hasAffordableMove(s)
    // 那截會漏掉的軟鎖情境。玩家站在 (0,0)（地圖角落，只有 3 個界內鄰格），
    // 把這三格全部改成密叢（成本 2）；體力 5 減去 SURVEY_COST(4) 剩 1，1 < 2，
    // 三個鄰格都負擔不起。
    const s = makeState({ stamina: SURVEY_COST + 1, player: { x: 0, y: 0 } });
    const terrain = s.level.terrain;
    terrain[0][1] = 'thicket';
    terrain[1][0] = 'thicket';
    terrain[1][1] = 'thicket';
    expect(survey(s)).toBe(true);
    expect(s.stamina).toBe(1);
    expect(s.phase).toBe('exhausted');
  });
});

describe('currentTarget: 獵物會沿路線移動', () => {
  it('開局時就是路線的起始節點', () => {
    const s = newSession(1, mulberry32(3));
    expect(currentTarget(s)).toEqual(s.level.route.waypoints[ROUTE_START_INDEX]);
  });

  it('步數累積到一個週期就換節點', () => {
    const s = newSession(1, mulberry32(3));
    const before = currentTarget(s);
    s.steps = MOVE_EVERY;
    const after = currentTarget(s);
    expect(after).toEqual(s.level.route.waypoints[ROUTE_START_INDEX + 1]);
    expect(after).not.toEqual(before);
  });

  it('走到覓食地就停住', () => {
    const s = newSession(1, mulberry32(3));
    s.steps = MOVE_EVERY * 50;
    expect(currentTarget(s)).toEqual(finalTarget(s.level.route));
  });
});

describe('isTargetVisible', () => {
  it('站在獵物身上一定看得見', () => {
    const s = newSession(1, mulberry32(5));
    s.player = { ...currentTarget(s) };
    expect(isTargetVisible(s)).toBe(true);
  });

  it('隔著整張地圖看不見', () => {
    const s = newSession(1, mulberry32(5));
    const t = currentTarget(s);
    s.player = { x: t.x >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1, y: t.y >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1 };
    expect(isTargetVisible(s)).toBe(false);
  });

  it('看得見與否只看當前位置，不受 seen 影響', () => {
    // seen 是單向累積的「看過的地」，而獵物會離開。用 seen 判斷會讓牠走掉之後
    // 還畫在原地——玩家會追一個已經不在那裡的影子。
    const s = newSession(1, mulberry32(5));
    const t = currentTarget(s);
    s.seen.add(key(t));
    s.player = { x: t.x >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1, y: t.y >= s.level.mapSize / 2 ? 0 : s.level.mapSize - 1 };
    expect(isTargetVisible(s)).toBe(false);
  });
});
