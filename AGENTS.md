# AI Agent Guidelines for Kaishi Quest

Welcome! When making changes to this codebase, follow these rules to maintain stability:

## 1. Version Bumping & Releases
- **Never edit version numbers across files by hand.**
- GitHub Actions bumps the version after a pull request merges to `main`.
- Feature pull requests must not include version-only changes.

## 2. Testing Before Committing
- Always run the test suite before submitting any change:
  ```bash
  npm run check
  ```
  This validates:
  - Legacy JSON, syntax, script-order, and bridge checks
  - TypeScript type checking and ESLint boundaries
  - Vitest domain and platform tests
  - A complete Vite production build

## 3. Global Scope & Script Loading Rules
- **Never declare `const APP_VERSION` or `let APP_VERSION`**. `APP_VERSION` is defined globally once in `version.js` using `var`.
- **Wrap auxiliary scripts in IIFEs**:
  ```javascript
  'use strict';
  (() => {
    // Isolated script logic
  })();
  ```
- **Guard DOM event listeners against null elements**:
  ```javascript
  const el = $('#someElement');
  if (el) el.onclick = handler;
  ```
- Core global exports on `window`:
  - `window.$`: Query selector helper
  - `window.APP_VERSION`: Current semantic version
  - `window.isAdminTestMode`: Admin test mode predicate
  - `window.KaishiQuestCloudAdapter`: Sync and profile adapter
  - `window.KaishiJapanReadyBridge`: Japan Ready campaign bridge

## 4. New Code
- Put new application code under `src/` and use TypeScript ES modules.
- Organize code by `domains/`, `platform/`, and `core/`; do not add new root-level feature scripts.
- Access browser storage through `src/platform/storage.ts` and validate persisted data with schemas.
- Do not add new `window.*` globals. Extend an existing compatibility bridge only while migrating legacy code.
- Edit `src/platform/content-manifest.ts`, then run `npm run generate:manifest`; never edit `content-manifest.generated.js` directly.
- See `docs/architecture.md` for ownership, migration order, and feature workflow.
