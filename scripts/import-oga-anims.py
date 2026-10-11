#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

SRC = Path("/tmp/oga-anims")
DEST = Path(__file__).resolve().parents[1] / "gallery" / "animations"


def write_anim(anim_id: str, name: dict[str, str], fps: int, size: int, frames: list[Image.Image]) -> None:
    folder = DEST / anim_id
    folder.mkdir(parents=True, exist_ok=True)
    for leftover in folder.glob("*.png"):
        leftover.unlink()
    (folder / "anim.json").write_text(
        json.dumps({"name": name, "fps": fps, "size": size}, indent=2) + "\n",
        encoding="utf-8",
    )
    for index, frame in enumerate(frames):
        rgba = frame.convert("RGBA")
        rgba.save(folder / f"{index:02d}.png")


def gif_frames(path: Path) -> list[Image.Image]:
    image = Image.open(path)
    frames: list[Image.Image] = []
    while True:
        frames.append(image.convert("RGBA").copy())
        try:
            image.seek(image.tell() + 1)
        except EOFError:
            break
    return frames


def slice_sheet(path: Path, frame_w: int, frame_h: int) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")
    frames = []
    for x in range(0, sheet.width, frame_w):
        frames.append(sheet.crop((x, 0, x + frame_w, frame_h)))
    return frames


def scale(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.NEAREST)


# AV Reference — 16×16 loading GIFs, CC0
for gif in sorted((SRC / "avr").glob("loading_*.gif")):
    number = gif.stem.split("_")[-1]
    write_anim(
        f"oga-load-{number}",
        {"tr": f"Yükleme {int(number)}", "en": f"Loading {int(number)}"},
        8,
        16,
        gif_frames(gif),
    )

# qubodup — 16×16 black loading bar, CC0
write_anim(
    "oga-bar",
    {"tr": "Yükleme çubuğu", "en": "Loading bar"},
    8,
    16,
    gif_frames(SRC / "qubodup/qubodup-loading1/qubodup-loading1-16-black.gif"),
)

# elfy_boo — 16×16 heart sheet, CC0
write_anim(
    "oga-heart",
    {"tr": "Kalp (OGA)", "en": "Heart (OGA)"},
    4,
    16,
    slice_sheet(SRC / "heart_animation_16x16_black.png", 16, 16),
)

# Zoedoz — hourglass sheet 42×42, CC0
write_anim(
    "oga-hourglass",
    {"tr": "Kum saati (OGA)", "en": "Hourglass (OGA)"},
    8,
    16,
    [scale(frame, 16) for frame in slice_sheet(SRC / "hourglass.png", 42, 42)],
)

# Alexie — battery GIF, CC0
write_anim(
    "oga-battery",
    {"tr": "Pil (OGA)", "en": "Battery (OGA)"},
    3,
    16,
    [scale(frame, 16) for frame in gif_frames(SRC / "battery.gif")],
)

print("Imported OpenGameArt CC0 animations into gallery/animations/oga-*")
