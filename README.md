# Kaishi Quest

Kaishi Quest is a browser-based Japanese learning app built around vocabulary, visual mnemonics, listening, reading, Kanji, grammar, games and an adaptive guided journey.

## Current release

**v6.9.0 — Mobile Learning and Journey Polish**

### v6.9.0 highlights

- Meet the Word uses a compact reading-and-meaning row.
- The learning instructions are fully shown only for the first two introduction cards in a session and then collapse.
- Duplicate learning guidance has been removed.
- The Continue action remains reachable at the bottom of the viewport.
- Journey mission cards, the per-word Journey badge and Share control use less vertical space.
- Why these missions starts collapsed and expands when requested.
- Only the current vocabulary expedition chapter shows full progress details; other chapters use compact summaries.

## Main features

- Adaptive daily Journey missions
- 1,500-word vocabulary route
- Spaced repetition and per-word mastery stages
- Visual mnemonic images, overlays and stories
- Hiragana and Katakana learning paths
- Listening, reading and production practice
- Kanji recognition and Kanji Builder
- Particle Shrine grammar lessons
- Conversation Quest and Kaishi Theatre
- Manga reading activities
- Picture matching, Karuta and review battles
- Progress tracking, streaks and optional cloud sync

## Important root files

- `index.html` — application page and asset version references
- `app.js` — main app logic and `APP_VERSION`
- `styles.css` — main interface styles
- `vms.js` — enhanced mnemonic-card behaviour
- `vms.css` — mnemonic-card styles
- `visual-mnemonics.json` — mnemonic data and image mappings
- `version.json` — current release information and change history

## Deployment

The app is published using GitHub Pages.

After replacing files in the repository:

1. Commit the uploaded files to the default branch.
2. Wait for GitHub Pages deployment to complete.
3. Refresh the website.
4. For an installed PWA, fully close and reopen it if the previous cached version remains visible.
