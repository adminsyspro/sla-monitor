'use client'

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { MonitorStatus } from '@/types'

interface UptimeDay {
  date: string
  status: MonitorStatus
  uptime: number
  responseTime?: number
}

interface UptimeBarProps {
  data: UptimeDay[]
  className?: string
  days?: number
}

function getStatusColor(status: MonitorStatus): string {
  switch (status) {
    case 'operational':
      return 'bg-status-operational'
    case 'degraded':
      return 'bg-status-degraded'
    case 'partial':
      return 'bg-status-partial'
    case 'major':
      return 'bg-status-major'
    case 'maintenance':
      return 'bg-status-maintenance'
    default:
      return 'bg-muted'
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
      return 'No data'
  }
}

export function UptimeBar({ data, className, days = 90 }: UptimeBarProps) {
  const isDense = days > 180

  // Ensure we have `days` days of data
  const normalizedData = useMemo(() => {
    const result: UptimeDay[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const existing = data.find((d) => d.date === dateStr)
      result.push(
        existing || {
          date: dateStr,
          status: 'unknown' as MonitorStatus,
          uptime: 0,
        }
      )
    }

    return result
  }, [data, days])

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn('uptime-bar', isDense && 'uptime-bar-dense', className)}>
        {normalizedData.map((day, index) => (
          <Tooltip key={day.date}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'uptime-bar-segment cursor-pointer',
                  getStatusColor(day.status)
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <p className="font-medium">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className={cn('font-semibold', day.uptime >= 99.9 ? 'text-green-500' : day.uptime >= 99 ? 'text-yellow-500' : 'text-red-500')}>
                  {day.uptime > 0 ? `${day.uptime.toFixed(2)}%` : 'N/A'}
                </p>
                <p className="text-muted-foreground">{getStatusLabel(day.status)}</p>
                {day.responseTime && (
                  <p className="text-muted-foreground">{day.responseTime}ms</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
