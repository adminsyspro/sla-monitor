'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Table2,
  Timer,
  Trash2,
  User,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { formatDate, cn } from '@/lib/utils'
import type { Incident, IncidentStatus, IncidentSeverity, Monitor } from '@/types'

function getStatusIcon(status: IncidentStatus) {
  switch (status) {
    case 'resolved':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'monitoring':
      return <Eye className="h-4 w-4 text-yellow-500" />
    case 'identified':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />
    case 'investigating':
      return <Clock className="h-4 w-4 text-red-500 animate-pulse" />
  }
}

function getStatusLabel(status: IncidentStatus): string {
  switch (status) {
    case 'investigating': return 'Investigation'
    case 'identified': return 'Identified'
    case 'monitoring': return 'Monitoring'
    case 'resolved': return 'Resolved'
  }
}

function getSeverityConfig(severity: IncidentSeverity) {
  switch (severity) {
    case 'critical':
      return { label: 'Critical', color: 'bg-red-500', variant: 'destructive' as const }
    case 'major':
      return { label: 'Major', color: 'bg-orange-500', variant: 'default' as const }
    case 'minor':
      return { label: 'Minor', color: 'bg-yellow-500', variant: 'secondary' as const }
  }
}

function calculateDuration(start: string, end?: string): string {
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : new Date()
  const diffMs = endDate.getTime() - startDate.getTime()
  
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)
  
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

type RegistryForm = {
  owner: string
  tags: string
  rootCause: string
  impact: string
  resolution: string
  preventiveActions: string
  relatedIncidentIds: string[]
}

type ViewMode = 'cards' | 'table'

const emptyRegistryForm: RegistryForm = {
  owner: '',
  tags: '',
  rootCause: '',
  impact: '',
  resolution: '',
  preventiveActions: '',
  relatedIncidentIds: [],
}

function parseTagsInput(value: string) {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
}

function formatTagsInput(tags?: string[]) {
  return tags?.join(', ') || ''
}

function incidentToRegistryForm(incident: Incident): RegistryForm {
  return {
    owner: incident.owner || '',
    tags: formatTagsInput(incident.tags),
    rootCause: incident.rootCause || '',
    impact: incident.impact || '',
    resolution: incident.resolution || '',
    preventiveActions: incident.preventiveActions || '',
    relatedIncidentIds: incident.relatedIncidents?.map((related) => related.id) || [],
  }
}

function tokenize(value?: string) {
  return new Set((value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 3) || [])
}

function getIncidentMatchScore(source: Incident, candidate: Incident) {
  let score = 0
  const sourceTags = new Set(source.tags || [])
  const candidateTags = new Set(candidate.tags || [])
  for (const tag of sourceTags) {
    if (candidateTags.has(tag)) score += 4
  }

  const sourceMonitors = new Set(source.affectedMonitors)
  for (const monitorId of candidate.affectedMonitors) {
    if (sourceMonitors.has(monitorId)) score += 3
  }

  const sourceWords = tokenize(`${source.title} ${source.rootCause || ''} ${source.impact || ''}`)
  const candidateWords = tokenize(`${candidate.title} ${candidate.rootCause || ''} ${candidate.impact || ''}`)
  for (const word of sourceWords) {
    if (candidateWords.has(word)) score += 1
  }

  return score
}

