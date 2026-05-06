'use client'

import { useState, useEffect, useMemo } from 'react'
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

interface ServiceEntry {
  id: string
  name: string
  uptime: number
  target: number
  checks: number
  failures: number
}

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
            <span className="text-muted-foreground">Target:</span>
            <span className="font-medium">{data.target}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Status:</span>
            <span
              className={cn(
                'font-medium',
                isMet ? 'text-green-500' : 'text-red-500'
              )}
            >
              {isMet ? '✓ Compliant' : '✗ Non-compliant'}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function ServiceUptimeChart({ className }: ServiceUptimeChartProps) {
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/services-uptime?period=30d')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.services) setServices(data.services)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Sort by uptime descending for display (best at top)
  const sortedData = useMemo(
    () => [...services].sort((a, b) => b.uptime - a.uptime),
    [services]
  )

  const conformCount = services.filter(s => s.uptime >= s.target).length

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Uptime by Service
          </CardTitle>
          {!loading && services.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Compliant: </span>
              <span
                className={cn(
                  'font-medium',
                  conformCount === services.length
                    ? 'text-green-500'
                    : 'text-yellow-500'
                )}
              >
                {conformCount}/{services.length}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading...
            </div>
          ) : services.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center">No services</p>
            </div>
          ) : (
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}
