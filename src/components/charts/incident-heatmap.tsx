'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface IncidentHeatmapProps {
  className?: string
}

// Generate mock incident data for last 12 weeks
function generateHeatmapData() {
  const data: { day: number; hour: number; count: number; date: string }[] = []
  const now = new Date()

  // 12 weeks × 7 days
  for (let week = 11; week >= 0; week--) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(now)
      date.setDate(date.getDate() - (week * 7 + (6 - day)))

      // Simulate incident patterns
      // More incidents during business hours, less on weekends
      const isWeekend = day === 0 || day === 6
      const baseCount = isWeekend ? 0.1 : 0.3

      for (let hour = 0; hour < 24; hour++) {
        const isBusinessHour = hour >= 8 && hour <= 18
        const hourMultiplier = isBusinessHour ? 2 : 0.5
        const random = Math.random()

        let count = 0
        if (random < baseCount * hourMultiplier * 0.3) {
          count = Math.ceil(Math.random() * 3)
        }

        data.push({
          day,
          hour,
          count,
          date: date.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
        })
      }
    }
  }

  return data
}

const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const hours = Array.from({ length: 24 }, (_, i) => i)

function getColorIntensity(count: number): string {
  if (count === 0) return 'bg-muted'
  if (count === 1) return 'bg-yellow-500/40'
  if (count === 2) return 'bg-orange-500/60'
  return 'bg-red-500/80'
}

export function IncidentHeatmap({ className }: IncidentHeatmapProps) {
  const data = useMemo(() => generateHeatmapData(), [])

  // Aggregate data by day and hour (sum across weeks)
  const aggregatedData = useMemo(() => {
    const result: Record<string, number> = {}

    data.forEach((d) => {
      const key = `${d.day}-${d.hour}`
      result[key] = (result[key] || 0) + d.count
    })

    return result
  }, [data])

  // Calculate totals
  const totalIncidents = Object.values(aggregatedData).reduce((a, b) => a + b, 0)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Distribution des incidents
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {totalIncidents} incidents (12 semaines)
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <TooltipProvider delayDuration={0}>
          <div className="space-y-1">
            {/* Hour labels */}
            <div className="flex">
              <div className="w-10" /> {/* Spacer for day labels */}
              <div className="flex-1 flex justify-between text-xs text-muted-foreground px-1">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>23h</span>
              </div>
            </div>

            {/* Heatmap grid */}
            {days.map((dayName, dayIndex) => (
              <div key={dayName} className="flex items-center gap-1">
                <div className="w-10 text-xs text-muted-foreground">{dayName}</div>
                <div className="flex-1 flex gap-[2px]">
                  {hours.map((hour) => {
                    const key = `${dayIndex}-${hour}`
                    const count = aggregatedData[key] || 0

                    return (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'flex-1 h-4 rounded-sm transition-all hover:ring-1 hover:ring-primary cursor-pointer',
                              getColorIntensity(count)
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">
                            {dayName} {hour}h-{hour + 1}h
                          </p>
                          <p className="text-muted-foreground">
                            {count} incident{count > 1 ? 's' : ''}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 pt-3 text-xs text-muted-foreground">
              <span>Moins</span>
              <div className="flex gap-[2px]">
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <div className="w-3 h-3 rounded-sm bg-yellow-500/40" />
                <div className="w-3 h-3 rounded-sm bg-orange-500/60" />
                <div className="w-3 h-3 rounded-sm bg-red-500/80" />
              </div>
              <span>Plus</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
