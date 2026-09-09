from __future__ import annotations

import re

BLOCKED_PATTERNS = [
    r"\bchild sexual\b",
    r"\bcsam\b",
    r"\bnon[- ]consensual\b",
    r"\bdeepfake\b.*\b(real|actual|celebrity|politician)\b",
    r"\bimpersonat(e|ion)\b",
    r"\bclone\b.*\b(voice|person)\b",
    r"\bscam\b",
    r"\bfraudulent\b",
    r"\bmake a bomb\b",
]

REAL_PERSON = re.compile(
    r"\b(president|celebrity|real person|looks like|sound like|voice of)\b.{0,40}\b(obama|trump|biden|taylor swift|person)\b",
    re.I,
)


def check_prompt(prompt: str) -> dict:
    text = prompt or ""
    flags = []
    lowered = text.lower()
    for pat in BLOCKED_PATTERNS:
        if re.search(pat, lowered):
            flags.append({"severity": "CRITICAL", "reason": "This request appears to ask for disallowed content.", "pattern": pat})
    if "clone" in lowered and "voice" in lowered and "my voice" not in lowered:
        flags.append({"severity": "CRITICAL", "reason": "Voice cloning of another person is not allowed without authorization."})
    real = REAL_PERSON.search(text)
    if real:
        flags.append(
            {
                "severity": "IMPORTANT",
                "reason": "Generating a real identifiable person may require consent. Fictional characters are allowed.",
            }
        )
    blocked = any(f["severity"] == "CRITICAL" for f in flags)
    return {"allowed": not blocked, "flags": flags}


def disclosure_text(setting: str = "automatic") -> str:
    if setting == "never":
        return ""
    return "This video includes substantially AI-generated narration, visuals, and music."
