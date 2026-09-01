import { randInt, pickWeighted, type Rng } from './rng';
import { dist, clampToMap, angleDeg, pointOnCircle, type Vec2 } from './geometry';
import type { Clue, ClueType, Level, TerrainType } from './types';
import { getDifficulty, type DifficultyParams } from './difficulty';
import { key, intersect } from './clues';
import { applyQuirk, terrainPoolFor } from './quirks';
import { applyWeather, WEATHER_POOL } from './weather';
import { CREATURES } from '../data/creatures';

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

  const pool = terrainPoolFor(creatureId);
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < size; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < size; x++) row.push(pickWeighted(rng, pool));
    terrain.push(row);
  }
  terrain[targetPos.y][targetPos.x] = creature.terrain;

  const taken = new Set([key(targetPos), ...clues.map((c) => key(c.position))]);
  const supplies: Vec2[] = [];
  for (let i = 0; i < 200 && supplies.length < p2.supplyCount; i++) {
    const s = randomPos(rng, size);
    if (!taken.has(key(s))) {
      taken.add(key(s));
      supplies.push(s);
    }
  }

  return { round, mapSize: size, targetPos, clues, terrain, supplies, creatureId: creature.id, weather };
}

export function generateLevel(round: number, rng: Rng): Level {
  const creature = CREATURES[randInt(rng, 0, CREATURES.length - 1)];
  return generateLevelFor(round, rng, creature.id);
}
