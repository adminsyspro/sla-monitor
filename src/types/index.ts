// Monitor types
export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns' | 'ssl'
export type MonitorStatus = 'operational' | 'degraded' | 'partial' | 'major' | 'maintenance' | 'unknown'

export interface Monitor {
  id: string
  name: string
  url: string
  type: MonitorType
  interval: number // in seconds
  timeout: number // in milliseconds
  status: MonitorStatus
  enabled: boolean
  createdAt: string
  updatedAt: string
  groupId?: string
  tags?: string[]
  // HTTP specific
  expectedStatusCode?: number
  // TCP specific
  port?: number
  // SSL specific
  checkCertificate?: boolean
  certificateExpiryWarning?: number // days before expiry to warn
}

export interface MonitorGroup {
  id: string
  name: string
  description?: string
  order: number
  monitors: Monitor[]
}

// Check/Ping types
export interface MonitorCheck {
  id: string
  monitorId: string
  timestamp: string
  status: MonitorStatus
  responseTime: number // in milliseconds
  statusCode?: number
  error?: string
  region?: string
}

// Uptime types
export interface UptimeData {
  date: string
  status: MonitorStatus
  uptime: number // percentage
  checks: number
  failures: number
  avgResponseTime: number
}

export interface UptimeSummary {
  monitorId: string
  period: '24h' | '7d' | '30d' | '90d' | '1y'
  uptime: number
  totalChecks: number
  totalFailures: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  dailyData: UptimeData[]
}

// Incident types
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved'
export type IncidentSeverity = 'minor' | 'major' | 'critical'

export interface IncidentUpdate {
  id: string
  incidentId: string
  status: IncidentStatus
  message: string
  createdAt: string
  createdBy: string
}

export interface Incident {
  id: string
  title: string
  status: IncidentStatus
  severity: IncidentSeverity
  affectedMonitors: string[]
  startedAt: string
  resolvedAt?: string
  updates: IncidentUpdate[]
  rootCause?: string
  postmortem?: string
  createdBy: string
}

// Maintenance types
export interface MaintenanceWindow {
  id: string
  title: string
  description?: string
  affectedMonitors: string[]
  scheduledStart: string
  scheduledEnd: string
  actualStart?: string
  actualEnd?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  createdBy: string
}

// SLA types
export interface SLATarget {
  id: string
  name: string
  monitorIds: string[]
  targetUptime: number // percentage, e.g., 99.9
  period: 'monthly' | 'quarterly' | 'yearly'
  excludeMaintenanceWindows: boolean
}

export interface SLAReport {
  id: string
  targetId: string
  period: {
    start: string
    end: string
  }
  actualUptime: number
  targetUptime: number
  isMet: boolean
  totalDowntimeMinutes: number
  incidents: Incident[]
  maintenanceWindows: MaintenanceWindow[]
}

// Alert types
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sms'

export interface AlertRule {
  id: string
  name: string
  monitorIds: string[]
  conditions: {
    type: 'down' | 'degraded' | 'response_time' | 'ssl_expiry'
    threshold?: number
    consecutiveFailures?: number
  }
  channels: {
    type: AlertChannel
    config: Record<string, string>
  }[]
  enabled: boolean
}

// User types
export type UserRole = 'Administrator' | 'Operator' | 'User'

export interface User {
  id: string
  username: string
  email: string
  firstname: string
  lastname: string
  role: UserRole
  active: boolean
  authType: 'local' | 'ldap'
  avatar?: string | null
  created_at: string
  updated_at: string
}

// API Response types
export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    perPage?: number
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string>
}
