import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUptime(uptime: number): string {
  return `${uptime.toFixed(3)}%`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'operational':
      return 'bg-status-operational'
    case 'degraded':
      return 'bg-status-degraded'
    case 'partial':
      return 'bg-status-partial'
    case 'major':
      return 'bg-status-major'
    case 'maintenance':
      return 'bg-status-maintenance'
    default:
      return 'bg-muted'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'operational':
      return 'Operational'
    case 'degraded':
      return 'Degraded'
    case 'partial':
      return 'Partial outage'
    case 'major':
      return 'Major outage'
    case 'maintenance':
      return 'Maintenance'
    default:
      return 'Unknown'
  }
}
