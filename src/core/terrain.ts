import { valueNoise, layered } from './noise';
import type { Rng } from './rng';
import type { TerrainType } from './types';

// 高程分帶門檻（第一版，待實測調整）。value noise 的取值集中在 0.5 附近，
// 因此 0.82 以上只佔少數——崖壁要夠稀少才不會把地圖切碎，但必須真的存在，
// 否則「不可通行」這一層成本層級形同虛設。
export const BAND_CLIFF = 0.82;
export const BAND_ROCK = 0.62;
export const BAND_THICKET = 0.38;
// 低地的乾濕分界：濕的成霧谷、乾的成草坡
export const BAND_MOIST = 0.55;

// 地形由「高程＋濕度」推導，不再逐格獨立抽樣。分帶由高到低：
// 崖壁（不可通行的稜脊）→ 岩坡 → 密叢（林線）→ 低地（依濕度分成霧谷／草坡）。
export function terrainFor(elevation: number, moisture: number): TerrainType {
  if (elevation >= BAND_CLIFF) return 'cliff';
  if (elevation >= BAND_ROCK) return 'rock';
  if (elevation >= BAND_THICKET) return 'thicket';
  return moisture >= BAND_MOIST ? 'mist' : 'meadow';
}

// 低頻格數：整張圖切成 3×3 的大地貌骨架，細節層 7×7 疊上局部起伏。
// 寫死而非依 size 縮放——同一套骨架比例讓 15×15 與 25×25 讀起來是同一個世界。
const BASE_GRID = 3;
const DETAIL_GRID = 7;

// rng 消耗次數固定為 (3+1)^2 + (7+1)^2 + (3+1)^2 + (7+1)^2 = 160，與地圖大小無關。
// elevationBias 為生物個性用的高程偏移（見 quirks.ts），夾限後仍落在 0..1。
export function buildTerrain(
  rng: Rng, size: number, elevationBias: number,
): { terrain: TerrainType[][]; elevation: number[][] } {
  const elev = layered(valueNoise(rng, BASE_GRID), valueNoise(rng, DETAIL_GRID));
  const moist = layered(valueNoise(rng, BASE_GRID), valueNoise(rng, DETAIL_GRID));

  const terrain: TerrainType[][] = [];
  const elevation: number[][] = [];
  // size 為 1 時 (size-1) 會是 0，除法產生 NaN；以 1 保底讓單格地圖仍取樣到 (0,0)
  const span = Math.max(1, size - 1);
  for (let y = 0; y < size; y++) {
    const trow: TerrainType[] = [];
    const erow: number[] = [];
    for (let x = 0; x < size; x++) {
      const u = x / span;
      const v = y / span;
      const e = Math.min(1, Math.max(0, elev.at(u, v) + elevationBias));
      erow.push(e);
      trow.push(terrainFor(e, moist.at(u, v)));
    }
    terrain.push(trow);
    elevation.push(erow);
  }
  return { terrain, elevation };
}
