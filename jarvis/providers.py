"""Provider registry with health checks. Never silently switch to a paid provider."""

from __future__ import annotations

import shutil
from dataclasses import asdict
from typing import Any, Callable

from .cost import CostManager
from .types import ProviderHealth, ProviderSpec


def _which(name: str) -> bool:
    return shutil.which(name) is not None


class ProviderRegistry:
    def __init__(self, cost: CostManager) -> None:
        self.cost = cost
        self._providers: dict[str, ProviderSpec] = {}
        self._health_fns: dict[str, Callable[[], ProviderSpec]] = {}
        self._register_builtin()

    def _register_builtin(self) -> None:
        self.register(
            ProviderSpec(
                name="local-coding",
                type="coding",
                capabilities=["scaffold", "edit", "test"],
                models=["deterministic-local"],
                authentication="none",
                cost="$0",
                limits="workspace only",
                availability="always",
                health=ProviderHealth.HEALTHY,
                permissions=["create_project_file", "run_tests"],
                paid=False,
                connected=True,
            )
        )
        self.register(
            ProviderSpec(
                name="cursor-acp",
                type="coding",
                capabilities=["agent", "acp", "cli"],
                models=["cursor-agent"],
                authentication="cursor_login or CURSOR_API_KEY",
                cost="Cursor account / $0 automatic JARVIS spend",
                limits="requires local Cursor CLI",
                availability="optional",
                health=ProviderHealth.DISCONNECTED,
                permissions=["create_project_file"],
                paid=False,
                connected=False,
            ),
            health_fn=self._cursor_health,
        )
        self.register(
            ProviderSpec(
                name="cursor-cli",
                type="coding",
                capabilities=["print-mode", "acp"],
                models=["cursor-agent"],
                authentication="agent login",
                cost="Cursor account",
                limits="CLI must be installed",
                availability="optional",
                health=ProviderHealth.DISCONNECTED,
                permissions=["create_project_file"],
                paid=False,
                connected=False,
            ),
            health_fn=self._cursor_health,
        )
        self.register(
            ProviderSpec(
                name="local-research",
                type="research",
                capabilities=["http-get", "summarize"],
                models=["none"],
                authentication="none",
                cost="$0",
                limits="public HTTP only",
                availability="network",
                health=ProviderHealth.HEALTHY,
                permissions=["web_research"],
                paid=False,
                connected=True,
            )
        )
        self.register(
            ProviderSpec(
                name="openai",
                type="llm",
                capabilities=["coding", "vision", "computer-use"],
                models=["unknown-until-connected"],
                authentication="API key in OS keychain",
                cost="paid — blocked until approved",
                limits="user approval required",
                availability="disconnected",
                health=ProviderHealth.DISCONNECTED,
                permissions=["cloud_service"],
                paid=True,
                connected=False,
            )
        )
        self.register(
            ProviderSpec(
                name="anthropic",
                type="llm",
                capabilities=["coding", "computer-use"],
                models=["unknown-until-connected"],
                authentication="API key in OS keychain",
                cost="paid — blocked until approved",
                limits="user approval required",
                availability="disconnected",
                health=ProviderHealth.DISCONNECTED,
                permissions=["cloud_service"],
                paid=True,
                connected=False,
            )
        )
        self.register(
            ProviderSpec(
                name="browser-local",
                type="browser",
                capabilities=["fetch", "optional-playwright"],
                models=[],
                authentication="none",
                cost="$0",
                limits="no login-gated sites without approval",
                availability="local",
                health=ProviderHealth.HEALTHY,
                permissions=["public_browse"],
                paid=False,
                connected=True,
            )
        )

    def register(self, spec: ProviderSpec, health_fn: Callable[[], ProviderSpec] | None = None) -> None:
        self._providers[spec.name] = spec
        if health_fn:
            self._health_fns[spec.name] = health_fn

    def _cursor_health(self) -> ProviderSpec:
        spec = self._providers["cursor-acp"]
        binary = shutil.which("agent") or shutil.which("cursor-agent") or shutil.which("cursor")
        if not binary:
            spec.health = ProviderHealth.DISCONNECTED
            spec.connected = False
            spec.last_error = "Cursor CLI (agent / cursor-agent) is not installed on this computer."
            return spec
        spec.connected = True
        spec.availability = binary
        spec.health = ProviderHealth.NEEDS_AUTH
        spec.last_error = "CLI found. Authenticate with `agent login` on the Mac. JARVIS will not spend API credits automatically."
        return spec

    def get(self, name: str) -> ProviderSpec:
        spec = self._providers[name]
        fn = self._health_fns.get(name)
        if fn:
            return fn()
        return spec

    def list(self) -> list[dict[str, Any]]:
        return [asdict(self.get(name)) for name in self._providers]

    def choose(self, capability: str, allow_paid: bool = False) -> ProviderSpec | None:
        candidates = [self.get(name) for name in self._providers]
        compatible = [p for p in candidates if capability in p.capabilities or p.type == capability]
        compatible.sort(key=lambda p: (p.paid, p.health != ProviderHealth.HEALTHY, p.name))
        for provider in compatible:
            if provider.paid and not allow_paid:
                spend = self.cost.evaluate(provider.name, f"use:{capability}", 0.01, approved=False)
                if not spend.allowed:
                    continue
            if provider.health in {ProviderHealth.HEALTHY, ProviderHealth.NEEDS_AUTH, ProviderHealth.DEGRADED}:
                if provider.paid and not allow_paid:
                    continue
                return provider
            if provider.health == ProviderHealth.DISCONNECTED and not provider.paid:
                # usable as an adapter in disconnected state
                return provider
        return compatible[0] if compatible else None
