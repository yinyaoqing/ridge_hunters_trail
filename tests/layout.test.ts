import { describe, it, expect } from 'vitest';
import { flowY, type FlowBlock } from '../src/core/layout';

// 由回傳的中心 y 還原每個區塊的上下緣，測試多半在檢查這些邊界的關係
const edges = (blocks: FlowBlock[], ys: number[]) =>
  ys.map((y, i) => ({ top: y - blocks[i].h / 2, bottom: y + blocks[i].h / 2 }));

const B = (h: number, gap: number, extra: Partial<FlowBlock> = {}): FlowBlock =>
  ({ h, gap, ...extra });

describe('flowY: 空間充足時', () => {
  const blocks = [B(40, 20), B(50, 30), B(50, 30)];

  it('回傳每個區塊的中心 y，順序遞增', () => {
    const ys = flowY(blocks, 0, 600);
    expect(ys).toHaveLength(3);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('任兩個區塊都不重疊', () => {
    const e = edges(blocks, flowY(blocks, 0, 600));
    for (let i = 1; i < e.length; i++) expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
  });

  it('整疊都待在 [top, bottom] 之內', () => {
    const e = edges(blocks, flowY(blocks, 100, 700));
    expect(e[0].top).toBeGreaterThanOrEqual(100);
    expect(e[e.length - 1].bottom).toBeLessThanOrEqual(700);
  });

  it('多出來的空間平均分給每一道間距，而不是先把第一道撐到上限', () => {
    // 這條測的是營地畫面的實際缺陷：舊版把所有寬裕都留在標題與第一顆按鈕之間。
    // bottom 刻意選在「寬裕不足以讓每道間距都觸頂」的區間（內容 140 ＋ 理想間距 80，
    // 餘裕總量 120，此處 slack 只有 60）——若選得太寬，平均分配與依序填滿會得到
    // 完全相同的結果，這條測試就分辨不出兩者，等於什麼都沒測。
    // 平均分配 → [40, 50, 50]；依序把第一道填到上限 → [60, 50, 30]。
    const e = edges(blocks, flowY(blocks, 0, 280));
    expect(e[0].top - 0).toBeCloseTo(40, 5);
    expect(e[1].top - e[0].bottom).toBeCloseTo(50, 5);
    expect(e[2].top - e[1].bottom).toBeCloseTo(50, 5);
  });

  it('間距不會被撐到無限大——每一道都有上限', () => {
    const e = edges(blocks, flowY(blocks, 0, 5000));
    const gaps = [e[0].top - 0, e[1].top - e[0].bottom, e[2].top - e[1].bottom];
    for (const g of gaps) expect(g).toBeLessThanOrEqual(80); // 預設上限 = gap + 40，此處最大 70
  });
});

describe('flowY: 空間不足時', () => {
  const blocks = [B(40, 20), B(50, 30), B(50, 30), B(44, 30)];

  it('壓縮間距而不是讓區塊互相重疊', () => {
    const e = edges(blocks, flowY(blocks, 0, 260));
    for (let i = 1; i < e.length; i++) expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
  });

  it('間距壓縮到下限就停住', () => {
    const e = edges(blocks, flowY(blocks, 0, 200));
    const gaps = [e[0].top - 0, e[1].top - e[0].bottom, e[2].top - e[1].bottom, e[3].top - e[2].bottom];
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(4); // 預設 minGap
  });

  it('尊重個別區塊指定的 minGap，且壓到下限就停住', () => {
    // 按鈕之間需要比文字之間更大的最小間距，否則兩顆按鈕的 44px 命中區會相黏。
    // bottom 取「內容 140 ＋ 所有最小間距 32」的臨界值 172，每一道間距因此正好
    // 落在自己的下限上——比隨便挑一個較寬的值更能驗出下限本身有沒有被套用。
    const tight = [B(40, 20), B(50, 30, { minGap: 14 }), B(50, 30, { minGap: 14 })];
    const e = edges(tight, flowY(tight, 0, 172));
    expect(e[0].top - 0).toBeCloseTo(4, 5);
    expect(e[1].top - e[0].bottom).toBeCloseTo(14, 5);
    expect(e[2].top - e[1].bottom).toBeCloseTo(14, 5);
  });

  it('連下限都塞不下時，回報溢出而不是靜默重疊', () => {
    // 這種視窗本來就放不下；重要的是呼叫端拿得到「已經溢出」的事實，
    // 而不是拿到一組看似正常、實際互疊的座標。
    const e = edges(blocks, flowY(blocks, 0, 100));
    for (let i = 1; i < e.length; i++) expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
    expect(e[e.length - 1].bottom).toBeGreaterThan(100); // 誠實地超出 bottom
  });
});

describe('flowY: 邊界情形', () => {
  it('空陣列回傳空陣列', () => {
    expect(flowY([], 0, 600)).toEqual([]);
  });

  it('單一區塊也照常運作', () => {
    const ys = flowY([B(50, 20)], 0, 600);
    expect(ys).toHaveLength(1);
    expect(ys[0] - 25).toBeGreaterThanOrEqual(0);
  });

  it('gap 省略時視為 0', () => {
    const ys = flowY([{ h: 40 }, { h: 40 }], 0, 80);
    expect(ys[1] - ys[0]).toBe(40);
  });

  it('同樣的輸入永遠得到同樣的輸出', () => {
    const b = [B(40, 20), B(50, 30)];
    expect(flowY(b, 0, 400)).toEqual(flowY(b, 0, 400));
  });

  it('負的間距與負的 minGap 都當成 0，不會吐出重疊的座標', () => {
    // 這是回歸測試。呼叫端若把某個動態偏移算成負值，本函式寧可吸收掉，
    // 也不能回傳一組看起來正常、實際互疊的座標——那種版面在場景層測不出來，
    // 只會在玩家的截圖裡出現。三個 bottom 分別打中「恰好塞滿」「有餘」「不足」三個分支。
    const b = [B(40, 0), B(40, -10), B(40, 20, { minGap: -30 })];
    for (const bottom of [70, 300, 1000]) {
      const e = edges(b, flowY(b, 0, bottom));
      for (let i = 1; i < e.length; i++) {
        expect(e[i].top).toBeGreaterThanOrEqual(e[i - 1].bottom);
      }
    }
  });
});
