KAISHI QUEST v11.7.3 — SWIPE CARD LAYOUT FIX
================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

FIXED
-----
1. Japanese Journey / Japan Ready carousel
   - active card is fully readable
   - a small controlled part of the neighbouring card remains visible
   - balanced left/right padding
   - centered scroll snapping
   - card text/content no longer clips at the viewport edges

2. Keep Learning carousel
   - Another Mission / Reviews / Practice cards use consistent mobile width
   - cards snap to the center
   - text no longer gets chopped off at the right edge
   - both sides of the carousel have safe padding

DESKTOP
-------
Desktop continues to show cards side by side and is not restricted by the
mobile widths.

VERSION / CACHE
---------------
Release and service-worker references are bumped to v11.7.3.

No Supabase migration is required.
