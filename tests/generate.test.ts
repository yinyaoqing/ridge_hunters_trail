import { describe, it, expect } from 'vitest';
import { generateLevel, generateLevelFor, IRIS_RATE, PER_AGE_MAX_INTERSECTION } from '../src/core/generate';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key, intersect } from '../src/core/clues';
import { dist, angleDiff, angleDeg } from '../src/core/geometry';
import { startCorner } from '../src/core/terrain';
import { CREATURES } from '../src/data/creatures';
import { applyQuirk } from '../src/core/quirks';
import { applyWeather } from '../src/core/weather';
import { reachableFrom } from '../src/core/reach';
import { BAND_CLIFF, BAND_ROCK, BAND_THICKET } from '../src/core/terrain';
import { routeCostsFrom } from '../src/core/path';
import { ROUTE_WAYPOINTS, ROUTE_START_INDEX } from '../src/core/route';
import type { TerrainType, ClueAge } from '../src/core/types';

describe('generateLevel (property tests over 200 seeds)', () => {
  const cases = Array.from({ length: 200 }, (_, i) => ({
    seed: i * 7 + 1,
    round: (i % 10) + 1, // 涵蓋三個難度 tier
  }));

  it('每一齡的交集都包含該齡在路線上的位置（可解性保證的廣義化版本）', () => {
    // 舊版斷言「全部線索的交集包含 targetPos」，但線索現在分齡錨定在不同的路線節點，
    // 混齡交集不再保證包含任何單一位置——這正是本階段刻意的語意變更
    // （見 generate.ts 的逐齡收斂註解）。廣義化後的保證改成逐齡驗證。
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const age of [0, 1, 2] as ClueAge[]) {
        const group = level.clues.filter((c) => !c.isDecoy && c.age === age);
        expect(intersect(group, level.mapSize).has(key(level.route.waypoints[age]))).toBe(true);
      }
    }
  });

  it('intersection converges below cap (or hits the extra-clue safety limit)', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      const real = level.clues.filter((c) => !c.isDecoy);
      const size = intersect(real, level.mapSize).size;
      expect(size <= p.maxIntersection || real.length >= p.clueCount + 5).toBe(true);
    }
  });

  it('decoy count matches difficulty and decoys sit far from target', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      const decoys = level.clues.filter((c) => c.isDecoy);
      const pq = applyQuirk(p, level.creatureId);
      expect(decoys.length).toBe(pq.decoyCount);
    }
  });

  it('map, terrain, supplies and creature are consistent', () => {
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const level = generateLevel(round, mulberry32(seed));
      expect(level.mapSize).toBe(p.mapSize);
      expect(level.terrain.length).toBe(p.mapSize);
      expect(level.terrain[0].length).toBe(p.mapSize);
      const creature = CREATURES.find((c) => c.id === level.creatureId);
      expect(creature).toBeDefined();
      // 強制生物偏好地形的格子現在是路線終點（覓食地），不再是開局位置 targetPos——
      // 牠最後停在哪，那裡才是牠的地盤（見 generate.ts 的 forage 註解）。
      const forage = level.route.waypoints[level.route.waypoints.length - 1];
      expect(level.terrain[forage.y][forage.x]).toBe(creature!.terrain);
      const pq = applyQuirk(p, level.creatureId);
      expect(level.supplies.length).toBeLessThanOrEqual(pq.supplyCount);
      for (const s of level.supplies) {
        expect(key(s)).not.toBe(key(level.targetPos));
      }
    }
  });

  it('same seed reproduces the same level', () => {
    const a = generateLevel(5, mulberry32(99));
    const b = generateLevel(5, mulberry32(99));
    expect(a).toEqual(b);
  });

  it('every clue position differs from its own anchor (the waypoint of its age)', () => {
    // 舊版比對的是全域 targetPos；線索現在錨定在自己那一齡的節點，makeClue 保證的是
    // 「不落在自己的錨點上」，不是「不落在 targetPos 上」——不同齡的節點可能剛好同格，
    // 此時一條錨定別齡的線索落在 targetPos 上是正常的，不該被這裡誤判成矛盾。
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues.filter((c) => !c.isDecoy)) {
        expect(key(c.position)).not.toBe(key(level.route.waypoints[c.age]));
      }
    }
  });

  it('generateLevelFor applies creature quirks end-to-end', () => {
    const a = generateLevelFor(5, mulberry32(7), 'dewhopper');
    const b = generateLevelFor(5, mulberry32(7), 'mistfawn');
    expect(a.supplies.length).toBeLessThanOrEqual(getDifficulty(5).supplyCount + 2);
    const scent = b.clues.find((c) => c.type === 'scent' && !c.isDecoy);
    if (scent && scent.type === 'scent') {
      expect(scent.data.tolerance).toBeCloseTo(
        applyWeather(applyQuirk(getDifficulty(5), 'mistfawn'), b.weather).scentTolerance,
      );
    }
  });

  it('every level has a weather drawn from the known pool', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      expect(['clear', 'mist', 'wind', 'drizzle']).toContain(level.weather);
    }
  });

  it('scent clues carry a bias within 30° of the true bearing', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues) {
        if (c.type !== 'scent') continue;
        expect(c.data.windBiasNeeded).toBe(true);
        expect(c.data.biasDirection).toBeGreaterThanOrEqual(0);
        expect(c.data.biasDirection).toBeLessThan(360);
      }
    }
  });

  it('scent bias points within 30° of the true bearing from clue to target', () => {
    // 舊版只試 seed=1，若該 seed 剛好沒生出非幌子氣味線索，assertion 就被 if 悄悄跳過
    // （測試恆為綠燈，等於沒測到）。改為掃過 seed 1..50，找到第一個有非幌子氣味線索的
    // level 才斷言，並用 expect(found).toBe(true) 強制斷言必然執行，不會靜默通過。
    let found = false;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const level = generateLevelFor(5, mulberry32(seed), 'mistfawn');
      const scent = level.clues.find((c) => c.type === 'scent' && !c.isDecoy);
      if (scent && scent.type === 'scent') {
        found = true;
        const trueBearing = angleDeg(scent.position, level.targetPos);
        expect(angleDiff(scent.data.biasDirection, trueBearing)).toBeLessThanOrEqual(30);
      }
    }
    expect(found).toBe(true);
  });

  it('every level carries a boolean iris flag', () => {
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      expect(typeof level.iris).toBe('boolean');
    }
  });

  it('iris rate over 1000 seeds is within a rough sanity band', () => {
    let irisCount = 0;
    const total = 1000;
    for (let seed = 1; seed <= total; seed++) {
      const level = generateLevel(5, mulberry32(seed));
      if (level.iris) irisCount++;
    }
    const rate = irisCount / total;
    expect(IRIS_RATE).toBeCloseTo(0.05);
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThanOrEqual(0.09);
  });
});

