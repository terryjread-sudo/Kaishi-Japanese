import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planPath = path.join(root, 'mnemonic-image-plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const installed = new Set(process.argv.slice(2).map(Number));

for (const card of plan.cards) {
  if (installed.has(card.number)) card.status = 'installed';
}

fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
console.log(`Marked ${installed.size} images installed.`);
