'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { UptimeBar } from '@/components/monitors/uptime-bar'
import { LatencySparkline, type LatencyPoint } from '@/components/monitors/latency-sparkline'
import { ALL_WINDOWS, windowToDays, type WindowPreset } from '@/lib/window'
import { cn, formatDate } from '@/lib/utils'
import type { MonitorStatus } from '@/types'

interface UptimePoint {
  date: string
  status: MonitorStatus
  uptime: number
  responseTime?: number
}

interface PublicMonitor {
  id: string
  name: string
  status: MonitorStatus
  uptime: number
  uptimeHistory: UptimePoint[]
  trend: LatencyPoint[]
}

interface ServiceGroup {
  id: string
  name: string
  monitors: PublicMonitor[]
}

interface PublicIncident {
  id: string
  title: string
  status: string
  severity: string
  startedAt: string
  resolvedAt?: string
  rootCause?: string
  impact?: string
  resolution?: string
  preventiveActions?: string
  updates?: {
    id: string
    status: string
    message: string
    createdBy: string
    createdAt: string
  }[]
}

interface PublicMaintenanceWindow {
  id: string
  title: string
  description?: string
  affectedMonitors: string[]
  scheduledStart: string
  scheduledEnd: string
  actualStart?: string
  actualEnd?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  createdBy: string
}

interface PublicStatusData {
  title: string
  description: string
  accentColor: string
  logoUrl?: string
  backgroundColor: string
  headerBackground: string
  headerTextColor: string
  cardBackground: string
  borderRadius: 'none' | 'small' | 'medium' | 'large'
  operationalMessage: string
  degradedMessage: string
  majorMessage: string
  maintenanceMessage: string
  footerText: string
  period: WindowPreset
  days: number
  overallStatus: 'operational' | 'degraded' | 'major' | 'maintenance'
  groups: ServiceGroup[]
  ungroupedMonitors: PublicMonitor[]
  uptimeHistory: UptimePoint[]
  incidents: PublicIncident[]
  maintenanceWindows: PublicMaintenanceWindow[]
}

const WINDOW_LABELS: Record<WindowPreset, string> = {
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '1y': '1y',
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'operational':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case 'degraded':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    case 'partial':
      return <AlertTriangle className="h-5 w-5 text-orange-500" />
    case 'major':
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    case 'maintenance':
      return <Wrench className="h-5 w-5 text-blue-500" />
    default:
      return <Info className="h-5 w-5 text-gray-500" />
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'operational': return 'Operational'
    case 'degraded': return 'Degraded performance'
    case 'partial': return 'Partial outage'
    case 'major': return 'Major outage'
    case 'maintenance': return 'Maintenance'
    default: return 'Unknown'
  }
}

function getOverallStatusText(status: PublicStatusData['overallStatus']) {
  switch (status) {
    case 'operational': return 'All systems are operational'
    case 'degraded': return 'Some systems are experiencing issues'
    case 'maintenance': return 'Maintenance in progress'
    case 'major': return 'Issues are affecting our services'
  }
}

function getCustomStatusText(status: PublicStatusData['overallStatus'], data: PublicStatusData) {
  switch (status) {
    case 'operational': return data.operationalMessage
    case 'degraded': return data.degradedMessage
    case 'maintenance': return data.maintenanceMessage
    case 'major': return data.majorMessage
  }
}

function getBorderRadiusClass(radius: PublicStatusData['borderRadius']) {
  switch (radius) {
    case 'none': return 'rounded-none'
    case 'small': return 'rounded-md'
    case 'medium': return 'rounded-xl'
    case 'large':
    default: return 'rounded-2xl'
  }
}

function getMonitorBadgeVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'operational': return 'operational'
    case 'degraded': return 'degraded'
    case 'partial': return 'partial'
    case 'major': return 'major'
    case 'maintenance': return 'maintenance'
    default: return 'secondary'
  }
}

function getIncidentBadgeVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'resolved': return 'operational'
    case 'monitoring': return 'degraded'
    case 'identified': return 'partial'
    case 'investigating': return 'major'
    default: return 'secondary'
  }
}

