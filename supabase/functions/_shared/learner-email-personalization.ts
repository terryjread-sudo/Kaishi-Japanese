export type EmailProgramKey = "reengagement" | "weekly_recap" | "monthly_sensei_letter" | "onboarding_nudge" | "activity_invite";

type ProgressRecord = { interval?: unknown; skills?: unknown; updatedAt?: unknown };
export type DailyWord = {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  sentence: string;
  sentenceMeaning: string;
  order?: number;
};
type VocabularyWord = Pick<DailyWord, "id" | "word">;

export type LearnerEmailSnapshot = {
  name: string;
  lesson: string | null;
  words: string[];
  masteredWords: number;
  rhythmDays: number;
  learningDaysThisWeek: number;
};

export type PersonalisedEmailContent = { subject: string; eyebrow: string; title: string; body: string; cta: string };

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asNumber = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const asIds = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];

function mastered(record: unknown): boolean {
  const item = asRecord(record) as ProgressRecord;
  const skills = asRecord(item.skills);
  return asNumber(item.interval) >= 21 && ["meaning", "listening", "reading"].every(skill => asNumber(asRecord(skills[skill]).strength) >= 0.65);
}

function lessonFromHistory(history: unknown): string | null {
  if (!Array.isArray(history)) return null;
  const latest = [...history].sort((left, right) => asNumber(asRecord(right).completedAt) - asNumber(asRecord(left).completedAt))[0];
  const title = String(asRecord(latest).title || "");
  const match = /lesson\s+(\d+)/i.exec(title);
  return match ? `Lesson ${match[1]}` : null;
}

function weeklyLearningDays(history: unknown, now: Date): number {
  const london = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const entries = asRecord(history), end = Date.UTC(Number(london.year), Number(london.month) - 1, Number(london.day));
  const seen = new Set<string>();
  Object.entries(entries).forEach(([date, value]) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isNaN(timestamp) && timestamp >= end - 6 * 86400000 && timestamp <= end && asRecord(value)) seen.add(date);
  });
  return seen.size;
}

export function buildLearnerEmailSnapshot(payload: unknown, name: string, vocabulary: readonly VocabularyWord[], now = new Date()): LearnerEmailSnapshot {
  const source = asRecord(payload), progress = asRecord(source.progress), meta = asRecord(source.meta);
  const route = asRecord(meta.dailyJourneyRoute), chapter = Number(route.chapter);
  const routeStep = Array.isArray(route.steps) ? route.steps.find(step => asRecord(step).id === `lesson-${chapter}`) : null;
  const history = Array.isArray(meta.sessionHistory) ? meta.sessionHistory : [];
  const historyWordIds = asIds(asRecord([...history].sort((left, right) => asNumber(asRecord(right).completedAt) - asNumber(asRecord(left).completedAt))[0]).wordIds);
  const wordIds = asIds(asRecord(routeStep).wordIds).length ? asIds(asRecord(routeStep).wordIds) : historyWordIds;
  const vocabularyById = new Map(vocabulary.map(word => [word.id, word.word]));
  const words = [...new Set(wordIds.map(id => vocabularyById.get(id)).filter((word): word is string => Boolean(word)))].slice(0, 3);
  const lesson = Number.isInteger(chapter) && chapter >= 0 ? `Lesson ${chapter + 1}` : lessonFromHistory(history);
  return {
    name: name.trim() || "learner",
    lesson,
    words,
    masteredWords: Object.values(progress).filter(mastered).length,
    rhythmDays: Math.max(0, Math.floor(asNumber(meta.streak))),
    learningDaysThisWeek: weeklyLearningDays(meta.rhythmHistory, now),
  };
}

