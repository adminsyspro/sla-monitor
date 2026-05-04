'use client'

import { useState, useEffect } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ResponseTimeChartProps {
  className?: string
}

interface Bucket {
  ts: number
  label: string
  avg: number | null
  p95: number | null
  p99: number | null
}

interface ApiResponse {
  period: string
  buckets: Bucket[]
  stats: { avg: number; min: number; max: number; p95: number; p99: number }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="text-sm font-medium mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Moyen:</span>
            <span className="font-medium">{payload[0]?.value ?? '—'}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">P95:</span>
            <span className="font-medium">{payload[1]?.value ?? '—'}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">P99:</span>
            <span className="font-medium">{payload[2]?.value ?? '—'}ms</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function ResponseTimeChart({ className }: ResponseTimeChartProps) {
  const [period, setPeriod] = useState('24h')
  const [apiData, setApiData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/response-time?period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: ApiResponse | null) => {
        setApiData(data)
      })
      .catch(() => setApiData(null))
      .finally(() => setLoading(false))
  }, [period])

  // Map API buckets to chart data shape — null avgs become undefined so Recharts
  // renders gaps instead of connecting the line through missing points.
  const chartData = (apiData?.buckets ?? []).map(b => ({
    label: b.label,
    responseTime: b.avg ?? undefined,
    p95: b.p95 ?? undefined,
    p99: b.p99 ?? undefined,
  }))

  const hasData = chartData.some(d => d.responseTime !== undefined)
  const stats = apiData?.stats ?? { avg: 0, min: 0, max: 0 }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">Temps de réponse</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Moy: <span className="font-medium text-foreground">{stats.avg ? `${stats.avg}ms` : '—'}</span>
            </span>
            <span>
              Min: <span className="font-medium text-green-500">{stats.min ? `${stats.min}ms` : '—'}</span>
            </span>
            <span>
              Max: <span className="font-medium text-red-500">{stats.max ? `${stats.max}ms` : '—'}</span>
            </span>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">1 heure</SelectItem>
            <SelectItem value="6h">6 heures</SelectItem>
            <SelectItem value="24h">24 heures</SelectItem>
            <SelectItem value="7d">7 jours</SelectItem>
            <SelectItem value="30d">30 jours</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Chargement…
            </div>
          ) : !hasData ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center">Aucune donnée pour la période</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="responseTimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="p95Gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `${value}ms`}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="p99"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={1}
                  fill="transparent"
                  dot={false}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="p95"
                  stroke="hsl(45, 93%, 47%)"
                  strokeWidth={1}
                  fill="url(#p95Gradient)"
                  dot={false}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="responseTime"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#responseTimeGradient)"
                  dot={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-4 rounded bg-primary" />
            <span className="text-muted-foreground">Temps moyen</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-4 rounded bg-yellow-500" />
            <span className="text-muted-foreground">P95</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-4 rounded bg-red-500" />
            <span className="text-muted-foreground">P99</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
