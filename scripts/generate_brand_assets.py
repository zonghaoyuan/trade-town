"""Generate the pixel-art INJ badge used by the app and browser favicon."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "public/assets/fonts/upheaval_pro.ttf"
BRAND_DIR = ROOT / "public/assets/brand"
LOGO_PATH = BRAND_DIR / "inj-logo.png"
FAVICON_PNG_PATH = ROOT / "public/favicon.png"
FAVICON_ICO_PATH = ROOT / "public/favicon.ico"

BASE_SIZE = 128
EXPORT_SIZE = 512

SHADOW = "#120f1c"
PLUM = "#3f2832"
GOLD = "#fec742"
ORANGE = "#dd7c42"
CREAM = "#fff5d8"


def generate_logo() -> Image.Image:
    canvas = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Offset shadow and stepped border mirror the CSS pixel seal.
    draw.rectangle((18, 20, 118, 120), fill=SHADOW)
    draw.rectangle((10, 8, 112, 110), fill=SHADOW)
    draw.rectangle((18, 16, 104, 102), fill=GOLD)

    # Hard-edged inset lighting keeps the mark readable at favicon size.
    draw.rectangle((18, 16, 104, 20), fill=CREAM)
    draw.rectangle((18, 20, 22, 102), fill="#ffd967")
    draw.rectangle((96, 20, 104, 102), fill=ORANGE)
    draw.rectangle((22, 94, 104, 102), fill=ORANGE)
    draw.rectangle((26, 26, 30, 30), fill=CREAM)
    draw.rectangle((88, 86, 92, 90), fill=PLUM)

    font = ImageFont.truetype(str(FONT_PATH), 43)
    text = "INJ"
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    text_width = right - left
    text_height = bottom - top
    text_x = 61 - text_width / 2 - left
    text_y = 59 - text_height / 2 - top

    draw.text((text_x + 2, text_y + 2), text, font=font, fill=ORANGE)
    draw.text((text_x, text_y), text, font=font, fill=PLUM)

    return canvas.resize((EXPORT_SIZE, EXPORT_SIZE), Image.Resampling.NEAREST)


def main() -> None:
    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    logo = generate_logo()
    logo.save(LOGO_PATH, optimize=True)

    favicon = logo.resize((64, 64), Image.Resampling.NEAREST)
    favicon.save(FAVICON_PNG_PATH, optimize=True)
    logo.save(FAVICON_ICO_PATH, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    print(LOGO_PATH)
    print(FAVICON_PNG_PATH)
    print(FAVICON_ICO_PATH)


if __name__ == "__main__":
    main()
