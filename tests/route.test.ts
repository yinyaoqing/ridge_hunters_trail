import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { buildTerrain, isPassable } from '../src/core/terrain';
import { angleDeg, angleDiff, dist } from '../src/core/geometry';
import {
  buildRoute, targetAt, finalTarget, routeRuleFor,
  ROUTE_WAYPOINTS, ROUTE_START_INDEX, MOVE_EVERY, type RouteRule,
} from '../src/core/route';

const SIZE = 20;

// 以種子造一張真地形，再在上面走一條路線。用真的 buildTerrain 而非人造網格，
// 是因為「沿稜線走」「沿溪谷走」這些規則只有在真實高程場上才有意義。
const routeFor = (seed: number, rule: RouteRule) => {
  const rng = mulberry32(seed);
  const { terrain, elevation } = buildTerrain(rng, SIZE, 0);
  return { route: buildRoute(rng, terrain, elevation, SIZE, rule), terrain, elevation };
};

const RULES: RouteRule[] = ['lowland', 'highland', 'cover', 'straight', 'doubling'];

describe('buildRoute: 結構', () => {
  it('每條規則都生出固定長度的路線', () => {
    for (const rule of RULES) {
      expect(routeFor(1, rule).route.waypoints).toHaveLength(ROUTE_WAYPOINTS);
    }
  });

  it('所有節點都在圖內且可通行', () => {
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route, terrain } = routeFor(seed, rule);
        for (const w of route.waypoints) {
          expect(w.x).toBeGreaterThanOrEqual(0);
          expect(w.y).toBeGreaterThanOrEqual(0);
          expect(w.x).toBeLessThan(SIZE);
          expect(w.y).toBeLessThan(SIZE);
          expect(isPassable(terrain[w.y][w.x])).toBe(true);
        }
      }
    }
  });

  it('相鄰節點永遠不同格', () => {
    // 節點重複代表獵物「原地不動一個週期」，玩家會看到牠停下又走，
    // 而外推方向的推理會落空。生成階段就不該產出這種路線。
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route } = routeFor(seed, rule);
        for (let i = 1; i < route.waypoints.length; i++) {
          expect(route.waypoints[i]).not.toEqual(route.waypoints[i - 1]);
        }
      }
    }
  });

  it('節距不超過該規則的上限', () => {
    // 只驗上限：靠近地圖邊緣時 clampToMap 會把候選點拉近，下限因此無法保證
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route } = routeFor(seed, rule);
        for (let i = 1; i < route.waypoints.length; i++) {
          expect(dist(route.waypoints[i - 1], route.waypoints[i])).toBeLessThanOrEqual(7.5);
        }
      }
    }
  });

  // 再審覆核新增：上面那條測試只驗上限，SPACING 因此完全沒有下限守護——
  // 可解性掃描（tests/solvability.test.ts）獎勵更短的攔截路，任何調小 SPACING
  // 的改動都會讓可解性掃描的數字變好看，而 route.test.ts 之前沒有任何測試會因此
  // 變紅。壓力因此全部指向同一個方向：把 SPACING 一路收到 1，直到「預測牠會在
  // 哪」這個 Phase 6a 的核心前提被壓成雜訊也不會被抓到。
  //
  // 個別 leg 的距離不能直接下界：edge clamping 會把靠近地圖邊緣的候選點拉近，
  // 上面那條測試的註解已經說明這一點，量測也證實單一 leg 確實會量到 1.000
  // （即與相鄰格同格的下一格，clampToMap／nearestUnusedPassable 保底命中邊緣時）。
  // 因此改成量測「平均」：seed 1..30、五條規則（與上面同一份 30 顆種子慣例）
  // 量得 mean leg ≈2.70–2.88、mean total（4 段合計）≈10.8–11.5，20 次重疊視窗
  // 抽樣都落在這個範圍內，穩定不飄。刻意把 SPACING 全部下修到 1 做對照組
  // （退化探針，量完即還原）：mean leg 崩到 1.191、mean total 崩到 4.764——
  // 與真實範圍有清楚的間隔。門檻取兩者中間、偏向真實值那一側：
  // mean leg ≥ 1.8（比退化值 1.191 高 0.6，比真實下緣 2.70 低 0.9）、
  // mean total ≥ 7.0（比退化值 4.764 高 2.2，比真實下緣 10.8 低 3.8）——
  // 兩邊都留了看得見的餘裕，SPACING 若真的被壓向 1，這裡會先紅。
  it('節距與總路線長度的平均值不會被壓成退化值（下限，回歸測試）', () => {
    const allLegs: number[] = [];
    const allTotals: number[] = [];
    for (const rule of RULES) {
      for (let seed = 1; seed <= 30; seed++) {
        const { route } = routeFor(seed, rule);
        let total = 0;
        for (let i = 1; i < route.waypoints.length; i++) {
          const d = dist(route.waypoints[i - 1], route.waypoints[i]);
          allLegs.push(d);
          total += d;
        }
        allTotals.push(total);
      }
    }
    const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean(allLegs)).toBeGreaterThanOrEqual(1.8);
    expect(mean(allTotals)).toBeGreaterThanOrEqual(7.0);
  });

  it('route 帶著自己的規則，供揭曉畫面說明物種走法', () => {
    expect(routeFor(1, 'doubling').route.rule).toBe('doubling');
  });
});

