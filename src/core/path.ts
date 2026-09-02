import { key } from './clues';
import { cheb, type Vec2 } from './geometry';
import { TERRAIN_COST, isPassable } from './terrain';
import type { TerrainType } from './types';

// 八方向 A*。成本記在「踏入的那一格」，與 session.move() 的扣款規則一致，
// 因此預覽出來的花費就是玩家實際會付的數字。
// 啟發式用 Chebyshev 距離（等於最小地形成本 1 × 步數）——可採納（永不高估），
// 保證找到的是最省體力的路線，而不只是能走通的路線。
//
// seen 是迷霧的完整性保證：未看過的格一律視同不可通行。否則預覽線會自動繞開
// 玩家根本還沒看見的崖壁，那條線本身就洩漏了未探索區的地形。代價是開局能規劃的
// 範圍很小——這正是「眺望」存在的理由：它不只是找線索，也是打開路線選項。
export function findPath(
  terrain: TerrainType[][], from: Vec2, to: Vec2, seen: Set<string>,
): Vec2[] | null {
  // 高用列數、寬用「該列自己的」長度，不共用同一個 size。否則非方陣網格
  // 會把 x 也夾在列數以內，漏掉整張圖的一部分；或反之讀到 undefined（reach.ts 同理）。
  const height = terrain.length;
  if (to.y < 0 || to.y >= height) return null;
  const toRow = terrain[to.y];
  if (!toRow) return null;
  if (to.x < 0 || to.x >= toRow.length) return null;
  if (!seen.has(key(to)) || !isPassable(toRow[to.x])) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const startKey = key(from);
  const goalKey = key(to);
  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, Vec2>();
  // 開放集以陣列＋線性取最小值實作：地圖最大 25×25＝625 格，
  // 二元堆的複雜度優勢在此規模下換不回它的實作成本（YAGNI）。
  const open: { p: Vec2; f: number }[] = [{ p: from, f: cheb(from, to) }];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIdx].f) bestIdx = i;
    const { p } = open.splice(bestIdx, 1)[0];
    const pk = key(p);

    if (pk === goalKey) {
      const out: Vec2[] = [];
      let cur: Vec2 | undefined = p;
      while (cur && key(cur) !== startKey) {
        out.push(cur);
        cur = cameFrom.get(key(cur));
      }
      return out.reverse();
    }

    const pg = gScore.get(pk) ?? Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        // y 邊界看列數、x 邊界看「該列自己的」長度——不可共用同一個 size
        if (q.y < 0 || q.y >= height) continue;
        const qRow = terrain[q.y];
        if (!qRow || q.x < 0 || q.x >= qRow.length) continue;
        const qk = key(q);
        if (!seen.has(qk)) continue; // 沒看過的地不能拿來規劃路線
        const t = qRow[q.x];
        if (!isPassable(t)) continue;
        const tentative = pg + TERRAIN_COST[t];
        if (tentative >= (gScore.get(qk) ?? Infinity)) continue;
        gScore.set(qk, tentative);
        cameFrom.set(qk, p);
        open.push({ p: q, f: tentative + cheb(q, to) });
      }
    }
  }
  return null;
}

// 路線總花費＝沿途每一格的地形成本（起點不計，因為玩家已經站在上面）
export function pathCost(terrain: TerrainType[][], path: Vec2[]): number {
  return path.reduce((sum, c) => sum + TERRAIN_COST[terrain[c.y][c.x]], 0);
}
