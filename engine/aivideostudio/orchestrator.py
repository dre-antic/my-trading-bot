from __future__ import annotations

import json
import threading
import time
import traceback
from pathlib import Path

from . import audio, cost, db, research, review, script as script_engine, visuals
from .compute import inspect_hardware
from .logging_util import setup_logging, write_json
from .paths import project_dir
from .render import concat_videos, extract_frame, mux, technical_qc, write_ass, write_srt, write_vtt
from .safety import check_prompt, disclosure_text
from .thumbnails import make_thumbnail_concepts
from .util import aspect_for, estimate_speech_seconds

log = setup_logging()

STAGES = [
    "research",
    "script",
    "storyboard",
    "visuals",
    "voice",
    "music",
    "editing",
    "captions",
    "thumbnail",
    "quality_review",
    "final_render",
]


class Cancelled(Exception):
    pass


class Paused(Exception):
    pass


def _project(pid: str) -> dict:
    row = db.query_one("SELECT * FROM projects WHERE id=?", (pid,))
    if not row:
        raise RuntimeError("Project not found")
    for key in ("settings_json", "plan_json", "research_json", "script_json", "review_json", "cost_json"):
        raw = row.get(key)
        if isinstance(raw, str) and raw:
            try:
                row[key] = json.loads(raw)
            except json.JSONDecodeError:
                row[key] = {}
        elif not raw:
            row[key] = {}
    return row


def _save(project: dict, **fields) -> None:
    fields["updated_at"] = db.utcnow()
    sets = []
    values = []
    for k, v in fields.items():
        if k.endswith("_json") and not isinstance(v, str):
            v = json.dumps(v, default=str)
        sets.append(f"{k}=?")
        values.append(v)
    values.append(project["id"])
    db.execute(f"UPDATE projects SET {', '.join(sets)} WHERE id=?", tuple(values))
    project.update(fields)


def _job_update(job_id: str, **fields) -> None:
    if "logs" in fields:
        row = db.query_one("SELECT logs FROM jobs WHERE id=?", (job_id,))
        prev = row["logs"] if row else ""
        fields["logs"] = (prev + fields["logs"])[-20000:]
    fields["updated_at"] = db.utcnow()
    sets = ", ".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE jobs SET {sets} WHERE id=?", tuple(fields.values()) + (job_id,))


def _check_control(job_id: str) -> None:
    row = db.query_one("SELECT cancel_requested, pause_requested, status FROM jobs WHERE id=?", (job_id,))
    if not row:
        return
    if row["cancel_requested"]:
        raise Cancelled()
    if row["pause_requested"]:
        raise Paused()


def _log(job_id: str, project_id: str, stage: str, message: str) -> None:
    line = f"{time.strftime('%H:%M:%S')} | {stage} | {message}\n"
    log.info("project=%s stage=%s %s", project_id, stage, message)
    _job_update(job_id, logs=line, current_activity=message, stage=stage)


def _progress(job_id: str, idx: int, extra: float = 0.0) -> None:
    pct = min(99, int((idx + extra) / len(STAGES) * 100))
    _job_update(job_id, progress=pct, stage=STAGES[min(idx, len(STAGES) - 1)])


