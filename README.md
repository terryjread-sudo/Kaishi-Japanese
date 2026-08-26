# Kaishi Quest v11.8.48 — Interactive Kanji Component Cards in Learning Path

## What's new

### Kanji reinforcement, built into the normal lesson flow

A new card type — **Component build** — now appears occasionally as an ordinary card inside regular missions, for words that have a Kanji component breakdown available.

Instead of a passive reveal, it's genuinely interactive: you tap the correct components in order to assemble the word's Kanji, the same tap-to-place interaction as the standalone Kanji Builder activity, just scoped to a single word and a single build.

**How it fits into a mission:**
1. The card shows the word's meaning and reading (like a normal recall card)
2. You tap components from a shuffled option list to fill the assembly slots in the correct visual order
3. Once all slots are filled, "Lock in Kanji" becomes available
4. Locking in reveals whether you built it correctly, shows the component story, and grades the attempt
5. Tapping Continue moves straight to the next card in the mission — no separate screen, no round counter, no summary screen

**Where it comes from / where it doesn't go:**
- Reuses the exact same interaction, data, and CSS as the full Kanji Builder (Kanji Gate) activity — nothing new to maintain twice
- The full multi-round Kanji Builder is untouched and still available on its own for focused practice
- Grades feed the same `components` skill used everywhere else, so it strengthens the normal spaced-repetition schedule for that word — no separate progress bucket

**When it's offered:**
- Only for words that already have at least one Kanji with a component record
- Only once a word is past first encounter (same restriction as other optional skills like Picture or Kanji recognition)
- Woven into the same adaptive weighting as every other skill type, so it shows up occasionally without crowding out core meaning/listening/reading review

## Files changed

- `app.js` — new `wordComponentRecords()` helper, `components` added to `chooseSkill()`'s weighted skill pools, new `renderComponentBuild()` / `updateInlineBuildSelection()` / `resolveComponentBuild()` functions, new `if(skill==='components')` render branch
- `release-manager.js`, `service-worker.js`, `index.html` — version bump only

## No database changes required

Deploy these files:
- `index.html`
- `app.js`
- `service-worker.js`
- `release-manager.js`
- `version.json`

---

## Previous releases

### v11.8.47 — Flight Mode & Offline Session Loop Fix
- Fixed infinite session recursion loop when accessing learning in flight mode or offline.
- Replaced network-only `{cache: 'no-store'}` data fetches with resilient Cache API fallbacks.
- Updated Service Worker `networkFirst` fallback with `ignoreSearch:true` so cached scripts and styles match when offline.

### v11.8.46 — Activity Landmarks & Skill Web Spacing
- Optimized spacing to prevent overlapping node cards and map hotspots.

### v11.8.45 — Remove Redundant Offline Banner

The full-width red offline banner (fixed to the bottom of the screen) was **removed**.

The title bar already shows a compact **"● Offline"** / **"● No internet"** pill next to the version badge whenever connectivity is lost. That pill is always visible and unobtrusive, making the large bottom banner redundant.

**Before v11.8.45:** two indicators appeared simultaneously — a small title-bar pill AND a large coloured banner covering the bottom of the screen.
**After v11.8.45:** only the title-bar pill remains. It turns amber when offline or when Forced offline mode is active.

| State | Pill text | Pill colour |
|---|---|---|
| Online | *(hidden)* | — |
| Forced offline mode | ● Offline mode | Amber |
| No internet connection | ● No internet | Amber |

### v11.8.44 — Banner CSS Fix & Offline State Sync
- Fixed massive red banner bug — was using flex with conflicting CSS properties causing it to cover the entire left side.
- Banner now displays as a simple notification bar at the bottom of the screen without covering interface.
- Fixed critical bug where offline logging wasn't working: logging functions are now defined before connectivity checks so logs actually appear.
- Added state logging to UI updates so you can see in admin logs why the UI is showing offline/online (what the values are).
- Offline state now properly syncs: if logs show online but UI shows offline, the bug is fixed and UI will update correctly.

### v11.8.43 — Offline Detection Logging
- Logs show full URL checked, banner moved to bottom, waits for first verification before showing offline state.

### v11.8.42 — Admin Logging
- Added admin-area real-time logs for offline detection and system diagnostics.

### v11.8.41 — Settings Tabs & Offline Detection
- Settings screen reorganized into tabs (Learning / Character / Account / Data & Offline / About).
- Offline detection now verified with a real network probe instead of trusting `navigator.onLine` alone.
- Fixed offline packs missing core vocabulary/kana/manga/theatre/grammar/mnemonic data.

