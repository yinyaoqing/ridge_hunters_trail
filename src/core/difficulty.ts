export interface QteParams {
  speed: number;   // 指針角速度（度/秒）
  arcSize: number; // 命中弧區大小（度）
  rounds: number;  // 嘗試次數
  needed: number;  // 需求命中數
}

export interface DifficultyParams {
  mapSize: number;
  clueCount: number;
  decoyCount: number;
  maxIntersection: number; // 允許交集格數上限（規格書 4.5）
  footprintSpread: number; // 足跡錐形半角（度）
  disturbanceRadius: number;
  scentTolerance: number;
  minClueDist: number; // footprint/scent 線索與錨定點的距離範圍
  maxClueDist: number;
  typeRatio: { footprint: number; disturbance: number; scent: number };
  staminaBudget: number;
  supplyCount: number;
  supplyRestore: number;
  qte: QteParams;
}

export function getDifficulty(round: number): DifficultyParams {
  if (round <= 3) {
    return {
      mapSize: 15, clueCount: 4, decoyCount: 0, maxIntersection: 15,
      footprintSpread: 40, disturbanceRadius: 4, scentTolerance: 1.0,
      minClueDist: 3, maxClueDist: 6,
      typeRatio: { footprint: 60, disturbance: 30, scent: 10 },
      staminaBudget: 45, supplyCount: 3, supplyRestore: 10,
      qte: { speed: 180, arcSize: 70, rounds: 3, needed: 2 },
    };
  }
  if (round <= 7) {
    return {
      mapSize: 20, clueCount: 5, decoyCount: 1, maxIntersection: 8,
      footprintSpread: 25, disturbanceRadius: 3, scentTolerance: 0.75,
      minClueDist: 4, maxClueDist: 8,
      typeRatio: { footprint: 40, disturbance: 35, scent: 25 },
      staminaBudget: 70, supplyCount: 4, supplyRestore: 10,
      qte: { speed: 240, arcSize: 55, rounds: 3, needed: 2 },
    };
  }
  return {
    mapSize: 25, clueCount: 6, decoyCount: 2, maxIntersection: 4,
    footprintSpread: 15, disturbanceRadius: 2, scentTolerance: 0.5,
    minClueDist: 5, maxClueDist: 10,
    typeRatio: { footprint: 20, disturbance: 30, scent: 50 },
    staminaBudget: 95, supplyCount: 5, supplyRestore: 10,
    qte: { speed: 300, arcSize: 40, rounds: 4, needed: 3 },
  };
}
