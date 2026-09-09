from aivideostudio.script import build_script, critique_and_revise, plan_from_script
from aivideostudio.util import target_seconds


def test_duration_from_prompt():
    assert target_seconds("youtube", "ai_decides", None, "Create a 60-second educational video") == 60


def test_script_has_required_fields():
    research = {
        "topic": "why the sky appears blue",
        "claims": [
            {
                "text": "The sky looks blue because air molecules scatter short-wavelength light more strongly, a process called Rayleigh scattering.",
                "source": "Wikipedia",
                "source_url": "https://en.wikipedia.org/wiki/Diffuse_sky_radiation",
                "confidence": 0.9,
            },
            {
                "text": "At sunrise and sunset, sunlight travels through more atmosphere, so more blue light is scattered away and reds remain.",
                "source": "Wikipedia",
                "source_url": "https://en.wikipedia.org/wiki/Rayleigh_scattering",
                "confidence": 0.88,
            },
        ],
        "attribution": "Includes material from Wikipedia, licensed under CC BY-SA 4.0.",
    }
    script = build_script("Create a 60-second educational video explaining why the sky appears blue.", "youtube", "ai_decides", None, research)
    assert script["scenes"]
    for scene in script["scenes"]:
        for key in ("scene_id", "duration", "narration", "visual_goal", "visual_prompt", "camera_direction", "caption_text"):
            assert key in scene
    plan = plan_from_script(script, "LOW")
    assert plan["shots"]
    assert all(s["visual_strategy"] for s in plan["scenes"])


def test_critic_runs():
    script = {
        "title": "Test",
        "platform": "youtube_shorts",
        "scenes": [
            {"scene_id": "S00", "purpose": "title", "narration": "x " * 40, "duration": 8, "caption_text": ""},
            {"scene_id": "S01", "purpose": "body", "narration": "Hello there friends this is a unique line.", "duration": 8, "caption_text": ""},
        ],
        "estimated_seconds": 16,
    }
    out = critique_and_revise(script, "youtube_shorts")
    assert out["critic"]["revised"] is True
