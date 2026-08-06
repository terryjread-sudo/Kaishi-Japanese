# Kaishi Quest v10.1.1 — Water-mask correction

Upload this package over v10.1.0.

## Corrected

The v10.1.0 vector clip paths did not align reliably in the mobile browser. Only part of the upper-right waterfall received visible animation.

v10.1.1 uses four exact 1024 × 1536 masks matched pixel-for-pixel to the shipped map:

- rivers and connecting channels;
- wider pools and still water;
- the two castle waterfalls;
- sea and harbour water.

Each water type has its own movement speed and opacity. Roads, bridges, roofs, rocks and buildings remain still.

The illustrated map remains the clean map asset. The earlier labelled image was a visual concept mock-up; the real app intentionally renders labels and statuses as accessible HTML.

No Supabase SQL changes are required.
