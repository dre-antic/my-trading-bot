from aivideostudio.compute import inspect_hardware
from aivideostudio.review import apply_user_change, executive_producer


def test_hardware_classifies():
    p = inspect_hardware()
    assert p.class_level in {"LOW", "MEDIUM", "HIGH"}
    assert p.recommended_mode in {"LOCAL", "REMOTE", "CLOUD", "HYBRID"}
    assert p.ram_gb > 0


def test_change_voice_does_not_mark_visuals():
    script = {"scenes": [{"narration": "Hello.", "caption_text": "Hello.", "duration": 4}]}
    result = apply_user_change("Make the narrator sound more energetic.", script)
    assert "voice" in result["affected"]
    assert "visuals" not in result["affected"]


def test_executive_producer_approve():
    v = executive_producer([{"severity": "MINOR", "problem": "nits"}])
    assert v["decision"] == "APPROVE"


def test_executive_producer_regenerate():
    v = executive_producer([{"severity": "CRITICAL", "problem": "missing file"}])
    assert v["decision"] == "REGENERATE"
