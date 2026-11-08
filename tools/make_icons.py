#!/usr/bin/env python3
"""Tegner app-ikonene (en figur i toppen av en pull-up) uten eksterne avhengigheter.

Kjør fra prosjektroten: python3 tools/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

BACKGROUND = (47, 107, 87)
FOREGROUND = (246, 244, 239)

# Figuren i enhetskoordinater (0–1): capsule = (x1, y1, x2, y2, radius), circle = (x, y, radius).
CAPSULES = [
    (0.17, 0.33, 0.83, 0.33, 0.026),  # stang
    (0.33, 0.33, 0.30, 0.46, 0.030),  # venstre underarm
    (0.67, 0.33, 0.70, 0.46, 0.030),  # høyre underarm
    (0.30, 0.46, 0.43, 0.46, 0.032),  # venstre overarm
    (0.70, 0.46, 0.57, 0.46, 0.032),  # høyre overarm
    (0.50, 0.46, 0.50, 0.64, 0.072),  # overkropp
    (0.47, 0.66, 0.46, 0.84, 0.036),  # venstre bein
    (0.53, 0.66, 0.54, 0.84, 0.036),  # høyre bein
]
CIRCLES = [(0.50, 0.245, 0.068)]  # hode


def capsule_distance(px, py, x1, y1, x2, y2, radius):
    dx, dy = x2 - x1, y2 - y1
    length_squared = dx * dx + dy * dy
    t = 0.0 if length_squared == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_squared))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) - radius


def figure_distance(x, y):
    distances = [capsule_distance(x, y, *capsule) for capsule in CAPSULES]
    distances += [math.hypot(x - cx, y - cy) - r for cx, cy, r in CIRCLES]
    return min(distances)


def render(size, scale):
    """scale < 1 krymper figuren mot midten, slik maskable-ikoner krever."""
    rows = []
    pixel = 1 / size
    for row in range(size):
        line = bytearray([0])
        for column in range(size):
            x = 0.5 + ((column + 0.5) * pixel - 0.5) / scale
            y = 0.5 + ((row + 0.5) * pixel - 0.5) / scale
            coverage = max(0.0, min(1.0, 0.5 - figure_distance(x, y) * size * scale))
            line.extend(round(b + (f - b) * coverage) for b, f in zip(BACKGROUND, FOREGROUND))
        rows.append(bytes(line))
    return b"".join(rows)


def write_png(path, size, raw):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    icons = Path(__file__).resolve().parent.parent / "icons"
    for name, size, scale in [
        ("icon-180.png", 180, 1.0),
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("icon-maskable-512.png", 512, 0.78),
    ]:
        write_png(icons / name, size, render(size, scale))
        print("skrev", name)
