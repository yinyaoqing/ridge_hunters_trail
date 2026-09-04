import { candidates, intersect, key } from './clues';
import { cheb, type Vec2 } from './geometry';
import type { Clue, ClueAge, Level } from './types';
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

// 資訊完備步數：分齡之後不能再把所有真線索交在一起——不同齡錨定在不同節點，
// 全部交集在九成以上的關卡本來就是空的，finalSize 因此恆為 0，函式會在玩家
// 讀到第二條不同齡的線索時就回報「資訊已完備」，揭曉畫面於是幾乎每一局
// 都在指責玩家多走了路。改為逐齡各自計算，回傳「最後一個齡完備的那一步」——
// 在那之後再走，每一齡的資訊都不會再更精確。
export function infoCompleteStep(level: Level, readLog: ClueRead[]): number | null {
  const real: { clue: Clue; step: number }[] = [];
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue && !clue.isDecoy) real.push({ clue, step: entry.step });
  }
  if (real.length === 0) return null;

  let last: number | null = null;
  for (const age of [0, 1, 2] as ClueAge[]) {
    const group = real.filter((r) => r.clue.age === age);
    if (group.length === 0) continue;
    const finalSize = intersect(group.map((r) => r.clue), level.mapSize).size;
    // 理論上最後一輪必定等於 finalSize；保底取該齡最後一次判讀的步數
    let stepForAge = group[group.length - 1].step;
    const acc: Clue[] = [];
    for (const r of group) {
      acc.push(r.clue);
      if (intersect(acc, level.mapSize).size === finalSize) { stepForAge = r.step; break; }
    }
    last = last === null ? stepForAge : Math.max(last, stepForAge);
  }
  return last;
}

// 誤導你的那條假蹤跡：玩家已判讀的幌子中，「真的把你帶偏」的第一條（判讀順序）。
// 兩個條件缺一不可（F2）：①押注確實錯了——押中時就算幌子涵蓋該格，也不是它害的；
// ②該幌子的候選集合不涵蓋真實目標格——涵蓋真相的幌子並沒有把你指往錯的地方，
// 只是剛好也涵蓋了你押的格子，冤枉它沒有意義。
// 沒有押注、或沒有任何已讀幌子同時滿足這兩個條件時回傳 null（揭曉畫面就不顯示這一行）。
// target 由呼叫端傳入而非從 level 取：Phase 6a 之後獵物會移動，
// 「真實位置」只有在結算那一刻才確定，deduction 不該自己猜是哪一刻。
export function misleadingDecoy(
  level: Level, readLog: ClueRead[], wager: Vec2 | null, target: Vec2,
): Clue | null {
  if (!wager) return null;
  if (cheb(wager, target) === 0) return null; // 押中了，沒有東西騙到你
  const wk = key(wager);
  const tk = key(target);
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (!clue || !clue.isDecoy) continue;
    const cand = candidates(clue, level.mapSize);
    if (cand.has(wk) && !cand.has(tk)) return clue;
  }
  return null;
}

// 玩家讀到的線索橫跨幾種齡別。齡別教學的觸發條件是「讀到第二種齡」——
// 在那之前玩家看到的線索全部同齡，新鮮度 chip 切了也沒差別，講了等於沒講。
// 幌子照樣計入：玩家在揭曉之前無從分辨，牠對玩家而言就是一條有齡別的線索。
export function distinctReadAges(level: Level, readLog: ClueRead[]): number {
  const ages = new Set<ClueAge>();
  for (const entry of readLog) {
    const clue = level.clues[entry.clueIndex];
    if (clue) ages.add(clue.age);
  }
  return ages.size;
}
