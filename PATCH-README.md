# Kakashi Web v11.25.9 patch

Base: v11.25.8

## Purpose
Adjust lesson completeness so a strong lesson does not require a long tail of
tiny percentage increases before reaching mastery pending.

A learner who performs strongly in the lesson, especially on lesson recognition
and active recall, is treated as ready for consolidation and can reach 100%
after roughly two strong spaced reviews.

Learners with weaker lesson evidence can take up to roughly four good reviews.

## Behaviour
- Does not change SRS scheduling.
- Does not change individual word mastery rules.
- Does not add a second review counter.
- Uses the existing `progress[*].reps` and skill metrics.
- Keeps optional immersive activities from becoming an artificial completion
  blocker.
- Refreshes Journey/roadmap rendering after progress saves.

## Install
Drop `patch-11.25.9.js` and this README into the repository alongside the
existing 11.25.7/11.25.8 patches, following the repo's existing patch-loader
convention.

This patch is intended to sit on top of v11.25.8.
