import type { QteState } from './qte';

export type Quality = 'bronze' | 'silver' | 'gold';

export const QUALITY_RANK: Record<Quality, number> = { bronze: 0, silver: 1, gold: 2 };

// 有失手 → 銅；全中 → 銀；全中且平均弧心偏移 ≤ 0.5 → 金
export function qualityFromQte(q: QteState): Quality {
  if (q.attempt - q.hits > 0) return 'bronze';
  const avg = q.offsets.reduce((s, o) => s + o, 0) / Math.max(1, q.offsets.length);
  return avg <= 0.5 ? 'gold' : 'silver';
}

export function maxQuality(a: Quality | null, b: Quality): Quality {
  return a !== null && QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b;
}
