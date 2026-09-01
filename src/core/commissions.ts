import { mulberry32, randInt } from './rng';
import { CREATURES } from '../data/creatures';
import { QUALITY_RANK, type Quality } from './quality';

export type Commission =
  | { kind: 'record-creature'; creatureId: string }
  | { kind: 'stamina-finish'; min: number }
  | { kind: 'quality-any'; quality: 'silver' | 'gold' };

export function seedFromKey(dateKey: string): number {
  return Number(dateKey.replaceAll('-', ''));
}

const STAMINA_MINS = [15, 20, 25] as const;
const QUALITIES = ['silver', 'gold'] as const;

export function dailyCommissions(dateKey: string): Commission[] {
  const seed = seedFromKey(dateKey);

  const rng0 = mulberry32(seed * 31 + 1);
  const creatureId = CREATURES[randInt(rng0, 0, CREATURES.length - 1)].id;

  const rng1 = mulberry32(seed * 31 + 2);
  const min = STAMINA_MINS[randInt(rng1, 0, STAMINA_MINS.length - 1)];

  const rng2 = mulberry32(seed * 31 + 3);
  const quality = QUALITIES[randInt(rng2, 0, QUALITIES.length - 1)];

  return [
    { kind: 'record-creature', creatureId },
    { kind: 'stamina-finish', min },
    { kind: 'quality-any', quality },
  ];
}

export interface ResultCtx {
  caught: boolean;
  creatureId: string;
  staminaLeft: number;
  quality: Quality | null;
  // mode 目前不參與判定——委託在 run/daily 皆可完成（保留欄位供未來模式限定委託）
  mode: 'run' | 'daily';
}

export function evaluate(c: Commission, ctx: ResultCtx): boolean {
  if (!ctx.caught) return false;
  switch (c.kind) {
    case 'record-creature':
      return ctx.creatureId === c.creatureId;
    case 'stamina-finish':
      return ctx.staminaLeft >= c.min;
    case 'quality-any':
      return ctx.quality !== null && QUALITY_RANK[ctx.quality] >= QUALITY_RANK[c.quality];
  }
}

export const COMMISSION_REWARD_NOTES = 2;

export interface CommissionStore {
  statusFor(dateKey: string): boolean[];
  markDone(dateKey: string, idx: number): void;
}

const KEY = 'rht.commissions.v1';
interface Data { date: string; done: [boolean, boolean, boolean] }

export function createCommissionStore(storage?: Pick<Storage, 'getItem' | 'setItem'>): CommissionStore {
  let mem: Data | null = null;

  const load = (): Data | null => {
    if (!storage) return mem;
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return mem; // 讀取失敗：退回記憶體備援
    }
    if (raw === null) return null;
    try {
      const p = JSON.parse(raw);
      if (!p || typeof p.date !== 'string' || !Array.isArray(p.done) || p.done.length !== 3) return null;
      // 形狀通過後仍逐格 Boolean() 轉型：防禦 storage 被外部工具/舊版本寫入非布林值
      // （如序列化過程中混入的 1/0/'x'），避免 statusFor 回傳非布林導致下游判斷出錯
      return { date: p.date, done: p.done.map(Boolean) as [boolean, boolean, boolean] };
    } catch {
      return null;
    }
  };

  const save = (d: Data): void => {
    mem = d;
    if (!storage) return;
    try {
      storage.setItem(KEY, JSON.stringify(d));
    } catch {
      // 靜默退回記憶體
    }
  };

  const forDate = (dateKey: string): [boolean, boolean, boolean] => {
    const d = load();
    return d && d.date === dateKey ? d.done : [false, false, false];
  };

  return {
    statusFor: (dateKey) => forDate(dateKey),
    markDone(dateKey, idx) {
      const done = forDate(dateKey).slice() as [boolean, boolean, boolean];
      done[idx] = true;
      save({ date: dateKey, done });
    },
  };
}
