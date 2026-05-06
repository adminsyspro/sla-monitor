import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { getRetentionDays, setRetentionDays } from '@/lib/settings';

function makeDb() {
  const db = new Database(':memory:');
  db.prepare('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  return db;
}

describe('settings: retention', () => {
  let db: Database.Database;
  beforeEach(() => { db = makeDb(); });

  it('returns 90 when retention_days is absent (default)', () => {
    expect(getRetentionDays(db)).toBe(90);
  });

  it('returns the stored numeric value', () => {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('retention_days', '30');
    expect(getRetentionDays(db)).toBe(30);
  });

  it('returns null when stored value is the literal "unlimited"', () => {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('retention_days', 'unlimited');
    expect(getRetentionDays(db)).toBeNull();
  });

  it('setRetentionDays(90) writes "90"', () => {
    setRetentionDays(db, 90);
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('retention_days') as { value: string };
    expect(row.value).toBe('90');
  });

  it('setRetentionDays(null) writes "unlimited"', () => {
    setRetentionDays(db, null);
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('retention_days') as { value: string };
    expect(row.value).toBe('unlimited');
  });

  it('setRetentionDays overwrites existing value', () => {
    setRetentionDays(db, 90);
    setRetentionDays(db, 30);
    expect(getRetentionDays(db)).toBe(30);
  });
});