def produce(project_id: str, job_id: str, resume: bool = True, only: list[str] | None = None) -> dict:
    project = _project(project_id)
    root = project_dir(project_id)
    settings = project.get("settings_json") or {}
    hardware = inspect_hardware()
    _job_update(job_id, status="RUNNING", stage="research", current_activity="Starting production")
    safety = check_prompt(project["prompt"])
    if not safety["allowed"]:
        _save(project, status="blocked", error=safety["flags"][0]["reason"])
        _job_update(job_id, status="FAILED", error=safety["flags"][0]["reason"], progress=100)
        return {"ok": False, "error": safety["flags"][0]["reason"]}

    done = set()
    if resume:
        ck = project.get("checkpoint") or "created"
        if ck in STAGES:
            # completed stages before checkpoint
            if ck != "created":
                idx = STAGES.index(ck) if ck in STAGES else 0
                done = set(STAGES[:idx])
        if project.get("status") == "complete":
            done = set(STAGES)

    def skip(stage: str) -> bool:
        if only:
            return stage not in only
        return stage in done and resume and _stage_outputs_exist(root, stage, project)

    try:
        if not skip("research"):
            _check_control(job_id)
            _log(job_id, project_id, "research", "Searching reliable sources…")
            _progress(job_id, 0)
            depth = settings.get("research_depth") or ("deep" if project.get("mode") == "advanced" else "standard")
            report = research.research_topic(project["prompt"], depth=depth)
            write_json(root / "research" / "report.json", report)
            (root / "research" / "report.md").write_text(report.get("report") or "", encoding="utf-8")
            _save(project, research_json=report, checkpoint="script", status="producing")
            _log(job_id, project_id, "research", f"Found {len(report.get('sources') or [])} sources.")

        project = _project(project_id)
        if not skip("script"):
            _check_control(job_id)
            _log(job_id, project_id, "script", "Writing a structured script…")
            _progress(job_id, 1)
            sc = script_engine.build_script(
                project["prompt"],
                project["platform"],
                project["duration"],
                project.get("custom_seconds"),
                project.get("research_json") or {},
                settings=settings,
                hardware_level=hardware.class_level,
            )
            write_json(root / "script" / "script.json", sc)
            _save(project, script_json=sc, checkpoint="storyboard")
            _log(job_id, project_id, "script", f"Script has {len(sc['scenes'])} scenes.")

        project = _project(project_id)
        if not skip("storyboard"):
            _check_control(job_id)
            _log(job_id, project_id, "storyboard", "Planning shots…")
            _progress(job_id, 2)
            plan = script_engine.plan_from_script(project["script_json"], hardware.class_level)
            write_json(root / "script" / "plan.json", plan)
            _save(project, plan_json=plan, checkpoint="visuals")

        project = _project(project_id)
        plan = project.get("plan_json") or script_engine.plan_from_script(project["script_json"], hardware.class_level)
        size = aspect_for(project["platform"], settings)
        visual_assets = []

        if not skip("visuals"):
            _check_control(job_id)
            _log(job_id, project_id, "visuals", "Creating scene visuals…")
            _progress(job_id, 3)
            for i, scene in enumerate(plan["scenes"]):
                _log(job_id, project_id, "visuals", f"Scene {scene['scene_id']}: {scene.get('visual_strategy')}")
                meta = visuals.generate_scene_visual(scene, size, root / "visuals", project.get("usage_mode") or "personal")
                meta["scene_id"] = scene["scene_id"]
                visual_assets.append(meta)
                _record_asset(project_id, "images", scene["scene_id"], meta["path"], meta)
                _progress(job_id, 3, i / max(len(plan["scenes"]), 1))
            write_json(root / "visuals" / "manifest.json", visual_assets)
            _save(project, checkpoint="voice")

        manifest_path = root / "visuals" / "manifest.json"
        if manifest_path.exists():
            visual_assets = json.loads(manifest_path.read_text(encoding="utf-8"))

        voice_parts = []
        if not skip("voice"):
            _check_control(job_id)
            _log(job_id, project_id, "voice", "Recording narration…")
            _progress(job_id, 4)
            for scene in plan["scenes"]:
                wav = root / "audio" / f"{scene['scene_id']}.wav"
                meta = audio.speak(scene["narration"], wav, settings)
                meta["scene_id"] = scene["scene_id"]
                voice_parts.append(meta)
                _record_asset(project_id, "voices", scene["scene_id"], str(wav), meta)
            voice_all = audio.concat_wavs([Path(p["path"]) for p in voice_parts], root / "audio" / "narration.wav")
            write_json(root / "audio" / "voice.json", voice_parts)
            # Retiming: picture follows the real narration, not a padded estimate.
            for scene, part in zip(plan["scenes"], voice_parts):
                actual = audio.wav_duration(Path(part["path"])) + 0.25
                scene["duration"] = round(max(2.5, actual), 2)
                png = root / "visuals" / f"{scene['scene_id']}.png"
                clip = root / "visuals" / f"{scene['scene_id']}.mp4"
                if png.exists():
                    visuals.ken_burns(png, clip, scene["duration"], size)
                    _record_asset(project_id, "videos", scene["scene_id"] + "_motion", str(clip), {"scene_id": scene["scene_id"], "duration": scene["duration"]})
                    for item in visual_assets:
                        if item.get("scene_id") == scene["scene_id"]:
                            item["clip"] = str(clip)
            if visual_assets:
                write_json(root / "visuals" / "manifest.json", visual_assets)
            _save(project, checkpoint="music")
        else:
            voice_all = root / "audio" / "narration.wav"

        if not skip("music"):
            _check_control(job_id)
            _log(job_id, project_id, "music", "Composing original music…")
            _progress(job_id, 5)
            duration = max(audio.wav_duration(voice_all), sum(s["duration"] for s in plan["scenes"]))
            mood = settings.get("music_mood") or (plan["scenes"][0].get("style") if plan["scenes"] else "clear")
            if isinstance(mood, str) and mood in {"motion-graphics", "cinematic"}:
                mood = "cinematic" if mood == "cinematic" else "clear"
            mus = audio.synthesize_music(duration + 1.5, str(mood), root / "audio" / "music.wav")
            audio.synthesize_sfx("whoosh", root / "audio" / "whoosh.wav")
            mixed = audio.mix_voice_music(voice_all, Path(mus["path"]), root / "audio" / "mix.m4a")
            write_json(root / "audio" / "music.json", mus)
            write_json(root / "audio" / "mix.json", mixed)
            _record_asset(project_id, "music", "score", mus["path"], mus)
            cost.record(project_id, "local", "studio_composer", 0, 0, "$0 external cost")
            _save(project, checkpoint="editing")

        if not skip("editing"):
            _check_control(job_id)
            _log(job_id, project_id, "editing", "Editing the timeline…")
            _progress(job_id, 6)
            clips = [Path(v["clip"]) for v in visual_assets if v.get("clip") and Path(v["clip"]).exists()]
            if not clips:
                clips = sorted((root / "visuals").glob("*.mp4"))
            timeline = root / "renders" / "timeline.mp4"
            concat_videos(clips, timeline)
            write_json(
                root / "script" / "timeline.json",
                {
                    "video": [c.name for c in clips],
                    "voice": "narration.wav",
                    "music": "music.wav",
                    "sfx": ["whoosh.wav"],
                    "captions": "captions.srt",
                    "graphics": [],
                },
            )
            _save(project, checkpoint="captions")

        cues = []
        t0 = 0.0
        for scene in plan["scenes"]:
            dur = max(scene["duration"], estimate_speech_seconds(scene["narration"]))
            cues.append({"start": t0, "end": t0 + dur, "text": scene["caption_text"], "scene_id": scene["scene_id"]})
            t0 += dur
        total_dur = t0

        if not skip("captions"):
            _check_control(job_id)
            _log(job_id, project_id, "captions", "Timing captions…")
            _progress(job_id, 7)
            style = settings.get("caption_style") or ("shorts" if project["platform"] in {"tiktok", "youtube_shorts", "both"} else "youtube")
            write_srt(cues, root / "captions" / "captions.srt")
            write_vtt(cues, root / "captions" / "captions.vtt")
            write_ass(cues, root / "captions" / "captions.ass", size, style)
            _save(project, checkpoint="thumbnail")

        if not skip("thumbnail"):
            _check_control(job_id)
            _log(job_id, project_id, "thumbnail", "Designing thumbnails…")
            _progress(job_id, 8)
            still = Path(visual_assets[0]["path"]) if visual_assets else None
            concepts = make_thumbnail_concepts(project["script_json"].get("title") or project["name"], still, root / "thumbnails")
            write_json(root / "thumbnails" / "concepts.json", concepts)
            _record_asset(project_id, "thumbnails", "chosen", concepts[0]["path"], concepts[0])
            _save(project, checkpoint="quality_review")

        # Final mux happens before review so reviewers can inspect the file
        if not skip("final_render"):
            _check_control(job_id)
            _log(job_id, project_id, "final_render", "Rendering the final video…")
            _progress(job_id, 10)
            video_in = root / "renders" / "timeline.mp4"
            audio_in = root / "audio" / "mix.m4a"
            if not audio_in.exists():
                audio_in = root / "audio" / "narration.wav"
            final = root / "renders" / "final.mp4"
            mux(video_in, audio_in, final, root / "captions" / "captions.ass", size)
            if settings.get("ai_disclosure", "automatic") != "never":
                write_json(
                    root / "renders" / "disclosure.json",
                    {"text": disclosure_text(settings.get("ai_disclosure", "automatic")), "ai_generated": True},
                )
            _save(project, checkpoint="quality_review")

        qc = technical_qc(root / "renders" / "final.mp4", expected_duration=total_dur)
        write_json(root / "renders" / "qc.json", qc)

        if not skip("quality_review"):
            _check_control(job_id)
            _log(job_id, project_id, "quality_review", "Independent review in progress…")
            _progress(job_id, 9)
            findings = []
            findings += review.story_review(project["script_json"])
            findings += review.fact_review(project["script_json"], project.get("research_json") or {})
            findings += review.visual_review(visual_assets)
            findings += review.audio_review(root / "audio" / "narration.wav", root / "audio" / "mix.m4a")
            findings += review.caption_review(cues, qc.get("duration") or total_dur)
            findings += review.continuity_review(visual_assets, (project.get("plan_json") or {}).get("style_bible") or {})
            findings += review.technical_review(qc)
            findings += review.platform_review(project["platform"], qc, project["script_json"])
            verdict = review.executive_producer(findings)
            write_json(root / "script" / "review.json", verdict)
            db.execute(
                "INSERT INTO reviews(id, project_id, version, reviewer, findings_json, created_at) VALUES(?,?,?,?,?,?)",
                (db.new_id("rev"), project_id, project.get("version") or 1, "executive", json.dumps(verdict), db.utcnow()),
            )
            _save(project, review_json=verdict, checkpoint="complete")
            if verdict["decision"] in {"REGENERATE", "REVISE"} and (settings.get("auto_correct", True)):
                _log(job_id, project_id, "quality_review", "Fixing the smallest possible issues…")
                _auto_correct(project_id, job_id, verdict, root, plan, size, settings)

        # snapshot version
        db.execute(
            "INSERT INTO versions(id, project_id, number, label, notes, snapshot_json, created_at) VALUES(?,?,?,?,?,?,?)",
            (
                db.new_id("ver"),
                project_id,
                project.get("version") or 1,
                "Draft",
                "",
                json.dumps({"checkpoint": "complete"}),
                db.utcnow(),
            ),
        )
        _save(project, status="complete", checkpoint="complete")
        _job_update(job_id, status="COMPLETED", progress=100, current_activity="Done", stage="complete")
        _log(job_id, project_id, "complete", "Your video is ready.")
        return {"ok": True, "final": str(root / "renders" / "final.mp4")}
    except Cancelled:
        _job_update(job_id, status="CANCELLED", current_activity="Cancelled")
        _save(project, status="cancelled")
        return {"ok": False, "error": "cancelled"}
    except Paused:
        _job_update(job_id, status="PAUSED", current_activity="Paused")
        _save(project, status="paused")
        return {"ok": False, "error": "paused"}
    except Exception as exc:
        tb = traceback.format_exc()
        log.error(tb)
        friendly = _friendly_error(exc)
        _job_update(job_id, status="FAILED", error=friendly, logs=tb[-2000:])
        _save(project, status="failed", error=friendly)
        return {"ok": False, "error": friendly}


