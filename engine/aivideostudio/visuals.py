from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from .logging_util import setup_logging
from .research import commons_images
from .providers import ComfyUIProvider

log = setup_logging()


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    words = (text or "").split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        trial = " ".join(cur + [w])
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines[:8]


def _gradient(size: tuple[int, int], c1: tuple[int, int, int], c2: tuple[int, int, int], vertical: bool = True) -> Image.Image:
    import numpy as np

    w, h = size
    if vertical:
        t = np.linspace(0, 1, h, dtype=np.float32).reshape(h, 1)
    else:
        t = np.linspace(0, 1, w, dtype=np.float32).reshape(1, w)
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = (c1[i] + (c2[i] - c1[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, mode="RGB")


def _seed(s: str) -> int:
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)


def _palette(style: str, text: str) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    t = (style + " " + text).lower()
    if any(k in t for k in ("sky", "blue", "atmosphere", "air")):
        return (8, 24, 72), (64, 148, 220), (232, 192, 122)
    if any(k in t for k in ("night", "space", "cinematic")):
        return (6, 8, 18), (28, 36, 72), (232, 192, 122)
    if any(k in t for k in ("cartoon", "funny", "playful")):
        return (28, 18, 48), (236, 92, 88), (255, 214, 102)
    if any(k in t for k in ("history", "documentary", "jamaica", "sugar")):
        return (28, 16, 8), (140, 72, 28), (232, 196, 120)
    if any(k in t for k in ("business", "ai", "tech")):
        return (8, 14, 24), (20, 90, 110), (120, 220, 200)
    return (10, 12, 22), (42, 58, 92), (232, 192, 122)


def _draw_sky(draw: ImageDraw.ImageDraw, size, rng: random.Random) -> None:
    w, h = size
    # sun
    cx, cy = int(w * 0.78), int(h * 0.22)
    for i, alpha in enumerate([90, 50, 24]):
        r = int(min(w, h) * (0.08 + i * 0.06))
        color = (255, 210, 120)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=3)
    draw.ellipse((cx - 40, cy - 40, cx + 40, cy + 40), fill=(255, 228, 160))
    # scattering particles
    for _ in range(90):
        x = rng.randint(0, w)
        y = rng.randint(int(h * 0.05), int(h * 0.7))
        r = rng.randint(1, 3)
        draw.ellipse((x, y, x + r, y + r), fill=(180, 210, 255))


def _draw_diagram(draw: ImageDraw.ImageDraw, size, title: str, font) -> None:
    w, h = size
    box = (int(w * 0.12), int(h * 0.38), int(w * 0.88), int(h * 0.82))
    draw.rounded_rectangle(box, radius=28, outline=(232, 192, 122), width=3)
    # three wavelength bars
    labels = ["Short / blue", "Medium", "Long / red"]
    colors = [(90, 160, 255), (120, 210, 160), (230, 90, 80)]
    for i, (lab, col) in enumerate(zip(labels, colors)):
        x = int(w * (0.2 + i * 0.22))
        y1 = int(h * 0.72)
        y0 = y1 - int(h * (0.12 + (2 - i) * 0.08))
        draw.rounded_rectangle((x, y0, x + int(w * 0.12), y1), radius=10, fill=col)
        draw.text((x, y1 + 12), lab, font=font, fill=(244, 241, 234))


def _draw_map(draw: ImageDraw.ImageDraw, size, rng: random.Random) -> None:
    w, h = size
    cx, cy = w // 2, int(h * 0.55)
    draw.ellipse((cx - 180, cy - 120, cx + 220, cy + 140), outline=(126, 184, 201), width=4)
    for _ in range(7):
        x0 = cx + rng.randint(-140, 140)
        y0 = cy + rng.randint(-80, 80)
        x1 = x0 + rng.randint(-80, 80)
        y1 = y0 + rng.randint(-40, 40)
        draw.line((x0, y0, x1, y1), fill=(232, 192, 122), width=3)


