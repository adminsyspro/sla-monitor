export type MonitorType = 'http' | 'tcp' | 'dns' | 'ssl' | 'ping';
export type CheckStatus = 'operational' | 'degraded' | 'major' | 'unknown';

export interface DueMonitor {
  id: string;
  type: MonitorType;
  url: string;
  timeout_ms: number;
  config: Record<string, unknown>;
}

export interface CheckPayload {
  monitor_id: string;
  timestamp: number;
  status: CheckStatus;
  response_time_ms: number | null;
  status_code: number | null;
  error: string | null;
  region: string;
  metadata: Record<string, unknown>;
}
