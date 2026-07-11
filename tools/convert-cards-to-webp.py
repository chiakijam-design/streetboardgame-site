from pathlib import Path

from PIL import Image


CARDS_DIR = Path(__file__).resolve().parents[1] / "assets" / "cards"


def main() -> None:
    png_files = sorted(CARDS_DIR.glob("*.png"), key=lambda path: int(path.stem))
    if len(png_files) != 42:
        raise RuntimeError(f"Expected 42 PNG cards, found {len(png_files)}")

    for source in png_files:
        target = source.with_suffix(".webp")
        with Image.open(source) as image:
            image.save(
                target,
                "WEBP",
                quality=90,
                method=6,
                optimize=True,
                icc_profile=image.info.get("icc_profile"),
            )

    print(f"Converted {len(png_files)} cards to WebP")


if __name__ == "__main__":
    main()
