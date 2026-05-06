'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  ExternalLink,
  Info,
  Palette,
  RefreshCw,
  Settings,
  Share2,
  Wrench,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { UptimeBar } from '@/components/monitors/uptime-bar'
import { ALL_WINDOWS, windowToDays, type WindowPreset } from '@/lib/window'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// app store used for theme/sidebar only
import { cn, formatDate } from '@/lib/utils'
import type { MonitorStatus } from '@/types'

// Status page configuration
interface StatusPageConfig {
  enabled: boolean
  subdomain: string
  customDomain?: string
  title: string
  description: string
  logoUrl?: string
  theme: 'light' | 'dark' | 'auto'
  accentColor: string
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
  showUptime: boolean
  showResponseTime: boolean
  showIncidents: boolean
  subscribersEnabled: boolean
  monitorIds?: string[]
}

const defaultConfig: StatusPageConfig = {
  enabled: true,
  subdomain: '',
  customDomain: '',
  title: 'Service Status',
  description: 'Monitor our service availability in real time',
  theme: 'auto',
  accentColor: '#3b82f6',
  backgroundColor: '#f8fafc',
  headerBackground: '#ffffff',
  headerTextColor: '#0f172a',
  cardBackground: '#ffffff',
  borderRadius: 'large',
  operationalMessage: 'All systems are operational',
  degradedMessage: 'Some systems are experiencing issues',
  majorMessage: 'Issues are affecting our services',
  maintenanceMessage: 'Maintenance in progress',
  footerText: '',
  showUptime: true,
  showResponseTime: true,
  showIncidents: true,
  subscribersEnabled: false,
}

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
}

// Service groups for public status page
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

