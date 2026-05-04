import crypto from 'crypto';
import type Database from 'better-sqlite3';

const SETTINGS_KEY = 'prober.token';

export function getOrCreateProberToken(db: Database.Database): string {
  const fromEnv = process.env.PROBER_TOKEN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (row) return row.value;

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(SETTINGS_KEY, token);
  return token;
}

export function validateProberToken(authHeader: string | null, db: Database.Database): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const provided = authHeader.slice('Bearer '.length).trim();
  if (provided.length === 0) return false;
  const expected = getOrCreateProberToken(db);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
