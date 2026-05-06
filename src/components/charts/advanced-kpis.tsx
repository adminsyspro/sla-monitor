'use client'

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  Eye,
  Gauge,
  RefreshCw,
  Shield,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
    isPositive: boolean
  }
  icon: React.ElementType
  iconColor?: string
  progress?: {
    value: number
    max: number
    color?: string
  }
  status?: 'success' | 'warning' | 'danger' | 'neutral'
}

function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = 'text-primary',
  progress,
  status = 'neutral',
}: KPICardProps) {
  const statusColors = {
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    danger: 'border-l-red-500',
    neutral: 'border-l-primary',
  }

  return (
    <Card className={cn('border-l-4', statusColors[status])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  trend.isPositive ? 'text-green-500' : 'text-red-500'
                )}
              >
                {trend.isPositive ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                <span>{trend.value}%</span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div
            className={cn(
              'rounded-lg p-2 bg-muted',
              iconColor
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {progress && (
          <div className="mt-3 space-y-1">
            <Progress
              value={(progress.value / progress.max) * 100}
              className="h-1.5"
              indicatorClassName={progress.color}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.value}</span>
              <span>{progress.max}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AdvancedKPIs() {
  return (
    <div className="space-y-4">
      {/* Primary KPIs Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="MTTR"
          value="12.5 min"
          subtitle="Mean Time To Repair"
          trend={{ value: 15, label: 'vs last month', isPositive: true }}
          icon={Timer}
          iconColor="text-blue-500"
          status="success"
        />
        <KPICard
          title="MTTD"
          value="2.3 min"
          subtitle="Mean Time To Detect"
          trend={{ value: 8, label: 'vs last month', isPositive: true }}
          icon={Eye}
          iconColor="text-purple-500"
          status="success"
        />
        <KPICard
          title="Resolution Rate"
          value="94.2%"
          subtitle="Incidents resolved within SLA"
          trend={{ value: 3, label: 'vs last month', isPositive: true }}
          icon={CheckCircle}
          iconColor="text-green-500"
          status="success"
        />
        <KPICard
          title="Checks / minute"
          value="847"
          subtitle="Active checks"
          icon={RefreshCw}
          iconColor="text-orange-500"
          status="neutral"
        />
      </div>

      {/* Secondary KPIs Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Apdex Score"
          value="0.94"
          subtitle="Application performance"
          icon={Gauge}
          iconColor="text-cyan-500"
          status="success"
          progress={{ value: 94, max: 100, color: 'bg-cyan-500' }}
        />
        <KPICard
          title="Error Budget"
          value="87%"
          subtitle="Budget remaining this month"
          icon={Shield}
          iconColor="text-emerald-500"
          status="success"
          progress={{ value: 87, max: 100, color: 'bg-emerald-500' }}
        />
        <KPICard
          title="Open Incidents"
          value="2"
          subtitle="1 critical, 1 minor"
          icon={AlertTriangle}
          iconColor="text-yellow-500"
          status="warning"
        />
        <KPICard
          title="P99 Latency"
          value="245ms"
          subtitle="99th percentile"
          trend={{ value: 12, label: 'vs yesterday', isPositive: false }}
          icon={Zap}
          iconColor="text-red-500"
          status="warning"
        />
      </div>
    </div>
  )
}

// Mini KPI for inline display
interface MiniKPIProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function MiniKPI({ label, value, trend, trendValue }: MiniKPIProps) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
      {trend && trend !== 'neutral' && (
        <div
          className={cn(
            'flex items-center gap-0.5 text-xs',
            trend === 'up' ? 'text-green-500' : 'text-red-500'
          )}
        >
          {trend === 'up' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {trendValue && <span>{trendValue}</span>}
        </div>
      )}
    </div>
  )
}

// Status Summary Component
export function StatusSummary() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Status Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-500">42</div>
            <div className="text-xs text-muted-foreground">Operational</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-500">3</div>
            <div className="text-xs text-muted-foreground">Degraded</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <div className="text-2xl font-bold text-red-500">1</div>
            <div className="text-xs text-muted-foreground">Down</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10">
            <div className="text-2xl font-bold text-blue-500">2</div>
            <div className="text-xs text-muted-foreground">Maintenance</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
