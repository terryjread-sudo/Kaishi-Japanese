export { launchTestActivity, TEST_ACTIVITY_IDS } from './domains/test-learner/activity-launcher';
export { createVersionedRepository } from './platform/storage';
export { CONTENT_DATA_FILES, OFFLINE_CORE_FILES } from './platform/content-manifest';
export { addRestorePoint, findRestorePoint, RESTORE_POINT_LIMIT } from './domains/progress/restore-points';
export { offlinePackStatus } from './domains/offline/offline-pack';
export { createEchoRun, reinforcedProductionStrength, retryWords } from './domains/kotoba-echo/run';
import { findLessonStoryScene, selectLessonStoryScene } from './domains/lesson-stories/story-scenes';
import {
  buildJourneyCurriculum,
  CONNECTOR_STEPS,
  connectorForLesson,
  isJourneyRouteCurrent,
  JOURNEY_CURRICULUM_REVISION,
  lessonForIndex,
  resolveJourneyVocabulary,
  validateJourneyCurriculum,
} from './domains/curriculum/journey-curriculum';

export {
  buildJourneyCurriculum,
  CONNECTOR_STEPS,
  connectorForLesson,
  isJourneyRouteCurrent,
  JOURNEY_CURRICULUM_REVISION,
  findLessonStoryScene,
  lessonForIndex,
  resolveJourneyVocabulary,
  selectLessonStoryScene,
  validateJourneyCurriculum,
};

declare global {
  interface Window {
    KaishiActivityPolicy?: Record<string, unknown>;
    renderAdminTestMode?: () => void;
    updateHome?: () => void;
  }
}

// The classic lesson runtime consumes this existing compatibility policy while
// Journey execution is migrated into TypeScript modules.
window.KaishiActivityPolicy = {
  ...window.KaishiActivityPolicy,
  buildJourneyCurriculum,
  connectorSteps: CONNECTOR_STEPS,
  connectorForLesson,
  curriculumRevision: JOURNEY_CURRICULUM_REVISION,
  isJourneyRouteCurrent,
  findLessonStoryScene,
  lessonForIndex,
  resolveJourneyVocabulary,
  selectLessonStoryScene,
  validateJourneyCurriculum,
};

// app.js starts before this module. Refresh its derived Journey controls once
// the curriculum policy is available, rather than leaving a stale first render.
window.setTimeout(() => {
  window.renderAdminTestMode?.();
  window.updateHome?.();
}, 0);
