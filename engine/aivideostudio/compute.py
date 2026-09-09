from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class HardwareProfile:
    os_name: str
    os_version: str
    arch: str
    apple_silicon: bool
    cpu_count: int
    ram_gb: float
    disk_free_gb: float
    gpu_name: str
    gpu_memory_gb: float | None
    python_ok: bool
    ffmpeg_ok: bool
    docker_ok: bool
    ollama_ok: bool
    comfyui_ok: bool
    class_level: str  # LOW MEDIUM HIGH
    recommended_mode: str  # LOCAL REMOTE CLOUD HYBRID
    notes: list[str]


def _ram_gb() -> float:
    try:
        if sys.platform == "darwin":
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True).strip()
            return int(out) / (1024**3)
        if sys.platform == "linux":
            text = Path("/proc/meminfo").read_text(encoding="utf-8")
            for line in text.splitlines():
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return kb / (1024**2)
    except Exception:
        pass
    return 8.0


def _disk_free_gb() -> float:
    usage = shutil.disk_usage(str(Path.home()))
    return usage.free / (1024**3)


def _has_cmd(name: str) -> bool:
    return shutil.which(name) is not None


def _ollama_ok() -> bool:
    try:
        import httpx

        r = httpx.get("http://127.0.0.1:11434/api/tags", timeout=0.6)
        return r.status_code == 200
    except Exception:
        return False


def _comfy_ok(url: str | None = None) -> bool:
    url = url or os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
    try:
        import httpx

        r = httpx.get(f"{url.rstrip('/')}/system_stats", timeout=0.6)
        return r.status_code == 200
    except Exception:
        return False


def _gpu() -> tuple[str, float | None]:
    if sys.platform == "darwin":
        try:
            out = subprocess.check_output(["system_profiler", "SPDisplaysDataType"], text=True, timeout=8)
            name = "Apple GPU"
            for line in out.splitlines():
                if "Chipset Model" in line:
                    name = line.split(":", 1)[1].strip()
            return name, None
        except Exception:
            return "Apple GPU" if platform.machine() == "arm64" else "Unknown", None
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            text=True,
            timeout=5,
        )
        line = out.strip().splitlines()[0]
        parts = [p.strip() for p in line.split(",")]
        mem = float(parts[1]) / 1024 if len(parts) > 1 else None
        return parts[0], mem
    except Exception:
        return "Integrated / none detected", None


def inspect_hardware() -> HardwareProfile:
    ram = _ram_gb()
    disk = _disk_free_gb()
    gpu_name, gpu_mem = _gpu()
    apple = sys.platform == "darwin" and platform.machine() == "arm64"
    cpu = os.cpu_count() or 4
    notes: list[str] = []

    if ram < 8 or disk < 10:
        level = "LOW"
    elif ram < 24 or (gpu_mem is not None and gpu_mem < 8):
        level = "MEDIUM"
    else:
        level = "HIGH"
        if gpu_mem is None and not apple:
            level = "MEDIUM"
            notes.append("No dedicated GPU memory reported, so heavy video models should run remotely.")

    if level == "LOW":
        mode = "HYBRID"
        notes.append("This computer is best as a control center. Heavy video generation should use a remote GPU.")
    elif level == "MEDIUM":
        mode = "HYBRID"
        notes.append("Light work (voice, captions, editing) can run locally. AI video clips should use remote compute.")
    else:
        mode = "LOCAL"
        notes.append("This machine can attempt local generation, with remote fallback if a job fails.")

    if not _has_cmd("ffmpeg"):
        notes.append("FFmpeg is missing. The setup wizard can install it.")

    return HardwareProfile(
        os_name=platform.system(),
        os_version=platform.version(),
        arch=platform.machine(),
        apple_silicon=apple,
        cpu_count=cpu,
        ram_gb=round(ram, 1),
        disk_free_gb=round(disk, 1),
        gpu_name=gpu_name,
        gpu_memory_gb=gpu_mem,
        python_ok=True,
        ffmpeg_ok=_has_cmd("ffmpeg"),
        docker_ok=_has_cmd("docker"),
        ollama_ok=_ollama_ok(),
        comfyui_ok=_comfy_ok(),
        class_level=level,
        recommended_mode=mode,
        notes=notes,
    )


def as_public_dict() -> dict:
    profile = inspect_hardware()
    data = asdict(profile)
    data["plain_english"] = _plain_english(profile)
    return data


def _plain_english(p: HardwareProfile) -> str:
    bits = [
        f"This {p.os_name} computer has {p.ram_gb:.0f} GB of memory and {p.cpu_count} CPU cores.",
        f"Graphics: {p.gpu_name}.",
        f"About {p.disk_free_gb:.0f} GB of disk space is free.",
    ]
    if p.class_level == "LOW":
        bits.append("Video generation is using remote GPU because this Mac does not have enough graphics memory." if p.apple_silicon or p.os_name == "Darwin" else "Heavy visual generation should run on a remote GPU.")
    elif p.class_level == "MEDIUM":
        bits.append("Voice, captions, and editing can run here. Full AI video clips should use a remote machine if available.")
    else:
        bits.append("This computer looks capable of local generation, with cloud used only if you turn it on.")
    bits.extend(p.notes)
    return " ".join(bits)
