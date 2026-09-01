import type { CodexStore } from './codex';

export type ToolId = 'windstone' | 'glowbell';

export interface ToolStore {
  has(id: ToolId): boolean;
  syncUnlocks(codex: CodexStore): ToolId[];
}

const KEY = 'rht.tools.v1';
type Data = Record<ToolId, boolean>;
const DEFAULTS: Data = { windstone: false, glowbell: false };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function unlockedNow(codex: CodexStore): ToolId[] {
  const entries = Object.values(codex.entries());
  const totalRecords = entries.reduce((sum, e) => sum + e.count, 0);
  const anyGold = entries.some((e) => e.bestQuality === 'gold');
  const unlocked: ToolId[] = [];
  if (totalRecords >= 5) unlocked.push('windstone');
  if (anyGold) unlocked.push('glowbell');
  return unlocked;
}

export function createTools(storage?: Store): ToolStore {
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
      return p && typeof p === 'object' ? { ...DEFAULTS, ...p } : { ...DEFAULTS };
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
    has: (id) => load()[id],
    syncUnlocks(codex) {
      const data = load();
      const newly: ToolId[] = [];
      for (const id of unlockedNow(codex)) {
        if (!data[id]) {
          data[id] = true;
          newly.push(id);
        }
      }
      if (newly.length > 0) save(data);
      return newly;
    },
  };
}
