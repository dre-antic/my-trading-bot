from __future__ import annotations

from pathlib import Path

from .util import estimate_speech_seconds, word_count


def _finding(reviewer: str, severity: str, problem: str, evidence: str, fix: str, scene_id: str | None = None, timestamp: float | None = None, confidence: float = 0.7):
    return {
        "reviewer": reviewer,
        "severity": severity,
        "scene_id": scene_id,
        "timestamp": timestamp,
        "problem": problem,
        "evidence": evidence,
        "recommended_fix": fix,
        "confidence": confidence,
    }


def story_review(script: dict) -> list[dict]:
    out = []
    scenes = script.get("scenes") or []
    if not scenes:
        out.append(_finding("Story Reviewer", "CRITICAL", "No scenes in the script", "script.scenes empty", "Regenerate the script"))
        return out
    first = scenes[0]["narration"]
    if word_count(first) < 4:
        out.append(_finding("Story Reviewer", "IMPORTANT", "Opening has almost no hook", first, "Rewrite the opening line", scenes[0]["scene_id"], 0))
    if not any(s.get("purpose") == "outro" for s in scenes):
        out.append(_finding("Story Reviewer", "IMPORTANT", "Missing ending", "no outro scene", "Add a closing scene"))
    texts = [s["narration"] for s in scenes]
    if len(set(texts)) < max(1, len(texts) - 1) and len(texts) > 3:
        out.append(_finding("Story Reviewer", "IMPORTANT", "Scenes repeat the same narration", "duplicate narration", "Rewrite repeated scenes"))
    return out


def fact_review(script: dict, research: dict) -> list[dict]:
    out = []
    claims = " ".join(c.get("text", "") for c in research.get("claims") or [])
    for scene in script.get("scenes") or []:
        for token in scene["narration"].split():
            if token.isdigit() and len(token) > 3 and token not in claims:
                out.append(
                    _finding(
                        "Fact Reviewer",
                        "IMPORTANT",
                        "Number not found in research sources",
                        token,
                        "Remove or source the number",
                        scene["scene_id"],
                    )
                )
    if research.get("confidence", 1) < 0.4:
        out.append(_finding("Fact Reviewer", "IMPORTANT", "Overall source confidence is low", str(research.get("confidence")), "Label uncertainties on screen"))
    for u in (research.get("uncertainties") or [])[:3]:
        out.append(_finding("Fact Reviewer", "MINOR", "Uncertain fact", u, "Soften language or cite the source"))
    return out


def visual_review(visuals: list[dict]) -> list[dict]:
    out = []
    if not visuals:
        out.append(_finding("Visual Reviewer", "CRITICAL", "No visuals generated", "empty", "Generate scene stills"))
    for v in visuals:
        p = Path(v.get("path") or "")
        if not p.exists() or p.stat().st_size < 1000:
            out.append(_finding("Visual Reviewer", "CRITICAL", "Visual file missing or empty", str(p), "Regenerate this still", v.get("scene_id")))
    return out


def audio_review(voice_path: Path | None, mixed_path: Path | None) -> list[dict]:
    out = []
    if not voice_path or not Path(voice_path).exists():
        out.append(_finding("Audio Reviewer", "CRITICAL", "Narration audio missing", str(voice_path), "Regenerate voice"))
    if mixed_path and Path(mixed_path).exists() and Path(mixed_path).stat().st_size < 1000:
        out.append(_finding("Audio Reviewer", "CRITICAL", "Mixed audio is empty", str(mixed_path), "Remix audio"))
    return out


def caption_review(cues: list[dict], duration: float) -> list[dict]:
    out = []
    if not cues:
        out.append(_finding("Caption Reviewer", "IMPORTANT", "No captions", "empty", "Build captions from the script"))
    for cue in cues:
        if cue["end"] < cue["start"]:
            out.append(_finding("Caption Reviewer", "CRITICAL", "Caption ends before it starts", str(cue), "Fix timestamps"))
        if cue["end"] > duration + 2:
            out.append(_finding("Caption Reviewer", "MINOR", "Caption extends past the video", str(cue["end"]), "Clamp caption end"))
    return out


