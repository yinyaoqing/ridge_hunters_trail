import { cheb, type Vec2 } from './geometry';

export type Quality = 'bronze' | 'silver' | 'gold';

export const QUALITY_RANK: Record<Quality, number> = { bronze: 0, silver: 1, gold: 2 };

// 判讀精準度＝押注格與真實位置的 Chebyshev 距離（設計提案 R3）。
// 取代原本的 qualityFromQte：品質應該獎勵推理，而不是反應速度（診斷 C-03）。
// 正中＝金、相距 ≤2 格＝銀、其餘或未下押注＝銅。
export function qualityFromAccuracy(wager: Vec2 | null, target: Vec2): Quality {
  if (!wager) return 'bronze';
  const d = cheb(wager, target);
  if (d === 0) return 'gold';
  return d <= 2 ? 'silver' : 'bronze';
}

export function maxQuality(a: Quality | null, b: Quality): Quality {
  return a !== null && QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b;
}
