from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
import time
import webbrowser

import uvicorn

from . import DEFAULT_PORT
from .logging_util import setup_logging
from .paths import app_data_dir

log = setup_logging()


def _free_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


def start_server(port: int, open_window: bool = True) -> None:
    os.environ.setdefault("AIVS_PORT", str(port))
    url = f"http://127.0.0.1:{port}"
    log.info("AI Video Studio starting at %s (data: %s)", url, app_data_dir())

    config = uvicorn.Config(
        "aivideostudio.app:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
        factory=False,
    )
    server = uvicorn.Server(config)

    def _maybe_window() -> None:
        # wait until the server accepts connections
        for _ in range(50):
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        if not open_window:
            return
        try:
            import webview

            webview.create_window(
                "AI Video Studio",
                url,
                width=1440,
                height=920,
                min_size=(1100, 720),
                confirm_close=False,
            )
            webview.start()
            server.should_exit = True
        except Exception as exc:
            log.info("Native window unavailable (%s). Opening in the browser.", exc)
            webbrowser.open(url)

    if open_window:
        threading.Thread(target=_maybe_window, daemon=True).start()
    server.run()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="AI Video Studio")
    parser.add_argument("--port", type=int, default=int(os.environ.get("AIVS_PORT", DEFAULT_PORT)))
    parser.add_argument("--no-window", action="store_true", help="Run the server without opening a window")
    parser.add_argument("--headless", action="store_true", help="Alias for --no-window")
    args = parser.parse_args(argv)
    port = _free_port(args.port)
    open_window = not (args.no_window or args.headless or os.environ.get("AIVS_HEADLESS") == "1")
    # Ensure engine is importable when launched from the repo
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if root not in sys.path:
        sys.path.insert(0, root)
    start_server(port, open_window=open_window)


if __name__ == "__main__":
    main()
