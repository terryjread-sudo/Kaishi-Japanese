import type { CheckpointLevel } from './types';

export const CHECKPOINT_LEVELS: CheckpointLevel[] = [
  { id: 1, title: 'Kana arrivals', location: 'Tokyo Haneda · Arrival Hall A', skill: 'kana', rule: 'DENY if the hiragana name is different on the two documents.', guidance: 'Look at one character at a time. The first shift is gentle and has full support.', aid: 'full', seconds: 210, travellers: 3 },
  { id: 2, title: 'Kana expansion', location: 'Osaka Kansai · International Gate', skill: 'kana', rule: 'DENY when even one hiragana character does not match.', guidance: 'The same rule stays active. A near-match is still a mismatch.', aid: 'full', seconds: 195, travellers: 3 },
  { id: 3, title: 'Date desk', location: 'Sapporo New Chitose · North Terminal', skill: 'numbers', rule: 'DENY if the birth year is inconsistent.', guidance: 'Compare the number shown on both documents.', aid: 'full', seconds: 180, travellers: 4 },
  { id: 4, title: 'Audio window', location: 'Fukuoka Airport · Bay Gate', skill: 'listening', rule: 'Ask the traveller their age. DENY if their answer conflicts with the visa.', guidance: 'Use Hear answer as often as you need. Romaji stays on-screen for now.', aid: 'full', seconds: 170, travellers: 4 },
  { id: 5, title: 'Purpose of travel', location: 'Naha Airport · Island Arrivals', skill: 'vocabulary', rule: 'DENY if the stated purpose does not match the entry form.', guidance: 'The Japanese word, reading, and English meaning are all available in your handbook.', aid: 'romaji', seconds: 165, travellers: 4 },
  { id: 6, title: 'Reading precision', location: 'Nagoya Central · Transit Control', skill: 'reading', rule: 'DENY if the furigana reading does not match the name.', guidance: 'One mora can change the reading. Check each sound.', aid: 'romaji', seconds: 155, travellers: 4 },
  { id: 7, title: 'Plans and wishes', location: 'Kyoto Station · Visitor Lane', skill: 'grammar', rule: 'DENY if the purpose sentence uses the 〜たい form incorrectly.', guidance: 'Use the pinned rulebook before you stamp.', aid: 'romaji', seconds: 145, travellers: 5 },
  { id: 8, title: 'Natural answers', location: 'Sendai Airport · East Gate', skill: 'listening', rule: 'APPROVE valid natural answers, even when they are phrased differently.', guidance: 'Listen for meaning, not an exact visual copy.', aid: 'minimal', seconds: 140, travellers: 5 },
  { id: 9, title: 'Cross-check shift', location: 'Tokyo Station · Shinkansen Concourse', skill: 'compound', rule: 'Apply every active rule before you stamp.', guidance: 'Slow down. A careful inspector uses the rulebook.', aid: 'minimal', seconds: 135, travellers: 5 },
  { id: 10, title: 'Judgement call', location: 'Yokohama Port · International Ferry', skill: 'compound', rule: 'Use the written rule and the evidence. Honest mistakes and false records are not the same.', guidance: 'This is a difficult case, but every decision remains language-grounded.', aid: 'minimal', seconds: 130, travellers: 5 },
];

export function checkpointLevel(id: number): CheckpointLevel {
  return CHECKPOINT_LEVELS[Math.min(Math.max(id, 1), CHECKPOINT_LEVELS.length) - 1]!;
}
