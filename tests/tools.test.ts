import { describe, it, expect } from 'vitest';
import { createTools } from '../src/core/tools';
import { createCodex } from '../src/core/codex';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createTools', () => {
  it('starts with nothing; unlocks windstone at 5 total records', () => {
    const tools = createTools(fakeStorage());
    const codex = createCodex(fakeStorage());
    for (let i = 0; i < 5; i++) codex.addRecord('mistfawn', 'bronze');
    expect(tools.has('windstone')).toBe(false);
    expect(tools.syncUnlocks(codex)).toEqual(['windstone']);
    expect(tools.has('windstone')).toBe(true);
    expect(tools.syncUnlocks(codex)).toEqual([]); // 已解鎖不重報
  });
  it('unlocks glowbell on any gold record', () => {
    const tools = createTools(fakeStorage());
    const codex = createCodex(fakeStorage());
    codex.addRecord('veilmoth', 'gold');
    expect(tools.syncUnlocks(codex)).toEqual(['glowbell']);
  });
  it('persists and survives corruption', () => {
    const storage = fakeStorage();
    const codex = createCodex(fakeStorage());
    codex.addRecord('veilmoth', 'gold');
    createTools(storage).syncUnlocks(codex);
    expect(createTools(storage).has('glowbell')).toBe(true);
    expect(createTools(fakeStorage({ 'rht.tools.v1': '{{{' })).has('windstone')).toBe(false);
  });
});
