KAISHI QUEST v11.5.0 — DASHBOARD CLARITY
=============================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

NEW FILE
--------
dashboard-clarity.js

DASHBOARD CHANGES
-----------------
The dashboard now focuses on:
  1. What should I do now?
  2. How is my Japanese progressing?
  3. Is there anything important I should know?

- Journey topic + Sensei guidance + mission composition + main actions are
  combined into one "Today's Learning" card.
- The old 8-card stats grid is hidden on the dashboard.
- A capability chart shows cumulative vocabulary at:
    Recognising
    Recall
    Usable
- Generic "Ready to learn?", deck summary, avatar milestone and redundant
  permanent explanatory text are removed from the front dashboard.
- Streak qualification text becomes actionable:
    "2 answers to protect today's streak"
    or
    "Today's streak is protected"
- Study Modes becomes a simple Journey / Japan Ready switch.
- Dashboard navigation becomes:
    Practice | Collection | Progress | Community
- Invite is no longer duplicated on the dashboard; it remains in Community.
- "Activity Village" wording is changed to "Practice Activities" where the
  dashboard layer encounters it.

IMPORTANT
---------
This is a PRESENTATION release only. It does not change:
- SRS grading
- word-state thresholds
- adaptive mission composition
- Journey topic progression
- Japan Ready progression
- cloud data

All v11.4.x learning features remain.

VERSION / CACHE
---------------
Release and service-worker references are bumped to v11.5.0.
dashboard-clarity.js is precached by the new service worker.

No Supabase migration is required.
