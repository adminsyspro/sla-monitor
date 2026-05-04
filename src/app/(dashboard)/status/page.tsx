'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { UptimeBar, generateDemoUptimeData } from '@/components/monitors/uptime-bar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// app store used for theme/sidebar only
import { cn, formatDate } from '@/lib/utils'

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
  title: 'État des services',
  description: 'Surveillez la disponibilité de nos services en temps réel',
  theme: 'auto',
  accentColor: '#3b82f6',
  showUptime: true,
  showResponseTime: true,
  showIncidents: true,
  subscribersEnabled: false,
}

// Service groups for public status page
interface ServiceGroup {
  id: string
  name: string
  monitors: {
    id: string
    name: string
    status: string
    uptime: number
  }[]
}

interface PublicIncident {
  id: string
  title: string
  status: string
  severity: string
  startedAt: string
  resolvedAt?: string
}

interface PublicData {
  title: string
  description: string
  theme: string
  accentColor: string
  overallStatus: 'operational' | 'degraded' | 'major' | 'maintenance'
  groups: ServiceGroup[]
  ungroupedMonitors: { id: string; name: string; status: string; uptime: number }[]
  incidents: PublicIncident[]
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
    case 'operational': return 'Opérationnel'
    case 'degraded': return 'Performances dégradées'
    case 'partial': return 'Panne partielle'
    case 'major': return 'Panne majeure'
    case 'maintenance': return 'Maintenance'
    default: return 'Inconnu'
  }
}

