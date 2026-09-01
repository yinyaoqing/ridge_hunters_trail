import type { DifficultyParams } from './difficulty';

// 天氣：每關抽一種，僅調整線索可讀性相關參數（不改 clueCount/decoyCount/supplyCount/
// maxIntersection），求解性不受影響——反向錨定仍在修飾後的參數上執行。
// 表：mist scentTolerance×1.5＋footprintSpread×1.5；wind scentTolerance×1.75＋
// disturbanceRadius=max(1, r−1)；drizzle footprintSpread×0.75＋scentTolerance×1.25；clear 原樣
export type Weather = 'clear' | 'mist' | 'wind' | 'drizzle';

export const WEATHER_POOL: [Weather, number][] = [
  ['clear', 4], ['mist', 2], ['wind', 2], ['drizzle', 2],
];

export function applyWeather(p: DifficultyParams, w: Weather): DifficultyParams {
  const q: DifficultyParams = { ...p, typeRatio: { ...p.typeRatio }, qte: { ...p.qte } };
  switch (w) {
    case 'mist':
      q.scentTolerance = p.scentTolerance * 1.5;
      q.footprintSpread = p.footprintSpread * 1.5;
      break;
    case 'wind':
      q.scentTolerance = p.scentTolerance * 1.75;
      q.disturbanceRadius = Math.max(1, p.disturbanceRadius - 1);
      break;
    case 'drizzle':
      q.footprintSpread = p.footprintSpread * 0.75;
      q.scentTolerance = p.scentTolerance * 1.25;
      break;
    case 'clear':
      break;
  }
  return q;
}
