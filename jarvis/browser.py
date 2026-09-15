"""Browser controller. Semantic/HTTP first. Playwright is optional and never faked."""

from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any

from .security import SecurityEngine


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.chunks: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in {"script", "style"}:
            self._skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self._skip = False

    def handle_data(self, data: str) -> None:
        if not self._skip:
            text = data.strip()
            if text:
                self.chunks.append(text)


@dataclass
class BrowserStatus:
    connected: bool
    engine: str
    detail: str


class BrowserAgent:
    def __init__(self, security: SecurityEngine) -> None:
        self.security = security

    def status(self) -> BrowserStatus:
        if shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("firefox"):
            engine = "http+system-browser"
            return BrowserStatus(True, engine, "HTTP fetch is available. Full click/type automation needs Playwright, which is not required.")
        return BrowserStatus(True, "http", "HTTP fetch is available. No GUI browser automation is connected.")

    def fetch(self, url: str, timeout: float = 15.0) -> dict[str, Any]:
        if not url.startswith(("http://", "https://")):
            return {"ok": False, "error": "Only http(s) URLs are allowed."}
        req = urllib.request.Request(url, headers={"User-Agent": "JARVIS/0.1 research"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read(500_000)
                content_type = resp.headers.get("Content-Type", "")
                status = resp.status
        except urllib.error.URLError as exc:
            return {"ok": False, "error": str(exc), "url": url}
        text = raw.decode("utf-8", errors="replace")
        ingested = self.security.ingest_untrusted(url, text)
        parser = _TextExtractor()
        try:
            parser.feed(text)
        except Exception:
            parser.chunks = []
        return {
            "ok": True,
            "url": url,
            "status": status,
            "content_type": content_type,
            "text": ingested["text"][:8000],
            "visible_text": " ".join(parser.chunks)[:4000],
            "untrusted": True,
            "injection_detected": ingested["injection_detected"],
        }

    def click(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {
            "ok": False,
            "disconnected": True,
            "detail": "Click/type/scroll automation is not connected on this computer. Playwright is optional and not installed. JARVIS will not pretend to click.",
        }

    def screenshot(self) -> dict[str, Any]:
        return {
            "ok": False,
            "disconnected": True,
            "detail": "Browser screenshots need Playwright or a Mac computer-use session.",
        }
