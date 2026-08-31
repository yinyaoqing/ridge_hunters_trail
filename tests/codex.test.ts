import { describe, it, expect } from 'vitest';
import {
  createCodex, notesForRun, RESEARCH_NOTE, RESEARCH_RECORD,
  MILESTONE_NAME, MILESTONE_DETAIL,
} from '../src/core/codex';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

describe('createCodex v2', () => {
  it('addRecord tracks count, research and best quality', () => {
    const codex = createCodex(fakeStorage());
    codex.addRecord('mistfawn', 'silver');
    codex.addRecord('mistfawn', 'bronze'); // 較差品質不覆蓋
    expect(codex.entry('mistfawn')).toEqual({
      count: 2, research: 2 * RESEARCH_RECORD, bestQuality: 'silver',
    });
  });

  it('addNotes accumulates research without count', () => {
    const codex = createCodex(fakeStorage());
    codex.addNotes('veilmoth', 2);
    expect(codex.entry('veilmoth')).toEqual({
      count: 0, research: 2 * RESEARCH_NOTE, bestQuality: null,
    });
  });

  it('entry of unknown id is the empty entry', () => {
    expect(createCodex().entry('nobody')).toEqual({ count: 0, research: 0, bestQuality: null });
  });

  it('counts() derives id -> count for discovered creatures only', () => {
    const codex = createCodex(fakeStorage());
    codex.addRecord('emberquill', 'gold');
    codex.addNotes('veilmoth', 1);
    expect(codex.counts()).toEqual({ emberquill: 1 });
  });

  it('persists via storage under v2 key', () => {
    const storage = fakeStorage();
    createCodex(storage).addRecord('dewhopper', 'gold');
    expect(createCodex(storage).entry('dewhopper').bestQuality).toBe('gold');
    expect(storage.dump()['rht.codex.v2']).toBeDefined();
  });

  it('migrates v1 counts (research = count*RECORD, bronze quality)', () => {
    const storage = fakeStorage({ 'rht.codex.v1': JSON.stringify({ mistfawn: 2 }) });
    const codex = createCodex(storage);
    expect(codex.entry('mistfawn')).toEqual({
      count: 2, research: 2 * RESEARCH_RECORD, bestQuality: 'bronze',
    });
  });

  it('recovers from corrupted stored data', () => {
    const codex = createCodex(fakeStorage({ 'rht.codex.v2': 'not-json{{{' }));
    expect(codex.entries()).toEqual({});
  });

  it('works without storage (in-memory fallback)', () => {
    const codex = createCodex();
    codex.addRecord('plumetail', 'bronze');
    expect(codex.counts()).toEqual({ plumetail: 1 });
  });
});

describe('notesForRun', () => {
  it('always drops at least one note, capped at three', () => {
    expect(notesForRun(0)).toBe(1);
    expect(notesForRun(1)).toBe(2);
    expect(notesForRun(2)).toBe(2);
    expect(notesForRun(3)).toBe(3);
    expect(notesForRun(9)).toBe(3);
  });
});

describe('milestones', () => {
  it('name unlocks before detail', () => {
    expect(MILESTONE_NAME).toBeLessThan(MILESTONE_DETAIL);
  });
});
