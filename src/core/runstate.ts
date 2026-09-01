export interface RunState {
  round(): number;
  setRound(n: number): void;
  wins(): number;
  addWin(): void;
}

const KEY = 'rht.run.v1';
interface Data { round: number; wins: number }
const DEFAULTS: Data = { round: 1, wins: 0 };

export function createRunState(storage?: Pick<Storage, 'getItem' | 'setItem'>): RunState {
  let mem: Data = { ...DEFAULTS };

  const load = (): Data => {
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
      return p && typeof p.round === 'number' && typeof p.wins === 'number' ? p : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
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

  return {
    round: () => load().round,
    setRound: (n) => save({ ...load(), round: n }),
    wins: () => load().wins,
    addWin: () => { const d = load(); save({ ...d, wins: d.wins + 1 }); },
  };
}
