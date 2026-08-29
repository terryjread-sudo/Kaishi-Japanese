Kaishi Quest v11.16.3 — Journey Timeline & Adaptive Side Quests

BASE
----
Built as a drop-in patch for the live Kakashi-Web 11.16.2 code currently on main.
The patch is additive and intentionally does not replace the large app.js file.

CHANGES
-------
1. Journey is presented as one vertical timeline containing:
   - a few recently completed lessons
   - the current lesson
   - required side quests when triggered
   - the retry of the same lesson
   - a few upcoming lessons
2. Timeline supports touch scrolling/swiping and mouse wheel/drag interaction.
3. Quick Reviews are removed from the main Journey presentation. Normal spaced
   review remains part of lesson selection and the learning engine.
4. When the existing Journey checkpoint says a lesson needs another pass, the
   patch inserts a required side quest and then a retry of that same lesson.
5. Side quests are visually distinct and remain inside the Journey path.
6. Old village/mission/route completion wording is cleaned up in the Journey UI.
7. Oversized legacy history entries are normalised so an old entry cannot claim
   an entire catalogue of words was learned in one session.
8. Japan Ready remains a separate path. Its established scenario implementation
   is preserved, while the cheat-sheet speech buttons get a robust speechSynthesis
   handler that handles delayed Japanese voice loading and resume().

FILES
-----
version.js
version.json
japan-ready.js
journey-v3.js
journey-v3.css

IMPORTANT
---------
Japan Ready currently uses the established live implementation loaded by its
compatibility loader, so the device must be online when that implementation is
first loaded. The existing Japan Ready scenario data/behaviour is not rewritten
by this patch.

DROP-IN
-------
Overwrite the matching files in the live repository. No other repository files
need to be removed.
