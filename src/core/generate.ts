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

// 每齡交集的上限。與 difficulty 的 maxIntersection 脫鉤，但必須隨難度層縮放：
// 分齡之後每一齡只剩全部線索的三分之一，而低難度的線索本來就刻意寬鬆
// （錐半角 40 度、擾動半徑 4、氣味容差 1.0），單一線索的候選集合本來就很大。
// 用單一固定值 10 時實測第 1 局的真線索平均衝到 9.67 條——難度表寫的是 4，
// 而且比第 9 局的 7.34 還多，難度曲線整個倒過來。
//
// 三個門檻不是等比例下修就好：round<=3 的線索候選集合天生就大到即使門檻放到 14，
// 收斂迴圈仍常常打滿每齡 3 條的追加上限（實測仍有 10% 的齡組超標）。門檻必須放得
// 遠比表面數字看起來寬，才能讓多數齡組不需要靠打滿追加上限就收斂；round<=7
// 給中間值（14）；round 9 的線索本來就窄，沿用原本的 5 即可收斂。
//
// round<=3 這一檔原本設 30（14 打滿追加上限後的下一個試驗值），但沒有在中間試過別的
// 數字。逐一掃過 1,200 局後，25 同樣滿足兩個驗收條件——平均真線索數 6.57（門檻
// clueCount+3=7 以內，也仍低於 round9 的 8.47，難度曲線沒有倒過來）——同時把最新齡
// （age 2，也就是起始蹤跡所在的那一齡）的候選集合中位數收在 15 格，恰好等於
// difficulty.ts 對這一層宣稱的 maxIntersection；30 則會放到 16 格，比表面數字寬。
// 門檻在「線索代幣的視覺雜亂」與「推理精準度」之間取捨，25 是仍能守住這個承諾的
// 最寬鬆值。數值由 tests/generate.test.ts 與本檔的一次性量測腳本校準（8 個生物 ×
// 3 個難度層 × 每種 150 顆種子，共 3600 局），確認兩個性質同時成立：
//   - 三檔的真線索平均數都落在 clueCount+3 以內：round1 6.57/7、round5 7.45/8、
//     round9 8.47/9
//   - 難度曲線不再倒過來：round1 6.57 < round5 7.45 < round9 8.47
export function perAgeMaxIntersection(round: number): number {
  if (round <= 3) return 25;
  if (round <= 7) return 14;
  return 5;
}

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

// 由 from 向外一圈圈掃描，找第一個在圖內、不在 forbidden 裡、也不是錨點本身的格子。
// makeClue 的保底位移用它收尾：保底位移本身也可能剛好落在另一個節點上。
// 也要擋錨點：幌子的錨點不保證在 forbidden 裡，若保底位移落在禁區、outward 搜尋
// 又繞回錨點本身，會生出 pos === anchor 的線索——足跡的話 angleDeg(p, p) 是 0，
// 而 candidates() 的判定本來就排除線索自己所在的格，等於這條線索的候選集合
// 不含錨點，自我矛盾、悄悄失效。
function nearestAllowed(from: Vec2, forbidden: Set<string>, size: number, anchor: Vec2): Vec2 {
  for (let r = 0; r < size; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: from.x + dx, y: from.y + dy };
        if (p.x < 0 || p.y < 0 || p.x >= size || p.y >= size) continue;
        if (p.x === anchor.x && p.y === anchor.y) continue;
        if (!forbidden.has(key(p))) return p;
      }
    }
  }
  return from; // 全圖都是禁區時（實務上不可能，節點數遠少於格數）保底回傳原位置
}

