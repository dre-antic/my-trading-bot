from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from .logging_util import setup_logging

log = setup_logging()


def probe(path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out)


def write_srt(cues: list[dict], dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for i, cue in enumerate(cues, start=1):
        lines.append(str(i))
        lines.append(f"{_ts(cue['start'])} --> {_ts(cue['end'])}")
        lines.append(cue["text"].strip())
        lines.append("")
    dest.write_text("\n".join(lines), encoding="utf-8")
    return dest


def write_vtt(cues: list[dict], dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    chunks = ["WEBVTT", ""]
    for cue in cues:
        chunks.append(f"{_ts(cue['start']).replace(',', '.')} --> {_ts(cue['end']).replace(',', '.')}")
        chunks.append(cue["text"].strip())
        chunks.append("")
    dest.write_text("\n".join(chunks), encoding="utf-8")
    return dest


def write_ass(cues: list[dict], dest: Path, size: tuple[int, int], style: str = "clean") -> Path:
    w, h = size
    fontsize = 42 if w >= 1920 else 36
    if style in {"tiktok", "shorts", "dynamic"}:
        fontsize = 56
        alignment = 2
        margin_v = 80
        bold = -1
    else:
        alignment = 2
        margin_v = 48
        bold = 0
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{fontsize},&H00FFFFFFF,&H000000FF,&H00000000,&H80000000,{bold},0,1,3,0,{alignment},60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for cue in cues:
        text = cue["text"].replace("\n", r"\N")
        if style in {"tiktok", "shorts", "dynamic", "word highlighting"}:
            text = r"{\c&H7AC0E8&\t(0,120,\c&HFFFFFF&)}" + text
        events.append(f"Dialogue: 0,{_ass(cue['start'])},{_ass(cue['end'])},Default,,0,0,0,,{text}")
    dest.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return dest


def _ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _ass(seconds: float) -> str:
    cs = int(round(seconds * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def concat_videos(clips: list[Path], dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    listing = dest.parent / "concat.txt"
    listing.write_text("".join(f"file '{c.resolve()}'\n" for c in clips), encoding="utf-8")
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(listing),
        "-c",
        "copy",
        str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not dest.exists():
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(listing),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(dest),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
    return dest


def mux(video: Path, audio: Path, dest: Path, captions_ass: Path | None, size: tuple[int, int]) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    picture = video
    if captions_ass and captions_ass.exists():
        burned = dest.parent / "video_captioned.mp4"
        cap = str(captions_ass.resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
        fonts = _font_dir()
        vf = f"subtitles='{cap}'"
        if fonts:
            vf = f"subtitles='{cap}':fontsdir='{fonts}'"
        burn = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(video),
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-an",
                str(burned),
            ],
            capture_output=True,
            text=True,
        )
        if burn.returncode == 0 and burned.exists() and burned.stat().st_size > 1000:
            picture = burned
        else:
            log.info("caption burn-in skipped (%s)", (burn.stderr or "")[-300:])
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(picture),
        "-i",
        str(audio),
        "-filter_complex",
        "[1:a]aresample=44100,apad[a]",
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return dest


def _font_dir() -> str:
    for path in (
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/truetype/liberation",
        "/System/Library/Fonts/Supplemental",
        "/System/Library/Fonts",
    ):
        if Path(path).exists():
            return path.replace(":", r"\:")
    return ""


def extract_frame(video: Path, dest: Path, timestamp: float = 1.0) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-ss", f"{timestamp:.2f}", "-i", str(video), "-frames:v", "1", str(dest)],
        check=True,
        capture_output=True,
    )
    return dest


def technical_qc(video: Path, expected_duration: float | None = None) -> dict:
    findings = []
    if not video.exists():
        return {
            "ok": False,
            "findings": [{"severity": "CRITICAL", "problem": "Final file does not exist", "evidence": str(video)}],
        }
    try:
        info = probe(video)
    except Exception as exc:
        return {
            "ok": False,
            "findings": [{"severity": "CRITICAL", "problem": "File is not playable", "evidence": str(exc)}],
        }
    streams = info.get("streams") or []
    fmt = info.get("format") or {}
    vstreams = [s for s in streams if s.get("codec_type") == "video"]
    astreams = [s for s in streams if s.get("codec_type") == "audio"]
    if not vstreams:
        findings.append({"severity": "CRITICAL", "problem": "No video stream", "evidence": "ffprobe"})
    if not astreams:
        findings.append({"severity": "CRITICAL", "problem": "No audio stream", "evidence": "ffprobe"})
    duration = float(fmt.get("duration") or vstreams[0].get("duration") or 0) if (fmt or vstreams) else 0
    if expected_duration and duration < max(5, expected_duration * 0.5):
        findings.append(
            {
                "severity": "IMPORTANT",
                "problem": "Duration is much shorter than planned",
                "evidence": f"{duration:.2f}s vs {expected_duration:.2f}s",
            }
        )
    if vstreams:
        vs = vstreams[0]
        w = int(vs.get("width") or 0)
        h = int(vs.get("height") or 0)
        if w < 640 or h < 360:
            findings.append({"severity": "IMPORTANT", "problem": "Resolution is below 640x360", "evidence": f"{w}x{h}"})
        codec = vs.get("codec_name")
        if codec not in {"h264", "hevc", "vp9", "av1"}:
            findings.append({"severity": "MINOR", "problem": f"Unexpected video codec {codec}", "evidence": codec})
    # blackdetect / silencedetect sampled
    try:
        black = subprocess.run(
            ["ffmpeg", "-i", str(video), "-vf", "blackdetect=d=0.5:pix_th=0.1", "-f", "null", "-"],
            capture_output=True,
            text=True,
            timeout=40,
        )
        if "black_start" in (black.stderr or "") and "black_end" in (black.stderr or ""):
            findings.append({"severity": "MINOR", "problem": "Possible black frames detected", "evidence": "blackdetect"})
    except Exception:
        pass
    try:
        silence = subprocess.run(
            ["ffmpeg", "-i", str(video), "-af", "silencedetect=noise=-40dB:d=3", "-f", "null", "-"],
            capture_output=True,
            text=True,
            timeout=40,
        )
        if "silence_start" in (silence.stderr or ""):
            findings.append({"severity": "MINOR", "problem": "Possible silent section longer than 3 seconds", "evidence": "silencedetect"})
    except Exception:
        pass
    critical = [f for f in findings if f["severity"] == "CRITICAL"]
    return {
        "ok": not critical,
        "duration": duration,
        "size_bytes": video.stat().st_size,
        "findings": findings,
        "format": fmt.get("format_name"),
        "video_codec": vstreams[0].get("codec_name") if vstreams else None,
        "audio_codec": astreams[0].get("codec_name") if astreams else None,
        "width": int(vstreams[0].get("width") or 0) if vstreams else 0,
        "height": int(vstreams[0].get("height") or 0) if vstreams else 0,
    }
