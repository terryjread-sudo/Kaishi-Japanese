# Kaishi Quest v11.0.0 — The Living Village

This package is based on the repository's current v10.1.1 main state.

## Village presentation

- Building labels are now compact RPG panels with activity icon, building name and status.
- A map legend identifies Locked in fog, Ready to restore and Open states.
- Touch targets remain larger than the visible labels.

## Progressive magical fog

Fog is now rendered in a dedicated layer above the map and below labels:

- heavy fog when far from the activity's word requirement;
- medium fog once meaningful progress has been made;
- light wisps when ready to restore;
- completely clear after restoration.

## Water and ambience

- River highlights now travel straight down the map.
- Castle waterfall highlights move vertically down.
- Waterfall mist is positioned over the base of the two castle falls.
- River, pool, waterfall, petal and foreground effects are more visible.
- Reduced-motion preferences remain supported.

## Village cat

A small animated calico cat appears only near opened buildings.

- It changes location every 22–48 seconds.
- It uses a subtle four-frame idle animation.
- Tapping it produces a short friendly message.
- It moves to a newly restored building after an unlock.

## Cache reliability

The image cache is now versioned with the application release. Old shell and image caches are deleted during service-worker activation.

The Classic/Village toggle, learning progress, AP, lifetime XP and purchases are preserved.

No Supabase SQL changes are required.
