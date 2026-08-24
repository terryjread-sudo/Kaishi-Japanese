# Kaishi Quest v11.8.45 — Remove Redundant Offline Banner

## What changed

### Offline indicator simplified

The full-width red offline banner (fixed to the bottom of the screen) has been **removed**.

The title bar already shows a compact **"● Offline"** / **"● No internet"** pill next to the version badge whenever connectivity is lost. That pill is always visible and unobtrusive, making the large bottom banner redundant.

**Before v11.8.45:** two indicators appeared simultaneously — a small title-bar pill AND a large coloured banner covering the bottom of the screen.  
**After v11.8.45:** only the title-bar pill remains. It turns amber when offline or when Forced offline mode is active.

### Pill behaviour (unchanged)

| State | Pill text | Pill colour |
|---|---|---|
| Online | *(hidden)* | — |
| Forced offline mode | ● Offline mode | Amber |
| No internet connection | ● No internet | Amber |

## What was removed

- `#offlineModeBanner` DOM element and its creation code
- `#offlineModeBanner` CSS block
- Banner update logic in `updateOfflineStatusUI()`

## No database changes required

Deploy these files:
- `release-manager.js`
- `version.json`

---

## Previous releases

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
