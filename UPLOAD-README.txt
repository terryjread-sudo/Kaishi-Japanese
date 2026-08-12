KAISHI QUEST v11.7.0 — LEARNING FEEDBACK & DAILY SUMMARY
=============================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

NEW FILE
--------
learning-ui.js

TODAY SUMMARY
-------------
A persistent "Your learning so far" card is shown on the dashboard.
It remains available after exiting lessons and activities.

The detailed Today summary includes:
- new words learned today
- learning answers and accuracy
- missions completed
- activities completed
- overall Recognising / Recall / Usable totals
- today's increases in those learning states

Daily data is stored locally under a date-specific kq-daily-summary-* key.

KEEP LEARNING
-------------
Once all 3 recommended daily-route steps are complete, Journey shows:
- Another mission
- Reviews
- Practice

These are explicitly optional extra learning.

JAPANESE SCRIPT COLOUR
----------------------
Japanese text is progressively enhanced:
- Kanji: warm terracotta / meaning anchor
- Hiragana: neutral existing text colour
- Katakana: soft teal / loanword-emphasis cue

The colouriser uses lighter variants when the surrounding text is light on a
dark surface.

TOUCH DISCOVERABILITY
---------------------
Touch devices now receive visible hints for:
- swiping Journey / Japan Ready
- dragging in Kotoba Rain
- tapping / long-pressing kana where available

KANA FEEDBACK
-------------
Correct/wrong feedback is now a centered overlay rather than content below
the choices. The learner MUST press Continue (or View path summary).
There is no timed automatic progression.

KOTOBA RAIN
-----------
Fixed the 0-second stuck state. When the clock reaches zero, endGame() now
runs immediately and is guarded so it can only finish once.

VERSION / CACHE
---------------
Release and service-worker references are bumped to v11.7.0.
learning-ui.js is included in the shell cache.

No Supabase migration is required.