export default function IncidentsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const [isRegistryDialogOpen, setIsRegistryDialogOpen] = useState(false)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  
  // Form states
  const [newIncident, setNewIncident] = useState({
    title: '',
    severity: 'minor' as IncidentSeverity,
    affectedMonitors: [] as string[],
    message: '',
    owner: '',
    tags: '',
    rootCause: '',
    impact: '',
    relatedIncidentIds: [] as string[],
  })
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateStatus, setUpdateStatus] = useState<IncidentStatus>('investigating')
  const [registryForm, setRegistryForm] = useState<RegistryForm>(emptyRegistryForm)

  // Fetch incidents from API
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents')
      if (res.ok) {
        const data = await res.json()
        setIncidents(data)
      }
    } catch (err) {
      console.error('Failed to fetch incidents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch monitors from API (for name lookup + create form)
  useEffect(() => {
    fetch('/api/monitors')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setMonitors(data))
      .catch(() => {})
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const searchable = [
        incident.title,
        incident.rootCause,
        incident.impact,
        incident.resolution,
        incident.preventiveActions,
        incident.owner,
        ...(incident.tags || []),
        ...(incident.relatedIncidents?.map((related) => related.title) || []),
      ].filter(Boolean).join(' ').toLowerCase()
      const matchesSearch = searchable.includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter
      const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter
      return matchesSearch && matchesStatus && matchesSeverity
    })
  }, [incidents, search, statusFilter, severityFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, severityFilter, pageSize, viewMode])

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedIncidents = filteredIncidents.slice(startIndex, startIndex + pageSize)
  const visibleStart = filteredIncidents.length === 0 ? 0 : startIndex + 1
  const visibleEnd = Math.min(startIndex + pageSize, filteredIncidents.length)

  // Stats
  const stats = useMemo(() => {
    const active = incidents.filter((i) => i.status !== 'resolved')
    const resolved = incidents.filter((i) => i.status === 'resolved')
    const critical = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved')
    
    // Calculate MTTR for resolved incidents
    const mttrMinutes = resolved.length > 0
      ? resolved.reduce((acc, inc) => {
          if (inc.resolvedAt) {
            const start = new Date(inc.startedAt).getTime()
            const end = new Date(inc.resolvedAt).getTime()
            return acc + (end - start) / 60000
          }
          return acc
        }, 0) / resolved.length
      : 0

    return {
      total: incidents.length,
      active: active.length,
      resolved: resolved.length,
      critical: critical.length,
      mttr: Math.round(mttrMinutes),
    }
  }, [incidents])

  const suggestedIncidents = useMemo(() => {
    if (!selectedIncident) return []

    const relatedIds = new Set(selectedIncident.relatedIncidents?.map((related) => related.id) || [])
    return incidents
      .filter((incident) => incident.id !== selectedIncident.id && !relatedIds.has(incident.id))
      .map((incident) => ({ incident, score: getIncidentMatchScore(selectedIncident, incident) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [incidents, selectedIncident])

  // Get monitor name by ID
  const getMonitorName = (id: string) => monitors.find((m) => m.id === id)?.name || `Monitor ${id}`

  // Create new incident
  const handleCreateIncident = async () => {
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIncident.title,
          severity: newIncident.severity,
          affectedMonitors: newIncident.affectedMonitors,
          message: newIncident.message || 'Investigation in progress.',
          owner: newIncident.owner,
          tags: parseTagsInput(newIncident.tags),
          rootCause: newIncident.rootCause,
          impact: newIncident.impact,
          relatedIncidentIds: newIncident.relatedIncidentIds,
        }),
      })
      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewIncident({
          title: '',
          severity: 'minor',
          affectedMonitors: [],
          message: '',
          owner: '',
          tags: '',
          rootCause: '',
          impact: '',
          relatedIncidentIds: [],
        })
        await fetchIncidents()
      }
    } catch (err) {
      console.error('Failed to create incident:', err)
    }
  }

  // Add update to incident
  const handleAddUpdate = async () => {
    if (!selectedIncident || !updateMessage.trim()) return

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          message: updateMessage,
        }),
      })
      if (res.ok) {
        setIsUpdateDialogOpen(false)
        setUpdateMessage('')
        // Refetch and update both the list and the selected incident
        const refreshedRes = await fetch('/api/incidents')
        if (refreshedRes.ok) {
          const refreshed: Incident[] = await refreshedRes.json()
          setIncidents(refreshed)
          const updated = refreshed.find((i) => i.id === selectedIncident.id)
          if (updated) setSelectedIncident(updated)
        }
      }
    } catch (err) {
      console.error('Failed to add update:', err)
    }
  }

  // Delete incident
  const handleDeleteIncident = async (id: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (selectedIncident?.id === id) {
          setSelectedIncident(null)
          setIsDetailSheetOpen(false)
        }
        await fetchIncidents()
      }
    } catch (err) {
      console.error('Failed to delete incident:', err)
    }
  }

  const openIncidentDetails = (incident: Incident) => {
    setSelectedIncident(incident)
    setIsDetailSheetOpen(true)
  }

  const openUpdateDialog = (incident: Incident) => {
    setSelectedIncident(incident)
    setUpdateStatus(incident.status === 'investigating' ? 'identified' : incident.status === 'identified' ? 'monitoring' : 'resolved')
    setIsUpdateDialogOpen(true)
  }

  const renderIncidentActions = (incident: Incident) => {
    const isActive = incident.status !== 'resolved'

    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              openUpdateDialog(incident)
            }}
          >
            <Edit className="h-4 w-4 mr-1" />
            Update
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openIncidentDetails(incident)}>
              <Eye className="h-4 w-4 mr-2" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openRegistryDialog(incident)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit registry data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteIncident(incident.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  const openRegistryDialog = (incident: Incident, relatedIncidentId?: string) => {
    const form = incidentToRegistryForm(incident)
    if (relatedIncidentId && !form.relatedIncidentIds.includes(relatedIncidentId)) {
      form.relatedIncidentIds = [...form.relatedIncidentIds, relatedIncidentId]
    }
    setSelectedIncident(incident)
    setRegistryForm(form)
    setIsRegistryDialogOpen(true)
  }

  const handleSaveRegistry = async () => {
    if (!selectedIncident) return

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: registryForm.owner,
          tags: parseTagsInput(registryForm.tags),
          rootCause: registryForm.rootCause,
          impact: registryForm.impact,
          resolution: registryForm.resolution,
          preventiveActions: registryForm.preventiveActions,
          relatedIncidentIds: registryForm.relatedIncidentIds,
        }),
      })
      if (res.ok) {
        const updated: Incident = await res.json()
        setIncidents((current) => current.map((incident) => incident.id === updated.id ? updated : incident))
        setSelectedIncident(updated)
        setIsRegistryDialogOpen(false)
      }
    } catch (err) {
      console.error('Failed to save incident registry data:', err)
    }
  }

  // Export functions
  const exportToCSV = () => {
    const headers = ['ID', 'Title', 'Severity', 'Status', 'Start', 'End', 'Duration', 'Owner', 'Tags', 'Affected services', 'Root cause', 'Impact', 'Resolution']
    const rows = filteredIncidents.map((inc) => [
      inc.id,
      inc.title,
      getSeverityConfig(inc.severity).label,
      getStatusLabel(inc.status),
      formatDate(inc.startedAt),
      inc.resolvedAt ? formatDate(inc.resolvedAt) : 'In progress',
      calculateDuration(inc.startedAt, inc.resolvedAt),
      inc.owner || '',
      inc.tags?.join('; ') || '',
      inc.affectedMonitors.map(getMonitorName).join('; '),
      inc.rootCause || '',
      inc.impact || '',
      inc.resolution || '',
    ])
    
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `incidents_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportToPDF = () => {
    // In real implementation, would use a library like jsPDF or call backend
    alert('PDF export requires a backend integration to generate the PDF.')
  }

  return (
    <>
      <Header title="Incidents" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.active > 0 ? 'border-yellow-500/50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.critical > 0 ? 'border-red-500/50 bg-red-500/5' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold text-green-500">{stats.resolved}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">MTTR</p>
                  <p className="text-2xl font-bold">{stats.mttr}min</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Timer className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="investigating" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Investigation
                </TabsTrigger>
                <TabsTrigger value="identified" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Identified
                </TabsTrigger>
                <TabsTrigger value="monitoring" className="gap-1">
                  <Eye className="h-3 w-3" />
                  Monitoring
                </TabsTrigger>
                <TabsTrigger value="resolved" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Resolved
                </TabsTrigger>
              </TabsList>
            </Tabs>

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

            <Separator orientation="vertical" className="h-8" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Export format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel / CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Report an incident
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] grid-rows-[auto,minmax(0,1fr),auto] sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Report a new incident</DialogTitle>
                  <DialogDescription>
                    Create a manual incident to inform teams and users.
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 space-y-4 overflow-y-auto py-4 pr-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Incident title</Label>
                    <Input
                      id="title"
                      placeholder="Example: High latency on the payment API"
                      value={newIncident.title}
                      onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                      value={newIncident.severity}
                      onValueChange={(v) => setNewIncident({ ...newIncident, severity: v as IncidentSeverity })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minor">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-yellow-500" />
                            Minor - Limited impact
                          </div>
                        </SelectItem>
                        <SelectItem value="major">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                            Major - Significant impact
                          </div>
                        </SelectItem>
                        <SelectItem value="critical">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                            Critical - Service unavailable
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Affected services</Label>
                    <Select
                      value={newIncident.affectedMonitors[0] || ''}
                      onValueChange={(v) => setNewIncident({ ...newIncident, affectedMonitors: [v] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {monitors.map((monitor) => (
                          <SelectItem key={monitor.id} value={monitor.id}>
                            {monitor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Initial message</Label>
                    <Textarea
                      id="message"
                      placeholder="Describe the observed issue..."
                      value={newIncident.message}
                      onChange={(e) => setNewIncident({ ...newIncident, message: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="owner">Owner</Label>
                      <Input
                        id="owner"
                        placeholder="Team or person accountable"
                        value={newIncident.owner}
                        onChange={(e) => setNewIncident({ ...newIncident, owner: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags</Label>
                      <Input
                        id="tags"
                        placeholder="database, latency, deploy"
                        value={newIncident.tags}
                        onChange={(e) => setNewIncident({ ...newIncident, tags: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="root-cause">Known or suspected root cause</Label>
                    <Textarea
                      id="root-cause"
                      placeholder="Optional context that can help correlate future incidents..."
                      value={newIncident.rootCause}
                      onChange={(e) => setNewIncident({ ...newIncident, rootCause: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="impact">Impact</Label>
                    <Textarea
                      id="impact"
                      placeholder="Users affected, symptoms, business impact..."
                      value={newIncident.impact}
                      onChange={(e) => setNewIncident({ ...newIncident, impact: e.target.value })}
                      rows={2}
                    />
                  </div>
                  {incidents.length > 0 && (
                    <div className="space-y-2">
                      <Label>Related incidents</Label>
                      <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg border p-2">
                        {incidents.slice(0, 8).map((incident) => {
                          const isSelected = newIncident.relatedIncidentIds.includes(incident.id)
                          return (
                            <Button
                              key={incident.id}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => setNewIncident({
                                ...newIncident,
                                relatedIncidentIds: isSelected
                                  ? newIncident.relatedIncidentIds.filter((id) => id !== incident.id)
                                  : [...newIncident.relatedIncidentIds, incident.id],
                              })}
                            >
                              {incident.title}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateIncident} disabled={!newIncident.title.trim()}>
                    Create incident
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Incidents List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading incidents...</p>
            </div>
          ) : filteredIncidents.length > 0 ? (
            <>
              {viewMode === 'cards' ? (
                paginatedIncidents.map((incident) => {
                  const severityConfig = getSeverityConfig(incident.severity)
                  const duration = calculateDuration(incident.startedAt, incident.resolvedAt)
                  const isActive = incident.status !== 'resolved'

                  return (
                    <Card
                      key={incident.id}
                      className={cn(
                        'transition-all hover:shadow-md cursor-pointer',
                        isActive && incident.severity === 'critical' && 'border-red-500/50 bg-red-500/5',
                        isActive && incident.severity === 'major' && 'border-orange-500/50',
                      )}
                      onClick={() => openIncidentDetails(incident)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className={cn('mt-1 p-1.5 rounded-full', `${severityConfig.color}/20`)}>
                                {getStatusIcon(incident.status)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold">{incident.title}</h3>
                                  <Badge variant={severityConfig.variant}>{severityConfig.label}</Badge>
                                  <Badge variant="outline">{getStatusLabel(incident.status)}</Badge>
                                  {incident.createdBy === 'system' && (
                                    <Badge variant="secondary" className="text-xs">Auto-detected</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {incident.updates[incident.updates.length - 1]?.message}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(incident.startedAt)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Timer className="h-4 w-4" />
                                Duration: {duration}
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                {incident.updates.length} update{incident.updates.length > 1 ? 's' : ''}
                              </div>
                              {incident.owner && (
                                <div className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  {incident.owner}
                                </div>
                              )}
                            </div>

                            {incident.affectedMonitors.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-muted-foreground">Services:</span>
                                {incident.affectedMonitors.map((id) => (
                                  <Badge key={id} variant="secondary">{getMonitorName(id)}</Badge>
                                ))}
                              </div>
                            )}
                            {((incident.tags?.length || 0) > 0 || (incident.relatedIncidents?.length || 0) > 0) && (
                              <div className="flex flex-wrap items-center gap-2">
                                {incident.tags?.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                ))}
                                {(incident.relatedIncidents?.length || 0) > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {incident.relatedIncidents?.length} related
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {renderIncidentActions(incident)}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Incident</th>
                            <th className="px-4 py-3 font-medium">Severity</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Owner</th>
                            <th className="px-4 py-3 font-medium">Services</th>
                            <th className="px-4 py-3 font-medium">Tags</th>
                            <th className="px-4 py-3 font-medium">Started</th>
                            <th className="px-4 py-3 font-medium">Duration</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedIncidents.map((incident) => {
                            const severityConfig = getSeverityConfig(incident.severity)
                            return (
                              <tr
                                key={incident.id}
                                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
                                onClick={() => openIncidentDetails(incident)}
                              >
                                <td className="max-w-[280px] px-4 py-3">
                                  <div className="flex items-start gap-2">
                                    {getStatusIcon(incident.status)}
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{incident.title}</p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {incident.updates[incident.updates.length - 1]?.message || 'No update yet'}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={severityConfig.variant}>{severityConfig.label}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline">{getStatusLabel(incident.status)}</Badge>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{incident.owner || 'Unassigned'}</td>
                                <td className="max-w-[180px] px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {incident.affectedMonitors.length > 0 ? (
                                      incident.affectedMonitors.slice(0, 2).map((id) => (
                                        <Badge key={id} variant="secondary" className="text-xs">{getMonitorName(id)}</Badge>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground">None</span>
                                    )}
                                    {incident.affectedMonitors.length > 2 && (
                                      <Badge variant="outline" className="text-xs">+{incident.affectedMonitors.length - 2}</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="max-w-[180px] px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(incident.tags?.length || 0) > 0 ? (
                                      incident.tags?.slice(0, 2).map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground">None</span>
                                    )}
                                    {(incident.tags?.length || 0) > 2 && (
                                      <Badge variant="secondary" className="text-xs">+{(incident.tags?.length || 0) - 2}</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(incident.startedAt)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                  {calculateDuration(incident.startedAt, incident.resolvedAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end">{renderIncidentActions(incident)}</div>
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
                  Showing {visibleStart}-{visibleEnd} of {filteredIncidents.length} incidents
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No incidents</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search || statusFilter !== 'all' || severityFilter !== 'all'
                  ? 'No incidents match your criteria'
                  : 'All systems are operating normally'}
              </p>
            </div>
          )}
        </div>

        {/* Update Dialog */}
        <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
          <DialogContent className="max-h-[90vh] grid-rows-[auto,minmax(0,1fr),auto] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Update incident</DialogTitle>
              <DialogDescription>
                {selectedIncident?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto py-4 pr-2">
              <div className="space-y-2">
                <Label>New status</Label>
                <Select value={updateStatus} onValueChange={(v) => setUpdateStatus(v as IncidentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investigating">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-red-500" />
                        Investigation
                      </div>
                    </SelectItem>
                    <SelectItem value="identified">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Identified
                      </div>
                    </SelectItem>
                    <SelectItem value="monitoring">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-yellow-500" />
                        Monitoring
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Resolved
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-message">Update message</Label>
                <Textarea
                  id="update-message"
                  placeholder="Describe resolution progress..."
                  value={updateMessage}
                  onChange={(e) => setUpdateMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUpdate} disabled={!updateMessage.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Publish update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Registry Dialog */}
        <Dialog open={isRegistryDialogOpen} onOpenChange={setIsRegistryDialogOpen}>
          <DialogContent className="max-h-[90vh] grid-rows-[auto,minmax(0,1fr),auto] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit incident registry data</DialogTitle>
              <DialogDescription>
                Add root cause, impact, ownership and links to similar incidents.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto py-4 pr-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="registry-owner">Owner</Label>
                  <Input
                    id="registry-owner"
                    placeholder="Team or person accountable"
                    value={registryForm.owner}
                    onChange={(e) => setRegistryForm({ ...registryForm, owner: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registry-tags">Tags</Label>
                  <Input
                    id="registry-tags"
                    placeholder="database, latency, deploy"
                    value={registryForm.tags}
                    onChange={(e) => setRegistryForm({ ...registryForm, tags: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registry-root-cause">Root cause</Label>
                <Textarea
                  id="registry-root-cause"
                  placeholder="What caused the incident?"
                  value={registryForm.rootCause}
                  onChange={(e) => setRegistryForm({ ...registryForm, rootCause: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registry-impact">Impact</Label>
                <Textarea
                  id="registry-impact"
                  placeholder="Who was affected and how?"
                  value={registryForm.impact}
                  onChange={(e) => setRegistryForm({ ...registryForm, impact: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registry-resolution">Resolution</Label>
                <Textarea
                  id="registry-resolution"
                  placeholder="What restored the service?"
                  value={registryForm.resolution}
                  onChange={(e) => setRegistryForm({ ...registryForm, resolution: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registry-preventive-actions">Preventive actions</Label>
                <Textarea
                  id="registry-preventive-actions"
                  placeholder="Follow-up actions that reduce recurrence risk..."
                  value={registryForm.preventiveActions}
                  onChange={(e) => setRegistryForm({ ...registryForm, preventiveActions: e.target.value })}
                  rows={3}
                />
              </div>
              {selectedIncident && incidents.filter((incident) => incident.id !== selectedIncident.id).length > 0 && (
                <div className="space-y-2">
                  <Label>Related incidents</Label>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border p-2">
                    {incidents
                      .filter((incident) => incident.id !== selectedIncident.id)
                      .map((incident) => {
                        const isSelected = registryForm.relatedIncidentIds.includes(incident.id)
                        return (
                          <Button
                            key={incident.id}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className="w-full justify-between"
                            onClick={() => setRegistryForm({
                              ...registryForm,
                              relatedIncidentIds: isSelected
                                ? registryForm.relatedIncidentIds.filter((id) => id !== incident.id)
                                : [...registryForm.relatedIncidentIds, incident.id],
                            })}
                          >
                            <span className="truncate">{incident.title}</span>
                            <Badge variant={getSeverityConfig(incident.severity).variant}>
                              {getSeverityConfig(incident.severity).label}
                            </Badge>
                          </Button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRegistryDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRegistry}>
                Save registry data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Sheet */}
        <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedIncident && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedIncident.status)}
                    <SheetTitle>{selectedIncident.title}</SheetTitle>
                  </div>
                  <SheetDescription>
                    ID: {selectedIncident.id}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status & Severity */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getSeverityConfig(selectedIncident.severity).variant}>
                      {getSeverityConfig(selectedIncident.severity).label}
                    </Badge>
                    <Badge variant="outline">{getStatusLabel(selectedIncident.status)}</Badge>
                    {selectedIncident.createdBy === 'system' && (
                      <Badge variant="secondary">Auto-detected</Badge>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Start</p>
                      <p className="font-medium">{formatDate(selectedIncident.startedAt)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">
                        {calculateDuration(selectedIncident.startedAt, selectedIncident.resolvedAt)}
                      </p>
                    </div>
                    {selectedIncident.resolvedAt && (
                      <div className="rounded-lg border p-3 col-span-2">
                        <p className="text-sm text-muted-foreground">Resolved on</p>
                        <p className="font-medium">{formatDate(selectedIncident.resolvedAt)}</p>
                      </div>
                    )}
                  </div>

                  {/* Affected Services */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Affected Services</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedIncident.affectedMonitors.length > 0 ? (
                        selectedIncident.affectedMonitors.map((id) => (
                          <Badge key={id} variant="secondary">{getMonitorName(id)}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No service specified</span>
                      )}
                    </div>
                  </div>

                  {/* Registry Data */}
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-medium">Incident registry</h4>
                        <p className="text-sm text-muted-foreground">Analysis fields used to correlate recurring causes.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openRegistryDialog(selectedIncident)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Owner</p>
                        <p className="font-medium">{selectedIncident.owner || 'Unassigned'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tags</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(selectedIncident.tags?.length || 0) > 0 ? (
                            selectedIncident.tags?.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No tags</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedIncident.rootCause && (
                      <div>
                        <p className="text-sm font-medium">Root cause</p>
                        <p className="mt-1 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                          {selectedIncident.rootCause}
                        </p>
                      </div>
                    )}
                    {selectedIncident.impact && (
                      <div>
                        <p className="text-sm font-medium">Impact</p>
                        <p className="mt-1 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                          {selectedIncident.impact}
                        </p>
                      </div>
                    )}
                    {selectedIncident.resolution && (
                      <div>
                        <p className="text-sm font-medium">Resolution</p>
                        <p className="mt-1 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                          {selectedIncident.resolution}
                        </p>
                      </div>
                    )}
                    {selectedIncident.preventiveActions && (
                      <div>
                        <p className="text-sm font-medium">Preventive actions</p>
                        <p className="mt-1 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                          {selectedIncident.preventiveActions}
                        </p>
                      </div>
                    )}
                    {(selectedIncident.relatedIncidents?.length || 0) > 0 && (
                      <div>
                        <p className="text-sm font-medium">Related incidents</p>
                        <div className="mt-2 space-y-2">
                          {selectedIncident.relatedIncidents?.map((related) => (
                            <button
                              key={related.id}
                              type="button"
                              className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
                              onClick={() => {
                                const incident = incidents.find((candidate) => candidate.id === related.id)
                                if (incident) setSelectedIncident(incident)
                              }}
                            >
                              <span>{related.title}</span>
                              <div className="flex gap-2">
                                <Badge variant={getSeverityConfig(related.severity).variant}>{getSeverityConfig(related.severity).label}</Badge>
                                <Badge variant="outline">{getStatusLabel(related.status)}</Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {suggestedIncidents.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">Potential matches</p>
                        <div className="mt-2 space-y-2">
                          {suggestedIncidents.map(({ incident, score }) => (
                            <div key={incident.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{incident.title}</p>
                                <p className="text-xs text-muted-foreground">Match score: {score}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRegistryDialog(selectedIncident, incident.id)}
                              >
                                Link
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Postmortem */}
                  {selectedIncident.postmortem && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Post-mortem</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                        {selectedIncident.postmortem}
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Update History</h4>
                      {selectedIncident.status !== 'resolved' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setUpdateStatus(
                              selectedIncident.status === 'investigating'
                                ? 'identified'
                                : selectedIncident.status === 'identified'
                                ? 'monitoring'
                                : 'resolved'
                            )
                            setIsUpdateDialogOpen(true)
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>

                    <div className="relative space-y-4">
                      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                      {selectedIncident.updates.slice().reverse().map((update) => (
                        <div key={update.id} className="relative flex gap-4 pl-0">
                          <div className={cn(
                            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background',
                          )}>
                            {getStatusIcon(update.status)}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {getStatusLabel(update.status)}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {update.createdBy}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(update.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm">{update.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => openRegistryDialog(selectedIncident)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit registry
                    </Button>
                    {selectedIncident.status !== 'resolved' && (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setUpdateStatus(
                            selectedIncident.status === 'investigating'
                              ? 'identified'
                              : selectedIncident.status === 'identified'
                              ? 'monitoring'
                              : 'resolved'
                          )
                          setIsUpdateDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Update
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel / CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          PDF report
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </main>
    </>
  )
}
