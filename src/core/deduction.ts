import { candidates } from './clues';
import type { Clue, Level } from './types';
import type { ClueRead } from './session';

// 玩家目前可用來推理的線索：已判讀、且未被靜音者，維持判讀順序。
// 幌子線索照樣列入——玩家在揭曉之前無從分辨，這正是靜音功能存在的理由。
export function unmutedReadClues(
  level: Level, readLog: ClueRead[], muted: Set<number>,
): Clue[] {
  const out: Clue[] = [];
  for (const entry of readLog) {
    if (muted.has(entry.clueIndex)) continue;
    const clue = level.clues[entry.clueIndex];
    if (clue) out.push(clue);
  }
  return out;
}

// 候選熱度：每格符合幾條線索。不用二元交集，是因為有幌子時交集常常是空集合，
// 而「多數線索指向這一帶」才是玩家實際在做的判斷。零符合的格不寫進 Map，保持稀疏。
export function heatMap(clues: Clue[], mapSize: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const clue of clues) {
    for (const k of candidates(clue, mapSize)) {
      out.set(k, (out.get(k) ?? 0) + 1);
    }
  }
  return out;
}

// 熱區最高值：渲染層據此把熱度正規化為透明度
export function maxHeat(heat: Map<string, number>): number {
  let max = 0;
  for (const n of heat.values()) if (n > max) max = n;
  return max;
}
