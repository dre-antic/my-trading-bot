"""Voice adapters. macOS `say` / optional espeak. No paid STT."""

from __future__ import annotations

import shutil
import subprocess
from typing import Any


class VoiceSystem:
    def status(self) -> dict[str, Any]:
        say = shutil.which("say")
        espeak = shutil.which("espeak") or shutil.which("espeak-ng")
        if say:
            return {"tts": "say", "stt": "disconnected", "detail": "Mac can speak replies. Speech-to-text needs a later local engine — no paid API is enabled."}
        if espeak:
            return {"tts": "espeak", "stt": "disconnected", "detail": "Linux text-to-speech is available. Microphone dictation is not connected."}
        return {"tts": "disconnected", "stt": "disconnected", "detail": "Voice is optional. Typing always works."}

    def speak(self, text: str) -> dict[str, Any]:
        status = self.status()
        if status["tts"] == "disconnected":
            return {"ok": False, "disconnected": True, "detail": status["detail"]}
        binary = "say" if status["tts"] == "say" else (shutil.which("espeak-ng") or "espeak")
        try:
            subprocess.run([binary, text[:400]], check=False, timeout=15)
            return {"ok": True}
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "error": str(exc)}
