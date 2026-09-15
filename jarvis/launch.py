"""Launch JARVIS as a local desktop app."""

from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
import time

from .api import make_server
from .app import create_app
from .doctor import SystemDoctor
from .kernel import KERNEL
from .paths import ensure_layout
from .runtime import LocalMacRuntime
from .types import AutonomyMode
from .window import open_local_window

DEFAULT_PORT = 8787


def _free_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="JARVIS personal command center")
    parser.add_argument("--port", type=int, default=int(os.environ.get("JARVIS_PORT", DEFAULT_PORT)))
    parser.add_argument("--no-window", action="store_true")
    parser.add_argument("--mode", choices=[m.value for m in AutonomyMode], default="ASSIST")
    args = parser.parse_args(argv)
    ensure_layout()
    KERNEL.set_mode(AutonomyMode(args.mode))
    runtime = LocalMacRuntime()
    SystemDoctor(runtime).autofix_low_risk()
    app = create_app()
    port = _free_port(args.port)
    httpd = make_server("127.0.0.1", port, app)
    url = f"http://127.0.0.1:{port}"
    print(f"JARVIS local runtime is ready at {url}", file=sys.stderr)
    print("Cloud AI is not required for basic local work.", file=sys.stderr)

    def _window() -> None:
        for _ in range(50):
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        if args.no_window:
            return
        # pywebview must run on the main thread on macOS. Dock launch runs this
        # helper in a daemon thread, so importing it by default can hang and
        # never open Chrome/Safari. Opt in with JARVIS_USE_WEBVIEW=1.
        use_webview = os.environ.get("JARVIS_USE_WEBVIEW", "").strip().lower() in {"1", "true", "yes"}
        if use_webview:
            try:
                import webview

                webview.create_window("JARVIS", url, width=1280, height=860, min_size=(960, 640))
                webview.start()
                httpd.shutdown()
                return
            except Exception:
                pass
        open_local_window(url)

    if not args.no_window:
        threading.Thread(target=_window, daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == "__main__":
    main()
