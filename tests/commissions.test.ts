import { describe, it, expect } from 'vitest';
import {
  seedFromKey, dailyCommissions, evaluate, createCommissionStore,
  COMMISSION_REWARD_NOTES, type Commission, type ResultCtx,
} from '../src/core/commissions';
import { CREATURES } from '../src/data/creatures';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const CREATURE_IDS = CREATURES.map((c) => c.id);

describe('seedFromKey', () => {
  it('converts YYYY-MM-DD to YYYYMMDD number', () => {
    expect(seedFromKey('2026-09-01')).toBe(20260901);
  });
});

describe('dailyCommissions', () => {
  it('always returns 3 commissions in fixed kind order', () => {
    const cs = dailyCommissions('2026-09-01');
    expect(cs).toHaveLength(3);
    expect(cs.map((c) => c.kind)).toEqual(['record-creature', 'stamina-finish', 'quality-any']);
  });

  it('is deterministic for the same dateKey', () => {
    const a = dailyCommissions('2026-09-01');
    const b = dailyCommissions('2026-09-01');
    expect(a).toEqual(b);
  });

  it('draws valid values for each commission kind', () => {
    for (const key of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      const [c0, c1, c2] = dailyCommissions(key);
      expect(c0.kind).toBe('record-creature');
      if (c0.kind === 'record-creature') expect(CREATURE_IDS).toContain(c0.creatureId);
      expect(c1.kind).toBe('stamina-finish');
      if (c1.kind === 'stamina-finish') expect([15, 20, 25]).toContain(c1.min);
      expect(c2.kind).toBe('quality-any');
      if (c2.kind === 'quality-any') expect(['silver', 'gold']).toContain(c2.quality);
    }
  });

  it('differs across dates (existence-of-difference property)', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03'];
    const results = dates.map((d) => JSON.stringify(dailyCommissions(d)));
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('evaluate', () => {
  const base: ResultCtx = {
    caught: true, creatureId: 'mistfawn', staminaLeft: 20, quality: 'silver', mode: 'run',
  };

  it('record-creature: true only when caught and id matches', () => {
    const c: Commission = { kind: 'record-creature', creatureId: 'mistfawn' };
    expect(evaluate(c, base)).toBe(true);
    expect(evaluate(c, { ...base, creatureId: 'emberquill' })).toBe(false);
    expect(evaluate(c, { ...base, caught: false })).toBe(false);
  });

  it('stamina-finish: true only when caught and staminaLeft >= min', () => {
    const c: Commission = { kind: 'stamina-finish', min: 20 };
    expect(evaluate(c, { ...base, staminaLeft: 20 })).toBe(true);
    expect(evaluate(c, { ...base, staminaLeft: 25 })).toBe(true);
    expect(evaluate(c, { ...base, staminaLeft: 19 })).toBe(false);
    expect(evaluate(c, { ...base, caught: false, staminaLeft: 25 })).toBe(false);
  });

  it('quality-any: rank-based comparison, gold satisfies silver requirement', () => {
    const c: Commission = { kind: 'quality-any', quality: 'silver' };
    expect(evaluate(c, { ...base, quality: 'silver' })).toBe(true);
    expect(evaluate(c, { ...base, quality: 'gold' })).toBe(true);
    expect(evaluate(c, { ...base, quality: 'bronze' })).toBe(false);
    expect(evaluate(c, { ...base, quality: null })).toBe(false);
    expect(evaluate(c, { ...base, caught: false, quality: 'gold' })).toBe(false);
  });

  it('quality-any gold requirement rejects silver', () => {
    const c: Commission = { kind: 'quality-any', quality: 'gold' };
    expect(evaluate(c, { ...base, quality: 'silver' })).toBe(false);
    expect(evaluate(c, { ...base, quality: 'gold' })).toBe(true);
  });
});

describe('COMMISSION_REWARD_NOTES', () => {
  it('is 2', () => {
    expect(COMMISSION_REWARD_NOTES).toBe(2);
  });
});

describe('createCommissionStore', () => {
  it('defaults to all-false status', () => {
    const store = createCommissionStore(fakeStorage());
    expect(store.statusFor('2026-09-01')).toEqual([false, false, false]);
  });

  it('markDone persists per date', () => {
    const storage = fakeStorage();
    const store = createCommissionStore(storage);
    store.markDone('2026-09-01', 1);
    expect(store.statusFor('2026-09-01')).toEqual([false, true, false]);
    const again = createCommissionStore(storage);
    expect(again.statusFor('2026-09-01')).toEqual([false, true, false]);
  });

  it('statusFor a different date resets to all-false', () => {
    const storage = fakeStorage();
    const store = createCommissionStore(storage);
    store.markDone('2026-09-01', 0);
    expect(store.statusFor('2026-09-02')).toEqual([false, false, false]);
  });

  it('markDone on a new date resets the other slots', () => {
    const storage = fakeStorage();
    const store = createCommissionStore(storage);
    store.markDone('2026-09-01', 0);
    store.markDone('2026-09-02', 2);
    expect(store.statusFor('2026-09-02')).toEqual([false, false, true]);
  });

  it('recovers from corrupted JSON with all-false', () => {
    const store = createCommissionStore(fakeStorage({ 'rht.commissions.v1': '{{{' }));
    expect(store.statusFor('2026-09-01')).toEqual([false, false, false]);
  });

  it('recovers from malformed shape with all-false', () => {
    const store = createCommissionStore(fakeStorage({ 'rht.commissions.v1': '{"foo":1}' }));
    expect(store.statusFor('2026-09-01')).toEqual([false, false, false]);
  });

  it('keeps in-memory state when reads throw after a write', () => {
    let armed = false;
    const store = createCommissionStore({
      getItem: () => { if (armed) throw new Error('sec'); return null; },
      setItem: () => { armed = true; },
    });
    store.markDone('2026-09-01', 0);
    expect(store.statusFor('2026-09-01')).toEqual([true, false, false]);
  });

  it('works without storage', () => {
    const store = createCommissionStore();
    store.markDone('2026-09-01', 2);
    expect(store.statusFor('2026-09-01')).toEqual([false, false, true]);
  });
});
