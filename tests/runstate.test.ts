import { describe, it, expect } from 'vitest';
import { createRunState } from '../src/core/runstate';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createRunState', () => {
  it('defaults to round 1, zero wins', () => {
    const rs = createRunState(fakeStorage());
    expect(rs.round()).toBe(1);
    expect(rs.wins()).toBe(0);
  });
  it('persists round and wins through storage', () => {
    const storage = fakeStorage();
    const rs = createRunState(storage);
    rs.setRound(4);
    rs.addWin();
    rs.addWin();
    const again = createRunState(storage);
    expect(again.round()).toBe(4);
    expect(again.wins()).toBe(2);
  });
  it('recovers from corrupted data', () => {
    const rs = createRunState(fakeStorage({ 'rht.run.v1': '{{{' }));
    expect(rs.round()).toBe(1);
  });
  it('keeps in-memory state when reads throw after a write', () => {
    let armed = false;
    const rs = createRunState({
      getItem: () => { if (armed) throw new Error('sec'); return null; },
      setItem: () => { armed = true; },
    });
    rs.setRound(3);
    expect(rs.round()).toBe(3);
  });
  it('works without storage', () => {
    const rs = createRunState();
    rs.addWin();
    expect(rs.wins()).toBe(1);
  });
});
