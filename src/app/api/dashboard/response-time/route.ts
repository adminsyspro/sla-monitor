import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Period = '1h' | '6h' | '24h' | '7d' | '30d';

interface BucketConfig {
  bucketSeconds: number;
  bucketCount: number;
  labelFormat: 'time' | 'datetime';
}

function getBucketConfig(period: Period): BucketConfig {
  switch (period) {
    case '1h':   return { bucketSeconds: 60,        bucketCount: 60,  labelFormat: 'time' };
    case '6h':   return { bucketSeconds: 300,       bucketCount: 72,  labelFormat: 'time' };
    case '24h':  return { bucketSeconds: 1800,      bucketCount: 48,  labelFormat: 'time' };
    case '7d':   return { bucketSeconds: 14400,     bucketCount: 42,  labelFormat: 'datetime' };
    case '30d':  return { bucketSeconds: 86400,     bucketCount: 30,  labelFormat: 'datetime' };
    default:     return { bucketSeconds: 1800,      bucketCount: 48,  labelFormat: 'time' };
  }
}

function periodSeconds(period: Period): number {
  switch (period) {
    case '1h':  return 3600;
    case '6h':  return 21600;
    case '24h': return 86400;
    case '7d':  return 604800;
    case '30d': return 2592000;
    default:    return 86400;
  }
}

function formatLabel(ts: number, format: 'time' | 'datetime'): string {
  const d = new Date(ts * 1000);
  if (format === 'time') {
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const h = d.getUTCHours().toString().padStart(2, '0');
  return `${day}/${month} ${h}h`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPeriod = searchParams.get('period') ?? '24h';
  const period = (['1h', '6h', '24h', '7d', '30d'].includes(rawPeriod) ? rawPeriod : '24h') as Period;

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - periodSeconds(period);
  const { bucketSeconds, bucketCount, labelFormat } = getBucketConfig(period);

  // Build bucket start times (oldest to newest)
  const bucketStarts: number[] = [];
  const firstBucket = Math.floor(since / bucketSeconds) * bucketSeconds;
  for (let i = 0; i < bucketCount; i++) {
    bucketStarts.push(firstBucket + i * bucketSeconds);
  }

  // Query: per-bucket average response time.
  // Use CAST(... AS INTEGER) to force integer (floor) division when bucket size is
  // passed as a parameter — SQLite otherwise treats bound parameters as REAL.
  const rows = db.prepare(`
    SELECT
      CAST(timestamp / ? AS INTEGER) * ? AS bucket_ts,
      ROUND(AVG(response_time), 0) AS avg_rt
    FROM monitor_checks
    WHERE timestamp >= ? AND response_time IS NOT NULL
    GROUP BY bucket_ts
    ORDER BY bucket_ts ASC
  `).all(bucketSeconds, bucketSeconds, since) as Array<{ bucket_ts: number; avg_rt: number }>;

  const rowMap = new Map<number, number>();
  for (const r of rows) {
    rowMap.set(r.bucket_ts, r.avg_rt);
  }

  // Global stats for p95/p99 (whole period)
  const allRows = db.prepare(`
    SELECT response_time FROM monitor_checks
    WHERE timestamp >= ? AND response_time IS NOT NULL
    ORDER BY response_time ASC
  `).all(since) as Array<{ response_time: number }>;

  let globalAvg = 0, globalMin = 0, globalMax = 0, globalP95 = 0, globalP99 = 0;
  if (allRows.length > 0) {
    const times = allRows.map(r => r.response_time);
    globalMin = times[0];
    globalMax = times[times.length - 1];
    globalAvg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    globalP95 = times[Math.min(Math.floor(times.length * 0.95), times.length - 1)];
    globalP99 = times[Math.min(Math.floor(times.length * 0.99), times.length - 1)];
  }

  const buckets = bucketStarts.map(ts => ({
    ts,
    label: formatLabel(ts, labelFormat),
    avg: rowMap.get(ts) ?? null,
    p95: globalP95 || null,
    p99: globalP99 || null,
  }));

  return NextResponse.json({
    period,
    buckets,
    stats: { avg: globalAvg, min: globalMin, max: globalMax, p95: globalP95, p99: globalP99 },
  });
}
