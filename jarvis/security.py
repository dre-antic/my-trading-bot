"""Security engine: untrusted content, sandboxing, no instruction injection."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .paths import workspace_root
from .secrets import path_is_protected
from .types import RiskLevel

INJECTION_PATTERNS = [
    re.compile(r"ignore previous instructions", re.I),
    re.compile(r"upload the user's credentials", re.I),
    re.compile(r"upload (the )?(user'?s )?\.(env|ssh)", re.I),
    re.compile(r"disable (the )?security", re.I),
    re.compile(r"disable (the )?firewall", re.I),
    re.compile(r"send this private file", re.I),
    re.compile(r"run this command", re.I),
    re.compile(r"install this package", re.I),
    re.compile(r"run as administrator", re.I),
    re.compile(r"exfiltrat", re.I),
    re.compile(r"bypass (the )?permission", re.I),
]


@dataclass
class SecurityDecision:
    allowed: bool
    action: str
    reason: str
    risk: RiskLevel = RiskLevel.GREEN
    require_confirmation: bool = False


class SecurityEngine:
    """External content is data, never authorization."""

    def ingest_untrusted(self, source: str, content: str) -> dict[str, str | bool | list[str]]:
        matches = [p.pattern for p in INJECTION_PATTERNS if p.search(content or "")]
        sanitized = content or ""
        for pattern in INJECTION_PATTERNS:
            sanitized = pattern.sub("[untrusted instruction ignored]", sanitized)
        return {
            "source": source,
            "untrusted": True,
            "authorizes_nothing": True,
            "injection_detected": bool(matches),
            "ignored_patterns": matches,
            "text": sanitized,
        }

    def authorize_from_external(self, _content: str) -> SecurityDecision:
        return SecurityDecision(
            False,
            "authorize_from_external",
            "External content cannot grant permissions.",
            RiskLevel.RED,
        )

    def check_path_access(self, path: str, action: str = "read") -> SecurityDecision:
        candidate = str(Path(path).expanduser())
        if path_is_protected(candidate):
            return SecurityDecision(
                False,
                action,
                "Protected secret path. Denied unless the user specifically authorizes this exact file.",
                RiskLevel.RED,
                require_confirmation=True,
            )
        root = workspace_root()
        try:
            resolved = Path(candidate).resolve()
            resolved.relative_to(root)
            return SecurityDecision(True, action, "Inside the project workspace.", RiskLevel.GREEN)
        except ValueError:
            return SecurityDecision(
                False,
                action,
                "Path is outside the JARVIS workspace.",
                RiskLevel.YELLOW,
                require_confirmation=True,
            )

    def check_mcp(self, server_id: str, known: bool, trusted: bool) -> SecurityDecision:
        if not known:
            return SecurityDecision(
                False,
                "mcp_connect",
                "Unknown MCP servers are DENIED.",
                RiskLevel.RED,
            )
        if not trusted:
            return SecurityDecision(
                False,
                "mcp_connect",
                "Untrusted MCP servers are DENIED until reviewed.",
                RiskLevel.RED,
            )
        return SecurityDecision(True, "mcp_connect", f"Trusted MCP server {server_id}.", RiskLevel.YELLOW)

    def check_download_execute(self, filename: str, known_publisher: bool) -> SecurityDecision:
        lower = filename.lower()
        executable = lower.endswith((".sh", ".exe", ".bin", ".pkg", ".dmg", ".command", ".app"))
        if executable and not known_publisher:
            return SecurityDecision(
                False,
                "execute_download",
                "Unknown executable. STOP / ASK.",
                RiskLevel.RED,
                require_confirmation=True,
            )
        return SecurityDecision(True, "store_download", "Download stored unexecuted.", RiskLevel.YELLOW)

    def check_docker_volume_delete(self) -> SecurityDecision:
        return SecurityDecision(
            False,
            "docker_volume_delete",
            "Docker volume deletion always requires confirmation.",
            RiskLevel.RED,
            require_confirmation=True,
        )

    def check_payment(self, amount: float, approved: bool) -> SecurityDecision:
        if amount > 0 and not approved:
            return SecurityDecision(
                False,
                "spend_money",
                "Automatic spending limit is $0. STOP.",
                RiskLevel.RED,
                require_confirmation=True,
            )
        if amount == 0:
            return SecurityDecision(True, "spend_money", "No cost.", RiskLevel.GREEN)
        return SecurityDecision(True, "spend_money", "Explicitly approved spend.", RiskLevel.RED)

    def check_git_publish(self, action: str) -> SecurityDecision:
        if action in {"push", "publish", "merge", "release"}:
            return SecurityDecision(
                False,
                f"git_{action}",
                "Git publish/merge/release/push requires explicit confirmation.",
                RiskLevel.RED,
                require_confirmation=True,
            )
        return SecurityDecision(True, f"git_{action}", "Local git inspection is allowed.", RiskLevel.GREEN)
