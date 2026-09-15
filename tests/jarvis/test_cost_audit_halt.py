from jarvis.kernel import KERNEL
from jarvis.types import HaltKind


def test_cost_zero_default(app):
    allowed = app.cost.evaluate("local-coding", "scaffold", 0)
    assert allowed.allowed
    blocked = app.cost.evaluate("openai", "complete", 1.5)
    assert not blocked.allowed
    totals = app.cost.totals()
    assert totals["actual"] == 0
    assert totals["blocked_events"] >= 1


def test_audit_redacts_and_records(app):
    app.audit.record(
        "connect",
        agent="coding",
        tool="web_research",
        target="https://example.com",
        risk="GREEN",
        result="ok token=sk-abcdefghijklmnopqrstuvwxyz99",
    )
    rows = app.audit.recent()
    assert rows
    blob = " ".join(str(v) for v in rows[0].values())
    assert "sk-abcdefghijklmnopqrstuvwxyz99" not in blob
    with app.store.connect() as conn:
        raw = conn.execute("SELECT result FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()["result"]
    assert "sk-abcdefghijklmnopqrstuvwxyz99" not in raw
    assert "[REDACTED]" in raw


def test_stop_and_pause_kernel(app):
    KERNEL.stop_now()
    assert KERNEL.halt == HaltKind.STOP_NOW
    KERNEL.reset()
    KERNEL.pause_safely()
    assert KERNEL.should_pause()
    KERNEL.clear_halt()
    assert KERNEL.halt == HaltKind.NONE
