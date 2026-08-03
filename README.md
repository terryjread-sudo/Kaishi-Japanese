# Kaishi Quest

Kaishi Quest is a browser-based Japanese learning app built around vocabulary, visual mnemonics, listening, reading, Kanji, grammar, games and an adaptive guided journey.

## Current release

**v6.9.1 — Active Recall Declutter**

### v6.9.1 highlights

- Active Recall hides the ordinary built-in picture when an approved mnemonic picture is available.
- The memory-hint button is removed after the answer is revealed.
- Audio becomes a compact speaker icon beside the revealed Japanese word or Kanji.
- The revealed-answer area uses less space and contains fewer competing controls.
- Choice-based recall now shows a correct/incorrect feedback panel with the correct answer, replayable audio and a deliberate Continue action.
- All previous v6.9 mobile and Journey improvements remain included.

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
