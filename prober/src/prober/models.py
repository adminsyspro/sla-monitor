from dataclasses import dataclass, field
from typing import Any, Literal, Optional

MonitorType = Literal["http", "tcp", "dns", "ssl", "ping"]
CheckStatus = Literal["operational", "degraded", "major", "unknown"]


@dataclass
class Monitor:
    id: str
    type: MonitorType
    url: str
    timeout_ms: int
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckResult:
    monitor_id: str
    timestamp: int
    status: CheckStatus
    response_time_ms: Optional[int] = None
    status_code: Optional[int] = None
    error: Optional[str] = None
    region: str = "local"
    metadata: dict[str, Any] = field(default_factory=dict)
