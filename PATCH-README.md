# Kaishi Quest v11.25.7 patch

Base: **v11.25.6**

## Install
Drop these files into the repository root and replace the existing `version.js`:

- `version.js`
- `patch-11.25.7.js`

Do not delete or replace `app.js`, `roadmap-engine.js`, or `journey.js`.

## Changes

### Journey activity scheduling
A shared activity registry now drives both lesson integration and the roadmap. This prevents the roadmap from advertising an activity in a different lesson from the one in which the lesson engine schedules it.

- Picture Matching is a core lesson activity once its unlock requirement is reached and the lesson has mnemonic scene art.
- Listening can be integrated when the lesson has audio-backed words.
- Karuta, Theatre, Manga and Battle are treated as optional immersive side quests rather than silently forced into the core lesson.
- The scheduling rules apply across the journey, not only Lesson 2.
- The roadmap reports the same scheduled activity/side-quest state.

### Automatic progress saving
The existing checkpoint save remains in place, but the checkpoint confirmation dialog is suppressed.

- Progress is saved automatically at the existing checkpoint.
- A temporary **Saving progress** bubble is shown.
- The learner is not asked whether to continue or save.
- Existing exit/resume saving remains intact.

### Version
`11.25.7`

## Safety
The patch is additive and runtime-based so the existing large `app.js` remains untouched. If the runtime patch cannot find the expected v11.25.6 `makeSession` marker, it fails closed for lesson scheduling rather than rewriting unrelated code.
