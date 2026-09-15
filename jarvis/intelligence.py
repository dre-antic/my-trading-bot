"""Intelligence router: local Mac vs cloud AI vs remote agents vs external APIs.

Cloud AI never replaces the local control plane. If cloud is down, local
work still runs.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass

from .runtime import LocalMacRuntime
from .types import RouteDecision

LOCAL_INTENTS = {
    "halt",
    "resume",
    "takeover",
    "observe",
    "explain",
    "coding",
    "general",
    "computer",
    "learn",
}
EXTERNAL_INTENTS = {"research", "browser"}
CLOUD_ONLY_INTENTS: set[str] = set()  # nothing local is allowed to require a paid LLM


@dataclass(frozen=True)
class PlaneDecision:
    intent: str
    plane: str
    worker: str
    cloud_ai_required: bool
    local_fallback: str
    reason: str


class IntelligenceRouter:
    def __init__(self, runtime: LocalMacRuntime) -> None:
        self.runtime = runtime

    def decide(self, route: RouteDecision) -> PlaneDecision:
        cloud = bool(self.runtime.cloud_ai_status()["available"])
        intent = route.intent
        if intent in CLOUD_ONLY_INTENTS and not cloud:
            return PlaneDecision(
                intent,
                "local_mac",
                "orchestrator",
                False,
                "Honest local reply. Cloud AI is off.",
                "No local feature may hard-require a paid model.",
            )
        if intent == "coding":
            cursor = shutil.which("agent") or shutil.which("cursor-agent")
            return PlaneDecision(
                intent,
                "remote_agent" if cursor else "local_mac",
                "coding",
                False,
                "local-coding worker",
                "Coding uses Cursor ACP/CLI when the agent binary is present, else the local builder. Computer Use is not the coding path.",
            )
        if intent == "learn":
            return PlaneDecision(
                intent,
                "local_mac",
                "learning",
                False,
                "local SQLite learning store",
                "Observe → propose → ask. Learning cannot change spend or security.",
            )
        if intent == "research":
            return PlaneDecision(
                intent,
                "external_api",
                "research",
                False,
                "public HTTP or honest disconnect",
                "Research uses $0 public pages when the network works. It does not spend cloud AI.",
            )
        if intent in {"computer", "observe"}:
            return PlaneDecision(
                intent,
                "local_mac",
                "computer",
                False,
                "open/osascript only; clicks not claimed",
                "Computer Use is a yellow GUI fallback. Click automation is not claimed. A separate Mac agent is recovering it.",
            )
        if intent == "browser":
            return PlaneDecision(
                intent,
                "external_api",
                "browser",
                False,
                "HTTP fetch",
                "Browser fetch is local HTTP. Click automation is optional.",
            )
        return PlaneDecision(
            intent,
            "local_mac",
            route.worker or "orchestrator",
            False,
            "local runtime",
            "Default plane is this Mac.",
        )

    def coding_path(self) -> dict[str, str | bool]:
        cursor = shutil.which("agent") or shutil.which("cursor-agent") or ""
        return {
            "primary": "cursor-acp" if cursor else "local-coding",
            "fallback": "local-coding",
            "computer_use": False,
            "detail": "Keep Cursor ACP/CLI as the coding path. Computer Use is not used to write code.",
        }
