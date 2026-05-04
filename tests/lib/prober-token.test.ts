import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { getOrCreateProberToken, validateProberToken } from '@/lib/auth/prober-token';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  return db;
}

describe('prober-token', () => {
  let db: Database.Database;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('generates a new token when none exists', () => {
    const t = getOrCreateProberToken(db);
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same token on subsequent calls', () => {
    const a = getOrCreateProberToken(db);
    const b = getOrCreateProberToken(db);
    expect(a).toBe(b);
  });

  it('reads from PROBER_TOKEN env var if set', () => {
    vi.stubEnv('PROBER_TOKEN', 'envvar-token-value');
    const t = getOrCreateProberToken(db);
    expect(t).toBe('envvar-token-value');
  });

  it('validates a matching bearer header', () => {
    const t = getOrCreateProberToken(db);
    expect(validateProberToken(`Bearer ${t}`, db)).toBe(true);
  });

  it('rejects a missing or wrong header', () => {
    getOrCreateProberToken(db);
    expect(validateProberToken(null, db)).toBe(false);
    expect(validateProberToken('Bearer wrong', db)).toBe(false);
    expect(validateProberToken('Basic abc', db)).toBe(false);
  });
});