function getPeriodStartLabel(period: WindowPreset) {
  return period === '24h' ? '24 hours ago' : `${windowToDays(period)} days ago`
}

function getMaintenanceStatusLabel(status: PublicMaintenanceWindow['status']) {
  switch (status) {
    case 'in_progress': return 'In progress'
    case 'completed': return 'Completed'
    case 'cancelled': return 'Canceled'
    case 'scheduled':
    default: return 'Scheduled'
  }
}

export default function PublicStatusPage() {
  const [data, setData] = useState<PublicStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<WindowPreset>('90d')
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [expandedIncidentIds, setExpandedIncidentIds] = useState<string[]>([])

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get('preview') === '1'
    const params = new URLSearchParams({ period: selectedPeriod })
    if (preview) params.set('preview', '1')

    setLoading(true)
    fetch(`/api/status-page/public?${params.toString()}`)
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((statusData: PublicStatusData) => {
        setData(statusData)
        setError('')
        const groupIds = statusData.groups.map((group) => group.id)
        if (statusData.ungroupedMonitors.length > 0) groupIds.push('__ungrouped__')
        setExpandedGroups(groupIds)
      })
      .catch(() => setError('Status page is not available.'))
      .finally(() => setLoading(false))
  }, [selectedPeriod])

  const overallStatus = data?.overallStatus || 'operational'
  const services = useMemo(() => {
    const groups = data?.groups || []
    const ungrouped = data?.ungroupedMonitors || []
    return { groups, ungrouped }
  }, [data])
  const serviceGroups = useMemo(() => [
    ...services.groups,
    ...(services.ungrouped.length > 0 ? [{
      id: '__ungrouped__',
      name: 'Other services',
      monitors: services.ungrouped,
    }] : []),
  ], [services])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    )
  }

  const toggleIncident = (incidentId: string) => {
    setExpandedIncidentIds((current) =>
      current.includes(incidentId)
        ? current.filter((id) => id !== incidentId)
        : [...current, incidentId]
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading status page...</span>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <Card className="max-w-md">
          <CardContent className="p-8">
            <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500" />
            <h1 className="mt-4 text-xl font-semibold">Status page unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: data.backgroundColor || '#f8fafc' }}>
      <section
        className="border-b"
        style={{
          borderTop: `6px solid ${data.accentColor || '#3b82f6'}`,
          backgroundColor: data.headerBackground || '#ffffff',
          color: data.headerTextColor || '#0f172a',
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-10 text-center">
          {data.logoUrl && (
            <img src={data.logoUrl} alt="" className="mx-auto mb-4 h-14 max-w-56 object-contain" />
          )}
          <h1 className="text-3xl font-bold tracking-tight">{data.title}</h1>
          <p className="mt-2 opacity-80">{data.description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className={cn(
          getBorderRadiusClass(data.borderRadius),
          overallStatus === 'operational' && 'border-green-500/30 bg-green-500/5',
          overallStatus === 'degraded' && 'border-yellow-500/30 bg-yellow-500/5',
          overallStatus === 'maintenance' && 'border-blue-500/30 bg-blue-500/5',
          overallStatus === 'major' && 'border-red-500/30 bg-red-500/5',
        )}>
          <CardContent className="flex items-center justify-center gap-3 p-5">
            {getStatusIcon(overallStatus)}
            <span className="text-lg font-semibold">{getCustomStatusText(overallStatus, data) || getOverallStatusText(overallStatus)}</span>
          </CardContent>
        </Card>

        <Card className={getBorderRadiusClass(data.borderRadius)} style={{ backgroundColor: data.cardBackground || '#ffffff' }}>
          <CardContent className="p-0">
            {serviceGroups.map((group) => {
              const isExpanded = expandedGroups.includes(group.id)
              const groupStatus = group.monitors.find((monitor) => monitor.status !== 'operational')?.status || 'operational'

              return (
                <div key={group.id} className="border-b last:border-b-0">
                  <button
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="secondary">{group.monitors.length} services</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(groupStatus)}
                      <span className="text-sm text-muted-foreground">{getStatusLabel(groupStatus)}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="divide-y border-t">
                      {group.monitors.map((monitor) => (
                        <div key={monitor.id} className="flex items-center justify-between gap-4 p-4 pl-12">
                          <span>{monitor.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">{monitor.uptime.toFixed(2)}% uptime</span>
                            <div className="hidden md:block w-72">
                              <LatencySparkline data={monitor.trend ?? []} responsive height={28} />
                            </div>
                            <Badge
                              variant={getMonitorBadgeVariant(monitor.status)}
                            >
                              {getStatusLabel(monitor.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className={getBorderRadiusClass(data.borderRadius)} style={{ backgroundColor: data.cardBackground || '#ffffff' }}>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold">Uptime History ({WINDOW_LABELS[selectedPeriod]})</h2>
              <div className="inline-flex rounded-lg border bg-muted/30 p-1">
                {ALL_WINDOWS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setSelectedPeriod(period)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      selectedPeriod === period
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {WINDOW_LABELS[period]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <UptimeBar data={data.uptimeHistory || []} days={windowToDays(selectedPeriod)} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{getPeriodStartLabel(selectedPeriod)}</span>
              <span>Today</span>
            </div>

            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Timeline by monitor</h3>
              {serviceGroups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.name}</p>
                  {group.monitors.map((monitor) => (
                    <div key={monitor.id} className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{monitor.name}</p>
                          <p className="text-xs text-muted-foreground">{monitor.uptime.toFixed(2)}% uptime</p>
                        </div>
                        <Badge variant={getMonitorBadgeVariant(monitor.status)}>{getStatusLabel(monitor.status)}</Badge>
                      </div>
                      <UptimeBar data={monitor.uptimeHistory || []} days={windowToDays(selectedPeriod)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {(data.maintenanceWindows || []).length > 0 && (
          <Card className={getBorderRadiusClass(data.borderRadius)} style={{ backgroundColor: data.cardBackground || '#ffffff' }}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Scheduled maintenance</h2>
              {(data.maintenanceWindows || []).map((maintenance) => (
                <div key={maintenance.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{maintenance.title}</span>
                    </div>
                    <Badge variant="maintenance">{getMaintenanceStatusLabel(maintenance.status)}</Badge>
                  </div>
                  {maintenance.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{maintenance.description}</p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatDate(maintenance.scheduledStart)} to {formatDate(maintenance.scheduledEnd)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.incidents.length > 0 && (
          <Card className={getBorderRadiusClass(data.borderRadius)} style={{ backgroundColor: data.cardBackground || '#ffffff' }}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Recent incidents</h2>
              {data.incidents.map((incident) => {
                const isExpanded = expandedIncidentIds.includes(incident.id)
                const details = [
                  { label: 'Root cause', value: incident.rootCause },
                  { label: 'Impact', value: incident.impact },
                  { label: 'Resolution', value: incident.resolution },
                  { label: 'Preventive actions', value: incident.preventiveActions },
                ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value))

                return (
                <div key={incident.id} className="rounded-lg border p-4">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 text-left"
                    onClick={() => toggleIncident(incident.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{incident.title}</span>
                    </div>
                    <Badge variant={getIncidentBadgeVariant(incident.status)}>{incident.status}</Badge>
                  </button>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Started {formatDate(incident.startedAt)}
                    {incident.resolvedAt ? `, resolved ${formatDate(incident.resolvedAt)}` : ''}
                  </p>
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {details.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {details.map((detail) => (
                            <div key={detail.label} className="rounded-md bg-muted/40 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{detail.label}</p>
                              <p className="mt-1 text-sm">{detail.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No incident details have been provided yet.</p>
                      )}

                      {(incident.updates?.length || 0) > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updates</p>
                          {incident.updates?.map((update) => (
                            <div key={update.id} className="rounded-md border p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Badge variant={getIncidentBadgeVariant(update.status)}>{update.status}</Badge>
                                <span className="text-xs text-muted-foreground">{formatDate(update.createdAt)}</span>
                              </div>
                              <p className="mt-2">{update.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
            </CardContent>
          </Card>
        )}
        {data.footerText && (
          <p className="pb-8 text-center text-sm text-muted-foreground">{data.footerText}</p>
        )}
      </div>
    </main>
  )
}
