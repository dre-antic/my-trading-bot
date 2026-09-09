from __future__ import annotations

import re
from typing import Any

from .providers import pick_llm
from .util import detect_genre, estimate_speech_seconds, target_seconds, word_count

HOOKS = {
    "educational": "Here is the simple reason this actually happens.",
    "explainer": "If you have ever wondered about this, the answer is hiding in plain sight.",
    "documentary": "To understand this story, we have to go back to the beginning.",
    "list": "These are the points that matter most.",
    "storytelling": "It started as an ordinary day. It did not stay that way.",
    "entertainment": "This is going to sound ridiculous, until it does not.",
    "news": "Here is what we know, and what we still cannot confirm.",
    "cinematic": "The camera finds a quiet moment before everything changes.",
    "cartoon": "Meet our character. Trouble is already on the way.",
}


def _sentences_from_claims(claims: list[dict], limit: int) -> list[str]:
    out = []
    for c in claims:
        text = re.sub(r"\s+", " ", c.get("text") or "").strip()
        if len(text) < 40:
            continue
        # Keep a speakable length
        if len(text) > 220:
            text = text[:217].rsplit(" ", 1)[0] + "."
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _visual_goal(text: str, genre: str) -> str:
    t = text.lower()
    if any(k in t for k in ("sky", "atmosphere", "sun", "light", "scatter")):
        return "Show sunlight moving through air, with particles and a wide sky."
    if any(k in t for k in ("map", "country", "city", "ocean", "island")):
        return "Show a stylized map and geographic context."
    if any(k in t for k in ("number", "percent", "%", "data", "study")):
        return "Show a clean diagram or comparison graphic."
    if genre in {"cartoon"}:
        return "Show a simple character-driven illustration matching the narration."
    if genre in {"cinematic", "documentary", "storytelling"}:
        return "Show a cinematic wide environment that matches the narration."
    return "Show a clear visual metaphor for the idea being explained."


def _visual_method(scene: dict, hardware_level: str, duration: float) -> str:
    text = (scene.get("narration") + " " + scene.get("visual_goal", "")).lower()
    if any(k in text for k in ("diagram", "wavelength", "compare", "percent", "list")):
        return "DIAGRAM"
    if any(k in text for k in ("map", "country", "route")):
        return "MAP"
    if scene.get("purpose") == "title":
        return "TEXT_GRAPHICS"
    if hardware_level == "HIGH" and duration <= 6 and scene.get("importance") == "high":
        return "AI_VIDEO"
    if scene.get("style") == "cartoon":
        return "CARTOON"
    return "AI_IMAGE_PLUS_MOTION"


