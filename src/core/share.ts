import type { I18n } from './i18n';
import type { Quality } from './quality';

const MEDAL: Record<Quality, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' };

export interface ShareInput {
  dateKey: string;
  caught: boolean;
  quality: Quality | null;
  steps: number;
  staminaLeft: number;
  streak: number;
  iris: boolean;
}

// 每日挑戰分享卡：三行純文字，仿 Wordle 可貼進任何聊天室
export function shareText(i18n: I18n, s: ShareInput): string {
  const line1 = `Ridge Hunter's Trail · ${s.dateKey}`;
  const line2 = s.caught
    ? `🐾🐾🐾✨${s.quality ? MEDAL[s.quality] : ''}${s.iris ? '🌈' : ''}`
    : '🐾🐾🌫️';
  const line3 = i18n.t('share.stats', {
    steps: s.steps, stam: s.staminaLeft, streak: s.streak,
  });
  return `${line1}\n${line2}\n${line3}`;
}
