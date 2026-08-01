"""Normalize generated Manga Stories pages into app-ready WebP assets."""

from pathlib import Path
import sys

from PIL import Image, ImageOps


OUTPUT_NAMES = (
    "morning-race",
    "rainy-mistake",
    "lost-cat",
    "cooking-challenge",
    "late-meeting",
    "night-photograph",
    "mountain-path",
    "secret-letter",
    "sea-rescue",
    "clocktower-mystery",
)


def main() -> None:
    if len(sys.argv) != len(OUTPUT_NAMES) + 2:
        raise SystemExit(
            "usage: install-manga-pages.py OUTPUT_DIR "
            + " ".join(f"{name}.png" for name in OUTPUT_NAMES)
        )
    output_dir = Path(sys.argv[1])
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, source_arg in zip(OUTPUT_NAMES, sys.argv[2:]):
        source = Path(source_arg)
        with Image.open(source) as opened:
            image = ImageOps.fit(
                opened.convert("RGB"),
                (1200, 800),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            image.save(output_dir / f"{name}.webp", "WEBP", quality=91, method=6)
        print(f"installed {name}.webp")


if __name__ == "__main__":
    main()
