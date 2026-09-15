"""Shared JARVIS test fixtures. Isolated home + workspace."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from jarvis.app import create_app
from jarvis.kernel import KERNEL
from jarvis.storage import Store
from jarvis.types import AutonomyMode


@pytest.fixture
def jarvis_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "home"
    workspace = tmp_path / "Projects"
    home.mkdir()
    workspace.mkdir()
    monkeypatch.setenv("JARVIS_HOME", str(home))
    monkeypatch.setenv("JARVIS_WORKSPACE", str(workspace))
    KERNEL.reset()
    KERNEL.set_mode(AutonomyMode.ASSIST)
    return tmp_path


@pytest.fixture
def app(jarvis_env: Path):
    store = Store()
    return create_app(store)
