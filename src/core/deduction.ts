import { candidates, intersect, key } from './clues';
import type { Vec2 } from './geometry';
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

// 資訊完備步數：依判讀順序重播真線索，交集大小第一次達到「最終交集大小」的那一步。
// 從這一步之後，玩家再走的路都沒有帶來更精確的資訊——揭曉畫面用它指出過度行走。
// 幌子不計入：它們不是關於目標的資訊。玩家未讀到任何真線索時回傳 null。
export function infoCompleteStep(level: Level, readLog: ClueRead[]): number | null {
  const real: { clue: Clue; step: number }[] = [];
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue && !clue.isDecoy) real.push({ clue, step: entry.step });
  }
  if (real.length === 0) return null;

  const finalSize = intersect(real.map((r) => r.clue), level.mapSize).size;
  const acc: Clue[] = [];
  for (const r of real) {
    acc.push(r.clue);
    if (intersect(acc, level.mapSize).size === finalSize) return r.step;
  }
  // 理論上不可達（最後一輪必定等於 finalSize），保底回傳最後一次判讀的步數
  return real[real.length - 1].step;
}

// 誤導你的那條假蹤跡：玩家已判讀的幌子中，候選集合涵蓋押注格的第一條。
// 沒有押注、或押注不落在任何已讀幌子的範圍內時回傳 null（揭曉畫面就不顯示這一行）。
export function misleadingDecoy(
  level: Level, readLog: ClueRead[], wager: Vec2 | null,
): Clue | null {
  if (!wager) return null;
  const wk = key(wager);
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue && clue.isDecoy && candidates(clue, level.mapSize).has(wk)) return clue;
  }
  return null;
}