def _stage_outputs_exist(root: Path, stage: str, project: dict) -> bool:
    mapping = {
        "research": root / "research" / "report.json",
        "script": root / "script" / "script.json",
        "storyboard": root / "script" / "plan.json",
        "visuals": root / "visuals" / "manifest.json",
        "voice": root / "audio" / "narration.wav",
        "music": root / "audio" / "music.wav",
        "editing": root / "renders" / "timeline.mp4",
        "captions": root / "captions" / "captions.srt",
        "thumbnail": root / "thumbnails" / "concepts.json",
        "quality_review": root / "script" / "review.json",
        "final_render": root / "renders" / "final.mp4",
    }
    path = mapping.get(stage)
    return bool(path and path.exists())


def _record_asset(project_id: str, category: str, name: str, path: str, meta: dict) -> None:
    db.execute(
        "INSERT INTO assets(id, project_id, category, name, path, mime, metadata_json, license_json, created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        (
            db.new_id("asset"),
            project_id,
            category,
            name,
            path,
            Path(path).suffix,
            json.dumps({k: v for k, v in meta.items() if k != "license"}, default=str),
            json.dumps(meta.get("license") or {}, default=str),
            db.utcnow(),
        ),
    )


def _auto_correct(project_id: str, job_id: str, verdict: dict, root: Path, plan: dict, size, settings: dict) -> None:
    """Fix smallest component then re-render if needed. One pass only."""
    findings = verdict.get("findings") or []
    critical_visual = [f for f in findings if f["reviewer"] == "Visual Reviewer" and f["severity"] == "CRITICAL"]
    for f in critical_visual[:2]:
        sid = f.get("scene_id")
        scene = next((s for s in plan["scenes"] if s["scene_id"] == sid), None)
        if not scene:
            continue
        _log(job_id, project_id, "quality_review", f"Regenerating {sid} only.")
        visuals.generate_scene_visual(scene, size, root / "visuals")
        clip = root / "visuals" / f"{sid}.mp4"
        png = root / "visuals" / f"{sid}.png"
        if png.exists():
            visuals.ken_burns(png, clip, scene["duration"], size)
    tech = [f for f in findings if f["reviewer"] == "Technical Reviewer" and f["severity"] == "CRITICAL"]
    if tech or critical_visual:
        clips = sorted((root / "visuals").glob("S*.mp4")) or sorted((root / "visuals").glob("*.mp4"))
        if clips:
            from .render import concat_videos, mux

            concat_videos(clips, root / "renders" / "timeline.mp4")
            audio_in = root / "audio" / "mix.m4a"
            if audio_in.exists():
                mux(root / "renders" / "timeline.mp4", audio_in, root / "renders" / "final.mp4", root / "captions" / "captions.ass", size)
        qc = technical_qc(root / "renders" / "final.mp4")
        write_json(root / "renders" / "qc.json", qc)