interface PublicData {
  title: string
  description: string
  theme: string
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

function getBorderRadiusClass(radius: StatusPageConfig['borderRadius'] | PublicData['borderRadius']) {
  switch (radius) {
    case 'none': return 'rounded-none'
    case 'small': return 'rounded-md'
    case 'medium': return 'rounded-xl'
    case 'large':
    default: return 'rounded-2xl'
  }
}

function getOverallStatusText(status: PublicData['overallStatus'], source: StatusPageConfig | PublicData) {
  switch (status) {
    case 'operational': return source.operationalMessage
    case 'degraded': return source.degradedMessage
    case 'maintenance': return source.maintenanceMessage
    case 'major': return source.majorMessage
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

function getStatusDotClass(status: string) {
  switch (status) {
    case 'operational': return 'bg-green-500'
    case 'degraded': return 'bg-yellow-500'
    case 'partial': return 'bg-orange-500'
    case 'major': return 'bg-red-500'
    case 'maintenance': return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
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

export default function StatusPageAdmin() {
  const [config, setConfig] = useState<StatusPageConfig>(defaultConfig)
  const [activeTab, setActiveTab] = useState('preview')
  const [publicData, setPublicData] = useState<PublicData | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [expandedIncidentIds, setExpandedIncidentIds] = useState<string[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<WindowPreset>('90d')
  const [configLoading, setConfigLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const publicStatusUrl = '/status-page'
  const previewStatusUrl = '/status-page?preview=1'

  // Fetch config on mount
  useEffect(() => {
    fetch('/api/status-page/config')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        setConfig({
          ...defaultConfig,
          ...data,
          showIncidents: data.showIncidents ?? defaultConfig.showIncidents,
        })
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false))
  }, [])

  // Fetch public data when preview tab is active
  const fetchPublicData = useCallback(() => {
    setPreviewLoading(true)
    fetch(`/api/status-page/public?period=${selectedPeriod}`)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        setPublicData(data)
        const allGroupIds = (data.groups || []).map((g: ServiceGroup) => g.id)
        if (data.ungroupedMonitors?.length) allGroupIds.push('__ungrouped__')
        setExpandedGroups(allGroupIds)
      })
      .catch(() => {})
      .finally(() => setPreviewLoading(false))
  }, [selectedPeriod])

  useEffect(() => {
    if (activeTab === 'preview') {
      fetchPublicData()
    }
  }, [activeTab, fetchPublicData])

  // Save config
  const saveConfig = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/status-page/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch {
      // error handling could be added
    } finally {
      setSaving(false)
    }
  }, [config])

  const overallStatus = publicData?.overallStatus || 'operational'
  const displayGroups: ServiceGroup[] = publicData?.groups || []
  const ungroupedMonitors = publicData?.ungroupedMonitors || []
  const incidents = publicData?.incidents || []
  const maintenanceWindows = publicData?.maintenanceWindows || []
  const uptimeData = publicData?.uptimeHistory || []
  const previewServiceGroups: ServiceGroup[] = [
    ...displayGroups,
    ...(ungroupedMonitors.length > 0 ? [{
      id: '__ungrouped__',
      name: 'Other services',
      monitors: ungroupedMonitors,
    }] : []),
  ]

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const toggleIncident = (incidentId: string) => {
    setExpandedIncidentIds(prev =>
      prev.includes(incidentId)
        ? prev.filter(id => id !== incidentId)
        : [...prev, incidentId]
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <Header title="Status Page" />
      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Public status page configuration</h2>
            <p className="text-sm text-muted-foreground">
              Customize and manage the status page available to your users
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={previewStatusUrl} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                View page
              </a>
            </Button>
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="customize" className="gap-2">
              <Palette className="h-4 w-4" />
              Customization
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardContent className="p-0">
                {previewLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                <div
                  className={cn('border overflow-hidden', getBorderRadiusClass(publicData?.borderRadius || config.borderRadius))}
                  style={{
                    backgroundColor: publicData?.backgroundColor || config.backgroundColor,
                  }}
                >
                  {/* Header */}
                  <div
                    className="p-6 text-center"
                    style={{
                      backgroundColor: publicData?.headerBackground || config.headerBackground,
                      color: publicData?.headerTextColor || config.headerTextColor,
                      borderTop: `6px solid ${publicData?.accentColor || config.accentColor}`,
                    }}
                  >
                    {(publicData?.logoUrl || config.logoUrl) && (
                      <img
                        src={publicData?.logoUrl || config.logoUrl}
                        alt=""
                        className="mx-auto mb-3 h-12 max-w-48 object-contain"
                      />
                    )}
                    <h1 className="text-2xl font-bold">{publicData?.title || config.title}</h1>
                    <p className="mt-1 opacity-80">{publicData?.description || config.description}</p>
                  </div>

                  {/* Overall Status */}
                  <div className={cn(
                    'p-4 border-b',
                    overallStatus === 'operational' ? 'bg-green-500/10' :
                    overallStatus === 'degraded' ? 'bg-yellow-500/10' :
                    overallStatus === 'maintenance' ? 'bg-blue-500/10' : 'bg-red-500/10'
                  )}>
                    <div className="flex items-center justify-center gap-3">
                      {getStatusIcon(overallStatus)}
                      <span className="font-semibold text-lg">
                        {getOverallStatusText(overallStatus, publicData || config)}
                      </span>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="p-6 space-y-4">
                    {displayGroups.map((group) => {
                      const isExpanded = expandedGroups.includes(group.id)
                      const groupStatus = group.monitors.some(s => s.status !== 'operational')
                        ? group.monitors.find(s => s.status !== 'operational')?.status || 'operational'
                        : 'operational'

                      return (
                        <div
                          key={group.id}
                          className={cn('border', getBorderRadiusClass(publicData?.borderRadius || config.borderRadius))}
                          style={{ backgroundColor: publicData?.cardBackground || config.cardBackground }}
                        >
                          <button
                            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                            onClick={() => toggleGroup(group.id)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="font-medium">{group.name}</span>
                              <Badge variant="secondary">{group.monitors.length} services</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(groupStatus)}
                              <span className="text-sm text-muted-foreground">
                                {getStatusLabel(groupStatus)}
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t divide-y">
                              {group.monitors.map((monitor) => (
                                <div key={monitor.id} className="flex items-center justify-between p-4 pl-12">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      'h-2 w-2 rounded-full',
                                      getStatusDotClass(monitor.status)
                                    )} />
                                    <span>{monitor.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {config.showUptime && (
                                      <span className="text-sm text-muted-foreground">
                                        {monitor.uptime.toFixed(2)}% uptime
                                      </span>
                                    )}
                                    <Badge variant={getMonitorBadgeVariant(monitor.status)}>
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

                    {/* Ungrouped monitors */}
                    {ungroupedMonitors.length > 0 && (
                      <div
                        className={cn('border', getBorderRadiusClass(publicData?.borderRadius || config.borderRadius))}
                        style={{ backgroundColor: publicData?.cardBackground || config.cardBackground }}
                      >
                        <button
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                          onClick={() => toggleGroup('__ungrouped__')}
                        >
                          <div className="flex items-center gap-3">
                            {expandedGroups.includes('__ungrouped__') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-medium">Other services</span>
                            <Badge variant="secondary">{ungroupedMonitors.length} services</Badge>
                          </div>
                        </button>

                        {expandedGroups.includes('__ungrouped__') && (
                          <div className="border-t divide-y">
                            {ungroupedMonitors.map((monitor) => (
                              <div key={monitor.id} className="flex items-center justify-between p-4 pl-12">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'h-2 w-2 rounded-full',
                                    getStatusDotClass(monitor.status)
                                  )} />
                                  <span>{monitor.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {config.showUptime && (
                                    <span className="text-sm text-muted-foreground">
                                      {monitor.uptime.toFixed(2)}% uptime
                                    </span>
                                  )}
                                  <Badge variant={getMonitorBadgeVariant(monitor.status)}>
                                    {getStatusLabel(monitor.status)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {displayGroups.length === 0 && ungroupedMonitors.length === 0 && !previewLoading && (
                      <div className="text-center py-8 text-muted-foreground">
                        No services configured for the status page.
                      </div>
                    )}
                  </div>

                  {/* Uptime History */}
                  {config.showUptime && (
                    <div className="p-6 border-t">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-semibold">Uptime History ({WINDOW_LABELS[selectedPeriod]})</h3>
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
                      <UptimeBar data={uptimeData} days={windowToDays(selectedPeriod)} />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{getPeriodStartLabel(selectedPeriod)}</span>
                        <span>Today</span>
                      </div>

                      <div className="mt-6 space-y-4">
                        <h4 className="text-sm font-semibold text-muted-foreground">Timeline by monitor</h4>
                        {previewServiceGroups.map((group) => (
                          <div key={group.id} className="space-y-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.name}</p>
                            {group.monitors.map((monitor) => (
                              <div key={monitor.id} className="rounded-lg border p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium">{monitor.name}</p>
                                    <p className="text-xs text-muted-foreground">{monitor.uptime.toFixed(2)}% uptime</p>
                                  </div>
                                  <Badge variant={getMonitorBadgeVariant(monitor.status)}>
                                    {getStatusLabel(monitor.status)}
                                  </Badge>
                                </div>
                                <UptimeBar data={monitor.uptimeHistory || []} days={windowToDays(selectedPeriod)} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {maintenanceWindows.length > 0 && (
                    <div className="p-6 border-t">
                      <h3 className="font-semibold mb-4">Scheduled maintenance</h3>
                      <div className="space-y-4">
                        {maintenanceWindows.map((maintenance) => (
                          <div key={maintenance.id} className="border rounded-lg p-4">
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
                      </div>
                    </div>
                  )}

                  {/* Incidents */}
                  {config.showIncidents && incidents.length > 0 && (
                    <div className="p-6 border-t">
                      <h3 className="font-semibold mb-4">Recent incidents</h3>
                      <div className="space-y-4">
                        {incidents.map((incident) => {
                          const isExpanded = expandedIncidentIds.includes(incident.id)
                          const details = [
                            { label: 'Root cause', value: incident.rootCause },
                            { label: 'Impact', value: incident.impact },
                            { label: 'Resolution', value: incident.resolution },
                            { label: 'Preventive actions', value: incident.preventiveActions },
                          ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value))

                          return (
                          <div key={incident.id} className="border rounded-lg p-4">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-4 text-left"
                              onClick={() => toggleIncident(incident.id)}
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {incident.severity === 'maintenance' ? (
                                  <Wrench className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                                <span className="font-medium">{incident.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getIncidentBadgeVariant(incident.status)}>{incident.status}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(incident.startedAt)}
                                </span>
                              </div>
                            </button>
                            {incident.resolvedAt && (
                              <p className="text-sm text-muted-foreground mt-2 pl-6">
                                Resolved on {formatDate(incident.resolvedAt)}
                              </p>
                            )}
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
                      </div>
                    </div>
                  )}

                  {/* Subscribe */}
                  {config.subscribersEnabled && (
                    <div className="p-6 border-t text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        Receive notifications when incidents happen
                      </p>
                      <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                        <Input placeholder="you@example.com" className="max-w-xs" />
                        <Button>Subscribe</Button>
                      </div>
                    </div>
                  )}
                  {(publicData?.footerText || config.footerText) && (
                    <div className="p-6 border-t text-center text-sm text-muted-foreground">
                      {publicData?.footerText || config.footerText}
                    </div>
                  )}
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic configuration for your status page</CardDescription>
              </CardHeader>
              {configLoading ? (
                <CardContent>
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading...</span>
                  </div>
                </CardContent>
              ) : (
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Status page enabled</Label>
                    <p className="text-sm text-muted-foreground">
                      Make the page publicly accessible
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Page URL</Label>
                    <div className="flex items-center gap-2">
                      <Input value={publicStatusUrl} readOnly className="max-w-[260px]" />
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${window.location.origin}${publicStatusUrl}`)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom domain (optional)</Label>
                    <Input
                      placeholder="status.example.com"
                      value={config.customDomain || ''}
                      onChange={(e) => setConfig({ ...config, customDomain: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Configure a CNAME when you want to expose this page on your own domain.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Displayed Elements</h4>
                  
                  <div className="flex items-center justify-between">
                    <Label>Show uptime</Label>
                    <Switch
                      checked={config.showUptime}
                      onCheckedChange={(checked) => setConfig({ ...config, showUptime: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Show response time</Label>
                    <Switch
                      checked={config.showResponseTime}
                      onCheckedChange={(checked) => setConfig({ ...config, showResponseTime: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Show incident history</Label>
                    <Switch
                      checked={config.showIncidents}
                      onCheckedChange={(checked) => setConfig({ ...config, showIncidents: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable subscriptions</Label>
                    <Switch
                      checked={config.subscribersEnabled}
                      onCheckedChange={(checked) => setConfig({ ...config, subscribersEnabled: checked })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={saveConfig} disabled={saving}>
                    {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </div>
              </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* Customize Tab */}
          <TabsContent value="customize" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customization</CardTitle>
                <CardDescription>Customize your status page appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Branding</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Page title</Label>
                      <Input
                        value={config.title}
                        onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Logo URL (optional)</Label>
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={config.logoUrl || ''}
                        onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={config.description}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={config.theme}
                      onValueChange={(v) => setConfig({ ...config, theme: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">Automatic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Card radius</Label>
                    <Select
                      value={config.borderRadius}
                      onValueChange={(v) => setConfig({ ...config, borderRadius: v as StatusPageConfig['borderRadius'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Colors</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ['Accent color', 'accentColor'],
                      ['Page background', 'backgroundColor'],
                      ['Header background', 'headerBackground'],
                      ['Header text', 'headerTextColor'],
                      ['Card background', 'cardBackground'],
                    ].map(([label, key]) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={config[key as keyof StatusPageConfig] as string}
                            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={config[key as keyof StatusPageConfig] as string}
                            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                            className="max-w-[120px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Status messages</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Operational message</Label>
                      <Input
                        value={config.operationalMessage}
                        onChange={(e) => setConfig({ ...config, operationalMessage: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Degraded message</Label>
                      <Input
                        value={config.degradedMessage}
                        onChange={(e) => setConfig({ ...config, degradedMessage: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Major outage message</Label>
                      <Input
                        value={config.majorMessage}
                        onChange={(e) => setConfig({ ...config, majorMessage: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maintenance message</Label>
                      <Input
                        value={config.maintenanceMessage}
                        onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Footer text</Label>
                    <Input
                      placeholder="Example: Status updates are published by the SRE team."
                      value={config.footerText}
                      onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={saveConfig} disabled={saving}>
                    {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
