Kaishi Quest v11.16.4 patch

Drop these files over the matching files in the live repository:
- version.js
- version.json
- journey-v3.js
- journey-v3.css
- japan-ready.js

Fixes:
1. Continue Journey no longer triggers the Journey timeline MutationObserver to repeatedly render itself, which could freeze/crash the app.
2. Journey reads/writes the same profile-scoped storage keys as the main app.
3. Japan Ready cheat-sheet audio now uses a robust Android/Chrome speech path with delayed voice handling and a short cancel/resume delay.
4. Japan Ready remains a separate learning path.
