import { describe, it, expect } from 'vitest';
// @ts-expect-error 美術母檔為無型別的 .mjs（建置期資產，不進執行期打包）
import { BESTIARY_WAVE2, TERRAIN_INK } from '../scripts/bestiary-wave2.mjs';
import { CREATURES } from '../src/data/creatures';

interface Wave2Entry {
  id: string;
  en: string;
  zh: string;
  terrain: string;
  accent: string;
  source: { zh: string; en: string };
  trait: string;
  shape: string;
}

const ENTRIES = BESTIARY_WAVE2 as Wave2Entry[];
const CLUE_GOLD = [0xd8, 0xc8, 0x74];

function distanceToClueGold(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.hypot(rgb[0] - CLUE_GOLD[0], rgb[1] - CLUE_GOLD[1], rgb[2] - CLUE_GOLD[2]);
}

describe('bestiary wave 2 (美術概念稿)', () => {
  it('has 40 entries with unique ids that do not collide with the shipped creatures', () => {
    expect(ENTRIES.length).toBe(40);
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(40);
    const shipped = new Set(CREATURES.map((c) => c.id));
    for (const e of ENTRIES) expect(shipped.has(e.id)).toBe(false);
  });

  it('spreads evenly over the four terrains', () => {
    for (const terrain of ['meadow', 'mist', 'thicket', 'rock']) {
      expect(ENTRIES.filter((e) => e.terrain === terrain).length).toBe(10);
      expect(TERRAIN_INK[terrain]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('every entry carries both names, a trait line and its real-life source', () => {
    for (const e of ENTRIES) {
      expect(e.en.length).toBeGreaterThan(0);
      expect(e.zh.length).toBeGreaterThan(0);
      expect(e.trait.length).toBeGreaterThan(0);
      expect(e.source.zh.length).toBeGreaterThan(0);
      expect(e.source.en.length).toBeGreaterThan(0);
    }
  });

  it('shapes are pure inline vector with both colour tokens', () => {
    for (const e of ENTRIES) {
      expect(e.shape).toContain('INK');
      expect(e.shape).toContain('ACCENT');
      expect(e.shape).not.toMatch(/https?:|url\(|<image|href=/);
    }
  });

  it('accents stay clear of the clue gold (規格書 §8.2)', () => {
    // 分界取自既有生物中最靠近金光的 plumetail #b5d68f。
    const shippedFloor = Math.min(
      ...CREATURES.map((c) => distanceToClueGold(`#${c.color.toString(16).padStart(6, '0')}`)),
    );
    for (const e of ENTRIES) {
      expect(e.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(distanceToClueGold(e.accent)).toBeGreaterThanOrEqual(shippedFloor);
    }
  });
});
