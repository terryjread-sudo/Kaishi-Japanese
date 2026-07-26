#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parent
mapping_path = ROOT / "memory-scenes.json"
mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
sheets = {}

for scene in mapping.values():
    pack, row, col = int(scene["pack"]), int(scene["row"]), int(scene["col"])
    filename = f"scene-p{pack:02d}-r{row+1:02d}-c{col+1:02d}.webp"
    scene["file"] = filename
    target = ROOT / filename
    if target.exists():
        continue
    if pack not in sheets:
        sheets[pack] = Image.open(ROOT / f"scene-pack-{pack:02d}.webp").convert("RGB")
    sheet = sheets[pack]
    w, h = sheet.size
    box = (
        round(col*w/10), round(row*h/5),
        round((col+1)*w/10), round((row+1)*h/5)
    )
    sheet.crop(box).save(target, "WEBP", quality=90, method=6)

mapping_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Built {len({s['file'] for s in mapping.values()})} standalone images.")
