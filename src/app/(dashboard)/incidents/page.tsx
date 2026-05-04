'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Timer,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
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
import type { Incident, IncidentStatus, IncidentSeverity, IncidentUpdate, Monitor } from '@/types'

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
    case 'identified': return 'Identifié'
    case 'monitoring': return 'Surveillance'
    case 'resolved': return 'Résolu'
  }
}

function getSeverityConfig(severity: IncidentSeverity) {
  switch (severity) {
    case 'critical':
      return { label: 'Critique', color: 'bg-red-500', variant: 'destructive' as const }
    case 'major':
      return { label: 'Majeur', color: 'bg-orange-500', variant: 'default' as const }
    case 'minor':
      return { label: 'Mineur', color: 'bg-yellow-500', variant: 'secondary' as const }
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
    return `${days}j ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

export default function IncidentsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all')
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  
  // Form states
  const [newIncident, setNewIncident] = useState({
    title: '',
    severity: 'minor' as IncidentSeverity,
    affectedMonitors: [] as string[],
    message: '',
  })
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateStatus, setUpdateStatus] = useState<IncidentStatus>('investigating')

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
      const matchesSearch = incident.title.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter
      const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter
      return matchesSearch && matchesStatus && matchesSeverity
    })
  }, [incidents, search, statusFilter, severityFilter])

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
          message: newIncident.message || 'Investigation en cours.',
        }),
      })
      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewIncident({ title: '', severity: 'minor', affectedMonitors: [], message: '' })
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

  // Export functions
  const exportToCSV = () => {
    const headers = ['ID', 'Titre', 'Sévérité', 'Statut', 'Début', 'Fin', 'Durée', 'Services affectés', 'Cause racine']
    const rows = filteredIncidents.map((inc) => [
      inc.id,
      inc.title,
      getSeverityConfig(inc.severity).label,
      getStatusLabel(inc.status),
      formatDate(inc.startedAt),
      inc.resolvedAt ? formatDate(inc.resolvedAt) : 'En cours',
      calculateDuration(inc.startedAt, inc.resolvedAt),
      inc.affectedMonitors.map(getMonitorName).join('; '),
      inc.rootCause || '',
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
    alert('Export PDF : Cette fonctionnalité nécessite une intégration backend pour générer le PDF.')
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
                  <p className="text-sm text-muted-foreground">Actifs</p>
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
                  <p className="text-sm text-muted-foreground">Critiques</p>
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
                  <p className="text-sm text-muted-foreground">Résolus</p>
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
                placeholder="Rechercher un incident..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Sévérité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
                <SelectItem value="major">Majeur</SelectItem>
                <SelectItem value="minor">Mineur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="investigating" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Investigation
                </TabsTrigger>
                <TabsTrigger value="identified" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Identifié
                </TabsTrigger>
                <TabsTrigger value="monitoring" className="gap-1">
                  <Eye className="h-3 w-3" />
                  Surveillance
                </TabsTrigger>
                <TabsTrigger value="resolved" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Résolu
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Separator orientation="vertical" className="h-8" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Format d'export</DropdownMenuLabel>
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
                  Déclarer un incident
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Déclarer un nouvel incident</DialogTitle>
                  <DialogDescription>
                    Créez un incident manuel pour informer les équipes et les utilisateurs.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre de l'incident</Label>
                    <Input
                      id="title"
                      placeholder="Ex: Latence élevée sur l'API de paiement"
                      value={newIncident.title}
                      onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sévérité</Label>
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
                            Mineur - Impact limité
                          </div>
                        </SelectItem>
                        <SelectItem value="major">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                            Majeur - Impact significatif
                          </div>
                        </SelectItem>
                        <SelectItem value="critical">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                            Critique - Service indisponible
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Services affectés</Label>
                    <Select
                      value={newIncident.affectedMonitors[0] || ''}
                      onValueChange={(v) => setNewIncident({ ...newIncident, affectedMonitors: [v] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un service" />
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
                    <Label htmlFor="message">Message initial</Label>
                    <Textarea
                      id="message"
                      placeholder="Décrivez le problème observé..."
                      value={newIncident.message}
                      onChange={(e) => setNewIncident({ ...newIncident, message: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateIncident} disabled={!newIncident.title.trim()}>
                    Créer l'incident
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
              <p className="mt-4 text-sm text-muted-foreground">Chargement des incidents...</p>
            </div>
          ) : filteredIncidents.length > 0 ? (
            filteredIncidents.map((incident) => {
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
                  onClick={() => {
                    setSelectedIncident(incident)
                    setIsDetailSheetOpen(true)
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Header */}
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
                                <Badge variant="secondary" className="text-xs">Auto-détecté</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {incident.updates[incident.updates.length - 1]?.message}
                            </p>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(incident.startedAt)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Timer className="h-4 w-4" />
                            Durée: {duration}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            {incident.updates.length} mise{incident.updates.length > 1 ? 's' : ''} à jour
                          </div>
                        </div>

                        {/* Affected services */}
                        {incident.affectedMonitors.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">Services:</span>
                            {incident.affectedMonitors.map((id) => (
                              <Badge key={id} variant="secondary">{getMonitorName(id)}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedIncident(incident)
                              setUpdateStatus(incident.status === 'investigating' ? 'identified' : incident.status === 'identified' ? 'monitoring' : 'resolved')
                              setIsUpdateDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Mettre à jour
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedIncident(incident)
                              setIsDetailSheetOpen(true)
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir les détails
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ArrowUpRight className="h-4 w-4 mr-2" />
                              Ouvrir dans un nouvel onglet
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteIncident(incident.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Aucun incident</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search || statusFilter !== 'all' || severityFilter !== 'all'
                  ? 'Aucun incident ne correspond à vos critères'
                  : 'Tous les systèmes fonctionnent normalement'}
              </p>
            </div>
          )}
        </div>

        {/* Update Dialog */}
        <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Mettre à jour l'incident</DialogTitle>
              <DialogDescription>
                {selectedIncident?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nouveau statut</Label>
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
                        Identifié
                      </div>
                    </SelectItem>
                    <SelectItem value="monitoring">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-yellow-500" />
                        Surveillance
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Résolu
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-message">Message de mise à jour</Label>
                <Textarea
                  id="update-message"
                  placeholder="Décrivez l'avancement de la résolution..."
                  value={updateMessage}
                  onChange={(e) => setUpdateMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddUpdate} disabled={!updateMessage.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Publier la mise à jour
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
                      <Badge variant="secondary">Auto-détecté</Badge>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Début</p>
                      <p className="font-medium">{formatDate(selectedIncident.startedAt)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Durée</p>
                      <p className="font-medium">
                        {calculateDuration(selectedIncident.startedAt, selectedIncident.resolvedAt)}
                      </p>
                    </div>
                    {selectedIncident.resolvedAt && (
                      <div className="rounded-lg border p-3 col-span-2">
                        <p className="text-sm text-muted-foreground">Résolu le</p>
                        <p className="font-medium">{formatDate(selectedIncident.resolvedAt)}</p>
                      </div>
                    )}
                  </div>

                  {/* Affected Services */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Services affectés</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedIncident.affectedMonitors.length > 0 ? (
                        selectedIncident.affectedMonitors.map((id) => (
                          <Badge key={id} variant="secondary">{getMonitorName(id)}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Aucun service spécifié</span>
                      )}
                    </div>
                  </div>

                  {/* Root Cause */}
                  {selectedIncident.rootCause && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Cause racine</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                        {selectedIncident.rootCause}
                      </p>
                    </div>
                  )}

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
                      <h4 className="font-medium">Historique des mises à jour</h4>
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
                          Ajouter
                        </Button>
                      )}
                    </div>

                    <div className="relative space-y-4">
                      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                      {selectedIncident.updates.slice().reverse().map((update, index) => (
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
                        Mettre à jour
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Exporter
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel / CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          PDF (Rapport)
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
