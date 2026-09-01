import { describe, it, expect } from 'vitest';
import { shareText } from '../src/core/share';
import { createI18n } from '../src/core/i18n';

describe('shareText', () => {
  it('renders a three-line card for a caught daily with medal and stats', () => {
    const text = shareText(createI18n('en'), {
      dateKey: '2026-08-31', caught: true, quality: 'gold',
      steps: 23, staminaLeft: 12, streak: 4,
    });
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Ridge Hunter's Trail");
    expect(lines[0]).toContain('2026-08-31');
    expect(lines[1]).toContain('🥇');
    expect(lines[2]).toContain('23');
    expect(lines[2]).toContain('12');
    expect(lines[2]).toContain('4');
  });
  it('renders an escape line without medal when not caught', () => {
    const text = shareText(createI18n('zh-TW'), {
      dateKey: '2026-08-31', caught: false, quality: null,
      steps: 9, staminaLeft: 0, streak: 1,
    });
    expect(text.split('\n')[1]).toContain('🌫️');
    expect(text).not.toContain('🥇');
  });
  it('renders the bronze medal for a bronze-quality catch', () => {
    const text = shareText(createI18n('en'), {
      dateKey: '2026-08-31', caught: true, quality: 'bronze',
      steps: 15, staminaLeft: 5, streak: 2,
    });
    expect(text.split('\n')[1]).toContain('🥉');
  });
  it('renders the silver medal for a silver-quality catch', () => {
    const text = shareText(createI18n('en'), {
      dateKey: '2026-08-31', caught: true, quality: 'silver',
      steps: 18, staminaLeft: 8, streak: 3,
    });
    expect(text.split('\n')[1]).toContain('🥈');
  });
});
