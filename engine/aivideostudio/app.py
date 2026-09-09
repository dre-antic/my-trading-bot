from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__, credentials, db, licenses, orchestrator, safety
from .compute import as_public_dict, inspect_hardware
from .logging_util import setup_logging
from .paths import project_dir, resources_dir, web_dir
from .review import apply_user_change

log = setup_logging()
app = FastAPI(title="AI Video Studio", version=__version__)
WEB = web_dir()
if (WEB / "assets").exists():
    app.mount("/ui-assets", StaticFiles(directory=WEB / "assets"), name="ui-assets")


class CreateProjectIn(BaseModel):
    prompt: str
    platform: str = "youtube"
    duration: str = "ai_decides"
    custom_seconds: int | None = None
    mode: str = "simple"
    usage_mode: str = "personal"
    channel_id: str | None = None
    template_id: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    name: str | None = None
    license_overrides: list[str] = Field(default_factory=list)


class SecretIn(BaseModel):
    name: str
    value: str


class ChangeIn(BaseModel):
    instruction: str


class ChannelIn(BaseModel):
    name: str
    description: str = ""
    identity: dict[str, Any] = Field(default_factory=dict)


def _row_project(row: dict) -> dict:
    out = dict(row)
    for key in ("settings_json", "plan_json", "research_json", "script_json", "review_json", "cost_json"):
        raw = out.get(key)
        if isinstance(raw, str) and raw:
            try:
                out[key.replace("_json", "")] = json.loads(raw)
            except json.JSONDecodeError:
                out[key.replace("_json", "")] = {}
        elif isinstance(raw, dict):
            out[key.replace("_json", "")] = raw
        else:
            out[key.replace("_json", "")] = {}
    out["id"] = row["id"]
    return out


@app.get("/api/health")
def health():
    return {"ok": True, "version": __version__}


@app.get("/api/system")
def system_status():
    hw = as_public_dict()
    engines = {
        "ffmpeg": hw["ffmpeg_ok"],
        "ollama": hw["ollama_ok"],
        "comfyui": hw["comfyui_ok"],
        "docker": hw["docker_ok"],
        "espeak": True,
    }
    jobs = db.query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 20")
    warnings = []
    for c in licenses.components():
        if c.get("status") in {"REVIEW_REQUIRED", "NON_COMMERCIAL", "UNKNOWN"}:
            warnings.append(f"{c['component_name']} is {c['status']}")
    return {
        "hardware": hw,
        "engines": engines,
        "models": licenses.components(),
        "jobs": jobs,
        "license_warnings": warnings,
        "setup_complete": db.get_setting("setup_complete") == "1",
    }


@app.get("/api/licenses")
def license_list():
    return licenses.load_registry()


@app.get("/api/templates")
def templates():
    path = resources_dir() / "templates.json"
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/channels")
def list_channels():
    return db.query("SELECT * FROM channels ORDER BY updated_at DESC")


@app.post("/api/channels")
def create_channel(body: ChannelIn):
    cid = db.new_id("ch")
    now = db.utcnow()
    db.execute(
        "INSERT INTO channels(id,name,description,identity_json,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        (cid, body.name, body.description, json.dumps(body.identity), now, now),
    )
    return {"id": cid}


@app.get("/api/projects")
def list_projects():
    rows = db.query("SELECT * FROM projects ORDER BY updated_at DESC")
    return [_row_project(r) for r in rows]