def _friendly_error(exc: Exception) -> str:
    msg = str(exc)
    if "ffmpeg" in msg.lower() or isinstance(exc, FileNotFoundError) and "ffmpeg" in str(exc):
        return "The video editor (FFmpeg) is missing or failed. The setup wizard can install it."
    if "HTTP" in msg or "502" in msg or "503" in msg:
        return "A generation service is temporarily unavailable. The system will retry automatically next time."
    if "disk" in msg.lower() or "No space" in msg:
        return "There is not enough disk space to finish this video."
    return "Something went wrong while building the video. Open technical details in the task log."


_workers: dict[str, threading.Thread] = {}


def start_job(project_id: str, kind: str = "produce") -> str:
    job_id = db.new_id("job")
    db.execute(
        "INSERT INTO jobs(id, project_id, kind, status, stage, progress, current_activity, logs, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (job_id, project_id, kind, "QUEUED", "queued", 0, "Waiting to start", "", db.utcnow(), db.utcnow()),
    )
    t = threading.Thread(target=_run_safe, args=(project_id, job_id, kind), daemon=True)
    _workers[job_id] = t
    t.start()
    return job_id


def _run_safe(project_id: str, job_id: str, kind: str) -> None:
    try:
        if kind == "produce":
            produce(project_id, job_id)
        elif kind == "selftest":
            produce(project_id, job_id, resume=False)
        else:
            produce(project_id, job_id)
    except Exception as exc:
        _job_update(job_id, status="FAILED", error=str(exc))


def pause_job(job_id: str) -> None:
    db.execute("UPDATE jobs SET pause_requested=1, status='PAUSED', updated_at=? WHERE id=?", (db.utcnow(), job_id))


def resume_job(job_id: str) -> str:
    row = db.query_one("SELECT project_id FROM jobs WHERE id=?", (job_id,))
    db.execute("UPDATE jobs SET pause_requested=0, cancel_requested=0, status='QUEUED', updated_at=? WHERE id=?", (db.utcnow(), job_id))
    if not row:
        raise RuntimeError("job missing")
    return start_job(row["project_id"], "produce")


def cancel_job(job_id: str) -> None:
    db.execute("UPDATE jobs SET cancel_requested=1, status='CANCELLED', updated_at=? WHERE id=?", (db.utcnow(), job_id))


def retry_job(job_id: str) -> str:
    row = db.query_one("SELECT project_id, retry_count FROM jobs WHERE id=?", (job_id,))
    if not row:
        raise RuntimeError("job missing")
    db.execute("UPDATE jobs SET retry_count=retry_count+1 WHERE id=?", (job_id,))
    return start_job(row["project_id"], "produce")
