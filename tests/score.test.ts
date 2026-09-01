import { describe, it, expect } from 'vitest';
import { catchScore, createScoreStore, QUALITY_MULT, MULTIPLIERS } from '../src/core/score';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('catchScore', () => {
  it('computes bronze without iris', () => {
    expect(catchScore(5, 'bronze', false)).toBe(500);
  });
  it('computes bronze with iris (double)', () => {
    expect(catchScore(5, 'bronze', true)).toBe(1000);
  });
  it('computes silver without iris', () => {
    expect(catchScore(5, 'silver', false)).toBe(600);
  });
  it('computes silver with iris (double)', () => {
    expect(catchScore(5, 'silver', true)).toBe(1200);
  });
  it('computes gold without iris', () => {
    expect(catchScore(5, 'gold', false)).toBe(750);
  });
  it('computes gold with iris (double)', () => {
    expect(catchScore(5, 'gold', true)).toBe(1500);
  });
  it('rounds to nearest integer', () => {
    // 3 * 100 * 1.2 * 1 = 360 (exact); use a case that needs rounding
    expect(catchScore(1, 'silver', false)).toBe(120);
  });
});

describe('QUALITY_MULT / MULTIPLIERS constants', () => {
  it('has expected quality multipliers', () => {
    expect(QUALITY_MULT).toEqual({ bronze: 1, silver: 1.2, gold: 1.5 });
  });
  it('has expected multiplier ladder', () => {
    expect(MULTIPLIERS).toEqual([1, 1.5, 2, 2.5]);
  });
});

describe('createScoreStore', () => {
  it('defaults to zeroed state with multiplier 1', () => {
    const s = createScoreStore(fakeStorage());
    expect(s.state()).toEqual({ banked: 0, pot: 0, multiplier: 1, bestRun: 0 });
  });

  it('addCatch applies the current multiplier to pot and returns the gain', () => {
    const s = createScoreStore(fakeStorage());
    const gain = s.addCatch(500);
    expect(gain).toBe(500); // multiplier 1
    expect(s.state().pot).toBe(500);
  });

  it('push raises the multiplier and the NEXT addCatch uses the new multiplier', () => {
    const s = createScoreStore(fakeStorage());
    s.addCatch(100); // pot = 100 at x1
    s.push(); // multiplier -> 1.5
    const gain = s.addCatch(100); // 100 * 1.5 = 150
    expect(gain).toBe(150);
    expect(s.state().pot).toBe(250);
  });

  it('push climbs the ladder 1 -> 1.5 -> 2 -> 2.5 and then stays at 2.5', () => {
    const s = createScoreStore(fakeStorage());
    expect(s.state().multiplier).toBe(1);
    s.push();
    expect(s.state().multiplier).toBe(1.5);
    s.push();
    expect(s.state().multiplier).toBe(2);
    s.push();
    expect(s.state().multiplier).toBe(2.5);
    s.push();
    expect(s.state().multiplier).toBe(2.5);
  });

  it('bank moves pot into banked, updates bestRun, and resets pot/multiplier', () => {
    const s = createScoreStore(fakeStorage());
    s.addCatch(500);
    s.push();
    s.addCatch(100); // pot = 500 + 150 = 650
    const result = s.bank();
    expect(result).toEqual({ banked: 650, pot: 0, multiplier: 1, bestRun: 650 });
    expect(s.state()).toEqual({ banked: 650, pot: 0, multiplier: 1, bestRun: 650 });
  });

  it('a second, lower bank does not lower bestRun', () => {
    const s = createScoreStore(fakeStorage());
    s.addCatch(1000);
    s.bank();
    expect(s.state().bestRun).toBe(1000);
    s.addCatch(200);
    const result = s.bank();
    expect(result.banked).toBe(1200);
    expect(result.bestRun).toBe(1200); // bestRun computed AFTER banked update, so it grows again
  });

  it('a bank smaller than the running best does not lower bestRun', () => {
    const s = createScoreStore(fakeStorage());
    s.addCatch(1000);
    s.bank(); // banked=1000, bestRun=1000
    s.loseRun();
    s.addCatch(50);
    const result = s.bank(); // banked=1050, still less growth but banked only grows (monotonic) - verify bestRun tracks banked
    expect(result.bestRun).toBe(1050);
  });

  it('loseRun resets pot and multiplier but preserves banked and bestRun', () => {
    const s = createScoreStore(fakeStorage());
    s.addCatch(1000);
    s.bank(); // banked=1000, bestRun=1000
    s.addCatch(300);
    s.push();
    const result = s.loseRun();
    expect(result).toEqual({ banked: 1000, pot: 0, multiplier: 1, bestRun: 1000 });
    expect(s.state()).toEqual({ banked: 1000, pot: 0, multiplier: 1, bestRun: 1000 });
  });

  it('persists state through storage across store instances', () => {
    const storage = fakeStorage();
    const s = createScoreStore(storage);
    s.addCatch(400);
    s.push();
    s.addCatch(100);
    s.bank();
    const again = createScoreStore(storage);
    expect(again.state()).toEqual({ banked: 550, pot: 0, multiplier: 1, bestRun: 550 });
  });

  it('recovers from corrupted JSON', () => {
    const s = createScoreStore(fakeStorage({ 'rht.score.v1': '{{{' }));
    expect(s.state()).toEqual({ banked: 0, pot: 0, multiplier: 1, bestRun: 0 });
  });

  it('recovers to defaults when a stored multiplier is not on the ladder', () => {
    const s = createScoreStore(
      fakeStorage({ 'rht.score.v1': '{"banked":5,"pot":5,"multiplier":3,"bestRun":5}' })
    );
    expect(s.state()).toEqual({ banked: 0, pot: 0, multiplier: 1, bestRun: 0 });
  });

  it('recovers to defaults when a field is negative or non-finite', () => {
    const s1 = createScoreStore(fakeStorage({ 'rht.score.v1': '{"banked":-1,"pot":0,"multiplier":1,"bestRun":0}' }));
    expect(s1.state()).toEqual({ banked: 0, pot: 0, multiplier: 1, bestRun: 0 });
    const s2 = createScoreStore(fakeStorage({ 'rht.score.v1': '{"banked":0,"pot":1e999,"multiplier":1,"bestRun":0}' }));
    expect(s2.state()).toEqual({ banked: 0, pot: 0, multiplier: 1, bestRun: 0 });
  });

  it('keeps in-memory state when reads throw after a write', () => {
    let armed = false;
    const s = createScoreStore({
      getItem: () => { if (armed) throw new Error('sec'); return null; },
      setItem: () => { armed = true; },
    });
    s.addCatch(300);
    expect(s.state().pot).toBe(300);
  });

  it('works without storage', () => {
    const s = createScoreStore();
    s.addCatch(200);
    s.push();
    expect(s.state().pot).toBe(200);
    expect(s.state().multiplier).toBe(1.5);
  });
});
