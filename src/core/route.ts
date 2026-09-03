import { clampToMap, pointOnCircle, angleDeg, angleDiff, type Vec2 } from './geometry';
import type { Rng } from './rng';
import { isPassable } from './terrain';
import type { TerrainType } from './types';

// 物種的移動規則。這是 Phase 6a 把「個性」從隱形的生成參數乘法，換成
// 可觀察、可學習、可預測的行為——玩家玩過兩次就會知道「紗霧蛾會折返，別直線外推」。
export type RouteRule = 'lowland' | 'highland' | 'cover' | 'straight' | 'doubling';

export const ROUTE_WAYPOINTS = 5;   // W0..W4
export const ROUTE_START_INDEX = 2; // 開局時獵物站在 W2：W0/W1/W2 是過去（線索留在那裡），W3/W4 是未來
export const MOVE_EVERY = 12;       // 每 12 步前進一個節點

// 節距（格）。直行的走得遠，貼著掩蔽的走得短——節距本身也是個性的一部分。
const SPACING: Record<RouteRule, number> = {
  lowland: 4, highland: 4, cover: 3, straight: 5, doubling: 4,
};

const RULE_BY_CREATURE: Record<string, RouteRule> = {
  mistfawn: 'lowland',
  emberquill: 'highland',
  thicketloom: 'cover',
  dewhopper: 'straight',
  veilmoth: 'doubling',
  lanternshrew: 'cover',
  ridgecrest: 'highland',
  plumetail: 'straight',
};

export function routeRuleFor(creatureId: string): RouteRule {
  return RULE_BY_CREATURE[creatureId] ?? 'straight';
}

export interface Route {
  waypoints: Vec2[]; // 長度恆為 ROUTE_WAYPOINTS
  rule: RouteRule;   // 揭曉畫面用它說明這個物種怎麼走
}

// 獵物在第 steps 步時的位置。抵達最後一個節點（覓食地）後就停住——
// 有終點才有「牠最後會在哪」這個可被外推的答案，押注因此是預測而非描述。
export function targetAt(route: Route, steps: number): Vec2 {
  const i = Math.min(
    ROUTE_START_INDEX + Math.floor(steps / MOVE_EVERY),
    route.waypoints.length - 1,
  );
  return route.waypoints[i];
}

export function finalTarget(route: Route): Vec2 {
  return route.waypoints[route.waypoints.length - 1];
}

// 候選方位數：在節距半徑上取 16 個等分角。刻意不消耗 rng——
// 路線的隨機性全部來自起點，之後每一步都是規則的確定性結果，
// 玩家因此學得會「這個物種怎麼走」。若每一步都再擲一次骰，個性就退化成雜訊。
const CANDIDATE_ANGLES = 16;

export function buildRoute(
  rng: Rng, terrain: TerrainType[][], elevation: number[][], size: number, rule: RouteRule,
): Route {
  const waypoints: Vec2[] = [randomPassable(rng, terrain, size)];
  for (let i = 1; i < ROUTE_WAYPOINTS; i++) {
    waypoints.push(nextWaypoint(waypoints, SPACING[rule], rule, terrain, elevation, size));
  }
  return { waypoints, rule };
}

function randomPassable(rng: Rng, terrain: TerrainType[][], size: number): Vec2 {
  for (let i = 0; i < 60; i++) {
    const p = { x: Math.floor(rng() * size), y: Math.floor(rng() * size) };
    if (isPassable(terrain[p.y][p.x])) return p;
  }
  // 保底：整張圖幾乎全是崖壁時掃出第一個可通行格。純掃描、不再消耗 rng，
  // 因此不影響同一顆種子的決定性。
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (isPassable(terrain[y][x])) return { x, y };
  }
  return { x: 0, y: 0 };
}

// 下一個節點：在節距半徑上取等分方位為候選，夾進圖內、剔除崖壁與已用過的節點，
// 再依規則評分取最佳者。平手取索引最小者以維持決定性。
function nextWaypoint(
  sofar: Vec2[], spacing: number, rule: RouteRule,
  terrain: TerrainType[][], elevation: number[][], size: number,
): Vec2 {
  const from = sofar[sofar.length - 1];
  const prev = sofar.length >= 2 ? sofar[sofar.length - 2] : null;
  const heading = prev ? angleDeg(prev, from) : null;
  const used = new Set(sofar.map((w) => `${w.x},${w.y}`));

  const candidates: Vec2[] = [];
  for (let i = 0; i < CANDIDATE_ANGLES; i++) {
    const p = clampToMap(pointOnCircle(from, spacing, (360 / CANDIDATE_ANGLES) * i), size);
    if (!isPassable(terrain[p.y][p.x])) continue;
    if (used.has(`${p.x},${p.y}`)) continue;
    candidates.push(p);
  }
  if (candidates.length === 0) return nearestUnusedPassable(from, used, terrain, size);

  // 續行傾向：同分時偏好維持原方向。除了讓路線好看，也避免評分平手時
  // 永遠選到 0 度（正東）那個候選，讓路線退化成一律往右。
  const straightness = (p: Vec2): number =>
    heading === null ? 0 : -angleDiff(angleDeg(from, p), heading);

  const score = (p: Vec2): number => {
    switch (rule) {
      case 'lowland': return -elevation[p.y][p.x] + straightness(p) / 1000;
      case 'highland': return elevation[p.y][p.x] + straightness(p) / 1000;
      case 'cover': return (terrain[p.y][p.x] === 'thicket' ? 1 : 0) + straightness(p) / 1000;
      case 'straight': return straightness(p);
      // 折返：前兩段照直行走出去，後兩段反過來——轉角越大越好
      case 'doubling': return sofar.length <= 2 ? straightness(p) : -straightness(p);
    }
  };

  let best = candidates[0];
  let bestScore = score(best);
  for (const p of candidates.slice(1)) {
    const sc = score(p);
    if (sc > bestScore) { best = p; bestScore = sc; }
  }
  return best;
}

// 候選全被崖壁或重複擋掉時的保底：由近而遠掃出第一個可通行且未用過的格。
// 回傳「不同的格」很重要——相鄰節點相同會讓獵物原地停一個週期，
// 而玩家對方向的外推會落空。
function nearestUnusedPassable(
  from: Vec2, used: Set<string>, terrain: TerrainType[][], size: number,
): Vec2 {
  for (let r = 1; r < size; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: from.x + dx, y: from.y + dy };
        if (p.x < 0 || p.y < 0 || p.x >= size || p.y >= size) continue;
        if (used.has(`${p.x},${p.y}`)) continue;
        if (isPassable(terrain[p.y][p.x])) return p;
      }
    }
  }
  return from; // 全圖無處可去（實務上不可能，reach.ts 的挖通保證有通路）
}