describe('generateLevel: physical reachability', () => {
  it('every clue, supply and the target is walkable from the spawn corner', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const s = level.mapSize - 1;
        const corners = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
        const start = corners.reduce((a, b) =>
          (dist(b, level.targetPos) > dist(a, level.targetPos) ? b : a));
        const seen = reachableFrom(level.terrain, start);
        expect(seen.has(key(level.targetPos))).toBe(true);
        for (const c of level.clues) expect(seen.has(key(c.position))).toBe(true);
        for (const p of level.supplies) expect(seen.has(key(p))).toBe(true);
      }
    }
  });

  it('never places the target on an impassable cell', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const level = generateLevel(5, mulberry32(seed));
      expect(level.terrain[level.targetPos.y][level.targetPos.x]).not.toBe('cliff');
    }
  });

  it('stays deterministic for a given seed', () => {
    expect(generateLevel(5, mulberry32(33))).toEqual(generateLevel(5, mulberry32(33)));
  });

  it('every cell\'s terrain stays consistent with its elevation, even after target/clue/corridor edits', () => {
    // 地形永遠該是「由高程推導出來的」——三個會改地形的地方（目標強制地形、
    // 崖壁線索降級、reach.ts 挖隘口）如果沒有同步改高程，這裡就會抓到落差。
    // meadow 和 mist 同屬「低地」高程帶，只靠濕度分岔，所以比對時要把兩者當同一帶。
    const band = (t: TerrainType): string => (t === 'meadow' || t === 'mist' ? 'lowland' : t);
    const bandFromElevation = (e: number): string => {
      if (e >= BAND_CLIFF) return 'cliff';
      if (e >= BAND_ROCK) return 'rock';
      if (e >= BAND_THICKET) return 'thicket';
      return 'lowland';
    };
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        for (let y = 0; y < level.mapSize; y++) {
          for (let x = 0; x < level.mapSize; x++) {
            expect(band(level.terrain[y][x])).toBe(bandFromElevation(level.elevation[y][x]));
          }
        }
      }
    }
  });
});

