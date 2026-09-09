from __future__ import annotations

import json
import re
from typing import Any

PLATFORM_ASPECT = {
    "youtube": (1920, 1080),
    "youtube_shorts": (1080, 1920),
    "tiktok": (1080, 1920),
    "both": (1080, 1920),
    "custom": (1920, 1080),
}

DURATION_SECONDS = {
    "ai_decides": None,
    "short": 45,
    "1-3": 150,
    "5-10": 420,
    "10-20": 900,
    "custom": None,
}

WPM = 145


def parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError("No JSON object in model output")


def target_seconds(platform: str, duration: str, custom_seconds: int | None, prompt: str) -> int:
    if duration == "custom" and custom_seconds:
        return max(15, int(custom_seconds))
    mapped = DURATION_SECONDS.get(duration)
    if mapped:
        return mapped
    prompt_l = prompt.lower()
    m = re.search(r"(\d+)\s*-?\s*(?:seconds?|secs?)\b", prompt_l)
    if m:
        return max(15, int(m.group(1)))
    m = re.search(r"(\d+)\s*-?\s*(?:minutes?|mins?)\b", prompt_l)
    if m:
        return max(20, int(m.group(1)) * 60)
    if platform in {"youtube_shorts", "tiktok", "both"}:
        return 45
    return 90


def aspect_for(platform: str, settings: dict | None = None) -> tuple[int, int]:
    settings = settings or {}
    if settings.get("width") and settings.get("height"):
        return int(settings["width"]), int(settings["height"])
    ratio = settings.get("aspect_ratio")
    if ratio == "9:16":
        return 1080, 1920
    if ratio == "1:1":
        return 1080, 1080
    if ratio == "16:9":
        return 1920, 1080
    return PLATFORM_ASPECT.get(platform, (1920, 1080))


def detect_genre(prompt: str, template_genre: str | None = None) -> str:
    if template_genre:
        return template_genre
    p = prompt.lower()
    rules = [
        ("documentary", ["documentary", "history of", "the story of"]),
        ("list", ["ways", "tips", "list", "10 ", "top "]),
        ("cartoon", ["cartoon", "animated kids"]),
        ("cinematic", ["cinematic", "film look"]),
        ("news", ["news", "breaking", "report"]),
        ("storytelling", ["story about", "fictional", "once upon"]),
        ("entertainment", ["funny", "comedy", "joke"]),
        ("educational", ["explain", "why", "how", "teach", "educational"]),
    ]
    for genre, keys in rules:
        if any(k in p for k in keys):
            return genre
    return "explainer"


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text or ""))


def estimate_speech_seconds(text: str, wpm: int = WPM) -> float:
    return max(1.0, word_count(text) * 60.0 / wpm)
