"""Import kana characters and pronunciation audio from two Anki package extractions.

Usage:
  python tools/import-kana-decks.py EXTRACTED_HIRAGANA EXTRACTED_KATAKANA
"""

from __future__ import annotations

import html
import json
import pathlib
import re
import shutil
import sqlite3
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
MEDIA_DIR = ROOT / "media" / "kana"
OUTPUT = ROOT / "data" / "kana.json"
SOUND_RE = re.compile(r"\[sound:([^\]]+)\]")
TAG_RE = re.compile(r"<[^>]+>")


def media_map(folder: pathlib.Path) -> dict[str, str]:
    return json.loads((folder / "media").read_text(encoding="utf-8"))


def collection(folder: pathlib.Path) -> pathlib.Path:
    for name in ("collection.anki21", "collection.anki2"):
        candidate = folder / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"No Anki collection found in {folder}")


def notes(folder: pathlib.Path) -> list[list[str]]:
    connection = sqlite3.connect(collection(folder))
    rows = connection.execute(
        "select n.flds from notes n join cards c on c.nid=n.id order by c.due,c.id"
    ).fetchall()
    connection.close()
    return [row[0].split("\x1f") for row in rows]


def clean_text(value: str) -> str:
    return html.unescape(TAG_RE.sub("", SOUND_RE.sub("", value))).strip()


def copy_audio(
    folder: pathlib.Path, mapping: dict[str, str], original: str, target: str
) -> str:
    reverse = {filename: archive_name for archive_name, filename in mapping.items()}
    archive_name = reverse.get(original)
    if archive_name is None:
        return ""
    source = folder / archive_name
    destination = MEDIA_DIR / target
    shutil.copyfile(source, destination)
    return f"kana/{target}"


def group_for(kana: str) -> str:
    if len(kana) > 1:
        return "combinations"
    if kana in "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゔガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴ":
        return "voiced"
    return "basic"


def import_hiragana(folder: pathlib.Path) -> list[dict[str, str]]:
    mapping = media_map(folder)
    imported = []
    for index, fields in enumerate(notes(folder), 1):
        kana, back = fields[:2]
        match = SOUND_RE.search(back)
        original = match.group(1) if match else ""
        romaji = clean_text(back)
        audio = copy_audio(
            folder, mapping, original, f"hiragana-{index:03d}-{romaji or 'sound'}.mp3"
        ) if original else ""
        imported.append({
            "id": f"hiragana-{index:03d}",
            "script": "hiragana",
            "group": group_for(kana),
            "kana": kana,
            "romaji": romaji,
            "audio": audio,
        })
    return imported


def import_katakana(folder: pathlib.Path) -> list[dict[str, str]]:
    mapping = media_map(folder)
    imported = []
    for index, fields in enumerate(notes(folder), 1):
        kana, romaji, _mnemonic, _image, audio_field = (fields + [""] * 5)[:5]
        match = SOUND_RE.search(audio_field)
        original = match.group(1) if match else ""
        safe_romaji = re.sub(r"[^a-z0-9]+", "-", romaji.lower()).strip("-")
        audio = copy_audio(
            folder, mapping, original, f"katakana-{index:03d}-{safe_romaji or 'sound'}.mp3"
        ) if original else ""
        imported.append({
            "id": f"katakana-{index:03d}",
            "script": "katakana",
            "group": group_for(kana),
            "kana": kana,
            "romaji": clean_text(romaji),
            "audio": audio,
        })
    return imported


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    hiragana = pathlib.Path(sys.argv[1]).resolve()
    katakana = pathlib.Path(sys.argv[2]).resolve()
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    entries = import_hiragana(hiragana) + import_katakana(katakana)
    payload = {
        "schemaVersion": 1,
        "sourceNote": "Characters and pronunciation audio imported from user-supplied Anki decks.",
        "counts": {
            "hiragana": sum(item["script"] == "hiragana" for item in entries),
            "katakana": sum(item["script"] == "katakana" for item in entries),
            "audio": sum(bool(item["audio"]) for item in entries),
        },
        "entries": entries,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["counts"], indent=2))


if __name__ == "__main__":
    main()
