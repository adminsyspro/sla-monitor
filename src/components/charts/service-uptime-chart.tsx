'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ServiceUptimeChartProps {
  className?: string
}

// Mock data - would come from props/API
const serviceData = [
  { name: 'API Production', uptime: 99.98, target: 99.9 },
  { name: 'Site Web', uptime: 99.95, target: 99.9 },
  { name: 'Base de données', uptime: 99.99, target: 99.95 },
  { name: 'Service Paiement', uptime: 99.85, target: 99.9 },
  { name: 'CDN', uptime: 99.97, target: 99.5 },
  { name: 'Auth Service', uptime: 99.92, target: 99.9 },
]

const getBarColor = (uptime: number, target: number) => {
  if (uptime >= target) return 'hsl(142, 76%, 36%)' // Green
  if (uptime >= target - 0.1) return 'hsl(45, 93%, 47%)' // Yellow
  return 'hsl(0, 84%, 60%)' // Red
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const isMet = data.uptime >= data.target

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-medium mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Uptime:</span>
            <span
              className={cn(
                'font-medium',
                isMet ? 'text-green-500' : 'text-red-500'
              )}
            >
              {data.uptime.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Objectif:</span>
            <span className="font-medium">{data.target}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Statut:</span>
            <span
              className={cn(
                'font-medium',
                isMet ? 'text-green-500' : 'text-red-500'
              )}
            >
              {isMet ? '✓ Conforme' : '✗ Non conforme'}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function ServiceUptimeChart({ className }: ServiceUptimeChartProps) {
  const sortedData = useMemo(
    () => [...serviceData].sort((a, b) => b.uptime - a.uptime),
    []
  )

  const conformCount = serviceData.filter((s) => s.uptime >= s.target).length

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Disponibilité par service
          </CardTitle>
          <div className="text-sm">
            <span className="text-muted-foreground">Conformes: </span>
            <span
              className={cn(
                'font-medium',
                conformCount === serviceData.length
                  ? 'text-green-500'
                  : 'text-yellow-500'
              )}
            >
              {conformCount}/{serviceData.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[99, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                className="text-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                width={110}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="uptime" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry.uptime, entry.target)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
