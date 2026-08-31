import { describe, it, expect } from 'vitest';
import { newQte, tick, press, type QteState } from '../src/core/qte';
import { mulberry32 } from '../src/core/rng';
import type { QteParams } from '../src/core/difficulty';

const CFG: QteParams = { speed: 180, arcSize: 70, rounds: 3, needed: 2 };

describe('newQte', () => {
  it('starts at pointer 0 with arc inside [0, 360-arcSize]', () => {
    const q = newQte(CFG, mulberry32(1));
    expect(q.pointer).toBe(0);
    expect(q.arcStart).toBeGreaterThanOrEqual(0);
    expect(q.arcStart).toBeLessThanOrEqual(360 - CFG.arcSize);
    expect(q.done).toBe(false);
  });
});

describe('tick', () => {
  it('advances pointer by speed * dt and wraps at 360', () => {
    const q = newQte(CFG, mulberry32(1));
    tick(q, CFG, 500); // 180度/s * 0.5s = 90度
    expect(q.pointer).toBeCloseTo(90);
    tick(q, CFG, 2000); // +360 -> 繞回
    expect(q.pointer).toBeCloseTo(90);
  });
  it('does not move after done', () => {
    const q = newQte(CFG, mulberry32(1));
    q.done = true;
    tick(q, CFG, 500);
    expect(q.pointer).toBe(0);
  });
});

describe('press', () => {
  function fixed(q: QteState, arcStart: number, pointer: number): QteState {
    q.arcStart = arcStart;
    q.pointer = pointer;
    return q;
  }

  it('registers a hit when pointer is inside the arc', () => {
    const q = fixed(newQte(CFG, mulberry32(1)), 0, 30);
    press(q, CFG, mulberry32(2));
    expect(q.lastHit).toBe(true);
    expect(q.hits).toBe(1);
    expect(q.attempt).toBe(1);
  });

  it('registers a miss when pointer is outside the arc', () => {
    const q = fixed(newQte(CFG, mulberry32(1)), 0, 200);
    press(q, CFG, mulberry32(2));
    expect(q.lastHit).toBe(false);
    expect(q.hits).toBe(0);
  });

  it('succeeds as soon as needed hits are reached', () => {
    const q = newQte(CFG, mulberry32(1));
    press(fixed(q, 0, 10), CFG, mulberry32(2));
    press(fixed(q, 0, 10), CFG, mulberry32(3));
    expect(q.done).toBe(true);
    expect(q.success).toBe(true);
  });

  it('fails after exhausting all attempts without enough hits', () => {
    const q = newQte(CFG, mulberry32(1));
    press(fixed(q, 0, 200), CFG, mulberry32(2));
    press(fixed(q, 0, 200), CFG, mulberry32(3));
    press(fixed(q, 0, 200), CFG, mulberry32(4));
    expect(q.done).toBe(true);
    expect(q.success).toBe(false);
  });

  it('rerolls the arc between attempts while not done', () => {
    const q = newQte(CFG, mulberry32(1));
    press(fixed(q, 0, 10), CFG, mulberry32(2));
    expect(q.done).toBe(false);
    expect(q.arcStart).toBeGreaterThanOrEqual(0);
    expect(q.arcStart).toBeLessThanOrEqual(360 - CFG.arcSize);
  });

  it('ignores presses after done', () => {
    const q = newQte(CFG, mulberry32(1));
    q.done = true;
    q.success = true;
    press(q, CFG, mulberry32(2));
    expect(q.attempt).toBe(0);
  });
});

describe('offsets (hit precision)', () => {
  const cfg = { speed: 180, arcSize: 40, rounds: 3, needed: 2 };
  it('records offset 0 for a dead-center hit and ~1 near the edge', () => {
    const rng = () => 0.5; // arcStart = 0.5 * (360-40) = 160, 弧心 = 180
    const q = newQte(cfg, rng);
    q.pointer = 180; // 正中
    press(q, cfg, rng);
    expect(q.offsets).toHaveLength(1);
    expect(q.offsets[0]).toBeCloseTo(0);
    q.pointer = 160.5; // 貼近弧緣（新弧同樣 160–200）
    press(q, cfg, rng);
    expect(q.offsets[1]).toBeCloseTo(0.975);
  });
  it('does not record offsets on misses', () => {
    const rng = () => 0.5;
    const q = newQte(cfg, rng);
    q.pointer = 10; // 弧區外
    press(q, cfg, rng);
    expect(q.offsets).toHaveLength(0);
  });
});
