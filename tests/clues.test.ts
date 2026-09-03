import { describe, it, expect } from 'vitest';
import { key, candidates, intersect } from '../src/core/clues';
import type { Clue } from '../src/core/types';

const footprint = (x: number, y: number, direction: number, angleSpread: number): Clue =>
  ({ type: 'footprint', position: { x, y }, isDecoy: false, age: 2, data: { direction, angleSpread } });
const disturbance = (x: number, y: number, radius: number): Clue =>
  ({ type: 'disturbance', position: { x, y }, isDecoy: false, age: 2, data: { radius } });
const scent = (x: number, y: number, distance: number, tolerance: number): Clue =>
  ({ type: 'scent', position: { x, y }, isDecoy: false, age: 2, data: { distance, tolerance, windBiasNeeded: false, biasDirection: 0 } });

describe('key', () => {
  it('formats as x,y', () => {
    expect(key({ x: 3, y: 12 })).toBe('3,12');
  });
});

describe('candidates: footprint cone', () => {
  const clue = footprint(0, 0, 0, 40); // 指向東，半角40度
  const set = candidates(clue, 10);
  it('includes cells inside the cone', () => {
    expect(set.has('5,0')).toBe(true);  // 正東 0度
    expect(set.has('5,3')).toBe(true);  // 約31度
  });
  it('excludes cells outside the cone and its own cell', () => {
    expect(set.has('0,5')).toBe(false); // 正南 90度
    expect(set.has('0,0')).toBe(false); // 自身
  });
});

describe('candidates: disturbance disc', () => {
  const set = candidates(disturbance(5, 5, 2), 10);
  it('includes cells within radius, including own cell', () => {
    expect(set.has('5,5')).toBe(true);
    expect(set.has('7,5')).toBe(true);  // 距離2
    expect(set.has('6,6')).toBe(true);  // 距離√2
  });
  it('excludes cells beyond radius', () => {
    expect(set.has('8,5')).toBe(false); // 距離3
  });
});

describe('candidates: scent ring', () => {
  const set = candidates(scent(5, 5, 3, 0.5), 12);
  it('includes cells near the ring distance', () => {
    expect(set.has('8,5')).toBe(true); // 距離3
    expect(set.has('7,7')).toBe(true); // 距離√8≈2.83
  });
  it('excludes cells far from the ring', () => {
    expect(set.has('5,5')).toBe(false); // 距離0
    expect(set.has('10,5')).toBe(false); // 距離5
  });
});

describe('intersect', () => {
  it('returns cells satisfying all clues', () => {
    const set = intersect([disturbance(5, 5, 2), disturbance(7, 5, 2)], 12);
    expect(set.has('6,5')).toBe(true);
    expect(set.has('3,5')).toBe(false); // 只在第一個裡
  });
  it('empty clue list yields empty set', () => {
    expect(intersect([], 12).size).toBe(0);
  });
});