function londonDateIndex(date: string): number {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function selectDailyWord(vocabulary: readonly DailyWord[], londonDate: string): DailyWord | null {
  const available = vocabulary
    .filter(word => word.word && word.reading && word.romaji && word.meaning && word.sentence && word.sentenceMeaning)
    .slice()
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
  if (!available.length) return null;
  const index = ((londonDateIndex(londonDate) % available.length) + available.length) % available.length;
  return available[index] ?? null;
}

export function isDailyWordScheduled(london: { hour?: string; minute?: string }): boolean {
  return london.hour === "08" && london.minute === "00";
}

export function dailyWordEmailContent(name: string, word: DailyWord): PersonalisedEmailContent {
  return {
    subject: `Your Japanese word of the day: ${word.word}`,
    eyebrow: "Your Japanese word of the day",
    title: word.word,
    body: `Hello ${name}, here is a three-step mini-lesson. 1) Meet it: ${word.word} (${word.reading}, ${word.romaji}) means ${word.meaning}. 2) Notice it in context: ${word.sentence} — ${word.sentenceMeaning}. 3) Say it aloud, then practise the word in Kaishi Japanese.`,
    cta: "Practise this word",
  };
}

const wordsText = (words: readonly string[]) => words.length === 1 ? words[0] : words.length === 2 ? `${words[0]} and ${words[1]}` : `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;
const lessonPhrase = (snapshot: LearnerEmailSnapshot) => snapshot.lesson ? ` in ${snapshot.lesson}` : "";
const masteredPhrase = (snapshot: LearnerEmailSnapshot) => snapshot.masteredWords ? ` You already have ${snapshot.masteredWords} mastered Japanese word${snapshot.masteredWords === 1 ? "" : "s"} to build on.` : "";
const rhythmPhrase = (snapshot: LearnerEmailSnapshot) => snapshot.rhythmDays ? ` Your ${snapshot.rhythmDays}-day learning rhythm is still yours.` : "";

export function personalisedEmailContent(program: EmailProgramKey, snapshot: LearnerEmailSnapshot): PersonalisedEmailContent {
  const words = wordsText(snapshot.words);
  if (program === "onboarding_nudge") return {
    subject: `${snapshot.name}, your first Japanese words are ready`, eyebrow: "A welcome from Sensei", title: "Your first practical lesson is ready",
    body: `Hello ${snapshot.name}, begin with three useful words: はい, いいえ, and 大丈夫. One small lesson is enough to start making Japanese feel familiar.`, cta: "Start my journey",
  };
  if (program === "activity_invite") {
    const activity = snapshot.masteredWords >= 10
      ? "Kotoba Echo, a short speaking challenge using familiar words"
      : snapshot.masteredWords >= 5
        ? "Japan Ready, a practical travel scenario using words you already know"
        : "your next Journey mission, which will gently build your first familiar set";
    return {
      subject: `${snapshot.name}, a Japanese activity is ready for you`, eyebrow: "A small invitation from Sensei", title: "Turn your words into a moment of Japanese",
      body: `Hello ${snapshot.name}, you have enough learning momentum to try ${activity}. It is designed to feel like a short, achievable return to Japanese${snapshot.rhythmDays ? ` while your ${snapshot.rhythmDays}-day rhythm is still warm` : ""}. Open Kaishi Japanese and take the next small step.`, cta: "Try the activity",
    };
  }
  if (program === "reengagement") return {
    subject: snapshot.lesson ? `${snapshot.lesson} is ready when you are` : "Your Japanese journey is waiting", eyebrow: "A small nudge from Sensei", title: "Your Japanese is still with you",
    body: `Hello ${snapshot.name}, ${words ? `the words you were working on${lessonPhrase(snapshot)} — ${words} — are ready for a gentle return.` : "your Japanese journey is ready to pick up where you left off."}${masteredPhrase(snapshot)}${rhythmPhrase(snapshot)} A short review is a lovely way back in.`, cta: "Continue my journey",
  };
  if (program === "weekly_recap") return {
    subject: snapshot.learningDaysThisWeek ? `Your week in Japanese: ${snapshot.learningDaysThisWeek} learning day${snapshot.learningDaysThisWeek === 1 ? "" : "s"}` : "A gentle weekly note from Sensei", eyebrow: "Your week in Japanese", title: snapshot.learningDaysThisWeek ? `You made space for Japanese ${snapshot.learningDaysThisWeek} day${snapshot.learningDaysThisWeek === 1 ? "" : "s"}` : "Keep your Japanese close this week",
    body: `Hello ${snapshot.name}, ${snapshot.learningDaysThisWeek ? `you made meaningful time for Japanese on ${snapshot.learningDaysThisWeek} day${snapshot.learningDaysThisWeek === 1 ? "" : "s"} this week.` : "thank you for keeping Japanese in your week."}${snapshot.lesson ? ` Your path is currently ${snapshot.lesson}${words ? `, with ${words}` : ""}.` : ""}${masteredPhrase(snapshot)}${rhythmPhrase(snapshot)} Keep the next step small and kind.`, cta: "Open my journey",
  };
  return {
    subject: snapshot.lesson ? `A new month with ${snapshot.lesson}` : "A new month of Japanese with Sensei", eyebrow: "A note from Sensei", title: "A small step is enough",
    body: `Hello ${snapshot.name}, a new month is a lovely moment to return to your Japanese${snapshot.lesson ? ` path${lessonPhrase(snapshot)}` : ""}.${words ? ` The words ${words} are ready whenever you are.` : ""}${masteredPhrase(snapshot)}${rhythmPhrase(snapshot)} Meet one more word, or enjoy a short review.`, cta: "Continue my journey",
  };
}