// 反向錨定：線索資料一律由「夾界後的實際位置」與錨點的幾何關係計算，
// 確保錨點（目標或幌子點）必在候選集合內。
// forbidden：線索不得落在路線的任何節點上（見呼叫端 forbidden 的建置註解）——
// 這裡的重試迴圈與保底位移都必須一併遵守，否則保底分支還是會漏放一個免費勝利。
function makeClue(
  type: ClueType, anchor: Vec2, p: DifficultyParams, rng: Rng, size: number,
  isDecoy: boolean, age: ClueAge, forbidden: Set<string>,
): Clue {
  let pos: Vec2 = anchor;
  for (let i = 0; i < 12; i++) {
    const d = type === 'disturbance'
      ? randInt(rng, 1, p.disturbanceRadius)
      : randInt(rng, p.minClueDist, p.maxClueDist);
    const candidate = clampToMap(pointOnCircle(anchor, d, rng() * 360), size);
    if ((candidate.x !== anchor.x || candidate.y !== anchor.y) && !forbidden.has(key(candidate))) {
      pos = candidate;
      break;
    }
  }
  if (pos.x === anchor.x && pos.y === anchor.y) {
    pos = clampToMap({ x: anchor.x + (anchor.x === 0 ? 1 : -1), y: anchor.y }, size);
    // 保底位移也可能落在禁區（例如剛好挪到另一個節點上）：由此向外掃到第一個
    // 在圖內且不在 forbidden 裡的格子。
    if (forbidden.has(key(pos))) {
      pos = nearestAllowed(pos, forbidden, size, anchor);
    }
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

  // 線索不得落在路線的任何節點上，也不得落在「獵物起始格」周圍一圈。
  // 節點本身：獵物會依序停在每一個，token 畫在上面等於走過去就贏。
  // 起始格周圍一圈：session.move 在玩家踏進與獵物相距 1 格時就進入近距離判讀，
  // 而起始蹤跡（開局唯一揭示、地圖上還畫了指引記號的那一條）取的是最新齡，
  // 最新齡的錨點正是起始格——擾動線索的偏移量最小是 1 格，因此不擋這一圈的話
  // 實測 14–16% 的關卡會以「一個指著獵物旁邊的箭頭」開場，跟著走就結束，
  // 完全不需要推理。這比它取代的「線索剛好落在起始格上」更糟，因為那是碰運氣，
  // 這是遊戲主動叫你去做的唯一一件事。
  const forbidden = new Set<string>(route.waypoints.map(key));
  const startCell = route.waypoints[ROUTE_START_INDEX];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const p = { x: startCell.x + dx, y: startCell.y + dy };
      if (p.x >= 0 && p.y >= 0 && p.x < size && p.y < size) forbidden.add(key(p));
    }
  }

  const ratio: [ClueType, number][] = [
    ['footprint', p2.typeRatio.footprint],
    ['disturbance', p2.typeRatio.disturbance],
    ['scent', p2.typeRatio.scent],
  ];

  // 真線索：前三條各佔一齡（保證每一齡都有東西可比對），其餘依權重偏向較新的齡
  const clues: Clue[] = [];
  for (let i = 0; i < p2.clueCount; i++) {
    const age: ClueAge = i < 3 ? (i as ClueAge) : pickWeighted(rng, AGE_WEIGHTS);
    clues.push(makeClue(pickWeighted(rng, ratio), route.waypoints[age], p2, rng, size, false, age, forbidden));
  }

  // 逐齡收斂（規格 §5.2）：全部線索的交集現在本來就是空的，舊的整體檢查已失去意義。
  // 改為每一齡各自收斂——環形的 scent 收斂最快，故追加時固定用它。上限隨難度層縮放
  // （見 perAgeMaxIntersection 的註解）。
  const perAgeCap = perAgeMaxIntersection(round);
  for (const age of [0, 1, 2] as ClueAge[]) {
    for (let extra = 0; extra < 3; extra++) {
      const group = clues.filter((c) => !c.isDecoy && c.age === age);
      if (intersect(group, size).size <= perAgeCap) break;
      clues.push(makeClue('scent', route.waypoints[age], p2, rng, size, false, age, forbidden));
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
        const d = makeClue(pickWeighted(rng, uniform), decoyPos, p2, rng, size, true, age, forbidden);
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
  // 起始蹤跡優先選 age 2（新鮮）的真線索：這是新手打開關卡第一件讀到的資訊，
  // 該指向獵物「現在在哪」，不是兩個節點前的舊蹤跡。只有在這一局完全沒有
  // age 2 真線索（理論上不會發生，AGE_WEIGHTS 保證每齡至少一條，但仍保底）時，
  // 才退回舊規則：所有真線索裡成本最低者。兩條規則都維持既有的決定性平手規則——
  // 同成本取索引最小者（下面按索引升冪掃描、只在嚴格更低時才換人）。
  const pickCheapestIndex = (pool: { c: Clue; i: number }[]): number | null => {
    let idx: number | null = null;
    let best = Infinity;
    for (const { c, i } of pool) {
      // 理論上 ensureReachable 已保證每條真線索都在成本表中；不在表中的（不可能發生）略過
      const cost = routeCosts.get(key(c.position));
      if (cost === undefined) continue;
      if (cost < best) { best = cost; idx = i; }
    }
    return idx;
  };
  const real = clues.map((c, i) => ({ c, i })).filter(({ c }) => !c.isDecoy);
  const fresh = real.filter(({ c }) => c.age === 2);
  const trailheadIndex = pickCheapestIndex(fresh) ?? pickCheapestIndex(real) ?? 0;

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
