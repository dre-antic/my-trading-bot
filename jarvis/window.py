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
    opener = "/usr/bin/open" if Path("/usr/bin/open").exists() else "open"
    # Chrome app-mode via open --args is unreliable when Chrome is already
    # running, which is the usual Dock case on this Mac. Open the local URL
    # in Chrome (or Safari) instead.
    chrome = Path("/Applications/Google Chrome.app")
    if chrome.exists():
        subprocess.Popen(
            [opener, "-a", "Google Chrome", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return "chrome"
    safari = Path("/Applications/Safari.app")
    if safari.exists():
        subprocess.Popen(
            [opener, "-a", "Safari", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return "safari"
    subprocess.Popen([opener, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return "macos-open"
