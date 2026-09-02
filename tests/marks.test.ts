import { describe, it, expect } from 'vitest';
import { nextMark, cycleMark, wagerKey, parseKey, toggleWager, type MarkMap } from '../src/core/marks';

describe('nextMark', () => {
  it('cycles none -> exclude -> suspect -> wager -> none', () => {
    expect(nextMark(undefined)).toBe('exclude');
    expect(nextMark('exclude')).toBe('suspect');
    expect(nextMark('suspect')).toBe('wager');
    expect(nextMark('wager')).toBe(null);
  });
});

describe('cycleMark', () => {
  it('adds then advances then removes a mark in place', () => {
    const m: MarkMap = new Map();
    cycleMark(m, '3,4');
    expect(m.get('3,4')).toBe('exclude');
    cycleMark(m, '3,4');
    expect(m.get('3,4')).toBe('suspect');
    cycleMark(m, '3,4');
    expect(m.get('3,4')).toBe('wager');
    cycleMark(m, '3,4');
    expect(m.has('3,4')).toBe(false);
  });

  it('keeps the wager unique by clearing any previous wager', () => {
    const m: MarkMap = new Map([['1,1', 'wager']]);
    cycleMark(m, '2,2'); // exclude
    cycleMark(m, '2,2'); // suspect
    cycleMark(m, '2,2'); // wager -> 舊押注須被清掉
    expect(m.has('1,1')).toBe(false);
    expect(m.get('2,2')).toBe('wager');
  });

  it('leaves other marks untouched when a new wager is set', () => {
    const m: MarkMap = new Map([['0,0', 'exclude'], ['1,1', 'wager']]);
    cycleMark(m, '5,5');
    cycleMark(m, '5,5');
    cycleMark(m, '5,5');
    expect(m.get('0,0')).toBe('exclude');
    expect(m.get('5,5')).toBe('wager');
    expect(m.size).toBe(2);
  });
});

describe('wagerKey', () => {
  it('returns the single wager key', () => {
    expect(wagerKey(new Map([['0,0', 'exclude'], ['7,2', 'wager']]))).toBe('7,2');
  });
  it('returns null when no wager is placed', () => {
    expect(wagerKey(new Map([['0,0', 'suspect']]))).toBe(null);
    expect(wagerKey(new Map())).toBe(null);
  });
});

describe('toggleWager', () => {
  // F3（設計裁定）：押注不受迷霧限制，因此需要一個不經過三態循環、只切換押注的入口。
  it('sets a wager on a cell that has none', () => {
    const m: MarkMap = new Map();
    toggleWager(m, '3,4');
    expect(m.get('3,4')).toBe('wager');
  });

  it('clears the wager when toggling the same cell again', () => {
    const m: MarkMap = new Map();
    toggleWager(m, '3,4');
    toggleWager(m, '3,4');
    expect(m.has('3,4')).toBe(false);
  });

  it('keeps the wager unique: placing on a new cell clears the previous one', () => {
    const m: MarkMap = new Map([['1,1', 'wager']]);
    toggleWager(m, '2,2');
    expect(m.has('1,1')).toBe(false);
    expect(m.get('2,2')).toBe('wager');
  });

  it('replaces any existing exclude/suspect mark on the target cell with a wager', () => {
    const m: MarkMap = new Map([['5,5', 'exclude']]);
    toggleWager(m, '5,5');
    expect(m.get('5,5')).toBe('wager');
  });

  it('leaves unrelated marks untouched', () => {
    const m: MarkMap = new Map([['0,0', 'exclude'], ['1,1', 'suspect']]);
    toggleWager(m, '9,9');
    expect(m.get('0,0')).toBe('exclude');
    expect(m.get('1,1')).toBe('suspect');
    expect(m.get('9,9')).toBe('wager');
  });
});

describe('parseKey', () => {
  it('round-trips the "x,y" format used by clues.key', () => {
    expect(parseKey('12,3')).toEqual({ x: 12, y: 3 });
  });
});
