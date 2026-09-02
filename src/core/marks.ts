import type { Vec2 } from './geometry';

// 玩家標記三態（設計提案 R3）：排除＝這格不可能、存疑＝待驗證、押注＝我認為牠在這。
// 押注是 Task 6 判讀精準度評分的唯一輸入，因此全域唯一。
export type MarkKind = 'exclude' | 'suspect' | 'wager';
export type MarkMap = Map<string, MarkKind>;

// 循環序：末項 null 代表「清除標記」，讓同一格反覆點擊可以繞回未標記狀態
const CYCLE: readonly (MarkKind | null)[] = ['exclude', 'suspect', 'wager', null];

export function nextMark(current: MarkKind | undefined): MarkKind | null {
  const idx = current === undefined ? -1 : CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

// 就地推進一格的標記狀態（沿用 session.toggleMark 的 mutate 慣例，不回傳新 Map）
export function cycleMark(marks: MarkMap, k: string): void {
  const next = nextMark(marks.get(k));
  if (next === null) {
    marks.delete(k);
    return;
  }
  if (next === 'wager') {
    // 押注唯一：先清掉舊押注，避免評分時出現兩個候選
    for (const [ck, kind] of marks) {
      if (kind === 'wager') marks.delete(ck);
    }
  }
  marks.set(k, next);
}

export function wagerKey(marks: MarkMap): string | null {
  for (const [k, kind] of marks) {
    if (kind === 'wager') return k;
  }
  return null;
}

// clues.key() 的反向操作："x,y" → Vec2
export function parseKey(k: string): Vec2 {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}
