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
// 0.15 實測後裁定過高：round-1、無霧、carve 後的 300 顆種子裡，崖壁佔比均值達
// 15.9%（其餘生物僅 2.1%），單張最糟 44.4%，且理想路線（出生→蹤跡→一條線索→
// 逼近目標）在 11% 的種子上就超出整局 60 點體力——即使把三個補給全記成免費
// （+30，真實路線達不到的體力），仍有 3% 在數學上就走不完。ridgecrest 又是
// 8 隻無局數門檻生物之一，等於約 1.4% 的首局直接受影響。owner 裁定下修至
// 0.08：既保留「稜脊獸腳下更多岩坡」的個性，也把崖壁佔比拉回可玩範圍——
// 見 terrain.test.ts 的 ridgecrest 專屬崖壁佔比測試（F-ridgecrest）。
export function elevationBiasFor(creatureId: string): number {
  return creatureId === 'ridgecrest' ? 0.08 : 0;
}
