"""Independent review. The coding worker is never the sole judge of its own work."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .secrets import looks_like_secret, path_is_protected


class ReviewAgent:
    def review_project(self, root: str, criteria: list[str]) -> dict[str, Any]:
        path = Path(root)
        findings: list[str] = []
        passed = True
        if not path.exists():
            return {"ok": False, "passed": False, "findings": ["Project folder is missing."], "criteria": criteria}
        files = [p for p in path.rglob("*") if p.is_file()]
        if not files:
            passed = False
            findings.append("No files were produced.")
        secret_hits = []
        for file in files:
            if path_is_protected(str(file)):
                passed = False
                findings.append(f"Protected path present: {file.name}")
                continue
            try:
                text = file.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if looks_like_secret(text):
                secret_hits.append(str(file.relative_to(path)))
        if secret_hits:
            passed = False
            findings.append("Possible secrets in: " + ", ".join(secret_hits))
        else:
            findings.append("No credential-like strings found in project files.")
        has_tests = any("test" in p.name.lower() for p in files)
        if not has_tests:
            passed = False
            findings.append("No tests found.")
        else:
            findings.append("Tests are present.")
        has_readme = any(p.name.lower() == "readme.md" for p in files)
        if not has_readme:
            findings.append("README missing — documentation agent would add one.")
        return {
            "ok": True,
            "passed": passed,
            "findings": findings,
            "criteria": criteria,
            "file_count": len(files),
            "independent": True,
            "reviewer": "review-agent",
        }

    def explain(self, subject: str, context: str = "") -> str:
        base = (
            "I will keep this in everyday language. "
            f"You asked me to explain: {subject}. "
        )
        if context:
            return base + context
        return base + "I did not find extra project notes yet."
