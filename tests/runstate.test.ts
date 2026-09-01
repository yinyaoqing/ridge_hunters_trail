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
  it('recovers from a non-finite round (typeof "number" but not finite, e.g. Infinity)', () => {
    // JSON has no NaN/Infinity literal, but `1e999` is valid JSON syntax that parses to
    // Infinity — same bug class as a stored NaN: typeof === 'number' yet unusable as a round.
    const rs = createRunState(fakeStorage({ 'rht.run.v1': '{"round":1e999,"wins":0}' }));
    expect(rs.round()).toBe(1);
    expect(rs.wins()).toBe(0);
  });
  it('recovers from an out-of-range round/wins', () => {
    const negRound = createRunState(fakeStorage({ 'rht.run.v1': '{"round":0,"wins":2}' }));
    expect(negRound.round()).toBe(1);
    const negWins = createRunState(fakeStorage({ 'rht.run.v1': '{"round":3,"wins":-1}' }));
    expect(negWins.round()).toBe(1);
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
