import { maxQuality, type Quality } from './quality';

export interface CodexEntry {
  count: number;               // 成功記錄次數
  research: number;            // 研究度（筆記＋記錄累積）
  bestQuality: Quality | null; // 歷史最佳記錄品質
}

export const RESEARCH_NOTE = 1;   // 一枚觀察筆記的研究度
export const RESEARCH_RECORD = 3; // 一次成功記錄的研究度
export const MILESTONE_NAME = 3;  // 達標揭示：名稱
export const MILESTONE_DETAIL = 8; // 達標揭示：描述＋地形偏好

// 失敗軟著陸：依已判讀線索數掉落筆記（至少 1、至多 3）
export function notesForRun(readClueCount: number): number {
  if (readClueCount <= 0) return 1;
  return readClueCount <= 2 ? 2 : 3;
}

export interface CodexStore {
  entries(): Record<string, CodexEntry>;
  entry(id: string): CodexEntry;
  counts(): Record<string, number>;
  addRecord(id: string, quality: Quality): void;
  addNotes(id: string, notes: number): void;
}

const V1_KEY = 'rht.codex.v1';
const V2_KEY = 'rht.codex.v2';
const EMPTY: CodexEntry = { count: 0, research: 0, bestQuality: null };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function migrateV1(storage: Store): Record<string, CodexEntry> {
  try {
    const v1 = JSON.parse(storage.getItem(V1_KEY) ?? 'null');
    if (!v1 || typeof v1 !== 'object') return {};
    const out: Record<string, CodexEntry> = {};
    for (const [id, n] of Object.entries(v1)) {
      const count = typeof n === 'number' && n > 0 ? n : 0;
      if (count > 0) out[id] = { count, research: count * RESEARCH_RECORD, bestQuality: 'bronze' };
    }
    return out;
  } catch {
    return {};
  }
}

export function createCodex(storage?: Store): CodexStore {
  let mem: Record<string, CodexEntry> = {};

  const load = (): Record<string, CodexEntry> => {
    if (!storage) return mem;
    try {
      const raw = storage.getItem(V2_KEY);
      if (raw === null) return migrateV1(storage);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const save = (data: Record<string, CodexEntry>): void => {
    mem = data;
    if (!storage) return;
    try {
      storage.setItem(V2_KEY, JSON.stringify(data));
    } catch {
      // storage 不可用（隱私模式等）時退回記憶體
    }
  };

  return {
    entries: load,
    entry: (id) => load()[id] ?? { ...EMPTY },
    counts() {
      const out: Record<string, number> = {};
      for (const [id, e] of Object.entries(load())) if (e.count > 0) out[id] = e.count;
      return out;
    },
    addRecord(id, quality) {
      const data = load();
      const e = data[id] ?? { ...EMPTY };
      data[id] = {
        count: e.count + 1,
        research: e.research + RESEARCH_RECORD,
        bestQuality: maxQuality(e.bestQuality, quality),
      };
      save(data);
    },
    addNotes(id, notes) {
      const data = load();
      const e = data[id] ?? { ...EMPTY };
      data[id] = { ...e, research: e.research + notes * RESEARCH_NOTE };
      save(data);
    },
  };
}
