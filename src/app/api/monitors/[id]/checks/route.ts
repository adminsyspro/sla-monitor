import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { paginationParams, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

interface CheckRow {
  id: string;
  monitor_id: string;
  timestamp: number;
  status: string;
  response_time: number | null;
  status_code: number | null;
  error: string | null;
  region: string | null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();

  const monitor = db.prepare('SELECT id FROM monitors WHERE id = ?').get(id);
  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const url = request.nextUrl;
  const period = url.searchParams.get('period') || '24h';

  const periodMap: Record<string, number> = {
    '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000,
  };
  const seconds = periodMap[period] || 86400;
  const since = Math.floor(Date.now() / 1000) - seconds;

  const { limit, offset } = paginationParams(request);

  const rows = db.prepare(
    `SELECT * FROM monitor_checks WHERE monitor_id = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ).all(id, since, limit, offset) as CheckRow[];

  const total = db.prepare(
    `SELECT COUNT(*) as cnt FROM monitor_checks WHERE monitor_id = ? AND timestamp >= ?`
  ).get(id, since) as { cnt: number };

  return NextResponse.json({
    data: rows.map(r => ({
      id: r.id,
      monitorId: r.monitor_id,
      timestamp: fromEpoch(r.timestamp),
      status: r.status,
      responseTime: r.response_time,
      statusCode: r.status_code,
      error: r.error,
      region: r.region,
    })),
    total: total.cnt,
  });
}
