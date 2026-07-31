from pathlib import Path
from PIL import Image


SOURCES = {
    "boy": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-372708cc-3e36-49f4-a8de-d7cd75b62bfa.png",
    "girl": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-312cfddd-e81b-4fe5-ab8b-b84fbef0e7ba.png",
    "master": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-ae3939e4-1e7f-45d7-919d-2a534bafcb6a.png",
    "man": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-81ff3f46-03ef-44ed-9947-a3390888296d.png",
    "woman": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-c5715973-c10c-4ffc-ba69-97c30fc91eaa.png",
}

VARIANTS = {
    "boy-thumbs-up": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-a10c394b-e8b1-4515-9cca-0975621bad6a.png",
    "boy-double-thumbs": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-c335738a-0b85-4dc6-b90c-0083d64bbce3.png",
    "boy-flex": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-c6c0ea74-fba3-45d7-ab09-4307271a5c4b.png",
    "boy-double-flex": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-40a054b8-4fad-4e05-a65a-9f224ff526fd.png",
    "boy-superhero": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-1f74bd8a-6599-4428-bf85-2d5583884ea3.png",
    "girl-thumbs-up": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-75624af5-58d1-4f50-be36-f66bbb3379a0.png",
    "girl-double-thumbs": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-fbfdd03c-7f71-4c06-9215-d0c0f234a3d4.png",
    "girl-flex": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-eda00646-0bec-4e4a-9bd2-b764f635d27d.png",
    "girl-double-flex": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-e8b68e87-1c5f-4098-8727-40c8e96971b1.png",
    "girl-superhero": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-5d932d75-9907-4a20-89a7-0696256d47bb.png",
    "master-thumbs-up": r"C:\Users\terry\.codex\generated_images\019fb31a-0bb9-71c1-8177-f9a48427fe2d\exec-7282687f-1509-41e9-b2a1-8a252193e82b.png",
}

output_dir = Path(__file__).resolve().parents[1] / "media" / "profiles"
output_dir.mkdir(parents=True, exist_ok=True)

for name, source in (SOURCES | VARIANTS).items():
    with Image.open(source) as image:
        image = image.convert("RGB").resize((384, 384), Image.Resampling.LANCZOS)
        filename = f"{name}.webp" if name in VARIANTS else f"{name}-base.webp"
        image.save(output_dir / filename, "WEBP", quality=94, method=6)
