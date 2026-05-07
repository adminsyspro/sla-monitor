'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  Filter,
  Globe,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { MonitorCard } from '@/components/monitors/monitor-card'
import { UptimeBar } from '@/components/monitors/uptime-bar'
import { LatencySparkline, type LatencyPoint } from '@/components/monitors/latency-sparkline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter, useSearchParams } from 'next/navigation'
import { ALL_WINDOWS, parseWindow, windowToDays, type WindowPreset } from '@/lib/window'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { DateRangePicker } from '@/components/ui/date-picker'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import type { Monitor, MonitorCheck, MonitorStatus, MonitorType, UptimeData } from '@/types'

// Uptime response shape from /api/monitors/[id]/uptime
interface UptimeResponse {
  monitorId: string
  period: string
  uptime: number
  totalChecks: number
  totalFailures: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  dailyData: UptimeData[]
}

interface MonitorFormState {
  name: string
  type: MonitorType
  url: string
  interval: number
  timeout: number
  enabled: boolean
  expectedStatusCode: string
  port: string
}

const defaultMonitorForm: MonitorFormState = {
  name: '',
  type: 'http',
  url: '',
  interval: 60,
  timeout: 10000,
  enabled: true,
  expectedStatusCode: '',
  port: '',
}

function monitorToForm(monitor: Monitor): MonitorFormState {
  return {
    name: monitor.name,
    type: monitor.type,
    url: monitor.url,
    interval: monitor.interval,
    timeout: monitor.timeout,
    enabled: monitor.enabled,
    expectedStatusCode: monitor.expectedStatusCode?.toString() ?? '',
    port: monitor.port?.toString() ?? '',
  }
}

function getTypeIcon(type: MonitorType) {
  switch (type) {
    case 'http':
      return <Globe className="h-4 w-4" />
    case 'tcp':
      return <Server className="h-4 w-4" />
    case 'ping':
      return <Wifi className="h-4 w-4" />
    case 'dns':
      return <Activity className="h-4 w-4" />
    case 'ssl':
      return <Shield className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
  }
}

