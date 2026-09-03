// 垂直版面流：把一疊區塊排進 [top, bottom] 這段高度。
//
// 為什麼要有這個模組：CampScene 與 ResultScene 原本混用固定座標、百分比與流式累加
// 三種定位方式，結果是高視窗留下大片死區、矮視窗直接重疊（研究度文字被主鈕蓋住、
// 委託列被工具列壓到）。把「哪個區塊排在哪裡」的算術抽成純函式，它就能被單元測試——
// 而場景層在本專案是測不到的（vite.config.ts 的 test.environment 為 node）。

export interface FlowBlock {
  h: number;        // 區塊高度
  gap?: number;     // 與前一個區塊之間的理想間距；第一個區塊的 gap 是與 top 的距離。預設 0
  minGap?: number;  // 空間不足時的壓縮下限。預設 4
  maxGap?: number;  // 空間有餘時的放大上限。預設 gap + 40
}

const DEFAULT_MIN_GAP = 4;
const DEFAULT_MAX_GAP_SLACK = 40;

// 回傳每個區塊的**中心 y**（多數 Phaser 文字與按鈕以 setOrigin(0.5) 定位，
// 中心比上緣好用；需要上緣的呼叫端自行減去 h/2）。
//
// 空間有餘：把寬裕平均分給每一道間距，各自不超過 maxGap。刻意不做「整疊置中」——
// 置中會讓標題浮到畫面中央；平均分配則讓內容自然撐開，剩下的留在最下方給背景美術。
// 空間不足：把每一道間距朝 minGap 等比壓縮。
// 連 minGap 都放不下時不再壓縮，讓結果誠實地超出 bottom——回傳一組看似正常、
// 實際互疊的座標會讓呼叫端以為沒事，那比溢出更難查。
export function flowY(blocks: FlowBlock[], top: number, bottom: number): number[] {
  if (blocks.length === 0) return [];

  // 間距一律夾在非負，上限一律不小於理想值。負的間距會讓兩個區塊真的疊在一起，
  // 而本函式對呼叫端的唯一承諾正是「寧可誠實溢出，也不靜默重疊」——呼叫端若把
  // 動態偏移算成負值，在這裡吸收掉，遠好過讓場景畫出一個看似正常實則互疊的版面
  // （場景層在本專案是測不到的）。
  const gaps = blocks.map((b) => Math.max(0, b.gap ?? 0));
  const mins = blocks.map((b, i) => Math.max(0, Math.min(b.minGap ?? DEFAULT_MIN_GAP, gaps[i])));
  const maxes = blocks.map((b, i) => Math.max(gaps[i], b.maxGap ?? gaps[i] + DEFAULT_MAX_GAP_SLACK));

  const content = blocks.reduce((sum, b) => sum + b.h, 0);
  const wanted = gaps.reduce((sum, g) => sum + g, 0);
  const avail = bottom - top;

  let actual: number[];
  if (avail >= content + wanted) {
    // 有餘：逐輪把剩餘空間平均加到還沒到上限的間距上，直到分完或全部觸頂
    actual = [...gaps];
    let slack = avail - content - wanted;
    let open = actual.map((g, i) => g < maxes[i]);
    while (slack > 0.01 && open.some(Boolean)) {
      const n = open.filter(Boolean).length;
      const share = slack / n;
      let used = 0;
      for (let i = 0; i < actual.length; i++) {
        if (!open[i]) continue;
        const add = Math.min(share, maxes[i] - actual[i]);
        actual[i] += add;
        used += add;
        if (actual[i] >= maxes[i] - 0.01) open[i] = false;
      }
      if (used <= 0.01) break; // 全部觸頂，剩下的空間留在最下方
      slack -= used;
    }
  } else {
    // 不足：把每一道間距朝各自的 minGap 等比壓縮。
    // t=1 為完全不壓縮、t=0 為全部壓到下限；解 content + Σ(min + t*(gap-min)) = avail。
    const minTotal = mins.reduce((sum, g) => sum + g, 0);
    const shrinkable = wanted - minTotal;
    const t = shrinkable <= 0 ? 0
      : Math.max(0, Math.min(1, (avail - content - minTotal) / shrinkable));
    actual = gaps.map((g, i) => mins[i] + t * (g - mins[i]));
  }

  const out: number[] = [];
  let cursor = top;
  for (let i = 0; i < blocks.length; i++) {
    cursor += actual[i];
    out.push(cursor + blocks[i].h / 2);
    cursor += blocks[i].h;
  }
  return out;
}
