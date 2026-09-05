import { expect, test } from '@playwright/test';

test('lesson checkpoints save without presenting a modal', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#missionCheckpointDialog')).toHaveCount(0);
});

test('focused lesson practice shows the learner-facing mastery path', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore first' }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { KaishiBonsaiBridge?: { startFirst: () => void } }).KaishiBonsaiBridge))).toBe(true);
  await page.evaluate(() => (window as typeof window & { KaishiBonsaiBridge: { startFirst: () => void } }).KaishiBonsaiBridge.startFirst());

  for (let index = 0; index < 3; index++) {
    await page.locator('#firstEncounterContinue').click();
    await page.locator('#continueBtn').click();
    await page.locator('#pronunciationSkip').click();
  }
  for (let index = 0; index < 3; index++) {
    await page.locator('#revealBtn').click();
    await page.getByRole('button', { name: 'Easy' }).click();
  }

  await expect.poll(() => page.evaluate(() => {
    const api = (window as typeof window & { KaishiLessonMastery?: { snapshot: (chapter: number) => { complete: boolean } } }).KaishiLessonMastery;
    return api?.snapshot(0).complete;
  })).toBe(true);
  await page.evaluate(() => (window as typeof window & { KaishiLessonMastery: { startPractice: (chapter: number) => boolean } }).KaishiLessonMastery.startPractice(0));

  await expect(page.locator('#journeySessionPreviewTitle')).toContainText('Focused practice');
  await page.locator('#journeySessionPreviewStart').click();
  await expect(page.locator('#sessionCounter .session-progress-chunk')).toHaveCount(6);
  await expect(page.locator('#sessionCounter .session-progress-chunk.current')).toHaveCount(1);
  await expect(page.locator('.lesson-mastery-path')).toContainText('Sensei’s Path:');
  await expect(page.locator('.lesson-mastery-path')).toContainText('%');
  await expect(page.locator('.lesson-mastery-path summary')).toHaveText('How this works');
  await expect(page.locator('.lesson-mastery-path details')).toContainText('Meeting every word opens the next lesson.');
});

test('test learner can launch an immersive activity after app initialization', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });

  await page.goto('/');

  const banner = page.locator('#adminTestBanner');
  const launch = page.locator('#adminTestActivityGo');
  await expect(page.locator('#restorePointsBtn')).toBeHidden();
  await expect(banner).toBeVisible();
  await expect(launch).toBeEnabled({ timeout: 30_000 });
  await expect(launch).toHaveText('Launch');

  await page.locator('#adminTestActivity').selectOption('sentenceLab');
  await launch.click();

  expect(runtimeErrors).toEqual([]);
  await expect(page.locator('#sentenceLab')).toHaveClass(/active/);
  await expect(page.locator('#sentenceLabHome')).toContainText('Sentence Lab');

  await page.locator('#adminTestActivity').selectOption('colosseum');
  await launch.click();
  await expect(page.locator('#listenBattle')).toHaveClass(/active/);

  await page.locator('#adminTestActivity').selectOption('kotobaEcho');
  await launch.click();
  await expect(page.locator('#kotobaEcho')).toHaveClass(/active/);
  await expect(page.locator('#kotobaEchoCard')).toContainText('Your line');
  await page.locator('#kotobaEchoSpeak').click();
  await expect(page.locator('#pronunciationCoachDialog')).toHaveCount(0);
  await expect(page.locator('#kotobaEchoStop')).toBeVisible();
});

test('an eligible lesson renders an Aiko and Kai story scene', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore first' }).click();

  await page.evaluate(async () => {
    const [catalog, words] = await Promise.all([
      fetch('data/lesson-story-scenes.json').then((response) => response.json()),
      fetch('data/vocabulary.json').then((response) => response.json()),
    ]);
    const policy = (window as typeof window & {
      KaishiActivityPolicy?: {
        selectLessonStoryScene: (catalog: unknown, lesson: number, words: Array<{ id: string; picture?: string }>) => unknown;
      };
    }).KaishiActivityPolicy;
    const lessonWords = words.slice(3, 6);
    const scene = policy?.selectLessonStoryScene(catalog, 2, lessonWords);
    const target = lessonWords.find((word: { id: string }) => word.id === '1708637439873');
    if (!scene || !target) throw new Error('Expected the Lesson 2 story scene.');

    (0, eval)(`session=[{v:${JSON.stringify(target)},skill:'storySentence',storyScene:${JSON.stringify(scene)}}];index=0;current=null;show('study');renderCurrent();`);
  });

  await expect(page.locator('.lesson-story-scene')).toBeVisible();
  await expect(page.locator('.lesson-story-scene')).toContainText('Aiko');
  await expect(page.locator('.lesson-story-scene')).toContainText('Kai');
  await page.getByRole('button', { name: 'Aiko', exact: true }).click();
  await expect(page.locator('#storySentenceFeedback')).toContainText('Not quite');
  await expect(page.locator('#storyAnswerAudio')).toBeVisible();
});

