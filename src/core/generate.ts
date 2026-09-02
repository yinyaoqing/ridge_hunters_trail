import { randInt, pickWeighted, type Rng } from './rng';
import { dist, clampToMap, angleDeg, pointOnCircle, type Vec2 } from './geometry';
import type { Clue, ClueType, Level } from './types';
import { getDifficulty, type DifficultyParams } from './difficulty';
import { key, intersect } from './clues';
import { applyQuirk, elevationBiasFor } from './quirks';
import { buildTerrain, startCorner, elevationFor, BAND_CLIFF } from './terrain';
import { ensureReachable } from './reach';
import { applyWeather, WEATHER_POOL } from './weather';
import { CREATURES } from '../data/creatures';

export const IRIS_RATE = 0.05;

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
  type: ClueType, anchor: Vec2, p: DifficultyParams, rng: Rng, size: number, isDecoy: boolean,
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
      return { type, position: pos, isDecoy, data: { direction: angleDeg(pos, anchor), angleSpread: p.footprintSpread } };
    case 'disturbance':
      return { type, position: pos, isDecoy, data: { radius: Math.max(p.disturbanceRadius, Math.ceil(actual)) } };
    case 'scent': {
      const bias = (angleDeg(pos, anchor) + (rng() * 60 - 30) + 360) % 360;
      return { type, position: pos, isDecoy, data: { distance: Math.round(actual), tolerance: p.scentTolerance, windBiasNeeded: true, biasDirection: bias } };
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
  const targetPos = randomPos(rng, size);

  const ratio: [ClueType, number][] = [
    ['footprint', p2.typeRatio.footprint],
    ['disturbance', p2.typeRatio.disturbance],
    ['scent', p2.typeRatio.scent],
  ];

  const clues: Clue[] = [];
  for (let i = 0; i < p2.clueCount; i++) {
    clues.push(makeClue(pickWeighted(rng, ratio), targetPos, p2, rng, size, false));
  }

  // 可解性收斂檢查（規格書 4.2）：交集過大時追加 scent（環形收斂最快），上限 +5
  for (let extra = 0; extra < 5; extra++) {
    if (intersect(clues, size).size <= p2.maxIntersection) break;
    clues.push(makeClue('scent', targetPos, p2, rng, size, false));
  }

  // 干擾線索（規格書 4.2）：decoyPos 與 targetPos 距離 >= 5
  if (p2.decoyCount > 0) {
    const decoyPos = randomPosFarFrom(rng, size, targetPos, 5);
    const uniform: [ClueType, number][] = [['footprint', 1], ['disturbance', 1], ['scent', 1]];
    for (let i = 0; i < p2.decoyCount; i++) {
      clues.push(makeClue(pickWeighted(rng, uniform), decoyPos, p2, rng, size, true));
    }
  }

  const { terrain, elevation } = buildTerrain(rng, size, elevationBiasFor(creatureId));
  // 目標所在格強制為該生物的偏好地形——這也順帶保證目標永遠不落在崖壁上。
  // 同步改高程，否則 elevation 還留著雜訊原本算出來的值，跟強制後的地形對不上
  // （見 terrain.ts 的 elevationFor）。
  terrain[targetPos.y][targetPos.x] = creature.terrain;
  elevation[targetPos.y][targetPos.x] = elevationFor(creature.terrain);

  const taken = new Set([key(targetPos), ...clues.map((c) => key(c.position))]);
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

  // 物理可達性保證（見 reach.ts）：目標、所有線索、所有補給都必須從出生角走得到
  const start = startCorner(size, targetPos);
  ensureReachable(terrain, start, [targetPos, ...clues.map((c) => c.position), ...supplies]);

  // 起始蹤跡：離出生角最近的真線索。視野收窄後，出生角附近通常一條線索都看不見，
  // 開局面對全空的地圖會變成亂走——給玩家一條線可以拉，其餘的靠走與眺望自己找。
  let trailheadIndex = 0;
  let best = Infinity;
  clues.forEach((c, i) => {
    if (c.isDecoy) return;
    const d = dist(start, c.position);
    if (d < best) { best = d; trailheadIndex = i; }
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
    round, mapSize: size, targetPos, clues, terrain, elevation, supplies,
    creatureId: creature.id, trailheadIndex, weather, iris,
  };
}

export function generateLevel(round: number, rng: Rng): Level {
  const creature = CREATURES[randInt(rng, 0, CREATURES.length - 1)];
  return generateLevelFor(round, rng, creature.id);
}
