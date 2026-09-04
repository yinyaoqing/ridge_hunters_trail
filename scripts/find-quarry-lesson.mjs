// 找出「會走的獵物」示範課的關卡資料。
// 約束（與 tests/demo-quarry.test.ts 一一對應）：
//   ① 9x9，三個節點共線等距，外推點落在圖內且不等於任何節點
//   ② 每一齡的兩條線索交集恰為該齡的節點
//   ③ 六條線索的跨齡交集為空
//   ④ 線索參數落在 getDifficulty() 的真實區間
//   ⑤ 任何線索位置都不得與任何一個節點重合——不只是自己那一齡的節點
//   ⑥ 三個節點與外推點都必須離邊界至少 1 格（x、y 落在 1..size-2）
//   ⑦（新）六條線索的位置必須兩兩相異——否則畫面上會有線索圖標疊在一起，
//      玩家看到的記號數少於旁白說的「六條」（opaque token 蓋掉了底下的）
// 方向偏好：對角線優先於軸向——一條斜線讀起來才明確是「方向」，
// 而不是被誤讀成格線本身的一列或一行。
// 位置偏好（軟性，非硬約束）：六個位置盡量互相拉開距離（Chebyshev ≥ 2），
// 讀起來才像散在地圖上的六個點，而不是擠在同一個角落——如果加了這條偏好
// 導致找不到解，就整個丟掉，只留②③④⑤⑥⑦這些硬約束。
// 找到第一組就印出來，貼回 src/core/demo.ts。
import { candidates, intersect, key } from '../src/core/clues.ts';

const SIZE = 9;
const MIN = 1;
const MAX = SIZE - 2; // 1..7，離邊界至少 1 格

// ── 可調的放寬旋鈕（依任務說明的順序，一次只開一個） ──
const ALLOW_AXIS = process.env.QL_ALLOW_AXIS === '1';
const SPREADS = [20, 25, 30, ...(process.env.QL_ADD_35 === '1' ? [35] : [])];
const RADII = [2, 3, ...(process.env.QL_ADD_4 === '1' ? [4] : [])];
const TOLERANCES = [0.5, 0.75, 1.0];
const PREFER_MIXED_TYPES = process.env.QL_DROP_MIXED_PREF !== '1';

// 六個位置兩兩之間的最小 Chebyshev 距離門檻（軟性偏好，找不到就整個放掉）。
const MIN_SPREAD = 2;

const angleDeg = (from, to) =>
  ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const inGrid = (p) => p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE;
const insideBorder = (p) => p.x >= MIN && p.x <= MAX && p.y >= MIN && p.y <= MAX;

// 反向錨定：線索位置固定，方向／距離由「該位置到節點」推導，
// 與 generate.ts 的 makeClue 同一套做法——節點因此必然落在候選集合內。
function makeFootprint(pos, node, age, spread) {
  return { type: 'footprint', position: pos, isDecoy: false, age,
    data: { direction: Math.round(angleDeg(pos, node)), angleSpread: spread } };
}
function makeDisturbance(pos, node, age, radius) {
  if (cheb(pos, node) > radius) return null;
  return { type: 'disturbance', position: pos, isDecoy: false, age, data: { radius } };
}
function makeScent(pos, node, age, tolerance) {
  const d = Math.round(Math.hypot(node.x - pos.x, node.y - pos.y));
  if (d < 2 || d > 7) return null;
  return { type: 'scent', position: pos, isDecoy: false, age,
    data: { distance: d, tolerance, windBiasNeeded: false, biasDirection: Math.round(angleDeg(pos, node)) } };
}

const cells = [];
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells.push({ x, y });

// 某一齡、某個節點，在排除 excludeKeys（其他齡已用掉的位置＋三個節點）之後，
// 依序產出所有交集恰為該節點一格的線索配對。位置兩兩相異（含配對內部）
// 由排除集合＋配對內部檢查一起保證，因此任何一次成功組出六條，六個位置
// 必然兩兩相異——約束⑦不是事後過濾，是生成過程本身的性質。
function* agePairs(node, age, excludeKeys) {
  const pool = [];
  for (const pos of cells) {
    if (excludeKeys.has(key(pos))) continue;
    for (const s of SPREADS) pool.push(makeFootprint(pos, node, age, s));
    for (const r of RADII) { const c = makeDisturbance(pos, node, age, r); if (c) pool.push(c); }
    for (const t of TOLERANCES) { const c = makeScent(pos, node, age, t); if (c) pool.push(c); }
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (key(a.position) === key(b.position)) continue; // 約束⑦：配對內部也要相異
      if (PREFER_MIXED_TYPES && a.type === b.type) continue;
      const cut = intersect([a, b], SIZE);
      if (cut.size === 1 && [...cut][0] === key(node)) yield [a, b];
    }
  }
}

const DIAGONAL_STEPS = [
  { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: -1, y: 1 },
];
const AXIS_STEPS = [
  { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 },
];
const STEPS = ALLOW_AXIS ? [...DIAGONAL_STEPS, ...AXIS_STEPS] : DIAGONAL_STEPS;

function minPairDist(positions) {
  let m = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      m = Math.min(m, cheb(positions[i], positions[j]));
    }
  }
  return m;
}

// requireSpread：true 時額外要求六個位置兩兩 Chebyshev 距離 ≥ MIN_SPREAD（軟性偏好）。
function trySolve(requireSpread) {
  for (const w0 of cells) {
    for (const step of STEPS) {
      const w1 = { x: w0.x + step.x * 2, y: w0.y + step.y * 2 };
      const w2 = { x: w1.x + step.x * 2, y: w1.y + step.y * 2 };
      const target = { x: w2.x + step.x * 2, y: w2.y + step.y * 2 };
      if (![w0, w1, w2, target].every(inGrid)) continue;
      if (![w0, w1, w2, target].every(insideBorder)) continue;
      const nodes = [w0, w1, w2];
      const nodeKeys = new Set(nodes.map(key));

      for (const p0 of agePairs(nodes[0], 0, nodeKeys)) {
        const used1 = new Set([...nodeKeys, key(p0[0].position), key(p0[1].position)]);
        for (const p1 of agePairs(nodes[1], 1, used1)) {
          const used2 = new Set([...used1, key(p1[0].position), key(p1[1].position)]);
          for (const p2 of agePairs(nodes[2], 2, used2)) {
            const all = [...p0, ...p1, ...p2];
            if (intersect(all, SIZE).size !== 0) continue;
            if (requireSpread && minPairDist(all.map((c) => c.position)) < MIN_SPREAD) continue;
            return { nodes, target, clues: all };
          }
        }
      }
    }
  }
  return null;
}

let result = trySolve(true);
let spreadPreferenceUsed = true;
if (!result) {
  result = trySolve(false);
  spreadPreferenceUsed = false;
}

if (result) {
  console.log(JSON.stringify(result, null, 2));
  console.log('spreadPreferenceUsed:', spreadPreferenceUsed, `(min pairwise Chebyshev distance >= ${MIN_SPREAD})`);
} else {
  console.log('NO_SOLUTION', {
    ALLOW_AXIS, SPREADS, RADII, PREFER_MIXED_TYPES,
  });
}