test('test learner lesson jump renders the same early Journey flow', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('1');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('#journeyHistoryTrack .kq-unified-timeline')).toBeVisible();
  await expect(page.locator('#journeyHistoryTrack')).not.toContainText('Your lessons will appear here as you progress.');
  await expect(page.locator('#journeyHistoryTrack [data-kq-activity="colosseum"]')).toHaveCount(0);
  await expect(page.getByText('Next immersive event:', { exact: false })).toHaveCount(0);
});

test('new words offer optional compact pronunciation practice', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { KaishiBonsaiBridge?: { startFirst: () => void } }).KaishiBonsaiBridge))).toBe(true);
  await page.evaluate(() => (window as typeof window & { KaishiBonsaiBridge: { startFirst: () => void } }).KaishiBonsaiBridge.startFirst());

  await page.locator('#firstEncounterContinue').click();
  await page.locator('#continueBtn').click();
  await expect(page.locator('.word-pronunciation-card')).toBeVisible();
  await expect(page.locator('#pronunciationSkip')).toBeVisible();
  await expect(page.locator('#pronunciationCheck')).toBeEnabled();
  await page.locator('#pronunciationCheck').click();
  await expect(page.locator('#pronunciationCoachDialog')).toBeVisible();
  await expect(page.locator('#pronunciationCoachDialog')).toContainText('Word pronunciation');
  await expect(page.locator('#pronunciationCoachDialog .pronunciation-mode')).toBeHidden();
  await page.locator('#pronunciationCoachDialog .pronunciation-close').click();
  await page.locator('#pronunciationSkip').click();
  await expect(page.locator('#sessionCounter')).toHaveAttribute('aria-label', /card 4 of/);
});

test('compact pronunciation results let a learner continue their lesson', async ({ page }) => {
  await page.addInitScript(() => {
    class RecognitionStub {
      lang = '';
      interimResults = false;
      continuous = false;
      onresult?: (event: unknown) => void;
      onend?: () => void;

      start() {
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: 'こんにちは' }], { isFinal: true })] });
        }, 0);
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    const appWindow = window as typeof window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    appWindow.SpeechRecognition = RecognitionStub;
    appWindow.webkitSpeechRecognition = RecognitionStub;
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { KaishiBonsaiBridge?: { startFirst: () => void } }).KaishiBonsaiBridge))).toBe(true);
  await page.evaluate(() => (window as typeof window & { KaishiBonsaiBridge: { startFirst: () => void } }).KaishiBonsaiBridge.startFirst());
  await page.locator('#firstEncounterContinue').click();
  await page.locator('#continueBtn').click();

  const counter = page.locator('#sessionCounter');
  const before = await counter.getAttribute('aria-label');
  await page.locator('#pronunciationCheck').click();
  await page.locator('#pronunciationCoachDialog .pronunciation-record').click();

  await expect(page.locator('#pronunciationCoachDialog .pronunciation-record')).toHaveText('🎙️ Check again');
  await expect(page.locator('#pronunciationCoachDialog .pronunciation-continue')).toBeVisible();
  await expect(page.locator('#pronunciationCoachDialog .pronunciation-actions')).toHaveClass(/compact-results/);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.locator('#pronunciationCoachDialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('.word-pronunciation-card')).toBeVisible();
  await expect(counter).toHaveAttribute('aria-label', before || '');
});

test('a learner can save a word without losing their active lesson card', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { KaishiBonsaiBridge?: { startFirst: () => void } }).KaishiBonsaiBridge))).toBe(true);
  await page.evaluate(() => (window as typeof window & { KaishiBonsaiBridge: { startFirst: () => void } }).KaishiBonsaiBridge.startFirst());

  const counter = page.locator('#sessionCounter');
  const before = await counter.innerText();
  await expect(page.locator('[data-notebook-save-word]')).toBeVisible();
  await page.locator('[data-notebook-save-word]').click();
  await expect(page.locator('[data-notebook-save-word]')).toHaveText('★');
  await expect(page.locator('[data-notebook-save-word]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#studyNotebook').click();
  await expect(page.locator('#learningNotebookDialog')).toBeVisible();
  await expect(page.locator('#learningNotebookDialog')).toContainText('Saved words');
  await expect(page.locator('#learningNotebookDialog .notebook-ink')).toBeVisible();
  await expect(page.locator('#learningNotebookDialog .notebook-entry-actions')).toBeVisible();
  await expect(page.locator('#notebookResetAll')).toBeHidden();
  await page.getByLabel('Notebook options').click();
  await expect(page.locator('#notebookClearTab')).toBeVisible();
  await expect(page.locator('#notebookResetAll')).toBeVisible();
  await page.locator('#learningNotebookClose').click();
  await expect(counter).toHaveText(before);
});

