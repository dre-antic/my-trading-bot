"""Task router: what, how hard, which worker, which permissions."""

from __future__ import annotations

import re

from .types import ExecutionTarget, RiskLevel, RouteDecision

CODING_HINTS = (
    "build",
    "app",
    "application",
    "code",
    "implement",
    "fix the",
    "write a",
    "cursor",
    "programming",
    "website",
    "task-list",
    "task list",
    "todo",
)
RESEARCH_HINTS = (
    "research",
    "what happened",
    "compare",
    "find out",
    "news",
    "today",
    "best tools",
    "explain this company",
)
COMPUTER_HINTS = (
    "click",
    "open this app",
    "settings button",
    "take over the screen",
    "type in",
    "macos",
)
BROWSER_HINTS = ("browse", "open the page", "website test", "screenshot the page", "navigate to")
EXPLAIN_HINTS = ("explain", "what is this project", "how does it work", "what's broken", "what's left")
OBSERVE_HINTS = ("watch what i'm doing", "watch what i am doing", "observe")
TAKEOVER_HINTS = ("take over",)
LEARN_PREFIXES = ("remember ", "learn that ", "don't forget ", "do not forget ")
STOP_HINTS = ("stop now", "stop jarvis", "pause safely")
RESUME_EXACT = {"resume", "continue", "go on", "start again"}
HALT_EXACT = {"stop", "stop now", "stop jarvis", "pause", "pause safely", "please stop"}


class TaskRouter:
    def route(self, text: str) -> RouteDecision:
        lowered = (text or "").strip().lower()
        normalized = lowered.rstrip(".!").strip()
        if not lowered:
            return RouteDecision(
                intent="empty",
                difficulty="trivial",
                capabilities=[],
                worker="none",
                tools=[],
                permissions=[],
                risk=RiskLevel.GREEN,
                verification=[],
                auto_allowed=True,
                needs_approval=False,
                notes="No request.",
            )
        if normalized in HALT_EXACT or any(h in lowered for h in STOP_HINTS):
            return RouteDecision(
                "halt",
                "trivial",
                ["control"],
                "kernel",
                ["stop"],
                [],
                RiskLevel.GREEN,
                [],
                True,
                False,
                notes="Stop or pause JARVIS.",
            )
        if normalized in RESUME_EXACT:
            return RouteDecision(
                "resume",
                "trivial",
                ["control"],
                "kernel",
                ["resume"],
                [],
                RiskLevel.GREEN,
                [],
                True,
                False,
                notes="Clear halt and wait for the next goal.",
            )
        if any(h in lowered for h in TAKEOVER_HINTS):
            return RouteDecision(
                "takeover",
                "moderate",
                ["autonomy"],
                "orchestrator",
                ["takeover"],
                ["mission_status"],
                RiskLevel.GREEN,
                [],
                True,
                False,
                notes="Continue the current mission autonomously.",
            )
        if any(normalized.startswith(p) for p in LEARN_PREFIXES):
            return RouteDecision(
                "learn",
                "easy",
                ["memory", "learning"],
                "learning",
                ["memory_write_safe"],
                ["memory_write_safe"],
                RiskLevel.GREEN,
                ["ask_if_protected"],
                True,
                False,
                notes="Observe → propose → ask. Cannot change spend or security.",
            )
        if any(h in lowered for h in OBSERVE_HINTS):
            return RouteDecision(
                "observe",
                "easy",
                ["vision"],
                "vision",
                ["observe_screen"],
                ["observe_screen"],
                RiskLevel.GREEN,
                ["visible_indicator"],
                True,
                False,
            )
        if self._is_coding(lowered):
            return RouteDecision(
                intent="coding",
                difficulty="hard" if "application" in lowered or "app" in lowered else "moderate",
                capabilities=["coding", "testing", "review", "verification"],
                worker="coding",
                tools=["create_project_file", "run_tests", "code_inspection"],
                permissions=["create_project_file", "run_tests", "code_inspection"],
                risk=RiskLevel.GREEN,
                verification=["tests", "files", "launch"],
                auto_allowed=True,
                needs_approval=False,
                execution_target=ExecutionTarget.HYBRID,
                notes="Software mission: implement, test, review, verify.",
            )
        if any(h in lowered for h in RESEARCH_HINTS):
            return RouteDecision(
                "research",
                "moderate",
                ["research", "web"],
                "research",
                ["web_research"],
                ["web_research"],
                RiskLevel.GREEN,
                ["citations"],
                True,
                False,
                ExecutionTarget.REMOTE,
            )
        if any(h in lowered for h in COMPUTER_HINTS):
            return RouteDecision(
                "computer",
                "moderate",
                ["computer_use"],
                "computer",
                ["launch_permitted_app"],
                ["computer_control"],
                RiskLevel.YELLOW,
                ["screenshot"],
                False,
                True,
                ExecutionTarget.LOCAL,
            )
        if any(h in lowered for h in BROWSER_HINTS):
            return RouteDecision(
                "browser",
                "moderate",
                ["browser"],
                "browser",
                ["public_browse"],
                ["public_browse"],
                RiskLevel.GREEN,
                ["screenshot"],
                True,
                False,
            )
        if any(h in lowered for h in EXPLAIN_HINTS) or lowered.startswith("what is"):
            return RouteDecision(
                "explain",
                "easy",
                ["project_brain", "explain"],
                "review",
                ["explain", "code_inspection"],
                ["explain"],
                RiskLevel.GREEN,
                ["plain_english"],
                True,
                False,
            )
        if "trade" in lowered or "buy stock" in lowered or "place order" in lowered:
            return RouteDecision(
                "trading",
                "hard",
                ["research"],
                "research",
                ["web_research"],
                ["trading_execute"],
                RiskLevel.RED,
                ["no_auto_trade"],
                False,
                True,
                notes="Trading analysis is allowed. Execution is never automatic.",
            )
        return RouteDecision(
            "general",
            "easy",
            ["conversation"],
            "orchestrator",
            ["explain"],
            ["explain"],
            RiskLevel.GREEN,
            [],
            True,
            False,
        )

    def _is_coding(self, lowered: str) -> bool:
        if "go into cursor" in lowered or "coding agent" in lowered:
            return True
        hits = sum(1 for hint in CODING_HINTS if hint in lowered)
        if re.search(r"\bbuild me\b", lowered):
            return True
        return hits >= 2 or ("fix" in lowered and "bug" in lowered)
