#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ? ${message}`);
    passed++;
  } else {
    console.error(`  ? FAIL: ${message}`);
    failed++;
  }
}

console.log('=== Running Kaishi Quest Smoke & Integrity Tests ===\n');

// 1. JSON Files Validation
console.log('1. Validating JSON files...');
const jsonFiles = [
  'version.json',
  'manifest.webmanifest',
  'data/vocabulary.json',
  'data/kana.json',
  'data/manga-stories.json',
  'data/conversations.json',
  'data/theatre-scenes.json',
  'data/grammar-path.json',
  'data/kanji-components.json'
];

for (const rel of jsonFiles) {
  const file = path.join(rootDir, rel);
  if (fs.existsSync(file)) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
      assert(true, `${rel} is valid JSON`);
    } catch (e) {
      assert(false, `${rel} JSON parse error: ${e.message}`);
    }
  }
}

// 2. Syntax Check for JS Files
console.log('\n2. Syntax checking JS files...');
const jsFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.js'));
for (const f of jsFiles) {
  try {
    execSync(`node -c "${path.join(rootDir, f)}"`, { stdio: 'pipe' });
    assert(true, `${f} passed syntax check`);
  } catch (e) {
    assert(false, `${f} syntax error: ${e.message}`);
  }
}

// 3. Version Consistency Check
console.log('\n3. Checking version consistency across files...');
const versionJs = fs.readFileSync(path.join(rootDir, 'version.js'), 'utf8');
const versionJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'version.json'), 'utf8'));
const swJs = fs.readFileSync(path.join(rootDir, 'service-worker.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const vJsMatch = versionJs.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const vSwMatch = swJs.match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
const vBadgeMatch = indexHtml.match(/class="version-badge"[^>]*>v([^<]+)</);

const expectedVersion = versionJson.version;
assert(Boolean(vJsMatch && vJsMatch[1] === expectedVersion), `version.js APP_VERSION (${vJsMatch?.[1]}) matches version.json (${expectedVersion})`);
assert(Boolean(vSwMatch && vSwMatch[1] === expectedVersion), `service-worker.js VERSION (${vSwMatch?.[1]}) matches version.json (${expectedVersion})`);
assert(Boolean(vBadgeMatch && vBadgeMatch[1] === expectedVersion), `index.html version badge (${vBadgeMatch?.[1]}) matches version.json (${expectedVersion})`);

// 4. Sequential Browser Execution Simulation
console.log('\n4. Simulating in-order browser script execution...');
try {
  const makeEl = () => ({
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => '',
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    dataset: {},
    style: {}
  });

  const ctx = vm.createContext({
    window: {},
    document: {
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      getElementById: () => makeEl(),
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeEl(),
      head: { appendChild: () => {} },
      body: makeEl(),
      documentElement: makeEl()
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: {},
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
    URL: URL,
    location: { href: 'http://localhost', reload: () => {} },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ records: [], entries: [], stories: [], conversations: [], scenes: [], lessons: [] }), text: () => Promise.resolve('') }),
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    MutationObserver: class { observe() {} disconnect() {} },
    addEventListener: () => {},
    removeEventListener: () => {}
  });
  ctx.window = ctx;

  const scriptOrder = [
    'version.js',
    'app.js',
    'japan-ready.js',
    'vms.js',
    'supabase-config.js',
    'cloud.js',
    'reporting.js'
  ];

  for (const s of scriptOrder) {
    const code = fs.readFileSync(path.join(rootDir, s), 'utf8');
    vm.runInContext(code, ctx);
  }

  // app.js (and the rest of the app) declares its top-level bindings with
  // const/let, matching how real classic <script> tags share one global
  // scope in a browser. Those bindings are correctly visible to code
  // evaluated inside this vm context, but — same as in a real browser —
  // they do NOT become enumerable properties of the context/global object,
  // so `ctx.$` is always undefined even when $ works perfectly fine.
  // Query them as live expressions in the context instead of as properties.
  assert(Boolean(ctx.APP_VERSION === expectedVersion), `Global APP_VERSION is defined as ${expectedVersion}`);
  assert(vm.runInContext('typeof $', ctx) === 'function', 'Global $ selector is defined');
  assert(Boolean(ctx.window.KaishiJapanReadyBridge), 'window.KaishiJapanReadyBridge is attached');
  assert(Boolean(ctx.window.KaishiQuestCloudAdapter), 'window.KaishiQuestCloudAdapter is attached');
  assert(vm.runInContext('typeof isAdminTestMode', ctx) === 'function', 'isAdminTestMode is available');
  assert(true, 'All core scripts loaded in sequence without unhandled exceptions');
} catch (err) {
  assert(false, `Script execution simulation failed: ${err.stack || err.message}`);
}

console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('? All checks passed successfully!\n');
}
