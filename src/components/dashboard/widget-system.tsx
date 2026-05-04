'use client'

import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  Timer,
  TrendingUp,
  X,
  Zap,
  Eye,
  Globe,
  Shield,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Widget types
// Note: 'regional-uptime' has been removed — the system only emits region: 'local'
// and does not have multi-region observability data.
export type WidgetType =
  | 'uptime-gauge'
  | 'response-time'
  | 'incidents-active'
  | 'kpi-mttr'
  | 'kpi-mttd'
  | 'error-budget'
  | 'service-status'
  | 'recent-activity'
  | 'top-issues'
  | 'incident-heatmap'
  | 'monitors-overview'
  | 'sla-progress'
  | 'maintenance-scheduled'

export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'tall'

export interface Widget {
  id: string
  type: WidgetType
  title: string
  size: WidgetSize
  enabled: boolean
  order: number
  config?: Record<string, any>
}

// Available widget templates
export const widgetTemplates: Omit<Widget, 'id' | 'order'>[] = [
  { type: 'uptime-gauge', title: 'Uptime Global', size: 'small', enabled: true },
  { type: 'response-time', title: 'Temps de réponse', size: 'wide', enabled: true },
  { type: 'incidents-active', title: 'Incidents actifs', size: 'small', enabled: true },
  { type: 'kpi-mttr', title: 'MTTR', size: 'small', enabled: true },
  { type: 'kpi-mttd', title: 'MTTD', size: 'small', enabled: true },
  { type: 'error-budget', title: 'Budget d\'erreur', size: 'small', enabled: true },
  { type: 'service-status', title: 'Statut des services', size: 'medium', enabled: true },
  { type: 'recent-activity', title: 'Activité récente', size: 'tall', enabled: true },
  { type: 'top-issues', title: 'Services à surveiller', size: 'medium', enabled: true },
  { type: 'incident-heatmap', title: 'Distribution incidents', size: 'wide', enabled: true },
  { type: 'monitors-overview', title: 'Aperçu monitors', size: 'large', enabled: true },
  { type: 'sla-progress', title: 'Objectifs SLA', size: 'medium', enabled: true },
  { type: 'maintenance-scheduled', title: 'Maintenances', size: 'small', enabled: true },
]

function getWidgetIcon(type: WidgetType) {
  switch (type) {
    case 'uptime-gauge': return <Activity className="h-4 w-4" />
    case 'response-time': return <Zap className="h-4 w-4" />
    case 'incidents-active': return <AlertTriangle className="h-4 w-4" />
    case 'kpi-mttr': return <Timer className="h-4 w-4" />
    case 'kpi-mttd': return <Eye className="h-4 w-4" />
    case 'error-budget': return <Shield className="h-4 w-4" />
    case 'service-status': return <CheckCircle2 className="h-4 w-4" />
    case 'recent-activity': return <Clock className="h-4 w-4" />
    case 'top-issues': return <TrendingUp className="h-4 w-4" />
    case 'incident-heatmap': return <BarChart3 className="h-4 w-4" />
    case 'monitors-overview': return <Globe className="h-4 w-4" />
    case 'sla-progress': return <Activity className="h-4 w-4" />
    case 'maintenance-scheduled': return <Calendar className="h-4 w-4" />
    default: return <LayoutGrid className="h-4 w-4" />
  }
}

function getSizeClasses(size: WidgetSize) {
  switch (size) {
    case 'small': return 'col-span-1 row-span-1'
    case 'medium': return 'col-span-1 row-span-2 lg:col-span-1'
    case 'large': return 'col-span-2 row-span-2 lg:col-span-2'
    case 'wide': return 'col-span-2 row-span-1 lg:col-span-2'
    case 'tall': return 'col-span-1 row-span-2'
    default: return 'col-span-1 row-span-1'
  }
}

interface WidgetWrapperProps {
  widget: Widget
  children: React.ReactNode
  onRemove: () => void
  onResize: (size: WidgetSize) => void
  onRefresh?: () => void
  isEditMode: boolean
}

