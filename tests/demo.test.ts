import { describe, it, expect } from 'vitest';
import { candidates, intersect, key } from '../src/core/clues';
import { heatMap, maxHeat } from '../src/core/deduction';
import {
  DEMO_SIZE, DEMO_START, DEMO_TARGET, DEMO_MID, DEMO_CLUES, DECOY_INDEX, DEMO_PAIR,
} from '../src/core/demo';

const real = DEMO_CLUES.filter((c) => !c.isDecoy);
const decoy = DEMO_CLUES[DECOY_INDEX];

describe('demo level', () => {
  it('has four clues, exactly one of them a decoy', () => {
    expect(DEMO_CLUES).toHaveLength(4);
    expect(DEMO_CLUES.filter((c) => c.isDecoy)).toHaveLength(1);
    expect(decoy.isDecoy).toBe(true);
  });

  it('keeps every position inside the grid', () => {
    const all = [DEMO_START, DEMO_TARGET, DEMO_MID, ...DEMO_CLUES.map((c) => c.position)];
    for (const p of all) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(DEMO_SIZE);
      expect(p.y).toBeLessThan(DEMO_SIZE);
    }
  });

  it('has every honest clue covering the target', () => {
    for (const c of real) expect(candidates(c, DEMO_SIZE).has(key(DEMO_TARGET))).toBe(true);
  });

  it('has the decoy not covering the target', () => {
    expect(candidates(decoy, DEMO_SIZE).has(key(DEMO_TARGET))).toBe(false);
  });

  it('parks the mid-walk position inside the two-clue overlap', () => {
    // 第 10 步的旁白是「往交集區走過去」。玩家若停在交集區外，那句話就是假的。
    expect(DEMO_PAIR.has(key(DEMO_MID))).toBe(true);
  });
});

describe('demo level: chapter 2 — the overlap is the answer', () => {
  it('narrows to 11 cells once the first two clues are read', () => {
    expect(DEMO_PAIR.size).toBe(11);
    expect(DEMO_PAIR).toEqual(intersect([DEMO_CLUES[0], DEMO_CLUES[1]], DEMO_SIZE));
  });
});

describe('demo level: chapter 3 — the odd one out is the liar', () => {
  // 課程宣稱「兩條互相印證、剩下那條和誰都對不上」。這句話只有在幌子與兩條真線索
  // 皆不相交時才字面成立；若幌子與其中一條有交集，畫面上就會冒出第二塊「符合兩條」的
  // 區域，「落單」的推理當場失效——而玩家只會覺得自己被騙。
  it('has the decoy disjoint from both of the first two clues', () => {
    const d = candidates(decoy, DEMO_SIZE);
    for (const i of [0, 1]) {
      const c = candidates(DEMO_CLUES[i], DEMO_SIZE);
      expect([...d].filter((k) => c.has(k))).toEqual([]);
    }
  });

  it('leaves no cell matching all three, and exactly the 11 matching two', () => {
    const heat = heatMap([DEMO_CLUES[0], DEMO_CLUES[1], decoy], DEMO_SIZE);
    expect(maxHeat(heat)).toBe(2);
    const two = new Set([...heat.entries()].filter(([, n]) => n === 2).map(([k]) => k));
    expect(two).toEqual(DEMO_PAIR);
  });
});

describe('demo level: chapter 4 — it converges', () => {
  it('collapses to exactly the target once all three honest clues are in', () => {
    expect(intersect(real, DEMO_SIZE)).toEqual(new Set([key(DEMO_TARGET)]));
  });
});
