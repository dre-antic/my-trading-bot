from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from .paths import logs_dir

SECRET_RE = re.compile(
    r"(api[_-]?key|secret|token|password|authorization|bearer)\s*[:=]\s*['\"]?[^\s'\"]+",
    re.IGNORECASE,
)
BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        text = super().format(record)
        text = SECRET_RE.sub(r"\1=***REDACTED***", text)
        text = BEARER_RE.sub("Bearer ***REDACTED***", text)
        return text


def setup_logging(name: str = "aivideostudio") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    fmt = RedactingFormatter("%(asctime)s | %(levelname)s | %(message)s")
    stream = logging.StreamHandler()
    stream.setFormatter(fmt)
    logger.addHandler(stream)
    path = logs_dir() / f"studio-{datetime.now(timezone.utc).strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(path, encoding="utf-8")
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)
    logger.propagate = False
    return logger


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def read_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))
