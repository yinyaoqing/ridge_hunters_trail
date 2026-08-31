import { describe, it, expect } from 'vitest';
import { silhouetteSvg, silhouetteDataUri } from '../src/data/silhouettes';
import { CREATURES } from '../src/data/creatures';

describe('silhouettes', () => {
  it('provides an svg for every creature id', () => {
    for (const c of CREATURES) {
      const svg = silhouetteSvg(c.id, '#0f1613', '#ffffff');
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox');
    }
  });

  it('injects ink and accent colors', () => {
    const svg = silhouetteSvg('mistfawn', '#111111', '#22cc99');
    expect(svg).toContain('#111111');
    expect(svg).toContain('#22cc99');
  });

  it('contains no external references (pure inline vector)', () => {
    for (const c of CREATURES) {
      // xmlns 命名空間宣告是必要的，先剝除再檢查外部引用
      const svg = silhouetteSvg(c.id, '#0f1613', '#ffffff')
        .replace('xmlns="http://www.w3.org/2000/svg"', '');
      expect(svg).not.toMatch(/https?:|url\(|<image|href=/);
    }
  });

  it('unknown id throws', () => {
    expect(() => silhouetteSvg('nope', '#000000', '#ffffff')).toThrow();
  });

  it('data uri is a base64 svg', () => {
    const uri = silhouetteDataUri('veilmoth', '#0f1613', '#c9b1d6');
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
