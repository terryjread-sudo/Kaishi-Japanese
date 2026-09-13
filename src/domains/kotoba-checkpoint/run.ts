import { checkpointLevel } from './content';
import type { CheckpointCase, CheckpointLearnerWord, CheckpointRun, Verdict } from './types';

const KANA = ['あい','いえ','うみ','えき','おか','かさ','きく','くも','けし','こえ','さけ','しお','すし','せき','そら'];
const NAMES = ['Aiko Tanaka', 'Ren Sato', 'Mio Kato', 'Haru Mori', 'Sora Ito'];
const PORTRAITS = ['aiko', 'ren', 'mio', 'haru', 'sora'];
const YEARS = ['1998', '2001', '1995', '2003', '1999'];
const PURPOSES = [
  { japanese: 'りょこうしたいです', romaji: 'ryokou shitai desu', english: 'I want to travel.' },
  { japanese: 'にほんごをべんきょうしたいです', romaji: 'nihongo o benkyou shitai desu', english: 'I want to study Japanese.' },
];

const doc = (label: string, japanese: string, english: string, romaji = japanese): CheckpointCase['passport'] => ({ label, japanese, romaji, english });

function caseFor(levelId: number, index: number, learnerWords: CheckpointLearnerWord[]): CheckpointCase {
  const level = checkpointLevel(levelId);
  const traveller = NAMES[index % NAMES.length]!;
  const portrait = PORTRAITS[index % PORTRAITS.length]!;
  const kana = KANA[(levelId * 2 + index) % KANA.length]!;
  const mismatch = (index + levelId) % 3 === 1;
  const year = YEARS[index % YEARS.length]!;
  const wrongYear = YEARS[(index + 1) % YEARS.length]!;
  const word = learnerWords[index % Math.max(learnerWords.length, 1)];
  const purpose = PURPOSES[index % PURPOSES.length]!;
  const incorrectPurpose = purpose.japanese.replace('したい', 'します');
  const identity = { nationality: 'JPN', birthDate: `${year}-0${(index % 8) + 1}-1${index}`, sex: index % 2 === 0 ? 'F' as const : 'M' as const, passportNumber: `TR${levelId}${String(index + 1).padStart(7, '0')}`, expires: `203${(index % 5) + 1}-11-30` };
  let passport = doc('PASSPORT · 旅券', kana, `Name: ${kana}`);
  let entry = doc('ENTRY FORM · 入国カード', mismatch ? `${kana}あ` : kana, `Name: ${mismatch ? `${kana}あ` : kana}`);
  const expected: Verdict = mismatch ? 'deny' : 'approve';
  let ruleId = 'kana-match';
  let explanation = expected === 'approve' ? 'The hiragana name matches on both documents.' : 'The hiragana name differs. DENY this record.';
  let question: CheckpointCase['question'];
  const practiceIds: string[] = [];

  if (levelId === 3) {
    passport = doc('PASSPORT · 生年', year, `Birth year: ${year}`);
    entry = doc('VISA · 生年', mismatch ? wrongYear : year, `Birth year: ${mismatch ? wrongYear : year}`);
    ruleId = 'birth-year'; explanation = expected === 'approve' ? 'Both documents show the same birth year.' : 'The birth years conflict.';
  } else if (levelId === 4 || levelId === 8) {
    const age = ['にじゅう', 'にじゅうに', 'にじゅうよん'][index % 3]!;
    const wrongAge = ['にじゅういち', 'にじゅうさん', 'にじゅうご'][index % 3]!;
    passport = doc('PASSPORT · NAME', kana, `Name: ${kana}`);
    entry = doc('VISA · 年齢', mismatch ? wrongAge : age, `Age: ${mismatch ? wrongAge : age}`);
    question = { japanese: 'なんさいですか？', romaji: 'nan sai desu ka?', english: 'How old are you?', answer: age };
    ruleId = 'audio-age'; explanation = expected === 'approve' ? 'The spoken age agrees with the visa.' : 'The spoken age and visa differ.';
  } else if (levelId === 5 && word) {
    passport = doc('TRAVEL PURPOSE · 目的', word.word, word.meaning, word.reading);
    entry = doc('ENTRY FORM · 目的', mismatch ? word.reading : word.word, mismatch ? `${word.meaning} (reading used instead)` : word.meaning, word.reading);
    ruleId = 'taught-vocabulary'; practiceIds.push(word.id); explanation = expected === 'approve' ? 'The taught Japanese word matches exactly.' : 'The entry form uses the reading, not the Japanese word.';
  } else if (levelId === 6) {
    passport = doc('NAME · 漢字', '京子', 'Name: Kyoko', 'きょうこ');
    entry = doc('FURIGANA · よみ', mismatch ? 'きゅうこ' : 'きょうこ', mismatch ? 'kyuuko' : 'kyouko');
    ruleId = 'furigana'; explanation = expected === 'approve' ? 'きょうこ is the listed reading.' : 'きゅうこ is a different reading.';
  } else if (levelId >= 7) {
    passport = doc('VISIT · 訪問', purpose.japanese, purpose.english, purpose.romaji);
    entry = doc('ENTRY FORM · 目的', mismatch ? incorrectPurpose : purpose.japanese, mismatch ? 'Incorrect desire form' : purpose.english, mismatch ? purpose.romaji.replace('shitai', 'shimasu') : purpose.romaji);
    ruleId = 'tai-form'; explanation = expected === 'approve' ? 'The purpose correctly uses 〜たいです.' : 'The purpose should use 〜たいです to express “want to”.';
  }
  return { id: `${levelId}-${index}`, traveller, portrait, city: level.location, identity, passport, entry, question, ruleId, expected, explanation, practiceIds };
}

export function createCheckpointRun(levelId = 1, learnerWords: CheckpointLearnerWord[] = [], credits = 0, completedLevels: number[] = []): CheckpointRun {
  const level = checkpointLevel(levelId);
  return { version: 2, level: level.id, index: 0, cases: Array.from({ length: level.travellers }, (_, index) => caseFor(level.id, index, learnerWords)), correct: 0, mistakes: [], paused: false, remaining: level.seconds, phase: 'briefing', credits, completedLevels };
}

export function judgeCheckpoint(run: CheckpointRun, verdict: Verdict): CheckpointRun {
  const active = run.cases[run.index];
  if (!active || run.phase !== 'inspect') return run;
  const correct = active.expected === verdict;
  return { ...run, correct: run.correct + (correct ? 1 : 0), mistakes: correct ? run.mistakes : [...run.mistakes, active.id], phase: 'feedback' };
}

export function advanceCheckpoint(run: CheckpointRun): CheckpointRun {
  if (run.phase !== 'feedback') return run;
  if (run.index + 1 < run.cases.length) return { ...run, index: run.index + 1, phase: 'inspect' };
  const passed = run.correct >= Math.ceil(run.cases.length * 0.6);
  return { ...run, phase: passed ? 'report' : 'failed', credits: passed ? run.credits + (run.correct * 4) + 8 : run.credits + run.correct };
}

export function checkpointPassed(run: CheckpointRun): boolean { return run.phase === 'report'; }
