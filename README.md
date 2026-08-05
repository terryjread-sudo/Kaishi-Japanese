# Kaishi Quest v10.0.0 — Activity Village

Upload these files over v9.1.0.

## Activity Village

Practice Grounds is replaced by a village map. Each activity is a location that can be restored and then used for practice.

An activity requires both:

- enough introduced words supported by that activity;
- enough spendable Adventure Points.

Lifetime XP never decreases and remains the leaderboard score. Available AP is lifetime XP minus AP already spent.

## Fair activity word pools

Picture Meadow, listening games and Karuta now strictly use:

`introduced words ∩ activity-supported words`

No fallback to unseen vocabulary is allowed.

Picture Meadow begins with an easier mode that shows the picture and English meaning before asking for the Japanese word.

## RPG unlock flow

Selecting a location opens a full-screen scene showing:

- vocabulary readiness;
- AP readiness and cost;
- available content;
- lifetime XP;
- available AP;
- teacher guidance.

Restoring a location plays a short animation and permanently records the purchase.

The legacy Games chooser is hidden. Exiting an activity returns to Activity Village.

No Supabase SQL changes are required because village purchases and AP spending are stored inside the existing progress payload.
