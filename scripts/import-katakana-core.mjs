#!/usr/bin/env node
/**
 * Imports a curated frequency tier from Katakana Kore 10k and audits the
 * preferred display form for the existing vocabulary catalogue.
 *
 * Usage:
 *   node scripts/import-katakana-core.mjs <deck.apkg> <JMdict_e.gz>
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const [deckPath, jmdictPath] = process.argv.slice(2);
if (!deckPath || !jmdictPath) {
  console.error('Usage: node scripts/import-katakana-core.mjs <deck.apkg> <JMdict_e.gz>');
  process.exit(1);
}

function extractedCollectionPath(input) {
  if (!input.endsWith('.apkg')) return input;
  const destination = fs.mkdtempSync(path.join(root, 'tmp', 'katakana-apkg-'));
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force', input, destination], { stdio: 'inherit' });
  } else {
    execFileSync('unzip', ['-qq', input, '-d', destination], { stdio: 'inherit' });
  }
  const collection = path.join(destination, 'collection.anki2');
  if (!fs.existsSync(collection)) throw new Error('The Anki package does not contain collection.anki2.');
  return collection;
}

const deckDb = new DatabaseSync(extractedCollectionPath(deckPath), { readOnly: true });
const existing = JSON.parse(fs.readFileSync(path.join(root, 'data/vocabulary.json'), 'utf8'));
const existingWords = new Set(existing.map(item => item.word));

function decodeFields(value) {
  const [word = '', meaning = '', frequency = ''] = String(value).split('\x1f');
  return { word: word.trim(), meaning: meaning.trim(), frequency: Number(frequency) || Number.MAX_SAFE_INTEGER };
}

const sourceRows = deckDb.prepare('SELECT flds FROM notes').all()
  .map(row => decodeFields(row.flds))
  .filter(row => row.word && row.meaning)
  .sort((a, b) => a.frequency - b.frequency || a.word.localeCompare(b.word, 'ja'));
deckDb.close();

const imported = sourceRows.filter(row => !existingWords.has(row.word)).slice(0, 100);
if (imported.length !== 100) throw new Error(`Expected 100 new katakana words, found ${imported.length}`);

function textOf(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g'))].map(match => match[1]);
}

function priorityScore(block) {
  const values = textOf(block, 'ke_pri').concat(textOf(block, 're_pri'));
  return values.reduce((score, value) => {
    if (/^(news|ichi|spec|gai)1$/.test(value)) return score + 100;
    if (/^(news|ichi|spec|gai)2$/.test(value)) return score + 60;
    if (/^nf\d\d$/.test(value)) return score + (50 - Number(value.slice(2)) / 2);
    return score;
  }, 0);
}

const xml = zlib.gunzipSync(fs.readFileSync(jmdictPath)).toString('utf8');
const candidatesByForm = new Map();
for (const entryMatch of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  const entry = entryMatch[1];
  const entryId = textOf(entry, 'ent_seq')[0] || '';
  const kanaOnly = /&uk;/.test(entry);
  for (const block of entry.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)) {
    for (const form of textOf(block[1], 'keb')) {
      const list = candidatesByForm.get(form) || [];
      list.push({ entryId, form, score: priorityScore(block[1]), kanaOnly });
      candidatesByForm.set(form, list);
    }
  }
  for (const block of entry.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)) {
    for (const form of textOf(block[1], 'reb')) {
      const list = candidatesByForm.get(form) || [];
      list.push({ entryId, form, score: priorityScore(block[1]), kanaOnly: kanaOnly || /<re_nokanji\/>/.test(block[1]) });
      candidatesByForm.set(form, list);
    }
  }
}

function classifyScript(form) {
  if (/^[\p{Script=Hiragana}ー]+$/u.test(form)) return 'hiragana';
  if (/^[\p{Script=Katakana}ー・]+$/u.test(form)) return 'katakana';
  if (/\p{Script=Han}/u.test(form)) return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(form) ? 'mixed' : 'kanji';
  return 'mixed';
}

function authorityFor(item, source = 'JMdict') {
  const candidates = candidatesByForm.get(item.word) || candidatesByForm.get(item.reading) || [];
  const best = [...candidates].sort((a, b) => b.score - a.score)[0];
  const preferredForm = best?.kanaOnly && item.reading ? item.reading : item.word;
  return {
    preferredForm,
    script: classifyScript(preferredForm),
    alternateForms: preferredForm === item.word || !item.reading ? [] : [item.word],
    source,
    jmdictEntryId: best?.entryId || null,
    confidence: best?.score > 0 ? 'high' : 'review',
    status: 'review',
    rationale: best?.kanaOnly ? 'JMdict marks this term as usually written in kana alone.' : best ? 'JMdict supplies this written form.' : 'No JMdict form was matched automatically; retain the curated source form.'
  };
}

const authority = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: [
    { id: 'jmdict', label: 'JMdict', url: 'https://www.edrdg.org/jmdict/j_jmdict.html' },
    { id: 'katakana-kore-10k', label: 'Katakana Kore 10k - Frequency sorted', sharedDeckId: '1723626457' }
  ],
  entries: Object.fromEntries(existing.map(item => [item.id, authorityFor(item)]))
};

const content = {
  schemaVersion: 1,
  source: { name: 'Katakana Kore 10k - Frequency sorted', sharedDeckId: '1723626457', importedTier: 100 },
  records: imported.map((item, index) => {
    const id = `katakana-core-${item.frequency}-${item.word}`;
    const orthography = { ...authorityFor({ word: item.word, reading: item.word }, 'Katakana Kore 10k'), preferredForm: item.word, script: 'katakana', confidence: 'high', status: 'approved', rationale: 'The curated frequency deck identifies this as a commonly used katakana loanword.' };
    authority.entries[id] = orthography;
    return {
      id,
      word: item.word,
      reading: item.word,
      meaning: item.meaning,
      frequency: item.frequency,
      order: index + 1,
      topicId: 'katakana-essentials',
      defaultMnemonic: `Picture a vivid real-world moment that clearly means “${item.meaning}”. Notice the katakana shape ${item.word}, then say ${item.word} in one smooth rhythm.`,
      orthography,
      visualBrief: {
        status: 'briefed',
        pack: 'katakana-core-01',
        sceneGoal: `A cinematic Kaishi memory moment that makes “${item.meaning}” unmistakable without text.`
      }
    };
  })
};

fs.writeFileSync(path.join(root, 'data/katakana-core-10k.json'), `${JSON.stringify(content, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'data/vocabulary-orthography.json'), `${JSON.stringify(authority, null, 2)}\n`);
console.log(`Imported ${content.records.length} katakana words and audited ${Object.keys(authority.entries).length} vocabulary forms.`);
