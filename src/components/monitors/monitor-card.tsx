'use client'

import { Activity, Clock, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UptimeBar, generateDemoUptimeData } from './uptime-bar'
import { cn, formatDuration } from '@/lib/utils'
import type { Monitor, MonitorStatus } from '@/types'
import { useMemo } from 'react'

interface MonitorCardProps {
  monitor: Monitor
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
      return 'Opérationnel'
    case 'degraded':
      return 'Dégradé'
    case 'partial':
      return 'Panne partielle'
    case 'major':
      return 'Panne majeure'
    case 'maintenance':
      return 'Maintenance'
    default:
      return 'Inconnu'
  }
}

export function MonitorCard({ monitor, onClick, compact = false }: MonitorCardProps) {
  const uptimeData = useMemo(() => generateDemoUptimeData(90), [])

  // Calculate average uptime from demo data
  const avgUptime = useMemo(() => {
    const sum = uptimeData.reduce((acc, day) => acc + day.uptime, 0)
    return sum / uptimeData.length
  }, [uptimeData])

  // Calculate average response time from demo data
  const avgResponseTime = useMemo(() => {
    const validDays = uptimeData.filter((d) => d.responseTime)
    const sum = validDays.reduce((acc, day) => acc + (day.responseTime || 0), 0)
    return Math.round(sum / validDays.length)
  }, [uptimeData])

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
          <span className="text-xs text-muted-foreground">{avgUptime.toFixed(2)}%</span>
          <span className="text-xs font-mono">{avgResponseTime}ms</span>
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
            <span className="text-muted-foreground">90 derniers jours</span>
            <span className="font-medium">{avgUptime.toFixed(3)}% uptime</span>
          </div>
          <UptimeBar data={uptimeData} />
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
              <span className="text-xs">Intervalle</span>
            </div>
            <p className="text-sm font-medium">{monitor.interval}s</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs">Réponse</span>
            </div>
            <p className="text-sm font-medium">{avgResponseTime}ms</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
