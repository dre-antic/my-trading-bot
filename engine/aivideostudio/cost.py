from __future__ import annotations

from . import db


def project_budget(project: dict) -> float:
    settings = _as_dict(project.get("settings_json"))
    return float(settings.get("max_budget", 0) or 0)


def spent(project_id: str) -> float:
    rows = db.query("SELECT estimated, actual FROM cost_events WHERE project_id=?", (project_id,))
    total = 0.0
    for row in rows:
        total += float(row["actual"] if row["actual"] is not None else row["estimated"] or 0)
    return total


def estimate_cloud_call(provider: str, kind: str) -> float:
    table = {
        ("openai", "llm"): 0.02,
        ("openai", "image"): 0.04,
        ("openai", "tts"): 0.02,
        ("openai", "video"): 0.50,
        ("comfyui", "image"): 0.0,
        ("comfyui", "video"): 0.0,
        ("local", "any"): 0.0,
    }
    return table.get((provider, kind), 0.0)


def can_spend(project: dict, extra: float) -> tuple[bool, str]:
    budget = project_budget(project)
    if extra <= 0:
        return True, "local"
    if budget <= 0 and extra > 0:
        return False, "This project budget is $0. Cloud generation was stopped so the app never spends money silently."
    used = spent(project["id"])
    if used + extra > budget:
        return False, f"This step may cost about ${extra:.2f} and would exceed the ${budget:.2f} project budget."
    return True, "ok"


def record(project_id: str | None, provider: str, model: str, estimated: float, actual: float | None = None, notes: str = "") -> None:
    db.execute(
        "INSERT INTO cost_events(id, project_id, provider, model, estimated, actual, notes, created_at) VALUES(?,?,?,?,?,?,?,?)",
        (db.new_id("cost"), project_id, provider, model, estimated, actual, notes, db.utcnow()),
    )


def _as_dict(raw):
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    import json

    return json.loads(raw)
