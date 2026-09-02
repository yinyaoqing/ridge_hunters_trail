import { key } from './clues';
import type { Vec2 } from './geometry';
import type { TerrainType } from './types';

// 視野與眺望的數值（第一版，待實測調整）
export const BASE_VISION = 3;
export const SURVEY_COST = 4;
export const SURVEY_BONUS = 3; // 眺望半徑 = 當前視野半徑 + 此值

// 站在哪裡決定看得多遠：高處望得遠（最多 +2），密叢裡看不遠（-1），下限 2 格。
// 刻意不做射線遮蔽——視野是半徑而非可視錐，玩家才能預期自己看得到什麼。
export function visionRadius(terrain: TerrainType, elevation: number): number {
  let r = BASE_VISION;
  if (elevation >= 0.5) r += Math.min(2, Math.floor((elevation - 0.5) * 8));
  if (terrain === 'thicket') r -= 1;
  // 視野下限目前無法觸發（BASE_VISION=3，唯一懲罰-1），但留存作為未來防禦。
  return Math.max(2, r);
}

// 以 center 為中心、半徑 radius 的 Chebyshev 方形，夾限在地圖界內，回傳位置鍵。
export function cellsWithin(center: Vec2, radius: number, mapSize: number): string[] {
  const out: string[] = [];
  const x0 = Math.max(0, center.x - radius);
  const x1 = Math.min(mapSize - 1, center.x + radius);
  const y0 = Math.max(0, center.y - radius);
  const y1 = Math.min(mapSize - 1, center.y + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push(key({ x, y }));
  }
  return out;
}
