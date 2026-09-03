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
// 下修後實測：崖壁佔比均值 7.56%、最糟 28%，理想路線超預算率 2.33%，加計補給
// 後仍無法完成率 0.67%。尾部未完全消除——種子 79 可復現（理想 129 點 vs 預算 60 點）。
// 接受此尾部：ridgecrest round-1 的 0.67% 對應全部首獵約 0.08%，遠低於 owner
// 先前 2.3% 臨界；且上述值均為首輪遊戲測試前估值。
//
// 第三次調整（Phase 6a 漫遊獵物）：獵物不再固定站在原地，玩家的理想路線多了
// 一段「追上牠會走到的節點」的攔截路——這段路原本沒被算進可解性掃描，補上後
// （見 route.ts 的 MOVE_EVERY／SPACING 註解）用掉了規格允許的兩個槓桿
// （MOVE_EVERY 12→16、節距收緊）仍不夠：0.08 在 round-1、1000 顆種子上量到
// 超預算率 6.20%、加計補給後無法完成率 0.50%——硬指標比上次接受的 0.67% 好，
// 但軟指標（6.20%）遠超上次核准的 2.33% 臨界，且 solvability.test.ts 的
// per-cell 通過只是 120 顆種子的抽樣運氣（1000 顆的真實率是 93.8%，見該檔案）。
// owner 再次核准調用同一支槓桿。1000 顆種子、round-1 掃過
// 0.08/0.07/0.06/0.05/0.04/0.00 六個值（同一份 seed = seed*131+round 慣例）：
//
//   bias  超預算率  補給後仍無法完成率  崖壁佔比均值  崖壁佔比最糟
//   0.08    6.20%          0.50%            7.30%         35.56%（本次調整前的值，Phase 6a 前已核准，此處重列供對照）
//   0.07    5.10%          0.30%            6.37%         31.56%
//   0.06    4.10%          0.10%            5.56%         29.33%
//   0.05    3.90%          0.00%            4.76%         24.89%
//   0.04    2.20%          0.10%            4.04%         22.67%
//   0.00    1.40%          0.00%            1.98%         15.56%（個性完全消失，僅供對照代價）
//
// 只有 0.04 與 0.00 同時滿足兩條門檻（≤2.33% 超預算、≤0.67% 無法完成）；
// 取兩者中較大者以保留最多個性——0.04：稜脊獸腳下仍比其他生物明顯更多岩坡
// 與崖壁（崖壁均值 4.04% vs 其餘生物 ~2%），同時把超預算率壓回 2.20%、無法
// 完成率壓到 0.10%，兩項都在 owner 先前核准的臨界之內。terrain.test.ts 的
// ridgecrest 專屬崖壁佔比測試（G1）已同步更新到這個 bias 下的量測值。
export function elevationBiasFor(creatureId: string): number {
  return creatureId === 'ridgecrest' ? 0.04 : 0;
}
