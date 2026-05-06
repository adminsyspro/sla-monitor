import { describe, it, expect } from 'vitest';
import { ALL_WINDOWS, parseWindow, isWindowAvailable } from '@/lib/window';

describe('window util', () => {
  it('parses known presets', () => {
    expect(parseWindow('24h')).toBe('24h');
    expect(parseWindow('7d')).toBe('7d');
    expect(parseWindow('30d')).toBe('30d');
    expect(parseWindow('90d')).toBe('90d');
    expect(parseWindow('1y')).toBe('1y');
  });

  it('falls back to 30d on unknown or null', () => {
    expect(parseWindow(null)).toBe('30d');
    expect(parseWindow('garbage')).toBe('30d');
    expect(parseWindow('1h')).toBe('30d');
  });

  it('lists all five presets in order', () => {
    expect(ALL_WINDOWS).toEqual(['24h', '7d', '30d', '90d', '1y']);
  });

  describe('isWindowAvailable', () => {
    it('all windows available when retention is unlimited', () => {
      for (const w of ALL_WINDOWS) {
        expect(isWindowAvailable(w, null)).toBe(true);
      }
    });

    it('1y disabled when retention < 365', () => {
      expect(isWindowAvailable('1y', 90)).toBe(false);
      expect(isWindowAvailable('1y', 365)).toBe(true);
    });

    it('90d disabled when retention < 90', () => {
      expect(isWindowAvailable('90d', 30)).toBe(false);
      expect(isWindowAvailable('90d', 90)).toBe(true);
    });

    it('24h, 7d always available with valid retention', () => {
      expect(isWindowAvailable('24h', 30)).toBe(true);
      expect(isWindowAvailable('7d', 30)).toBe(true);
      expect(isWindowAvailable('30d', 30)).toBe(true);
    });
  });
});
