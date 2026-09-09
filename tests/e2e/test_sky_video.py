"""Full production test: prompt → research → script → visuals → voice → music → captions → review → mp4."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from aivideostudio import db, orchestrator
from aivideostudio.app import CreateProjectIn, create_project
from aivideostudio.paths import project_dir
from aivideostudio.render import technical_qc


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("AIVS_DATA_DIR", str(tmp_path / "studio-data"))
    monkeypatch.setenv("AIVS_HEADLESS", "1")
    db._conn = None
    db.connect()
    return tmp_path


def test_end_to_end_sky_video(isolated):
    created = create_project(
        CreateProjectIn(
            prompt="Create a 60-second educational video explaining why the sky appears blue.",
            platform="youtube",
            duration="custom",
            custom_seconds=28,
            mode="simple",
            usage_mode="personal",
            name="Sky e2e",
            settings={"max_budget": 0, "research_depth": "standard", "caption_style": "youtube"},
        )
    )
    pid = created["id"]
    job_id = db.new_id("job")
    db.execute(
        "INSERT INTO jobs(id, project_id, kind, status, stage, progress, current_activity, logs, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (job_id, pid, "produce", "QUEUED", "queued", 0, "", "", db.utcnow(), db.utcnow()),
    )
    result = orchestrator.produce(pid, job_id, resume=False)
    assert result.get("ok"), result
    root = project_dir(pid)
    final = root / "renders" / "final.mp4"
    assert final.exists(), "final mp4 missing"
    qc = technical_qc(final, expected_duration=20)
    assert qc["ok"], qc
    assert qc["duration"] > 8
    assert qc["audio_codec"]
    assert (root / "captions" / "captions.srt").exists()
    assert (root / "thumbnails" / "concepts.json").exists()
    assert (root / "research" / "report.json").exists()
    review = json.loads((root / "script" / "review.json").read_text())
    assert review["decision"] in {"APPROVE", "REVISE", "REGENERATE", "BLOCK"}
    assets = db.query("SELECT * FROM assets WHERE project_id=?", (pid,))
    assert assets
    licenses = [json.loads(a["license_json"] or "{}") for a in assets]
    assert any(lic.get("status") for lic in licenses)
    # restart survival: project row still there
    row = db.query_one("SELECT * FROM projects WHERE id=?", (pid,))
    assert row["status"] == "complete"
    # Copy a playable artifact next to this test file (repo checkout), not a
    # hardcoded /workspace path — GitHub Actions cannot create that directory.
    artifact_dir = Path(__file__).resolve().parent / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    dest = artifact_dir / "sky-why-blue.mp4"
    dest.write_bytes(final.read_bytes())
    (artifact_dir / "qc.json").write_text(json.dumps(qc, indent=2))
    (artifact_dir / "review.json").write_text(json.dumps(review, indent=2))
