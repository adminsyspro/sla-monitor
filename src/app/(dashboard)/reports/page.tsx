'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ReportPeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom'

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
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('monthly')
  const [reports, setReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [slaTargets, setSlaTargets] = useState<SlaTarget[]>([])
  const [slaMetricsMap, setSlaMetricsMap] = useState<Record<string, SlaMetrics>>({})
  const [loadingTargets, setLoadingTargets] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [isCustomPeriodOpen, setIsCustomPeriodOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [customPeriodError, setCustomPeriodError] = useState('')

  const fetchReports = useCallback(async (period: ReportPeriod, startDate?: string, endDate?: string) => {
    setLoadingReports(true)
    try {
      const params = new URLSearchParams({ period })
      if (period === 'custom' && startDate && endDate) {
        params.set('start', startDate)
        params.set('end', endDate)
      }
      const res = await fetch(`/api/reports?${params.toString()}`)
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
    if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) fetchReports(selectedPeriod, customStartDate, customEndDate)
      return
    }
    fetchReports(selectedPeriod)
  }, [selectedPeriod, customStartDate, customEndDate, fetchReports])

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

  const periodLabel = selectedPeriod === 'custom' && customStartDate && customEndDate
    ? `${customStartDate} to ${customEndDate}`
    : selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)

  const openReportDetails = (report: Report) => {
    setSelectedReport(report)
    setIsDetailSheetOpen(true)
  }

  const applyCustomPeriod = () => {
    if (!customStartDate || !customEndDate) {
      setCustomPeriodError('Start and end dates are required.')
      return
    }
    if (new Date(customEndDate) < new Date(customStartDate)) {
      setCustomPeriodError('End date must be after start date.')
      return
    }
    setCustomPeriodError('')
    setSelectedPeriod('custom')
    setIsCustomPeriodOpen(false)
  }

  const normalizePdfText = (value: string | number) => String(value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const escapePdfText = (value: string | number) => normalizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

  const handleExportPdf = () => {
    const pageWidth = 595
    const pageHeight = 842
    const margin = 40
    const generatedAt = new Date().toLocaleString('en-US')
    const complianceRate = reports.length > 0
      ? Math.round((summary.slaMetCount / reports.length) * 100)
      : 100

    const pages: string[] = []
    let content = ''
    let y = margin

    const pdfY = (top: number) => pageHeight - top
    const rgb = (hex: string) => {
      const normalized = hex.replace('#', '')
      const r = parseInt(normalized.slice(0, 2), 16) / 255
      const g = parseInt(normalized.slice(2, 4), 16) / 255
      const b = parseInt(normalized.slice(4, 6), 16) / 255
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`
    }
    const add = (line: string) => {
      content += `${line}\n`
    }
    const fillRect = (x: number, top: number, width: number, height: number, color: string) => {
      add(`q ${rgb(color)} rg ${x} ${pdfY(top + height)} ${width} ${height} re f Q`)
    }
    const strokeRect = (x: number, top: number, width: number, height: number, color: string) => {
      add(`q ${rgb(color)} RG 0.8 w ${x} ${pdfY(top + height)} ${width} ${height} re S Q`)
    }
    const line = (x1: number, top1: number, x2: number, top2: number, color = '#e6ded0') => {
      add(`q ${rgb(color)} RG 0.7 w ${x1} ${pdfY(top1)} m ${x2} ${pdfY(top2)} l S Q`)
    }
    const text = (
      value: string | number,
      x: number,
      top: number,
      size = 10,
      color = '#17211d',
      font: 'F1' | 'F2' = 'F1'
    ) => {
      add(`BT /${font} ${size} Tf ${rgb(color)} rg ${x} ${pdfY(top)} Td (${escapePdfText(value)}) Tj ET`)
    }
    const truncate = (value: string | number, maxLength: number) => {
      const normalized = normalizePdfText(value)
      return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized
    }
    const finishPage = () => {
      if (content.trim()) pages.push(content)
      content = ''
      y = margin
    }
    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - margin) {
        finishPage()
        text('SLA Reports', margin, y, 12, '#17211d', 'F2')
        text(periodLabel, pageWidth - margin - 140, y, 9, '#6f796f')
        y += 24
        line(margin, y, pageWidth - margin, y)
        y += 18
      }
    }
    const drawSectionTitle = (title: string, subtitle: string) => {
      ensureSpace(42)
      text(title, margin, y, 15, '#17211d', 'F2')
      text(subtitle, margin, y + 15, 9, '#6f796f')
      y += 34
    }

    fillRect(0, 0, pageWidth, pageHeight, '#fffdf8')
    fillRect(margin, y, pageWidth - margin * 2, 112, '#102820')
    text('SERVICE LEVEL REPORT', margin + 22, y + 28, 9, '#d7f4df', 'F2')
    text('SLA Reports', margin + 22, y + 58, 28, '#fffdf8', 'F2')
    text(`Period: ${periodLabel}`, margin + 22, y + 84, 11, '#fffdf8')
    y += 140

    const cardWidth = (pageWidth - margin * 2 - 30) / 4
    const cards = [
      { label: 'Average uptime', value: `${summary.avgUptime}%`, note: 'Across selected reports', color: '#177245' },
      { label: 'Downtime', value: `${summary.totalDowntime}min`, note: 'Cumulative downtime', color: '#b42318' },
      { label: 'SLA compliance', value: `${complianceRate}%`, note: `${summary.slaMetCount} of ${summary.slaMetCount + summary.slaBreachedCount} met`, color: '#17211d' },
      { label: 'Incidents', value: summary.totalIncidents, note: 'Total over period', color: '#b7791f' },
    ]
    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + 10)
      fillRect(x, y, cardWidth, 82, '#ffffff')
      strokeRect(x, y, cardWidth, 82, '#e6ded0')
      text(card.label.toUpperCase(), x + 12, y + 22, 7, '#6f796f', 'F2')
      text(card.value, x + 12, y + 50, 21, card.color, 'F2')
      text(card.note, x + 12, y + 69, 7, '#6f796f')
    })
    y += 112

    drawSectionTitle('Report history', 'Uptime and incident summary by SLA target')
    const reportColumns = [
      { title: 'Target', width: 148 },
      { title: 'Uptime', width: 70 },
      { title: 'Target', width: 55 },
      { title: 'Downtime', width: 70 },
      { title: 'Incidents', width: 58 },
      { title: 'MTTR', width: 48 },
      { title: 'Status', width: 66 },
    ]
    const drawReportHeader = () => {
      fillRect(margin, y, pageWidth - margin * 2, 24, '#fbf7ef')
      let x = margin
      reportColumns.forEach((column) => {
        text(column.title.toUpperCase(), x + 6, y + 16, 7, '#6f796f', 'F2')
        x += column.width
      })
      y += 24
    }
    drawReportHeader()
    if (reports.length === 0) {
      text('No reports available', margin + 6, y + 18, 9, '#6f796f')
      y += 30
    } else {
      reports.forEach((report) => {
        ensureSpace(38)
        if (y < 90) drawReportHeader()
        let x = margin
        line(margin, y, pageWidth - margin, y, '#f0eadf')
        text(truncate(report.targetName, 28), x + 6, y + 17, 9, '#17211d', 'F2')
        text(`${truncate(report.startDate, 10)} to ${truncate(report.endDate, 10)}`, x + 6, y + 30, 7, '#6f796f')
        x += reportColumns[0].width
        text(`${report.actualUptime}%`, x + 6, y + 22, 9, report.actualUptime >= report.targetUptime ? '#177245' : '#b42318', 'F2')
        x += reportColumns[1].width
        text(`${report.targetUptime}%`, x + 6, y + 22, 9)
        x += reportColumns[2].width
        text(`${report.totalDowntimeMinutes}min`, x + 6, y + 22, 9)
        x += reportColumns[3].width
        text(report.incidents, x + 6, y + 22, 9)
        x += reportColumns[4].width
        text(`${report.mttr}min`, x + 6, y + 22, 9)
        x += reportColumns[5].width
        fillRect(x + 3, y + 9, 58, 18, report.isMet ? '#dcfce7' : '#fee2e2')
        text(report.isMet ? 'Compliant' : 'Breached', x + 8, y + 22, 7, report.isMet ? '#166534' : '#991b1b', 'F2')
        y += 38
      })
    }

    y += 22
    drawSectionTitle('Configured SLA targets', 'Current health of configured commitments')
    const targetColumns = [
      { title: 'Target', width: 175 },
      { title: 'SLA target', width: 72 },
      { title: 'Current', width: 78 },
      { title: 'Budget', width: 64 },
      { title: 'Period', width: 62 },
      { title: 'Status', width: 64 },
    ]
    const drawTargetHeader = () => {
      fillRect(margin, y, pageWidth - margin * 2, 24, '#fbf7ef')
      let x = margin
      targetColumns.forEach((column) => {
        text(column.title.toUpperCase(), x + 6, y + 16, 7, '#6f796f', 'F2')
        x += column.width
      })
      y += 24
    }
    drawTargetHeader()
    if (slaTargets.length === 0) {
      text('No SLA targets configured', margin + 6, y + 18, 9, '#6f796f')
      y += 30
    } else {
      slaTargets.forEach((target) => {
        const metrics = slaMetricsMap[target.id]
        const currentUptime = metrics?.currentUptime?.toFixed(3) ?? '100'
        const errorBudgetRemaining = metrics?.errorBudgetRemaining?.toFixed(0) ?? '100'
        const isMet = metrics?.isMet ?? true
        ensureSpace(36)
        if (y < 90) drawTargetHeader()
        let x = margin
        line(margin, y, pageWidth - margin, y, '#f0eadf')
        text(truncate(target.name, 34), x + 6, y + 17, 9, '#17211d', 'F2')
        text(`${target.monitorIds.length} monitored service${target.monitorIds.length > 1 ? 's' : ''}`, x + 6, y + 30, 7, '#6f796f')
        x += targetColumns[0].width
        text(`${target.targetUptime}%`, x + 6, y + 22, 9)
        x += targetColumns[1].width
        text(`${currentUptime}%`, x + 6, y + 22, 9, isMet ? '#177245' : '#b42318', 'F2')
        x += targetColumns[2].width
        text(`${errorBudgetRemaining}%`, x + 6, y + 22, 9, Number(errorBudgetRemaining) > 20 ? '#177245' : '#b7791f', 'F2')
        x += targetColumns[3].width
        text(target.period, x + 6, y + 22, 9)
        x += targetColumns[4].width
        fillRect(x + 3, y + 9, 58, 18, isMet ? '#dcfce7' : '#fee2e2')
        text(isMet ? 'Compliant' : 'Breached', x + 8, y + 22, 7, isMet ? '#166534' : '#991b1b', 'F2')
        y += 36
      })
    }

    ensureSpace(26)
    text(`Generated by SLA Monitor - ${generatedAt}`, margin, pageHeight - margin + 5, 8, '#7b837b')
    finishPage()

    const objects: string[] = []
    const addObject = (body: string) => {
      objects.push(body)
      return objects.length
    }
    const catalogRef = addObject('')
    const pagesRef = addObject('')
    const fontRef = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    const boldFontRef = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
    const pageRefs: number[] = []

    pages.forEach((pageContent) => {
      const contentRef = addObject(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}endstream`)
      const pageRef = addObject(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRef} 0 R /F2 ${boldFontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`)
      pageRefs.push(pageRef)
    })

    objects[catalogRef - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`
    objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`

    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((object, index) => {
      offsets.push(pdf.length)
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    })
    const xrefOffset = pdf.length
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
    })
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

    const blob = new Blob([pdf], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sla-report-${periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <Header title="SLA Reports" />
      <main className="p-6 space-y-6">
        {/* Period Selection & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={selectedPeriod === 'custom' ? 'custom' : selectedPeriod}
            onValueChange={(v) => {
              if (v === 'custom') {
                setIsCustomPeriodOpen(true)
                return
              }
              setSelectedPeriod(v as ReportPeriod)
            }}
          >
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
              {selectedPeriod === 'custom' && (
                <TabsTrigger value="custom">Custom</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCustomPeriodOpen(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              {selectedPeriod === 'custom' ? periodLabel : 'Custom period'}
            </Button>
            <Button variant="outline" onClick={handleExportPdf} disabled={loadingReports}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average uptime</p>
                  <p className="text-3xl font-bold">{summary.avgUptime}%</p>
                </div>
                <div className="rounded-lg bg-green-500/10 p-3">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedPeriod === 'custom' ? periodLabel : `Current ${selectedPeriod} period`}
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
            <CardTitle>Report History</CardTitle>
            <CardDescription>
              {selectedPeriod === 'custom' ? 'Custom SLA reports with uptime details' : `${periodLabel} SLA reports with uptime details`}
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
                          Target: {report.targetUptime}%
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-lg font-semibold">{report.totalDowntimeMinutes}min</p>
                          <p className="text-xs text-muted-foreground">Downtime</p>
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
                      <Button variant="ghost" size="sm" onClick={() => openReportDetails(report)}>
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
              Track service level commitments
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
                              ? 'Monthly'
                              : target.period === 'quarterly'
                              ? 'Quarterly'
                              : 'Yearly'}
                          </p>
                        </div>
                        <Badge variant={isMet ? 'operational' : 'destructive'}>
                          {isMet ? 'Compliant' : 'Non-compliant'}
                        </Badge>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Current uptime</span>
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
                            Target: {target.targetUptime}%
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Error budget remaining</span>
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

      <Dialog open={isCustomPeriodOpen} onOpenChange={setIsCustomPeriodOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Custom report period</DialogTitle>
            <DialogDescription>
              Select the date range used to recalculate SLA reports.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {customPeriodError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {customPeriodError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="report-start-date">Start date</Label>
              <Input
                id="report-start-date"
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-end-date">End date</Label>
              <Input
                id="report-end-date"
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomPeriodOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyCustomPeriod}>
              Apply period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedReport && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  {selectedReport.isMet ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <SheetTitle>{selectedReport.targetName}</SheetTitle>
                </div>
                <SheetDescription>
                  SLA report from {selectedReport.startDate} to {selectedReport.endDate}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedReport.isMet ? 'operational' : 'destructive'}>
                    {selectedReport.isMet ? 'Compliant' : 'Non-compliant'}
                  </Badge>
                  <Badge variant="outline">{selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Actual uptime</p>
                    <p className={selectedReport.actualUptime >= selectedReport.targetUptime ? 'text-2xl font-bold text-green-500' : 'text-2xl font-bold text-red-500'}>
                      {selectedReport.actualUptime}%
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">SLA target</p>
                    <p className="text-2xl font-bold">{selectedReport.targetUptime}%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Downtime</p>
                    <p className="text-2xl font-bold">{selectedReport.totalDowntimeMinutes}min</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">MTTR</p>
                    <p className="text-2xl font-bold">{selectedReport.mttr}min</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uptime performance</span>
                    <span>
                      {selectedReport.actualUptime >= selectedReport.targetUptime ? '+' : ''}
                      {(selectedReport.actualUptime - selectedReport.targetUptime).toFixed(3)}%
                    </span>
                  </div>
                  <Progress
                    value={selectedReport.actualUptime}
                    className="h-2"
                    indicatorClassName={
                      selectedReport.actualUptime >= selectedReport.targetUptime
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Compared with a {selectedReport.targetUptime}% target.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">Report scope</h4>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Period
                      </span>
                      <span>{selectedReport.startDate} to {selectedReport.endDate}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <BarChart3 className="h-4 w-4" />
                        Incidents
                      </span>
                      <span>{selectedReport.incidents}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Target className="h-4 w-4" />
                        Result
                      </span>
                      <span>{selectedReport.isMet ? 'SLA target met' : 'SLA target breached'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
