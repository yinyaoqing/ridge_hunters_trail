import type { DifficultyParams } from './difficulty';
import type { TerrainType } from './types';

// 生物「判讀個性」唯一資料來源（設計提案 §2 W1 個性表）。
// 只調生成參數，不改線索語意——反向錨定在修飾後執行，求解性不變。
export function applyQuirk(p: DifficultyParams, creatureId: string): DifficultyParams {
  const q: DifficultyParams = { ...p, typeRatio: { ...p.typeRatio }, qte: { ...p.qte } };
  switch (creatureId) {
    case 'mistfawn':
      q.scentTolerance = p.scentTolerance * 2;
      break;
    case 'emberquill':
      q.disturbanceRadius = Math.max(1, p.disturbanceRadius - 1);
      break;
    case 'thicketloom':
      q.footprintSpread = Math.max(6, Math.round(p.footprintSpread / 2));
      break;
    case 'dewhopper':
      q.supplyCount = p.supplyCount + 2;
      break;
    case 'veilmoth':
      if (p.decoyCount > 0) q.decoyCount = p.decoyCount + 1;
      break;
    case 'lanternshrew':
      q.minClueDist = Math.max(2, p.minClueDist - 1);
      q.maxClueDist = Math.max(4, p.maxClueDist - 2);
      break;
    case 'plumetail':
      q.minClueDist = p.minClueDist + 1;
      q.maxClueDist = p.maxClueDist + 2;
      break;
  }
  return q;
}

const BASE_POOL: [TerrainType, number][] = [
  ['meadow', 5], ['mist', 2], ['thicket', 2], ['rock', 1],
];

export function terrainPoolFor(creatureId: string): [TerrainType, number][] {
  if (creatureId === 'ridgecrest') {
    return BASE_POOL.map(([t, w]) => [t, t === 'rock' ? w * 3 : w]);
  }
  return BASE_POOL.map(([t, w]) => [t, w]);
}
