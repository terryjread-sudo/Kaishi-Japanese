export interface CurriculumVocabulary {
  id: string;
}

export interface CurriculumArc {
  id: string;
  title: string;
}

export interface CurriculumLesson {
  lessonNumber: number;
  arc: CurriculumArc;
  wordIds: readonly string[];
}

export interface ConnectorStep {
  id: string;
  lesson: number;
  form: string;
  label: string;
  explanation: string;
  model: string;
  reading: string;
  meaning: string;
}

export const CURRICULUM_LESSON_SIZE = 3;
export const CURATED_FOUNDATION_LESSON_COUNT = 100;

const arcs: readonly CurriculumArc[] = [
  { id: 'introductions', title: 'Meeting people' },
  { id: 'place-time', title: 'Places and time' },
  { id: 'everyday-actions', title: 'Everyday actions' },
  { id: 'requests-food', title: 'Requests and food' },
  { id: 'people-descriptions', title: 'People and descriptions' },
  { id: 'conversation', title: 'Everyday conversation' },
  { id: 'movement', title: 'Movement and direction' },
  { id: 'nature-numbers', title: 'Time, numbers and the world' },
  { id: 'expansion', title: 'Useful language expansion' },
  { id: 'foundation-review', title: 'Foundation in action' },
];

/**
 * The first lessons are deliberately grouped by an immediately useful spoken
 * purpose. Remaining slots are completed from the source deck in its existing
 * frequency order, so no imported vocabulary is lost or duplicated.
 */
