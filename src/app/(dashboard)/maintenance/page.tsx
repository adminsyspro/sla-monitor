'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatDate } from '@/lib/utils'

interface MaintenanceWindow {
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

function getStatusBadge(status: MaintenanceWindow['status']) {
  switch (status) {
    case 'scheduled':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Scheduled
        </Badge>
      )
    case 'in_progress':
      return (
        <Badge variant="default" className="gap-1 bg-blue-500">
          <Wrench className="h-3 w-3 animate-pulse" />
          En cours
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="operational" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge variant="destructive" className="gap-1">
          Canceled
        </Badge>
      )
  }
}

function formatDuration(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)

  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes}min`
}

function getTimeUntil(date: string): string {
  const now = new Date()
  const target = new Date(date)
  const diffMs = target.getTime() - now.getTime()

  if (diffMs < 0) return 'Past'

  const days = Math.floor(diffMs / 86400000)
  const hours = Math.floor((diffMs % 86400000) / 3600000)

  if (days > 0) return `Dans ${days}j ${hours}h`
  if (hours > 0) return `Dans ${hours}h`
  return 'Imminent'
}

export default function MaintenancePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed'>('all')
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newMaintenance, setNewMaintenance] = useState({
    title: '',
    description: '',
    scheduledStart: '',
    scheduledEnd: '',
  })

  async function fetchMaintenance() {
    try {
      setLoading(true)
      const res = await fetch('/api/maintenance')
      if (res.ok) {
        const data = await res.json()
        setMaintenanceWindows(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch maintenance windows:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMaintenance()
  }, [])

  async function handleCreate() {
    if (!newMaintenance.title || !newMaintenance.scheduledStart || !newMaintenance.scheduledEnd) return
    try {
      setCreating(true)
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newMaintenance.title,
          description: newMaintenance.description || undefined,
          scheduledStart: new Date(newMaintenance.scheduledStart).toISOString(),
          scheduledEnd: new Date(newMaintenance.scheduledEnd).toISOString(),
        }),
      })
      if (res.ok) {
        setCreateDialogOpen(false)
        setNewMaintenance({ title: '', description: '', scheduledStart: '', scheduledEnd: '' })
        fetchMaintenance()
      }
    } catch (err) {
      console.error('Failed to create maintenance:', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleStart(id: string) {
    try {
      const res = await fetch(`/api/maintenance/${id}?action=start`, { method: 'PATCH' })
      if (res.ok) fetchMaintenance()
    } catch (err) {
      console.error('Failed to start maintenance:', err)
    }
  }

  async function handleComplete(id: string) {
    try {
      const res = await fetch(`/api/maintenance/${id}?action=complete`, { method: 'PATCH' })
      if (res.ok) fetchMaintenance()
    } catch (err) {
      console.error('Failed to complete maintenance:', err)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' })
      if (res.ok) fetchMaintenance()
    } catch (err) {
      console.error('Failed to delete maintenance:', err)
    }
  }

  const filteredMaintenance = maintenanceWindows.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase())

    if (statusFilter === 'upcoming') {
      return matchesSearch && (m.status === 'scheduled' || m.status === 'in_progress')
    }
    if (statusFilter === 'completed') {
      return matchesSearch && (m.status === 'completed' || m.status === 'cancelled')
    }
    return matchesSearch
  })

  const upcomingCount = maintenanceWindows.filter(
    (m) => m.status === 'scheduled' || m.status === 'in_progress'
  ).length

  const completedCount = maintenanceWindows.filter((m) => m.status === 'completed').length
  const inProgressCount = maintenanceWindows.filter((m) => m.status === 'in_progress').length

  // Compute total maintenance time for completed windows
  const totalMinutes = maintenanceWindows
    .filter((m) => m.status === 'completed' && m.actualStart && m.actualEnd)
    .reduce((sum, m) => {
      const diffMs = new Date(m.actualEnd!).getTime() - new Date(m.actualStart!).getTime()
      return sum + Math.max(0, diffMs / 60000)
    }, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalMins = Math.round(totalMinutes % 60)

  return (
    <>
      <Header title="Scheduled Maintenance" />
      <main className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingCount}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Wrench className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                  <p className="text-sm text-muted-foreground">En cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedCount}</p>
                  <p className="text-sm text-muted-foreground">Completed this month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Clock className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalHours}h {totalMins}m</p>
                  <p className="text-sm text-muted-foreground">Total time this month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search maintenance..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Toutes</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Planifier
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Loading maintenance windows...</p>
          </div>
        ) : (
          /* Maintenance List */
          <div className="space-y-4">
            {filteredMaintenance.length > 0 ? (
              filteredMaintenance.map((maintenance) => (
                <Card key={maintenance.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{maintenance.title}</h3>
                              {getStatusBadge(maintenance.status)}
                            </div>
                            {maintenance.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {maintenance.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Schedule Info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(maintenance.scheduledStart).toLocaleDateString('en-US', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              {new Date(maintenance.scheduledStart).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' → '}
                              {new Date(maintenance.scheduledEnd).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <Badge variant="outline">
                            Duration: {formatDuration(maintenance.scheduledStart, maintenance.scheduledEnd)}
                          </Badge>
                          {maintenance.status === 'scheduled' && (
                            <Badge variant="secondary" className="text-blue-500">
                              {getTimeUntil(maintenance.scheduledStart)}
                            </Badge>
                          )}
                        </div>

                        {/* Affected Services */}
                        {maintenance.affectedMonitors.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">Affected services:</span>
                            <Badge variant="secondary">
                              {maintenance.affectedMonitors.length} affected service{maintenance.affectedMonitors.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}

                        {/* Actual duration for completed */}
                        {maintenance.status === 'completed' && maintenance.actualStart && maintenance.actualEnd && (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>
                              Completed in {formatDuration(maintenance.actualStart, maintenance.actualEnd)}
                              {' '}
                              (planned: {formatDuration(maintenance.scheduledStart, maintenance.scheduledEnd)})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {maintenance.status === 'scheduled' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleStart(maintenance.id)}>
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(maintenance.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {maintenance.status === 'in_progress' && (
                          <Button variant="outline" size="sm" onClick={() => handleComplete(maintenance.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No scheduled maintenance</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Schedule a maintenance window to inform your users
                </p>
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Planifier une maintenance
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create Maintenance Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Planifier une maintenance</DialogTitle>
              <DialogDescription>
                Create a new scheduled maintenance window.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  placeholder="Example: Database update"
                  value={newMaintenance.title}
                  onChange={(e) => setNewMaintenance((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the planned work..."
                  value={newMaintenance.description}
                  onChange={(e) => setNewMaintenance((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledStart">Scheduled start</Label>
                  <Input
                    id="scheduledStart"
                    type="datetime-local"
                    value={newMaintenance.scheduledStart}
                    onChange={(e) => setNewMaintenance((prev) => ({ ...prev, scheduledStart: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledEnd">Scheduled end</Label>
                  <Input
                    id="scheduledEnd"
                    type="datetime-local"
                    value={newMaintenance.scheduledEnd}
                    onChange={(e) => setNewMaintenance((prev) => ({ ...prev, scheduledEnd: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !newMaintenance.title || !newMaintenance.scheduledStart || !newMaintenance.scheduledEnd}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Planifier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}
