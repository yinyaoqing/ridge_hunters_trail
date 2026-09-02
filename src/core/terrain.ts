import { valueNoise, layered } from './noise';
import type { Rng } from './rng';
import type { TerrainType } from './types';
import { dist, type Vec2 } from './geometry';

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

// 地形成本四層（第一版，待實測調整）：草地／霧谷 1、密叢 2、岩坡 4、崖壁不可通行。
// 拉開層級是為了讓「繞路」真的值得算——舊版只有 1 和 2 兩檔，省下的體力太少，
// 玩家兩局後就不再思考路線。cliff 用 Infinity 而非旗標：canMove 既有的
// 「stamina >= cost」判斷對 Infinity 恆為 false，通行性因此自動成立，
// 不需要在每個呼叫點多一條分支。
export const TERRAIN_COST: Record<TerrainType, number> = {
  meadow: 1, mist: 1, thicket: 2, rock: 4, cliff: Infinity,
};

export const isPassable = (t: TerrainType): boolean => Number.isFinite(TERRAIN_COST[t]);

// terrainFor 的反向代表值：generate.ts／reach.ts 有幾處會「改地形但不重算高程」
// （目標強制地形、崖壁線索降級、reach.ts 挖隘口），若不同步更新對應的高程格，
// 之後的視野加成（讀 elevation 判斷是否站在高地）就會被騙——挖出來的隘口明明
// 只是 rock，卻因為留著舊的崖壁高程而被當成峰頂算加成。取值為各分帶的中點，
// 回填 terrainFor 仍會得到同一個地形型別，見 terrain.test.ts 的往返測試。
export function elevationFor(terrain: TerrainType): number {
  switch (terrain) {
    case 'cliff': return 0.91;
    case 'rock': return 0.72;
    case 'thicket': return 0.50;
    case 'meadow':
    case 'mist':
      return 0.19;
  }
}

// 出生角：離目標最遠的那個角落。Task 4 的可達性保證（generate.ts）與 session 的
// 開局位置共用同一份定義——兩邊各算一次遲早會不一致。
export function startCorner(mapSize: number, target: Vec2): Vec2 {
  const s = mapSize - 1;
  const corners: Vec2[] = [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return corners.reduce((a, b) => (dist(b, target) > dist(a, target) ? b : a));
}
