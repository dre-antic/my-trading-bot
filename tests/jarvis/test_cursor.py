import json
import sys
import threading
import time
from pathlib import Path

from jarvis.cursor_ctrl import AcpClient, CursorAdapter


def test_cursor_status_disconnected_without_binary(app, monkeypatch):
    monkeypatch.setattr("jarvis.cursor_ctrl.shutil.which", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("jarvis.cursor_ctrl.os.path.isfile", lambda *_args, **_kwargs: False)
    adapter = CursorAdapter()
    status = adapter.status()
    assert status.health == "disconnected"
    result = adapter.submit("hello", cwd=".")
    assert result["ok"] is False
    assert result["disconnected"] is True


def test_acp_client_against_fake_server(tmp_path: Path):
    script = tmp_path / "fake_acp.py"
    script.write_text(
        """
import json, sys
def read():
    line = sys.stdin.readline()
    return json.loads(line) if line else None
def write(obj):
    sys.stdout.write(json.dumps(obj) + "\\n")
    sys.stdout.flush()
while True:
    msg = read()
    if not msg:
        break
    method = msg.get("method")
    req_id = msg.get("id")
    if method == "initialize":
        write({"jsonrpc":"2.0","id":req_id,"result":{"protocolVersion":1}})
    elif method == "authenticate":
        write({"jsonrpc":"2.0","id":req_id,"result":{}})
    elif method == "session/new":
        write({"jsonrpc":"2.0","id":req_id,"result":{"sessionId":"s1"}})
    elif method == "session/prompt":
        write({"jsonrpc":"2.0","method":"session/update","params":{"update":{"sessionUpdate":"agent_message_chunk","content":{"text":"hello"}}}})
        write({"jsonrpc":"2.0","id":req_id,"result":{"stopReason":"end"}})
    elif method == "session/cancel":
        pass
""",
        encoding="utf-8",
    )
    client = AcpClient([sys.executable, str(script)])
    client.start()
    try:
        init = client.initialize()
        assert init["protocolVersion"] == 1
        sid = client.session_new(str(tmp_path))
        assert sid == "s1"
        result = client.session_prompt(sid, "Build a list")
        assert result["stopReason"] == "end"
        client.session_cancel(sid)
    finally:
        client.close()
