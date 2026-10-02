import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const vocabulary = JSON.parse(await readFile(resolve(root, 'data/vocabulary.json'), 'utf8'));
const curriculumSource = await readFile(resolve(root, 'src/domains/curriculum/journey-curriculum.ts'), 'utf8');
const foundationSource = curriculumSource.match(/SPOKEN_FIRST_FOUNDATION[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? '';
const lessonIds = [...foundationSource.matchAll(/\[([^\]]+)\]/g)]
  .map((match) => [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]))
  .filter((ids) => ids.length === 3);
const byId = new Map(vocabulary.map((word) => [word.id, word]));

const arcs = [
  ['respond and share basic information', 'meeting someone for the first time'],
  ['talk about places and time', 'making a simple plan with a friend'],
  ['describe everyday actions', 'talking about an ordinary day'],
  ['make requests and talk about food', 'ordering or asking for something politely'],
  ['describe people and things', 'helping someone identify the right person or object'],
  ['keep an everyday conversation going', 'having a short friendly conversation'],
  ['talk about movement and direction', 'finding a place and explaining where to go'],
  ['use time, numbers, and nature words', 'understanding practical details around you'],
  ['expand a useful conversation', 'adding detail to something you already understand'],
  ['combine foundation Japanese independently', 'handling a complete beginner-level exchange'],
];

const tidy = (value) => String(value ?? '').trim();
const sentenceFor = (word) => tidy(word.sentence) || tidy(word.word);
const meaningFor = (word) => tidy(word.sentenceMeaning) || tidy(word.meaning);
const tilesFor = (sentence) => {
  try {
    return [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(sentence)]
      .map((part) => part.segment.trim()).filter((part) => part && !/^[。、！？!?]$/.test(part));
  } catch {
    return [...sentence].filter((part) => !/[\s。、！？!?]/.test(part));
  }
};

const lessons = lessonIds.slice(0, 100).map((ids, index) => {
  const lesson = index + 1;
  const words = ids.map((id) => byId.get(id));
  if (words.some((word) => !word)) throw new Error(`Lesson ${lesson} references missing vocabulary.`);
  const arc = arcs[Math.min(9, Math.floor(index / 10))];
  const openingWord = words[index % words.length];
  const transferWord = words[(index + 1) % words.length];
  const distractors = words.filter((word) => word.id !== openingWord.id).map(meaningFor);
  const band = lesson <= 10 ? 'choice' : lesson <= 30 ? 'tiles' : lesson <= 60 ? 'tiles-or-type' : 'type-or-tiles';
  return {
    lesson,
    canDo: `I can ${arc[0]} using ${words.map((word) => word.word).join('、')}.`,
    situation: `${arc[1][0].toUpperCase()}${arc[1].slice(1)}.`,
    targetWordIds: ids,
    opening: {
      wordId: openingWord.id,
      prompt: lesson === 1
        ? 'Listen for the reply you learned. Which conversation matches it?'
        : 'Listen once. Which meaning best matches what you heard?',
      choices: [meaningFor(openingWord), ...distractors],
      answer: meaningFor(openingWord),
      explanation: lesson === 1
        ? 'The reply はい is the polite ‘yes.’ You do not need every word yet: 山田さんですか means ‘Are you Yamada-san?’'
        : `The key expression is ${openingWord.word} (${openingWord.reading}): ${openingWord.meaning}.`,
    },
    production: {
      mode: band,
      prompt: `Build or say the model response for: ${meaningFor(openingWord)}`,
      model: sentenceFor(openingWord),
      reading: tidy(openingWord.sentenceFurigana) || tidy(openingWord.reading),
      meaning: meaningFor(openingWord),
      acceptable: [sentenceFor(openingWord)],
      tiles: tilesFor(sentenceFor(openingWord)),
    },
    transfer: {
      mode: band,
      wordId: transferWord.id,
      prompt: `Now use the same skill in a new situation: ${meaningFor(transferWord)}`,
      model: sentenceFor(transferWord),
      reading: tidy(transferWord.sentenceFurigana) || tidy(transferWord.reading),
      meaning: meaningFor(transferWord),
      acceptable: [sentenceFor(transferWord)],
      tiles: tilesFor(sentenceFor(transferWord)),
    },
  };
});

if (lessons.length !== 100) throw new Error(`Expected 100 lessons, found ${lessons.length}.`);
const output = `${JSON.stringify({ schemaVersion: 1, lessons }, null, 2)}\n`;
const target = resolve(root, 'data/lesson-outcomes.json');
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  // Git may check this generated JSON out with CRLF on Windows while the
  // generator consistently emits LF. Compare content, not checkout style.
  if (current.replace(/\r\n/g, '\n') !== output) {
    console.error('data/lesson-outcomes.json is out of date. Run npm run generate:outcomes.');
    process.exitCode = 1;
  }
} else {
  await writeFile(target, output, 'utf8');
  console.log(`Generated ${lessons.length} communicative lesson outcomes.`);
}
