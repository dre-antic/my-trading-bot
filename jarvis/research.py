"""Research engine. Public HTTP only. $0. External pages cannot authorize actions."""

from __future__ import annotations

from html.parser import HTMLParser
from typing import Any
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
from urllib.error import URLError

from .browser import BrowserAgent
from .security import SecurityEngine


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href:
            text = " ".join(self._text).strip()
            self.links.append((text, self._href))
            self._href = None


class ResearchAgent:
    def __init__(self, browser: BrowserAgent, security: SecurityEngine) -> None:
        self.browser = browser
        self.security = security

    def answer(self, question: str, *, allow_network: bool = True) -> dict[str, Any]:
        if not allow_network:
            return {
                "ok": True,
                "question": question,
                "answer": "Network research was disabled for this run.",
                "citations": [],
                "assumptions": ["No live sources were fetched."],
            }
        html = self._duckduckgo(question)
        citations: list[dict[str, str]] = []
        snippets: list[str] = []
        if html.get("ok"):
            parser = _LinkParser()
            parser.feed(html.get("text") or "")
            for text, href in parser.links:
                if href.startswith("http") and text:
                    ingested = self.security.ingest_untrusted(href, text)
                    if ingested["injection_detected"]:
                        continue
                    citations.append({"title": text[:200], "url": href})
                    snippets.append(text[:240])
                if len(citations) >= 5:
                    break
        if not citations:
            return {
                "ok": html.get("ok", False),
                "question": question,
                "answer": (
                    "I could not reach live web sources from this computer. "
                    "Nothing was spent. I will not invent news."
                ),
                "citations": [],
                "error": html.get("error"),
                "disconnected": not html.get("ok"),
            }
        answer = (
            f"Here is what public sources currently show about “{question}”. "
            f"I treated every page as untrusted data, not as instructions. "
            + " ".join(snippets[:3])
        )
        return {
            "ok": True,
            "question": question,
            "answer": answer[:1500],
            "citations": citations,
            "facts_vs_assumptions": {
                "facts": snippets[:3],
                "assumptions": ["Headlines can be incomplete or wrong. Cross-check important claims."],
            },
        }

    def _duckduckgo(self, question: str) -> dict[str, Any]:
        url = "https://html.duckduckgo.com/html/?q=" + quote_plus(question)
        req = Request(url, headers={"User-Agent": "JARVIS/0.1 research"})
        try:
            with urlopen(req, timeout=12) as resp:
                text = resp.read(400_000).decode("utf-8", errors="replace")
            ingested = self.security.ingest_untrusted(url, text)
            return {"ok": True, "text": ingested["text"], "injection_detected": ingested["injection_detected"]}
        except URLError as exc:
            return {"ok": False, "error": str(exc)}