export function WidgetWrapper({
  widget,
  children,
  onRemove,
  onResize,
  onRefresh,
  isEditMode,
}: WidgetWrapperProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Card
      className={cn(
        getSizeClasses(widget.size),
        'relative transition-all',
        isEditMode && 'ring-2 ring-dashed ring-primary/30 cursor-move',
        isHovered && isEditMode && 'ring-primary/50',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag Handle (Edit Mode) */}
      {isEditMode && (
        <div className="absolute top-2 left-2 z-10 cursor-move p-1 rounded bg-muted hover:bg-muted/80">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Widget Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {getWidgetIcon(widget.type)}
          {widget.title}
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRefresh && (
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onResize('small')}>
              <Minimize2 className="h-4 w-4 mr-2" />
              Petit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResize('medium')}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Moyen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResize('wide')}>
              <Maximize2 className="h-4 w-4 mr-2 rotate-90" />
              Large
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResize('large')}>
              <Maximize2 className="h-4 w-4 mr-2" />
              Grand
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <X className="h-4 w-4 mr-2" />
              Retirer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

interface AddWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddWidget: (type: WidgetType) => void
  existingWidgets: Widget[]
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  onAddWidget,
  existingWidgets,
}: AddWidgetDialogProps) {
  const existingTypes = existingWidgets.map((w) => w.type)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Ajouter un widget</DialogTitle>
          <DialogDescription>
            Sélectionnez un widget à ajouter à votre dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4 max-h-[400px] overflow-y-auto">
          {widgetTemplates.map((template) => {
            const isAdded = existingTypes.includes(template.type)
            return (
              <button
                key={template.type}
                onClick={() => {
                  if (!isAdded) {
                    onAddWidget(template.type)
                    onOpenChange(false)
                  }
                }}
                disabled={isAdded}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                  isAdded
                    ? 'opacity-50 cursor-not-allowed bg-muted'
                    : 'hover:bg-muted hover:border-primary/50'
                )}
              >
                <div className="p-2 rounded-md bg-primary/10">
                  {getWidgetIcon(template.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{template.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Taille: {template.size}
                  </p>
                  {isAdded && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Déjà ajouté
                    </Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface WidgetSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  widgets: Widget[]
  onToggleWidget: (id: string) => void
  onResetLayout: () => void
}

export function WidgetSettingsDialog({
  open,
  onOpenChange,
  widgets,
  onToggleWidget,
  onResetLayout,
}: WidgetSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configuration des widgets</DialogTitle>
          <DialogDescription>
            Activez ou désactivez les widgets de votre dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  {getWidgetIcon(widget.type)}
                </div>
                <div>
                  <p className="font-medium text-sm">{widget.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Taille: {widget.size}
                  </p>
                </div>
              </div>
              <Switch
                checked={widget.enabled}
                onCheckedChange={() => onToggleWidget(widget.id)}
              />
            </div>
          ))}
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onResetLayout}>
            Réinitialiser
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Dashboard Controls Component
interface DashboardControlsProps {
  isEditMode: boolean
  onToggleEditMode: () => void
  onAddWidget: () => void
  onOpenSettings: () => void
  onRefreshAll: () => void
}

export function DashboardControls({
  isEditMode,
  onToggleEditMode,
  onAddWidget,
  onOpenSettings,
  onRefreshAll,
}: DashboardControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onRefreshAll}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Actualiser
      </Button>
      <Button variant="outline" size="sm" onClick={onOpenSettings}>
        <Settings className="h-4 w-4 mr-2" />
        Widgets
      </Button>
      <Button
        variant={isEditMode ? 'default' : 'outline'}
        size="sm"
        onClick={onToggleEditMode}
      >
        <LayoutGrid className="h-4 w-4 mr-2" />
        {isEditMode ? 'Terminer' : 'Éditer'}
      </Button>
      {isEditMode && (
        <Button size="sm" onClick={onAddWidget}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      )}
    </div>
  )
}