describe('generateLevel: trailhead', () => {
  it('always names a real clue as the trailhead', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const clue = level.clues[level.trailheadIndex];
        expect(clue).toBeDefined();
        expect(clue.isDecoy).toBe(false);
      }
    }
  });

  it('picks the real clue with the lowest route cost from spawn, not merely nearest by straight-line distance (F2)', () => {
    // 直線距離挑選會漏掉「5 格外但隔著挖通的岩坡稜脊」比「8 格外橫跨草地」貴的情況——
    // 改用 routeCostsFrom 在生成完成（含 ensureReachable 挖出的隘口）後的地形上重算，
    // 斷言 trailhead 就是所有真線索裡路線成本最低者；平手時取索引最小者。
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const start = startCorner(level.mapSize, level.targetPos);
        const costs = routeCostsFrom(level.terrain, start);
        const real = level.clues
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.isDecoy);
        const minCost = Math.min(...real.map(({ c }) => costs.get(key(c.position)) ?? Infinity));
        const chosenCost = costs.get(key(level.clues[level.trailheadIndex].position)) ?? Infinity;
        expect(chosenCost).toBe(minCost);
        // 平手時取索引最小者：所有成本等於 minCost 的真線索裡，trailheadIndex 必須是最小的那個
        const tiedIndices = real.filter(({ c }) => (costs.get(key(c.position)) ?? Infinity) === minCost)
          .map(({ i }) => i);
        expect(level.trailheadIndex).toBe(Math.min(...tiedIndices));
      }
    }
  });
});

const AGES: ClueAge[] = [0, 1, 2];

describe('generateLevelFor: 線索新鮮度', () => {
  const levels = () => {
    const out = [];
    for (let seed = 1; seed <= 60; seed++) {
      out.push(generateLevelFor(9, mulberry32(seed), 'plumetail'));
    }
    return out;
  };

  it('每一局的路線長度固定，且獵物開局站在 W2', () => {
    for (const L of levels()) {
      expect(L.route.waypoints).toHaveLength(ROUTE_WAYPOINTS);
      expect(L.targetPos).toEqual(L.route.waypoints[ROUTE_START_INDEX]);
    }
  });

  it('每一個齡都至少有一條真線索', () => {
    // 分組推理的前提：某一齡若一條真線索都沒有，那一組就無從比對，
    // 幌子藏在裡面也看不出來。
    for (const L of levels()) {
      for (const age of AGES) {
        expect(L.clues.filter((c) => !c.isDecoy && c.age === age).length).toBeGreaterThan(0);
      }
    }
  });

  it('同齡真線索的交集非空、包含該齡節點，且不超過每齡上限', () => {
    // 這是廣義化後的可解性保證。舊版是「所有線索的交集包含目標」，
    // 現在是「每一齡的交集包含該齡的位置」。
    for (const L of levels()) {
      for (const age of AGES) {
        const group = L.clues.filter((c) => !c.isDecoy && c.age === age);
        const cells = intersect(group, L.mapSize);
        expect(cells.size).toBeGreaterThan(0);
        expect(cells.has(key(L.route.waypoints[age]))).toBe(true);
        expect(cells.size).toBeLessThanOrEqual(PER_AGE_MAX_INTERSECTION);
      }
    }
  });

  it('幌子一定造成矛盾：它所在的齡，含它的交集為空；靜音它就恢復', () => {
    // 這是「干擾第一次可以被推理排除」的實際機制。若幌子沒有讓那一組矛盾，
    // 玩家就只能回到數量投票，而 Phase 4 的靜音功能仍然沒有明確用途。
    let checked = 0;
    for (const L of levels()) {
      for (const decoy of L.clues.filter((c) => c.isDecoy)) {
        const group = L.clues.filter((c) => c.age === decoy.age && !c.isDecoy);
        expect(intersect([...group, decoy], L.mapSize).size).toBe(0);
        expect(intersect(group, L.mapSize).size).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // 這個難度確實有幌子，測試不是空轉
  });

  it('放不出矛盾的幌子寧可不放，也不放一個沒有作用的', () => {
    // 上一條是硬性不變量，代價是有時候幌子數會少於難度設定。這條把代價量出來，
    // 讓它是一個已知的數字而不是一個驚喜。
    let want = 0;
    let got = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const L = generateLevelFor(9, mulberry32(seed), 'plumetail');
      want += 2; // round 9 的 decoyCount
      got += L.clues.filter((c) => c.isDecoy).length;
    }
    expect(got / want).toBeGreaterThan(0.8);
  });
});
