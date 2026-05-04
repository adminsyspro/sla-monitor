'use client'

import { useState, useEffect, useMemo } from 'react'
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

interface Cell {
  day: number
  hour: number
  count: number
}

interface ApiResponse {
  weeks: number
  totalIncidents: number
  cells: Cell[]
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
  const [apiData, setApiData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/incident-heatmap')
      .then(r => r.ok ? r.json() : null)
      .then((data: ApiResponse | null) => {
        setApiData(data)
      })
      .catch(() => setApiData(null))
      .finally(() => setLoading(false))
  }, [])

  // Build aggregatedData map from API cells
  const aggregatedData = useMemo(() => {
    const result: Record<string, number> = {}
    if (apiData?.cells) {
      for (const cell of apiData.cells) {
        result[`${cell.day}-${cell.hour}`] = cell.count
      }
    }
    return result
  }, [apiData])

  const totalIncidents = apiData?.totalIncidents ?? 0
  const weeks = apiData?.weeks ?? 12

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Distribution des incidents
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {loading ? '…' : `${totalIncidents} incidents (${weeks} semaines)`}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Chargement…
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  )
}
