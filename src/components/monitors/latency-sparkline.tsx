'use client'

import { useId, useMemo } from 'react'
import { Area, AreaChart } from 'recharts'
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
}

export function LatencySparkline({
  data,
  width = 60,
  height = 20,
  className,
}: LatencySparklineProps) {
  const id = useId()
  const gradientId = `latency-spark-${id.replace(/:/g, '')}`

  const usable = useMemo(() => {
    if (!data || data.length < 2) return null
    const hasSignal = data.some((p) => (p.ms ?? 0) > 0)
    return hasSignal ? data : null
  }, [data])

  if (!usable) return null

  return (
    <div
      className={cn('shrink-0', className)}
      style={{ width, height, lineHeight: 0 }}
      aria-hidden="true"
    >
      <AreaChart
        width={width}
        height={height}
        data={usable}
        margin={{ top: 1, right: 0, bottom: 1, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
    </div>
  )
}
