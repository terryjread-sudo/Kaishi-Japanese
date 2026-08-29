KAKASHI QUEST v11.16.2 — JOURNEY / JAPAN READY PATCH

Drop these files over the matching files in the live repository:
- version.js
- japan-ready.js
- journey-v3.js
- journey-v3.css

What is fixed:
1. Japan Ready is restored as a separate path. 11.16.1 removed its chooser
   buttons but the existing japan-ready.js still tried to bind them directly,
   causing a null-reference during init and preventing Japan Ready from loading.
2. Journey remains one guided path.
3. A lesson checkpoint below the existing 75% mastery gate now adds a REQUIRED
   side quest before the lesson can be retried. The side quest is chosen from
   the learner's weakest recent skill where possible.
4. The same lesson is then presented again as a retry step.
5. Completed lessons/history remain part of the Journey rather than separate
   activity destinations.
6. Japan Ready's existing implementation and data remain otherwise unchanged.

IMPORTANT:
The Japan Ready compatibility loader fetches the exact 11.16.1 japan-ready.js
from the repository commit so the existing Japan Ready implementation is not
rewritten or downgraded. The app is already a web app hosted from GitHub, so
this only adds a small compatibility dependency on the public repository copy.

Version: 11.16.2
Base inspected: main @ 2148988b621f01af1f0f808e2e0b6631bdf6e11f1 (11.16.1)
