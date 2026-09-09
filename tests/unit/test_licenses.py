from __future__ import annotations

from aivideostudio.licenses import allowed_for_usage, get_component, load_registry


def test_registry_loads():
    reg = load_registry()
    assert "components" in reg
    names = {c["component_name"] for c in reg["components"]}
    assert "FFmpeg" in names
    assert "FLUX.1 dev" in names
    assert "Kokoro-82M" in names


def test_flux_dev_blocked_commercially():
    rec = get_component("flux-dev")
    ok, reason = allowed_for_usage(rec, "commercial")
    assert ok is False
    assert "NON_COMMERCIAL" in reason


def test_flux_dev_allowed_personal():
    rec = get_component("flux-dev")
    ok, _ = allowed_for_usage(rec, "personal")
    assert ok is True


def test_flux_schnell_commercial():
    rec = get_component("flux-schnell")
    ok, _ = allowed_for_usage(rec, "commercial")
    assert ok is True


def test_hunyuan_review_required():
    rec = get_component("hunyuanvideo")
    ok, _ = allowed_for_usage(rec, "commercial")
    assert ok is False


def test_override_allows_blocked_with_eyes_open():
    rec = get_component("flux-dev")
    ok, _ = allowed_for_usage(rec, "commercial", override=True)
    assert ok is True


def test_ace_step_is_apache_not_assumed_mit():
    rec = get_component("ace-step")
    assert "Apache-2.0" in rec["repository_license"]
