export interface Vec2 {
  x: number;
  y: number;
}

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const cheb = (a: Vec2, b: Vec2): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function angleDeg(from: Vec2, to: Vec2): number {
  return ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360;
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function clampToMap(p: Vec2, size: number): Vec2 {
  return {
    x: Math.min(size - 1, Math.max(0, Math.round(p.x))),
    y: Math.min(size - 1, Math.max(0, Math.round(p.y))),
  };
}

export function pointOnCircle(center: Vec2, radius: number, deg: number): Vec2 {
  const rad = (deg * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) };
}
