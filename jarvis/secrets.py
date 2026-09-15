"""Secret detection and redaction. Never log or persist credentials in clear text."""

from __future__ import annotations

import re

SECRET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?i)(api[_-]?key|secret|token|password|passwd|authorization)\s*[:=]\s*['\"]?([^\s'\"]{8,})"),
    re.compile(r"(?i)bearer\s+[a-z0-9._\-+=/]{12,}"),
    re.compile(r"(?i)sk-[a-z0-9]{16,}"),
    re.compile(r"(?i)xox[baprs]-[a-z0-9-]{10,}"),
    re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"),
    re.compile(r"(?i)aws_secret_access_key\s*[:=]\s*\S+"),
    re.compile(r"(?i)ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"(?i)github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"(?i)x-access-token:[A-Za-z0-9._\-]+"),
]

REDACTED = "[REDACTED]"

PROTECTED_NAME_FRAGMENTS = (
    ".env",
    "id_rsa",
    "id_ed25519",
    "id_dsa",
    "id_ecdsa",
    ".pem",
    "credentials.json",
    "secret",
    "keychain",
    ".netrc",
    "wallet",
    "ssh/config",
)

PROTECTED_DIR_FRAGMENTS = (
    "/.ssh/",
    "\\.ssh\\",
    "/.gnupg/",
    "/.aws/",
    "/Library/Keychains/",
    "/.config/gh/",
)


def redact(text: str | None) -> str:
    if not text:
        return ""
    redacted = text
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub(REDACTED, redacted)
    return redacted


def looks_like_secret(text: str | None) -> bool:
    if not text:
        return False
    return any(p.search(text) for p in SECRET_PATTERNS)


def path_is_protected(path: str) -> bool:
    lowered = path.replace("\\", "/").lower()
    if any(frag.lower() in lowered for frag in PROTECTED_NAME_FRAGMENTS):
        return True
    if any(frag.lower() in lowered for frag in PROTECTED_DIR_FRAGMENTS):
        return True
    if lowered.endswith("/.env") or lowered.endswith(".env"):
        return True
    return False
