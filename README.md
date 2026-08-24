# Kaishi Quest v11.8.43 — Offline Diagnostics & UI Positioning

## What's fixed

### Admin Logging for Offline Detection
- New "Application logs" section in the Admin area (Settings > Account > Open Admin area)
- Real-time diagnostics showing each connectivity check as it happens
- Logs now display the full URL being checked: `Fetching: https://your-domain.com/version.json?t=...`
- See success (✓) or failure (✗) indicators with timestamps

### Offline Banner Repositioning
- The "Kaishi is offline" notification moved from **top of screen** to a **fixed position at the bottom**
- No longer covers Settings buttons, Learning tab, or other important interface elements
- Styled with a dark red background for clarity

### Improved Startup Behavior
- Offline banner now stays hidden until the first connectivity verification completes
- Prevents false "offline" alerts when you're actually online but `navigator.onLine` is stuck on `false`

### Core Fixes Carried Forward (v11.8.41-11.8.42)
- Settings reorganized into 5 tabs: Learning, Character, Account, Data & Offline, About
- Offline packs now include all core vocabulary/kana/manga/theatre/conversation/grammar/mnemonic data
- Connectivity verification uses a real network check (pinging your own `/version.json`)
- Self-healing: re-checks every 20s if stuck showing "offline"

## Testing offline mode

1. Download an Offline Pack (Data & Offline tab → "Download for offline use")
2. Open Admin area to watch the connectivity logs
3. Disconnect internet (airplane mode) or force offline mode (toggle in Settings)
4. Watch the logs update in real-time showing the offline status

## No database changes required

Drop these files into your repo root and commit:
- `index.html`
- `app.js`
- `service-worker.js`
- `release-manager.js`
- `version.json`
