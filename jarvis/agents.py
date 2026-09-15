"""Specialist agent facade. Least privilege per role."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .browser import BrowserAgent
from .coding import LocalCodingAgent
from .computer import ComputerAgent
from .cursor_ctrl import CursorAdapter
from .research import ResearchAgent
from .review import ReviewAgent


@dataclass
class Delegation:
    role: str
    worker: str
    tools: list[str]
    context: dict[str, Any]


class AgentOrchestrator:
    def __init__(
        self,
        coding: LocalCodingAgent,
        cursor: CursorAdapter,
        research: ResearchAgent,
        browser: BrowserAgent,
        computer: ComputerAgent,
        review: ReviewAgent,
    ) -> None:
        self.coding = coding
        self.cursor = cursor
        self.research = research
        self.browser = browser
        self.computer = computer
        self.review = review

    def delegate(self, role: str, **kwargs: Any) -> dict[str, Any]:
        if role == "coding":
            cursor_status = self.cursor.status()
            cursor_attempt = None
            if cursor_status.binary:
                cursor_attempt = self.cursor.submit(
                    kwargs.get("objective", ""),
                    cwd=kwargs.get("cwd") or ".",
                    timeout=8.0,
                )
            local = self.coding.build(kwargs["objective"])
            return {
                "role": "coding",
                "cursor": {
                    "health": cursor_status.health,
                    "detail": cursor_status.detail,
                    "result": cursor_attempt,
                },
                "local": local,
                "used": "local-coding" if not (cursor_attempt and cursor_attempt.get("ok")) else "cursor-acp",
            }
        if role == "research":
            return {"role": "research", **self.research.answer(kwargs["objective"], allow_network=kwargs.get("allow_network", True))}
        if role == "browser":
            url = kwargs.get("url") or ""
            if url:
                return {"role": "browser", **self.browser.fetch(url)}
            return {"role": "browser", **self.browser.click()}
        if role == "computer":
            return {"role": "computer", **self.computer.launch_app(kwargs.get("name", "Finder"))}
        if role == "review":
            return {"role": "review", **self.review.review_project(kwargs["root"], kwargs.get("criteria") or [])}
        if role == "vision":
            return {"role": "vision", **self.computer.screenshot()}
        raise KeyError(role)
