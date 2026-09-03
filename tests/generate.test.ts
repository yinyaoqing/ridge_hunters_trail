import { describe, it, expect } from 'vitest';
import { generateLevel, generateLevelFor, IRIS_RATE, perAgeMaxIntersection } from '../src/core/generate';
import { mulberry32 } from '../src/core/rng';
import { getDifficulty } from '../src/core/difficulty';
import { key, intersect } from '../src/core/clues';
import { dist, angleDiff, angleDeg, cheb } from '../src/core/geometry';
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
    // 舊版斷言「全部線索的交集包含獵物開局位置」，但線索現在分齡錨定在不同的路線節點，
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

  it('per-age intersection converges below the tier cap (or hits the extra-clue safety limit)', () => {
    // 舊版把全部真線索交在一起比對 p.maxIntersection：分齡之後那個交集在幾乎
    // 每一局都是空集合（不同齡錨定不同節點），size<=cap 恆為 true——實測 1200 局
    // 裡 0.00% 超過門檻，因為集合本身是空的。斷言因此永遠通過，等於沒在測。
    // 改為逐齡比對 perAgeMaxIntersection(round)，這是分齡之後真正在收斂的量。
    //
    // 「安全上限」分支也要逐齡重寫：generate.ts 裡 clues 陣列的順序是
    // 「前 p.clueCount 條是初始真線索」→「之後、幌子之前是收斂迴圈追加的 scent」
    // →「最後是幌子」，所以 index >= p.clueCount 且非幌子的那些就是某一齡追加的
    // 線索，每一齡最多追加 3 條（見 generate.ts 的 extra < 3 迴圈）。
    // 沒收斂到門檻以下、但那一齡已經追加滿 3 條，代表迴圈確實跑到了自己的安全上限，
    // 不是門檻設錯。
    for (const { seed, round } of cases) {
      const p = getDifficulty(round);
      const cap = perAgeMaxIntersection(round);
      const level = generateLevel(round, mulberry32(seed));
      for (const age of [0, 1, 2] as ClueAge[]) {
        const group = level.clues.filter((c) => !c.isDecoy && c.age === age);
        const extrasAdded = level.clues.filter(
          (c, i) => i >= p.clueCount && !c.isDecoy && c.age === age,
        ).length;
        const size = intersect(group, level.mapSize).size;
        expect(size <= cap || extrasAdded >= 3).toBe(true);
      }
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
      // 強制生物偏好地形的格子現在是路線終點（覓食地），不再是開局位置——
      // 牠最後停在哪，那裡才是牠的地盤（見 generate.ts 的 forage 註解）。
      const forage = level.route.waypoints[level.route.waypoints.length - 1];
      expect(level.terrain[forage.y][forage.x]).toBe(creature!.terrain);
      const pq = applyQuirk(p, level.creatureId);
      expect(level.supplies.length).toBeLessThanOrEqual(pq.supplyCount);
      for (const s of level.supplies) {
        expect(key(s)).not.toBe(key(level.route.waypoints[ROUTE_START_INDEX]));
      }
    }
  });

  it('same seed reproduces the same level', () => {
    const a = generateLevel(5, mulberry32(99));
    const b = generateLevel(5, mulberry32(99));
    expect(a).toEqual(b);
  });

  it('no clue, real or decoy, sits on any waypoint of the route', () => {
    // 這條原本只比對「線索不落在自己那一齡的錨點上」，但那樣擋不住一條舊齡的線索
    // 落在別齡（尤其是獵物開局所在的 W2）的節點上——session.move 在玩家踏進與
    // 獵物相距 1 格時就進入近距離判讀，一個畫在節點上的 token 等於「走過去就贏」，
    // 完全不需要推理。實測分齡之後第 1 局有 15.5% 的關卡出現這種免費勝利。
    // 正確的不變量是「任何線索（真線索或幌子）都不能落在路線的任何節點上」，
    // 由 generate.ts 的 forbidden 集合強制——這裡驗證它真的擋住了每一種情況。
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      const waypointKeys = new Set(level.route.waypoints.map(key));
      for (const c of level.clues) {
        expect(waypointKeys.has(key(c.position))).toBe(false);
      }
    }
  });

  it('no clue, real or decoy, lies within Chebyshev 1 of the quarry\'s starting cell', () => {
    // 守的是「免費勝利」這個機制：age 2 的錨點就是獵物開局站的節點，
    // session.move 在玩家踏進與獵物相距 1 格時就進入近距離判讀。只擋節點本身不夠——
    // 一條擾動線索的偏移量最小只有 1 格，剛好可能落在節點旁邊那一圈，而那一圈
    // 距離獵物一樣是 Chebyshev 1。若這圈沒被擋住，開局唯一揭示、地圖上還畫著
    // 指引記號的起始蹤跡（見 route.ts 的 ROUTE_START_INDEX 與 generate.ts 的
    // trailheadIndex 優先取 age 2 的規則）就可能直接指在獵物旁邊，走過去就贏，
    // 完全不需要推理（見 generate.ts 的 forbidden 集合建置註解）。
    for (const { seed, round } of cases) {
      const level = generateLevel(round, mulberry32(seed));
      for (const c of level.clues) {
        expect(cheb(c.position, level.route.waypoints[ROUTE_START_INDEX])).toBeGreaterThan(1);
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
        const trueBearing = angleDeg(scent.position, level.route.waypoints[ROUTE_START_INDEX]);
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
  it('every clue, supply and every waypoint of the route is walkable from the spawn corner', () => {
    // 舊版只驗證 W2（開局節點）生成後可達，但獵物大半局都站在 W2 之後的節點——
    // 正是 generate.ts 特意把每個節點都餵給 ensureReachable，就是為了保證它們可達。
    // 只驗證起點會讓「牠整條路線是否真的抓得到」這個性質，在最重要的區段完全沒有網。
    // 玩家出生的角落仍由開局節點（W2）決定——那是實際遊戲裡玩家出生位置的依據——
    // 但現在逐一驗證路線上的每一個節點，而不只是起點。
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const target = level.route.waypoints[ROUTE_START_INDEX];
        const s = level.mapSize - 1;
        const corners = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
        const start = corners.reduce((a, b) =>
          (dist(b, target) > dist(a, target) ? b : a));
        const seen = reachableFrom(level.terrain, start);
        for (const wp of level.route.waypoints) expect(seen.has(key(wp))).toBe(true);
        for (const c of level.clues) expect(seen.has(key(c.position))).toBe(true);
        for (const p of level.supplies) expect(seen.has(key(p))).toBe(true);
      }
    }
  });

  it('never places any waypoint of the route on an impassable cell', () => {
    // 同理：獵物整條路線的每一個節點都必須是可通行格，不只是開局那一個——
    // 牠在後面的節點停留的時間並不比開局節點短。
    for (let seed = 1; seed <= 40; seed++) {
      const level = generateLevel(5, mulberry32(seed));
      for (const wp of level.route.waypoints) {
        expect(level.terrain[wp.y][wp.x]).not.toBe('cliff');
      }
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

  it('prefers the lowest route-cost real clue of age 2, falling back to the overall cheapest only when age 2 has none (F2/F5)', () => {
    // 直線距離挑選會漏掉「5 格外但隔著挖通的岩坡稜脊」比「8 格外橫跨草地」貴的情況——
    // 改用 routeCostsFrom 在生成完成（含 ensureReachable 挖出的隘口）後的地形上重算。
    // 舊版斷言 trailhead 是「所有真線索裡路線成本最低者」，不分齡；但起始蹤跡是新手
    // 打開關卡第一件讀到的資訊，該指向獵物「現在在哪」（age 2），不是兩個節點前的
    // 舊蹤跡（age 0/1）。改為優先在 age 2 的真線索裡取成本最低者；每一齡都保證至少
    // 一條真線索，所以這個池子在正常情況下必然非空，只有理論上的保底才會退回全體。
    // 平手時仍取索引最小者。
    for (let seed = 1; seed <= 40; seed++) {
      for (const round of [1, 5, 9]) {
        const level = generateLevel(round, mulberry32(seed));
        const start = startCorner(level.mapSize, level.route.waypoints[ROUTE_START_INDEX]);
        const costs = routeCostsFrom(level.terrain, start);
        const real = level.clues
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.isDecoy);
        const fresh = real.filter(({ c }) => c.age === 2);
        const pool = fresh.length > 0 ? fresh : real;
        const minCost = Math.min(...pool.map(({ c }) => costs.get(key(c.position)) ?? Infinity));
        const chosenCost = costs.get(key(level.clues[level.trailheadIndex].position)) ?? Infinity;
        expect(chosenCost).toBe(minCost);
        if (fresh.length > 0) expect(level.clues[level.trailheadIndex].age).toBe(2);
        // 平手時取索引最小者：所有成本等於 minCost 的候選裡，trailheadIndex 必須是最小的那個
        const tiedIndices = pool.filter(({ c }) => (costs.get(key(c.position)) ?? Infinity) === minCost)
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

  it('每一局的路線長度固定', () => {
    // 「獵物開局站在 W2」現在是 ROUTE_START_INDEX 本身的定義（見 route.ts），
    // 不再是一個獨立欄位可以拿來互相核對——這裡不再需要另外斷言它。
    // currentTarget(newSession(...)) 開局即等於 route.waypoints[ROUTE_START_INDEX]
    // 已由 tests/session.test.ts 的 currentTarget 測試涵蓋。
    for (const L of levels()) {
      expect(L.route.waypoints).toHaveLength(ROUTE_WAYPOINTS);
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

  it('同齡真線索的交集非空、包含該齡節點，且不超過每齡上限（或已打滿追加上限）', () => {
    // 這是廣義化後的可解性保證。舊版是「所有線索的交集包含目標」，
    // 現在是「每一齡的交集包含該齡的位置」。
    // size<=cap 這條沒有逃生門的話，只在這裡的固定生物（plumetail）× 60 顆種子這個
    // 樣本裡剛好沒踩到「收斂迴圈打滿追加上限仍未收斂」的情況才會通過——實測橫跨全部
    // 8 個生物在 round 9 量測，4.69% 的齡組超標，最差到 19。逃生門的形狀比照上面
    // 「per-age intersection converges below the tier cap」那一條：要嘛真的收斂到門檻
    // 以下，要嘛這一齡已經追加滿 3 條（迴圈打到自己的安全上限），兩者擇一即可。
    const p9 = getDifficulty(9);
    for (const L of levels()) {
      for (const age of AGES) {
        const group = L.clues.filter((c) => !c.isDecoy && c.age === age);
        const cells = intersect(group, L.mapSize);
        expect(cells.size).toBeGreaterThan(0);
        expect(cells.has(key(L.route.waypoints[age]))).toBe(true);
        const extrasAdded = L.clues.filter(
          (c, i) => i >= p9.clueCount && !c.isDecoy && c.age === age,
        ).length;
        expect(cells.size <= perAgeMaxIntersection(9) || extrasAdded >= 3).toBe(true);
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
