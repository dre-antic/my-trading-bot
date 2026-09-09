from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter


def _font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                pass
    return ImageFont.load_default()


def _wrap(draw, text, font, width):
    words = text.split()
    lines, cur = [], []
    for w in words:
        trial = " ".join(cur + [w])
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= width:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines[:4]


def make_thumbnail_concepts(title: str, still: Path | None, dest_dir: Path, size: tuple[int, int] = (1280, 720)) -> list[dict]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    concepts = []
    palettes = [
        ((12, 18, 36), (232, 192, 122), "A"),
        ((20, 8, 8), (244, 244, 244), "B"),
        ((6, 28, 36), (120, 220, 200), "C"),
    ]
    for bg, accent, name in palettes:
        img = Image.new("RGB", size, bg)
        if still and Path(still).exists():
            try:
                photo = Image.open(still).convert("RGB").resize(size, Image.LANCZOS)
                photo = ImageEnhance.Contrast(photo).enhance(1.2)
                img = Image.blend(photo, Image.new("RGB", size, bg), 0.35)
            except Exception:
                pass
        draw = ImageDraw.Draw(img)
        # block
        draw.rectangle((0, int(size[1] * 0.55), size[0], size[1]), fill=(0, 0, 0))
        font = _font(max(36, size[0] // 18))
        lines = _wrap(draw, title, font, int(size[0] * 0.86))
        y = int(size[1] * 0.62)
        for line in lines:
            draw.text((int(size[0] * 0.07), y), line.upper(), font=font, fill=accent)
            y += int(size[1] * 0.1)
        draw.rectangle((0, 0, 18, size[1]), fill=accent)
        path = dest_dir / f"thumb_{name}.png"
        img.filter(ImageFilter.UnsharpMask(radius=1, percent=80)).save(path)
        score = _score_thumbnail(title, img, name)
        concepts.append({"id": name, "path": str(path), "score": score, "idea": _idea(name)})
    concepts.sort(key=lambda c: c["score"], reverse=True)
    return concepts


def _idea(name: str) -> str:
    return {
        "A": "cinematic scene + large title",
        "B": "high-contrast large text",
        "C": "curious color + topic word",
    }[name]


def _score_thumbnail(title: str, img: Image.Image, name: str) -> float:
    # Deterministic critic: contrast, title length, not empty
    stat = img.convert("L").resize((32, 18))
    pixels = list(stat.getdata())
    contrast = (max(pixels) - min(pixels)) / 255
    length = len(title.split())
    mobile = 1.0 if length <= 8 else 0.7
    curiosity = 0.9 if any(w in title.lower() for w in ("why", "how", "secret", "never", "strange")) else 0.75
    return round(0.4 * contrast + 0.3 * mobile + 0.3 * curiosity, 3)
