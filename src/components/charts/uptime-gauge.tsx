'use client'

import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface UptimeGaugeProps {
  uptime: number
  target: number
  title?: string
  className?: string
}

export function UptimeGauge({
  uptime,
  target,
  title = 'Global Uptime',
  className,
}: UptimeGaugeProps) {
  const isMet = uptime >= target
  const data = [
    { name: 'Uptime', value: uptime },
    { name: 'Downtime', value: 100 - uptime },
  ]

  const color = isMet
    ? 'hsl(142, 76%, 36%)'
    : uptime >= target - 0.1
    ? 'hsl(45, 93%, 47%)'
    : 'hsl(0, 84%, 60%)'

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-medium text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={65}
                startAngle={180}
                endAngle={0}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill={color} />
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={cn('text-3xl font-bold', isMet ? 'text-green-500' : 'text-red-500')}
            >
              {uptime.toFixed(2)}%
            </span>
            <span className="text-xs text-muted-foreground">
              Target: {target}%
            </span>
          </div>
        </div>
        <div className="flex justify-center mt-2">
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              isMet
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            )}
          >
            {isMet ? '✓ SLA met' : '✗ SLA not met'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Multiple gauges component for regional display
interface RegionalUptimeProps {
  regions: Array<{
    name: string
    uptime: number
    checks: number
  }>
  className?: string
}

export function RegionalUptime({ regions, className }: RegionalUptimeProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Uptime by Region</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {regions.map((region) => {
            const color =
              region.uptime >= 99.9
                ? 'bg-green-500'
                : region.uptime >= 99
                ? 'bg-yellow-500'
                : 'bg-red-500'

            return (
              <div key={region.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', color)} />
                    <span>{region.name}</span>
                  </div>
                  <span className="font-medium">{region.uptime.toFixed(2)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: `${region.uptime}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {region.checks.toLocaleString()} checks
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
