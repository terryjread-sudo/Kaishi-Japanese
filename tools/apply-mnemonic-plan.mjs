import fs from 'node:fs';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const write = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const plan = read('mnemonic-image-plan.json');
const scenes = read('memory-scenes.json');
const visual = read('visual-mnemonics.json');
const byKey = new Map(plan.cards.map(card => [card.key, card]));

for (const [key, scene] of Object.entries(scenes)) {
  const card = byKey.get(key);
  if (!card) continue;
  scene.soundMnemonic = card.soundMnemonic;
  scene.caption = card.story;
  scene.alt = `Mnemonic scene for ${card.word}, read ${card.reading}, meaning ${card.meaning}.`;
}

for (const [key, card] of Object.entries(visual)) {
  const planned = byKey.get(key);
  if (!planned) continue;
  card.soundMnemonic = planned.soundMnemonic;
  card.story = planned.story;
  card.status = 'approved';
  card.imageStatus = 'approved';
  card.reviewNote = 'Phonetic comic v5: pronunciation cue and meaning combined in one reviewed scene.';
  card.imageVersion = 5;
  card.approvedAt = '2026-07-30';
}

write('memory-scenes.json', scenes);
write('visual-mnemonics.json', visual);
console.log(`Updated ${Object.keys(scenes).length} legacy scenes and ${Object.keys(visual).length} visual mnemonics.`);
