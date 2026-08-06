# Kaishi Quest v11.0.1 — Water and cat correction

Upload this package over v11.0.0.

## Water correction

The previous mask images contained opaque alpha across their entire canvas. Browsers therefore applied the moving texture to the complete village rather than just the white water shapes.

The four masks are now genuine transparent alpha masks:

- rivers and connecting streams;
- pools and calmer water;
- castle waterfalls;
- sea and harbour.

Movement is now clipped to water only and its opacity has been reduced slightly.

## Village cat correction

The cat now uses a curated list of clear resting places.

A position is rejected when it:

- falls inside an unopened or fog-covered building;
- overlaps a building panel;
- is too close to a blocked location.

Building labels render above the cat, so activity information always remains readable.

No Supabase SQL changes are required.
