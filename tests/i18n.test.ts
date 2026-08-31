import { describe, it, expect } from 'vitest';
import { detectLocale, createI18n, STRINGS } from '../src/core/i18n';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('detectLocale', () => {
  it('maps Chinese language tags to zh-TW', () => {
    expect(detectLocale('zh-TW')).toBe('zh-TW');
    expect(detectLocale('zh-Hant-TW')).toBe('zh-TW');
    expect(detectLocale('zh')).toBe('zh-TW');
  });
  it('defaults everything else to en', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('ja')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});

describe('string tables', () => {
  it('en and zh-TW cover exactly the same keys', () => {
    expect(Object.keys(STRINGS['zh-TW']).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('no string is empty', () => {
    for (const table of Object.values(STRINGS)) {
      for (const v of Object.values(table)) expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe('createI18n', () => {
  it('translates with variable interpolation', () => {
    const i18n = createI18n('en');
    expect(i18n.t('hud.round', { n: 3 })).toBe('Round 3');
    i18n.setLocale('zh-TW');
    expect(i18n.t('hud.round', { n: 3 })).toBe('第 3 局');
  });
  it('persists locale through storage', () => {
    const storage = fakeStorage();
    createI18n('en', storage).setLocale('zh-TW');
    expect(createI18n('en', storage).locale()).toBe('zh-TW');
  });
  it('ignores corrupted stored locale', () => {
    const i18n = createI18n('en', fakeStorage({ 'rht.locale.v1': 'xx' }));
    expect(i18n.locale()).toBe('en');
  });
});
