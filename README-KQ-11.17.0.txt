Kaishi Quest v11.17.0 — Journey + Japan Ready fixes

Based on the current Journey/Japan Ready compatibility state used in the live repository.

Files:
- version.js — canonical APP_VERSION 11.17.0; safe initialisation with compatibility alias.
- journey-v3.js — replaces the old Journey presentation with one canonical past/present/future timeline. Uses persistent chapter progress for completed/current/future lessons and inserts triggered side quests/retries into the same timeline. The old Next lesson / Recommended today / Recent lessons / Journey ahead surfaces are suppressed.
- japan-ready.js — keeps Japan Ready separate, forces Journey as the dashboard default unless Japan Ready was explicitly selected, and installs direct cheat-sheet audio handling on pointer/click for dynamically-created buttons.

Versioning:
version.js is the single source of truth. Do not manually edit index.html or version.json for this patch; the repository release workflow should propagate generated version information.

Important:
Japan Ready content/learning flow is not converted to the Journey model. The compatibility loader still loads the established Japan Ready implementation from the existing live commit.
