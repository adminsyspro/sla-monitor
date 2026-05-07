'use client'

import { Activity, Clock, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UptimeBar } from './uptime-bar'
import { LatencySparkline, type LatencyPoint } from './latency-sparkline'
import { cn } from '@/lib/utils'
import type { Monitor, MonitorStatus } from '@/types'
import { useEffect, useState } from 'react'
import { type WindowPreset, windowToDays } from '@/lib/window'

interface UptimeDay {
  date: string
  status: MonitorStatus
  uptime: number
  responseTime?: number
}

interface UptimeApiResponse {
  uptime: number
  avgResponseTime: number
  dailyData: Array<{
    date: string
    status: string
    uptime: number
    avgResponseTime: number
  }>
  hourlyTrend: LatencyPoint[]
}

interface MonitorCardProps {
  monitor: Monitor
  window: WindowPreset
  onClick?: () => void
  compact?: boolean
}

function getStatusVariant(status: MonitorStatus) {
  switch (status) {
    case 'operational':
      return 'operational'
    case 'degraded':
      return 'degraded'
    case 'partial':
      return 'partial'
    case 'major':
      return 'major'
    case 'maintenance':
      return 'maintenance'
    default:
      return 'secondary'
  }
}

function getStatusLabel(status: MonitorStatus): string {
  switch (status) {
    case 'operational':
      return 'Operational'
    case 'degraded':
      return 'Degraded'
    case 'partial':
      return 'Partial outage'
    case 'major':
      return 'Major outage'
    case 'maintenance':
      return 'Maintenance'
    default:
      return 'Unknown'
  }
}

export function MonitorCard({ monitor, window, onClick, compact = false }: MonitorCardProps) {
  const [uptimeData, setUptimeData] = useState<UptimeDay[]>([])
  const [sparklinePoints, setSparklinePoints] = useState<LatencyPoint[]>([])
  const [avgUptime, setAvgUptime] = useState<number | null>(null)
  const [avgResponseTime, setAvgResponseTime] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/monitors/${monitor.id}/uptime?period=${window}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: UptimeApiResponse) => {
        if (cancelled) return
        setUptimeData(
          body.dailyData.map((d) => ({
            date: d.date,
            status: d.status as MonitorStatus,
            uptime: d.uptime,
            responseTime: d.avgResponseTime || undefined,
          }))
        )
        setSparklinePoints(body.hourlyTrend ?? [])
        setAvgUptime(body.uptime)
        setAvgResponseTime(body.avgResponseTime || 0)
      })
      .catch(() => {
        if (cancelled) return
        setUptimeData([])
        setSparklinePoints([])
        setAvgUptime(null)
        setAvgResponseTime(null)
      })
    return () => {
      cancelled = true
    }
  }, [monitor.id, window])

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border bg-card cursor-pointer transition-all hover:bg-muted/50',
          onClick && 'hover:border-primary/50'
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              monitor.status === 'operational'
                ? 'bg-status-operational'
                : monitor.status === 'degraded'
                ? 'bg-status-degraded'
                : monitor.status === 'major'
                ? 'bg-status-major'
                : 'bg-status-maintenance',
              monitor.status !== 'operational' && 'animate-pulse'
            )}
          />
          <span className="font-medium text-sm truncate">{monitor.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {avgUptime !== null ? `${avgUptime.toFixed(2)}%` : '—'}
          </span>
          <span className="text-xs font-mono">
            {avgResponseTime !== null && avgResponseTime > 0 ? `${avgResponseTime}ms` : '—'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        onClick && 'hover:border-primary/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  monitor.status === 'operational'
                    ? 'bg-status-operational'
                    : monitor.status === 'degraded'
                    ? 'bg-status-degraded'
                    : monitor.status === 'major'
                    ? 'bg-status-major'
                    : 'bg-status-maintenance',
                  monitor.status !== 'operational' && 'animate-pulse'
                )}
              />
              <h3 className="font-semibold">{monitor.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{monitor.url}</p>
          </div>
          <Badge variant={getStatusVariant(monitor.status) as any}>
            {getStatusLabel(monitor.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Uptime Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last {window}</span>
            <span className="font-medium">
              {avgUptime !== null ? `${avgUptime.toFixed(3)}% uptime` : 'No data'}
            </span>
          </div>
          <UptimeBar data={uptimeData} days={windowToDays(window)} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs">Type</span>
            </div>
            <p className="text-sm font-medium uppercase">{monitor.type}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">Interval</span>
            </div>
            <p className="text-sm font-medium">{monitor.interval}s</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs">Response</span>
            </div>
            <p className="text-sm font-medium">
              {avgResponseTime !== null && avgResponseTime > 0 ? `${avgResponseTime}ms` : '—'}
            </p>
          </div>
        </div>

        {/* Latency trend (60h) */}
        {sparklinePoints.filter((p) => p.ms != null && p.ms > 0).length >= 2 && (
          <div className="space-y-1 pt-1">
            <span className="text-xs text-muted-foreground">Latency · 60h</span>
            <LatencySparkline data={sparklinePoints} responsive height={40} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
