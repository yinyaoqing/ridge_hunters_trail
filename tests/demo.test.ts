import { describe, it, expect } from 'vitest';
import { candidates, intersect, key } from '../src/core/clues';
import { heatMap, maxHeat } from '../src/core/deduction';
import {
  DEMO_SIZE, DEMO_START, DEMO_TARGET, DEMO_MID, DEMO_CLUES, DECOY_INDEX, DEMO_PAIR,
  DEMO_STEPS, type DemoStep, demoUnseen, checkCellAction, checkMuteAction,
} from '../src/core/demo';
import { STRINGS } from '../src/core/i18n';
import { parseKey } from '../src/core/marks';

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

describe('demo script', () => {
  it('is exactly fourteen steps', () => {
    expect(DEMO_STEPS).toHaveLength(14);
  });

  it('walks the four chapters in order without going back', () => {
    const chapters = DEMO_STEPS.map((s) => s.chapter);
    expect(chapters[0]).toBe(1);
    expect(chapters[chapters.length - 1]).toBe(4);
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i]).toBeGreaterThanOrEqual(chapters[i - 1]);
      expect(chapters[i] - chapters[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(new Set(chapters)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('only ever references clues that exist, and only mutes ones already read', () => {
    for (const step of DEMO_STEPS) {
      for (const i of step.clues) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(DEMO_CLUES.length);
      }
      for (const i of step.muted) expect(step.clues).toContain(i);
      expect(new Set(step.clues).size).toBe(step.clues.length);
    }
  });

  it('never un-reads a clue', () => {
    // 課程是單向累積的。若某一步的已讀集合比前一步小，代表腳本寫錯了，
    // 而畫面上會表現為「線索憑空消失」——玩家只會覺得程式壞了。
    for (let i = 1; i < DEMO_STEPS.length; i++) {
      for (const c of DEMO_STEPS[i - 1].clues) expect(DEMO_STEPS[i].clues).toContain(c);
    }
  });

  it('only ever mutes the decoy', () => {
    for (const step of DEMO_STEPS) {
      for (const i of step.muted) expect(i).toBe(DECOY_INDEX);
    }
  });

  it('has exactly three hands-on beats, in the taught order', () => {
    const actions = DEMO_STEPS.map((s) => s.action).filter(Boolean);
    expect(actions).toEqual(['exclude', 'mute', 'wager']);
  });

  it('gives every step a narration string in both locales', () => {
    for (const step of DEMO_STEPS) {
      for (const loc of ['en', 'zh-TW'] as const) {
        expect(STRINGS[loc][step.narration].length).toBeGreaterThan(0);
      }
    }
  });

  it('never uses the same narration twice', () => {
    const keys = DEMO_STEPS.map((s) => s.narration);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pairs every {n} placeholder with a vars value, in both locales', () => {
    // 這條測試是「文案與畫面在結構上不可能對不上」的實際保證：
    // 有 vars 卻沒有佔位符 → 算出來的數字不會被顯示；
    // 有佔位符卻沒有 vars → 玩家會看到字面的「{n}」。
    for (const step of DEMO_STEPS) {
      for (const loc of ['en', 'zh-TW'] as const) {
        expect(/\{n\}/.test(STRINGS[loc][step.narration])).toBe(step.vars !== undefined);
      }
    }
  });

  it('never reads the fourth clue while it is still under fog', () => {
    // 第四條線索的存在感就是眺望的報酬。若腳本讓它在退霧之前就被讀到，
    // 第 11 步的旁白（「霧退開，第四條線索浮了出來」）就會變成空話。
    // 用「凡是讀到它的步驟，霧必定已退」而非比較首次出現的索引——
    // 前者允許兩件事發生在同一步，後者會誤把那種正確的腳本判成錯的。
    expect(DEMO_STEPS.some((s) => s.clues.includes(3))).toBe(true);
    for (const step of DEMO_STEPS) {
      if (step.clues.includes(3)) expect(step.seen).toBe('all');
    }
  });

  it('never declares an overlay with no live clue to draw it from', () => {
    // overlay 不是 'none' 卻沒有任何未靜音的已讀線索時，畫面會是一片空白，
    // 而旁白照樣宣稱玩家看得到東西。
    for (const step of DEMO_STEPS) {
      if (step.overlay === 'none') continue;
      const live = step.clues.filter((i) => !step.muted.includes(i));
      expect(live.length).toBeGreaterThan(0);
    }
  });

  it('moves the player to the overlap before the survey', () => {
    const firstMid = DEMO_STEPS.findIndex((s) => s.player === DEMO_MID);
    const firstAllSeen = DEMO_STEPS.findIndex((s) => s.seen === 'all');
    expect(firstMid).toBeGreaterThan(0);
    expect(firstMid).toBeLessThanOrEqual(firstAllSeen);
  });
});

describe('demoUnseen', () => {
  const nearStep = DEMO_STEPS.find((s) => s.seen === 'near')!;
  const allStep = DEMO_STEPS.find((s) => s.seen === 'all')!;

  it('hides the fourth clue before the survey', () => {
    expect(demoUnseen(nearStep).has(key(DEMO_CLUES[3].position))).toBe(true);
  });

  it('never hides any of the eleven overlap cells', () => {
    // 第二、三章整章都在講那 11 格。若迷霧蓋掉其中任何一格，
    // 玩家會在畫面上看到與旁白不同的數字。
    const unseen = demoUnseen(nearStep);
    for (const k of DEMO_PAIR) expect(unseen.has(k)).toBe(false);
  });

  it('never hides the target, the start, or the mid-walk position', () => {
    const unseen = demoUnseen(nearStep);
    for (const p of [DEMO_TARGET, DEMO_START, DEMO_MID]) expect(unseen.has(key(p))).toBe(false);
  });

  it('hides nothing once the survey has run', () => {
    expect(demoUnseen(allStep).size).toBe(0);
  });
});

describe('checkCellAction: exclude', () => {
  it('accepts a cell outside the cone', () => {
    expect(checkCellAction('exclude', { x: 0, y: 0 })).toBe(null);
  });

  it('rejects a cell inside the cone and says why', () => {
    const inside = parseKey([...candidates(DEMO_CLUES[0], DEMO_SIZE)][0]);
    expect(checkCellAction('exclude', inside)).toBe('demo.hint.exclude');
  });

  it('rejects excluding the target, which is inside the cone', () => {
    expect(checkCellAction('exclude', DEMO_TARGET)).toBe('demo.hint.exclude');
  });
});

describe('checkCellAction: wager', () => {
  it('accepts the target', () => {
    expect(checkCellAction('wager', DEMO_TARGET)).toBe(null);
  });

  it('rejects a cell that is merely in the overlap', () => {
    // 最容易踩的錯：玩家點了 11 格裡的另一格。這條確保提示會出現，而不是靜默接受。
    const other = parseKey([...DEMO_PAIR].find((k) => k !== key(DEMO_TARGET))!);
    expect(checkCellAction('wager', other)).toBe('demo.hint.wager');
  });

  it('rejects an empty cell', () => {
    expect(checkCellAction('wager', { x: 0, y: 0 })).toBe('demo.hint.wager');
  });
});

describe('checkCellAction: cells outside the grid', () => {
  it('rejects an out-of-grid cell for either action', () => {
    // 這是回歸測試：CONE 只含格內座標，因此少了邊界守衛時，界外格會因為
    // 「不在錐形裡」而被判成正確的排除。
    const outside = [
      { x: -1, y: -1 }, { x: DEMO_SIZE, y: 0 }, { x: 0, y: DEMO_SIZE }, { x: 99, y: 99 },
    ];
    for (const cell of outside) {
      expect(checkCellAction('exclude', cell)).toBe('demo.hint.exclude');
      expect(checkCellAction('wager', cell)).toBe('demo.hint.wager');
    }
  });
});

describe('checkMuteAction', () => {
  it('accepts the decoy', () => {
    expect(checkMuteAction(DECOY_INDEX)).toBe(null);
  });

  it('rejects every honest clue', () => {
    for (let i = 0; i < DEMO_CLUES.length; i++) {
      if (i === DECOY_INDEX) continue;
      expect(checkMuteAction(i)).toBe('demo.hint.mute');
    }
  });
});
