#!/usr/bin/env python3
"""Add Injective Trade Town-specific modular tiles to Kenney's CC0 RPG Urban atlas."""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public/assets/trade-town/kenney-urban-base-32.png"
OUTPUT = ROOT / "public/assets/trade-town/kenney-urban-32.png"
TILE = 32
COLS = 27
BASE_ROWS = 19
OUTPUT_ROWS = 25
CUSTOM_START = COLS * BASE_ROWS


def tile_index(local_index: int) -> int:
    return CUSTOM_START + local_index


def tile_origin(index: int) -> tuple[int, int]:
    return (index % COLS) * TILE, (index // COLS) * TILE


def paint_tile(atlas: Image.Image, local_index: int, tile: Image.Image) -> None:
    atlas.alpha_composite(tile, tile_origin(tile_index(local_index)))


def canvas(color: str | tuple[int, int, int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (TILE, TILE), color)
    return image, ImageDraw.Draw(image)


def speckle(
    draw: ImageDraw.ImageDraw,
    colors: list[str],
    *,
    count: int,
    seed: int,
    y_min: int = 0,
    y_max: int = TILE - 1,
) -> None:
    rng = random.Random(seed)
    for _ in range(count):
        x = rng.randrange(1, TILE - 1)
        y = rng.randrange(max(1, y_min), min(TILE - 1, y_max + 1))
        color = colors[rng.randrange(len(colors))]
        draw.point((x, y), fill=color)
        if rng.random() < 0.18:
            draw.point((min(TILE - 2, x + 1), y), fill=color)


def ground_tiles() -> list[Image.Image]:
    tiles: list[Image.Image] = []

    image, draw = canvas("#537b62")
    speckle(draw, ["#496f58", "#648b6c", "#789672"], count=48, seed=11)
    tiles.append(image)

    image, draw = canvas("#5c8368")
    speckle(draw, ["#4c755c", "#719276", "#88a27d"], count=58, seed=17)
    tiles.append(image)

    image, draw = canvas("#949b98")
    for x in range(0, TILE, 8):
        draw.line((x, 0, x, TILE), fill="#747d7a")
    for y in range(0, TILE, 8):
        draw.line((0, y, TILE, y), fill="#747d7a")
    speckle(draw, ["#b0b5af", "#69726f"], count=20, seed=21)
    tiles.append(image)

    image, draw = canvas("#858c8a")
    for y in range(0, TILE, 8):
        offset = 4 if (y // 8) % 2 else 0
        draw.line((0, y, TILE, y), fill="#676f6e")
        for x in range(offset, TILE, 8):
            draw.line((x, y, x, min(TILE, y + 8)), fill="#737b79")
    tiles.append(image)

    image, draw = canvas("#666d70")
    for y in range(0, TILE, 8):
        offset = 5 if (y // 8) % 2 else 0
        draw.line((0, y, TILE, y), fill="#4d5559")
        for x in range(offset, TILE, 11):
            draw.line((x, y, x, min(TILE - 1, y + 8)), fill="#565e61")
    speckle(draw, ["#747b7c", "#50585b"], count=24, seed=31)
    tiles.append(image)

    image, draw = canvas("#404652")
    speckle(draw, ["#4b5260", "#343943"], count=22, seed=32)
    draw.rectangle((0, 14, 9, 17), fill="#d6c77b")
    draw.rectangle((18, 14, 31, 17), fill="#d6c77b")
    tiles.append(image)

    image, draw = canvas("#404652")
    speckle(draw, ["#4b5260", "#343943"], count=22, seed=33)
    draw.rectangle((14, 0, 17, 9), fill="#d6c77b")
    draw.rectangle((14, 18, 17, 31), fill="#d6c77b")
    tiles.append(image)

    image, draw = canvas("#2f8390")
    for y in (5, 16, 26):
        draw.line((2, y, 12, y), fill="#65b4b6")
        draw.line((17, y + 2, 29, y + 2), fill="#216f80")
    speckle(draw, ["#4197a0", "#267482"], count=18, seed=41)
    tiles.append(image)

    image, draw = canvas("#337f8c")
    for y in (8, 21):
        draw.line((4, y, 16, y), fill="#65b4b6")
        draw.line((20, y + 3, 29, y + 3), fill="#216f80")
    speckle(draw, ["#4197a0", "#267482"], count=20, seed=42)
    tiles.append(image)

    image, draw = canvas("#2f8390")
    draw.rectangle((0, 0, 31, 6), fill="#776e68")
    draw.line((0, 0, 31, 0), fill="#c7b898")
    draw.line((0, 6, 31, 6), fill="#403f43")
    for x in range(3, TILE, 8):
        draw.line((x, 1, x, 5), fill="#5f5b58")
    speckle(draw, ["#4197a0", "#267482"], count=15, seed=43, y_min=8)
    tiles.append(image)

    image, draw = canvas("#2f8390")
    draw.rectangle((0, 0, 6, 31), fill="#776e68")
    draw.line((0, 0, 0, 31), fill="#c7b898")
    draw.line((6, 0, 6, 31), fill="#403f43")
    for y in range(3, TILE, 8):
        draw.line((1, y, 5, y), fill="#5f5b58")
    speckle(draw, ["#4197a0", "#267482"], count=15, seed=44, y_min=1)
    tiles.append(image)

    image, draw = canvas("#c9b894")
    draw.rectangle((0, 0, 31, 4), fill="#7c726b")
    draw.line((0, 4, 31, 4), fill="#e1d2ad")
    tiles.append(image)

    image, draw = canvas("#9b704c")
    for x in range(0, TILE, 6):
        draw.rectangle((x, 0, min(31, x + 4), 31), fill="#ae8057")
        draw.line((x + 4, 0, x + 4, 31), fill="#684d3c")
    draw.line((0, 4, 31, 4), fill="#d0a56b")
    draw.line((0, 27, 31, 27), fill="#60483b")
    tiles.append(image)

    image, draw = canvas("#8e806b")
    for y in range(0, TILE, 8):
        draw.rectangle((0, y, 31, min(31, y + 5)), fill="#a79578")
        draw.line((0, y + 6, 31, y + 6), fill="#635b55")
    draw.line((0, 2, 31, 2), fill="#d8c59d")
    draw.line((0, 29, 31, 29), fill="#4c4b50")
    tiles.append(image)

    image, draw = canvas("#b9aa8f")
    draw.rectangle((0, 0, 31, 3), fill="#e0d0aa")
    draw.rectangle((0, 28, 31, 31), fill="#6a625e")
    for x in range(0, TILE, 8):
        draw.line((x, 4, x, 27), fill="#9b8d77")
    tiles.append(image)

    image, draw = canvas("#c9b894")
    for x in range(2, TILE, 7):
        draw.rectangle((x, 3, min(31, x + 2), 28), fill="#eee5c7")
    tiles.append(image)

    image, draw = canvas("#c9b894")
    for y in range(2, TILE, 7):
        draw.rectangle((3, y, 28, min(31, y + 2)), fill="#eee5c7")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 3, 28, 28), fill="#4a293966")
    draw.rectangle((6, 6, 31, 31), fill="#241d2b77")
    tiles.append(image)

    image, draw = canvas("#b9aa8f")
    draw.ellipse((3, 3, 28, 28), fill="#6e7c68", outline="#473f42", width=2)
    draw.ellipse((8, 8, 23, 23), fill="#d1b75f")
    draw.rectangle((14, 5, 17, 26), fill="#c4d3c2")
    draw.rectangle((5, 14, 26, 17), fill="#c4d3c2")
    tiles.append(image)

    image, draw = canvas("#6f675f")
    speckle(draw, ["#80766a", "#5d5854"], count=35, seed=47)
    draw.line((0, 5, 31, 5), fill="#a49a86")
    tiles.append(image)

    image, draw = canvas("#a06f44")
    for y in range(0, TILE, 8):
        draw.rectangle((0, y, 31, min(31, y + 5)), fill="#b5804e")
        draw.line((0, y + 6, 31, y + 6), fill="#5f4738")
    tiles.append(image)

    image, draw = canvas("#2f8390")
    draw.rectangle((0, 0, 31, 5), fill="#756b65")
    draw.line((0, 5, 31, 5), fill="#3d3b41")
    speckle(draw, ["#4197a0", "#267482"], count=18, seed=48, y_min=7)
    tiles.append(image)

    image, draw = canvas("#2f8390")
    draw.rectangle((0, 0, 5, 31), fill="#756b65")
    draw.line((5, 0, 5, 31), fill="#3d3b41")
    speckle(draw, ["#4197a0", "#267482"], count=18, seed=49, y_min=1)
    tiles.append(image)

    image, draw = canvas("#2f8390")
    draw.rectangle((0, 0, 6, 6), fill="#756b65")
    draw.arc((0, 0, 13, 13), 0, 90, fill="#d7c6a2", width=2)
    speckle(draw, ["#4197a0", "#267482"], count=18, seed=50, y_min=8)
    tiles.append(image)

    image, draw = canvas("#404652")
    draw.polygon([(0, 22), (22, 0), (31, 0), (0, 31)], fill="#4b5260")
    draw.line((0, 27, 27, 0), fill="#d6c77b", width=2)
    tiles.append(image)

    image, draw = canvas("#537b62")
    draw.rectangle((4, 4, 27, 27), fill="#71675f", outline="#3f3a3d", width=2)
    draw.rectangle((8, 8, 23, 23), fill="#628b69")
    speckle(draw, ["#85a77e", "#3e6c54"], count=16, seed=51, y_min=8, y_max=23)
    tiles.append(image)

    image, draw = canvas("#537b62")
    draw.line((0, 16, 31, 16), fill="#cbb78e", width=5)
    draw.line((16, 0, 16, 31), fill="#cbb78e", width=5)
    draw.rectangle((13, 13, 19, 19), fill="#d2bb66")
    tiles.append(image)

    return tiles


def building_tiles(
    roof: str,
    roof_dark: str,
    roof_light: str,
    wall: str,
    wall_dark: str,
    glass: str,
    seed: int,
) -> list[Image.Image]:
    tiles: list[Image.Image] = []

    def roof_tile(left: bool, right: bool, top: bool) -> Image.Image:
        image, draw = canvas(roof)
        speckle(draw, [roof_dark, roof_light], count=20, seed=seed + len(tiles))
        if top:
            draw.rectangle((0, 0, 31, 4), fill=roof_dark)
            draw.line((0, 4, 31, 4), fill=roof_light)
        if left:
            draw.rectangle((0, 0, 3, 31), fill=roof_dark)
            draw.line((4, 0, 4, 31), fill=roof_light)
        if right:
            draw.rectangle((28, 0, 31, 31), fill=roof_dark)
            draw.line((27, 0, 27, 31), fill=roof_light)
        return image

    tiles.extend(
        [
            roof_tile(True, False, True),
            roof_tile(False, False, True),
            roof_tile(False, True, True),
            roof_tile(True, False, False),
            roof_tile(False, False, False),
            roof_tile(False, True, False),
        ]
    )

    for kind in ("left", "middle", "right", "door"):
        image, draw = canvas(wall)
        draw.rectangle((0, 0, 31, 5), fill=roof_dark)
        draw.line((0, 5, 31, 5), fill=roof_light)
        draw.rectangle((0, 27, 31, 31), fill=wall_dark)
        if kind == "left":
            draw.rectangle((0, 0, 3, 31), fill=wall_dark)
        if kind == "right":
            draw.rectangle((28, 0, 31, 31), fill=wall_dark)
        if kind == "door":
            draw.rectangle((8, 9, 23, 31), fill="#2b2933", outline=roof_light, width=2)
            draw.rectangle((11, 12, 20, 28), fill=glass)
            draw.point((20, 22), fill="#f0d37b")
            draw.rectangle((5, 6, 26, 9), fill=roof_dark)
        else:
            draw.rectangle((7, 10, 24, 23), fill="#292b35", outline=roof_light, width=2)
            draw.rectangle((10, 13, 21, 20), fill=glass)
            draw.line((15, 12, 15, 21), fill=roof_light)
        tiles.append(image)
    return tiles


def landmark_tiles() -> list[Image.Image]:
    tiles: list[Image.Image] = []

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((5, 5, 26, 26), fill="#8c5939", outline="#e4b96d", width=2)
    draw.rectangle((9, 9, 22, 22), fill="#4cb1b5", outline="#302c39", width=2)
    draw.line((9, 16, 22, 16), fill="#d4e5d0")
    draw.line((16, 9, 16, 22), fill="#d4e5d0")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.ellipse((4, 4, 27, 27), fill="#d0b177", outline="#665347", width=3)
    draw.ellipse((10, 10, 21, 21), fill="#f2db9a")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.line((16, 4, 16, 28), fill="#423c48", width=3)
    draw.line((8, 16, 24, 16), fill="#423c48", width=2)
    draw.rectangle((12, 7, 20, 12), fill="#e96e5f")
    draw.point((16, 3), fill="#f5d66f")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 7, 28, 24), fill="#313846", outline="#8ec4c4", width=2)
    for x in (6, 14, 22):
        draw.rectangle((x, 10, x + 5, 21), fill="#4a7890")
        draw.line((x, 15, x + 5, 15), fill="#9bc6c4")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 3, 28, 28), fill="#55745b", outline="#302e37", width=2)
    for x, y, color in (
        (7, 7, "#8eb36f"),
        (17, 6, "#d3a15d"),
        (10, 17, "#5d9a72"),
        (21, 19, "#8eb36f"),
    ):
        draw.ellipse((x, y, x + 6, y + 6), fill=color)
    tiles.append(image)

    for color in ("#3ba8aa", "#d29a4d"):
        image, draw = canvas((0, 0, 0, 0))
        draw.rectangle((2, 4, 29, 12), fill=color, outline="#3c3340", width=2)
        for x in range(5, 29, 7):
            draw.line((x, 12, x, 18), fill="#574047")
        tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 7, 28, 30), fill="#373946", outline="#b46d47", width=2)
    for x in (7, 14, 21):
        draw.line((x, 10, x, 28), fill="#9a5c42", width=2)
    draw.rectangle((7, 22, 24, 29), fill="#262832")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 13, 29, 17), fill="#d79d55")
    draw.rectangle((6, 9, 9, 26), fill="#5b4b45")
    draw.rectangle((24, 4, 27, 26), fill="#5b4b45")
    draw.line((8, 9, 25, 4), fill="#e7ba6e", width=2)
    draw.rectangle((23, 23, 29, 28), fill="#7d5c46")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    for x in (5, 13, 21, 29):
        draw.rectangle((x, 13, min(31, x + 2), 26), fill="#4f494b")
        draw.rectangle((x - 1, 10, min(31, x + 3), 14), fill="#d7bb72")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((4, 7, 27, 25), fill="#555b65", outline="#292d38", width=2)
    draw.rectangle((7, 10, 24, 18), fill="#8d9b98")
    for x in (9, 14, 19):
        draw.line((x, 11, x, 17), fill="#4b5559")
    draw.rectangle((9, 24, 12, 29), fill="#393844")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    for x, y in ((6, 8), (17, 6), (11, 19), (23, 20)):
        draw.ellipse((x, y, x + 5, y + 5), fill="#737d7a", outline="#30313a")
        draw.rectangle((x + 2, y + 5, x + 3, y + 9), fill="#3e3d46")
    tiles.append(image)

    for glass, frame in (("#58b3b3", "#d6c48d"), ("#d69b55", "#6a443e")):
        image, draw = canvas((0, 0, 0, 0))
        draw.rectangle((3, 8, 28, 24), fill=frame, outline="#2a2933", width=2)
        draw.rectangle((7, 11, 14, 21), fill=glass)
        draw.rectangle((18, 11, 25, 21), fill=glass)
        draw.line((16, 9, 16, 23), fill="#2a2933", width=2)
        tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.line((4, 24, 4, 10, 18, 10, 18, 22, 28, 22), fill="#46434b", width=3)
    for x, y in ((4, 10), (18, 10), (18, 22), (28, 22)):
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill="#c68454")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 7, 28, 25), fill="#76533e", outline="#302b34", width=2)
    for x in range(6, 28, 6):
        draw.line((x, 8, x, 24), fill="#d39a62", width=2)
    draw.rectangle((5, 17, 26, 22), fill="#557c5e")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    for x in (3, 16):
        draw.rectangle((x, 7, x + 12, 24), fill="#334957", outline="#8dbfc0", width=2)
        draw.line((x + 2, 15, x + 10, 15), fill="#5f8d9a")
        draw.line((x + 6, 9, x + 6, 22), fill="#5f8d9a")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((2, 7, 29, 25), fill="#4f765a", outline="#2d3434", width=2)
    for x, y, color in (
        (5, 10, "#86a86f"),
        (12, 17, "#d49b5b"),
        (20, 10, "#6aa071"),
        (23, 18, "#a8b66d"),
    ):
        draw.ellipse((x, y, x + 5, y + 5), fill=color)
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.ellipse((5, 5, 26, 22), fill="#63747a", outline="#292d38", width=2)
    draw.rectangle((8, 14, 23, 27), fill="#536167", outline="#292d38", width=2)
    draw.line((8, 12, 23, 12), fill="#a4b2aa")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.arc((5, 3, 27, 25), 205, 345, fill="#d5c489", width=3)
    draw.line((16, 15, 16, 28), fill="#3d3a43", width=3)
    draw.line((10, 28, 22, 28), fill="#3d3a43", width=2)
    draw.point((16, 4), fill="#ef6d5f")
    tiles.append(image)

    return tiles


