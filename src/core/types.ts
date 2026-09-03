import type { Vec2 } from './geometry';
import type { Weather } from './weather';
import type { Route } from './route';

export type TerrainType = 'meadow' | 'mist' | 'thicket' | 'rock' | 'cliff';

// 地形型別的執行期清單（載入地形紋理、逐型別繪製時需要可列舉的來源）
export const TERRAIN_TYPES: readonly TerrainType[] = ['meadow', 'mist', 'thicket', 'rock', 'cliff'];

// 支援語系：英文（預設）與繁體中文
export type Locale = 'en' | 'zh-TW';

// 足跡：方向性線索（錐形）
export interface FootprintData {
  direction: number;    // 0-360 度，指向錨定點
  angleSpread: number;  // 錐形半角（度），難度越高越小
}

// 擾動：範圍性線索（圓域）
export interface DisturbanceData {
  radius: number; // 可能範圍半徑（格）
}

// 氣味：距離性線索（圓環）。windBiasNeeded 標記風向石可呈現偏心弧提示
export interface ScentData {
  distance: number;
  tolerance: number; // 環寬容差（格），難度越高越窄
  windBiasNeeded: boolean;
  biasDirection: number;  // 目標方位提示（±30°），風向石持有時渲染為偏心弧
}

// 線索的新鮮度＝它錨定在覓食路線的哪一個節點。0 最舊、2 最新（獵物開局所在）。
// 同齡線索的交集必定包含該齡位置——舊的「所有線索交集包含目標」是這條的特例。
export type ClueAge = 0 | 1 | 2;

export type Clue =
  | { type: 'footprint'; position: Vec2; isDecoy: boolean; age: ClueAge; data: FootprintData }
  | { type: 'disturbance'; position: Vec2; isDecoy: boolean; age: ClueAge; data: DisturbanceData }
  | { type: 'scent'; position: Vec2; isDecoy: boolean; age: ClueAge; data: ScentData };

export type ClueType = Clue['type'];

export interface Level {
  round: number;
  mapSize: number;
  route: Route;             // 覓食路線；獵物依步數沿它移動（見 core/route.ts）
  // 鷹架：Task 3 移除。等於 route.waypoints[ROUTE_START_INDEX]，
  // 存在的唯一理由是讓 Task 2 結束時既有消費端仍能編譯。
  targetPos: Vec2;
  clues: Clue[];
  terrain: TerrainType[][]; // terrain[y][x]
  elevation: number[][];    // elevation[y][x]，0..1；地形由它推導，視野加成也讀它
  supplies: Vec2[];         // 補給道具（規格書「霧葉/露珠果」的統一實作）
  creatureId: string;
  trailheadIndex: number; // 開局即揭示的真線索索引——玩家永遠有一條線可以拉
  weather: Weather;
  iris: boolean; // 異彩變種——純視覺＋計分，不影響難度
}
