"""Intelligence router: local Mac vs cloud AI vs remote agents vs external APIs.

Cloud AI never replaces the local control plane. If cloud is down, local
work still runs.
"""

from __future__ import annotations

from dataclasses import dataclass

from .runtime import LocalMacRuntime
from .types import RouteDecision

LOCAL_INTENTS = {
    "halt",
    "takeover",
    "observe",
    "explain",
    "coding",
    "general",
    "computer",
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
            return PlaneDecision(
                intent,
                "local_mac",
                "coding",
                False,
                "local-coding worker",
                "Coding runs on this computer. Cursor ACP is optional. Cloud LLM is not required.",
            )
        if intent == "research":
            return PlaneDecision(
                intent,
                "external_api" if not cloud else "external_api",
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
                "disconnected-honest on non-Mac",
                "Mac control stays on this machine.",
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
