# AI Agent Guidelines for Kaishi Quest

Welcome! When making changes to this codebase, follow these rules to maintain stability:

## 1. Version Bumping & Releases
- **Never edit version numbers across files by hand.**
- Use the automated bump tool:
  ```bash
  node scripts/bump.js <version> "Release title" "Change description"
  ```
  Or to bump, test, commit and push in one step:
  ```bash
  node scripts/bump.js <version> "Release title" "Change description" --commit --push
  ```

## 2. Testing Before Committing
- Always run the test suite before submitting any change:
  ```bash
  node scripts/test.js
  ```
  This validates:
  - All JSON files
  - JavaScript syntax across all files
  - In-order browser execution simulation
  - Global variable definitions and bridge availability

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
