import { describe, it, expect } from 'vitest';
import {
  dailyKey, dailySeed, createDailySession, createDailySessionFromKey, createStreak, daysBetween,
  DAILY_ROUND, FREEZE_EVERY, FREEZE_CAP,
} from '../src/core/daily';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('daily seed', () => {
  it('dailyKey is the UTC date', () => {
    expect(dailyKey(new Date(Date.UTC(2026, 7, 31, 23, 59)))).toBe('2026-08-31');
  });
  it('dailySeed is YYYYMMDD as a number', () => {
    expect(dailySeed(new Date(Date.UTC(2026, 7, 31)))).toBe(20260831);
  });
  it('same date reproduces the same level; different dates differ', () => {
    const d = new Date(Date.UTC(2026, 7, 31));
    const a = createDailySession(d);
    const b = createDailySession(d);
    expect(a.level).toEqual(b.level);
    expect(a.mode).toBe('daily');
    expect(a.round).toBe(DAILY_ROUND);
    const c = createDailySession(new Date(Date.UTC(2026, 8, 1)));
    expect(c.level.targetPos).not.toEqual(a.level.targetPos);
  });
});

describe('createDailySessionFromKey', () => {
  it('same key reproduces the same level; matches createDailySession for that date', () => {
    const a = createDailySessionFromKey('2026-09-01');
    const b = createDailySessionFromKey('2026-09-01');
    expect(a.level).toEqual(b.level);
    const c = createDailySession(new Date(Date.UTC(2026, 8, 1)));
    expect(a.level).toEqual(c.level);
    expect(a.mode).toBe('daily');
  });
});

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-08-30', '2026-08-31')).toBe(1);
    expect(daysBetween('2026-08-28', '2026-08-31')).toBe(3);
  });
});

describe('streak', () => {
  it('first play starts streak at 1', () => {
    const s = createStreak(fakeStorage()).recordPlay('2026-08-31');
    expect(s).toEqual({ streak: 1, freezes: 0, lastPlayed: '2026-08-31' });
  });
  it('consecutive days increment; same day is idempotent', () => {
    const store = createStreak(fakeStorage());
    store.recordPlay('2026-08-30');
    store.recordPlay('2026-08-31');
    expect(store.recordPlay('2026-08-31').streak).toBe(2);
  });
  it(`every ${FREEZE_EVERY} streak days grants a freeze, capped at ${FREEZE_CAP}`, () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 7; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`);
    expect(store.state()).toMatchObject({ streak: 7, freezes: 1 });
  });
  it('a missed day consumes a freeze and keeps the streak going', () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 7; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`);
    const s = store.recordPlay('2026-08-19'); // 漏掉 08-18
    expect(s).toMatchObject({ streak: 8, freezes: 0 });
  });
  it('without enough freezes the streak halves plus today (never resets to zero)', () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 6; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`);
    const s = store.recordPlay('2026-08-20'); // 漏 3 天、無歇腳符
    expect(s).toMatchObject({ streak: Math.floor(6 / 2) + 1, freezes: 0 });
  });
  it('insufficient freezes are kept, streak still halves (D1)', () => {
    const store = createStreak(fakeStorage());
    for (let i = 1; i <= 7; i++) store.recordPlay(`2026-08-${String(10 + i).padStart(2, '0')}`); // streak 7, freezes 1
    const s = store.recordPlay('2026-08-21'); // 漏 3 天 > 1 符
    expect(s).toMatchObject({ streak: Math.floor(7 / 2) + 1, freezes: 1 });
  });
  it('persists through storage and survives corruption', () => {
    const storage = fakeStorage();
    createStreak(storage).recordPlay('2026-08-31');
    expect(createStreak(storage).state().streak).toBe(1);
    expect(createStreak(fakeStorage({ 'rht.daily.v1': '{{{' })).state())
      .toEqual({ streak: 0, freezes: 0, lastPlayed: null });
  });
});
