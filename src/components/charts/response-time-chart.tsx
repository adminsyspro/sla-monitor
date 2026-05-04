'use client'

import { useMemo, useState } from 'react'
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

// Generate mock data
function generateData(hours: number) {
  const data = []
  const now = new Date()

  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    const baseResponseTime = 120
    const variation = Math.sin(i / 3) * 30 + Math.random() * 40
    const spike = Math.random() > 0.95 ? Math.random() * 200 : 0

    data.push({
      time: time.toISOString(),
      label:
        hours <= 24
          ? time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : time.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      responseTime: Math.max(50, Math.round(baseResponseTime + variation + spike)),
      p95: Math.max(80, Math.round(baseResponseTime + variation + spike + 50 + Math.random() * 30)),
      p99: Math.max(100, Math.round(baseResponseTime + variation + spike + 100 + Math.random() * 50)),
    })
  }

  return data
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
            <span className="font-medium">{payload[0]?.value}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">P95:</span>
            <span className="font-medium">{payload[1]?.value}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">P99:</span>
            <span className="font-medium">{payload[2]?.value}ms</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function ResponseTimeChart({ className }: ResponseTimeChartProps) {
  const [period, setPeriod] = useState('24h')

  const data = useMemo(() => {
    switch (period) {
      case '1h':
        return generateData(1)
      case '6h':
        return generateData(6)
      case '24h':
        return generateData(24)
      case '7d':
        return generateData(168)
      case '30d':
        return generateData(720)
      default:
        return generateData(24)
    }
  }, [period])

  // Calculate stats
  const stats = useMemo(() => {
    const responseTimes = data.map((d) => d.responseTime)
    const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    const min = Math.min(...responseTimes)
    const max = Math.max(...responseTimes)
    return { avg, min, max }
  }, [data])

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">Temps de réponse</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Moy: <span className="font-medium text-foreground">{stats.avg}ms</span>
            </span>
            <span>
              Min: <span className="font-medium text-green-500">{stats.min}ms</span>
            </span>
            <span>
              Max: <span className="font-medium text-red-500">{stats.max}ms</span>
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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
              />
              <Area
                type="monotone"
                dataKey="p95"
                stroke="hsl(45, 93%, 47%)"
                strokeWidth={1}
                fill="url(#p95Gradient)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="responseTime"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#responseTimeGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
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
