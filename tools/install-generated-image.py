#!/usr/bin/env python3
"""Normalize a generated mnemonic image into the app's 900x500 WebP format."""

from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageOps


parser = ArgumentParser()
parser.add_argument(
    "paths",
    nargs="+",
    type=Path,
    help="One or more SOURCE TARGET path pairs.",
)
args = parser.parse_args()

if len(args.paths) % 2:
    raise SystemExit("Provide paths as SOURCE TARGET pairs.")

for source_path, target_path in zip(args.paths[::2], args.paths[1::2]):
    if not source_path.is_file():
        raise SystemExit(f"Source image does not exist: {source_path}")

    with Image.open(source_path) as source:
        output = ImageOps.fit(
            source.convert("RGB"),
            (900, 500),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        output.save(target_path, "WEBP", quality=92, method=6)

    with Image.open(target_path) as installed:
        if installed.size != (900, 500) or installed.format != "WEBP":
            raise SystemExit(f"Invalid installed image: {target_path}")

        print(
            f"Installed {target_path} "
            f"({installed.size[0]}x{installed.size[1]} {installed.format})."
        )
