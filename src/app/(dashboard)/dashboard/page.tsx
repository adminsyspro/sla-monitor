'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Shield,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// Charts
import { ResponseTimeChart } from '@/components/charts/response-time-chart'
import { ServiceUptimeChart } from '@/components/charts/service-uptime-chart'
import { IncidentHeatmap } from '@/components/charts/incident-heatmap'
import { AdvancedKPIs } from '@/components/charts/advanced-kpis'
import { UptimeGauge } from '@/components/charts/uptime-gauge'
import { TopIssuesCard } from '@/components/charts/top-issues'
import { ActivityTimeline, ActivityItem } from '@/components/charts/activity-timeline'
// MonitorCard no longer needed - monitors-overview uses stats API data

// Widget System
import {
  Widget,
  WidgetType,
  WidgetSize,
  WidgetWrapper,
  AddWidgetDialog,
  WidgetSettingsDialog,
  DashboardControls,
  widgetTemplates,
} from '@/components/dashboard/widget-system'

import { formatDate, cn } from '@/lib/utils'

// Default widgets configuration
// Note: 'regional-uptime' (w8) has been removed — the system always emits region: 'local'
// and does not have multi-region observability data.
const defaultWidgets: Widget[] = [
  { id: 'w1', type: 'kpi-mttr', title: 'MTTR', size: 'small', enabled: true, order: 1 },
  { id: 'w2', type: 'kpi-mttd', title: 'MTTD', size: 'small', enabled: true, order: 2 },
  { id: 'w3', type: 'incidents-active', title: 'Incidents actifs', size: 'small', enabled: true, order: 3 },
  { id: 'w4', type: 'error-budget', title: 'Budget d\'erreur', size: 'small', enabled: true, order: 4 },
  { id: 'w5', type: 'response-time', title: 'Temps de réponse', size: 'wide', enabled: true, order: 5 },
  { id: 'w6', type: 'uptime-gauge', title: 'Uptime Global', size: 'small', enabled: true, order: 6 },
  { id: 'w7', type: 'service-status', title: 'Disponibilité services', size: 'medium', enabled: true, order: 7 },
  { id: 'w8', type: 'incident-heatmap', title: 'Distribution incidents', size: 'wide', enabled: true, order: 8 },
  { id: 'w9', type: 'top-issues', title: 'Services à surveiller', size: 'medium', enabled: true, order: 9 },
  { id: 'w10', type: 'recent-activity', title: 'Activité récente', size: 'wide', enabled: true, order: 10 },
  { id: 'w11', type: 'sla-progress', title: 'Objectifs SLA', size: 'medium', enabled: true, order: 11 },
  { id: 'w12', type: 'maintenance-scheduled', title: 'Maintenances', size: 'small', enabled: true, order: 12 },
]

// Widget Content Components
function KPIWidget({ type, value, label, trend, icon: Icon, color }: {
  type: string
  value: string
  label: string
  trend?: { value: number; positive: boolean }
  icon: any
  color: string
}) {
  return (
    <div className="flex items-start justify-between h-full">
      <div className="space-y-1">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs',
            trend.positive ? 'text-green-500' : 'text-red-500'
          )}>
            <TrendingUp className={cn('h-3 w-3', !trend.positive && 'rotate-180')} />
            <span>{trend.value}% vs mois dernier</span>
          </div>
        )}
      </div>
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
}

