'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit,
  Info,
  MoreHorizontal,
  Plus,
  Settings,
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

function getStatusConfig(status: SLATargetWithMetrics['status']) {
  switch (status) {
    case 'healthy':
      return { label: 'Conforme', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/50' }
    case 'warning':
      return { label: 'À risque', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50' }
    case 'critical':
      return { label: 'Non conforme', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/50' }
  }
}

function getPeriodLabel(period: string) {
  switch (period) {
    case 'monthly': return 'Mensuel'
    case 'quarterly': return 'Trimestriel'
    case 'yearly': return 'Annuel'
    default: return period
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes.toFixed(1)}min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours < 24) return `${hours}h ${mins}min`
  const days = Math.floor(hours / 24)
  return `${days}j ${hours % 24}h`
}

export default function SLATargetsPage() {
  const [slaTargets, setSlaTargets] = useState<SLATargetWithMetrics[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<SLATargetWithMetrics | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [newTarget, setNewTarget] = useState({
    name: '',
    description: '',
    targetUptime: 99.9,
    period: 'monthly' as const,
    monitorIds: [] as string[],
    excludeMaintenanceWindows: true,
  })

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
      setNewTarget({
        name: '',
        description: '',
        targetUptime: 99.9,
        period: 'monthly',
        monitorIds: [],
        excludeMaintenanceWindows: true,
      })
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
      if (!res.ok) throw new Error('Failed to update SLA target')
      await fetchData()
    } catch (err) {
      console.error('Failed to update SLA target:', err)
    } finally {
      setSaving(false)
    }
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

  return (
    <TooltipProvider>
      <Header title="Objectifs SLA" />
      <main className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total objectifs</p>
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
                  <p className="text-sm text-muted-foreground">Conformes</p>
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
                  <p className="text-sm text-muted-foreground">À risque</p>
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
                  <p className="text-sm text-muted-foreground">Non conformes</p>
                  <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
                </div>
                <X className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Objectifs configurés</h2>
            <p className="text-sm text-muted-foreground">
              Gérez vos engagements de niveau de service
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel objectif
          </Button>
        </div>

        {/* SLA Targets Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Chargement des objectifs SLA...</div>
          </div>
        ) : slaTargets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun objectif SLA configuré</p>
            <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un objectif
            </Button>
          </div>
        ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {slaTargets.map((target) => {
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedTarget(target)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Configurer alertes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTarget(target.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Main Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Uptime */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Uptime actuel</span>
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
                        <span>Objectif: {target.targetUptime}%</span>
                        <span>
                          {target.currentUptime >= target.targetUptime ? '+' : ''}
                          {(target.currentUptime - target.targetUptime).toFixed(3)}%
                        </span>
                      </div>
                    </div>

                    {/* Error Budget */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Budget d'erreur</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Temps d'indisponibilité autorisé</p>
                              <p>pour respecter le SLA</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className={cn(
                          'font-bold',
                          isOverBudget ? 'text-red-500' : target.errorBudgetRemaining < 20 ? 'text-yellow-500' : 'text-green-500'
                        )}>
                          {isOverBudget ? 'Dépassé' : `${target.errorBudgetRemaining.toFixed(0)}%`}
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
                        <span>Utilisé: {formatMinutes(target.downtimeMinutes)}</span>
                        <span>Autorisé: {formatMinutes(target.allowedDowntimeMinutes)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Details */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {getPeriodLabel(target.period)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {target.excludeMaintenanceWindows ? 'Maintenance exclue' : 'Maintenance incluse'}
                    </div>
                  </div>

                  {/* Monitors */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {target.monitorIds.length} service{target.monitorIds.length > 1 ? 's' : ''} surveillé{target.monitorIds.length > 1 ? 's' : ''}
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
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Créer un objectif SLA</DialogTitle>
              <DialogDescription>
                Définissez un nouvel engagement de niveau de service pour vos monitors.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nom de l'objectif</Label>
                <Input
                  placeholder="Ex: SLA Production Critique"
                  value={newTarget.name}
                  onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Input
                  placeholder="Description de cet objectif SLA"
                  value={newTarget.description}
                  onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Objectif d'uptime (%)</Label>
                  <Select
                    value={String(newTarget.targetUptime)}
                    onValueChange={(v) => setNewTarget({ ...newTarget, targetUptime: parseFloat(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="99">99.0% (~7h 18min/mois)</SelectItem>
                      <SelectItem value="99.5">99.5% (~3h 39min/mois)</SelectItem>
                      <SelectItem value="99.9">99.9% (~43min/mois)</SelectItem>
                      <SelectItem value="99.95">99.95% (~22min/mois)</SelectItem>
                      <SelectItem value="99.99">99.99% (~4min/mois)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Période</Label>
                  <Select
                    value={newTarget.period}
                    onValueChange={(v) => setNewTarget({ ...newTarget, period: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="quarterly">Trimestriel</SelectItem>
                      <SelectItem value="yearly">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Services à inclure</Label>
                <Select
                  onValueChange={(v) => {
                    if (!newTarget.monitorIds.includes(v)) {
                      setNewTarget({ ...newTarget, monitorIds: [...newTarget.monitorIds, v] })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner les monitors" />
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
                  <Label>Exclure les maintenances planifiées</Label>
                  <p className="text-xs text-muted-foreground">
                    Les fenêtres de maintenance ne compteront pas comme downtime
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
                Annuler
              </Button>
              <Button onClick={handleCreateTarget} disabled={!newTarget.name.trim() || saving}>
                {saving ? 'Création...' : "Créer l'objectif"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  )
}
