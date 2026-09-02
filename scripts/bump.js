#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')));

const newVersion = args[0];
const title = args[1] || 'Maintenance update and bug fixes';
const changes = args.slice(2);

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Usage: node scripts/bump.js <version> [title] [changes...] [--commit] [--push]');
  console.error('Example: node scripts/bump.js 11.25.31 "Fix audio sync and storage" "Fixed audio playback" --commit --push');
  process.exit(1);
}

// 1. Read current version from version.json
const versionJsonPath = path.join(rootDir, 'version.json');
const currentVersionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
const oldVersion = currentVersionJson.version;

console.log(`Bumping version from v${oldVersion} to v${newVersion}...`);

// 2. Update version.js
const versionJsPath = path.join(rootDir, 'version.js');
let versionJs = fs.readFileSync(versionJsPath, 'utf8');
versionJs = versionJs.replace(
  /\/\* Kaishi Quest [^*]+ \*\//,
  `/* Kaishi Quest ${newVersion} — single source of truth for application version. */`
);
versionJs = versionJs.replace(
  /var APP_VERSION = '[^']+';/,
  `var APP_VERSION = '${newVersion}';`
);
fs.writeFileSync(versionJsPath, versionJs, 'utf8');
console.log('? Updated version.js');

// 3. Update service-worker.js
const swJsPath = path.join(rootDir, 'service-worker.js');
let swJs = fs.readFileSync(swJsPath, 'utf8');
swJs = swJs.replace(
  /\/\* Kaishi Quest Service Worker — [^*]+ \*\//,
  `/* Kaishi Quest Service Worker — ${newVersion}. */`
);
swJs = swJs.replace(
  /var VERSION = '[^']+';/,
  `var VERSION = '${newVersion}';`
);
fs.writeFileSync(swJsPath, swJs, 'utf8');
console.log('? Updated service-worker.js');

// 4. Update version.json
const now = new Date().toISOString().slice(0, 10);
const updatedVersionJson = {
  version: newVersion,
  released: now,
  title: title,
  changes: changes.length ? changes : [title]
};
fs.writeFileSync(versionJsonPath, JSON.stringify(updatedVersionJson, null, 2) + '\n', 'utf8');
console.log('? Updated version.json');

// 5. Update index.html
const indexHtmlPath = path.join(rootDir, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
indexHtml = indexHtml.replaceAll(oldVersion, newVersion);
// The replaceAll above only catches cache-busters that already contained
// oldVersion. It does NOT fix the visible version badge if that text has
// ever drifted out of sync with version.json (which it had — the badge
// was stuck on a stale version for a long time). Update the badge directly
// by targeting its element, regardless of what version string it currently
// shows or what attributes surround it.
const badgePattern = /(<span id="versionBadge"[^>]*>)v[^<]*(<)/;
if (badgePattern.test(indexHtml)) {
  indexHtml = indexHtml.replace(badgePattern, `$1v${newVersion}$2`);
} else {
  console.warn('??  Could not find #versionBadge element in index.html to update.');
}
const badgeAriaLabelPattern = /(aria-label="Kaishi Quest version )\d+\.\d+\.\d+(\. Check for updates)/;
if (badgeAriaLabelPattern.test(indexHtml)) {
  indexHtml = indexHtml.replace(badgeAriaLabelPattern, `$1${newVersion}$2`);
}
fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
console.log('? Updated index.html cache-busters and version badge');

// 6. Create README release notes file
const readmePath = path.join(rootDir, `README-${newVersion}.txt`);
const readmeContent = `Kaishi Quest ${newVersion}\n\n${title}\n\nChanges:\n${(changes.length ? changes : [title]).map(c => `- ${c}`).join('\n')}\n`;
fs.writeFileSync(readmePath, readmeContent, 'utf8');
console.log(`? Created README-${newVersion}.txt`);

// 7. Run smoke tests
console.log('\nRunning validation test suite...');
try {
  execSync('node scripts/test.js', { stdio: 'inherit', cwd: rootDir });
} catch (err) {
  console.error('? Validation failed! Reverting changes is recommended.');
  process.exit(1);
}

// 8. Optional git commit / push
if (flags.has('--commit') || flags.has('--push')) {
  console.log('\nStaging and committing files...');
  execSync(`git add version.js service-worker.js version.json index.html README-${newVersion}.txt app.js`, { stdio: 'inherit', cwd: rootDir });
  execSync(`git commit -m "${newVersion}"`, { stdio: 'inherit', cwd: rootDir });
  console.log(`? Committed ${newVersion}`);

  if (flags.has('--push')) {
    console.log('Pushing to origin main...');
    execSync('git push origin main', { stdio: 'inherit', cwd: rootDir });
    console.log(`? Successfully released and pushed v${newVersion}!`);
  }
}
