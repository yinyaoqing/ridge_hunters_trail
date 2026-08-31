import { describe, it, expect } from 'vitest';
import { createCodex } from '../src/core/codex';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createCodex', () => {
  it('counts recorded creatures', () => {
    const codex = createCodex(fakeStorage());
    codex.add('mistfawn');
    codex.add('mistfawn');
    codex.add('veilmoth');
    expect(codex.counts()).toEqual({ mistfawn: 2, veilmoth: 1 });
  });

  it('persists through the provided storage', () => {
    const storage = fakeStorage();
    createCodex(storage).add('emberquill');
    expect(createCodex(storage).counts()).toEqual({ emberquill: 1 });
  });

  it('works without storage (in-memory fallback)', () => {
    const codex = createCodex();
    codex.add('dewhopper');
    expect(codex.counts()).toEqual({ dewhopper: 1 });
  });

  it('recovers from corrupted stored data', () => {
    const codex = createCodex(fakeStorage({ 'rht.codex.v1': 'not-json{{{' }));
    expect(codex.counts()).toEqual({});
  });
});
