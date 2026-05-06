'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Settings,
  Table2,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SLATarget {
  id: string
  name: string
  monitorIds: string[]
  targetUptime: number
  period: 'monthly' | 'quarterly' | 'yearly'
  excludeMaintenanceWindows: boolean
}

interface SLAMetrics {
  targetId: string
  currentUptime: number
  targetUptime: number
  isMet: boolean
  downtimeMinutes: number
  allowedDowntimeMinutes: number
  errorBudgetUsed: number
  errorBudgetRemaining: number
  trend: 'up' | 'down' | 'stable'
  status: 'healthy' | 'warning' | 'critical'
}

interface SLATargetWithMetrics extends SLATarget {
  description?: string
  currentUptime: number
  errorBudgetUsed: number
  errorBudgetRemaining: number
  downtimeMinutes: number
  allowedDowntimeMinutes: number
  trend: 'up' | 'down' | 'stable'
  status: 'healthy' | 'warning' | 'critical'
}

interface Monitor {
  id: string
  name: string
  url: string
  type: string
  status: string
}

interface TargetFormState {
  name: string
  description: string
  targetUptime: number
  period: 'monthly' | 'quarterly' | 'yearly'
  monitorIds: string[]
  excludeMaintenanceWindows: boolean
}

type ViewMode = 'cards' | 'table'

const defaultTargetForm: TargetFormState = {
  name: '',
  description: '',
  targetUptime: 99.9,
  period: 'monthly',
  monitorIds: [],
  excludeMaintenanceWindows: true,
}

function targetToForm(target: SLATargetWithMetrics): TargetFormState {
  return {
    name: target.name,
    description: target.description ?? '',
    targetUptime: target.targetUptime,
    period: target.period,
    monitorIds: target.monitorIds,
    excludeMaintenanceWindows: target.excludeMaintenanceWindows,
  }
}

