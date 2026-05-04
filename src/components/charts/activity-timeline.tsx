'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings,
  Wrench,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

export interface ActivityItem {
  id: string
  type: 'incident_created' | 'incident_resolved' | 'monitor_added' | 'monitor_paused' | 'maintenance_started' | 'maintenance_ended' | 'config_changed'
  title: string
  description?: string
  timestamp: string
  user?: string
}

const recentActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'incident_resolved',
    title: 'Incident résolu',
    description: 'Latence élevée sur le service de paiement',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    user: 'System',
  },
  {
    id: '2',
    type: 'monitor_added',
    title: 'Monitor ajouté',
    description: 'API Notifications v2',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    user: 'Admin',
  },
  {
    id: '3',
    type: 'maintenance_started',
    title: 'Maintenance démarrée',
    description: 'Mise à jour base de données',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    user: 'Admin',
  },
  {
    id: '4',
    type: 'incident_created',
    title: 'Incident détecté',
    description: 'Timeout sur CDN Amérique',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    user: 'System',
  },
  {
    id: '5',
    type: 'config_changed',
    title: 'Configuration modifiée',
    description: 'Seuil d\'alerte ajusté pour API Search',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    user: 'Admin',
  },
  {
    id: '6',
    type: 'maintenance_ended',
    title: 'Maintenance terminée',
    description: 'Migration serveur auth',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    user: 'System',
  },
]

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'incident_created':
      return { icon: AlertTriangle, color: 'text-red-500 bg-red-500/10' }
    case 'incident_resolved':
      return { icon: CheckCircle2, color: 'text-green-500 bg-green-500/10' }
    case 'monitor_added':
      return { icon: Plus, color: 'text-blue-500 bg-blue-500/10' }
    case 'monitor_paused':
      return { icon: PauseCircle, color: 'text-yellow-500 bg-yellow-500/10' }
    case 'maintenance_started':
      return { icon: Wrench, color: 'text-orange-500 bg-orange-500/10' }
    case 'maintenance_ended':
      return { icon: PlayCircle, color: 'text-green-500 bg-green-500/10' }
    case 'config_changed':
      return { icon: Settings, color: 'text-purple-500 bg-purple-500/10' }
    default:
      return { icon: Activity, color: 'text-gray-500 bg-gray-500/10' }
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export interface ActivityTimelineProps {
  className?: string
  limit?: number
  activities?: ActivityItem[]
}

export function ActivityTimeline({ className, limit = 6, activities }: ActivityTimelineProps) {
  const data = activities ?? recentActivity
  const displayedActivity = data.slice(0, limit)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Activité récente</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            Voir tout
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {displayedActivity.map((activity, index) => {
              const { icon: Icon, color } = getActivityIcon(activity.type)

              return (
                <div key={activity.id} className="relative flex gap-4 pl-0">
                  {/* Icon */}
                  <div
                    className={cn(
                      'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>
                    {activity.user && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {activity.user}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact activity feed for sidebar
export function ActivityFeedCompact({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentActivity.slice(0, 4).map((activity) => {
          const { icon: Icon, color } = getActivityIcon(activity.type)

          return (
            <div
              key={activity.id}
              className="flex items-center gap-2 text-xs"
            >
              <div className={cn('p-1 rounded', color)}>
                <Icon className="h-3 w-3" />
              </div>
              <span className="flex-1 truncate">{activity.description || activity.title}</span>
              <span className="text-muted-foreground">
                {formatRelativeTime(activity.timestamp)}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