describe('buildRoute: 每條規則真的表現出它宣稱的偏好', () => {
  const meanElevation = (rule: RouteRule): number => {
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { route, elevation } = routeFor(seed, rule);
      for (const w of route.waypoints) { sum += elevation[w.y][w.x]; n++; }
    }
    return sum / n;
  };

  it('沿溪谷走的平均高程顯著低於沿稜線走', () => {
    // 這是「物種個性可觀察」的實測：兩條規則若走出一樣的地形，玩家就學不到東西
    expect(meanElevation('lowland')).toBeLessThan(meanElevation('highland') - 0.1);
  });

  it('貼著掩蔽走的路線經過的密叢比直行多', () => {
    const thicketShare = (rule: RouteRule): number => {
      let hit = 0;
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { route, terrain } = routeFor(seed, rule);
        for (const w of route.waypoints) { if (terrain[w.y][w.x] === 'thicket') hit++; n++; }
      }
      return hit / n;
    };
    expect(thicketShare('cover')).toBeGreaterThan(thicketShare('straight'));
  });

  const meanLateTurn = (rule: RouteRule): number => {
    // 後半段（W2→W3、W3→W4）相對於前一段的平均轉角
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { route } = routeFor(seed, rule);
      const w = route.waypoints;
      for (let i = 3; i < w.length; i++) {
        sum += angleDiff(angleDeg(w[i - 1], w[i]), angleDeg(w[i - 2], w[i - 1]));
        n++;
      }
    }
    return sum / n;
  };

  it('直行的後段轉角很小，折返的後段轉角很大', () => {
    // 這一條是 doubling 存在的理由：玩家不能對牠直線外推
    expect(meanLateTurn('straight')).toBeLessThan(45);
    expect(meanLateTurn('doubling')).toBeGreaterThan(90);
  });

  it('第一步的方向不會集中在單一方位', () => {
    // 回歸測試。起始朝向若不隨機，straight／doubling 的第一段評分會在 16 個候選之間
    // 完全平手，挑選迴圈的嚴格大於比較讓 candidates[0]（正東）勝出——實測曾有 91%
    // 的路線第一步朝正東，而「維持原方向」對 straight 是穩定不動點，
    // 於是整條路線退化成一條水平線，三隻生物的線索幾何因此偏向單一方位。
    for (const rule of ['straight', 'doubling'] as RouteRule[]) {
      const buckets = new Map<number, number>();
      for (let seed = 1; seed <= 200; seed++) {
        const w = routeFor(seed, rule).route.waypoints;
        const b = Math.round(angleDeg(w[0], w[1]) / 45) % 8;
        buckets.set(b, (buckets.get(b) ?? 0) + 1);
      }
      // 八個方位，均勻分佈是 0.125。0.4 是寬鬆的門檻——它抓的是「九成集中在一個方位」
      // 這種退化，而不是要求方位完美均勻（地形本來就會讓某些方向比較好走）。
      expect(Math.max(...buckets.values()) / 200).toBeLessThan(0.4);
    }
  });
});

describe('targetAt', () => {
  const route = routeFor(7, 'straight').route;

  it('開局站在 W2', () => {
    expect(targetAt(route, 0)).toEqual(route.waypoints[ROUTE_START_INDEX]);
  });

  it('不滿一個週期不前進', () => {
    expect(targetAt(route, MOVE_EVERY - 1)).toEqual(route.waypoints[ROUTE_START_INDEX]);
  });

  it('每滿一個週期前進一個節點', () => {
    expect(targetAt(route, MOVE_EVERY)).toEqual(route.waypoints[ROUTE_START_INDEX + 1]);
    expect(targetAt(route, MOVE_EVERY * 2)).toEqual(route.waypoints[ROUTE_START_INDEX + 2]);
  });

  it('走到覓食地就停住，再多步也不會出界', () => {
    expect(targetAt(route, MOVE_EVERY * 3)).toEqual(finalTarget(route));
    expect(targetAt(route, 100000)).toEqual(finalTarget(route));
  });
});

describe('routeRuleFor', () => {
  it('八隻生物各有規則，且五條規則都有生物在用', () => {
    const ids = ['mistfawn', 'emberquill', 'thicketloom', 'dewhopper',
      'veilmoth', 'lanternshrew', 'ridgecrest', 'plumetail'];
    const used = new Set(ids.map(routeRuleFor));
    expect(used).toEqual(new Set(RULES));
  });

  it('未知生物落回直行而不是崩潰', () => {
    expect(routeRuleFor('no-such-creature')).toBe('straight');
  });
});

describe('決定性', () => {
  it('同一顆種子永遠得到同一條路線', () => {
    for (const rule of RULES) {
      expect(routeFor(12, rule).route).toEqual(routeFor(12, rule).route);
    }
  });
});
