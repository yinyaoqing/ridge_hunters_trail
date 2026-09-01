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
      // 型別檢查僅擋 typeof !== 'number' 會漏放 NaN/負值（typeof NaN === 'number'）；
      // 額外要求有限數且落在合理範圍（round>=1, wins>=0），避免損毀資料讓後續算式產生 NaN 擴散
      const valid = p
        && Number.isFinite(p.round) && p.round >= 1
        && Number.isFinite(p.wins) && p.wins >= 0;
      return valid ? p : { ...DEFAULTS };
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