function IncidentsWidget({ count }: { count: number }) {
  return (
    <div className="flex items-start justify-between h-full">
      <div className="space-y-1">
        <p className={cn('text-3xl font-bold', count > 0 ? 'text-yellow-500' : 'text-green-500')}>
          {count}
        </p>
        <p className="text-xs text-muted-foreground">Incidents en cours</p>
        {count > 0 && (
          <Badge variant="destructive" className="text-xs">Action requise</Badge>
        )}
      </div>
      <div className={cn('p-2 rounded-lg', count > 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500')}>
        <AlertTriangle className="h-5 w-5" />
      </div>
    </div>
  )
}

function ErrorBudgetWidget({
  used,
  remaining,
  usedMinutes,
  totalMinutes,
}: {
  used: number
  remaining: number
  usedMinutes: number
  totalMinutes: number
}) {
  const isLow = remaining < 30
  return (
    <div className="space-y-3 h-full flex flex-col justify-center">
      <div className="flex items-center justify-between">
        <span className="text-sm">Budget d'erreur</span>
        <span className={cn('font-bold', isLow ? 'text-yellow-500' : 'text-green-500')}>
          {remaining}%
        </span>
      </div>
      <Progress
        value={remaining}
        className="h-2"
        indicatorClassName={isLow ? 'bg-yellow-500' : 'bg-green-500'}
      />
      <p className="text-xs text-muted-foreground">
        {usedMinutes.toFixed(1)}min utilisées sur {totalMinutes.toFixed(0)}min
      </p>
    </div>
  )
}

function SLAProgressWidget({ uptime, target }: { uptime: number; target: number }) {
  const isMet = uptime >= target
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">Uptime actuel</span>
          <span className={cn('font-bold', isMet ? 'text-green-500' : 'text-red-500')}>
            {uptime}%
          </span>
        </div>
        <Progress
          value={uptime}
          className="h-2"
          indicatorClassName={isMet ? 'bg-green-500' : 'bg-red-500'}
        />
        <p className="text-xs text-muted-foreground">
          Objectif: {target}%
        </p>
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground text-center">
        Aucun historique mensuel pour l'instant
      </p>
    </div>
  )
}

interface DashboardStats {
  totalMonitors: number
  statusCounts: Record<string, number>
  overallUptime: number
  activeIncidents: number
  mttr: number
  errorBudgetRemaining: number
  errorBudgetTotalMinutes: number
  errorBudgetUsedMinutes: number
  checksPerMinute: number
  avgResponseTime: number
}

interface MaintenanceWindow {
  id: string
  title: string
  scheduledStart: string
  scheduledEnd: string
  status: string
}

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [nextMaintenance, setNextMaintenance] = useState<MaintenanceWindow | null | undefined>(undefined)

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, activityRes, maintRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/activity'),
        fetch('/api/maintenance?status=scheduled'),
      ])
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(Array.isArray(activityData) ? activityData : activityData.activities ?? [])
      }
      if (maintRes.ok) {
        const maintData: MaintenanceWindow[] = await maintRes.json()
        const now = new Date()
        // Pick the next upcoming scheduled maintenance window
        const upcoming = maintData
          .filter(m => new Date(m.scheduledStart) > now)
          .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
        setNextMaintenance(upcoming[0] ?? null)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Stats with fallbacks
  const activeIncidents = stats?.activeIncidents ?? 0
  const overallUptime = stats?.overallUptime ?? 99.95
  const targetUptime = 99.9

  // Get enabled widgets sorted by order
  const enabledWidgets = useMemo(() => 
    widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order),
    [widgets]
  )

  // Handlers
  const handleRefreshAll = async () => {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  const handleAddWidget = (type: WidgetType) => {
    const template = widgetTemplates.find(t => t.type === type)
    if (template) {
      const newWidget: Widget = {
        id: `w-${Date.now()}`,
        type: template.type,
        title: template.title,
        size: template.size,
        enabled: true,
        order: widgets.length + 1,
      }
      setWidgets([...widgets, newWidget])
    }
  }

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id))
  }

  const handleResizeWidget = (id: string, size: WidgetSize) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, size } : w))
  }

  const handleToggleWidget = (id: string) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w))
  }

  const handleResetLayout = () => {
    setWidgets(defaultWidgets)
  }

  // Render widget content based on type
  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'kpi-mttr':
        return (
          <KPIWidget
            type="mttr"
            value={`${stats?.mttr ?? 0} min`}
            label="Mean Time To Repair"
            icon={Timer}
            color="bg-blue-500/10 text-blue-500"
          />
        )
      case 'kpi-mttd':
        return (
          // TODO: real MTTD — requires incidents.detected_at column (not yet in schema)
          <KPIWidget
            type="mttd"
            value="—"
            label="Mean Time To Detect"
            icon={Eye}
            color="bg-purple-500/10 text-purple-500"
          />
        )
      case 'incidents-active':
        return <IncidentsWidget count={activeIncidents} />
      case 'error-budget':
        return (
          <ErrorBudgetWidget
            used={parseFloat((100 - (stats?.errorBudgetRemaining ?? 87)).toFixed(1))}
            remaining={stats?.errorBudgetRemaining ?? 87}
            usedMinutes={stats?.errorBudgetUsedMinutes ?? 0}
            totalMinutes={stats?.errorBudgetTotalMinutes ?? 43.2}
          />
        )
      case 'uptime-gauge':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <p className={cn(
              'text-4xl font-bold',
              overallUptime >= targetUptime ? 'text-green-500' : 'text-red-500'
            )}>
              {overallUptime}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">Uptime global</p>
            <Badge variant={overallUptime >= targetUptime ? 'operational' : 'destructive'} className="mt-2">
              {overallUptime >= targetUptime ? 'SLA respecté' : 'SLA non respecté'}
            </Badge>
          </div>
        )
      case 'response-time':
        return <ResponseTimeChart className="border-0 shadow-none" />
      case 'service-status':
        return <ServiceUptimeChart className="border-0 shadow-none" />
      case 'incident-heatmap':
        return <IncidentHeatmap className="border-0 shadow-none" />
      case 'top-issues':
        return <TopIssuesCard className="border-0 shadow-none" />
      case 'recent-activity':
        return <ActivityTimeline className="border-0 shadow-none" limit={5} activities={activities.length > 0 ? activities : undefined} />
      case 'sla-progress':
        return <SLAProgressWidget uptime={overallUptime} target={targetUptime} />
      case 'monitors-overview':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total monitors</span>
              <span className="text-2xl font-bold">{stats?.totalMonitors ?? 0}</span>
            </div>
            <div className="space-y-2">
              {stats?.statusCounts && Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      status === 'operational' ? 'bg-green-500' :
                      status === 'degraded' ? 'bg-yellow-500' :
                      status === 'down' ? 'bg-red-500' : 'bg-gray-500'
                    )} />
                    <span className="capitalize">{status}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )
      case 'maintenance-scheduled':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Prochaine maintenance</span>
            </div>
            {nextMaintenance === undefined ? (
              <p className="text-xs text-muted-foreground">Chargement…</p>
            ) : nextMaintenance === null ? (
              <p className="text-xs text-muted-foreground">Aucune maintenance planifiée</p>
            ) : (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="font-medium text-sm">{nextMaintenance.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(nextMaintenance.scheduledStart)}
                </p>
              </div>
            )}
          </div>
        )
      default:
        return <p className="text-muted-foreground">Widget non configuré</p>
    }
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge
              variant={activeIncidents > 0 ? 'destructive' : 'operational'}
              className="gap-1"
            >
              {activeIncidents > 0 ? (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  {activeIncidents} incident{activeIncidents > 1 ? 's' : ''} actif{activeIncidents > 1 ? 's' : ''}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Tous systèmes opérationnels
                </>
              )}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Dernière mise à jour: {formatDate(new Date().toISOString())}
            </span>
          </div>
          
          <DashboardControls
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
            onAddWidget={() => setIsAddWidgetOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRefreshAll={handleRefreshAll}
          />
        </div>

        {/* Edit Mode Banner */}
        {isEditMode && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="font-medium">Mode édition activé</span>
                <span className="text-sm text-muted-foreground">
                  — Glissez les widgets pour les réorganiser
                </span>
              </div>
              <Button size="sm" onClick={() => setIsEditMode(false)}>
                Terminer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </Card>
            ))}
          </div>
        )}

        {/* Widget Grid */}
        {!loading && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-min">
          {enabledWidgets.map((widget) => (
            <WidgetWrapper
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              onRemove={() => handleRemoveWidget(widget.id)}
              onResize={(size) => handleResizeWidget(widget.id, size)}
              onRefresh={handleRefreshAll}
            >
              {renderWidgetContent(widget)}
            </WidgetWrapper>
          ))}
        </div>
        )}

        {/* Empty state */}
        {enabledWidgets.length === 0 && (
          <Card className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Aucun widget actif</h3>
            <p className="mt-2 text-muted-foreground">
              Ajoutez des widgets pour personnaliser votre dashboard
            </p>
            <Button className="mt-4" onClick={() => setIsAddWidgetOpen(true)}>
              Ajouter un widget
            </Button>
          </Card>
        )}

        {/* Dialogs */}
        <AddWidgetDialog
          open={isAddWidgetOpen}
          onOpenChange={setIsAddWidgetOpen}
          onAddWidget={handleAddWidget}
          existingWidgets={widgets}
        />

        <WidgetSettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          widgets={widgets}
          onToggleWidget={handleToggleWidget}
          onResetLayout={handleResetLayout}
        />
      </main>
    </>
  )
}
