from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
HERO_CARD_IDS = (1, 15, 20)


def save_webp(source: Path, target: Path, *, height: int, quality: int = 86) -> None:
    with Image.open(source) as image:
        width = round(image.width * height / image.height)
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        resized.save(
            target,
            "WEBP",
            quality=quality,
            method=6,
            optimize=True,
            icc_profile=image.info.get("icc_profile"),
        )


def main() -> None:
    character_source = ASSETS / "character" / "girl-full.png"
    for height in (480, 960):
        save_webp(
            character_source,
            ASSETS / "character" / f"girl-full-{height}.webp",
            height=height,
            quality=86,
        )

    for card_id in HERO_CARD_IDS:
        save_webp(
            ASSETS / "cards" / f"{card_id}.png",
            ASSETS / "cards" / "hero" / f"{card_id}.webp",
            height=495,
            quality=84,
        )

    print("Generated responsive character and top-page card images")


if __name__ == "__main__":
    main()
