import type Database from 'better-sqlite3'

export interface TrendPoint {
  date: string
  ms: number | null
}

const BUCKET_SECONDS = 60
const TREND_BUCKETS = 60

/**
 * 60 one-minute latency buckets covering the last hour.
 * Buckets without any check are returned with `ms: null` so consumers can
 * render real gaps rather than zero-dips.
 */
export function computeLatencyTrend(
  db: Database.Database,
  monitorId: string
): TrendPoint[] {
  const nowSec = Math.floor(Date.now() / 1000)
  const nowBucket = Math.floor(nowSec / BUCKET_SECONDS) * BUCKET_SECONDS
  const since = nowBucket - (TREND_BUCKETS - 1) * BUCKET_SECONDS

  const rows = db.prepare(`
    SELECT
      (timestamp / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS} AS bucket_ts,
      ROUND(AVG(response_time), 0) AS avg_ms
    FROM monitor_checks
    WHERE monitor_id = ? AND timestamp >= ?
    GROUP BY bucket_ts
    ORDER BY bucket_ts ASC
  `).all(monitorId, since) as Array<{ bucket_ts: number; avg_ms: number | null }>

  const map = new Map(rows.map((r) => [r.bucket_ts, r.avg_ms]))
  return Array.from({ length: TREND_BUCKETS }, (_, i) => {
    const ts = nowBucket - (TREND_BUCKETS - 1 - i) * BUCKET_SECONDS
    const ms = map.get(ts)
    return {
      date: new Date(ts * 1000).toISOString(),
      ms: ms == null ? null : ms,
    }
  })
}
