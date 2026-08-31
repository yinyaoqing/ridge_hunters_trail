import { dist, angleDeg, angleDiff, type Vec2 } from './geometry';
import type { Clue } from './types';

export const key = (p: Vec2): string => `${p.x},${p.y}`;

function matches(clue: Clue, cell: Vec2): boolean {
  const d = dist(clue.position, cell);
  switch (clue.type) {
    case 'footprint':
      if (cell.x === clue.position.x && cell.y === clue.position.y) return false;
      return angleDiff(angleDeg(clue.position, cell), clue.data.direction) <= clue.data.angleSpread;
    case 'disturbance':
      return d <= clue.data.radius;
    case 'scent':
      return Math.abs(d - clue.data.distance) <= clue.data.tolerance;
  }
}

export function candidates(clue: Clue, mapSize: number): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      if (matches(clue, { x, y })) out.add(key({ x, y }));
    }
  }
  return out;
}

export function intersect(clues: Clue[], mapSize: number): Set<string> {
  if (clues.length === 0) return new Set();
  let acc = candidates(clues[0], mapSize);
  for (const clue of clues.slice(1)) {
    const next = candidates(clue, mapSize);
    acc = new Set([...acc].filter((k) => next.has(k)));
  }
  return acc;
}
