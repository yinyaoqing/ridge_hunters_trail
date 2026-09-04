import { describe, it, expect } from 'vitest';
import { createCoach, coachOnce } from '../src/core/coach';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

function throwingStorage() {
  return {
    getItem: (): string | null => { throw new Error('denied'); },
    setItem: (): void => { throw new Error('denied'); },
  };
}

describe('createCoach', () => {
  it('starts with nothing seen', () => {
    const coach = createCoach(fakeStorage());
    expect(coach.seen('supply')).toBe(false);
    expect(coach.seen('bankpush')).toBe(false);
  });

  it('remembers what was marked seen', () => {
    const coach = createCoach(fakeStorage());
    coach.markSeen('supply');
    expect(coach.seen('supply')).toBe(true);
    expect(coach.seen('bankpush')).toBe(false);
  });

  it('markSeen is idempotent', () => {
    const store = fakeStorage();
    const coach = createCoach(store);
    coach.markSeen('supply');
    const after1 = JSON.stringify(store.dump());
    coach.markSeen('supply');
    expect(JSON.stringify(store.dump())).toBe(after1);
    expect(coach.seen('supply')).toBe(true);
  });

  it('persists through a fresh store over the same storage', () => {
    const store = fakeStorage();
    createCoach(store).markSeen('iris');
    expect(createCoach(store).seen('iris')).toBe(true);
  });

  it('reset clears every flag', () => {
    const coach = createCoach(fakeStorage());
    coach.markSeen('iris');
    coach.markSeen('supply');
    coach.reset();
    expect(coach.seen('iris')).toBe(false);
    expect(coach.seen('supply')).toBe(false);
  });

  it('falls back to memory when storage throws', () => {
    const coach = createCoach(throwingStorage());
    expect(coach.seen('supply')).toBe(false);
    expect(() => coach.markSeen('supply')).not.toThrow();
    expect(coach.seen('supply')).toBe(true);
  });

  it('falls back to defaults on corrupt JSON', () => {
    const coach = createCoach(fakeStorage({ 'rht.seen.v1': '{not json' }));
    expect(coach.seen('supply')).toBe(false);
  });

  it('falls back to defaults when the stored value is not an object', () => {
    const coach = createCoach(fakeStorage({ 'rht.seen.v1': '42' }));
    expect(coach.seen('supply')).toBe(false);
  });

  it('works with no storage at all', () => {
    const coach = createCoach();
    coach.markSeen('daily');
    expect(coach.seen('daily')).toBe(true);
  });
});

describe('coachOnce', () => {
  it('runs show and marks seen the first time', () => {
    const coach = createCoach(fakeStorage());
    let calls = 0;
    expect(coachOnce(coach, 'supply', () => { calls++; })).toBe(true);
    expect(calls).toBe(1);
    expect(coach.seen('supply')).toBe(true);
  });

  it('does nothing on later calls', () => {
    const coach = createCoach(fakeStorage());
    let calls = 0;
    coachOnce(coach, 'supply', () => { calls++; });
    expect(coachOnce(coach, 'supply', () => { calls++; })).toBe(false);
    expect(calls).toBe(1);
  });

  it('keeps ids independent', () => {
    const coach = createCoach(fakeStorage());
    coachOnce(coach, 'supply', () => {});
    let shown = false;
    expect(coachOnce(coach, 'iris', () => { shown = true; })).toBe(true);
    expect(shown).toBe(true);
  });
});