def build_script(
    prompt: str,
    platform: str,
    duration_key: str,
    custom_seconds: int | None,
    research: dict,
    settings: dict | None = None,
    hardware_level: str = "LOW",
) -> dict:
    settings = settings or {}
    genre = detect_genre(prompt, settings.get("genre"))
    seconds = target_seconds(platform, duration_key, custom_seconds, prompt)
    seconds = min(seconds, int(settings.get("max_seconds") or seconds))
    target_words = int(seconds * 145 / 60)
    claims = research.get("claims") or []
    fact_sentences = _sentences_from_claims(claims, limit=max(4, seconds // 8))

    hook = HOOKS.get(genre, HOOKS["explainer"])
    topic = research.get("topic") or prompt
    title = _title_from(prompt, topic)

    # Scene budget: ~10-14s each including title/outro
    body_time = max(20, seconds - 10)
    approx_scenes = max(3, min(12, round(body_time / 12)))
    facts = fact_sentences or [
        f"{topic} can be explained in plain language, using only what we can support.",
        "The important idea is the relationship between cause and effect, not a list of trivia.",
        "When a detail cannot be verified, this video will say so instead of inventing it.",
    ]
    while len(facts) < approx_scenes:
        facts.append(facts[len(facts) % len(facts)])
    facts = facts[:approx_scenes]

    scenes = []
    scenes.append(
        _scene(
            0,
            "title",
            4.5,
            f"{title}.",
            "Bold title card that states the question immediately.",
            platform,
            genre,
            hardware_level,
        )
    )
    remaining = facts
    each = max(7.0, (seconds - 10) / max(len(remaining), 1))
    spoken_so_far = []
    for i, fact in enumerate(remaining, start=1):
        narration = fact if i > 1 else f"{hook} {fact}"
        spoken_so_far.append(narration)
        scenes.append(
            _scene(
                i,
                "body",
                min(18, each),
                narration,
                _visual_goal(narration, genre),
                platform,
                genre,
                hardware_level,
            )
        )
    # Fill remaining runtime with additional sourced lines instead of silent padding.
    target_words = max(target_words, 40)
    extra_idx = 0
    while word_count(" ".join(s["narration"] for s in scenes)) < target_words * 0.88 and extra_idx < 12:
        fact = facts[extra_idx % len(facts)]
        extra_idx += 1
        if any(fact[:50] in s["narration"] for s in scenes):
            # Paraphrase-style expansion that stays conservative.
            narration = f"In other words, {fact[0].lower() + fact[1:]}" if len(fact) > 1 else fact
            if any(narration[:40] in s["narration"] for s in scenes):
                continue
        else:
            narration = fact
        idx = len(scenes)
        scenes.append(
            _scene(
                idx,
                "body",
                8.0,
                narration,
                _visual_goal(narration, genre),
                platform,
                genre,
                hardware_level,
            )
        )
    closer = "That is the core idea. Once you see it, it is hard to unsee."
    if research.get("attribution"):
        closer += " Sources are listed in the video description."
    scenes.append(
        _scene(
            len(scenes),
            "outro",
            5.0,
            closer,
            "Calm closing frame with the title and a simple visual echo of the opening.",
            platform,
            genre,
            hardware_level,
        )
    )

    script = {
        "title": title,
        "genre": genre,
        "platform": platform,
        "target_seconds": seconds,
        "target_words": target_words,
        "hook": hook,
        "logline": f"A {genre} video about {topic}.",
        "scenes": scenes,
        "citations": [
            {"claim": c.get("text"), "url": c.get("source_url"), "source": c.get("source"), "confidence": c.get("confidence")}
            for c in claims[:20]
        ],
        "attribution": research.get("attribution"),
    }
    script = _fit_duration(script, seconds)
    script = critique_and_revise(script, platform)
    if settings.get("use_llm"):
        script = _maybe_llm_polish(script, prompt, research)
    return script


def _title_from(prompt: str, topic: str) -> str:
    p = prompt.strip().rstrip(".")
    p = re.sub(r"^(create|make|produce)\s+(a|an)\s+[^.]*?(video|short|documentary)\s+(about|explaining)\s+", "", p, flags=re.I)
    if len(p) > 72:
        p = topic[:72]
    return p[:1].upper() + p[1:] if p else topic.title()


def _scene(idx: int, purpose: str, duration: float, narration: str, visual_goal: str, platform: str, genre: str, hardware_level: str) -> dict:
    scene = {
        "scene_id": f"S{idx:02d}",
        "duration": round(duration, 2),
        "purpose": purpose,
        "narration": narration.strip(),
        "visual_goal": visual_goal,
        "visual_prompt": visual_goal + " Cinematic lighting, coherent style, no readable gibberish text.",
        "camera_direction": "slow push-in" if purpose != "outro" else "gentle pull-back",
        "motion": "ken-burns",
        "characters": [],
        "environment": "topic-world",
        "style": "cartoon" if genre == "cartoon" else ("cinematic" if genre in {"cinematic", "documentary"} else "motion-graphics"),
        "music": "underscore",
        "sound_effects": ["whoosh"] if purpose == "title" else [],
        "caption_text": narration.strip(),
        "transition": "crossfade",
        "continuity_requirements": ["keep color palette", "keep typography"],
        "importance": "high" if purpose in {"title", "body"} and idx <= 2 else "normal",
    }
    scene["visual_strategy"] = _visual_method(scene, hardware_level, duration)
    scene["continuity_dependencies"] = []
    return scene


def _fit_duration(script: dict, seconds: int) -> dict:
    # Duration follows speech. Do not invent minutes of silence to hit a number.
    all_text = " ".join(s["narration"] for s in script["scenes"])
    spoken = estimate_speech_seconds(all_text)
    if spoken > seconds * 1.2:
        scale = seconds / spoken
        for s in script["scenes"]:
            words = s["narration"].split()
            keep = max(6, int(len(words) * scale))
            s["narration"] = " ".join(words[:keep])
            s["caption_text"] = s["narration"]
    for s in script["scenes"]:
        s["duration"] = round(max(2.8, estimate_speech_seconds(s["narration"]) + 0.45), 2)
        s["caption_text"] = s["narration"]
    script["estimated_seconds"] = round(sum(s["duration"] for s in script["scenes"]), 2)
    return script


def critique_and_revise(script: dict, platform: str) -> dict:
    issues = []
    scenes = script["scenes"]
    texts = [s["narration"].lower() for s in scenes]
    # repetition
    for i, t in enumerate(texts):
        for j in range(i + 1, len(texts)):
            overlap = set(t.split()) & set(texts[j].split())
            if len(overlap) > 12 and t[:40] == texts[j][:40]:
                issues.append({"scene_id": scenes[j]["scene_id"], "problem": "repetition"})
                words = scenes[j]["narration"].split()
                scenes[j]["narration"] = " ".join(words[len(words) // 4 :] + ["This is a different part of the same idea."])
    if platform in {"youtube_shorts", "tiktok", "both"}:
        if not any(s["purpose"] == "title" for s in scenes):
            issues.append({"problem": "missing hook"})
        first = scenes[0]["narration"]
        if len(first.split()) > 28:
            scenes[0]["narration"] = " ".join(first.split()[:22])
            issues.append({"scene_id": scenes[0]["scene_id"], "problem": "hook too slow", "fix": "shortened"})
    if script.get("estimated_seconds", 0) > 30 and not any("that is the core" in s["narration"].lower() or s["purpose"] == "outro" for s in scenes):
        issues.append({"problem": "weak ending"})
    # clarity: strip markdown/citations from speech
    for s in scenes:
        s["narration"] = re.sub(r"\[[^\]]+\]", "", s["narration"])
        s["narration"] = re.sub(r"https?://\S+", "", s["narration"]).strip()
        s["caption_text"] = s["narration"]
    script["critic"] = {
        "issues_found": issues,
        "hook_ok": True,
        "platform_ok": True,
        "revised": True,
    }
    return script


def _maybe_llm_polish(script: dict, prompt: str, research: dict) -> dict:
    llm = pick_llm()
    if llm.name == "studio_writer":
        return script
    system = (
        "You rewrite video narration. Return JSON with key scenes: [{scene_id, narration}]. "
        "Keep facts. Do not invent numbers. Keep roughly the same length."
    )
    user = json_dumps({"prompt": prompt, "script": script, "claims": research.get("claims", [])[:10]})
    try:
        from .util import parse_json_object

        data = parse_json_object(llm.complete(system, user, json_mode=True))
        by_id = {s["scene_id"]: s["narration"] for s in data.get("scenes", []) if "scene_id" in s and "narration" in s}
        for s in script["scenes"]:
            if s["scene_id"] in by_id:
                s["narration"] = by_id[s["scene_id"]]
                s["caption_text"] = s["narration"]
    except Exception:
        return script
    return critique_and_revise(script, script.get("platform") or "youtube")


def json_dumps(obj) -> str:
    import json

    return json.dumps(obj, default=str)[:12000]


def plan_from_script(script: dict, hardware_level: str = "LOW") -> dict:
    shots = []
    for scene in script["scenes"]:
        scene["visual_strategy"] = _visual_method(scene, hardware_level, scene["duration"])
        shots.append(
            {
                "shot_id": f"{scene['scene_id']}_A",
                "scene_id": scene["scene_id"],
                "duration": scene["duration"],
                "purpose": scene["purpose"],
                "narration": scene["narration"],
                "visual_strategy": scene["visual_strategy"],
                "visual_prompt": scene["visual_prompt"],
                "camera": scene["camera_direction"],
                "motion": scene["motion"],
                "characters": scene.get("characters") or [],
                "environment": scene.get("environment"),
                "style": scene.get("style"),
                "audio": {"music": scene.get("music"), "sfx": scene.get("sound_effects")},
                "transition": scene.get("transition"),
                "caption": scene.get("caption_text"),
                "continuity_dependencies": scene.get("continuity_requirements") or [],
            }
        )
    return {
        "title": script["title"],
        "scenes": script["scenes"],
        "shots": shots,
        "style_bible": {
            "palette": ["#0B1020", "#E8C07A", "#7EB8C9", "#F4F1EA"],
            "typography": "bold sans-serif",
            "visual_style": script["scenes"][0]["style"] if script["scenes"] else "motion-graphics",
        },
        "character_bible": [],
        "environment_bible": {"world": "illustrated topic space"},
    }
