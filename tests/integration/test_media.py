from __future__ import annotations

import os
from pathlib import Path

import pytest

from aivideostudio import audio, render, visuals
from aivideostudio.db import connect
from aivideostudio.research import research_topic


@pytest.fixture
def tmp_data(tmp_path, monkeypatch):
    monkeypatch.setenv("AIVS_DATA_DIR", str(tmp_path / "data"))
    # reset db singleton
    import aivideostudio.db as d

    d._conn = None
    connect()
    return tmp_path


def test_music_and_voice_and_mix(tmp_data, tmp_path):
    music = audio.synthesize_music(3.0, "clear", tmp_path / "m.wav")
    assert Path(music["path"]).stat().st_size > 1000
    voice = audio.speak("The sky looks blue because air scatters sunlight.", tmp_path / "v.wav")
    assert Path(voice["path"]).stat().st_size > 1000
    mixed = audio.mix_voice_music(Path(voice["path"]), Path(music["path"]), tmp_path / "mix.m4a")
    assert Path(mixed["path"]).exists()


def test_visual_and_ken_burns(tmp_path):
    scene = {
        "scene_id": "S00",
        "purpose": "title",
        "narration": "Why the sky appears blue.",
        "visual_goal": "Show a wide blue sky and sunlight.",
        "visual_prompt": "blue sky cinematic",
        "caption_text": "Why the sky appears blue.",
        "visual_strategy": "TEXT_GRAPHICS",
        "style": "cinematic",
        "duration": 2.0,
    }
    meta = visuals.generate_scene_visual(scene, (1280, 720), tmp_path)
    assert Path(meta["path"]).exists()
    clip = tmp_path / "clip.mp4"
    visuals.ken_burns(Path(meta["path"]), clip, 2.0, (1280, 720), fps=24)
    assert clip.exists()
    qc = render.technical_qc(clip)
    assert qc["width"] == 1280


def test_captions_files(tmp_path):
    cues = [{"start": 0, "end": 2.5, "text": "Hello world"}]
    srt = render.write_srt(cues, tmp_path / "c.srt")
    vtt = render.write_vtt(cues, tmp_path / "c.vtt")
    ass = render.write_ass(cues, tmp_path / "c.ass", (1280, 720), "youtube")
    assert "Hello" in srt.read_text()
    assert "WEBVTT" in vtt.read_text()
    assert "Dialogue" in ass.read_text()


def test_research_returns_structure():
    report = research_topic("why the sky appears blue", depth="light")
    assert report["topic"]
    assert report["claims"]
    assert "sources" in report
    assert "uncertainties" in report
