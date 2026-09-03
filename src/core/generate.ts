import { randInt, pickWeighted, type Rng } from './rng';
import { dist, clampToMap, angleDeg, pointOnCircle, type Vec2 } from './geometry';
import type { Clue, ClueAge, ClueType, Level } from './types';
import { getDifficulty, type DifficultyParams } from './difficulty';
import { key, intersect } from './clues';
import { applyQuirk, elevationBiasFor } from './quirks';
import { buildTerrain, startCorner, elevationFor, BAND_CLIFF } from './terrain';
import { ensureReachable } from './reach';
import { routeCostsFrom } from './path';
import { applyWeather, WEATHER_POOL } from './weather';
import { CREATURES } from '../data/creatures';
import { buildRoute, routeRuleFor, finalTarget, ROUTE_START_INDEX, type Route } from './route';

export const IRIS_RATE = 0.05;

// 每一齡交集的上限。刻意與 difficulty 的 maxIntersection 脫鉤：分齡之後每一齡的
// 線索數只有全部的三分之一，沿用同一個門檻會逼生成器狂加線索，圖上到處是 token
// 反而更難讀。這個值由 tests/solvability.test.ts 的實測校準。
export const PER_AGE_MAX_INTERSECTION = 10;

// 真線索的齡分佈：先保證每一齡各一條，其餘偏向較新的齡——新鮮的痕跡本來就比較多，
// 而且讓玩家最常拿到的是最接近獵物現在位置的資訊。
const AGE_WEIGHTS: [ClueAge, number][] = [[0, 1], [1, 2], [2, 3]];

function randomPos(rng: Rng, size: number): Vec2 {
  return { x: randInt(rng, 0, size - 1), y: randInt(rng, 0, size - 1) };
}

function randomPosFarFrom(rng: Rng, size: number, from: Vec2, minDist: number): Vec2 {
  for (let i = 0; i < 100; i++) {
    const p = randomPos(rng, size);
    if (dist(p, from) >= minDist) return p;
  }
  // 幾乎不會發生的保底：取離 from 最遠的角落
  const s = size - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, from) > dist(a, from) ? b : a));
}

// 反向錨定：線索資料一律由「夾界後的實際位置」與錨點的幾何關係計算，
// 確保錨點（目標或幌子點）必在候選集合內。
function makeClue(
  type: ClueType, anchor: Vec2, p: DifficultyParams, rng: Rng, size: number,
  isDecoy: boolean, age: ClueAge,
): Clue {
  let pos: Vec2 = anchor;
  for (let i = 0; i < 12; i++) {
    const d = type === 'disturbance'
      ? randInt(rng, 1, p.disturbanceRadius)
      : randInt(rng, p.minClueDist, p.maxClueDist);
    pos = clampToMap(pointOnCircle(anchor, d, rng() * 360), size);
    if (pos.x !== anchor.x || pos.y !== anchor.y) break;
  }
  if (pos.x === anchor.x && pos.y === anchor.y) {
    pos = clampToMap({ x: anchor.x + (anchor.x === 0 ? 1 : -1), y: anchor.y }, size);
  }
  const actual = dist(pos, anchor);
  switch (type) {
    case 'footprint':
      return { type, position: pos, isDecoy, age, data: { direction: angleDeg(pos, anchor), angleSpread: p.footprintSpread } };
    case 'disturbance':
      return { type, position: pos, isDecoy, age, data: { radius: Math.max(p.disturbanceRadius, Math.ceil(actual)) } };
    case 'scent': {
      const bias = (angleDeg(pos, anchor) + (rng() * 60 - 30) + 360) % 360;
      return { type, position: pos, isDecoy, age, data: { distance: Math.round(actual), tolerance: p.scentTolerance, windBiasNeeded: true, biasDirection: bias } };
    }
  }
}

