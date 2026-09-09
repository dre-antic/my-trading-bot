from pathlib import Path

import pytest

from aivideostudio.providers import ProviderError, with_retries
from aivideostudio.render import technical_qc


def test_retry_then_succeed():
    n = {"i": 0}

    def flaky():
        n["i"] += 1
        if n["i"] < 3:
            raise ProviderError("temp", retryable=True)
        return "ok"

    assert with_retries(flaky, attempts=4, backoff=1.0) == "ok"
    assert n["i"] == 3


def test_missing_file_qc(tmp_path):
    qc = technical_qc(tmp_path / "nope.mp4")
    assert qc["ok"] is False
    assert qc["findings"][0]["severity"] == "CRITICAL"


def test_provider_unavailable_fallback():
    from aivideostudio.providers import ComfyUIProvider, pick_llm

    llm = pick_llm("personal")
    assert llm.available()
    assert ComfyUIProvider("http://127.0.0.1:9").available() is False
