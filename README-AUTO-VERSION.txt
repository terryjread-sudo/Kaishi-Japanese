Kakashi-Web automatic versioning

Added .github/workflows/auto-minor-version.yml.

Behaviour:
- Runs automatically after a push to main.
- Reads the current version from version.json.
- Automatically increments the MINOR component and resets PATCH to 0.
  Example: 11.25.35 -> 11.26.0
- Uses the repository's existing scripts/bump.js so version.js, version.json,
  service-worker.js, index.html and release notes remain consistent.
- Runs node scripts/test.js before committing the version update.
- Commits the generated version changes with [auto-version] so the workflow
  will not run again for its own version-only commit.
- Uses GitHub's built-in GITHUB_TOKEN; no personal access token is required.

Important:
The workflow intentionally performs a minor bump for every qualifying push to
main, as requested. If you later want bug fixes to use patch bumps, the workflow
can be changed to select the bump type from a pull-request label or commit type.
