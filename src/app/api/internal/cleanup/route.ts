import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateProberToken } from '@/lib/auth/prober-token';
import { getRetentionDays } from '@/lib/settings';

const PER_TICK_LIMIT = 50000;

export async function POST(request: NextRequest) {
  const db = getDb();
  const auth = request.headers.get('authorization');
  if (!validateProberToken(auth, db)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const retention = getRetentionDays(db);
  if (retention === null) {
    return NextResponse.json({ deleted: 0, retention_days: null, skipped: 'unlimited' });
  }

  // rowid IN (SELECT … LIMIT) form is portable across SQLite builds.
  const stmt = db.prepare(
    `DELETE FROM monitor_checks
       WHERE rowid IN (
         SELECT rowid FROM monitor_checks
          WHERE timestamp < strftime('%s','now') - ? * 86400
          LIMIT ?
       )`
  );
  const info = stmt.run(retention, PER_TICK_LIMIT);
  return NextResponse.json({ deleted: info.changes, retention_days: retention });
}