def continuity_review(visuals: list[dict], style_bible: dict) -> list[dict]:
    out = []
    providers = {v.get("provider") for v in visuals}
    if len(providers) > 3:
        out.append(_finding("Continuity Reviewer", "MINOR", "Many different visual providers", str(providers), "Restyle outliers"))
    return out


def technical_review(qc: dict) -> list[dict]:
    out = []
    for f in qc.get("findings") or []:
        out.append(_finding("Technical Reviewer", f.get("severity", "MINOR"), f.get("problem", ""), f.get("evidence", ""), "Repair the render"))
    return out


def platform_review(platform: str, qc: dict, script: dict) -> list[dict]:
    out = []
    w, h = qc.get("width") or 0, qc.get("height") or 0
    if platform in {"tiktok", "youtube_shorts", "both"} and w and h and w > h:
        out.append(_finding("Platform Reviewer", "IMPORTANT", "Vertical platform received a landscape video", f"{w}x{h}", "Render 9:16"))
    if platform == "youtube" and h > w:
        out.append(_finding("Platform Reviewer", "MINOR", "YouTube long-form is usually landscape", f"{w}x{h}", "Optional 16:9 render"))
    seconds = script.get("estimated_seconds") or 0
    if platform in {"tiktok", "youtube_shorts"} and seconds > 180:
        out.append(_finding("Platform Reviewer", "IMPORTANT", "Short is longer than typical platform limits", str(seconds), "Shorten the cut"))
    return out


def executive_producer(findings: list[dict]) -> dict:
    critical = [f for f in findings if f["severity"] == "CRITICAL"]
    important = [f for f in findings if f["severity"] == "IMPORTANT"]
    if critical:
        decision = "REGENERATE"
        summary = "Critical issues must be fixed before this can ship."
    elif len(important) >= 3:
        decision = "REVISE"
        summary = "Several important issues should be fixed in the smallest possible way."
    elif important:
        decision = "REVISE"
        summary = "A few important notes. The video can still play, but changes are recommended."
    else:
        decision = "APPROVE"
        summary = "No blocking issues. You can download this draft."
    return {
        "decision": decision,
        "summary": summary,
        "critical": len(critical),
        "important": len(important),
        "minor": len([f for f in findings if f["severity"] == "MINOR"]),
        "findings": findings,
    }


def apply_user_change(instruction: str, script: dict) -> dict:
    """Translate a natural-language change into affected components."""
    t = instruction.lower()
    affected = set()
    if any(k in t for k in ("voice", "narrator", "energetic", "speak", "tone")):
        affected.update(["voice", "captions", "edit", "render"])
    if any(k in t for k in ("caption", "subtitle")):
        affected.update(["captions", "render"])
    if any(k in t for k in ("music", "soundtrack", "score")):
        affected.update(["music", "edit", "render"])
    if any(k in t for k in ("visual", "image", "cartoon", "realistic", "cinematic")):
        affected.update(["visuals", "edit", "render"])
    if any(k in t for k in ("shorter", "faster", "pacing", "introduction", "opening", "scene")):
        affected.update(["script", "visuals", "voice", "edit", "render"])
    if any(k in t for k in ("humor", "serious", "rewrite", "script")):
        affected.update(["script", "voice", "visuals", "edit", "render"])
    if not affected:
        affected.update(["script", "review"])
    # Light mutations for obvious requests
    if "energetic" in t:
        for s in script.get("scenes") or []:
            if not s["narration"].endswith("!"):
                s["narration"] = s["narration"].rstrip(".") + "."
        script["voice_style"] = "energetic"
    if "shorter" in t or "shorten" in t:
        for s in script.get("scenes") or []:
            words = s["narration"].split()
            s["narration"] = " ".join(words[: max(8, int(len(words) * 0.7))])
            s["caption_text"] = s["narration"]
            s["duration"] = round(max(3.0, estimate_speech_seconds(s["narration"]) + 0.4), 2)
    if "cartoon" in t:
        for s in script.get("scenes") or []:
            s["style"] = "cartoon"
            s["visual_strategy"] = "CARTOON"
    if "realistic" in t:
        for s in script.get("scenes") or []:
            s["style"] = "cinematic"
    return {"script": script, "affected": sorted(affected), "instruction": instruction}