export default function StatusPageAdmin() {
  const [config, setConfig] = useState<StatusPageConfig>(defaultConfig)
  const [activeTab, setActiveTab] = useState('preview')
  const [publicData, setPublicData] = useState<PublicData | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [configLoading, setConfigLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const uptimeData = useMemo(() => generateDemoUptimeData(90), [])

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
    fetch('/api/status-page/public')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        setPublicData(data)
        const allGroupIds = (data.groups || []).map((g: ServiceGroup) => g.id)
        if (data.ungroupedMonitors?.length) allGroupIds.push('__ungrouped__')
        setExpandedGroups(allGroupIds)
      })
      .catch(() => {})
      .finally(() => setPreviewLoading(false))
  }, [])

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

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <Header title="Page de statut" />
      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Configuration de la page de statut publique</h2>
            <p className="text-sm text-muted-foreground">
              Personnalisez et gérez votre page de statut accessible à vos utilisateurs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={`https://${config.customDomain || config.subdomain + '.slamonitor.com'}`} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir la page
              </a>
            </Button>
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Aperçu
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="customize" className="gap-2">
              <Palette className="h-4 w-4" />
              Personnalisation
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardContent className="p-0">
                {previewLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Chargement...</span>
                  </div>
                ) : (
                <div className="border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 text-center">
                    <h1 className="text-2xl font-bold">{publicData?.title || config.title}</h1>
                    <p className="text-muted-foreground mt-1">{publicData?.description || config.description}</p>
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
                        {overallStatus === 'operational' ? 'Tous les systèmes sont opérationnels' :
                         overallStatus === 'degraded' ? 'Certains systèmes rencontrent des problèmes' :
                         overallStatus === 'maintenance' ? 'Maintenance en cours' :
                         'Des problèmes affectent nos services'}
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
                        <div key={group.id} className="border rounded-lg">
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
                                      monitor.status === 'operational' ? 'bg-green-500' :
                                      monitor.status === 'degraded' ? 'bg-yellow-500' :
                                      monitor.status === 'maintenance' ? 'bg-blue-500' : 'bg-red-500'
                                    )} />
                                    <span>{monitor.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {config.showUptime && (
                                      <span className="text-sm text-muted-foreground">
                                        {monitor.uptime.toFixed(2)}% uptime
                                      </span>
                                    )}
                                    <Badge
                                      variant={
                                        monitor.status === 'operational' ? 'operational' :
                                        monitor.status === 'degraded' ? 'degraded' :
                                        monitor.status === 'maintenance' ? 'maintenance' : 'destructive'
                                      }
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

                    {/* Ungrouped monitors */}
                    {ungroupedMonitors.length > 0 && (
                      <div className="border rounded-lg">
                        <button
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                          onClick={() => toggleGroup('__ungrouped__')}
                        >
                          <div className="flex items-center gap-3">
                            {expandedGroups.includes('__ungrouped__') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-medium">Autres services</span>
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
                                    monitor.status === 'operational' ? 'bg-green-500' :
                                    monitor.status === 'degraded' ? 'bg-yellow-500' :
                                    monitor.status === 'maintenance' ? 'bg-blue-500' : 'bg-red-500'
                                  )} />
                                  <span>{monitor.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {config.showUptime && (
                                    <span className="text-sm text-muted-foreground">
                                      {monitor.uptime.toFixed(2)}% uptime
                                    </span>
                                  )}
                                  <Badge
                                    variant={
                                      monitor.status === 'operational' ? 'operational' :
                                      monitor.status === 'degraded' ? 'degraded' :
                                      monitor.status === 'maintenance' ? 'maintenance' : 'destructive'
                                    }
                                  >
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
                        Aucun service configuré pour la page de statut.
                      </div>
                    )}
                  </div>

                  {/* Uptime History */}
                  {config.showUptime && (
                    <div className="p-6 border-t">
                      <h3 className="font-semibold mb-4">Historique de disponibilité (90 jours)</h3>
                      <UptimeBar data={uptimeData} />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>Il y a 90 jours</span>
                        <span>Aujourd'hui</span>
                      </div>
                    </div>
                  )}

                  {/* Active Incidents */}
                  {config.showIncidents && incidents.length > 0 && (
                    <div className="p-6 border-t">
                      <h3 className="font-semibold mb-4">Incidents en cours</h3>
                      <div className="space-y-4">
                        {incidents.map((incident) => (
                          <div key={incident.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {incident.severity === 'maintenance' ? (
                                  <Wrench className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                                <span className="font-medium">{incident.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{incident.status}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(incident.startedAt)}
                                </span>
                              </div>
                            </div>
                            {incident.resolvedAt && (
                              <p className="text-sm text-muted-foreground mt-2 pl-6">
                                Résolu le {formatDate(incident.resolvedAt)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subscribe */}
                  {config.subscribersEnabled && (
                    <div className="p-6 border-t text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        Recevez des notifications en cas d'incident
                      </p>
                      <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                        <Input placeholder="votre@email.com" className="max-w-xs" />
                        <Button>S'abonner</Button>
                      </div>
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
                <CardTitle>Paramètres généraux</CardTitle>
                <CardDescription>Configuration de base de votre page de statut</CardDescription>
              </CardHeader>
              {configLoading ? (
                <CardContent>
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Chargement...</span>
                  </div>
                </CardContent>
              ) : (
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Page de statut activée</Label>
                    <p className="text-sm text-muted-foreground">
                      Rendre la page accessible publiquement
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
                    <Label>URL de la page</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={config.subdomain}
                        onChange={(e) => setConfig({ ...config, subdomain: e.target.value })}
                        className="max-w-[200px]"
                      />
                      <span className="text-muted-foreground">.slamonitor.com</span>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`https://${config.subdomain}.slamonitor.com`)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Domaine personnalisé (optionnel)</Label>
                    <Input
                      placeholder="status.votredomaine.com"
                      value={config.customDomain || ''}
                      onChange={(e) => setConfig({ ...config, customDomain: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Configurez un CNAME vers status.slamonitor.com
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Éléments affichés</h4>
                  
                  <div className="flex items-center justify-between">
                    <Label>Afficher l'uptime</Label>
                    <Switch
                      checked={config.showUptime}
                      onCheckedChange={(checked) => setConfig({ ...config, showUptime: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Afficher le temps de réponse</Label>
                    <Switch
                      checked={config.showResponseTime}
                      onCheckedChange={(checked) => setConfig({ ...config, showResponseTime: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Afficher l'historique des incidents</Label>
                    <Switch
                      checked={config.showIncidents}
                      onCheckedChange={(checked) => setConfig({ ...config, showIncidents: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Activer les abonnements</Label>
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
                    Enregistrer
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
                <CardTitle>Personnalisation</CardTitle>
                <CardDescription>Adaptez l'apparence de votre page de statut</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Titre de la page</Label>
                    <Input
                      value={config.title}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Thème</Label>
                    <Select
                      value={config.theme}
                      onValueChange={(v) => setConfig({ ...config, theme: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Clair</SelectItem>
                        <SelectItem value="dark">Sombre</SelectItem>
                        <SelectItem value="auto">Automatique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={config.description}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Couleur d'accent</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={config.accentColor}
                      onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                      className="max-w-[120px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>URL du logo (optionnel)</Label>
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={config.logoUrl || ''}
                    onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={saveConfig} disabled={saving}>
                    {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Enregistrer
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
