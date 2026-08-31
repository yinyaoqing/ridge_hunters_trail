export interface CodexStore {
  counts(): Record<string, number>;
  add(id: string): void;
}

const STORAGE_KEY = 'rht.codex.v1';

export function createCodex(storage?: Pick<Storage, 'getItem' | 'setItem'>): CodexStore {
  let mem: Record<string, number> = {};

  const load = (): Record<string, number> => {
    if (!storage) return mem;
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
      if (parsed && typeof parsed === 'object') {
        mem = parsed;
        return parsed;
      }
      return {};
    } catch {
      return mem;
    }
  };

  const save = (data: Record<string, number>): void => {
    mem = data;
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage 不可用（隱私模式等）時退回記憶體
    }
  };

  return {
    counts: load,
    add(id: string) {
      const data = load();
      data[id] = (data[id] ?? 0) + 1;
      save(data);
    },
  };
}
