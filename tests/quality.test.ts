import { describe, it, expect } from 'vitest';
import { qualityFromQte, maxQuality, QUALITY_RANK } from '../src/core/quality';
import type { QteState } from '../src/core/qte';

const q = (attempt: number, hits: number, offsets: number[]): QteState =>
  ({ attempt, hits, arcStart: 0, pointer: 0, done: true, success: true, lastHit: true, offsets });

describe('qualityFromQte', () => {
  it('any miss yields bronze', () => {
    expect(qualityFromQte(q(3, 2, [0.1, 0.1]))).toBe('bronze');
  });
  it('all hits with loose precision yields silver', () => {
    expect(qualityFromQte(q(2, 2, [0.9, 0.4]))).toBe('silver'); // 平均 0.65 > 0.5
  });
  it('all hits with tight precision yields gold', () => {
    expect(qualityFromQte(q(2, 2, [0.3, 0.5]))).toBe('gold'); // 平均 0.4 ≤ 0.5
  });
});

describe('maxQuality', () => {
  it('keeps the better of stored and new', () => {
    expect(maxQuality(null, 'bronze')).toBe('bronze');
    expect(maxQuality('gold', 'silver')).toBe('gold');
    expect(maxQuality('bronze', 'silver')).toBe('silver');
  });
  it('rank order is bronze < silver < gold', () => {
    expect(QUALITY_RANK.bronze).toBeLessThan(QUALITY_RANK.silver);
    expect(QUALITY_RANK.silver).toBeLessThan(QUALITY_RANK.gold);
  });
});
