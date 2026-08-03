# Kaishi Quest

Kaishi Quest is a browser-based Japanese learning app built around vocabulary, visual mnemonics, listening, reading, Kanji, grammar, games and an adaptive guided journey.

## Current release

**v6.8.0 — Improved Meet the Word Learning**

### v6.8.0 highlights

- Approved mnemonic artwork replaces the duplicate ordinary picture on Meet the Word cards.
- Written Japanese, reading and English meaning are clearly labelled.
- The Japanese audio speaker is positioned beside the written word.
- Introduction cards explain how to use the mnemonic picture, sound clue and story.
- Mnemonic stories are displayed automatically by default for new users.
- Existing users retain their saved mnemonic display preferences.
- Page, app and asset versions use the existing v6.8.0 release mechanism.

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