function getStatusConfig(status: SLATargetWithMetrics['status']) {
  switch (status) {
    case 'healthy':
      return { label: 'Compliant', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/50' }
    case 'warning':
      return { label: 'At risk', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50' }
    case 'critical':
      return { label: 'Non-compliant', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/50' }
  }
}

function getPeriodLabel(period: string) {
  switch (period) {
    case 'monthly': return 'Monthly'
    case 'quarterly': return 'Quarterly'
    case 'yearly': return 'Yearly'
    default: return period
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes.toFixed(1)}min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours < 24) return `${hours}h ${mins}min`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export default function SLATargetsPage() {
  const [slaTargets, setSlaTargets] = useState<SLATargetWithMetrics[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<SLATargetWithMetrics | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Form state
  const [newTarget, setNewTarget] = useState<TargetFormState>(defaultTargetForm)
  const [editTarget, setEditTarget] = useState<TargetFormState>(defaultTargetForm)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [targetsRes, monitorsRes] = await Promise.all([
        fetch('/api/sla-targets'),
        fetch('/api/monitors'),
      ])
      const targets: SLATarget[] = await targetsRes.json()
      const monitorsData: Monitor[] = await monitorsRes.json()
      setMonitors(monitorsData)

      // Fetch metrics for each target
      const metricsResults = await Promise.all(
        targets.map(async (t) => {
          try {
            const res = await fetch(`/api/sla-targets/${t.id}/metrics`)
            const metrics: SLAMetrics = await res.json()
            return {
              ...t,
              currentUptime: metrics.currentUptime,
              errorBudgetUsed: metrics.errorBudgetUsed,
              errorBudgetRemaining: metrics.errorBudgetRemaining,
              downtimeMinutes: metrics.downtimeMinutes,
              allowedDowntimeMinutes: metrics.allowedDowntimeMinutes,
              trend: metrics.trend,
              status: metrics.status,
            } as SLATargetWithMetrics
          } catch {
            return {
              ...t,
              currentUptime: 0,
              errorBudgetUsed: 0,
              errorBudgetRemaining: 100,
              downtimeMinutes: 0,
              allowedDowntimeMinutes: 0,
              trend: 'stable' as const,
              status: 'healthy' as const,
            } as SLATargetWithMetrics
          }
        })
      )
      setSlaTargets(metricsResults)
    } catch (err) {
      console.error('Failed to fetch SLA targets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Stats
  const stats = useMemo(() => {
    const healthy = slaTargets.filter(t => t.status === 'healthy').length
    const warning = slaTargets.filter(t => t.status === 'warning').length
    const critical = slaTargets.filter(t => t.status === 'critical').length
    const avgUptime = slaTargets.length > 0
      ? slaTargets.reduce((acc, t) => acc + t.currentUptime, 0) / slaTargets.length
      : 0
    return { healthy, warning, critical, avgUptime, total: slaTargets.length }
  }, [slaTargets])

  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize, viewMode])

  const totalPages = Math.max(1, Math.ceil(slaTargets.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedTargets = slaTargets.slice(startIndex, startIndex + pageSize)
  const visibleStart = slaTargets.length === 0 ? 0 : startIndex + 1
  const visibleEnd = Math.min(startIndex + pageSize, slaTargets.length)

  const getMonitorName = (id: string) => monitors.find(m => m.id === id)?.name || `Monitor ${id}`

  const handleCreateTarget = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/sla-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTarget.name,
          monitorIds: newTarget.monitorIds,
          targetUptime: newTarget.targetUptime,
          period: newTarget.period,
          excludeMaintenanceWindows: newTarget.excludeMaintenanceWindows,
        }),
      })
      if (!res.ok) throw new Error('Failed to create SLA target')
      setIsCreateDialogOpen(false)
      setNewTarget(defaultTargetForm)
      await fetchData()
    } catch (err) {
      console.error('Failed to create SLA target:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEditTarget = async (target: SLATargetWithMetrics) => {
    try {
      setSaving(true)
      setEditError('')
      const res = await fetch(`/api/sla-targets/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: target.name,
          monitorIds: target.monitorIds,
          targetUptime: target.targetUptime,
          period: target.period,
          excludeMaintenanceWindows: target.excludeMaintenanceWindows,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setEditError(data?.error || 'Failed to update SLA target')
        return
      }
      setIsEditDialogOpen(false)
      setSelectedTarget(null)
      await fetchData()
    } catch (err) {
      console.error('Failed to update SLA target:', err)
      setEditError('Failed to update SLA target')
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = (target: SLATargetWithMetrics) => {
    setSelectedTarget(target)
    setEditTarget(targetToForm(target))
    setEditError('')
    setIsEditDialogOpen(true)
  }

  const handleDeleteTarget = async (id: string) => {
    try {
      const res = await fetch(`/api/sla-targets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete SLA target')
      await fetchData()
    } catch (err) {
      console.error('Failed to delete SLA target:', err)
    }
  }

  const renderTargetActions = (target: SLATargetWithMetrics) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEditDialog(target)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="h-4 w-4 mr-2" />
          Configure alerts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTarget(target.id)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <TooltipProvider>
      <Header title="SLA Targets" />
      <main className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total targets</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Target className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compliant</p>
                  <p className="text-2xl font-bold text-green-500">{stats.healthy}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className={stats.warning > 0 ? "border-yellow-500/30" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">At risk</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className={stats.critical > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Non-compliant</p>
                  <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
                </div>
                <X className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Configured Targets</h2>
            <p className="text-sm text-muted-foreground">
              Manage your service level commitments
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border p-1">
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1 px-2"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1 px-2"
                onClick={() => setViewMode('table')}
              >
                <Table2 className="h-3.5 w-3.5" />
                Table
              </Button>
            </div>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New target
            </Button>
          </div>
        </div>

        {/* SLA Targets List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading SLA targets...</div>
          </div>
        ) : slaTargets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No SLA targets configured</p>
            <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create a target
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'cards' ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {paginatedTargets.map((target) => {
                  const statusConfig = getStatusConfig(target.status)
                  const isOverBudget = target.errorBudgetRemaining < 0

                  return (
                    <Card
                      key={target.id}
                      className={cn(
                        'transition-all hover:shadow-md',
                        target.status === 'critical' && 'border-red-500/50 bg-red-500/5',
                        target.status === 'warning' && 'border-yellow-500/50',
                      )}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{target.name}</CardTitle>
                              {target.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                              {target.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                            </div>
                            {target.description && (
                              <CardDescription>{target.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn(statusConfig.bg, statusConfig.color, 'border-0')}>
                              {statusConfig.label}
                            </Badge>
                            {renderTargetActions(target)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Current uptime</span>
                              <span className={cn(
                                'font-bold',
                                target.currentUptime >= target.targetUptime ? 'text-green-500' : 'text-red-500'
                              )}>
                                {target.currentUptime.toFixed(3)}%
                              </span>
                            </div>
                            <Progress
                              value={target.currentUptime}
                              className="h-2"
                              indicatorClassName={
                                target.currentUptime >= target.targetUptime ? 'bg-green-500' : 'bg-red-500'
                              }
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Target: {target.targetUptime}%</span>
                              <span>
                                {target.currentUptime >= target.targetUptime ? '+' : ''}
                                {(target.currentUptime - target.targetUptime).toFixed(3)}%
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Error budget</span>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Allowed downtime</p>
                                    <p>to stay within the SLA</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <span className={cn(
                                'font-bold',
                                isOverBudget ? 'text-red-500' : target.errorBudgetRemaining < 20 ? 'text-yellow-500' : 'text-green-500'
                              )}>
                                {isOverBudget ? 'Exceeded' : `${target.errorBudgetRemaining.toFixed(0)}%`}
                              </span>
                            </div>
                            <Progress
                              value={Math.max(0, target.errorBudgetRemaining)}
                              className="h-2"
                              indicatorClassName={
                                isOverBudget ? 'bg-red-500' : target.errorBudgetRemaining < 20 ? 'bg-yellow-500' : 'bg-green-500'
                              }
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Used: {formatMinutes(target.downtimeMinutes)}</span>
                              <span>Allowed: {formatMinutes(target.allowedDowntimeMinutes)}</span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {getPeriodLabel(target.period)}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {target.excludeMaintenanceWindows ? 'Maintenance excluded' : 'Maintenance included'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {target.monitorIds.length} monitored service{target.monitorIds.length > 1 ? 's' : ''}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {target.monitorIds.slice(0, 4).map((id) => (
                              <Badge key={id} variant="secondary">{getMonitorName(id)}</Badge>
                            ))}
                            {target.monitorIds.length > 4 && (
                              <Badge variant="outline">+{target.monitorIds.length - 4}</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Target</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Current uptime</th>
                          <th className="px-4 py-3 font-medium">SLA target</th>
                          <th className="px-4 py-3 font-medium">Error budget</th>
                          <th className="px-4 py-3 font-medium">Downtime</th>
                          <th className="px-4 py-3 font-medium">Period</th>
                          <th className="px-4 py-3 font-medium">Services</th>
                          <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTargets.map((target) => {
                          const statusConfig = getStatusConfig(target.status)
                          const isOverBudget = target.errorBudgetRemaining < 0

                          return (
                            <tr key={target.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="max-w-[240px] px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{target.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {target.excludeMaintenanceWindows ? 'Maintenance excluded' : 'Maintenance included'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={cn(statusConfig.bg, statusConfig.color, 'border-0')}>
                                  {statusConfig.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    'font-medium',
                                    target.currentUptime >= target.targetUptime ? 'text-green-500' : 'text-red-500'
                                  )}>
                                    {target.currentUptime.toFixed(3)}%
                                  </span>
                                  {target.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                                  {target.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{target.targetUptime}%</td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  'font-medium',
                                  isOverBudget ? 'text-red-500' : target.errorBudgetRemaining < 20 ? 'text-yellow-500' : 'text-green-500'
                                )}>
                                  {isOverBudget ? 'Exceeded' : `${target.errorBudgetRemaining.toFixed(0)}% left`}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {formatMinutes(target.downtimeMinutes)} / {formatMinutes(target.allowedDowntimeMinutes)}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{getPeriodLabel(target.period)}</td>
                              <td className="max-w-[220px] px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {target.monitorIds.slice(0, 2).map((id) => (
                                    <Badge key={id} variant="secondary" className="text-xs">{getMonitorName(id)}</Badge>
                                  ))}
                                  {target.monitorIds.length > 2 && (
                                    <Badge variant="outline" className="text-xs">+{target.monitorIds.length - 2}</Badge>
                                  )}
                                  {target.monitorIds.length === 0 && (
                                    <span className="text-muted-foreground">None</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end">{renderTargetActions(target)}</div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {visibleStart}-{visibleEnd} of {slaTargets.length} targets
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="min-w-24 text-center">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create an SLA target</DialogTitle>
              <DialogDescription>
                Define a new service level commitment for your monitors.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Target name</Label>
                <Input
                  placeholder="Example: Critical Production SLA"
                  value={newTarget.name}
                  onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Description of this SLA target"
                  value={newTarget.description}
                  onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Uptime target (%)</Label>
                  <Select
                    value={String(newTarget.targetUptime)}
                    onValueChange={(v) => setNewTarget({ ...newTarget, targetUptime: parseFloat(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="99">99.0% (~7h 18min/month)</SelectItem>
                      <SelectItem value="99.5">99.5% (~3h 39min/month)</SelectItem>
                      <SelectItem value="99.9">99.9% (~43min/month)</SelectItem>
                      <SelectItem value="99.95">99.95% (~22min/month)</SelectItem>
                      <SelectItem value="99.99">99.99% (~4min/month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={newTarget.period}
                    onValueChange={(v) => setNewTarget({ ...newTarget, period: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Services to include</Label>
                <Select
                  onValueChange={(v) => {
                    if (!newTarget.monitorIds.includes(v)) {
                      setNewTarget({ ...newTarget, monitorIds: [...newTarget.monitorIds, v] })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select monitors" />
                  </SelectTrigger>
                  <SelectContent>
                    {monitors.map((monitor) => (
                      <SelectItem key={monitor.id} value={monitor.id}>
                        {monitor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newTarget.monitorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {newTarget.monitorIds.map((id) => (
                      <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() =>
                        setNewTarget({ ...newTarget, monitorIds: newTarget.monitorIds.filter(m => m !== id) })
                      }>
                        {getMonitorName(id)} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Exclude scheduled maintenance</Label>
                  <p className="text-xs text-muted-foreground">
                    Maintenance windows will not count as downtime
                  </p>
                </div>
                <Switch
                  checked={newTarget.excludeMaintenanceWindows}
                  onCheckedChange={(checked) => setNewTarget({ ...newTarget, excludeMaintenanceWindows: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTarget} disabled={!newTarget.name.trim() || saving}>
                {saving ? 'Creating...' : 'Create target'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) {
              setSelectedTarget(null)
              setEditError('')
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit SLA target</DialogTitle>
              <DialogDescription>
                Update this service level commitment.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Target name</Label>
                <Input
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Uptime target (%)</Label>
                  <Select
                    value={String(editTarget.targetUptime)}
                    onValueChange={(v) => setEditTarget({ ...editTarget, targetUptime: parseFloat(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="99">99.0% (~7h 18min/month)</SelectItem>
                      <SelectItem value="99.5">99.5% (~3h 39min/month)</SelectItem>
                      <SelectItem value="99.9">99.9% (~43min/month)</SelectItem>
                      <SelectItem value="99.95">99.95% (~22min/month)</SelectItem>
                      <SelectItem value="99.99">99.99% (~4min/month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={editTarget.period}
                    onValueChange={(v) => setEditTarget({ ...editTarget, period: v as TargetFormState['period'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Services to include</Label>
                <Select
                  onValueChange={(v) => {
                    if (!editTarget.monitorIds.includes(v)) {
                      setEditTarget({ ...editTarget, monitorIds: [...editTarget.monitorIds, v] })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select monitors" />
                  </SelectTrigger>
                  <SelectContent>
                    {monitors.map((monitor) => (
                      <SelectItem key={monitor.id} value={monitor.id}>
                        {monitor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editTarget.monitorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {editTarget.monitorIds.map((id) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() =>
                          setEditTarget({
                            ...editTarget,
                            monitorIds: editTarget.monitorIds.filter(m => m !== id),
                          })
                        }
                      >
                        {getMonitorName(id)} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Exclude scheduled maintenance</Label>
                  <p className="text-xs text-muted-foreground">
                    Maintenance windows will not count as downtime
                  </p>
                </div>
                <Switch
                  checked={editTarget.excludeMaintenanceWindows}
                  onCheckedChange={(checked) => setEditTarget({ ...editTarget, excludeMaintenanceWindows: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedTarget && handleEditTarget({ ...selectedTarget, ...editTarget })}
                disabled={!editTarget.name.trim() || saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  )
}
