'use client'

import { AlertTriangle, ArrowRight, TrendingDown, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ServiceIssue {
  id: string
  name: string
  uptime: number
  responseTime: number
  trend: 'up' | 'down' | 'stable'
  issues: string[]
}

const worstServices: ServiceIssue[] = [
  {
    id: '1',
    name: 'Service de paiement',
    uptime: 99.85,
    responseTime: 342,
    trend: 'down',
    issues: ['Latence élevée', 'Timeouts intermittents'],
  },
  {
    id: '2',
    name: 'API Recherche',
    uptime: 99.91,
    responseTime: 287,
    trend: 'down',
    issues: ['Charge CPU élevée'],
  },
  {
    id: '3',
    name: 'Service Email',
    uptime: 99.88,
    responseTime: 198,
    trend: 'stable',
    issues: ['Queue de messages saturée'],
  },
  {
    id: '4',
    name: 'Auth Service',
    uptime: 99.92,
    responseTime: 156,
    trend: 'up',
    issues: ['Pic de connexions'],
  },
  {
    id: '5',
    name: 'CDN Europe',
    uptime: 99.89,
    responseTime: 89,
    trend: 'stable',
    issues: ['Cache miss rate élevé'],
  },
]

interface TopIssuesCardProps {
  className?: string
}

export function TopIssuesCard({ className }: TopIssuesCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Services à surveiller
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            Voir tout
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {worstServices.map((service, index) => (
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
                  {service.trend === 'down' && (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {service.issues.slice(0, 2).map((issue, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {issue}
                    </Badge>
                  ))}
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
                  {service.responseTime}ms
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar
export function TopIssuesCompact({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top 3 à surveiller</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {worstServices.slice(0, 3).map((service, index) => (
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
        ))}
      </CardContent>
    </Card>
  )
}
