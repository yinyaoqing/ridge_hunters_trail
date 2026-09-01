import type { Quality } from './quality';

export const QUALITY_MULT: Record<Quality, number> = { bronze: 1, silver: 1.2, gold: 1.5 };
export const MULTIPLIERS = [1, 1.5, 2, 2.5] as const;

export function catchScore(round: number, quality: Quality, iris: boolean): number {
  return Math.round(round * 100 * QUALITY_MULT[quality] * (iris ? 2 : 1));
}

export interface ScoreState {
  banked: number;
  pot: number;
  multiplier: number;
  bestRun: number;
}

export interface ScoreStore {
  state(): ScoreState;
  addCatch(points: number): number; // pot += round(points * multiplier)；回傳實得
  bank(): ScoreState; // banked+=pot; pot=0; multiplier=1; bestRun=max(bestRun, banked)
  push(): ScoreState; // multiplier 升至 MULTIPLIERS 下一檔（封頂 2.5）
  loseRun(): ScoreState; // pot=0; multiplier=1（banked/bestRun 不動）
}

const KEY = 'rht.score.v1';
const DEFAULTS: ScoreState = { banked: 0, pot: 0, multiplier: MULTIPLIERS[0], bestRun: 0 };

export function createScoreStore(storage?: Pick<Storage, 'getItem' | 'setItem'>): ScoreStore {
  let mem: ScoreState = { ...DEFAULTS };

  const load = (): ScoreState => {
    if (!storage) return mem;
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return mem; // 讀取失敗：退回記憶體備援
    }
    if (raw === null) return { ...DEFAULTS };
    try {
      const p = JSON.parse(raw);
      // 型別檢查僅擋 typeof !== 'number' 會漏放 NaN/負值/非法倍率，額外要求有限數且
      // 落在合理範圍（各欄位 >=0），multiplier 必須落在 MULTIPLIERS 階梯上，否則整筆重置
      const valid = p
        && Number.isFinite(p.banked) && p.banked >= 0
        && Number.isFinite(p.pot) && p.pot >= 0
        && Number.isFinite(p.multiplier) && p.multiplier >= 0
        && Number.isFinite(p.bestRun) && p.bestRun >= 0
        && (MULTIPLIERS as readonly number[]).includes(p.multiplier);
      return valid ? p : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  };

  const save = (d: ScoreState): ScoreState => {
    mem = d;
    if (storage) {
      try {
        storage.setItem(KEY, JSON.stringify(d));
      } catch {
        // 靜默退回記憶體
      }
    }
    return d;
  };

  return {
    state: () => load(),

    addCatch: (points: number): number => {
      const d = load();
      const gain = Math.round(points * d.multiplier);
      save({ ...d, pot: d.pot + gain });
      return gain;
    },

    bank: (): ScoreState => {
      const d = load();
      const banked = d.banked + d.pot;
      const bestRun = Math.max(d.bestRun, banked);
      return save({ banked, pot: 0, multiplier: MULTIPLIERS[0], bestRun });
    },

    push: (): ScoreState => {
      const d = load();
      const idx = (MULTIPLIERS as readonly number[]).indexOf(d.multiplier);
      const nextIdx = Math.min(idx + 1, MULTIPLIERS.length - 1);
      return save({ ...d, multiplier: MULTIPLIERS[nextIdx] });
    },

    loseRun: (): ScoreState => {
      const d = load();
      return save({ ...d, pot: 0, multiplier: MULTIPLIERS[0] });
    },
  };
}
