import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));

const legacy = readJson('memory-scenes.json');
const gold = readJson('visual-mnemonics.json');

// These hooks deliberately favour vivid, concrete English sound associations over
// perfect transliteration. Each story must show both the sound cue and the meaning.
const extraMnemonics = {
  '前|まえ': ['My', 'Kai stands in FRONT of MY house, pointing proudly to himself and the front door.'],
  '後ろ|うしろ': ['Ooh, she rows', 'Mia rows a tiny boat BEHIND Kai while he looks the other way and cries, “Ooh, she rows!”'],
  '左|ひだり': ['He dared', 'Kai turns LEFT down a spooky path because HE DARED to take the scarier direction.'],
  '右|みぎ': ['Mia gives', 'MIA GIVES Kai a present with her RIGHT hand while a bright arrow points right.'],
  '上|うえ': ['Way up', 'Kai looks WAY UP at Mia floating ABOVE him in a balloon.'],
  '下|した': ['Sheet under', 'A striped SHEET is tucked UNDER a table while Kai points DOWN to it.'],
  '中|なか': ['Knocker', 'Kai finds a giant door KNOCKER in the exact MIDDLE of a room INSIDE a castle.'],
  '外|そと': ['So toe', 'Kai steps OUTSIDE a boundary line with one giant TOE and shouts, “SO, TOE outside!”'],
  '冬|ふゆ': ['Few you', 'In WINTER snow only a FEW people remain, and Kai points: “FEW—you!”'],
  '春|はる': ['Hare', 'A cheerful HARE leaps through flowers as SPRING begins.'],
  '夏|なつ': ['Gnats', 'Kai swats buzzing GNATS at a bright, hot SUMMER picnic.'],
  '秋|あき': ['A key', 'A golden KEY tumbles through red and orange AUTUMN leaves.'],
  '朝|あさ': ['I saw', 'At MORNING sunrise Mia points outside and says, “I SAW the sun come up!”'],
  '昼|ひる': ['Hero', 'At NOON a caped HERO stands directly beneath the high midday sun.'],
  '友達|ともだち': ['Tom and a dachshund', 'Kai’s FRIEND TOM arrives with a friendly DACHSHUND, and everyone hugs.'],
  '家族|かぞく': ['Cars and oak', 'A whole FAMILY poses beside their CAR under a huge OAK tree.'],
  '子供|こども': ['Cocoa dome', 'A CHILD builds a giant COCOA-coloured DOME in a playground.'],
  '大人|おとな': ['Auto adult', 'A responsible ADULT drives an AUTO while the children sit safely in back.'],
  '男|おとこ': ['Otto’s cones', 'A MAN named OTTO carries an absurd stack of traffic CONES.'],
  '女|おんな': ['Honour', 'A WOMAN receives a shining medal of HONOUR on stage.'],
  '子|こ': ['Cocoa kid', 'A happy KID holds an enormous mug of COCOA.'],
  '親|おや': ['Oh yeah!', 'A proud PARENT cheers “OH YEAH!” as their child succeeds.'],
  '学生|がくせい': ['Gak says', 'A STUDENT named GAK raises his hand and SAYS the answer in class.'],
  '仕事|しごと': ['She got a job', 'Mia celebrates because SHE GOT a new JOB at a busy workshop.'],
  '勉強|べんきょう': ['Ben’s key', 'BEN uses a giant KEY to unlock a mountain of books and STUDY hard.'],
  '先生|せんせい': ['Sensei says', 'A friendly TEACHER—SENSEI—SAYS the lesson while pointing at a board.'],
  '病院|びょういん': ['Be in', 'An ill Kai is wheeled IN through the doors of a HOSPITAL so he can BE IN care.'],
  'お金|おかね': ['Oh, cane!', 'Mia cries “OH, CANE!” when coins and MONEY spill from a walking cane.'],
  '時計|とけい': ['Toe key', 'Kai uses a TOE-shaped KEY to wind a giant CLOCK.'],
  '本|ほん': ['Hon!', 'Mia calls “HON!” while handing Kai a huge BOOK.'],
  '車|くるま': ['Cool room', 'Kai rides in a CAR that looks like a COOL little ROOM on wheels.'],
  '電車|でんしゃ': ['Dentist shuttle', 'A DENTIST rides a fast rail SHUTTLE—a bright electric TRAIN.'],
  '食べる|たべる': ['Tabby', 'A hungry TABBY cat sits with Kai and EATS an enormous bowl of noodles.'],
  '飲む|のむ': ['No moo', 'A cow quietly DRINKS water while Kai holds a sign asking for “NO MOO.”'],
  '行く|いく': ['Eek, you go!', 'Kai shouts “EEK—YOU GO!” as Mia GOES through the departure gate.'],
  '来る|くる': ['Crew', 'A colourful CREW COMES running toward Kai to join him.'],
  '見る|みる': ['Meerkat', 'A curious MEERKAT uses binoculars to SEE a distant castle.'],
  '聞く|きく': ['Key cue', 'A ringing KEY gives the CUE; Kai cups his ear to HEAR and then ASK a question.'],
  '言う|いう': ['Eeyore', 'EEYORE leans toward Kai to SAY something clearly.'],
  '話す|はなす': ['Hannah speaks', 'HANNAH SPEAKS animatedly into a microphone while Kai listens.'],
  '知る|しる': ['She knows', 'Mia points to the answer with confidence because SHE KNOWS it.'],
  '思う|おもう': ['Oh, Moe!', 'MOE sits beneath a thought cloud while Kai says, “OH, MOE is THINKING!”'],
  '使う|つかう': ['Sue’s cow', 'SUE’S COW learns to USE a computer keyboard.'],
  '読む|よむ': ['Yo, moo!', 'Kai says “YO, MOO!” while a cow READS a book aloud.'],
  '持つ|もつ': ['Moat suit', 'Kai in a wet MOAT SUIT HOLDS a heavy treasure chest above the water.'],
  '置く|おく': ['Oak', 'Mia PUTS a golden key carefully on the stump of a huge OAK tree.'],
  '取る|とる': ['Tore', 'Kai TAKES a ticket after he TORE it from a roll.'],
  '持ってくる|もってくる': ['Moth crew', 'A CREW of giant MOTHS BRINGS a package toward Kai.'],
  '持っていく|もっていく': ['Moth take', 'A giant MOTH TAKES Kai’s package AWAY into the sky.'],
  '探す|さがす': ['Saga goose', 'A detective GOOSE from a SAGA SEARCHES everywhere with a magnifying glass.'],
  '見つける|みつける': ['Mia’s clue', 'MIA follows a CLUE and FINDS the missing golden key.'],
  '開ける|あける': ['A key', 'Kai uses A KEY to OPEN a huge locked door.'],
  '閉める|しめる': ['She mailed', 'Mia CLOSES a mailbox after SHE MAILED a letter.'],
  '入る|はいる': ['High heel', 'A giant HIGH HEEL ENTERS through a tiny doorway.'],
  '出る|でる': ['Daryl', 'DARYL LEAVES the house through the open front door.'],
  '起きる|おきる': ['Oak key', 'An OAK-shaped KEY rings like an alarm and Kai WAKES UP.'],
  '寝る|ねる': ['Nero', 'NERO the sleepy dog curls up in bed and SLEEPS.'],
  '座る|すわる': ['Sue wobbles', 'SUE WOBBLES, then SITS safely on a chair.'],
  '立つ|たつ': ['Tattoo', 'Kai with a temporary dragon TATTOO STANDS tall at attention.'],
  '泳ぐ|およぐ': ['Oh, yoga!', 'Kai cries “OH, YOGA!” as a yoga teacher SWIMS past him.'],
  '飛ぶ|とぶ': ['Toe boots', 'Magic BOOTS on Kai’s TOES make him FLY through the sky.'],
  '乗る|のる': ['Nora', 'NORA happily RIDES a bright red bicycle.'],
  '降りる|おりる': ['Ollie', 'OLLIE GETS OFF a train and steps onto the platform.'],
  '買う|かう': ['Cow', 'A clever COW BUYS a basket of apples at a market.'],
  '売る|うる': ['Owl', 'A shopkeeper OWL SELLS colourful lanterns.'],
  '払う|はらう': ['Haru', 'HARU PAYS the cashier with a fan of coins and notes.'],
  '待つ|まつ': ['Mat', 'Kai WAITS patiently on a welcome MAT beside a giant clock.'],
  '急ぐ|いそぐ': ['E, so go!', 'Mia shouts “E—SO GO!” as Kai HURRIES to catch a departing train.'],
  '教える|おしえる': ['Oh, she yells', '“OH, SHE YELLS!” says Kai as Mia TEACHES a lively class.'],
  '教わる|おそわる': ['Oh, so we learn', '“OH, SO WE LEARN!” says Kai while being TAUGHT by a patient teacher.'],
  '助ける|たすける': ['Task hero', 'A TASK HERO rushes in to HELP Kai lift a fallen tree.'],
  '会う|あう': ['Ow!', 'Kai and Mia accidentally bump heads—“OW!”—when they MEET.'],
  '別れる|わかれる': ['Walk away', 'Two friends say goodbye and WALK AWAY in opposite directions to SEPARATE.'],
  '信じる|しんじる': ['Shin genie', 'A glowing GENIE emerges from Kai’s SHIN guard, and Kai BELIEVES the impossible.'],
  '好き|すき': ['Ski', 'Kai LOVES his bright red SKIS and hugs them happily.'],
  '嫌い|きらい': ['Key lie', 'Mia DISLIKES a crooked KEY that keeps LYING about which lock it opens.'],
  '必要な|ひつような': ['Hits you', 'A falling acorn HITS YOU, proving a safety helmet is NECESSARY.'],
  '大切な|たいせつな': ['Tie set', 'Kai protects a treasured TIE SET in a glass case because it is IMPORTANT.']
};

const allKeys = [...new Set([...Object.keys(legacy), ...Object.keys(gold)])];
const plan = allKeys.map((key, index) => {
  const legacyCard = legacy[key] || {};
  const goldCard = gold[key];
  const [word, reading] = key.split('|');
  const [soundMnemonic, story] = goldCard
    ? [goldCard.soundMnemonic, goldCard.story]
    : extraMnemonics[key] || [];

  if (!soundMnemonic || !story) throw new Error(`Missing mnemonic plan for ${key}`);

  return {
    number: index + 1,
    key,
    word,
    reading,
    romaji: goldCard?.romaji || '',
    meaning: goldCard?.meaning || legacyCard.meaning,
    soundMnemonic,
    story,
    target: goldCard?.scene || legacyCard.file,
    sourceSystem: goldCard ? 'visual-mnemonics' : 'memory-scenes',
    status: 'needs-new-art'
  };
});

fs.writeFileSync(
  path.join(root, 'mnemonic-image-plan.json'),
  `${JSON.stringify({ schemaVersion: 1, styleVersion: 'phonetic-comic-v1', cards: plan }, null, 2)}\n`,
  'utf8'
);

console.log(`Wrote ${plan.length} mnemonic image plans.`);
