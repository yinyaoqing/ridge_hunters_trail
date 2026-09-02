import { describe, it, expect } from 'vitest';
import { valueNoise, layered } from '../src/core/noise';
import { mulberry32 } from '../src/core/rng';

describe('valueNoise', () => {
  it('consumes a fixed number of rng draws regardless of how it is sampled', () => {
    let draws = 0;
    const counting = () => { draws++; return 0.5; };
    valueNoise(counting, 4); // (4+1)^2 = 25 個格點
    expect(draws).toBe(25);
    const field = valueNoise(counting, 4);
    draws = 0;
    field.at(0.1, 0.2);
    field.at(0.9, 0.7);
    expect(draws).toBe(0); // 取樣不再消耗 rng
  });

  it('is deterministic for the same seed', () => {
    const a = valueNoise(mulberry32(7), 4);
    const b = valueNoise(mulberry32(7), 4);
    for (const [u, v] of [[0, 0], [0.33, 0.66], [1, 1]] as const) {
      expect(a.at(u, v)).toBe(b.at(u, v));
    }
  });

  it('differs for different seeds', () => {
    const a = valueNoise(mulberry32(1), 4);
    const b = valueNoise(mulberry32(2), 4);
    expect(a.at(0.5, 0.5)).not.toBe(b.at(0.5, 0.5));
  });

  it('stays within 0..1 across the whole domain', () => {
    const f = valueNoise(mulberry32(3), 5);
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const n = f.at(i / 20, j / 20);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('clamps out-of-range coordinates instead of wrapping or returning NaN', () => {
    const f = valueNoise(mulberry32(3), 4);
    expect(f.at(-1, -1)).toBe(f.at(0, 0));
    expect(f.at(2, 2)).toBe(f.at(1, 1));
  });

  it('is spatially smooth — neighbouring samples differ far less than distant ones', () => {
    const f = valueNoise(mulberry32(11), 4);
    // 相鄰取樣（1/64 格距）與遠距取樣（半張圖）的平均變化量差距，用來確認這是
    // 有空間結構的雜訊場，而不是逐點獨立亂數
    let near = 0;
    let far = 0;
    for (let i = 0; i < 32; i++) {
      const u = i / 32;
      near += Math.abs(f.at(u, 0.5) - f.at(u + 1 / 64, 0.5));
      far += Math.abs(f.at(u, 0.5) - f.at((u + 0.5) % 1, 0.5));
    }
    expect(near).toBeLessThan(far / 3);
  });
});

describe('layered', () => {
  it('blends base and detail at 70/30', () => {
    const flat = (n: number) => ({ at: () => n });
    expect(layered(flat(1), flat(0)).at(0.5, 0.5)).toBeCloseTo(0.7, 10);
    expect(layered(flat(0), flat(1)).at(0.5, 0.5)).toBeCloseTo(0.3, 10);
  });

  it('stays within 0..1 when both inputs are in range', () => {
    const f = layered(valueNoise(mulberry32(5), 3), valueNoise(mulberry32(6), 7));
    for (let i = 0; i <= 10; i++) {
      const n = f.at(i / 10, 0.4);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});
