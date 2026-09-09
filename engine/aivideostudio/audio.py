from __future__ import annotations

import math
import struct
import subprocess
import wave
from pathlib import Path

import numpy as np

from .logging_util import setup_logging

log = setup_logging()
SAMPLE_RATE = 44100


def _write_wav(path: Path, samples: np.ndarray, rate: int = SAMPLE_RATE) -> Path:
    samples = np.clip(samples, -1.0, 1.0)
    pcm = (samples * 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm.tobytes())
    return path


def synthesize_music(duration: float, mood: str, dest: Path, bpm: int | None = None) -> dict:
    rng = np.random.default_rng(abs(hash(mood)) % (2**32))
    n = int(duration * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    moods = {
        "serious": (110, [50, 57, 62, 69], 0.18),
        "documentary": (96, [48, 55, 60, 67], 0.16),
        "friendly": (118, [60, 64, 67, 72], 0.2),
        "energetic": (132, [62, 65, 69, 74], 0.22),
        "cinematic": (84, [46, 53, 58, 65], 0.17),
        "playful": (128, [67, 71, 74, 79], 0.2),
        "punchy": (140, [64, 67, 71, 76], 0.21),
        "clear": (112, [57, 60, 64, 69], 0.18),
        "neutral": (100, [52, 59, 64, 71], 0.16),
        "dramatic": (90, [45, 52, 55, 62], 0.18),
    }
    bpm, notes, amp = moods.get(mood, moods["clear"])
    if bpm is None:
        bpm = 110
    beat = 60.0 / bpm
    # pad
    pad = np.zeros(n)
    for midi in notes:
        f = 440.0 * (2 ** ((midi - 69) / 12))
        pad += 0.22 * np.sin(2 * math.pi * f * t) * np.exp(-0.015 * t)
        pad += 0.08 * np.sin(2 * math.pi * (f * 0.5) * t)
    # gentle pulse
    pulse = 0.5 + 0.5 * np.sin(2 * math.pi * (1 / (beat * 4)) * t)
    # melody
    melody = np.zeros(n)
    step = int(beat * SAMPLE_RATE)
    seq = notes + notes[::-1]
    for i, midi in enumerate(seq * 20):
        start = i * step
        if start >= n:
            break
        length = min(step, n - start)
        tt = np.arange(length) / SAMPLE_RATE
        f = 440.0 * (2 ** ((midi + 12 - 69) / 12))
        env = np.sin(np.pi * np.clip(tt / (length / SAMPLE_RATE), 0, 1)) ** 2
        melody[start : start + length] += 0.12 * np.sin(2 * math.pi * f * tt) * env
    noise = rng.normal(0, 0.01, n)
    audio = (pad * pulse * amp + melody + noise)
    # fade
    fade = int(0.8 * SAMPLE_RATE)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(audio)) or 1
    audio = audio / peak * 0.55
    _write_wav(dest, audio)
    return {
        "path": str(dest),
        "provider": "studio_composer",
        "model": "procedural-composer-1",
        "bpm": bpm,
        "mood": mood,
        "duration": duration,
        "license": {"status": "APPROVED", "component": "studio_composer", "commercial_use": "yes"},
        "cost": 0,
    }


