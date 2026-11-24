#!/usr/bin/env python3
"""按 icon.svg 的几何参数生成 16/32/48/128 的透明 PNG。"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SIZES = (16, 32, 48, 128)
BASE = 128
SUPERSAMPLE = 8
FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)
BUBBLE = (31, 136, 61, 255)
TAIL = (26, 127, 55, 255)
TEXT = (255, 255, 255, 255)


def pick_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit("未找到可用的粗体字体，请调整 FONT_CANDIDATES")


def master_image():
    scale = SUPERSAMPLE
    image = Image.new("RGBA", (BASE * scale, BASE * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.polygon(
        [(26 * scale, 94 * scale), (26 * scale, 114 * scale), (50 * scale, 98 * scale)],
        fill=TAIL,
    )
    draw.rounded_rectangle(
        (8 * scale, 14 * scale, 120 * scale, 100 * scale),
        radius=22 * scale,
        fill=BUBBLE,
    )

    font_size = 30 * scale
    font = pick_font(font_size)
    box = font.getbbox("LGTM")
    width = box[2] - box[0]
    max_width = 88 * scale
    if width > max_width:
        font = pick_font(int(font_size * max_width / width))
    draw.text((64 * scale, 57 * scale), "LGTM", font=font, fill=TEXT, anchor="mm")
    return image


def main():
    master = master_image()
    for size in SIZES:
        target = HERE / f"icon-{size}.png"
        master.resize((size, size), Image.LANCZOS).save(target)
        print(target)


if __name__ == "__main__":
    main()
