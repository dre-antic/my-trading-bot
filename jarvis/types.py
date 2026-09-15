"""Shared types and constants."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class MissionStatus(str, Enum):
    QUEUED = "QUEUED"
    UNDERSTANDING = "UNDERSTANDING"
    RESEARCHING = "RESEARCHING"
    PLANNING = "PLANNING"
    EXECUTING = "EXECUTING"
    WAITING = "WAITING"
    VERIFYING = "VERIFYING"
    REVIEWING = "REVIEWING"
    RECOVERING = "RECOVERING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"


TERMINAL_STATUSES = {
    MissionStatus.COMPLETED,
    MissionStatus.FAILED,
    MissionStatus.CANCELLED,
}

ACTIVE_STATUSES = {
    MissionStatus.QUEUED,
    MissionStatus.UNDERSTANDING,
    MissionStatus.RESEARCHING,
    MissionStatus.PLANNING,
    MissionStatus.EXECUTING,
    MissionStatus.WAITING,
    MissionStatus.VERIFYING,
    MissionStatus.REVIEWING,
    MissionStatus.RECOVERING,
}


class AutonomyMode(str, Enum):
    JARVIS = "JARVIS"
    ASSIST = "ASSIST"
    SAFE = "SAFE"
    OBSERVE = "OBSERVE"


class RiskLevel(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"


class ExecutionTarget(str, Enum):
    LOCAL = "LOCAL"
    REMOTE = "REMOTE"
    HYBRID = "HYBRID"


class ApprovalDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    PENDING = "PENDING"


class ProviderHealth(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"
    NEEDS_AUTH = "needs_auth"
    PAYMENT_REQUIRED = "payment_required"
    UNKNOWN = "unknown"


class MemoryKind(str, Enum):
    USER = "USER"
    PROJECT = "PROJECT"
    MISSION = "MISSION"
    DECISION = "DECISION"
    WORKING = "WORKING"


class HaltKind(str, Enum):
    NONE = "NONE"
    STOP_NOW = "STOP_NOW"
    PAUSE_SAFELY = "PAUSE_SAFELY"


ALLOWED_TRANSITIONS: dict[MissionStatus, set[MissionStatus]] = {
    MissionStatus.QUEUED: {
        MissionStatus.UNDERSTANDING,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
    },
    MissionStatus.UNDERSTANDING: {
        MissionStatus.RESEARCHING,
        MissionStatus.PLANNING,
        MissionStatus.EXECUTING,
        MissionStatus.WAITING,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
        MissionStatus.FAILED,
    },
    MissionStatus.RESEARCHING: {
        MissionStatus.PLANNING,
        MissionStatus.EXECUTING,
        MissionStatus.WAITING,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
        MissionStatus.FAILED,
        MissionStatus.RECOVERING,
    },
    MissionStatus.PLANNING: {
        MissionStatus.EXECUTING,
        MissionStatus.WAITING,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
        MissionStatus.FAILED,
    },
    MissionStatus.EXECUTING: {
        MissionStatus.VERIFYING,
        MissionStatus.WAITING,
        MissionStatus.REVIEWING,
        MissionStatus.RECOVERING,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
        MissionStatus.FAILED,
        MissionStatus.COMPLETED,
    },
    MissionStatus.WAITING: {
        MissionStatus.EXECUTING,
        MissionStatus.PLANNING,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
        MissionStatus.FAILED,
        MissionStatus.VERIFYING,
    },
    MissionStatus.VERIFYING: {
        MissionStatus.REVIEWING,
        MissionStatus.EXECUTING,
        MissionStatus.RECOVERING,
        MissionStatus.COMPLETED,
        MissionStatus.FAILED,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
    },
    MissionStatus.REVIEWING: {
        MissionStatus.COMPLETED,
        MissionStatus.EXECUTING,
        MissionStatus.RECOVERING,
        MissionStatus.FAILED,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
    },
    MissionStatus.RECOVERING: {
        MissionStatus.EXECUTING,
        MissionStatus.PLANNING,
        MissionStatus.FAILED,
        MissionStatus.PAUSED,
        MissionStatus.CANCELLED,
        MissionStatus.VERIFYING,
    },
    MissionStatus.PAUSED: {
        MissionStatus.QUEUED,
        MissionStatus.EXECUTING,
        MissionStatus.UNDERSTANDING,
        MissionStatus.PLANNING,
        MissionStatus.VERIFYING,
        MissionStatus.REVIEWING,
        MissionStatus.CANCELLED,
        MissionStatus.FAILED,
    },
    MissionStatus.COMPLETED: set(),
    MissionStatus.FAILED: {MissionStatus.QUEUED, MissionStatus.RECOVERING, MissionStatus.CANCELLED},
    MissionStatus.CANCELLED: set(),
}


@dataclass
class RouteDecision:
    intent: str
    difficulty: str
    capabilities: list[str]
    worker: str
    tools: list[str]
    permissions: list[str]
    risk: RiskLevel
    verification: list[str]
    auto_allowed: bool
    needs_approval: bool
    execution_target: ExecutionTarget = ExecutionTarget.LOCAL
    notes: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolSpec:
    name: str
    purpose: str
    permissions: list[str]
    risk: RiskLevel
    inputs: list[str]
    outputs: list[str]
    side_effects: list[str]
    rollback: str


@dataclass
class ProviderSpec:
    name: str
    type: str
    capabilities: list[str]
    models: list[str]
    authentication: str
    cost: str
    limits: str
    availability: str
    health: ProviderHealth
    permissions: list[str]
    paid: bool = False
    connected: bool = False
    last_error: str = ""


@dataclass
class Evidence:
    kind: str
    summary: str
    path: str = ""
    data: dict[str, Any] = field(default_factory=dict)
