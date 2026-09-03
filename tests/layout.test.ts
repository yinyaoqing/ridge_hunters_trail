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

  it('多出來的空間分給每一道間距，而不是全部堆在最上面', () => {
    // 這條測的是營地畫面的實際缺陷：舊版把所有寬裕都留在標題與第一顆按鈕之間，
    // 高視窗因此恆有 26% 的高度是空的。
    const ys = flowY(blocks, 0, 900);
    const e = edges(blocks, ys);
    const firstGap = e[0].top - 0;
    const laterGaps = [e[1].top - e[0].bottom, e[2].top - e[1].bottom];
    for (const g of laterGaps) expect(g).toBeGreaterThan(30); // 都拿到了額外空間
    expect(firstGap).toBeLessThan(200);                        // 沒有把寬裕全塞進第一道
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

  it('尊重個別區塊指定的 minGap', () => {
    // 按鈕之間需要比文字之間更大的最小間距，否則兩顆按鈕的 44px 命中區會相黏
    const tight = [B(40, 20), B(50, 30, { minGap: 14 }), B(50, 30, { minGap: 14 })];
    const e = edges(tight, flowY(tight, 0, 190));
    expect(e[1].top - e[0].bottom).toBeGreaterThanOrEqual(14);
    expect(e[2].top - e[1].bottom).toBeGreaterThanOrEqual(14);
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
});
