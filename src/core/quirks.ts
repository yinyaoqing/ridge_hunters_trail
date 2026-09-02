import type { DifficultyParams } from './difficulty';

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

// 生物個性的地形面向：稜脊獸漫遊的山域整體抬高，岩坡與崖壁因此格外遍布。
// 舊版是「調整地形抽樣權重」，地形改由高程推導後，等價的作法是位移高程場本身——
// 這樣抬高的是連續的地貌（更多稜線），而不是散落的岩塊。
export function elevationBiasFor(creatureId: string): number {
  return creatureId === 'ridgecrest' ? 0.15 : 0;
}