export const SPOKEN_FIRST_FOUNDATION: readonly (readonly string[])[] = [
  ['1708637439902', '1708637439903', '1708637439971'],
  ['1708637439854', '1708637439855', '1708637439889'],
  ['1708637439904', '1708637439862', '1708637439887'],
  ['1708637439865', '1708637439867', '1708637439868'],
  ['1708637439878', '1708637439879', '1708637439880'],
  ['1708637439891', '1708637439892', '1708637439893'],
  ['1708637439983', '1708637439866', '1708637439894'],
  ['1708637439860', '1708637439975', '1708637439858'],
  ['1708637439896', '1708637439974', '1708637439905'],
  ['1708637439973', '1708637439907', '1708637439933'],
  ['1708637439875', '1708637440321', '1708637440026'],
  ['1708637440056', '1708637440057', '1708637440058'],
  ['1708637440059', '1708637440060', '1708637440061'],
  ['1708637440062', '1708637440063', '1708637440064'],
  ['1708637441344', '1708637441338', '1708637441339'],
  ['1708637441340', '1708637441341', '1708637441342'],
  ['1708637441343', '1708637439876', '1708637440482'],
  ['1708637439885', '1708637439906', '1708637439908'],
  ['1708637439897', '1708637439882', '1708637439919'],
  ['1708637439927', '1708637440222', '1708637440195'],
  ['1708637439977', '1708637440052', '1708637440027'],
  ['1708637440085', '1708637439970', '1708637439968'],
  ['1708637439915', '1708637439932', '1708637440125'],
  ['1708637439954', '1708637440071', '1708637440541'],
  ['1708637440207', '1708637440040', '1708637439863'],
  ['1708637440002', '1708637440411', '1708637439922'],
  ['1708637439899', '1708637439911', '1708637439930'],
  ['1708637439890', '1708637439888', '1708637440046'],
  ['1708637440760', '1708637440051', '1708637440076'],
  ['1708637441056', '1708637441145', '1708637440504'],
  ['1708637440777', '1708637440778', '1708637440874'],
  ['1708637440786', '1708637440818', '1708637440619'],
  ['1708637439864', '1708637440761', '1708637441124'],
  ['1708637440942', '1708637440363', '1708637440468'],
  ['1708637439998', '1708637439884', '1708637440035'],
  ['1708637440045', '1708637440103', '1708637440395'],
  ['1708637440496', '1708637439969', '1708637439931'],
  ['1708637439857', '1708637439900', '1708637439955'],
  ['1708637440081', '1708637440120', '1708637440215'],
  ['1708637440864', '1708637440865', '1708637440866'],
  ['1708637440867', '1708637440375', '1708637439979'],
  ['1708637441134', '1708637440289', '1708637439859'],
  ['1708637439958', '1708637440042', '1708637440326'],
  ['1708637441127', '1708637440166', '1708637440312'],
  ['1708637440067', '1708637440170', '1708637440562'],
  ['1708637439910', '1708637439914', '1708637440108'],
  ['1708637439873', '1708637439872', '1708637439877'],
  ['1708637439951', '1708637439994', '1708637440080'],
  ['1708637439953', '1708637440114', '1708637439949'],
  ['1708637440087', '1708637440138', '1708637439961'],
  ['1708637440069', '1708637439960', '1708637440137'],
  ['1708637439959', '1708637440122', '1708637439987'],
  ['1708637439991', '1708637440100', '1708637439917'],
  ['1708637440082', '1708637439939', '1708637440073'],
  ['1708637439909', '1708637439928', '1708637439923'],
  ['1708637440078', '1708637439938', '1708637439967'],
  ['1708637439950', '1708637440111', '1708637440144'],
  ['1708637439972', '1708637440112', '1708637440003'],
  ['1708637439981', '1708637440118', '1708637440106'],
  ['1708637439980', '1708637440004', '1708637439895'],
  ['1708637440089', '1708637439962', '1708637440124'],
  ['1708637440086', '1708637439982', '1708637439988'],
  ['1708637440487', '1708637440595', '1708637440523'],
  ['1708637440446', '1708637440990', '1708637440314'],
  ['1708637440317', '1708637440954', '1708637440352'],
  ['1708637440475', '1708637440188', '1708637440720'],
  ['1708637439966', '1708637440350', '1708637441063'],
  ['1708637440486', '1708637440227', '1708637440511'],
  ['1708637440131', '1708637440132', '1708637440261'],
  ['1708637441345', '1708637441346', '1708637441347'],
  ['1708637441348', '1708637441349', '1708637441350'],
  ['1708637441351', '1708637441352', '1708637441353'],
  ['1708637440544', '1708637440473', '1708637440202'],
  ['1708637439993', '1708637439886', '1708637439913'],
  ['1708637439856', '1708637439945', '1708637440034'],
  ['1708637440068', '1708637439947', '1708637439940'],
  ['1708637439920', '1708637439861', '1708637440070'],
  ['1708637440072', '1708637439925', '1708637440074'],
  ['1708637439898', '1708637440075', '1708637439946'],
  ['1708637439901', '1708637440077', '1708637440079'],
  ['1708637439918', '1708637440066', '1708637440083'],
  ['1708637440050', '1708637439948', '1708637440084'],
  ['1708637439976', '1708637440088', '1708637439924'],
  ['1708637440090', '1708637440093', '1708637440094'],
  ['1708637440098', '1708637440099', '1708637440101'],
  ['1708637440102', '1708637440104', '1708637440105'],
  ['1708637440107', '1708637439944', '1708637439912'],
  ['1708637440109', '1708637440110', '1708637440113'],
  ['1708637440115', '1708637440116', '1708637440117'],
  ['1708637440119', '1708637439916', '1708637440121'],
  ['1708637440123', '1708637439984', '1708637439985'],
  ['1708637440005', '1708637439986', '1708637439989'],
  ['1708637440126', '1708637440127', '1708637440128'],
  ['1708637440129', '1708637440133', '1708637440134'],
  ['1708637440135', '1708637439990', '1708637440136'],
  ['1708637440139', '1708637440007', '1708637440140'],
  ['1708637440141', '1708637440142', '1708637440143'],
  ['1708637440010', '1708637440011', '1708637440036'],
  ['1708637440146', '1708637439996', '1708637440147'],
  ['1708637440152', '1708637440153', '1708637440154'],
];