def _vignette(img: Image.Image) -> Image.Image:
    w, h = img.size
    overlay = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(overlay)
    d.ellipse((-w * 0.1, -h * 0.1, w * 1.1, h * 1.1), fill=255)
    overlay = overlay.filter(ImageFilter.GaussianBlur(80))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    img = Image.composite(img, dark, overlay)
    return img


def _grain(img: Image.Image, rng: random.Random, amount: int = 12) -> Image.Image:
    # Lightweight grain: overlay noise on a downscaled layer
    w, h = img.size
    noise = Image.new("RGB", (max(8, w // 4), max(8, h // 4)))
    px = noise.load()
    nw, nh = noise.size
    for y in range(nh):
        for x in range(nw):
            v = rng.randint(128 - amount, 128 + amount)
            px[x, y] = (v, v, v)
    noise = noise.resize((w, h), Image.BILINEAR)
    return Image.blend(img, noise, 0.08)


def render_motion_frame(
    scene: dict,
    size: tuple[int, int],
    out_path: Path,
    index: int = 0,
) -> dict:
    rng = random.Random(_seed(scene.get("scene_id", "S") + scene.get("narration", "") + str(index)))
    c1, c2, accent = _palette(scene.get("style") or "", scene.get("narration") + scene.get("visual_goal", ""))
    img = _gradient(size, c1, c2, vertical=True)
    draw = ImageDraw.Draw(img)
    w, h = size
    strategy = scene.get("visual_strategy") or "AI_IMAGE_PLUS_MOTION"
    text = scene.get("caption_text") or scene.get("narration") or ""
    title_size = max(28, w // 22)
    body_size = max(20, w // 36)
    title_font = _font(title_size, bold=True)
    body_font = _font(body_size, bold=False)
    small = _font(max(14, w // 48))

    # decorative orbs
    for _ in range(6):
        ox = rng.randint(-80, w + 80)
        oy = rng.randint(-80, h + 80)
        r = rng.randint(80, 260)
        draw.ellipse((ox, oy, ox + r, oy + r), outline=accent + (0,), width=2)
        draw.ellipse((ox, oy, ox + r, oy + r), outline=accent)

    t = (scene.get("visual_goal") + " " + text).lower()
    if strategy == "MAP" or "map" in t:
        _draw_map(draw, size, rng)
    elif strategy == "DIAGRAM" or any(k in t for k in ("wavelength", "scatter", "diagram", "why")):
        _draw_diagram(draw, size, text, small)
    elif any(k in t for k in ("sky", "sun", "atmosphere", "blue")):
        _draw_sky(draw, size, rng)
    else:
        # abstract ribbons
        for i in range(4):
            y = int(h * (0.35 + i * 0.08))
            draw.arc((int(w * 0.08), y, int(w * 0.92), y + 180), 0, 180, fill=accent, width=4)

    if scene.get("purpose") == "title":
        lines = _wrap(draw, text.rstrip("."), title_font, int(w * 0.82))
        y = int(h * 0.38)
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            tw = bbox[2] - bbox[0]
            draw.text(((w - tw) / 2, y), line, font=title_font, fill=(244, 241, 234))
            y += title_size + 14
    else:
        kicker = scene.get("scene_id", "")
        draw.text((int(w * 0.08), int(h * 0.08)), kicker, font=small, fill=accent)
        lines = _wrap(draw, text, body_font, int(w * 0.84))
        y = int(h * 0.14)
        for line in lines[:5]:
            draw.text((int(w * 0.08), y), line, font=body_font, fill=(244, 241, 234))
            y += body_size + 10

    img = _vignette(img)
    img = _grain(img, rng)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    return {
        "path": str(out_path),
        "width": w,
        "height": h,
        "provider": "studio_motion_graphics",
        "model": "studio-illustrator-1",
        "seed": _seed(scene.get("scene_id", "S")),
        "prompt": scene.get("visual_prompt"),
        "license": {"status": "APPROVED", "component": "studio_motion_graphics"},
    }


def try_wikimedia_still(query: str, dest: Path) -> dict | None:
    items = commons_images(query, limit=3)
    for item in items:
        lic = (item.get("license") or "").lower()
        if any(bad in lic for bad in ("unknown", "copyright", "all rights")):
            continue
        url = item.get("url")
        if not url:
            continue
        try:
            import httpx
            from .providers import USER_AGENT

            r = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=20, follow_redirects=True)
            if r.status_code == 200 and len(r.content) > 4000:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(r.content)
                return {
                    "path": str(dest),
                    "provider": "wikimedia_commons",
                    "license": {
                        "status": "APPROVED_WITH_ATTRIBUTION",
                        "component": "wikipedia_ddg",
                        "license": item.get("license"),
                        "artist": item.get("artist"),
                        "url": item.get("page_url"),
                        "attribution_required": True,
                    },
                    "prompt": query,
                    "source_url": item.get("page_url"),
                }
        except Exception as exc:
            log.info("Commons download failed: %s", exc)
    return None


def generate_scene_visual(scene: dict, size: tuple[int, int], dest_dir: Path, usage_mode: str = "personal") -> dict:
    dest_dir.mkdir(parents=True, exist_ok=True)
    png = dest_dir / f"{scene['scene_id']}.png"
    # Optional ComfyUI
    comfy = ComfyUIProvider()
    if comfy.available() and scene.get("visual_strategy") in {"AI_VIDEO", "AI_IMAGE_PLUS_MOTION", "GENERATED_ILLUSTRATION"}:
        raw = comfy.generate_image(scene.get("visual_prompt") or "", size[0], size[1], _seed(scene["scene_id"]))
        if raw:
            png.write_bytes(raw)
            return {
                "path": str(png),
                "provider": "comfyui",
                "model": "comfyui-configured",
                "license": {"status": "APPROVED_WITH_ATTRIBUTION", "component": "comfyui"},
                "prompt": scene.get("visual_prompt"),
                "seed": _seed(scene["scene_id"]),
            }
    # Wikimedia stills for documentary realism when license allows
    if scene.get("visual_strategy") in {"OTHER_SAFE_MEDIA", "SCREENSHOT"} or scene.get("style") == "cinematic":
        q = (scene.get("visual_goal") or scene.get("narration") or "")[:80]
        still = try_wikimedia_still(q, dest_dir / f"{scene['scene_id']}_wiki.jpg")
        if still:
            # Composite caption overlay onto the still
            try:
                base = Image.open(still["path"]).convert("RGB")
                base = base.resize(size, Image.LANCZOS)
                overlay = Image.new("RGBA", size, (0, 0, 0, 0))
                d = ImageDraw.Draw(overlay)
                d.rectangle((0, int(size[1] * 0.72), size[0], size[1]), fill=(0, 0, 0, 150))
                font = _font(max(22, size[0] // 32), bold=True)
                lines = _wrap(d, scene.get("caption_text") or "", font, int(size[0] * 0.86))
                y = int(size[1] * 0.76)
                for line in lines[:3]:
                    d.text((int(size[0] * 0.07), y), line, font=font, fill=(255, 255, 255, 255))
                    y += int(size[1] * 0.05)
                base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
                base.save(png)
                still["path"] = str(png)
                still["composited"] = True
                return still
            except Exception:
                pass
    return render_motion_frame(scene, size, png)


def ken_burns(image_path: Path, video_path: Path, duration: float, size: tuple[int, int], fps: int = 30) -> Path:
    import subprocess

    frames = max(int(duration * fps), fps)
    w, h = size
    # zoompan needs even dimensions
    filt = (
        f"scale={w * 2}:{h * 2},zoompan=z='min(zoom+0.0012,1.18)':"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={fps},"
        f"format=yuv420p"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-i",
        str(image_path),
        "-vf",
        filt,
        "-t",
        f"{duration:.3f}",
        "-r",
        str(fps),
        "-an",
        "-pix_fmt",
        "yuv420p",
        str(video_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return video_path
