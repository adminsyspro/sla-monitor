import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { validateProberToken } from '@/lib/auth/prober-token';

const PROTECTED_STATUSES = new Set(['maintenance', 'partial']);

const CheckSchema = z.object({
  monitor_id: z.string().min(1),
  timestamp: z.number().int().positive(),
  status: z.enum(['operational', 'degraded', 'major', 'unknown']),
  response_time_ms: z.number().int().nullable(),
  status_code: z.number().int().nullable(),
  error: z.string().nullable(),
  region: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

export async function POST(request: NextRequest) {
  const db = getDb();
  if (!validateProberToken(request.headers.get('authorization'), db)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = CheckSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }
  const c = parsed.data;

  const monitor = db
    .prepare('SELECT id, status, enabled FROM monitors WHERE id = ?')
    .get(c.monitor_id) as { id: string; status: string; enabled: number } | undefined;
  if (!monitor) return NextResponse.json({ error: 'monitor_not_found' }, { status: 404 });
  if (monitor.enabled === 0) return NextResponse.json({ error: 'monitor_disabled' }, { status: 410 });

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time, status_code, error, region, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      c.monitor_id,
      c.timestamp,
      c.status,
      c.response_time_ms,
      c.status_code,
      c.error,
      c.region,
      JSON.stringify(c.metadata)
    );

    if (PROTECTED_STATUSES.has(monitor.status)) {
      db.prepare(`UPDATE monitors SET last_check_at = ?, updated_at = unixepoch() WHERE id = ?`)
        .run(c.timestamp, c.monitor_id);
    } else {
      db.prepare(`UPDATE monitors SET last_check_at = ?, status = ?, updated_at = unixepoch() WHERE id = ?`)
        .run(c.timestamp, c.status, c.monitor_id);
    }
  });
  tx();

  return new NextResponse(null, { status: 201 });
}
