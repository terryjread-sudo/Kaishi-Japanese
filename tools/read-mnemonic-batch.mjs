import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'mnemonic-image-plan.json'), 'utf8'));
const start = Number(process.argv[2] || 1);
const count = Number(process.argv[3] || 4);
const skipped = new Set(process.argv.slice(4).map(Number));
const cards = plan.cards
  .filter(card => card.number >= start && card.status !== 'installed' && !skipped.has(card.number))
  .slice(0, count);

process.stdout.write(Buffer.from(JSON.stringify(cards), 'utf8').toString('base64'));
