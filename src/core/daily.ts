import { mulberry32 } from './rng';
import { newSession, type SessionState } from './session';

export const DAILY_ROUND = 5; // 固定 tier 2：20×20、含干擾線索，適合全球同題
export const FREEZE_EVERY = 7; // 每連續 7 天贈 1 枚歇腳符
export const FREEZE_CAP = 3;

export function dailyKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dailySeed(d: Date): number {
  return Number(dailyKey(d).replaceAll('-', ''));
}

export function createDailySession(d: Date): SessionState {
  return newSession(DAILY_ROUND, mulberry32(dailySeed(d)), 'daily');
}

export function createDailySessionFromKey(dateKey: string): SessionState {
  return newSession(DAILY_ROUND, mulberry32(Number(dateKey.replaceAll('-', ''))), 'daily');
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export interface StreakState {
  streak: number;
  freezes: number;
  lastPlayed: string | null;
}

export interface StreakStore {
  state(): StreakState;
  recordPlay(dateKey: string): StreakState;
}

const KEY = 'rht.daily.v1';
const EMPTY: StreakState = { streak: 0, freezes: 0, lastPlayed: null };

export function createStreak(storage?: Pick<Storage, 'getItem' | 'setItem'>): StreakStore {
  let mem: StreakState = { ...EMPTY };

  const load = (): StreakState => {
    if (!storage) return mem;
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
      return parsed && typeof parsed.streak === 'number' ? parsed : { ...EMPTY };
    } catch {
      return { ...EMPTY };
    }
  };

  const save = (s: StreakState): StreakState => {
    mem = s;
    if (storage) {
      try {
        storage.setItem(KEY, JSON.stringify(s));
      } catch {
        // 退回記憶體
      }
    }
    return s;
  };

  return {
    state: load,
    recordPlay(dateKey) {
      const prev = load();
      if (prev.lastPlayed === dateKey) return prev; // 同日重玩不重複計數

      let streak: number;
      let freezes = prev.freezes;
      if (prev.lastPlayed === null) {
        streak = 1;
      } else {
        const gap = daysBetween(prev.lastPlayed, dateKey) - 1;
        if (gap <= 0) streak = prev.streak + 1;
        else if (gap <= freezes) {
          freezes -= gap; // 歇腳符逐日抵扣
          streak = prev.streak + 1;
        } else {
          // 符不足：保留剩餘符，連勝減半+1（D1）
          streak = Math.floor(prev.streak / 2) + 1;
        }
      }
      if (streak % FREEZE_EVERY === 0) freezes = Math.min(FREEZE_CAP, freezes + 1);
      return save({ streak, freezes, lastPlayed: dateKey });
    },
  };
}
