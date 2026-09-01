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
    a.unlock();
    expect(() => { a.play('hit'); a.ambient(true); a.ambient(false); }).not.toThrow();
  });
  it('does not create context before unlock(), even when enabled', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    a.play('click');
    expect(created).toBe(0); // 手勢前一律不建立 context
  });
  it('does not create context until first play (post-unlock), and not when disabled', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    a.unlock();
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
  it('ambient(true) before a gesture defers and does not create a context', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    a.ambient(true);
    expect(created).toBe(0); // 暫存請求，未建立 context
    a.unlock();
    expect(created).toBe(1); // 解鎖後補放一次（factory throw 仍被吞掉）
    a.unlock(); // 冪等：不重複觸發
    expect(created).toBe(1);
  });

  // Task 11：新增音色（iris/bank/push）與環境音變體（wind/drizzle）
  it('plays the new iris/bank/push sfx without throwing (no ctx)', () => {
    const a = createAudio(fakeStorage());
    a.unlock();
    expect(() => {
      a.play('iris');
      a.play('bank');
      a.play('push');
    }).not.toThrow();
  });

  it('ambient(true, "wind") before a gesture defers with variant; unlock() creates context exactly once', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    a.ambient(true, 'wind');
    expect(created).toBe(0); // 暫存請求（含 variant），未建立 context
    a.unlock();
    expect(created).toBe(1); // 解鎖後補放一次
    a.unlock(); // 冪等
    expect(created).toBe(1);
  });

  it('repeating ambient(true, "wind") does not rebuild the context', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    a.unlock();
    expect(() => {
      a.ambient(true, 'wind');
      a.ambient(true, 'wind'); // 同變體重複呼叫：no-op，不重建
    }).not.toThrow();
    expect(created).toBe(1); // 兩次呼叫共用同一次 getCtx() 嘗試（factory 失敗記憶，不重試轟炸）
  });

  it('switching ambient variant (wind -> drizzle) while running is safe and reuses the context', () => {
    let created = 0;
    const factory = () => { created++; throw new Error('no real ctx in node'); };
    const a = createAudio(fakeStorage(), factory as unknown as () => AudioContext);
    a.unlock();
    expect(() => {
      a.ambient(true, 'wind');
      a.ambient(true, 'drizzle'); // 變體切換：先 stopAmbient 再啟新變體
    }).not.toThrow();
    expect(created).toBe(1); // 仍只嘗試建立一次 context
  });
});
