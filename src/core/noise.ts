import type { Rng } from './rng';

// 0..1 的二維雜訊場。u/v 為正規化座標（0=左/上緣、1=右/下緣），超出範圍一律夾限。
export interface NoiseField {
  at(u: number, v: number): number;
}

// smoothstep：讓格點之間的內插在邊界處導數為零，避免出現方格狀的稜線假象
const smooth = (t: number): number => t * t * (3 - 2 * t);

// 種子化 value noise：建構期一次抽完 (gridSize+1)^2 個格點值，之後 at() 純內插、
// 不再碰 rng。rng 消耗次數只取決於 gridSize（呼叫端寫死），與地圖大小、取樣次數
// 都無關——這是每日挑戰「同一顆種子必得同一張地圖」的前提。
export function valueNoise(rng: Rng, gridSize: number): NoiseField {
  const n = gridSize + 1;
  const lattice = new Array<number>(n * n);
  for (let i = 0; i < n * n; i++) lattice[i] = rng();

  const get = (ix: number, iy: number): number => {
    const cx = Math.min(n - 1, Math.max(0, ix));
    const cy = Math.min(n - 1, Math.max(0, iy));
    return lattice[cy * n + cx];
  };

  return {
    at(u: number, v: number): number {
      const x = Math.min(1, Math.max(0, u)) * gridSize;
      const y = Math.min(1, Math.max(0, v)) * gridSize;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = smooth(x - ix);
      const fy = smooth(y - iy);
      const top = get(ix, iy) + (get(ix + 1, iy) - get(ix, iy)) * fx;
      const bottom = get(ix, iy + 1) + (get(ix + 1, iy + 1) - get(ix, iy + 1)) * fx;
      return top + (bottom - top) * fy;
    },
  };
}

// 兩層疊加：低頻 base 決定大地貌（山脊走向），高頻 detail 加上局部起伏。
// 70/30 的權重讓大結構仍然清楚可讀——玩家要能一眼看出「那邊是一條稜線」。
export function layered(base: NoiseField, detail: NoiseField): NoiseField {
  return { at: (u, v) => base.at(u, v) * 0.7 + detail.at(u, v) * 0.3 };
}
