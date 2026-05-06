'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Report {
  id: string
  targetName: string
  targetUptime: number
  period: string
  startDate: string
  endDate: string
  actualUptime: number
  isMet: boolean
  totalDowntimeMinutes: number
  incidents: number
  mttr: number
}

interface SlaTarget {
  id: string
  name: string
  monitorIds: string[]
  targetUptime: number
  period: string
  excludeMaintenanceWindows: boolean
}

interface SlaMetrics {
  targetId: string
  currentUptime: number
  targetUptime: number
  isMet: boolean
  downtimeMinutes: number
  allowedDowntimeMinutes: number
  errorBudgetUsed: number
  errorBudgetRemaining: number
  trend: string
  status: string
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [reports, setReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [slaTargets, setSlaTargets] = useState<SlaTarget[]>([])
  const [slaMetricsMap, setSlaMetricsMap] = useState<Record<string, SlaMetrics>>({})
  const [loadingTargets, setLoadingTargets] = useState(true)

  const fetchReports = useCallback(async (period: string) => {
    setLoadingReports(true)
    try {
      const res = await fetch(`/api/reports?period=${period}`)
      if (res.ok) {
        const data: Report[] = await res.json()
        setReports(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingReports(false)
    }
  }, [])

  useEffect(() => {
    fetchReports(selectedPeriod)
  }, [selectedPeriod, fetchReports])

  useEffect(() => {
    async function fetchTargetsAndMetrics() {
      setLoadingTargets(true)
      try {
        const res = await fetch('/api/sla-targets')
        if (!res.ok) return
        const targets: SlaTarget[] = await res.json()
        setSlaTargets(targets)

        const metricsEntries = await Promise.all(
          targets.map(async (t) => {
            try {
              const mRes = await fetch(`/api/sla-targets/${t.id}/metrics`)
              if (mRes.ok) {
                const metrics: SlaMetrics = await mRes.json()
                return [t.id, metrics] as const
              }
            } catch {
              // skip
            }
            return null
          })
        )
        const map: Record<string, SlaMetrics> = {}
        for (const entry of metricsEntries) {
          if (entry) map[entry[0]] = entry[1]
        }
        setSlaMetricsMap(map)
      } catch {
        // silently fail
      } finally {
        setLoadingTargets(false)
      }
    }
    fetchTargetsAndMetrics()
  }, [])

  // Computed summary from reports
  const summary = {
    avgUptime: reports.length > 0
      ? Math.round((reports.reduce((sum, r) => sum + r.actualUptime, 0) / reports.length) * 100) / 100
      : 0,
    totalDowntime: reports.reduce((sum, r) => sum + r.totalDowntimeMinutes, 0),
    totalIncidents: reports.reduce((sum, r) => sum + r.incidents, 0),
    slaMetCount: reports.filter((r) => r.isMet).length,
    slaBreachedCount: reports.filter((r) => !r.isMet).length,
  }

  return (
    <>
      <Header title="SLA Reports" />
      <main className="p-6 space-y-6">
        {/* Period Selection & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="monthly">Mensuel</TabsTrigger>
              <TabsTrigger value="quarterly">Trimestriel</TabsTrigger>
              <TabsTrigger value="yearly">Annuel</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Custom period
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exporter PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Uptime moyen</p>
                  <p className="text-3xl font-bold">{summary.avgUptime}%</p>
                </div>
                <div className="rounded-lg bg-green-500/10 p-3">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Sur les 12 derniers mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Downtime</p>
                  <p className="text-3xl font-bold">{summary.totalDowntime}min</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-3">
                  <TrendingDown className="h-6 w-6 text-red-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Cumulative total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">SLA met</p>
                  <p className="text-3xl font-bold">
                    {summary.slaMetCount}/{summary.slaMetCount + summary.slaBreachedCount}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-3">
                  <CheckCircle2 className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Compliant months
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Incidents</p>
                  <p className="text-3xl font-bold">{summary.totalIncidents}</p>
                </div>
                <div className="rounded-lg bg-yellow-500/10 p-3">
                  <BarChart3 className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Total over period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des rapports</CardTitle>
            <CardDescription>
              Monthly SLA reports with uptime details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReports ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reports available</p>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-lg p-2 ${
                          report.isMet
                            ? 'bg-green-500/10'
                            : 'bg-red-500/10'
                        }`}
                      >
                        {report.isMet ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{report.targetName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {report.startDate} → {report.endDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      {/* Uptime Progress */}
                      <div className="w-48 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Uptime</span>
                          <span
                            className={
                              report.actualUptime >= report.targetUptime
                                ? 'text-green-500'
                                : 'text-red-500'
                            }
                          >
                            {report.actualUptime}%
                          </span>
                        </div>
                        <Progress
                          value={report.actualUptime}
                          className="h-2"
                          indicatorClassName={
                            report.actualUptime >= report.targetUptime
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Objectif: {report.targetUptime}%
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-lg font-semibold">{report.totalDowntimeMinutes}min</p>
                          <p className="text-xs text-muted-foreground">Indispo.</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{report.incidents}</p>
                          <p className="text-xs text-muted-foreground">Incidents</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{report.mttr}min</p>
                          <p className="text-xs text-muted-foreground">MTTR</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <Button variant="ghost" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SLA Targets Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Configured SLA Targets</CardTitle>
            <CardDescription>
              Suivi des engagements de niveau de service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTargets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : slaTargets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No SLA targets configured</p>
            ) : (
              <div className="space-y-4">
                {slaTargets.map((target) => {
                  const metrics = slaMetricsMap[target.id]
                  const currentUptime = metrics?.currentUptime ?? 100
                  const isMet = metrics?.isMet ?? true
                  const errorBudgetRemaining = metrics?.errorBudgetRemaining ?? 100

                  return (
                    <div
                      key={target.id}
                      className="rounded-lg border p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{target.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {target.monitorIds.length} monitors •{' '}
                            {target.period === 'monthly'
                              ? 'Mensuel'
                              : target.period === 'quarterly'
                              ? 'Trimestriel'
                              : 'Annuel'}
                          </p>
                        </div>
                        <Badge variant={isMet ? 'operational' : 'destructive'}>
                          {isMet ? 'Conforme' : 'Non conforme'}
                        </Badge>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Uptime actuel</span>
                            <span className={isMet ? 'text-green-500' : 'text-red-500'}>
                              {currentUptime}%
                            </span>
                          </div>
                          <Progress
                            value={currentUptime}
                            className="h-2"
                            indicatorClassName={isMet ? 'bg-green-500' : 'bg-red-500'}
                          />
                          <p className="text-xs text-muted-foreground">
                            Objectif: {target.targetUptime}%
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Budget d&apos;erreur restant</span>
                            <span
                              className={
                                errorBudgetRemaining > 50
                                  ? 'text-green-500'
                                  : errorBudgetRemaining > 20
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                              }
                            >
                              {errorBudgetRemaining.toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={errorBudgetRemaining}
                            className="h-2"
                            indicatorClassName={
                              errorBudgetRemaining > 50
                                ? 'bg-green-500'
                                : errorBudgetRemaining > 20
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {target.excludeMaintenanceWindows
                              ? 'Maintenance excluded'
                              : 'Maintenance included'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
