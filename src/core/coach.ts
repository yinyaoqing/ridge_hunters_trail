// 首見旗標：每一則教學提示只在玩家第一次遇到該機制時出現一次。
// 刻意不與 rht.tut.v1／rht.help.v1 共用旗標——那兩把是「第 1 局引導」與
// 「說明頁彈過了」，語意是進度；這裡的每一把都對應一個具體機制，語意是「教過了」。
// 舊存檔玩家因此會照常看到新提示，而不會被拉回重跑第 1 局引導。
export type CoachId =
  | 'event.startle' | 'event.supply' | 'event.oldtrail'
  | 'supply' | 'bankpush' | 'iris'
  | 'tool.windstone' | 'tool.glowbell'
  | 'age.second' | 'reveal.route' | 'reveal.infoAt' | 'quality'
  | 'codex' | 'commission' | 'daily';

export interface CoachStore {
  seen(id: CoachId): boolean;
  markSeen(id: CoachId): void;
  reset(): void;
}

const KEY = 'rht.seen.v1';
type Data = Partial<Record<CoachId, true>>;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function createCoach(storage?: Store): CoachStore {
  // 記憶體備援：storage 缺席或讀寫拋例外時，本局仍然只教一次（重新載入才會再教）。
  // 比照 tools.ts 的慣例——寧可少記一次，也不讓 storage 例外冒到場景層。
  let mem: Data = {};

  const load = (): Data => {
    if (!storage) return mem;
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return mem;
    }
    if (raw === null) return {};
    try {
      const p: unknown = JSON.parse(raw);
      // typeof null === 'object'，且陣列也是 object——兩者都不是我們寫出去的形狀
      return p !== null && typeof p === 'object' && !Array.isArray(p) ? (p as Data) : {};
    } catch {
      return {};
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
    seen: (id) => load()[id] === true,
    markSeen(id) {
      const data = load();
      if (data[id] === true) return; // 冪等：已見過就不重寫，storage 不必要地被動到
      data[id] = true;
      save(data);
    },
    reset() {
      save({});
    },
  };
}

// 首見提示的唯一呼叫形狀。各場景的掛點一律是一行，不各自寫 if (!coach.seen(...))。
// 回傳是否真的顯示了——呼叫端若要在同一幀決定「還要不要顯示第二則」會用到。
export function coachOnce(coach: CoachStore, id: CoachId, show: () => void): boolean {
  if (coach.seen(id)) return false;
  coach.markSeen(id);
  show();
  return true;
}
