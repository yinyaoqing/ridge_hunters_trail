import { describe, it, expect } from 'vitest';
import { getPalette, CLUE_GOLD } from '../src/core/palette';
import { TERRAIN_TYPES } from '../src/core/types';

describe('getPalette follows the three-cycle art direction', () => {
  it('rounds 1-3 use the mist-green cycle', () => {
    for (const r of [1, 2, 3]) expect(getPalette(r).id).toBe('mist-green');
  });
  it('rounds 4-7 use the ochre cycle', () => {
    for (const r of [4, 7]) expect(getPalette(r).id).toBe('ochre');
  });
  it('rounds 8+ use the dusk-violet cycle', () => {
    for (const r of [8, 20]) expect(getPalette(r).id).toBe('dusk-violet');
  });

  it('clue gold and paper stay readable across every cycle', () => {
    for (const r of [1, 4, 8]) {
      const p = getPalette(r);
      expect(p.gold).toBe(CLUE_GOLD); // 線索金光全循環共用（美術方向板）
      expect(p.paper).toBeGreaterThan(0xc0c0c0); // 紙墨白必須是亮色
    }
  });

  it('every cycle defines all five terrain colors, mutually distinct', () => {
    for (const r of [1, 5, 9]) {
      const t = getPalette(r).terrain;
      const values = TERRAIN_TYPES.map((type) => t[type]);
      expect(values).toHaveLength(5);
      expect(new Set(values).size).toBe(5); // 互不相同：崖壁必須與岩坡分得開
    }
  });

  it('creature glow per cycle matches the art board', () => {
    expect(getPalette(1).glow).toBe(0x9ad1c8);
    expect(getPalette(4).glow).toBe(0xe0955f);
    expect(getPalette(8).glow).toBe(0xc9b1d6);
  });
});
