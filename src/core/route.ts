import { clampToMap, pointOnCircle, angleDeg, angleDiff, type Vec2 } from './geometry';
import type { Rng } from './rng';
import { isPassable } from './terrain';
import type { TerrainType } from './types';

// 物種的移動規則。這是 Phase 6a 把「個性」從隱形的生成參數乘法，換成
// 可觀察、可學習、可預測的行為——玩家玩過兩次就會知道「紗霧蛾會折返，別直線外推」。
export type RouteRule = 'lowland' | 'highland' | 'cover' | 'straight' | 'doubling';

export const ROUTE_WAYPOINTS = 5;   // W0..W4
export const ROUTE_START_INDEX = 2; // 開局時獵物站在 W2：W0/W1/W2 是過去（線索留在那裡），W3/W4 是未來
// 每 N 步前進一個節點。原本是 12——tests/solvability.test.ts 補上逐格斷言後量到
// ridgecrest round1 的理想路線超支率達 14.3%（1000 顆種子），比 owner 先前在
// quirks.ts 明文駁回的 11% 還糟：新增的「追上會走的獵物」這段攔截路要花的體力，
// 原本沒被算進可解性掃描裡。獵物越慢，攔截點越接近牠開局的位置，這段路就越短。
// 12→14→16 依序量測：16 把 ridgecrest round1 的超支率壓到 8.8%（配合下面的節距
// 收緊，最終到 6.2%）——單獨這個常數換不到 5% 門檻，必須跟 SPACING 一起調。
//
// 再審覆核（本次修復）：地形偏置（quirks.ts）從 0.08 下修到 0.04 之後，重新問了
// 一次「這兩個槓桿還需要嗎」——它們的代價很大：獵物在 48.7% 的獵局裡完全沒換過
// 節點，等於這一階要教玩家的「預測牠會在哪」有一半用不上。用 idealCost 模型
// （tests/solvability.test.ts）在 bias=0.04 下重新掃過 1000 顆種子（seed=seed*131+round，
// 與既有慣例一致），依規格指定的順序逐一測試：
//
//   MOVE_EVERY  SPACING   ridgecrest r1 超支率  ridgecrest r1 可解率  neverMoved（1500 局貪婪追擊）
//   12          原始      4.60%                 95.40%                12.6%
//   14          原始      4.30%                 95.70%                37.4%
//   16          原始      3.50%                 96.50%                46.4%
//   12          收緊      2.40%                 97.60%                14.1%
//   14          收緊      2.40%                 97.60%                39.6%
//   16（現況）  收緊      2.20%                 97.80%                48.7%
//
// 門檻是 ridgecrest r1 超支率 ≤2.33%（owner 先前核准的臨界）。只有現況
// （MOVE_EVERY=16、SPACING 收緊）達標；MOVE_EVERY=12/14 無論節距收不收緊都超標
// （即使收緊節距，12／14 仍是 2.40%，只差 0.07 個百分點卻仍不合格）。
// 假設「bias 下修後兩個槓桿已經不需要了」因此不成立——兩個槓桿仍是達成
// ridgecrest 可解性門檻的必要條件，不是舊調校留下的多餘保守值。
// 這是本次修復做出的取捨：接受獵物在近半獵局裡不換節點（犧牲這一階的部分前提），
// 換取 ridgecrest round1 維持在可解性門檻之內——兩者無法同時滿足，且掃描範圍內
// 找不到第三個選項。詳細數字見 .superpowers/sdd/task-4-report.md。
export const MOVE_EVERY = 16;

// 節距（格）。直行的走得遠，貼著掩蔽的走得短——節距本身也是個性的一部分。
// lowland/highland/doubling 從 4 收到 3、straight 從 5 收到 4：同一個理由——
// 節點間距越大，攔截路要多繞的距離就越大。straight 5→4 先讓 dewhopper／plumetail
// 回到 95% 以上；ridgecrest 用的是 highland，靠這一檔的 4→3 才把它從 90% 拉到
// 95%（120 顆種子的樣本；1000 顆種子的真實率略低，見 solvability.test.ts 與
// task 報告——這是 MOVE_EVERY／SPACING 兩個槓桿在規格允許範圍內能做到的極限，
// 剩下的落差只能靠 quirks.ts 的地形偏置，那不是這次修復的範圍）。
const SPACING: Record<RouteRule, number> = {
  lowland: 3, highland: 3, cover: 3, straight: 4, doubling: 3,
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
  // 起始朝向也是隨機性的一部分。少了它，第一段沒有「前一段方向」可比，
  // straight／doubling 的評分會在 16 個候選之間完全平手，而挑選迴圈的嚴格大於比較
  // 會讓 candidates[0]（正東）勝出——實測 91% 的路線第一步朝正東，
  // 而「維持原方向」對 straight 又是穩定不動點，於是四成的路線退化成一條水平線。
  // 隨機性仍然只存在於「起點」，只是起點現在是「位置＋朝向」而不只是位置。
  const heading0 = rng() * 360;
  for (let i = 1; i < ROUTE_WAYPOINTS; i++) {
    waypoints.push(nextWaypoint(waypoints, SPACING[rule], rule, terrain, elevation, size, heading0));
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
  terrain: TerrainType[][], elevation: number[][], size: number, heading0: number,
): Vec2 {
  const from = sofar[sofar.length - 1];
  const prev = sofar.length >= 2 ? sofar[sofar.length - 2] : null;
  const heading = prev ? angleDeg(prev, from) : heading0;
  const used = new Set(sofar.map((w) => `${w.x},${w.y}`));

  const candidates: Vec2[] = [];
  for (let i = 0; i < CANDIDATE_ANGLES; i++) {
    const p = clampToMap(pointOnCircle(from, spacing, (360 / CANDIDATE_ANGLES) * i), size);
    if (!isPassable(terrain[p.y][p.x])) continue;
    if (used.has(`${p.x},${p.y}`)) continue;
    candidates.push(p);
  }
  if (candidates.length === 0) return nearestUnusedPassable(from, used, terrain, size);

  const straightness = (p: Vec2): number => -angleDiff(angleDeg(from, p), heading);

  // 每條規則的主要偏好。straight 與 doubling 的主要偏好本來就是方向，
  // 其餘三條看地形。
  const primary = (p: Vec2): number => {
    switch (rule) {
      case 'lowland': return -elevation[p.y][p.x];
      case 'highland': return elevation[p.y][p.x];
      case 'cover': return terrain[p.y][p.x] === 'thicket' ? 1 : 0;
      case 'straight': return straightness(p);
      // 折返：前兩段照直行走出去，後兩段反過來——轉角越大越好
      case 'doubling': return sofar.length <= 2 ? straightness(p) : -straightness(p);
    }
  };

  // 主要偏好與續行傾向「分開比較」，而不是把後者乘一個小係數加進前者。
  // 相加的寫法必須挑一個夠小的係數才不會干擾，但實測相鄰候選之間的高程差
  // 中位數只有 0.051、十分位數只有 0.005，而 /1000 的項最大可達 0.18——
  // 有 27% 的決策被它翻盤，那已經不是決勝而是共同決定。
  // 字典序讓續行傾向真的只在主要偏好完全相同時才作用。
  let best = candidates[0];
  for (const p of candidates.slice(1)) {
    const d = primary(p) - primary(best);
    if (d > 0 || (d === 0 && straightness(p) > straightness(best))) best = p;
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
