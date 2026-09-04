import { describe, it, expect } from 'vitest';
import { intersect, key } from '../src/core/clues';
import {
  QUARRY_SIZE, QUARRY_NODES, QUARRY_CLUES, QUARRY_START, QUARRY_TARGET, QUARRY_PAIR,
  QUARRY_SCRIPT,
} from '../src/core/demo';
import { STRINGS } from '../src/core/i18n';

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

  // 「線索標的是牠經過的地方，不是牠現在的位置」——不只自己那一齡，
  // 任何一條線索都不准畫在任何一個節點正上方，否則這句話會被畫面自己推翻
  it('never draws a clue on top of any waypoint, its own age or another', () => {
    for (const clue of QUARRY_CLUES) {
      for (const node of QUARRY_NODES) {
        expect(key(clue.position)).not.toBe(key(node));
      }
    }
  });

  // drawClueToken 畫的是不透明底盤，疊在同一格的線索記號只有最後畫的那個看得見。
  // 六個位置必須兩兩相異，否則玩家在畫面上數到的記號會少於旁白說的「六條」
  // （這條約束原本只活在 scripts/find-quarry-lesson.mjs 的搜尋條件裡，沒人重跑
  // 腳本就不會被驗到——這正是本測試要補的缺口）
  it('never overlaps two clue positions on the same cell', () => {
    const positions = QUARRY_CLUES.map((c) => key(c.position));
    expect(new Set(positions).size).toBe(positions.length);
  });

  // 三個節點與外推點都要離邊界至少 1 格，教學的「連線＝方向」才有畫面空間可讀
  it('keeps every waypoint and the target at least one cell inside the border', () => {
    for (const p of [...QUARRY_NODES, QUARRY_TARGET]) {
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(QUARRY_SIZE - 2);
      expect(p.y).toBeGreaterThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(QUARRY_SIZE - 2);
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

describe('quarry lesson script', () => {
  it('covers three chapters in order', () => {
    const chapters = QUARRY_SCRIPT.steps.map((s) => s.chapter);
    expect(chapters[0]).toBe(1);
    expect(chapters[chapters.length - 1]).toBe(3);
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i]).toBeGreaterThanOrEqual(chapters[i - 1]);
    }
  });

  it('matches every narration placeholder to a var', () => {
    for (const step of QUARRY_SCRIPT.steps) {
      for (const table of Object.values(STRINGS)) {
        const text = table[step.narration];
        const placeholders = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(placeholders).toEqual(Object.keys(step.vars ?? {}).sort());
      }
    }
  });

  it('explains that nothing is lying instead of reusing the wager hint', () => {
    expect(QUARRY_SCRIPT.checkClue(0)).toBe('demo2.hint.mute');
  });

  it('only accepts the extrapolated cell as the call', () => {
    expect(QUARRY_SCRIPT.checkCell('wager', QUARRY_TARGET)).toBeNull();
    for (const node of QUARRY_NODES) {
      expect(QUARRY_SCRIPT.checkCell('wager', node)).toBe('demo2.hint.wager');
    }
  });

  it('asks the player to pick an age, then to call it', () => {
    const actions = QUARRY_SCRIPT.steps.map((s) => s.action).filter(Boolean);
    expect(actions).toEqual(['pick-age', 'wager']);
  });
});
