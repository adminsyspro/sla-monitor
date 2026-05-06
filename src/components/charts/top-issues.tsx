'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ArrowRight, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ServiceIssue {
  id: string
  name: string
  uptime: number
  avgResponseTime: number
  // trend is not yet computed month-over-month; set to 'stable' for all entries
  trend: 'up' | 'down' | 'stable'
  lastErrors: string[]
  failuresCount: number
}

interface TopIssuesCardProps {
  className?: string
}

export function TopIssuesCard({ className }: TopIssuesCardProps) {
  const [issues, setIssues] = useState<ServiceIssue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/top-issues?limit=5')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.issues) {
          // Map API response to component shape.
          // trend is not yet computed month-over-month; default to 'stable'.
          const mapped: ServiceIssue[] = data.issues.map((item: any) => ({
            id: item.id,
            name: item.name,
            uptime: item.uptime,
            avgResponseTime: item.avgResponseTime,
            trend: 'stable' as const,
            lastErrors: item.lastErrors ?? [],
            failuresCount: item.failuresCount,
          }))
          setIssues(mapped)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Services to Watch
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            View all
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : issues.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-muted-foreground text-center">No services to watch</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((service, index) => (
              <div
                key={service.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50',
                  index === 0 && 'bg-red-500/5 border border-red-500/20'
                )}
              >
                {/* Rank */}
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                    index === 0
                      ? 'bg-red-500 text-white'
                      : index < 3
                      ? 'bg-yellow-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>

                {/* Service Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {service.lastErrors.slice(0, 2).map((err, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {err}
                      </Badge>
                    ))}
                    {service.lastErrors.length === 0 && service.failuresCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {service.failuresCount} failure{service.failuresCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="text-right space-y-1">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      service.uptime < 99.9 ? 'text-red-500' : 'text-yellow-500'
                    )}
                  >
                    {service.uptime.toFixed(2)}%
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {service.avgResponseTime ? `${service.avgResponseTime}ms` : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar — also fetches real data
export function TopIssuesCompact({ className }: { className?: string }) {
  const [issues, setIssues] = useState<ServiceIssue[]>([])

  useEffect(() => {
    fetch('/api/dashboard/top-issues?limit=3')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.issues) {
          setIssues(data.issues.map((item: any) => ({
            id: item.id,
            name: item.name,
            uptime: item.uptime,
            avgResponseTime: item.avgResponseTime,
            trend: 'stable' as const,
            lastErrors: item.lastErrors ?? [],
            failuresCount: item.failuresCount,
          })))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top 3 to Watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data</p>
        ) : (
          issues.slice(0, 3).map((service, index) => (
            <div
              key={service.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    index === 0 ? 'bg-red-500' : 'bg-yellow-500'
                  )}
                />
                <span className="truncate max-w-[120px]">{service.name}</span>
              </div>
              <span
                className={cn(
                  'font-medium',
                  service.uptime < 99.9 ? 'text-red-500' : 'text-yellow-500'
                )}
              >
                {service.uptime.toFixed(2)}%
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
