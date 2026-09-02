import { describe, it, expect } from 'vitest';
import { qualityFromAccuracy, maxQuality, QUALITY_RANK } from '../src/core/quality';

const target = { x: 10, y: 10 };

describe('qualityFromAccuracy', () => {
  it('an exact call yields gold', () => {
    expect(qualityFromAccuracy({ x: 10, y: 10 }, target)).toBe('gold');
  });
  it('within two cells yields silver', () => {
    expect(qualityFromAccuracy({ x: 12, y: 10 }, target)).toBe('silver');
    expect(qualityFromAccuracy({ x: 11, y: 12 }, target)).toBe('silver'); // 對角距離 2
  });
  it('beyond two cells yields bronze', () => {
    expect(qualityFromAccuracy({ x: 13, y: 10 }, target)).toBe('bronze');
  });
  it('no wager yields bronze', () => {
    expect(qualityFromAccuracy(null, target)).toBe('bronze');
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
