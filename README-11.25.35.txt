Kaishi Quest 11.25.35

Vocabulary-gated Journey activities and lesson reinforcement

Changes:
- Picture Matching is scheduled inside Journey lessons when the lesson has suitable mnemonic scene art. It reinforces the words being learned rather than acting as a separate XP unlock.
- Listening remains routine reinforcement when lesson vocabulary has audio.
- Karuta, Conversation, Theatre, Kanji Builder, Manga and SRS Battle are treated as optional Journey side quests. They use familiar vocabulary and do not replace the required vocabulary lesson.
- SRS Battle remains a separate side quest and is never inserted into the lesson card sequence.
- Activity access no longer depends on XP or Adventure Points. The old AP prices are neutralised at runtime and stale AP-based unlock state is discarded from the active unlock set.
- Activities become available independently when their relevant vocabulary requirement is met.
- The daily Journey route contains one required lesson plus, where relevant, one optional side quest. Optional side quests never block the next lesson.
- The activity policy is shared with the roadmap engine so upcoming activity information follows the same vocabulary-led rules.

Files in this release:
- version.js (updated to load the new core activity policy)
- version.json (11.25.35 release metadata)
- service-worker.js (11.25.35 cache and new core script)
- journey-activities.js (new core Journey activity policy)

Install:
Replace the existing files at the repository root with the files in this ZIP and add journey-activities.js.
