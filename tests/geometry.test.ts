import { describe, it, expect } from 'vitest';
import { dist, cheb, angleDeg, angleDiff, clampToMap, pointOnCircle } from '../src/core/geometry';

describe('geometry', () => {
  it('dist is euclidean', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('cheb is chessboard distance', () => {
    expect(cheb({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(3);
    expect(cheb({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(1);
  });

  it('angleDeg: east is 0, south is 90 (screen coords, y down)', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(0);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(90);
    expect(angleDeg({ x: 0, y: 0 }, { x: -5, y: 0 })).toBe(180);
  });

  it('angleDiff wraps around 360', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(90, 90)).toBe(0);
    expect(angleDiff(0, 180)).toBe(180);
  });

  it('clampToMap rounds and clamps into grid', () => {
    expect(clampToMap({ x: -2.4, y: 7.6 }, 15)).toEqual({ x: 0, y: 8 });
    expect(clampToMap({ x: 99, y: 14.2 }, 15)).toEqual({ x: 14, y: 14 });
  });

  it('pointOnCircle at 0 degrees goes east', () => {
    const p = pointOnCircle({ x: 5, y: 5 }, 3, 0);
    expect(p.x).toBeCloseTo(8);
    expect(p.y).toBeCloseTo(5);
  });
});
