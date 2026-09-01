import type { TerrainType } from './types';
import { getDifficulty } from './difficulty';

// 線索金光：全循環共用，維持線索判讀性（美術方向板）
export const CLUE_GOLD = 0xd8c874;

export interface Palette {
  id: 'mist-green' | 'ochre' | 'dusk-violet';
  bg: number;      // 頁面/場景底色
  base: number;    // 地圖畫布基底
  panel: number;   // 卡片/圖標底盤
  terrain: Record<TerrainType, number>;
  glow: number;    // 生物發光細節（依循環變化）
  gold: number;    // 線索金光（恆定）
  paper: number;   // 紙墨白（主要文字）
  paperDim: number; // 次要文字
  supply: number;  // 補給（霧葉/露珠果）
  mark: number;    // 玩家標記
  iris: number;    // 異彩變種色（依循環變化）
}

const MIST_GREEN: Palette = {
  id: 'mist-green',
  bg: 0x131a17, base: 0x16211b, panel: 0x1b2520,
  terrain: { meadow: 0x24352c, mist: 0x2c3f42, thicket: 0x3a5244, rock: 0x4a3c2c },
  glow: 0x9ad1c8, gold: CLUE_GOLD, paper: 0xe8e3d2, paperDim: 0x8a9a8c,
  supply: 0xa8d08d, mark: 0xd9764a, iris: 0xd6a8e0,
};

const OCHRE: Palette = {
  id: 'ochre',
  bg: 0x1a1512, base: 0x1c1712, panel: 0x252019,
  terrain: { meadow: 0x33271d, mist: 0x3a352f, thicket: 0x3d3420, rock: 0x55402c },
  glow: 0xe0955f, gold: CLUE_GOLD, paper: 0xece2cf, paperDim: 0x9a8f7c,
  supply: 0xa8d08d, mark: 0xd9764a, iris: 0xe0b8d0,
};

const DUSK_VIOLET: Palette = {
  id: 'dusk-violet',
  bg: 0x171420, base: 0x191622, panel: 0x211d2e,
  terrain: { meadow: 0x2a2438, mist: 0x333048, thicket: 0x443a58, rock: 0x4a3b44 },
  glow: 0xc9b1d6, gold: CLUE_GOLD, paper: 0xe6e0d8, paperDim: 0x93899e,
  supply: 0xa8d08d, mark: 0xd9764a, iris: 0xa8d8e0,
};

// 依難度層循環三套配色：與 getDifficulty 的層級切點一致
export function getPalette(round: number): Palette {
  const size = getDifficulty(round).mapSize;
  if (size <= 15) return MIST_GREEN;
  if (size <= 20) return OCHRE;
  return DUSK_VIOLET;
}
