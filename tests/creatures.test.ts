import { describe, it, expect } from 'vitest';
import { CREATURES } from '../src/data/creatures';

describe('CREATURES', () => {
  it('has exactly 8 creatures with unique ids', () => {
    expect(CREATURES.length).toBe(8);
    expect(new Set(CREATURES.map((c) => c.id)).size).toBe(8);
  });
  it('all terrain preferences are valid terrain types', () => {
    const valid = ['meadow', 'mist', 'thicket', 'rock'];
    for (const c of CREATURES) expect(valid).toContain(c.terrain);
  });
  it('every creature has names and descriptions in both locales', () => {
    for (const c of CREATURES) {
      expect(c.names.en.length).toBeGreaterThan(0);
      expect(c.names['zh-TW'].length).toBeGreaterThan(0);
      expect(c.descs.en.length).toBeGreaterThan(0);
      expect(c.descs['zh-TW'].length).toBeGreaterThan(0);
    }
  });
});
