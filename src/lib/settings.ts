import type Database from 'better-sqlite3';

const RETENTION_KEY = 'retention_days';
const DEFAULT_RETENTION_DAYS = 90;
const UNLIMITED_SENTINEL = 'unlimited';

export const ALLOWED_RETENTION_DAYS = [30, 90, 180, 365] as const;
export type RetentionDays = (typeof ALLOWED_RETENTION_DAYS)[number] | null;

export function getRetentionDays(db: Database.Database): number | null {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(RETENTION_KEY) as { value: string } | undefined;
  if (!row) return DEFAULT_RETENTION_DAYS;
  if (row.value === UNLIMITED_SENTINEL) return null;
  const parsed = parseInt(row.value, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_RETENTION_DAYS;
}

export function setRetentionDays(db: Database.Database, value: RetentionDays): void {
  const stored = value === null ? UNLIMITED_SENTINEL : String(value);
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(RETENTION_KEY, stored);
}

export function isAllowedRetention(value: unknown): value is RetentionDays {
  if (value === null) return true;
  return typeof value === 'number' && (ALLOWED_RETENTION_DAYS as readonly number[]).includes(value);
}
