'use client'

import { useId, useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

export interface LatencyPoint {
  date: string
  ms: number
}

interface LatencySparklineProps {
  data: LatencyPoint[]
  width?: number
  height?: number
  className?: string
  responsive?: boolean
  showTooltip?: boolean
}

function SparklineTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload as LatencyPoint
  return (
    <div className="rounded-md border bg-background px-2 py-1 text-xs shadow-md">
      <p className="font-medium">
        {new Date(point.date).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
      <p className="text-muted-foreground">{point.ms}ms</p>
    </div>
  )
}

export function LatencySparkline({
  data,
  width = 60,
  height = 20,
  className,
  responsive = false,
  showTooltip = true,
}: LatencySparklineProps) {
  const id = useId()
  const gradientId = `latency-spark-${id.replace(/:/g, '')}`

  const usable = useMemo(() => {
    if (!data || data.length < 2) return null
    const hasSignal = data.some((p) => (p.ms ?? 0) > 0)
    return hasSignal ? data : null
  }, [data])

  if (!usable) return null

  const chart = (
    <AreaChart
      data={usable}
      margin={{ top: 1, right: 0, bottom: 1, left: 0 }}
      {...(responsive ? {} : { width, height })}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {showTooltip && (
        <Tooltip
          content={<SparklineTooltip />}
          cursor={{
            stroke: 'hsl(var(--muted-foreground))',
            strokeWidth: 1,
            strokeDasharray: '3 3',
          }}
          isAnimationActive={false}
          wrapperStyle={{ outline: 'none' }}
        />
      )}
      <Area
        type="monotone"
        dataKey="ms"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        fill={`url(#${gradientId})`}
        isAnimationActive={false}
        connectNulls={false}
        dot={false}
      />
    </AreaChart>
  )

  if (responsive) {
    return (
      <div className={cn('w-full', className)} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div
      className={cn('shrink-0', className)}
      style={{ width, height, lineHeight: 0 }}
    >
      {chart}
    </div>
  )
}