function getStatusConfig(status: MonitorStatus) {
  switch (status) {
    case 'operational':
      return { label: 'Operational', color: 'bg-green-500', variant: 'operational' as const }
    case 'degraded':
      return { label: 'Degraded', color: 'bg-yellow-500', variant: 'degraded' as const }
    case 'partial':
      return { label: 'Partial outage', color: 'bg-orange-500', variant: 'partial' as const }
    case 'major':
      return { label: 'Major outage', color: 'bg-red-500', variant: 'major' as const }
    case 'maintenance':
      return { label: 'Maintenance', color: 'bg-blue-500', variant: 'maintenance' as const }
    default:
      return { label: 'Unknown', color: 'bg-gray-500', variant: 'secondary' as const }
  }
}

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<MonitorStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<MonitorType | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  // Create form state
  const [createForm, setCreateForm] = useState<MonitorFormState>(defaultMonitorForm)
  const [creating, setCreating] = useState(false)

  // Edit form state
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [editForm, setEditForm] = useState<MonitorFormState>(defaultMonitorForm)
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState('')
  const [monitorPendingDelete, setMonitorPendingDelete] = useState<Monitor | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Detail sheet state
  const [checkHistory, setCheckHistory] = useState<MonitorCheck[]>([])
  const [uptimeData, setUptimeData] = useState<UptimeData[]>([])
  const [detailUptime, setDetailUptime] = useState<UptimeResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Per-monitor uptime cache for list view
  const [uptimeMap, setUptimeMap] = useState<
    Record<string, { uptime: number; avgResponseTime: number; daily: LatencyPoint[] }>
  >({})

  // Window selector
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentWindow: WindowPreset = parseWindow(searchParams?.get('window') ?? null)
  const setWindow = (w: WindowPreset) => {
    const params = new URLSearchParams(Array.from(searchParams?.entries() ?? []))
    params.set('window', w)
    router.replace(`/monitors?${params.toString()}`)
  }

  // Fetch monitors
  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch('/api/monitors')
      if (res.ok) {
        const data = await res.json()
        setMonitors(data)
      }
    } catch (e) {
      console.error('Failed to fetch monitors', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMonitors()
  }, [fetchMonitors])

  useEffect(() => {
    const id = setInterval(fetchMonitors, 30_000)
    return () => clearInterval(id)
  }, [fetchMonitors])

  // Fetch uptime for each monitor (list view stats)
  useEffect(() => {
    if (monitors.length === 0) return
    monitors.forEach(async (m) => {
      try {
        const res = await fetch(`/api/monitors/${m.id}/uptime?period=${currentWindow}`)
        if (res.ok) {
          const data: UptimeResponse = await res.json()
          setUptimeMap((prev) => ({
            ...prev,
            [m.id]: {
              uptime: data.uptime,
              avgResponseTime: data.avgResponseTime,
              daily: (data.dailyData ?? []).map((d) => ({ date: d.date, ms: d.avgResponseTime ?? 0 })),
            },
          }))
        }
      } catch { /* ignore */ }
    })
  }, [monitors, currentWindow])

  // Fetch detail data when selected monitor changes
  useEffect(() => {
    if (!selectedMonitor) return
    setDetailLoading(true)
    const id = selectedMonitor.id
    Promise.all([
      fetch(`/api/monitors/${id}/checks?period=24h`).then(r => r.ok ? r.json() : null),
      fetch(`/api/monitors/${id}/uptime?period=${currentWindow}`).then(r => r.ok ? r.json() : null),
    ]).then(([checksRes, uptimeRes]) => {
      if (checksRes?.data) setCheckHistory(checksRes.data)
      if (uptimeRes) {
        setDetailUptime(uptimeRes)
        setUptimeData(uptimeRes.dailyData || [])
      }
    }).catch(console.error).finally(() => setDetailLoading(false))
  }, [selectedMonitor, currentWindow])

  // Create monitor handler
  const handleCreate = async () => {
    if (!createForm.name || !createForm.url) return
    setCreating(true)
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          type: createForm.type,
          url: createForm.url,
          interval: createForm.interval,
          timeout: createForm.timeout,
          expectedStatusCode: createForm.expectedStatusCode ? Number(createForm.expectedStatusCode) : undefined,
          port: createForm.port ? Number(createForm.port) : undefined,
        }),
      })
      if (res.ok) {
        setIsCreateDialogOpen(false)
        setCreateForm(defaultMonitorForm)
        await fetchMonitors()
      }
    } catch (e) {
      console.error('Failed to create monitor', e)
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (monitor: Monitor) => {
    setEditingMonitor(monitor)
    setEditForm(monitorToForm(monitor))
    setEditError('')
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingMonitor || !editForm.name || !editForm.url) return
    setUpdating(true)
    setEditError('')
    try {
      const res = await fetch(`/api/monitors/${editingMonitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          url: editForm.url,
          interval: editForm.interval,
          timeout: editForm.timeout,
          enabled: editForm.enabled,
          expectedStatusCode: editForm.expectedStatusCode ? Number(editForm.expectedStatusCode) : null,
          port: editForm.port ? Number(editForm.port) : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Failed to update monitor')
        return
      }

      setMonitors((prev) => prev.map((monitor) => (monitor.id === data.id ? data : monitor)))
      setSelectedMonitor((prev) => (prev?.id === data.id ? data : prev))
      setEditingMonitor(data)
      setIsEditDialogOpen(false)
      await fetchMonitors()
    } catch (e) {
      console.error('Failed to update monitor', e)
      setEditError('Failed to update monitor')
    } finally {
      setUpdating(false)
    }
  }

  const requestDelete = (monitor: Monitor) => {
    setMonitorPendingDelete(monitor)
  }

  // Delete monitor handler
  const handleDelete = async () => {
    if (!monitorPendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/monitors/${monitorPendingDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setMonitors((prev) => prev.filter((monitor) => monitor.id !== monitorPendingDelete.id))
        setSelectedMonitor((prev) => (prev?.id === monitorPendingDelete.id ? null : prev))
        setIsDetailSheetOpen(false)
        setMonitorPendingDelete(null)
        await fetchMonitors()
      }
    } catch (e) {
      console.error('Failed to delete monitor', e)
    } finally {
      setDeleting(false)
    }
  }

  // Pause monitor handler
  const handlePause = async (id: string) => {
    try {
      const res = await fetch(`/api/monitors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      })
      if (res.ok) await fetchMonitors()
    } catch (e) {
      console.error('Failed to pause monitor', e)
    }
  }

  // Filter monitors
  const filteredMonitors = useMemo(() => {
    return monitors.filter((monitor) => {
      const matchesSearch =
        monitor.name.toLowerCase().includes(search.toLowerCase()) ||
        monitor.url.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || monitor.status === statusFilter
      const matchesType = typeFilter === 'all' || monitor.type === typeFilter

      // Date filter (based on updatedAt)
      let matchesDate = true
      if (dateRange.from) {
        const monitorDate = new Date(monitor.updatedAt)
        matchesDate = monitorDate >= dateRange.from
        if (dateRange.to) {
          matchesDate = matchesDate && monitorDate <= dateRange.to
        }
      }

      return matchesSearch && matchesStatus && matchesType && matchesDate
    })
  }, [monitors, search, statusFilter, typeFilter, dateRange])

  // Count by status
  const statusCounts = useMemo(() => ({
    all: monitors.length,
    operational: monitors.filter((m) => m.status === 'operational').length,
    degraded: monitors.filter((m) => m.status === 'degraded').length,
    major: monitors.filter((m) => m.status === 'major' || m.status === 'partial').length,
    maintenance: monitors.filter((m) => m.status === 'maintenance').length,
  }), [monitors])

  // Count by type
  const typeCounts = useMemo(() => ({
    http: monitors.filter((m) => m.type === 'http').length,
    tcp: monitors.filter((m) => m.type === 'tcp').length,
    ping: monitors.filter((m) => m.type === 'ping').length,
    ssl: monitors.filter((m) => m.type === 'ssl').length,
    dns: monitors.filter((m) => m.type === 'dns').length,
  }), [monitors])

  const handleMonitorClick = (monitor: Monitor) => {
    setSelectedMonitor(monitor)
    setIsDetailSheetOpen(true)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setDateRange({})
  }

  const hasActiveFilters = search || statusFilter !== 'all' || typeFilter !== 'all' || dateRange.from

  return (
    <>
      <Header title="Monitors" />
      <main className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{statusCounts.all}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:border-primary/50", statusFilter === 'operational' && "border-green-500")}
            onClick={() => setStatusFilter('operational')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Operational</p>
                  <p className="text-2xl font-bold text-green-500">{statusCounts.operational}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:border-primary/50", statusFilter === 'degraded' && "border-yellow-500")}
            onClick={() => setStatusFilter('degraded')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Degraded</p>
                  <p className="text-2xl font-bold text-yellow-500">{statusCounts.degraded}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn("cursor-pointer hover:border-primary/50", statusFilter === 'major' && "border-red-500")}
            onClick={() => setStatusFilter('major')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Down</p>
                  <p className="text-2xl font-bold text-red-500">{statusCounts.major}</p>
                </div>
                <X className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average uptime</p>
                  <p className="text-2xl font-bold">
                    {Object.keys(uptimeMap).length > 0
                      ? (Object.values(uptimeMap).reduce((a, b) => a + b.uptime, 0) / Object.keys(uptimeMap).length).toFixed(2) + '%'
                      : '—'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Window selector */}
        <Tabs value={currentWindow} onValueChange={(v) => setWindow(v as WindowPreset)} className="mb-4">
          <TabsList>
            {ALL_WINDOWS.map((w) => (
              <TabsTrigger key={w} value={w}>
                {w}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Filters Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-48 pl-9"
                  />
                </div>

                {/* Type Filter */}
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="http">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" /> HTTP ({typeCounts.http})
                      </div>
                    </SelectItem>
                    <SelectItem value="tcp">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" /> TCP ({typeCounts.tcp})
                      </div>
                    </SelectItem>
                    <SelectItem value="ping">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4" /> Ping ({typeCounts.ping})
                      </div>
                    </SelectItem>
                    <SelectItem value="ssl">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" /> SSL ({typeCounts.ssl})
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range Filter */}
                <DateRangePicker
                  from={dateRange.from}
                  to={dateRange.to}
                  onSelect={setDateRange}
                />

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Status Tabs */}
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="operational" className="gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      OK
                    </TabsTrigger>
                    <TabsTrigger value="degraded" className="gap-1">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      Degraded
                    </TabsTrigger>
                    <TabsTrigger value="major" className="gap-1">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      Outage
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Separator orientation="vertical" className="h-8" />

                {/* View Mode */}
                <div className="flex items-center rounded-md border p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${filteredMonitors.length} monitor${filteredMonitors.length > 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Monitors Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMonitors.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMonitors.map((monitor) => (
                <MonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  window={currentWindow}
                  onClick={() => handleMonitorClick(monitor)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredMonitors.map((monitor) => {
                    const statusConfig = getStatusConfig(monitor.status)
                    return (
                      <div
                        key={monitor.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleMonitorClick(monitor)}
                      >
                        <div className={cn('h-3 w-3 rounded-full', statusConfig.color)} />
                        <div className="flex items-center gap-2">
                          {getTypeIcon(monitor.type)}
                          <Badge variant="outline" className="text-xs">{monitor.type.toUpperCase()}</Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{monitor.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{monitor.url}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {uptimeMap[monitor.id] ? uptimeMap[monitor.id].uptime.toFixed(2) + '%' : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">uptime</p>
                        </div>
                        <div className="hidden md:flex w-36 items-center justify-end">
                          <LatencySparkline
                            data={uptimeMap[monitor.id]?.daily ?? []}
                            width={140}
                            height={20}
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {uptimeMap[monitor.id] ? uptimeMap[monitor.id].avgResponseTime + 'ms' : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">latency</p>
                        </div>
                        <Badge variant={statusConfig.variant as any}>{statusConfig.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(monitor) }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePause(monitor.id) }}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); requestDelete(monitor) }}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No monitors found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'Try changing your filters'
                : 'Start by creating your first monitor'}
            </p>
            {!hasActiveFilters && (
              <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create a monitor
              </Button>
            )}
          </div>
        )}

        {/* Detail Sheet */}
        <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {selectedMonitor && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <div className={cn('h-3 w-3 rounded-full', getStatusConfig(selectedMonitor.status).color)} />
                    <SheetTitle>{selectedMonitor.name}</SheetTitle>
                  </div>
                  <SheetDescription className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {selectedMonitor.url}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status & Quick Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusConfig(selectedMonitor.status).variant as any}>
                        {getStatusConfig(selectedMonitor.status).label}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {getTypeIcon(selectedMonitor.type)}
                        {selectedMonitor.type.toUpperCase()}
                      </Badge>
                      {selectedMonitor.enabled ? (
                        <Badge variant="secondary" className="gap-1">
                          <Play className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Pause className="h-3 w-3" /> Paused
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(selectedMonitor)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => requestDelete(selectedMonitor)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Test
                      </Button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-green-500">
                        {detailUptime ? detailUptime.uptime.toFixed(2) + '%' : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{currentWindow} uptime</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold">
                        {detailUptime ? detailUptime.avgResponseTime + 'ms' : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg. latency</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold">{selectedMonitor.interval}s</p>
                      <p className="text-xs text-muted-foreground">Interval</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold">
                        {detailUptime ? detailUptime.totalFailures : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Incidents 30j</p>
                    </div>
                  </div>

                  {/* Uptime Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Uptime History</h4>
                      <span className="text-sm text-muted-foreground">Last {currentWindow}</span>
                    </div>
                    <UptimeBar data={uptimeData} days={windowToDays(currentWindow)} />
                  </div>

                  {/* Configuration */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">URL</p>
                        <p className="font-mono text-xs bg-muted p-2 rounded">{selectedMonitor.url}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Timeout</p>
                        <p>{selectedMonitor.timeout}ms</p>
                      </div>
                      {selectedMonitor.expectedStatusCode && (
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Expected HTTP code</p>
                          <p>{selectedMonitor.expectedStatusCode}</p>
                        </div>
                      )}
                      {selectedMonitor.port && (
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Port</p>
                          <p>{selectedMonitor.port}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Recent Checks */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Recent Checks</h4>
                      <Button variant="ghost" size="sm">View all</Button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {detailLoading ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                      ) : checkHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No checks</p>
                      ) : checkHistory.slice(0, 15).map((check) => (
                        <div
                          key={check.id}
                          className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'h-2 w-2 rounded-full',
                              check.status === 'operational' ? 'bg-green-500' : 'bg-red-500'
                            )} />
                            <span className="text-muted-foreground">
                              {new Date(check.timestamp).toLocaleTimeString('en-US')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            {check.statusCode && (
                              <Badge variant={check.statusCode === 200 ? 'secondary' : 'destructive'}>
                                {check.statusCode}
                              </Badge>
                            )}
                            <span className={cn(
                              'font-mono',
                              (check.responseTime || 0) > 200 ? 'text-yellow-500' : 'text-green-500'
                            )}>
                              {check.responseTime ?? '—'}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedMonitor.tags && selectedMonitor.tags.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedMonitor.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Created: {formatDate(selectedMonitor.createdAt)}</p>
                    <p>Last modified: {formatDate(selectedMonitor.updatedAt)}</p>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!monitorPendingDelete} onOpenChange={(open) => !open && !deleting && setMonitorPendingDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete monitor?</DialogTitle>
              <DialogDescription>
                This will permanently delete "{monitorPendingDelete?.name}" and its stored check history.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMonitorPendingDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete monitor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create a new monitor</DialogTitle>
              <DialogDescription>
                Configure a new monitoring endpoint for your services.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Ex: API Production"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v as MonitorType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP(S)</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="ping">Ping</SelectItem>
                    <SelectItem value="dns">DNS</SelectItem>
                    <SelectItem value="ssl">SSL Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL or Host</Label>
                <Input
                  placeholder="https://api.example.com/health"
                  value={createForm.url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={createForm.interval}
                    onChange={(e) => setCreateForm((f) => ({ ...f, interval: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={createForm.timeout}
                    onChange={(e) => setCreateForm((f) => ({ ...f, timeout: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected HTTP code</Label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={createForm.expectedStatusCode}
                    onChange={(e) => setCreateForm((f) => ({ ...f, expectedStatusCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    placeholder="443"
                    value={createForm.port}
                    onChange={(e) => setCreateForm((f) => ({ ...f, port: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !createForm.name || !createForm.url}>
                {creating ? 'Creating...' : 'Create monitor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit monitor</DialogTitle>
              <DialogDescription>
                Update this monitor configuration.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as MonitorType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP(S)</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="ping">Ping</SelectItem>
                    <SelectItem value="dns">DNS</SelectItem>
                    <SelectItem value="ssl">SSL Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL or Host</Label>
                <Input
                  value={editForm.url}
                  onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={editForm.interval}
                    onChange={(e) => setEditForm((f) => ({ ...f, interval: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={editForm.timeout}
                    onChange={(e) => setEditForm((f) => ({ ...f, timeout: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected HTTP code</Label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={editForm.expectedStatusCode}
                    onChange={(e) => setEditForm((f) => ({ ...f, expectedStatusCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    placeholder="443"
                    value={editForm.port}
                    onChange={(e) => setEditForm((f) => ({ ...f, port: e.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                Enabled
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={updating || !editForm.name || !editForm.url}>
                {updating ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}
