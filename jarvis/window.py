"""Open the JARVIS window on this computer. Never a cloud dashboard."""

from __future__ import annotations

import platform
import subprocess
import webbrowser
from pathlib import Path


def open_local_window(url: str) -> str:
    if not url.startswith("http://127.0.0.1") and not url.startswith("http://localhost"):
        raise ValueError("JARVIS window may only open a local address.")
    if platform.system() != "Darwin":
        webbrowser.open(url)
        return "webbrowser"
    chrome = Path("/Applications/Google Chrome.app")
    if chrome.exists():
        subprocess.Popen(
            ["open", "-na", "Google Chrome", "--args", f"--app={url}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return "chrome-app"
    safari = Path("/Applications/Safari.app")
    if safari.exists():
        subprocess.Popen(["open", "-a", "Safari", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return "safari"
    webbrowser.open(url)
    return "webbrowser"
