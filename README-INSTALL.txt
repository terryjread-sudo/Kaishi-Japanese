Kaishi Quest v11.25.3 — Duplicate Dashboard button on the Journey screen
==========================================================================

BASE VERSION: 11.25.2

Drop these 3 files into the repo root, overwriting the existing ones.

FILES IN THIS ZIP
------------------
  road-ahead.js  (replace)
  version.js     (replace) — version bump to 11.25.3
  version.json   (replace) — changelog entry

WHAT WAS FIXED
---------------
Reported: two "← Dashboard" buttons stacked at the top of the Journey
screen. Confirmed from the screenshot: the floating top-left button was
rendering directly on top of the Journey screen's own pre-existing
inline #journeyBack button (part of .study-top), which stayed in normal
document flow underneath it.

Fix: once the floating overlay installs, it adds a
"kq-road-ahead-active" class to <html> and a scoped rule
(.kq-road-ahead-active #journeyBack{display:none}) hides the original
inline button. If the overlay script ever fails to load, that class is
never added, so the original button stays visible and still works —
this is a fallback, not a deletion.

TESTING DONE
-------------
- node --check on road-ahead.js and version.js: clean.
- version.json validated as JSON.
- NOT tested in an actual browser. Please confirm only one Dashboard
  button now appears on the Journey screen, and that it still returns
  to the dashboard correctly.
