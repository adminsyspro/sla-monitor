import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  getRetentionDays,
  setRetentionDays,
  isAllowedRetention,
} from '@/lib/settings';

const GENERAL_KEYS = ['general_site_name', 'general_contact_email', 'general_timezone'] as const;

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'Administrator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const rows = db.prepare(
    `SELECT key, value FROM app_settings WHERE key IN (${GENERAL_KEYS.map(() => '?').join(',')})`
  ).all(...GENERAL_KEYS) as Array<{ key: string; value: string }>;

  const config: Record<string, string> = {};
  for (const row of rows) config[row.key] = row.value;

  return NextResponse.json({
    siteName: config.general_site_name || 'My Company',
    contactEmail: config.general_contact_email || 'admin@example.com',
    timezone: config.general_timezone || 'Europe/Paris',
    retentionDays: getRetentionDays(db),
  });
}

export async function PUT(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'Administrator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const db = getDb();

  if ('retentionDays' in body) {
    if (!isAllowedRetention(body.retentionDays)) {
      return NextResponse.json(
        { error: 'invalid_retention_days', allowed: [30, 90, 180, 365, null] },
        { status: 400 }
      );
    }
  }

  const mapping: Record<string, string> = {};
  if (body.siteName !== undefined) mapping.general_site_name = body.siteName || '';
  if (body.contactEmail !== undefined) mapping.general_contact_email = body.contactEmail || '';
  if (body.timezone !== undefined) mapping.general_timezone = body.timezone || 'Europe/Paris';

  const stmt = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(mapping)) {
      stmt.run(key, value);
    }
    if ('retentionDays' in body) {
      setRetentionDays(db, body.retentionDays);
    }
  });
  transaction();

  return NextResponse.json({ success: true });
}