def roof_surface_variants(
    roof_dark: str,
    roof_light: str,
    seed: int,
) -> list[Image.Image]:
    variants: list[Image.Image] = []

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((5, 5, 26, 26), outline=roof_dark, width=2)
    draw.line((7, 8, 24, 8), fill=roof_light)
    for x, y in ((7, 7), (24, 7), (7, 24), (24, 24)):
        draw.rectangle((x, y, x + 1, y + 1), fill=roof_light)
    variants.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.line((3, 25, 25, 3), fill=roof_dark, width=3)
    draw.line((8, 29, 29, 8), fill=roof_light, width=2)
    for x, y in ((7, 23), (15, 15), (23, 7)):
        draw.ellipse((x, y, x + 2, y + 2), fill=roof_light)
    variants.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 11, 28, 20), fill=roof_dark, outline=roof_light, width=1)
    for x in range(6, 28, 5):
        draw.line((x, 13, x, 18), fill=roof_light)
    speckle(draw, [roof_dark, roof_light], count=8, seed=seed)
    variants.append(image)

    return variants


def pitched_roof_tiles() -> list[Image.Image]:
    tiles: list[Image.Image] = []

    roof_palettes = [
        ("#a95643", "#64373a", "#db8860"),
        ("#3f6f91", "#29455c", "#75a8bd"),
        ("#3e817d", "#295753", "#72b3a6"),
        ("#596174", "#363b4b", "#8991a3"),
    ]

    # Three tiles per palette: left slope, ridge, right slope. These are opaque
    # roof planes rather than repeated decorative marks, so the buildings read
    # as complete pitched volumes at game scale.
    for roof, dark, light in roof_palettes:
        image, draw = canvas(roof)
        for y in range(4, TILE, 6):
            draw.line((0, y, 31, y), fill=dark)
            for x in range((y // 6) % 2 * 8, TILE, 16):
                draw.line((x, y, x, min(31, y + 5)), fill=dark)
        draw.rectangle((0, 0, 3, 31), fill=dark)
        draw.line((29, 0, 29, 31), fill=light, width=2)
        speckle(draw, [dark, light], count=11, seed=701 + len(tiles))
        tiles.append(image)

        image, draw = canvas(light)
        draw.rectangle((0, 0, 31, 31), fill=roof)
        draw.rectangle((10, 0, 21, 31), fill=light)
        draw.line((10, 0, 10, 31), fill="#eee0bc", width=2)
        draw.line((21, 0, 21, 31), fill=dark, width=2)
        for y in range(3, TILE, 7):
            draw.rectangle((13, y, 18, min(31, y + 2)), fill=dark)
        tiles.append(image)

        image, draw = canvas(roof)
        for y in range(4, TILE, 6):
            draw.line((0, y, 31, y), fill=dark)
            for x in range(8 - (y // 6) % 2 * 8, TILE, 16):
                draw.line((x, y, x, min(31, y + 5)), fill=dark)
        draw.line((2, 0, 2, 31), fill=light, width=2)
        draw.rectangle((28, 0, 31, 31), fill=dark)
        speckle(draw, [dark, light], count=11, seed=701 + len(tiles))
        tiles.append(image)

    # Dutch stepped gables used for banks, exchanges and merchant houses.
    for roof, dark, light in roof_palettes:
        image, draw = canvas((0, 0, 0, 0))
        points = [
            (4, 29), (4, 23), (8, 23), (8, 17), (12, 17), (12, 10),
            (16, 5), (20, 10), (20, 17), (24, 17), (24, 23), (28, 23), (28, 29),
        ]
        draw.polygon(points, fill=roof, outline="#292a33")
        draw.line(points, fill=light, width=2)
        draw.rectangle((12, 18, 20, 27), fill="#2d3842", outline=dark)
        draw.line((16, 18, 16, 27), fill=light)
        tiles.append(image)

    # Cross-gable projections for inns, cafés and guild buildings.
    for roof, dark, light in roof_palettes:
        image, draw = canvas((0, 0, 0, 0))
        draw.polygon([(3, 25), (16, 5), (29, 25)], fill=roof, outline="#292a33")
        draw.line((5, 24, 16, 8, 27, 24), fill=light, width=2)
        draw.rectangle((11, 18, 21, 27), fill="#303b45", outline=dark)
        draw.line((16, 18, 16, 27), fill=light)
        tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((9, 8, 21, 27), fill="#65433b", outline="#2d2b33", width=2)
    draw.rectangle((7, 5, 23, 10), fill="#806050", outline="#2d2b33")
    draw.rectangle((11, 12, 19, 24), fill="#3b3438")
    draw.line((12, 8, 20, 8), fill="#d49a66")
    tiles.append(image)

    image, draw = canvas((0, 0, 0, 0))
    draw.rectangle((3, 16, 28, 26), fill="#3a7d65", outline="#2d2b33", width=2)
    for x, color in ((6, "#e4b253"), (12, "#d76b58"), (18, "#8fc26d"), (24, "#f0d17c")):
        draw.ellipse((x, 11, x + 5, 18), fill=color)
    draw.rectangle((5, 25, 26, 29), fill="#76513e")
    tiles.append(image)

    return tiles


def main() -> None:
    base = Image.open(BASE).convert("RGBA")
    if base.size != (COLS * TILE, BASE_ROWS * TILE):
        raise ValueError(f"Unexpected base atlas dimensions: {base.size}")

    atlas = Image.new("RGBA", (COLS * TILE, OUTPUT_ROWS * TILE), (0, 0, 0, 0))
    atlas.alpha_composite(base, (0, 0))

    ground = ground_tiles()
    for index, tile in enumerate(ground):
        paint_tile(atlas, index, tile)

    palettes = [
        ("#a65f43", "#623d3c", "#d99a63", "#8c493e", "#50323a", "#64b8ba"),
        ("#c5aa74", "#75604f", "#ead39b", "#aa835e", "#664c43", "#78b9b6"),
        ("#49788c", "#2f4659", "#7eabb3", "#456173", "#293746", "#80c5c4"),
        ("#a65e48", "#663d3e", "#d78c61", "#8d4c44", "#54343b", "#76afb0"),
        ("#555c73", "#363849", "#858ca0", "#4b4d61", "#2e303d", "#74b4b6"),
        ("#8b6c59", "#514a47", "#b89772", "#6e5b52", "#3d3b3e", "#d09056"),
    ]
    local_index = len(ground)
    for palette_index, palette in enumerate(palettes):
        for tile in building_tiles(*palette, seed=100 + palette_index * 17):
            paint_tile(atlas, local_index, tile)
            local_index += 1

    for tile in landmark_tiles():
        paint_tile(atlas, local_index, tile)
        local_index += 1

    for palette_index, palette in enumerate(palettes):
        for tile in roof_surface_variants(
            palette[1],
            palette[2],
            seed=300 + palette_index * 13,
        ):
            paint_tile(atlas, local_index, tile)
            local_index += 1

    for tile in pitched_roof_tiles():
        paint_tile(atlas, local_index, tile)
        local_index += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} ({atlas.width}x{atlas.height}), custom tiles through {tile_index(local_index - 1)}")


if __name__ == "__main__":
    main()
