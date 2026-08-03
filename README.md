# Kaishi Quest

Kaishi Quest is a browser-based Japanese learning app built around vocabulary, mnemonics, listening, reading, Kanji, grammar, games and an adaptive learning journey.

## Current version

**v6.8.0**

## Main features

- Adaptive daily learning journey
- Vocabulary study with spaced repetition
- Mnemonic images and stories
- Kanji recognition and Kanji Builder
- Hiragana and Katakana learning paths
- Listening and reading practice
- Picture matching and Karuta
- Conversation Quest
- Kaishi Theatre
- Particle Shrine grammar lessons
- Manga-style reading activities
- Progress tracking, streaks and optional cloud sync

## v6.8.0 changes

This release improves the **Meet the Word** introduction cards:

- Approved mnemonic artwork replaces the ordinary built-in picture.
- Written Japanese, reading and meaning are clearly labelled.
- The audio control is shown beside the word as a speaker icon.
- Learners receive guidance on how to use the image, sound clue and story.
- Mnemonic stories are shown automatically by default for new users.
- Existing users keep their previously saved story-display preference.
- The visible app version and stylesheet cache version are set to v6.8.0.

## Repository structure

Common root files include:

- `index.html` — main application page
- `app.js` — core application logic
- `styles.css` — main styles
- `vms.js` — visual mnemonic integration
- `vms.css` — visual mnemonic styles
- `visual-mnemonics.json` — mnemonic card data
- `manifest.webmanifest` — Progressive Web App configuration
- `service-worker.js` — offline and update handling
- `data/` — vocabulary, grammar, stories and lesson data
- `media/` — audio, profiles and other media assets

## Deployment

The app is deployed with GitHub Pages.

After replacing files in the repository:

1. Commit the changes to the default branch.
2. Wait for GitHub Pages to finish deploying.
3. Open the app and refresh once.
4. For an installed PWA, fully close and reopen it if an older cached version appears.

## Notes

Kaishi Quest is under active development. Some learning content and mnemonic artwork may still be reviewed or improved in later releases.
