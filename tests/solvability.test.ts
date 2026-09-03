import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { generateLevelFor } from '../src/core/generate';
import { getDifficulty } from '../src/core/difficulty';
import { routeCostsFrom } from '../src/core/path';
import { startCorner } from '../src/core/terrain';
import { key } from '../src/core/clues';
import { targetAt, MOVE_EVERY, ROUTE_START_INDEX } from '../src/core/route';
import { CREATURES } from '../src/data/creatures';
import type { Level } from '../src/core/types';

// 理想路線的體力成本：出生角 → 起始蹤跡 → 另一條真線索 → 攔截點。
// 「攔截點」不是獵物現在的位置，而是玩家抵達時牠會在的節點——
// 這正是這一階要求玩家做的預測，成本估算若不含這一項就是在騙自己。
function idealCost(L: Level): number {
  const start = startCorner(L.mapSize, L.route.waypoints[ROUTE_START_INDEX]);
  const real = L.clues.filter((c) => !c.isDecoy);
  const trailhead = L.clues[L.trailheadIndex].position;

  // routeCostsFrom 是一次 Dijkstra，回傳「從該點到全圖每一格」的成本表。
  // 每個起點只算一次並重用——放進迴圈裡逐條線索重算，會讓這支掃描慢上一個數量級。
  const fromStart = routeCostsFrom(L.terrain, start);
  const fromTrailhead = routeCostsFrom(L.terrain, trailhead);
  const at = (table: Map<string, number>, to: { x: number; y: number }): number =>
    table.get(key(to)) ?? Infinity;

  // 第二條線索取「離起始蹤跡最近的另一條真線索」——玩家的合理選擇
  let second = trailhead;
  let bestSecond = Infinity;
  for (const c of real) {
    if (key(c.position) === key(trailhead)) continue;
    const cost = at(fromTrailhead, c.position);
    if (cost < bestSecond) { bestSecond = cost; second = c.position; }
  }
  const legA = at(fromStart, trailhead);
  const legB = bestSecond;
  // 走到這裡已經花了多少步？以「每一步平均 1.6 點」回推（terrain 成本 1/2/4 的加權均值）
  const stepsSoFar = Math.round((legA + legB) / 1.6);
  const intercept = targetAt(L.route, stepsSoFar);
  return legA + legB + at(routeCostsFrom(L.terrain, second), intercept);
}

describe('可解性掃描（規格 §8）', () => {
  it('理想路線在 98% 以上的種子裡走得完', () => {
    let total = 0;
    let ok = 0;
    const failures: string[] = [];
    for (const creature of CREATURES) {
      for (const round of [1, 5, 9]) {
        for (let seed = 1; seed <= 40; seed++) {
          const L = generateLevelFor(round, mulberry32(seed * 131 + round), creature.id);
          const budget = getDifficulty(round).staminaBudget;
          const cost = idealCost(L);
          total++;
          if (cost <= budget) ok++;
          else failures.push(`${creature.id} r${round} seed${seed}: ${Math.round(cost)} > ${budget}`);
        }
      }
    }
    // 失敗時把前幾筆印出來——知道是哪一隻生物、哪一個難度出事，比只知道比率有用得多
    if (ok / total < 0.98) console.log(failures.slice(0, 20).join('\n'));
    expect(ok / total).toBeGreaterThanOrEqual(0.98);
  });

  it('每一齡追加的線索數不失控', () => {
    // 逐齡收斂若逼生成器狂加線索，圖上會到處是 token，反而更難讀。
    // 把它量出來，讓 PER_AGE_MAX_INTERSECTION 是一個有數據的選擇。
    let maxClues = 0;
    for (const creature of CREATURES) {
      for (let seed = 1; seed <= 40; seed++) {
        const L = generateLevelFor(9, mulberry32(seed * 977), creature.id);
        maxClues = Math.max(maxClues, L.clues.length);
      }
    }
    expect(maxClues).toBeLessThanOrEqual(14);
  });
});
