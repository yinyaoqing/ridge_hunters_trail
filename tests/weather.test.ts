import { describe, it, expect } from 'vitest';
import { applyWeather, WEATHER_POOL } from '../src/core/weather';
import { getDifficulty } from '../src/core/difficulty';

describe('applyWeather', () => {
  const base = getDifficulty(5);
  it('clear leaves params unchanged', () => {
    expect(applyWeather(base, 'clear')).toEqual(base);
  });
  it('mist widens scent tolerance and footprint spread', () => {
    const w = applyWeather(base, 'mist');
    expect(w.scentTolerance).toBeCloseTo(base.scentTolerance * 1.5);
    expect(w.footprintSpread).toBeCloseTo(base.footprintSpread * 1.5);
  });
  it('wind scatters scent and tightens disturbance with floor 1', () => {
    const w = applyWeather(base, 'wind');
    expect(w.scentTolerance).toBeCloseTo(base.scentTolerance * 1.75);
    expect(w.disturbanceRadius).toBe(Math.max(1, base.disturbanceRadius - 1));
  });
  it('drizzle sharpens footprints, slightly fades scent', () => {
    const w = applyWeather(base, 'drizzle');
    expect(w.footprintSpread).toBeCloseTo(base.footprintSpread * 0.75);
    expect(w.scentTolerance).toBeCloseTo(base.scentTolerance * 1.25);
  });
  it('never mutates the input', () => {
    const before = JSON.stringify(base);
    applyWeather(base, 'wind');
    expect(JSON.stringify(base)).toBe(before);
  });
  it('pool weights: clear 4, others 2', () => {
    expect(WEATHER_POOL).toEqual([['clear', 4], ['mist', 2], ['wind', 2], ['drizzle', 2]]);
  });
});
