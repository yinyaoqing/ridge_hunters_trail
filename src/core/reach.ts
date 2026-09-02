import { bresenham, type Vec2 } from './geometry';
import { key } from './clues';
import { isPassable } from './terrain';
import type { TerrainType } from './types';

// 從 from 出發、以八方向走訪所有可通行格。起點本身不可通行時回傳空集合
// （呼叫端應先確保起點可通行——ensureReachable 會處理）。
export function reachableFrom(terrain: TerrainType[][], from: Vec2): Set<string> {
  const size = terrain.length;
  const seen = new Set<string>();
  if (!isPassable(terrain[from.y][from.x])) return seen;
  const queue: Vec2[] = [from];
  seen.add(key(from));
  while (queue.length > 0) {
    const p = queue.pop()!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < 0 || q.y < 0 || q.x >= size || q.y >= size) continue;
        const k = key(q);
        if (seen.has(k) || !isPassable(terrain[q.y][q.x])) continue;
        seen.add(k);
        queue.push(q);
      }
    }
  }
  return seen;
}

// 物理可達性保證：反向錨定保證線索在「幾何上」有解，這裡保證它們在「物理上」走得到。
// 對每一個從起點走不到的必要格，沿它與起點的直線把崖壁降級為岩坡，然後重新走訪。
// 降級為 rock（成本 4）而非 meadow：挖出來的隘口仍然昂貴，繞不繞路依舊是個決定。
export function ensureReachable(
  terrain: TerrainType[][], from: Vec2, required: Vec2[],
): void {
  // 起點必須先能站人，否則 reachableFrom 一律回空集合
  if (!isPassable(terrain[from.y][from.x])) terrain[from.y][from.x] = 'rock';

  // 每輪最多解決一格，故迴圈上限即必要格數；每輪都重算可達集合，
  // 因為挖通一格常常順帶接上其他格
  for (let pass = 0; pass <= required.length; pass++) {
    const seen = reachableFrom(terrain, from);
    const stranded = required.find((p) => !seen.has(key(p)));
    if (!stranded) return;
    for (const c of bresenham(stranded, from)) {
      if (terrain[c.y][c.x] === 'cliff') terrain[c.y][c.x] = 'rock';
    }
  }
}
