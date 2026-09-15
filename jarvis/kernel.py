"""Process-wide kernel: halt flags, autonomy mode, event bus."""

from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any

from .types import AutonomyMode, HaltKind

Listener = Callable[[str, dict[str, Any]], None]


class Kernel:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.halt = HaltKind.NONE
        self.mode = AutonomyMode.ASSIST
        self.observe_active = False
        self._listeners: list[Listener] = []

    def reset(self) -> None:
        with self._lock:
            self.halt = HaltKind.NONE
            self.mode = AutonomyMode.ASSIST
            self.observe_active = False

    def stop_now(self) -> None:
        with self._lock:
            self.halt = HaltKind.STOP_NOW
        self.emit("halt", {"kind": HaltKind.STOP_NOW.value})

    def pause_safely(self) -> None:
        with self._lock:
            self.halt = HaltKind.PAUSE_SAFELY
        self.emit("halt", {"kind": HaltKind.PAUSE_SAFELY.value})

    def clear_halt(self) -> None:
        with self._lock:
            self.halt = HaltKind.NONE
        self.emit("halt", {"kind": HaltKind.NONE.value})

    def is_stopped(self) -> bool:
        return self.halt == HaltKind.STOP_NOW

    def should_pause(self) -> bool:
        return self.halt in {HaltKind.STOP_NOW, HaltKind.PAUSE_SAFELY}

    def set_mode(self, mode: AutonomyMode) -> None:
        with self._lock:
            self.mode = mode
            if mode != AutonomyMode.OBSERVE:
                self.observe_active = False
        self.emit("mode", {"mode": mode.value})

    def start_observe(self) -> None:
        with self._lock:
            self.mode = AutonomyMode.OBSERVE
            self.observe_active = True
        self.emit("observe", {"active": True})

    def stop_observe(self) -> None:
        with self._lock:
            self.observe_active = False
        self.emit("observe", {"active": False})

    def subscribe(self, listener: Listener) -> None:
        with self._lock:
            self._listeners.append(listener)

    def emit(self, topic: str, payload: dict[str, Any] | None = None) -> None:
        data = payload or {}
        with self._lock:
            listeners = list(self._listeners)
        for listener in listeners:
            try:
                listener(topic, data)
            except Exception:
                continue


KERNEL = Kernel()