export function generateLevelFor(round: number, rng: Rng, creatureId: string): Level {
  const p = applyQuirk(getDifficulty(round), creatureId);
  const weather = pickWeighted(rng, WEATHER_POOL);
  const p2 = applyWeather(p, weather);
  const size = p2.mapSize;
  const creature = CREATURES.find((c) => c.id === creatureId)!;
  const iris = rng() < IRIS_RATE;

  // 地形先建：路線要沿著稜線／溪谷／掩蔽走，沒有地形就無從決定往哪走。
  // 這也改變了 rng 的取用順序——本階段的關卡本來就與舊版不同，無需相容。
  const { terrain, elevation } = buildTerrain(rng, size, elevationBiasFor(creatureId));
  const route = buildRoute(rng, terrain, elevation, size, routeRuleFor(creatureId));
  const targetPos = route.waypoints[ROUTE_START_INDEX];

  const ratio: [ClueType, number][] = [
    ['footprint', p2.typeRatio.footprint],
    ['disturbance', p2.typeRatio.disturbance],
    ['scent', p2.typeRatio.scent],
  ];

  // 真線索：前三條各佔一齡（保證每一齡都有東西可比對），其餘依權重偏向較新的齡
  const clues: Clue[] = [];
  for (let i = 0; i < p2.clueCount; i++) {
    const age: ClueAge = i < 3 ? (i as ClueAge) : pickWeighted(rng, AGE_WEIGHTS);
    clues.push(makeClue(pickWeighted(rng, ratio), route.waypoints[age], p2, rng, size, false, age));
  }

  // 逐齡收斂（規格 §5.2）：全部線索的交集現在本來就是空的，舊的整體檢查已失去意義。
  // 改為每一齡各自收斂——環形的 scent 收斂最快，故追加時固定用它。
  for (const age of [0, 1, 2] as ClueAge[]) {
    for (let extra = 0; extra < 3; extra++) {
      const group = clues.filter((c) => !c.isDecoy && c.age === age);
      if (intersect(group, size).size <= PER_AGE_MAX_INTERSECTION) break;
      clues.push(makeClue('scent', route.waypoints[age], p2, rng, size, false, age));
    }
  }

  // 幌子（規格 §5.1）：指派到一個已經有真線索的齡，並且**必須真的讓那一齡的交集變空**。
  // 造不出矛盾的幌子等於沒有作用——玩家只會退回數量投票，而分齡推理這條路就白開了。
  // 有限次重抽後仍造不出矛盾時寧可不放：少一個幌子是安全的，放一個無效的不是。
  if (p2.decoyCount > 0) {
    const uniform: [ClueType, number][] = [['footprint', 1], ['disturbance', 1], ['scent', 1]];
    for (let i = 0; i < p2.decoyCount; i++) {
      const age = pickWeighted(rng, AGE_WEIGHTS);
      const group = clues.filter((c) => !c.isDecoy && c.age === age);
      for (let attempt = 0; attempt < 12; attempt++) {
        const decoyPos = randomPosFarFrom(rng, size, route.waypoints[age], 5);
        const d = makeClue(pickWeighted(rng, uniform), decoyPos, p2, rng, size, true, age);
        if (intersect([...group, d], size).size === 0) { clues.push(d); break; }
      }
    }
  }

  // 強制覓食地（路線終點）為該生物的偏好地形——牠最後停在哪，那裡就該是牠的地盤。
  // 這也順帶保證終點永遠不是崖壁。
  const forage = finalTarget(route);
  terrain[forage.y][forage.x] = creature.terrain;
  elevation[forage.y][forage.x] = elevationFor(creature.terrain);

  const taken = new Set([...route.waypoints.map(key), ...clues.map((c) => key(c.position))]);
  const supplies: Vec2[] = [];
  for (let i = 0; i < 200 && supplies.length < p2.supplyCount; i++) {
    const s = randomPos(rng, size);
    // 崖壁上放補給等於放不到——ensureReachable 只保證走得到，不會把崖壁變成好走的路
    if (!taken.has(key(s)) && terrain[s.y][s.x] !== 'cliff') {
      taken.add(key(s));
      supplies.push(s);
    }
  }

  // 線索必須踩得到才能判讀；落在崖壁上的線索格先降級為岩坡（代價高但走得到）
  // ——同樣要同步高程，理由同上。
  for (const c of clues) {
    if (terrain[c.position.y][c.position.x] === 'cliff') {
      terrain[c.position.y][c.position.x] = 'rock';
      elevation[c.position.y][c.position.x] = elevationFor('rock');
    }
  }

  // 物理可達性保證（見 reach.ts）：路線上的每一個節點都要走得到——獵物會停在其中
  // 任何一個，玩家就得能追到那裡。所有線索、所有補給也都必須從出生角走得到。
  const start = startCorner(size, targetPos);
  ensureReachable(terrain, start, [...route.waypoints, ...clues.map((c) => c.position), ...supplies]);

  // 起始蹤跡：出生角走過去體力花費最低的真線索（F2：不能用直線距離——一條隔著挖通
  // 岩坡稜脊的線索，直線比較近但走過去可能貴得多）。純計算、不消耗 rng，且必須放在
  // ensureReachable 之後：挖通會改地形，成本表要反映挖通後的地圖。
  // 用一次 Dijkstra（routeCostsFrom）算出全圖成本，平手時維持既有的決定性規則——取索引最小者。
  const routeCosts = routeCostsFrom(terrain, start);
  let trailheadIndex = 0;
  let best = Infinity;
  clues.forEach((c, i) => {
    if (c.isDecoy) return;
    // 理論上 ensureReachable 已保證每條真線索都在成本表中；不在表中的（不可能發生）略過
    const cost = routeCosts.get(key(c.position));
    if (cost === undefined) return;
    if (cost < best) { best = cost; trailheadIndex = i; }
  });

  // ensureReachable 只改 terrain（見 reach.ts 開頭註解），不知道 elevation 網格的存在，
  // 所以它挖的隘口（起點降級、崖壁降級）會留下「terrain 是 rock 但 elevation 還停在
  // 崖壁那一帶」的落差。這裡補回去：凡是 rock 卻還帶著崖壁高程的格子，代表是剛被
  // ensureReachable 降級的，把高程也改成 rock 的代表值。原生的 rock 格高程本來就
  // 低於崖壁門檻，不會被這條規則誤觸。
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (terrain[y][x] === 'rock' && elevation[y][x] >= BAND_CLIFF) {
        elevation[y][x] = elevationFor('rock');
      }
    }
  }

  return {
    round, mapSize: size, route, targetPos, clues, terrain, elevation, supplies,
    creatureId: creature.id, trailheadIndex, weather, iris,
  };
}

export function generateLevel(round: number, rng: Rng): Level {
  const creature = CREATURES[randInt(rng, 0, CREATURES.length - 1)];
  return generateLevelFor(round, rng, creature.id);
}
