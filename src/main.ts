export { launchTestActivity, TEST_ACTIVITY_IDS } from './domains/test-learner/activity-launcher';
export { createVersionedRepository } from './platform/storage';
export { CONTENT_DATA_FILES, OFFLINE_CORE_FILES } from './platform/content-manifest';
export { addRestorePoint, findRestorePoint, RESTORE_POINT_LIMIT } from './domains/progress/restore-points';
export { offlinePackStatus } from './domains/offline/offline-pack';
export { createEchoRun, reinforcedProductionStrength, retryWords } from './domains/kotoba-echo/run';
import { findLessonStoryScene, selectLessonStoryScene } from './domains/lesson-stories/story-scenes';

export { findLessonStoryScene, selectLessonStoryScene };

declare global {
  interface Window {
    KaishiActivityPolicy?: Record<string, unknown>;
  }
}

// The classic lesson runtime consumes this existing compatibility policy while
// Journey execution is migrated into TypeScript modules.
window.KaishiActivityPolicy = {
  ...window.KaishiActivityPolicy,
  findLessonStoryScene,
  selectLessonStoryScene,
};
