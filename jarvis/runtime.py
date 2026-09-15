"""JARVIS local Mac runtime / control plane.

This process is the product. It runs on the user's computer, talks to the GUI
on 127.0.0.1, and keeps working when cloud AI is down.

Cloud is only for optional heavy inference. It is not JARVIS.
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .paths import jarvis_home, workspace_root
from .secrets import path_is_protected
from .security import SecurityEngine

# Intel Homebrew layout on the user's 2013 MacBook Pro.
INTEL_PYTHON_311 = "/usr/local/bin/python3.11"
INTEL_BREW = "/usr/local/bin/brew"


@dataclass(frozen=True)
class Capability:
    name: str
    plane: str  # local_mac | cloud_ai | remote_agent | external_api
    available: bool
    needs_cloud_ai: bool
    detail: str


class LocalMacRuntime:
    """Local control plane: files, apps, git, brew, keychain, voice, projects."""

    def __init__(self, security: SecurityEngine | None = None) -> None:
        self.security = security or SecurityEngine()
        self.platform = platform.system()

    def is_mac(self) -> bool:
        return self.platform == "Darwin"

    def inventory(self) -> dict[str, Any]:
        machine = platform.machine()
        apple_silicon = machine.lower() in {"arm64", "aarch64"}
        python = self.python_status()
        return {
            "control_plane": "local",
            "product_is_cloud": False,
            "os": f"{platform.system()} {platform.release()}",
            "macos_version": platform.mac_ver()[0] if self.is_mac() else "",
            "machine": machine,
            "apple_silicon": apple_silicon,
            "intel_mac_target": not apple_silicon,
            "python": python,
            "node": _which_version("node"),
            "git": _which_version("git"),
            "homebrew": self.homebrew_status(),
            "cursor": {
                "cli": shutil.which("agent") or shutil.which("cursor-agent") or "",
                "app": self._app_exists("Cursor"),
            },
            "browsers": {
                "chrome": self._app_exists("Google Chrome") or bool(shutil.which("google-chrome")),
                "safari": self._app_exists("Safari"),
                "firefox": self._app_exists("Firefox") or bool(shutil.which("firefox")),
            },
            "docker": bool(shutil.which("docker") or self._app_exists("Docker")),
            "applications": self.list_applications()[:40],
            "disk_free_gb": round(shutil.disk_usage("/").free / 1e9, 1),
            "memory_bytes": _memory(),
            "workspace": str(workspace_root()),
            "jarvis_home": str(jarvis_home()),
            "keychain": self.is_mac(),
            "hardware_verified": False,
            "note": "Inventory is from this computer. User reported open JARVIS.app + HTTP 200 on the 2013 Mac. Computer Use clicks are not claimed.",
            "computer_use": self.computer_use_honesty(),
        }

    def computer_use_honesty(self) -> dict[str, Any]:
        return {
            "working": False,
            "clicks": False,
            "role": "yellow_gui_fallback",
            "coding_path": False,
            "methods_claimed": ["open", "osascript"] if self.is_mac() else [],
            "detail": "Computer Use is a yellow GUI fallback (open/osascript). Click automation is not claimed. A separate Mac agent is recovering it. Coding uses Cursor ACP/CLI or the local builder.",
        }

    def python_status(self) -> dict[str, Any]:
        preferred = self.find_python311()
        version = sys.version.split()[0]
        major_minor = f"{sys.version_info.major}.{sys.version_info.minor}"
        return {
            "running": sys.executable,
            "running_version": version,
            "preferred_python311": preferred or "",
            "avoid": "Homebrew python 3.14 — compiling cryptography can hang on this Intel Mac.",
            "ok_for_jarvis": major_minor != "3.14",
        }

    def find_python311(self) -> str | None:
        candidates = [
            INTEL_PYTHON_311,
            shutil.which("python3.11") or "",
        ]
        venv = Path(sys.prefix) / "bin" / "python"
        if venv.exists():
            candidates.insert(0, str(venv))
        for path in candidates:
            if path and os.path.isfile(path) and os.access(path, os.X_OK):
                if _python_major_minor(path) == "3.11":
                    return path
        return None

    def homebrew_status(self) -> dict[str, Any]:
        brew = shutil.which("brew") or (INTEL_BREW if os.path.isfile(INTEL_BREW) else "")
        return {
            "present": bool(brew),
            "path": brew or "",
            "prefix_hint": "/usr/local on Intel Macs",
        }

    def cloud_ai_status(self) -> dict[str, Any]:
        """Paid cloud models. Default off. $0 automatic spend."""
        flagged = os.environ.get("JARVIS_CLOUD_AI", "").strip() in {"1", "true", "yes"}
        return {
            "available": flagged,
            "plane": "cloud_ai",
            "detail": "Cloud AI is optional inference only. The Mac runtime does not need it for local work.",
        }

    def capabilities(self) -> list[Capability]:
        cloud = self.cloud_ai_status()["available"]
        mac = self.is_mac()
        return [
            Capability("workspace_files", "local_mac", True, False, "Read/write inside the Projects folder."),
            Capability("missions", "local_mac", True, False, "Missions are stored in local SQLite."),
            Capability("memory", "local_mac", True, False, "Notes stay on this computer."),
            Capability("local_coding", "local_mac", True, False, "Scaffold and test small apps without cloud AI."),
            Capability("git_inspect", "local_mac", bool(shutil.which("git")), False, "Inspect and commit locally. Never auto-push."),
            Capability("list_applications", "local_mac", mac, False, "List /Applications on this Mac."),
            Capability("open_application", "local_mac", mac, False, "open -a / AppleScript. Needs approval when yellow/red."),
            Capability("macos_automation", "local_mac", mac, False, "osascript when present. Not verified from Linux CI."),
            Capability("keychain", "local_mac", mac, False, "Secrets stay in macOS Keychain when keyring is available."),
            Capability("voice_speak", "local_mac", bool(shutil.which("say") or shutil.which("espeak") or shutil.which("espeak-ng")), False, "say on Mac, optional espeak elsewhere."),
            Capability("homebrew", "local_mac", self.homebrew_status()["present"], False, "Detect brew. Installs are yellow and must be approved."),
            Capability("cursor_acp", "remote_agent", bool(shutil.which("agent") or shutil.which("cursor-agent")), False, "Local Cursor CLI/ACP. Disconnected until installed. This is the coding path."),
            Capability("computer_use_fallback", "local_mac", mac, False, "Yellow GUI fallback: open/osascript only. Click automation is not claimed."),
            Capability("computer_use_clicks", "local_mac", False, False, "Not claimed. Recovered by a separate Mac agent."),
            Capability("browser_http", "external_api", True, False, "Public HTTP fetch. Not Playwright clicking."),
            Capability("learning", "local_mac", True, False, "Observe → propose → ask. Cannot change spend or security."),
            Capability("public_http_research", "external_api", True, False, "Optional $0 public HTTP. Not a cloud LLM."),
            Capability("cloud_llm", "cloud_ai", cloud, True, "OpenAI/Anthropic stay disconnected until you approve spend."),
        ]

    def local_when_cloud_down(self) -> list[str]:
        return [c.name for c in self.capabilities() if not c.needs_cloud_ai]

    def list_applications(self) -> list[str]:
        names: list[str] = []
        for root in (Path("/Applications"), Path.home() / "Applications"):
            if not root.is_dir():
                continue
            try:
                for item in sorted(root.iterdir()):
                    if item.suffix == ".app":
                        names.append(item.stem)
            except OSError:
                continue
        return names

    def list_workspace(self) -> dict[str, Any]:
        root = workspace_root()
        root.mkdir(parents=True, exist_ok=True)
        entries = []
        for child in sorted(root.iterdir()):
            entries.append({"name": child.name, "dir": child.is_dir()})
        return {"root": str(root), "entries": entries, "plane": "local_mac"}

    def read_workspace_file(self, relative: str) -> dict[str, Any]:
        root = workspace_root().resolve()
        path = (root / relative).resolve()
        try:
            path.relative_to(root)
        except ValueError:
            return {"ok": False, "error": "Path is outside the Projects folder."}
        if path_is_protected(str(path)):
            return {"ok": False, "error": "Protected file. Denied."}
        check = self.security.check_path_access(str(path), "read")
        if not check.allowed:
            return {"ok": False, "error": check.reason}
        if not path.is_file():
            return {"ok": False, "error": "Not a file."}
        return {"ok": True, "path": str(path), "text": path.read_text(encoding="utf-8", errors="replace")[:20_000]}

    def snapshot(self) -> dict[str, Any]:
        caps = [asdict(c) for c in self.capabilities()]
        return {
            "inventory": self.inventory(),
            "capabilities": caps,
            "cloud_ai": self.cloud_ai_status(),
            "works_with_cloud_ai_down": self.local_when_cloud_down(),
            "computer_use": self.computer_use_honesty(),
            "coding_path": {
                "primary": "cursor-acp if agent CLI exists else local-coding",
                "computer_use": False,
            },
            "planes": {
                "local_mac": "This computer: files, apps, git, missions, GUI.",
                "cloud_ai": "Optional paid inference. Off by default. $0 auto spend.",
                "remote_agent": "Cursor ACP/CLI on this Mac when installed.",
                "external_api": "Public HTTP research and similar. Untrusted data.",
            },
        }

    def _app_exists(self, name: str) -> bool:
        return (Path("/Applications") / f"{name}.app").exists() or (
            Path.home() / "Applications" / f"{name}.app"
        ).exists()


def _which_version(binary: str) -> str:
    path = shutil.which(binary)
    if not path:
        return ""
    try:
        proc = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=5)
        return (proc.stdout or proc.stderr).splitlines()[0][:80]
    except Exception:
        return path


def _python_major_minor(path: str) -> str:
    try:
        proc = subprocess.run([path, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], capture_output=True, text=True, timeout=5)
        return (proc.stdout or "").strip()
    except Exception:
        return ""


def _memory() -> int | None:
    try:
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except (ValueError, OSError, AttributeError):
        return None
