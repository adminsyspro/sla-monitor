export const ALL_WINDOWS = ['24h', '7d', '30d', '90d', '1y'] as const;
export type WindowPreset = (typeof ALL_WINDOWS)[number];

const WINDOW_DAYS: Record<WindowPreset, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

export const DEFAULT_WINDOW: WindowPreset = '30d';

export function parseWindow(raw: string | null): WindowPreset {
  if (raw && (ALL_WINDOWS as readonly string[]).includes(raw)) {
    return raw as WindowPreset;
  }
  return DEFAULT_WINDOW;
}

export function isWindowAvailable(w: WindowPreset, retentionDays: number | null): boolean {
  if (retentionDays === null) return true;
  return WINDOW_DAYS[w] <= retentionDays;
}