export const CONNECTOR_STEPS: readonly ConnectorStep[] = [
  { id: 'topic-wa', lesson: 2, form: 'は', label: 'Topic marker', explanation: 'Marks what the sentence is about: “as for ...”.', model: '私はアイコです。', reading: 'わたしは アイコです。', meaning: 'I am Aiko.' },
  { id: 'and-to', lesson: 6, form: 'と', label: 'And / with', explanation: 'Joins people or things, and can mean “with”.', model: 'これとそれ', reading: 'これと それ', meaning: 'This and that.' },
  { id: 'ownership-no', lesson: 8, form: 'の', label: 'Of / belonging to', explanation: 'Links one noun to another, often showing belonging.', model: '私の名前', reading: 'わたしの なまえ', meaning: 'My name.' },
  { id: 'destination-ni', lesson: 18, form: 'に', label: 'Destination', explanation: 'Marks where someone arrives or goes.', model: '日本に来る。', reading: 'にほんに くる。', meaning: 'Come to Japan.' },
  { id: 'object-o', lesson: 19, form: 'を', label: 'Direct object', explanation: 'Marks the thing an action happens to.', model: 'それを見る。', reading: 'それを みる。', meaning: 'Look at that.' },
  { id: 'place-de', lesson: 21, form: 'で', label: 'Action place', explanation: 'Marks the place where an action happens.', model: '家で食べる。', reading: 'いえで たべる。', meaning: 'Eat at home.' },
  { id: 'also-mo', lesson: 23, form: 'も', label: 'Also / too', explanation: 'Adds someone or something: “too”.', model: '私も行く。', reading: 'わたしも いく。', meaning: 'I will go too.' },
  { id: 'question-ka', lesson: 27, form: 'か', label: 'Question marker', explanation: 'Turns a statement into a gentle question.', model: '何ですか。', reading: 'なんですか。', meaning: 'What is it?' },
  { id: 'subject-ga', lesson: 29, form: 'が', label: 'Subject marker', explanation: 'Highlights the thing that has a quality or does an action.', model: '水が好きです。', reading: 'みずが すきです。', meaning: 'I like water.' },
];

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function arcForLesson(lessonNumber: number): CurriculumArc {
  return arcs[Math.min(arcs.length - 1, Math.floor((lessonNumber - 1) / 10))] ?? arcs[0]!;
}

/** Returns the shared Journey order without changing imported source records. */
export function resolveJourneyVocabulary<T extends CurriculumVocabulary>(vocabulary: readonly T[]): T[] {
  const byId = new Map(vocabulary.map((word) => [word.id, word]));
  const seen = new Set<string>();
  const curated = SPOKEN_FIRST_FOUNDATION.flatMap((lesson) => lesson)
    .map((id) => byId.get(id))
    .filter((word): word is T => Boolean(word && !seen.has(word.id) && seen.add(word.id)));
  const remaining = vocabulary.filter((word) => !seen.has(word.id));
  return [...curated, ...remaining];
}

export function buildJourneyCurriculum<T extends CurriculumVocabulary>(vocabulary: readonly T[]): CurriculumLesson[] {
  return chunk(resolveJourneyVocabulary(vocabulary).map((word) => word.id), CURRICULUM_LESSON_SIZE)
    .map((wordIds, index) => ({ lessonNumber: index + 1, arc: arcForLesson(index + 1), wordIds }));
}

export function lessonForIndex<T extends CurriculumVocabulary>(vocabulary: readonly T[], index: number): T[] {
  const start = Math.max(0, Math.floor(index)) * CURRICULUM_LESSON_SIZE;
  return resolveJourneyVocabulary(vocabulary).slice(start, start + CURRICULUM_LESSON_SIZE);
}

export function connectorForLesson(lessonNumber: number): ConnectorStep | null {
  return CONNECTOR_STEPS.find((step) => step.lesson === lessonNumber) ?? null;
}

export function validateJourneyCurriculum(vocabulary: readonly CurriculumVocabulary[]): string[] {
  const known = new Set(vocabulary.map((word) => word.id));
  const seen = new Set<string>();
  const issues: string[] = [];
  if (SPOKEN_FIRST_FOUNDATION.length !== CURATED_FOUNDATION_LESSON_COUNT) {
    issues.push(`The curated foundation must contain ${CURATED_FOUNDATION_LESSON_COUNT} lessons.`);
  }
  SPOKEN_FIRST_FOUNDATION.forEach((lesson, lessonIndex) => {
    if (lesson.length !== CURRICULUM_LESSON_SIZE) issues.push(`Lesson ${lessonIndex + 1} must contain three words.`);
    lesson.forEach((id) => {
      if (!known.has(id)) issues.push(`Lesson ${lessonIndex + 1} references missing vocabulary ${id}.`);
      if (seen.has(id)) issues.push(`Vocabulary ${id} appears more than once in the curated foundation.`);
      seen.add(id);
    });
  });
  CONNECTOR_STEPS.forEach((step) => {
    if (step.lesson < 1 || step.lesson > CURATED_FOUNDATION_LESSON_COUNT) issues.push(`Connector ${step.id} is outside the curated foundation.`);
  });
  return issues;
}
