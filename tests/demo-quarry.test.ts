import { describe, it, expect } from 'vitest';
import { intersect, key } from '../src/core/clues';
import {
  QUARRY_SIZE, QUARRY_NODES, QUARRY_CLUES, QUARRY_START, QUARRY_TARGET, QUARRY_PAIR,
} from '../src/core/demo';

const byAge = (age: number) => QUARRY_CLUES.filter((c) => c.age === age);

describe('quarry lesson data', () => {
  it('has six honest clues, two per age', () => {
    expect(QUARRY_CLUES).toHaveLength(6);
    expect(QUARRY_CLUES.every((c) => !c.isDecoy)).toBe(true);
    for (const age of [0, 1, 2]) expect(byAge(age)).toHaveLength(2);
  });

  it('keeps every position inside the grid', () => {
    const all = [QUARRY_START, QUARRY_TARGET, ...QUARRY_NODES, ...QUARRY_CLUES.map((c) => c.position)];
    for (const p of all) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(QUARRY_SIZE);
      expect(p.y).toBeLessThan(QUARRY_SIZE);
    }
  });

  // 第 1 章「六條線索攤開，交集是空的」必須字面成立
  it('has no cell agreeing with all six clues', () => {
    expect(intersect([...QUARRY_CLUES], QUARRY_SIZE).size).toBe(0);
  });

  // 第 2 章「切到最新一齡，交集出牠剛才在哪」
  it('pins the newest age to exactly the newest node', () => {
    const fresh = intersect(byAge(2), QUARRY_SIZE);
    expect(fresh.size).toBe(1);
    expect([...fresh][0]).toBe(key(QUARRY_NODES[2]));
    expect(QUARRY_PAIR).toEqual(fresh);
  });

  // 每一齡都必須自己解得出來，否則第 3 章的「三個點」畫不出來
  it('pins each age to exactly its own node', () => {
    for (const age of [0, 1, 2] as const) {
      const cells = intersect(byAge(age), QUARRY_SIZE);
      expect(cells.size).toBe(1);
      expect([...cells][0]).toBe(key(QUARRY_NODES[age]));
    }
  });

  // 第 3 章「連起來就是方向」：三點共線且等距，外推才有唯一答案
  it('walks a straight, evenly spaced line', () => {
    const [w0, w1, w2] = QUARRY_NODES;
    const d1 = { x: w1.x - w0.x, y: w1.y - w0.y };
    const d2 = { x: w2.x - w1.x, y: w2.y - w1.y };
    expect(d2).toEqual(d1);
    expect(d1.x === 0 && d1.y === 0).toBe(false);
  });

  it('puts the extrapolated cell one more step along, inside the grid', () => {
    const [, w1, w2] = QUARRY_NODES;
    expect(QUARRY_TARGET).toEqual({ x: w2.x + (w2.x - w1.x), y: w2.y + (w2.y - w1.y) });
    expect(QUARRY_TARGET.x).toBeGreaterThanOrEqual(0);
    expect(QUARRY_TARGET.y).toBeGreaterThanOrEqual(0);
    expect(QUARRY_TARGET.x).toBeLessThan(QUARRY_SIZE);
    expect(QUARRY_TARGET.y).toBeLessThan(QUARRY_SIZE);
  });

  it('does not put the answer on any node — the player must extrapolate', () => {
    for (const node of QUARRY_NODES) {
      expect(key(QUARRY_TARGET)).not.toBe(key(node));
    }
  });

  // 線索參數必須落在 getDifficulty() 真實使用的區間內，否則教的是特例不是這個遊戲
  it('uses parameters the real game actually produces', () => {
    for (const c of QUARRY_CLUES) {
      if (c.type === 'footprint') {
        expect(c.data.angleSpread).toBeGreaterThanOrEqual(15);
        expect(c.data.angleSpread).toBeLessThanOrEqual(40);
      } else if (c.type === 'disturbance') {
        expect(c.data.radius).toBeGreaterThanOrEqual(2);
        expect(c.data.radius).toBeLessThanOrEqual(4);
      } else {
        expect(c.data.tolerance).toBeGreaterThanOrEqual(0.5);
        expect(c.data.tolerance).toBeLessThanOrEqual(1.0);
        expect(Number.isInteger(c.data.distance)).toBe(true);
      }
    }
  });
});
