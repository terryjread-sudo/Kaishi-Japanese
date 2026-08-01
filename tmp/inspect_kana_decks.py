import json
import pathlib
import sqlite3

root = pathlib.Path("tmp/kana-import")
for name, db in (
    ("hiragana", root / "hiragana" / "collection.anki2"),
    ("katakana", root / "katakana" / "collection.anki21"),
):
    connection = sqlite3.connect(db)
    tables = [row[0] for row in connection.execute(
        "select name from sqlite_master where type='table'"
    )]
    print(name, tables)
    print(
        "notes", connection.execute("select count(*) from notes").fetchone()[0],
        "cards", connection.execute("select count(*) from cards").fetchone()[0],
    )
    models_blob = connection.execute("select models from col").fetchone()[0]
    for model_id, model in json.loads(models_blob).items():
        fields = [field["name"] for field in model.get("flds", [])]
        print("MODEL", model_id, model.get("name"), fields)
        samples = connection.execute(
            "select flds from notes where mid=? limit 3", (model_id,)
        ).fetchall()
        for sample in samples:
            print("SAMPLE", sample[0].split("\x1f"))
    connection.close()

for name in ("hiragana", "katakana"):
    media_map = json.loads((root / name / "media").read_text(encoding="utf-8"))
    extensions = {}
    for filename in media_map.values():
        suffix = pathlib.Path(filename).suffix.lower()
        extensions[suffix] = extensions.get(suffix, 0) + 1
    print("MEDIA", name, len(media_map), extensions)
