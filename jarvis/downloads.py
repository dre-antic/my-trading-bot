"""Download safety. Unknown executables are not run."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .paths import cache_dir
from .security import SecurityEngine


class DownloadGuard:
    def __init__(self, security: SecurityEngine) -> None:
        self.security = security

    def receive(self, filename: str, source: str, known_publisher: bool = False, content: bytes | None = None) -> dict[str, Any]:
        decision = self.security.check_download_execute(filename, known_publisher)
        dest = cache_dir() / "downloads"
        dest.mkdir(parents=True, exist_ok=True)
        path = dest / Path(filename).name
        if content is not None and not decision.action.startswith("execute"):
            path.write_bytes(content)
        return {
            "stored": path.exists() if content is not None else False,
            "path": str(path) if content is not None else "",
            "source": source,
            "execute_allowed": decision.allowed and decision.action == "execute_download",
            "reason": decision.reason,
            "require_confirmation": decision.require_confirmation,
        }
