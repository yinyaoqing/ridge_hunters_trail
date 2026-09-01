import { describe, it, expect } from 'vitest';
import { createAudio } from '../src/core/audio';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('createAudio', () => {
  it('defaults enabled; toggle flips and persists', () => {
    const storage = fakeStorage();
    const a = createAudio(storage);
    expect(a.enabled()).toBe(true);
    expect(a.toggle()).toBe(false);
    expect(createAudio(storage).enabled()).toBe(false);
  });
  it('play/ambient are silent no-ops without a context factory', () => {
    const a = createAudio(fakeStorage());
    expect(() => { a.play('hit'); a.ambient(true); a.ambient(false); }).not.toThrow();
  });
  it('does not create context until first play, and not when disabled', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    expect(created).toBe(0);
    a.toggle(); // off
    a.play('click');
    expect(created).toBe(0); // disabled 不建立
    a.toggle(); // on
    a.play('click'); // factory throw 也要被吞掉
    expect(created).toBe(1);
    a.play('click');
    expect(created).toBe(1); // 失敗後不重試轟炸（記憶失敗）
  });
  it('ignores corrupted stored flag', () => {
    expect(createAudio(fakeStorage({ 'rht.audio.v1': 'xx' })).enabled()).toBe(true);
  });
});
