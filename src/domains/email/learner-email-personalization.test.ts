import { describe, expect, it } from 'vitest';
import { buildLearnerEmailSnapshot, personalisedEmailContent } from '../../../supabase/functions/_shared/learner-email-personalization';

const vocabulary = [{ id: 'yes', word: 'はい' }, { id: 'no', word: 'いいえ' }, { id: 'okay', word: '大丈夫' }];
const now = new Date('2026-09-06T12:00:00.000Z');

describe('learner email personalisation', () => {
  it('derives only warm private progress facts for an active learner', () => {
    const snapshot = buildLearnerEmailSnapshot({
      progress: {
        yes: { stage: 2, interval: 21, skills: { meaning: { strength: 0.8 }, listening: { strength: 0.8 }, reading: { strength: 0.8 } } },
        no: { stage: 1, skills: { meaning: { attempts: 1 } } },
      },
      meta: { streak: 3, rhythmHistory: { '2026-09-01': {}, '2026-09-05': {}, '2026-09-06': {} }, dailyJourneyRoute: { chapter: 0, steps: [{ id: 'lesson-0', wordIds: ['yes', 'no', 'okay'] }] } },
    }, 'Aiko', vocabulary, now);
    expect(snapshot).toMatchObject({ name: 'Aiko', lesson: 'Lesson 1', words: ['はい', 'いいえ', '大丈夫'], masteredWords: 1, rhythmDays: 3, learningDaysThisWeek: 3 });
    const onboarding = personalisedEmailContent('onboarding_nudge', snapshot);
    const reengagement = personalisedEmailContent('reengagement', snapshot);
    const weekly = personalisedEmailContent('weekly_recap', snapshot);
    const monthly = personalisedEmailContent('monthly_sensei_letter', snapshot);
    expect(onboarding.subject).toContain('Aiko');
    expect(onboarding.body).toContain('はい, いいえ, and 大丈夫');
    expect(reengagement.body).toContain('はい, いいえ, and 大丈夫');
    expect(weekly.body).toContain('はい, いいえ, and 大丈夫');
    expect(weekly.body).toContain('3 day');
    expect(monthly.subject).toContain('Lesson 1');
  });

  it('uses a safe fallback for a fresh account with no synced progress', () => {
    const snapshot = buildLearnerEmailSnapshot(null, '', vocabulary, now);
    expect(snapshot).toMatchObject({ name: 'learner', lesson: null, words: [], masteredWords: 0, rhythmDays: 0, learningDaysThisWeek: 0 });
    expect(personalisedEmailContent('onboarding_nudge', snapshot).body).toContain('はい, いいえ, and 大丈夫');
    expect(personalisedEmailContent('weekly_recap', snapshot).body).not.toContain('meaningful time');
    expect(personalisedEmailContent('monthly_sensei_letter', snapshot).body).not.toContain('mastered Japanese');
  });

  it('does not retain claims after a learner resets progress', () => {
    const snapshot = buildLearnerEmailSnapshot({ progress: {}, meta: { streak: 0, rhythmHistory: {} } }, 'Ken', vocabulary, now);
    const reengagement = personalisedEmailContent('reengagement', snapshot);
    expect(reengagement.subject).toBe('Your Japanese journey is waiting');
    expect(reengagement.body).not.toContain('mastered Japanese');
    expect(reengagement.body).not.toContain('learning rhythm');
  });
});