@app.post("/api/projects")
def create_project(body: CreateProjectIn):
    check = safety.check_prompt(body.prompt)
    if not check["allowed"]:
        raise HTTPException(400, check["flags"][0]["reason"])
    tmpl = {}
    if body.template_id:
        all_t = templates()["templates"]
        tmpl = next((t for t in all_t if t["id"] == body.template_id), {})
    settings = {
        "max_budget": body.settings.get("max_budget", 0),
        "caption_style": body.settings.get("caption_style") or tmpl.get("caption_style") or "youtube",
        "visual_style": body.settings.get("visual_style") or tmpl.get("visual_style"),
        "genre": tmpl.get("genre"),
        "research_depth": body.settings.get("research_depth") or tmpl.get("research_depth") or "standard",
        "voice_gender": body.settings.get("voice_gender"),
        "speaking_speed": body.settings.get("speaking_speed") or 155,
        "tone": body.settings.get("tone") or tmpl.get("tone"),
        "music_mood": body.settings.get("music_mood") or tmpl.get("tone"),
        "ai_disclosure": body.settings.get("ai_disclosure", "automatic"),
        "compute_preference": body.settings.get("compute_preference", "auto"),
        "aspect_ratio": body.settings.get("aspect_ratio"),
        "license_overrides": body.license_overrides,
        **{k: v for k, v in body.settings.items() if k not in {"license_overrides"}},
    }
    if body.usage_mode == "commercial":
        blocked = []
        for name in ("flux-dev", "hunyuanvideo"):
            rec = licenses.get_component(name)
            if rec:
                ok, reason = licenses.allowed_for_usage(rec, "commercial", override=name in body.license_overrides)
                if not ok:
                    blocked.append(reason)
        # We do not auto-select blocked models; warn only.
        settings["commercial_blocks"] = blocked
    pid = db.new_id("prj")
    name = body.name or (body.prompt[:48] + ("…" if len(body.prompt) > 48 else ""))
    now = db.utcnow()
    db.execute(
        """INSERT INTO projects(id, channel_id, name, prompt, platform, duration, custom_seconds, mode, usage_mode, status, checkpoint, settings_json, created_at, updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            pid,
            body.channel_id,
            name,
            body.prompt,
            body.platform,
            body.duration,
            body.custom_seconds,
            body.mode,
            body.usage_mode,
            "draft",
            "created",
            json.dumps(settings),
            now,
            now,
        ),
    )
    project_dir(pid)
    return {"id": pid, "name": name}


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    row = db.query_one("SELECT * FROM projects WHERE id=?", (pid,))
    if not row:
        raise HTTPException(404, "Project not found")
    data = _row_project(row)
    data["jobs"] = db.query("SELECT * FROM jobs WHERE project_id=? ORDER BY created_at DESC", (pid,))
    data["assets"] = db.query("SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC", (pid,))
    data["versions"] = db.query("SELECT * FROM versions WHERE project_id=? ORDER BY created_at DESC", (pid,))
    data["folder"] = str(project_dir(pid))
    return data


@app.post("/api/projects/{pid}/produce")
def produce(pid: str):
    row = db.query_one("SELECT id FROM projects WHERE id=?", (pid,))
    if not row:
        raise HTTPException(404, "Project not found")
    job_id = orchestrator.start_job(pid, "produce")
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    row = db.query_one("SELECT * FROM jobs WHERE id=?", (job_id,))
    if not row:
        raise HTTPException(404, "Job not found")
    return row


@app.post("/api/jobs/{job_id}/pause")
def pause(job_id: str):
    orchestrator.pause_job(job_id)
    return {"ok": True}


@app.post("/api/jobs/{job_id}/resume")
def resume(job_id: str):
    new_id = orchestrator.resume_job(job_id)
    return {"ok": True, "job_id": new_id}


@app.post("/api/jobs/{job_id}/cancel")
def cancel(job_id: str):
    orchestrator.cancel_job(job_id)
    return {"ok": True}


@app.post("/api/jobs/{job_id}/retry")
def retry(job_id: str):
    return {"job_id": orchestrator.retry_job(job_id)}


@app.get("/api/jobs")
def list_jobs():
    return db.query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50")


@app.post("/api/projects/{pid}/changes")
def request_changes(pid: str, body: ChangeIn):
    row = db.query_one("SELECT * FROM projects WHERE id=?", (pid,))
    if not row:
        raise HTTPException(404)
    proj = _row_project(row)
    script = proj.get("script") or {}
    result = apply_user_change(body.instruction, script)
    db.execute(
        "UPDATE projects SET script_json=?, checkpoint=?, status=?, updated_at=? WHERE id=?",
        (json.dumps(result["script"]), "script", "revising", db.utcnow(), pid),
    )
    # Mark affected stages dirty by deleting outputs
    root = project_dir(pid)
    affected = set(result["affected"])
    mapping = {
        "visuals": root / "visuals" / "manifest.json",
        "voice": root / "audio" / "narration.wav",
        "music": root / "audio" / "music.wav",
        "captions": root / "captions" / "captions.srt",
        "edit": root / "renders" / "timeline.mp4",
        "render": root / "renders" / "final.mp4",
    }
    for key, path in mapping.items():
        if key in affected or "edit" in affected or "render" in affected:
            if key == "visuals" and "visuals" not in affected:
                continue
            if path.exists() and key in affected:
                path.unlink()
    job_id = orchestrator.start_job(pid, "produce")
    return {"job_id": job_id, "affected": result["affected"]}


@app.get("/api/projects/{pid}/file")
def project_file(pid: str, kind: str = "video"):
    root = project_dir(pid)
    mapping = {
        "video": root / "renders" / "final.mp4",
        "thumbnail": root / "thumbnails" / "thumb_A.png",
        "captions": root / "captions" / "captions.srt",
        "vtt": root / "captions" / "captions.vtt",
        "research": root / "research" / "report.md",
    }
    path = mapping.get(kind)
    if not path or not path.exists():
        # pick best thumbnail
        if kind == "thumbnail":
            thumbs = list((root / "thumbnails").glob("thumb_*.png"))
            if thumbs:
                path = thumbs[0]
        if not path or not path.exists():
            raise HTTPException(404, "File not ready yet")
    media = "video/mp4" if path.suffix == ".mp4" else "application/octet-stream"
    return FileResponse(path, media_type=media, filename=path.name)


@app.get("/api/assets")
def assets(category: str | None = None, q: str | None = None):
    sql = "SELECT * FROM assets WHERE 1=1"
    params: list = []
    if category:
        sql += " AND category=?"
        params.append(category)
    if q:
        sql += " AND name LIKE ?"
        params.append(f"%{q}%")
    sql += " ORDER BY created_at DESC LIMIT 200"
    return db.query(sql, tuple(params))


@app.get("/api/settings")
def get_settings():
    return {
        "secrets": credentials.list_secrets_masked(),
        "setup_complete": db.get_setting("setup_complete") == "1",
        "theme": db.get_setting("theme") or "dark",
    }


@app.post("/api/settings/secrets")
def save_secret(body: SecretIn):
    if body.name not in credentials.KNOWN:
        raise HTTPException(400, "Unknown credential")
    credentials.set_secret(body.name, body.value)
    return {"ok": True, "secrets": credentials.list_secrets_masked()}


@app.post("/api/setup/complete")
def complete_setup():
    db.set_setting("setup_complete", "1")
    return {"ok": True}


@app.post("/api/setup/selftest")
def selftest():
    body = CreateProjectIn(
        prompt="Create a 20-second educational video explaining why the sky appears blue.",
        platform="youtube",
        duration="custom",
        custom_seconds=20,
        mode="simple",
        usage_mode="personal",
        name="First-run test video",
        settings={"max_budget": 0, "research_depth": "standard"},
    )
    created = create_project(body)
    job_id = orchestrator.start_job(created["id"], "selftest")
    return {"project_id": created["id"], "job_id": job_id}


@app.get("/")
def index():
    index = WEB / "index.html"
    if not index.exists():
        return HTMLResponse("<h1>AI Video Studio</h1><p>UI files missing.</p>")
    return HTMLResponse(index.read_text(encoding="utf-8"))


def _serve_web_file(name: str, media: str):
    path = WEB / name
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type=media)


@app.get("/app.js")
def app_js():
    return _serve_web_file("app.js", "application/javascript")


@app.get("/styles.css")
def css():
    return _serve_web_file("styles.css", "text/css")


@app.get("/icon.png")
def icon():
    path = resources_dir() / "icons" / "app-icon.png"
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="image/png")
