#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'platform', 'content-manifest.ts');
const outputPath = path.join(root, 'content-manifest.generated.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const dataMatch = transpiled.match(/CONTENT_DATA_FILES\s*=\s*(\[[\s\S]*?\]);/);
const coreMatch = transpiled.match(/OFFLINE_CORE_FILES\s*=\s*(\[[\s\S]*?\]);/);
if (!dataMatch || !coreMatch) throw new Error('Could not read the typed content manifest.');

const evaluateArray = (expression) => Function('CONTENT_DATA_FILES', `return ${expression}`)(dataFiles);
const dataFiles = Function(`return ${dataMatch[1]}`)();
const coreFiles = evaluateArray(coreMatch[1]);
const output = `'use strict';\n/* Generated from src/platform/content-manifest.ts. Do not edit directly. */\n(function(root){\n  root.KaishiContentManifest=Object.freeze(${JSON.stringify({ dataFiles, coreFiles }, null, 2)});\n})(typeof self!=='undefined'?self:window);\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== output) {
    throw new Error('content-manifest.generated.js is stale. Run npm run generate:manifest.');
  }
  console.log('Generated content manifest is current.');
  process.exit(0);
}

fs.writeFileSync(outputPath, output);
console.log(`Generated ${path.relative(root, outputPath)} (${coreFiles.length} core files).`);
