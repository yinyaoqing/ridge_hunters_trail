// 找出「會走的獵物」示範課的關卡資料。
// 約束（與 tests/demo-quarry.test.ts 一一對應）：
//   ① 9x9，三個節點共線等距，外推點落在圖內且不等於任何節點
//   ② 每一齡的兩條線索交集恰為該齡的節點
//   ③ 六條線索的跨齡交集為空
//   ④ 線索參數落在 getDifficulty() 的真實區間
//   ⑤（新）任何線索位置都不得與任何一個節點重合——不只是自己那一齡的節點
//   ⑥（新）三個節點與外推點都必須離邊界至少 1 格（x、y 落在 1..size-2）
// 方向偏好：對角線優先於軸向——一條斜線讀起來才明確是「方向」，
// 而不是被誤讀成格線本身的一列或一行。
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

// 每一齡挑兩條線索，要求交集恰為該節點一格，且線索位置不得落在「任何」節點上
function solveAge(node, age, allNodes) {
  const pool = [];
  for (const pos of cells) {
    if (allNodes.some((n) => key(pos) === key(n))) continue;
    for (const s of SPREADS) pool.push(makeFootprint(pos, node, age, s));
    for (const r of RADII) { const c = makeDisturbance(pos, node, age, r); if (c) pool.push(c); }
    for (const t of TOLERANCES) { const c = makeScent(pos, node, age, t); if (c) pool.push(c); }
  }
  // 型別混搭優先（教學希望三種線索都出現過），故先試不同 type 的配對；
  // 若該偏好被放寬旋鈕關掉，則同型別配對與混搭配對一視同仁。
  if (PREFER_MIXED_TYPES) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (pool[i].type === pool[j].type) continue;
        const cut = intersect([pool[i], pool[j]], SIZE);
        if (cut.size === 1 && [...cut][0] === key(node)) return [pool[i], pool[j]];
      }
    }
    return null;
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const cut = intersect([pool[i], pool[j]], SIZE);
      if (cut.size === 1 && [...cut][0] === key(node)) return [pool[i], pool[j]];
    }
  }
  return null;
}

const DIAGONAL_STEPS = [
  { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: -1, y: 1 },
];
const AXIS_STEPS = [
  { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 },
];
const STEPS = ALLOW_AXIS ? [...DIAGONAL_STEPS, ...AXIS_STEPS] : DIAGONAL_STEPS;

let found = false;
outer:
for (const w0 of cells) {
  for (const step of STEPS) {
    const w1 = { x: w0.x + step.x * 2, y: w0.y + step.y * 2 };
    const w2 = { x: w1.x + step.x * 2, y: w1.y + step.y * 2 };
    const target = { x: w2.x + step.x * 2, y: w2.y + step.y * 2 };
    if (![w0, w1, w2, target].every(inGrid)) continue;
    if (![w0, w1, w2, target].every(insideBorder)) continue;
    const nodes = [w0, w1, w2];
    const sets = nodes.map((n, age) => solveAge(n, age, nodes));
    if (sets.some((s) => s === null)) continue;
    const all = sets.flat();
    if (intersect(all, SIZE).size !== 0) continue;
    // 保險：線索位置真的沒有跟任何節點重合
    if (all.some((c) => nodes.some((n) => key(c.position) === key(n)))) continue;
    found = true;
    console.log(JSON.stringify({ nodes, target, clues: all }, null, 2));
    break outer;
  }
}
if (!found) {
  console.log('NO_SOLUTION', {
    ALLOW_AXIS, SPREADS, RADII, PREFER_MIXED_TYPES,
  });
}
