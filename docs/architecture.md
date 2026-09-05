# Kaishi Japanese Architecture

## Direction

Kaishi Japanese is migrating from ordered classic scripts to strict TypeScript ES modules. The migration is staged so the existing static PWA remains usable while behavior moves behind explicit, tested contracts.

## Ownership

- `src/domains/` owns learner-facing behavior and domain rules. A domain must not access storage or browser globals directly.
- `src/platform/` owns browser APIs, persistence, content manifests, networking, and service-worker integration.
- `src/core/` owns application bootstrapping, routing, diagnostics, and shared event contracts.
- Root JavaScript files are legacy runtime code. Fix regressions there when necessary, but place reusable new behavior in `src/` and expose only the smallest compatibility bridge.
- `content-manifest.generated.js` is generated from `src/platform/content-manifest.ts` and is the shared manifest for classic scripts and the service worker.

## Safe Feature Workflow

1. Identify the owning domain and define its inputs, outputs, and failure states as TypeScript types.
2. Implement domain behavior without DOM, storage, or global dependencies.
3. Add a platform or UI adapter for browser behavior.
4. Add unit tests for domain rules and a browser test for critical user journeys.
5. Run `npm run check` before committing.
6. Open and merge a pull request. Version files are changed only by the post-merge GitHub Action.

## Migration Order

The first migrated boundary is test-learner activity launching. Next are restore-point persistence, offline-pack state, profile persistence, and journey routing. Historical patch files should be removed only after their behavior has regression coverage in the owning module.

## Compatibility Rules

- Existing learner progress must remain readable throughout migration.
- Persisted structures require a schema version, runtime validation, and an explicit migration for incompatible changes.
- New modules may call legacy code only through a named port or compatibility bridge.
- New global variables, direct storage access outside `src/platform/`, and duplicated asset lists are CI violations.