test('the first notebook star explains how to save a word once', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { KaishiBonsaiBridge?: { startFirst: () => void } }).KaishiBonsaiBridge))).toBe(true);
  await page.evaluate(() => (window as typeof window & { KaishiBonsaiBridge: { startFirst: () => void } }).KaishiBonsaiBridge.startFirst());

  await expect(page.locator('.notebook-star-hint')).toContainText('Tap the star to save this word to your Notebook.');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.locator('.notebook-star-hint')).toHaveCount(0);
  await page.locator('#firstEncounterContinue').click();
  await expect(page.locator('.notebook-star-hint')).toHaveCount(0);
});

test('image diagnostics includes imported Katakana Core mnemonic scenes', async ({ page }) => {
  await page.goto('/image-diagnostics.html');

  await expect(page.locator('#summary')).toContainText('100 Katakana Core');
  await expect(page.locator('#grid')).toContainText('Katakana Core');
});

test('the Dashboard opens the shared notebook from the Journey utility bar', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Explore first' }).click();

  const notebook = page.locator('#openNotebook');
  await expect(notebook).toBeAttached();
  await notebook.scrollIntoViewIfNeeded();
  await expect(notebook).toBeVisible();
  await expect(page.locator('#dashboardNav #openNotebook')).toHaveCount(1);
  await notebook.click();
  await expect(page.locator('#learningNotebookDialog')).toBeVisible();
  await expect(page.locator('#learningNotebookDialog')).toContainText('Saved words');
});

test('Sentence Lab saves remain available in the shared notebook', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const app = window as typeof window & {
      KaishiNotebook: { open: (tab: string) => void };
      KaishiSentenceLab: { saveSentence: (source: Record<string, unknown>) => void };
    };
    app.KaishiSentenceLab.saveSentence({
      id: 'notebook-test-sentence',
      sentence: 'お茶をください。',
      reading: 'おちゃをください。',
      meaning: 'Tea, please.'
    });
    app.KaishiNotebook.open('sentences');
  });

  await expect(page.locator('#learningNotebookDialog')).toBeVisible();
  await expect(page.locator('#learningNotebookDialog')).toContainText('Saved sentences');
  await expect(page.locator('#learningNotebookDialog .notebook-ink')).toContainText('お茶をください。');
});

test('Journey previews immersive missions through its ten-lesson horizon', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('20');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journeyHistoryTrack')).toBeVisible();
  const journeyBackground = await page.locator('#journeyHistoryTrack').evaluate(element => getComputedStyle(element).backgroundImage);
  expect(journeyBackground).toContain('bamboo-scroll-tile.png');
  await expect(page.locator('#journeyHistoryTrack .kq-chapter-scene')).toHaveCount(0);
  await expect(page.locator('#journeyHistoryTrack .kq-activity-badge').first()).toBeVisible();
  await expect(page.locator('#journeyHistoryTrack .kq-unified-node.future .kq-activity-badge').first()).toContainText('Immersive mission ahead');
  await page.getByRole('button', { name: 'Why this route?' }).click();
  await expect(page.locator('#journeyHistoryTrack .kq-mission-detail').first()).toContainText('Reinforces');
});

test('Journey shows ten upcoming lessons and explains that the path continues', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('1');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journeyHistoryTrack [data-kq-id^="lesson-"]')).toHaveCount(11);
  await expect(page.getByText('The path continues', { exact: true })).toBeVisible();
  await expect(page.getByText('Complete lessons to reveal more of your Journey ahead.', { exact: true })).toBeVisible();
});

test('Journey Dashboard control floats only from its title-row position', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('1');
  await page.locator('#adminTestLessonGo').click();

  const dashboard = page.locator('#journeyBack');
  await expect(dashboard).toBeVisible();
  await expect(page.locator('#kqJourneyDashboardBtn')).toHaveCount(0);
  const originTop = await dashboard.evaluate(element => element.getBoundingClientRect().top);
  const scrollY = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new Event('scroll'));
    return window.scrollY;
  });
  expect(scrollY).toBeGreaterThan(4);
  await expect(dashboard).toHaveClass(/kq-floating-dashboard/);
  const floatingTop = await dashboard.evaluate(element => element.getBoundingClientRect().top);
  expect(Math.abs(floatingTop - originTop)).toBeLessThanOrEqual(1);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(dashboard).not.toHaveClass(/kq-floating-dashboard/);
});
