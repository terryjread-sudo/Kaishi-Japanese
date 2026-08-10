KAISHI QUEST v11.3.4 PATCH
==============================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

CHANGES
-------
1. Classic Activity Landmarks
   Kotoba Colosseum is now inserted into #pathRoad, the same Classic Activity
   Landmarks container used by the existing landmark cards. It is no longer
   dependent on the separate practiceHub list.

2. Japanese-word audio clarity
   Colosseum BGM now runs quieter normally and ducks to almost silent while a
   Japanese word is being played/read. It gently returns after the word ends.
   This works with both audio files and speechSynthesis fallback.

3. Existing v11.3.3 improvements retained
   - transparent battle sprites
   - answer feedback replaces choices in-place
   - no scrolling down for Next Turn
   - music stops/reset when leaving battle
   - Activity Village map launcher

4. Version/cache bump
   All release-controlled references and service-worker caches are v11.3.4.

No Supabase/database migration is required.
Learner progress, streaks, settings and cloud progress are not cleared.