def synthesize_sfx(kind: str, dest: Path, duration: float = 0.45) -> dict:
    n = int(duration * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    if kind == "whoosh":
        noise = np.random.default_rng(3).normal(0, 1, n)
        env = np.sin(np.pi * t / duration) ** 2
        audio = noise * env * 0.18
        # simple highpass-ish by differentiating
        audio = np.concatenate([[0], np.diff(audio)])
    elif kind == "click":
        audio = np.sin(2 * math.pi * 1200 * t) * np.exp(-t * 28) * 0.3
    else:
        audio = np.sin(2 * math.pi * 220 * t) * np.exp(-t * 4) * 0.2
    _write_wav(dest, audio)
    return {
        "path": str(dest),
        "provider": "studio_composer",
        "kind": kind,
        "license": {"status": "APPROVED", "component": "studio_composer"},
        "cost": 0,
    }


def _espeak_voices() -> list[str]:
    try:
        out = subprocess.check_output(["espeak-ng", "--voices"], text=True, stderr=subprocess.DEVNULL)
        voices = []
        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 2:
                voices.append(parts[1])
        return voices
    except Exception:
        return ["en"]


def pick_voice(gender: str | None, style: str | None) -> str:
    voices = _espeak_voices()
    prefer = "en-us"
    if gender == "female":
        for v in ("en-us+f3", "en+f3", "en-gb+f2"):
            if any(v.split("+")[0] in x for x in voices):
                return v
        return "en-us+f3"
    if gender == "male":
        return "en-us+m3"
    return prefer


def tts_espeak(text: str, dest: Path, speed: int = 155, gender: str | None = None, pitch: int = 42) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    voice = pick_voice(gender, None)
    cmd = [
        "espeak-ng",
        "-v",
        voice,
        "-s",
        str(int(speed)),
        "-p",
        str(int(pitch)),
        "-w",
        str(dest),
        text,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return {
        "path": str(dest),
        "provider": "espeak-ng",
        "model": voice,
        "license": {"status": "APPROVED_WITH_ATTRIBUTION", "component": "espeak-ng"},
        "cost": 0,
        "text": text,
    }


def tts_piper(text: str, dest: Path, speed: float = 1.0) -> dict | None:
    import shutil

    piper = shutil.which("piper")
    if not piper:
        return None
    # If a voice model is configured later, this path becomes active.
    return None


def speak(text: str, dest: Path, settings: dict | None = None) -> dict:
    settings = settings or {}
    speed = int(settings.get("speaking_speed") or 155)
    gender = settings.get("voice_gender")
    tone = settings.get("tone") or ""
    pitch = 48 if "energetic" in str(tone) else 40
    piper = tts_piper(text, dest, speed=speed / 155)
    if piper:
        return piper
    return tts_espeak(text, dest, speed=speed, gender=gender, pitch=pitch)


def concat_wavs(paths: list[Path], dest: Path, pauses: list[float] | None = None) -> Path:
    pauses = pauses or [0.18] * len(paths)
    chunks = []
    for path, pause in zip(paths, pauses):
        with wave.open(str(path), "rb") as wf:
            rate = wf.getframerate()
            nchan = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            frames = wf.readframes(wf.getnframes())
        samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32767
        if nchan == 2:
            samples = samples.reshape(-1, 2).mean(axis=1)
        chunks.append(samples)
        chunks.append(np.zeros(int(pause * rate), dtype=np.float32))
    audio = np.concatenate(chunks) if chunks else np.zeros(SAMPLE_RATE, dtype=np.float32)
    return _write_wav(dest, audio, SAMPLE_RATE)


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


def mix_voice_music(
    voice: Path,
    music: Path,
    dest: Path,
    sfx: list[Path] | None = None,
) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Duck music under voice with sidechain-like volume using ffmpeg
    filter_complex = (
        "[1:a]volume=0.16,alimiter=limit=0.8[m];"
        "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,loudnorm=I=-16:LRA=11:TP=-1.5[v];"
        "[v][m]sidechaincompress=threshold=0.05:ratio=8:attack=40:release=280:level_sc=0.9[mix]"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(voice),
        "-i",
        str(music),
        "-filter_complex",
        filter_complex,
        "-map",
        "[mix]",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(dest.with_suffix(".m4a")),
    ]
    # sidechaincompress may be missing; fall back to amix
    proc = subprocess.run(cmd, capture_output=True, text=True)
    out = dest.with_suffix(".m4a")
    if proc.returncode != 0 or not out.exists():
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(voice),
            "-i",
            str(music),
            "-filter_complex",
            "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:TP=-1.5[a]",
            "-map",
            "[a]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(out),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
    return {"path": str(out), "provider": "ffmpeg", "license": {"status": "APPROVED_WITH_ATTRIBUTION", "component": "ffmpeg"}}
