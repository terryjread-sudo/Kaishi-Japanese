import type { SignalCase, SignalChannel, SignalRule, SignalShift, SignalToken } from './types';

const fact = (value: string): SignalRule => ({ op: 'fact', fact: value });
const all = (...rules: SignalRule[]): SignalRule => ({ op: 'all', rules });
const any = (...rules: SignalRule[]): SignalRule => ({ op: 'any', rules });
const not = (rule: SignalRule): SignalRule => ({ op: 'not', rule });
const token = (surface: string, reading: string, meaning: string, evidence?: string): SignalToken => ({ surface, reading, meaning, fact: evidence });

function signal(id: string, channel: SignalChannel, tokens: SignalToken[], english: string, facts: string[], decisiveFacts: string[], explanation: string, speaker?: string): SignalCase {
  return { id, channel, japanese: tokens.map(item => item.surface).join(''), reading: tokens.map(item => item.reading).join(' '), english, tokens, facts, decisiveFacts, explanation, practiceIds: [], speaker };
}

const T = token;

export const SIGNAL_SHIFTS: SignalShift[] = [
  {
    id: 'training-colour', sequence: 1, department: 'Basic Training', title: 'The red condition', location: 'Section K · Training Room', aid: 'full', seconds: null, delayedFeedback: false,
    briefing: 'Director Mori begins with one fact. Learn the colour word, pin it as evidence, then apply the codebook.', guidance: 'Escalate only when the message contains red. Open every word card if you need it.', ruleText: 'ESCALATE if RED is mentioned.', rule: fact('red'),
    cases: [
      signal('t1-1','telegram',[T('赤い','あかい','red','red'),T('花','はな','flower')],'A red flower.',['red'],['red'],'赤い means red, so the codebook requires escalation.'),
      signal('t1-2','telegram',[T('青い','あおい','blue','blue'),T('空','そら','sky')],'A blue sky.',['blue'],['blue'],'The message says blue, not red, so it is standard.'),
      signal('t1-3','letter',[T('赤い','あかい','red','red'),T('本','ほん','book')],'A red book.',['red'],['red'],'The red book activates today’s rule.'),
      signal('t1-4','letter',[T('白い','しろい','white','white'),T('猫','ねこ','cat')],'A white cat.',['white'],['white'],'White is not the coded colour today.')
    ]
  },
  {
    id: 'training-place', sequence: 2, department: 'Basic Training', title: 'A place in the message', location: 'Section K · Training Room', aid: 'full', seconds: null, delayedFeedback: false,
    briefing: 'Japanese place words can carry the operational meaning. Today the park alone is sensitive.', guidance: 'Find 公園. Other places remain routine.', ruleText: 'ESCALATE if PARK is mentioned.', rule: fact('park'),
    cases: [
      signal('t2-1','telegram',[T('公園','こうえん','park','park'),T('です','です','is')],'It is the park.',['park'],['park'],'公園 means park, which activates the rule.'),
      signal('t2-2','letter',[T('駅','えき','station','station'),T('です','です','is')],'It is the station.',['station'],['station'],'駅 is a station, not a park.'),
      signal('t2-3','telegram',[T('公園','こうえん','park','park'),T('で','で','at'),T('会います','あいます','meet')],'We will meet at the park.',['park'],['park'],'The meeting place is the park.'),
      signal('t2-4','letter',[T('学校','がっこう','school','school'),T('へ','へ','to'),T('行きます','いきます','go')],'I will go to school.',['school'],['school'],'The place is school, so file it as standard.')
    ]
  },
  {
    id: 'training-pair', sequence: 3, department: 'Basic Training', title: 'Two clues together', location: 'Section K · Training Room', aid: 'full', seconds: null, delayedFeedback: false,
    briefing: 'The codebook now needs two facts in the same message. One clue by itself is not enough.', guidance: 'Pin both 赤い and 公園 before escalating.', ruleText: 'ESCALATE only if RED and PARK both appear.', rule: all(fact('red'), fact('park')),
    cases: [
      signal('t3-1','telegram',[T('赤い','あかい','red','red'),T('車','くるま','car'),T('は','は','topic'),T('公園','こうえん','park','park'),T('です','です','is')],'The red car is at the park.',['red','park'],['red','park'],'Both coded facts are present.'),
      signal('t3-2','letter',[T('赤い','あかい','red','red'),T('車','くるま','car'),T('です','です','is')],'It is a red car.',['red'],['red'],'Red appears, but park does not.'),
      signal('t3-3','telegram',[T('青い','あおい','blue','blue'),T('車','くるま','car'),T('は','は','topic'),T('公園','こうえん','park','park'),T('です','です','is')],'The blue car is at the park.',['blue','park'],['blue','park'],'Park appears, but the car is blue.'),
      signal('t3-4','letter',[T('赤い','あかい','red','red'),T('傘','かさ','umbrella'),T('を','を','object'),T('公園','こうえん','park','park'),T('で','で','at'),T('見ました','みました','saw')],'I saw a red umbrella at the park.',['red','park'],['red','park'],'Red and park appear together, so escalate.')
    ]
  },
  {
    id: 'signals-three-clues', sequence: 4, department: 'Signal Desk', title: 'Blue arithmetic', location: 'Section K · Main Desk', aid: 'reading', seconds: 300, delayedFeedback: false,
    briefing: 'Numbers and the question marker か now matter. Every condition must be present.', guidance: 'Listen for a blue object, any number and a question.', ruleText: 'ESCALATE if BLUE, a NUMBER and a QUESTION appear.', rule: all(fact('blue'), fact('number'), fact('question')),
    cases: [
      signal('s4-1','telegram',[T('青い','あおい','blue','blue'),T('箱','はこ','box'),T('は','は','topic'),T('三つ','みっつ','three','number'),T('ですか','ですか','is it?','question')],'Are there three blue boxes?',['blue','number','question'],['blue','number','question'],'All three conditions are present.'),
      signal('s4-2','telegram',[T('青い','あおい','blue','blue'),T('箱','はこ','box'),T('は','は','topic'),T('三つ','みっつ','three','number'),T('です','です','are')],'There are three blue boxes.',['blue','number'],['blue','number'],'It is a statement, not a question.'),
      signal('s4-3','letter',[T('赤い','あかい','red','red'),T('箱','はこ','box'),T('は','は','topic'),T('二つ','ふたつ','two','number'),T('ですか','ですか','is it?','question')],'Are there two red boxes?',['red','number','question'],['red','number','question'],'The colour is red, so the full rule is not met.'),
      signal('s4-4','telegram',[T('青い','あおい','blue','blue'),T('電車','でんしゃ','train'),T('は','は','topic'),T('七時','しちじ','seven o’clock','number'),T('ですか','ですか','is it?','question')],'Is the blue train at seven?',['blue','number','question'],['blue','number','question'],'Blue, a number and a question are all present.')
    ]
  },
  {
    id: 'signals-transit', sequence: 5, department: 'Signal Desk', title: 'Transit words', location: 'Section K · Main Desk', aid: 'reading', seconds: 285, delayedFeedback: false,
    briefing: 'Either of two transit clues is enough today. This is an OR rule.', guidance: 'Escalate train or station messages; buses and shops remain standard.', ruleText: 'ESCALATE if TRAIN or STATION is mentioned.', rule: any(fact('train'), fact('station')),
    cases: [
      signal('s5-1','telegram',[T('電車','でんしゃ','train','train'),T('が','が','subject'),T('来ます','きます','will come')],'The train will come.',['train'],['train'],'Train satisfies the OR rule.'),
      signal('s5-2','letter',[T('駅','えき','station','station'),T('で','で','at'),T('待ちます','まちます','will wait')],'I will wait at the station.',['station'],['station'],'Station satisfies the OR rule.'),
      signal('s5-3','telegram',[T('バス','ばす','bus','bus'),T('は','は','topic'),T('六時','ろくじ','six o’clock','number'),T('です','です','is')],'The bus is at six.',['bus','number'],['bus'],'Neither train nor station appears.'),
      signal('s5-4','letter',[T('店','みせ','shop','shop'),T('で','で','at'),T('会います','あいます','meet')],'We will meet at the shop.',['shop'],['shop'],'A shop is not one of today’s transit clues.')
    ]
  },
  {
    id: 'signals-cancellation', sequence: 6, department: 'Signal Desk', title: 'The cancellation exception', location: 'Section K · Main Desk', aid: 'reading', seconds: 275, delayedFeedback: false,
    briefing: 'Exceptions reverse a tempting first impression. A night operation is sensitive unless it is cancelled.', guidance: 'Do not stop at 今夜. Look for 中止 too.', ruleText: 'ESCALATE NIGHT messages unless they are CANCELLED.', rule: all(fact('night'), not(fact('cancelled'))),
    cases: [
      signal('s6-1','telegram',[T('今夜','こんや','tonight','night'),T('会います','あいます','will meet')],'We will meet tonight.',['night'],['night'],'Tonight appears and there is no cancellation.'),
      signal('s6-2','telegram',[T('今夜','こんや','tonight','night'),T('の','の','of'),T('会議','かいぎ','meeting'),T('は','は','topic'),T('中止','ちゅうし','cancelled','cancelled'),T('です','です','is')],'Tonight’s meeting is cancelled.',['night','cancelled'],['night','cancelled'],'The cancellation exception makes this standard.'),
      signal('s6-3','letter',[T('明日','あした','tomorrow','tomorrow'),T('会います','あいます','will meet')],'We will meet tomorrow.',['tomorrow'],['tomorrow'],'The message is not about tonight.'),
      signal('s6-4','telegram',[T('今夜','こんや','tonight','night'),T('十一時','じゅういちじ','eleven o’clock','number'),T('に','に','at'),T('出ます','でます','will leave')],'We leave tonight at eleven.',['night','number'],['night'],'It is a night message without a cancellation.')
    ]
  },
  {
    id: 'phone-numbers', sequence: 7, department: 'Telephone Unit', title: 'Numbers on the line', location: 'Listening Room 2', aid: 'reading', seconds: 300, delayedFeedback: true,
    briefing: 'The telephone unit tests what you hear. Replay freely; reveal the transcript if you need support.', guidance: 'Escalate only when a spoken number occurs inside a question.', ruleText: 'ESCALATE a QUESTION containing a NUMBER.', rule: all(fact('question'), fact('number')),
    cases: [
      signal('p7-1','telephone',[T('七時','しちじ','seven o’clock','number'),T('ですか','ですか','is it?','question')],'Is it seven o’clock?',['number','question'],['number','question'],'The caller asks a question containing a number.','Caller A'),
      signal('p7-2','telephone',[T('七時','しちじ','seven o’clock','number'),T('です','です','is')],'It is seven o’clock.',['number'],['number'],'A number is present, but this is not a question.','Caller B'),
      signal('p7-3','telephone',[T('どこ','どこ','where','question'),T('ですか','ですか','is it?','question')],'Where is it?',['question'],['question'],'It is a question without a number.','Caller A'),
      signal('p7-4','telephone',[T('三人','さんにん','three people','number'),T('ですか','ですか','is it?','question')],'Are there three people?',['number','question'],['number','question'],'The caller combines a number with a question.','Caller C')
    ]
  },
  {
    id: 'phone-identity', sequence: 8, department: 'Telephone Unit', title: 'Name and time', location: 'Listening Room 2', aid: 'reading', seconds: 285, delayedFeedback: true,
    briefing: 'Identity and timing must align. The name 田中 and any stated time form today’s pair.', guidance: 'Listen for Tanaka and an hour expression.', ruleText: 'ESCALATE if TANAKA and a TIME are both spoken.', rule: all(fact('tanaka'), fact('time')),
    cases: [
      signal('p8-1','telephone',[T('田中','たなか','Tanaka','tanaka'),T('です','です','am'),T('八時','はちじ','eight o’clock','time')],'This is Tanaka. Eight o’clock.',['tanaka','time'],['tanaka','time'],'Both the coded name and a time are spoken.','Caller D'),
      signal('p8-2','telephone',[T('田中','たなか','Tanaka','tanaka'),T('です','です','am')],'This is Tanaka.',['tanaka'],['tanaka'],'The coded name appears without a time.','Caller D'),
      signal('p8-3','telephone',[T('山田','やまだ','Yamada','yamada'),T('です','です','am'),T('九時','くじ','nine o’clock','time')],'This is Yamada. Nine o’clock.',['yamada','time'],['yamada','time'],'A time appears, but the speaker says Yamada.','Caller E'),
      signal('p8-4','telephone',[T('田中','たなか','Tanaka','tanaka'),T('は','は','topic'),T('五時','ごじ','five o’clock','time'),T('に','に','at'),T('来ます','きます','will come')],'Tanaka will come at five.',['tanaka','time'],['tanaka','time'],'Tanaka and a time are both present.','Caller F')
    ]
  },
  {
    id: 'phone-danger', sequence: 9, department: 'Telephone Unit', title: 'Priority language', location: 'Listening Room 2', aid: 'dictionary', seconds: 270, delayedFeedback: true,
    briefing: 'Some words are sufficient on their own. Urgent and dangerous are both priority terms.', guidance: 'Either 緊急 or 危険 requires escalation.', ruleText: 'ESCALATE if URGENT or DANGER is spoken.', rule: any(fact('urgent'), fact('danger')),
    cases: [
      signal('p9-1','telephone',[T('緊急','きんきゅう','urgent','urgent'),T('です','です','is')],'It is urgent.',['urgent'],['urgent'],'Urgent is a priority term.','Unknown caller'),
      signal('p9-2','telephone',[T('危険','きけん','dangerous','danger'),T('です','です','is')],'It is dangerous.',['danger'],['danger'],'Danger is a priority term.','Unknown caller'),
      signal('p9-3','telephone',[T('大丈夫','だいじょうぶ','all right','safe'),T('です','です','is')],'It is all right.',['safe'],['safe'],'The caller indicates safety, not danger.','Caller G'),
      signal('p9-4','telephone',[T('普通','ふつう','normal','normal'),T('の','の','of'),T('連絡','れんらく','message'),T('です','です','is')],'It is a normal message.',['normal'],['normal'],'No priority term is spoken.','Caller H')
    ]
  },
  {
    id: 'night-weather', sequence: 10, department: 'Night Watch', title: 'Tomorrow’s rain', location: 'Night Office · 23:40', aid: 'dictionary', seconds: 250, delayedFeedback: true,
    briefing: 'Night watch begins. Weather is harmless unless tomorrow and rain appear together.', guidance: 'Check the time reference as carefully as the weather.', ruleText: 'ESCALATE if TOMORROW and RAIN both appear.', rule: all(fact('tomorrow'), fact('rain')),
    cases: [
      signal('n10-1','intercept',[T('明日','あした','tomorrow','tomorrow'),T('は','は','topic'),T('雨','あめ','rain','rain'),T('です','です','is')],'It will rain tomorrow.',['tomorrow','rain'],['tomorrow','rain'],'Tomorrow and rain appear together.'),
      signal('n10-2','intercept',[T('今日','きょう','today','today'),T('は','は','topic'),T('雨','あめ','rain','rain'),T('です','です','is')],'It is raining today.',['today','rain'],['today','rain'],'The rain is today, not tomorrow.'),
      signal('n10-3','letter',[T('明日','あした','tomorrow','tomorrow'),T('は','は','topic'),T('晴れ','はれ','sunny','sunny'),T('です','です','is')],'It will be sunny tomorrow.',['tomorrow','sunny'],['tomorrow','sunny'],'Tomorrow appears, but rain does not.'),
      signal('n10-4','intercept',[T('明日','あした','tomorrow','tomorrow'),T('の','の','of'),T('夜','よる','night','night'),T('は','は','topic'),T('雨','あめ','rain','rain'),T('です','です','is')],'Tomorrow night will be rainy.',['tomorrow','night','rain'],['tomorrow','rain'],'The extra night clue does not change the pair.')
    ]
  },
  {
    id: 'night-colour-count', sequence: 11, department: 'Night Watch', title: 'Colour count', location: 'Night Office · 00:25', aid: 'dictionary', seconds: 240, delayedFeedback: true,
    briefing: 'Either coded colour works, but a number must accompany it.', guidance: 'First find red or blue, then confirm a number.', ruleText: 'ESCALATE if (RED or BLUE) appears with a NUMBER.', rule: all(any(fact('red'), fact('blue')), fact('number')),
    cases: [
      signal('n11-1','intercept',[T('赤い','あかい','red','red'),T('箱','はこ','box'),T('が','が','subject'),T('二つ','ふたつ','two','number'),T('あります','あります','exist')],'There are two red boxes.',['red','number'],['red','number'],'A coded colour and a number are present.'),
      signal('n11-2','intercept',[T('青い','あおい','blue','blue'),T('車','くるま','car'),T('です','です','is')],'It is a blue car.',['blue'],['blue'],'Blue appears without a number.'),
      signal('n11-3','letter',[T('白い','しろい','white','white'),T('鳥','とり','bird'),T('が','が','subject'),T('三羽','さんば','three birds','number'),T('います','います','exist')],'There are three white birds.',['white','number'],['white','number'],'The numbered colour is white, not red or blue.'),
      signal('n11-4','intercept',[T('青い','あおい','blue','blue'),T('電車','でんしゃ','train'),T('が','が','subject'),T('一本','いっぽん','one','number'),T('来ます','きます','will come')],'One blue train will come.',['blue','train','number'],['blue','number'],'Blue and a number satisfy the rule.')
    ]
  },
  {
    id: 'night-morning-exception', sequence: 12, department: 'Night Watch', title: 'Before morning', location: 'Night Office · 01:10', aid: 'dictionary', seconds: 230, delayedFeedback: true,
    briefing: 'A station report is sensitive except when it clearly refers to morning.', guidance: 'Morning cancels the station condition.', ruleText: 'ESCALATE STATION messages unless MORNING is mentioned.', rule: all(fact('station'), not(fact('morning'))),
    cases: [
      signal('n12-1','intercept',[T('駅','えき','station','station'),T('で','で','at'),T('待ちます','まちます','will wait')],'I will wait at the station.',['station'],['station'],'Station appears with no morning exception.'),
      signal('n12-2','intercept',[T('朝','あさ','morning','morning'),T('駅','えき','station','station'),T('へ','へ','to'),T('行きます','いきます','will go')],'I will go to the station in the morning.',['morning','station'],['morning','station'],'Morning activates the exception.'),
      signal('n12-3','letter',[T('夜','よる','night','night'),T('の','の','of'),T('駅','えき','station','station'),T('です','です','is')],'It is the station at night.',['night','station'],['station'],'The station appears without morning.'),
      signal('n12-4','intercept',[T('朝','あさ','morning','morning'),T('公園','こうえん','park','park'),T('で','で','at'),T('会います','あいます','meet')],'We meet at the park in the morning.',['morning','park'],['morning','park'],'There is no station clue.')
    ]
  },
  {
    id: 'counter-two-paths', sequence: 13, department: 'Counterintelligence', title: 'Two operational paths', location: 'Restricted Records · Level 1', aid: 'dictionary', seconds: 225, delayedFeedback: true,
    briefing: 'The codebook now contains two complete routes to escalation. Test each route separately.', guidance: 'Either red with park, or blue with a question, is sufficient.', ruleText: 'ESCALATE for (RED and PARK) or (BLUE and QUESTION).', rule: any(all(fact('red'), fact('park')), all(fact('blue'), fact('question'))),
    cases: [
      signal('c13-1','intercept',[T('赤い','あかい','red','red'),T('車','くるま','car'),T('は','は','topic'),T('公園','こうえん','park','park'),T('です','です','is')],'The red car is at the park.',['red','park'],['red','park'],'The first operational path is complete.'),
      signal('c13-2','telephone',[T('青い','あおい','blue','blue'),T('鍵','かぎ','key'),T('ですか','ですか','is it?','question')],'Is it the blue key?',['blue','question'],['blue','question'],'The second operational path is complete.','Unknown caller'),
      signal('c13-3','letter',[T('赤い','あかい','red','red'),T('鍵','かぎ','key'),T('ですか','ですか','is it?','question')],'Is it the red key?',['red','question'],['red','question'],'The clues come from different incomplete paths.'),
      signal('c13-4','intercept',[T('青い','あおい','blue','blue'),T('車','くるま','car'),T('は','は','topic'),T('公園','こうえん','park','park'),T('です','です','is')],'The blue car is at the park.',['blue','park'],['blue','park'],'Neither complete pair appears.')
    ]
  },
  {
    id: 'counter-location-exception', sequence: 14, department: 'Counterintelligence', title: 'The live rendezvous', location: 'Restricted Records · Level 2', aid: 'dictionary', seconds: 215, delayedFeedback: true,
    briefing: 'A live rendezvous needs a number and one approved location, but cancellation overrides everything.', guidance: 'Check location, count and cancellation in that order.', ruleText: 'ESCALATE a NUMBER with (STATION or PARK), unless CANCELLED.', rule: all(fact('number'), any(fact('station'), fact('park')), not(fact('cancelled'))),
    cases: [
      signal('c14-1','intercept',[T('駅','えき','station','station'),T('に','に','at'),T('三人','さんにん','three people','number'),T('います','います','are')],'Three people are at the station.',['station','number'],['station','number'],'A number and approved location are present.'),
      signal('c14-2','letter',[T('公園','こうえん','park','park'),T('の','の','of'),T('会議','かいぎ','meeting'),T('は','は','topic'),T('二時','にじ','two o’clock','number'),T('です','です','is'),T('中止','ちゅうし','cancelled','cancelled')],'The park meeting at two is cancelled.',['park','number','cancelled'],['park','number','cancelled'],'Cancellation overrides the otherwise complete pattern.'),
      signal('c14-3','intercept',[T('店','みせ','shop','shop'),T('に','に','at'),T('四人','よにん','four people','number'),T('います','います','are')],'Four people are at the shop.',['shop','number'],['shop','number'],'The location is neither station nor park.'),
      signal('c14-4','telephone',[T('公園','こうえん','park','park'),T('は','は','topic'),T('五時','ごじ','five o’clock','number'),T('です','です','is')],'The park is at five.',['park','number'],['park','number'],'A number and approved location appear without cancellation.','Caller K')
    ]
  },
  {
    id: 'counter-final', sequence: 15, department: 'Counterintelligence', title: 'The Sakura file', location: 'Director’s Office · Final Clearance', aid: 'dictionary', seconds: 210, delayedFeedback: true,
    briefing: 'Your final assessment has one direct code word and one compound route. Director Mori expects evidence, not instinct.', guidance: 'Sakura alone escalates. Otherwise require night, a question and no safety confirmation.', ruleText: 'ESCALATE SAKURA, or a NIGHT QUESTION that is not marked SAFE.', rule: any(fact('sakura'), all(fact('night'), fact('question'), not(fact('safe')))),
    cases: [
      signal('c15-1','intercept',[T('桜','さくら','sakura','sakura'),T('は','は','topic'),T('咲きました','さきました','bloomed')],'The cherry blossoms bloomed.',['sakura'],['sakura'],'Sakura is the direct final code word.'),
      signal('c15-2','telephone',[T('今夜','こんや','tonight','night'),T('ですか','ですか','is it?','question')],'Is it tonight?',['night','question'],['night','question'],'Night and question appear without a safety confirmation.','Unknown caller'),
      signal('c15-3','telephone',[T('今夜','こんや','tonight','night'),T('ですか','ですか','is it?','question'),T('大丈夫','だいじょうぶ','safe','safe'),T('です','です','is')],'Is it tonight? It is safe.',['night','question','safe'],['night','question','safe'],'Safe blocks the compound route.','Director Mori'),
      signal('c15-4','letter',[T('明日','あした','tomorrow','tomorrow'),T('は','は','topic'),T('大丈夫','だいじょうぶ','safe','safe'),T('です','です','is')],'Tomorrow is safe.',['tomorrow','safe'],['tomorrow','safe'],'Neither Sakura nor the night-question route appears.')
    ]
  },
  {
    id: 'field-missing-courier', sequence: 16, department: 'Field Coordination', title: 'The missing courier', location: 'Annex Office · Rain Platform', aid: 'dictionary', seconds: 260, delayedFeedback: true,
    briefing: 'Agent Kuroda’s courier missed the last check-in. Routine travel notes are mixed with messages from the search teams.', guidance: 'A suitcase in the rain is sensitive unless the sender confirms it is safe.', ruleText: 'ESCALATE SUITCASE with RAIN, unless marked SAFE.', rule: all(fact('suitcase'), fact('rain'), not(fact('safe'))),
    story: { speaker: 'Agent Emi Kuroda', portrait: 'kuroda', text: 'My courier knows our phrases. Someone else may know them too. Read what is written—not what you expect to see.' },
    debrief: 'Kuroda finds the courier’s bicycle beside the river. The satchel is gone, but a folded paper crane remains under the seat.',
    cases: [
      signal('f16-1','telegram',[T('雨','あめ','rain','rain'),T('の','の','of'),T('中','なか','inside'),T('鞄','かばん','suitcase','suitcase'),T('を','を','object'),T('見ました','みました','saw')],'I saw a suitcase in the rain.',['rain','suitcase'],['rain','suitcase'],'The suitcase and rain satisfy the field rule.'),
      signal('f16-2','letter',[T('鞄','かばん','suitcase','suitcase'),T('は','は','topic'),T('大丈夫','だいじょうぶ','safe','safe'),T('です','です','is')],'The suitcase is safe.',['suitcase','safe'],['suitcase','safe'],'There is no rain, and the safety confirmation blocks escalation.'),
      { ...signal('f16-3','telephone',[T('旅券','りょけん','passport','passport'),T('が','が','subject'),T('ありません','ありません','is missing','missing')],'The passport is missing.',['passport','missing'],['passport'],'The emergency amendment makes any passport report sensitive.','Agent Kuroda'), event: { kind: 'priority', headline: 'RED PHONE · COURIER DESK', body: 'Kuroda interrupts the shift: passports are now priority evidence, regardless of weather.', speaker: 'Agent Kuroda', portrait: 'kuroda', ruleText: 'TEMPORARY ORDER: ESCALATE any PASSPORT report.', ruleOverride: fact('passport') }, storyAfter: '“That passport carries a name which does not officially exist,” Kuroda says.' },
      signal('f16-4','intercept',[T('雨','あめ','rain','rain'),T('ですが','ですが','but'),T('鞄','かばん','suitcase','suitcase'),T('は','は','topic'),T('大丈夫','だいじょうぶ','safe','safe'),T('です','です','is')],'It is raining, but the suitcase is safe.',['rain','suitcase','safe'],['rain','suitcase','safe'],'Safe is the exception even though rain and suitcase appear.'),
      signal('f16-5','telegram',[T('晴れ','はれ','clear weather','sunny'),T('です','です','is'),T('鞄','かばん','suitcase','suitcase'),T('は','は','topic'),T('駅','えき','station','station'),T('です','です','is')],'It is clear. The suitcase is at the station.',['sunny','suitcase','station'],['suitcase','sunny'],'The weather is clear, so the rain condition is absent.')
    ]
  },
  {
    id: 'field-paper-crane', sequence: 17, department: 'Field Coordination', title: 'The paper crane', location: 'Safe Flat · Room 4', aid: 'dictionary', seconds: 250, delayedFeedback: true,
    briefing: 'A caller using the name Crane offers the courier’s route. His harmless-sounding messages may be warnings—or bait.', guidance: 'Crane is a direct code. Harbour at night is the alternate route.', ruleText: 'ESCALATE CRANE, or HARBOUR with NIGHT.', rule: any(fact('crane'), all(fact('harbour'), fact('night'))),
    story: { speaker: 'The Crane', portrait: 'crane', text: 'You are looking for a missing bag. I am looking for the person who took it. Perhaps tonight those are the same search.' },
    debrief: 'The last call traces to a closed harbour kiosk. Kuroda recognises the voice, but refuses to say from where.',
    cases: [
      signal('f17-1','telephone',[T('鶴','つる','crane','crane'),T('が','が','subject'),T('待っています','まっています','is waiting')],'The crane is waiting.',['crane'],['crane'],'Crane is today’s direct code.','The Crane'),
      signal('f17-2','intercept',[T('今夜','こんや','tonight','night'),T('港','みなと','harbour','harbour'),T('へ','へ','to'),T('行きます','いきます','will go')],'I will go to the harbour tonight.',['night','harbour'],['night','harbour'],'Night and harbour complete the alternate route.'),
      { ...signal('f17-3','telephone',[T('鶴','つる','crane','crane'),T('です','です','is')],'It is the crane.',['crane'],['crane'],'After the compromise warning, Crane without a question is no longer enough.','Unknown caller'), event: { kind: 'warning', headline: 'VOICEPRINT MISMATCH', body: 'The line may be imitating Crane. For this call only, require both CRANE and a QUESTION.', speaker: 'Technical Desk', ruleText: 'VOICE CHECK: ESCALATE only CRANE + QUESTION.', ruleOverride: all(fact('crane'), fact('question')) } },
      signal('f17-4','letter',[T('朝','あさ','morning','morning'),T('港','みなと','harbour','harbour'),T('で','で','at'),T('働きます','はたらきます','work')],'I work at the harbour in the morning.',['morning','harbour'],['morning','harbour'],'The harbour appears, but not at night.'),
      signal('f17-5','telephone',[T('鶴','つる','crane','crane'),T('は','は','topic'),T('安全','あんぜん','safe','safe'),T('ですか','ですか','is it?','question')],'Is the crane safe?',['crane','safe','question'],['crane'],'Crane activates the standing rule.','Agent Kuroda')
    ]
  },
  {
    id: 'emergency-blackout', sequence: 18, department: 'Emergency Desk', title: 'Lights out', location: 'Section K · Auxiliary Power', aid: 'dictionary', seconds: 245, delayedFeedback: true,
    briefing: 'A storm cuts power across the district. Hospital messages now share the line with confused civilian traffic.', guidance: 'Urgent hospital reports escalate. Watch for one-time orders from the emergency board.', ruleText: 'ESCALATE HOSPITAL with URGENT.', rule: all(fact('hospital'), fact('urgent')),
    story: { speaker: 'Agent Emi Kuroda', portrait: 'kuroda', text: 'The main switchboard is dark. I will relay amendments by hand. If a lamp flashes twice, believe the paper in front of you.' },
    debrief: 'Power returns for eleven seconds—long enough to print a list of internal extension numbers. One belongs to Director Mori’s locked office.',
    cases: [
      signal('e18-1','telephone',[T('病院','びょういん','hospital','hospital'),T('から','から','from'),T('緊急','きんきゅう','urgent','urgent'),T('です','です','is')],'This is an emergency from the hospital.',['hospital','urgent'],['hospital','urgent'],'Urgent and hospital are both present.','Hospital operator'),
      signal('e18-2','telegram',[T('病院','びょういん','hospital','hospital'),T('は','は','topic'),T('静か','しずか','quiet','quiet'),T('です','です','is')],'The hospital is quiet.',['hospital','quiet'],['hospital','quiet'],'Hospital alone does not satisfy the rule.'),
      { ...signal('e18-3','intercept',[T('電気','でんき','electricity','power'),T('が','が','subject'),T('消えました','きえました','went out','power-off'),T('九時','くじ','nine o’clock','time')],'The power went out at nine.',['power','power-off','time'],['power-off','time'],'The blackout board temporarily prioritises outage reports containing a time.'), event: { kind: 'blackout', headline: 'UNEXPECTED EVENT · TOTAL BLACKOUT', body: 'The codebook lamp dies. An emergency card slides under the door: outage plus a stated time now escalates.', speaker: 'Emergency Board', ruleText: 'BLACKOUT ORDER: ESCALATE POWER-OFF with TIME.', ruleOverride: all(fact('power-off'), fact('time')) }, storyAfter: 'In the darkness, someone tries the office door. The handle stops moving when Kuroda calls out.' },
      signal('e18-4','letter',[T('緊急','きんきゅう','urgent','urgent'),T('の','の','of'),T('電話','でんわ','telephone'),T('です','です','is')],'It is an urgent telephone call.',['urgent','telephone'],['urgent','telephone'],'Urgent appears without hospital.'),
      { ...signal('e18-5','telephone',[T('火事','かじ','fire','fire'),T('です','です','is'),T('危険','きけん','dangerous','danger'),T('です','です','is')],'There is a fire. It is dangerous.',['fire','danger'],['fire'],'A live fire order supersedes the hospital rule.','Night porter'), event: { kind: 'priority', headline: 'FIRE BELL · EAST ANNEX', body: 'Smoke enters the corridor. For this incoming call, any confirmed FIRE must be escalated immediately.', speaker: 'Building Control', ruleText: 'FIRE ORDER: ESCALATE any confirmed FIRE.', ruleOverride: fact('fire') } }
    ]
  },
  {
    id: 'internal-forged-orders', sequence: 19, department: 'Internal Affairs', title: 'The forged directive', location: 'Records Vault · Sublevel', aid: 'dictionary', seconds: 235, delayedFeedback: true,
    briefing: 'The stolen satchel contained blank Section K paper. Someone is issuing credible orders under familiar names.', guidance: 'A Kuroda key or Mori file escalates, unless the message is identified as fake.', ruleText: 'ESCALATE (KURODA + KEY) or (MORI + FILE), unless FAKE.', rule: all(any(all(fact('kuroda'), fact('key')), all(fact('mori'), fact('file'))), not(fact('fake'))),
    story: { speaker: 'Director Mori', portrait: 'mori', text: 'Trust is not evidence. If an order bears my name, examine it twice. If it bears Kuroda’s, examine it three times.' },
    debrief: 'The forged orders use ink stocked only inside Section K. Crane leaves a name on the dead line: Deputy Arakawa.',
    cases: [
      signal('i19-1','letter',[T('黒田','くろだ','Kuroda','kuroda'),T('が','が','subject'),T('鍵','かぎ','key','key'),T('を','を','object'),T('持っています','もっています','has')],'Kuroda has the key.',['kuroda','key'],['kuroda','key'],'Kuroda and key complete the first route.'),
      signal('i19-2','telegram',[T('森','もり','Mori','mori'),T('の','の','of'),T('書類','しょるい','file','file'),T('は','は','topic'),T('偽物','にせもの','fake','fake'),T('です','です','is')],'Mori’s file is fake.',['mori','file','fake'],['mori','file','fake'],'Fake cancels an otherwise sensitive pair.'),
      { ...signal('i19-3','telephone',[T('合言葉','あいことば','password','password'),T('は','は','topic'),T('朝','あさ','morning','morning'),T('です','です','is')],'The password is morning.',['password','morning'],['password'],'During the vault alarm, any password transmission escalates.','Deputy Arakawa'), event: { kind: 'warning', headline: 'VAULT ALARM · UNAUTHORISED ENTRY', body: 'A voice claims to be Deputy Arakawa. Internal Affairs orders all PASSWORD traffic escalated for this file.', speaker: 'Internal Affairs', ruleText: 'SECURITY ORDER: ESCALATE any PASSWORD.', ruleOverride: fact('password') }, storyAfter: 'The call ends before Arakawa can answer Kuroda’s identity question.' },
      signal('i19-4','intercept',[T('黒田','くろだ','Kuroda','kuroda'),T('は','は','topic'),T('書類','しょるい','file','file'),T('を','を','object'),T('読みます','よみます','reads')],'Kuroda reads the file.',['kuroda','file'],['kuroda','file'],'The name and object belong to different routes.'),
      signal('i19-5','letter',[T('森','もり','Mori','mori'),T('が','が','subject'),T('書類','しょるい','file','file'),T('を','を','object'),T('送りました','おくりました','sent')],'Mori sent the file.',['mori','file'],['mori','file'],'Mori and file satisfy the second route.')
    ]
  },
  {
    id: 'internal-operation-dawn', sequence: 20, department: 'Internal Affairs', title: 'Operation Dawn', location: 'Section K · Sealed Operations Room', aid: 'dictionary', seconds: 270, delayedFeedback: true,
    briefing: 'Arakawa is moving the stolen codebook before sunrise. Kuroda is in the field; Crane is on an unsecured line. Every decision now affects the operation.', guidance: 'Dawn with train is one route. Crane confirmed safe is the other.', ruleText: 'ESCALATE (DAWN + TRAIN) or (CRANE + SAFE).', rule: any(all(fact('dawn'), fact('train')), all(fact('crane'), fact('safe'))),
    story: { speaker: 'Agent Emi Kuroda', portrait: 'kuroda', text: 'This is the last board. If Crane lies, I walk into a trap. If we ignore him, Arakawa reaches the border. Make the words decide.' },
    debrief: 'At dawn, Kuroda recovers the satchel aboard the northbound train. Crane vanishes before the arrest—leaving one final origami bird on your desk.',
    cases: [
      signal('i20-1','telegram',[T('夜明け','よあけ','dawn','dawn'),T('の','の','of'),T('電車','でんしゃ','train','train'),T('です','です','is')],'It is the dawn train.',['dawn','train'],['dawn','train'],'Dawn and train complete the first route.'),
      signal('i20-2','telephone',[T('鶴','つる','Crane','crane'),T('は','は','topic'),T('安全','あんぜん','safe','safe'),T('です','です','is')],'Crane is safe.',['crane','safe'],['crane','safe'],'Crane and safe complete the second route.','Agent Kuroda'),
      signal('i20-3','intercept',[T('朝','あさ','morning','morning'),T('の','の','of'),T('バス','ばす','bus','bus'),T('です','です','is')],'It is the morning bus.',['morning','bus'],['morning','bus'],'Morning and bus match neither operational route.'),
      { ...signal('i20-4','telephone',[T('赤い','あかい','red','red'),T('扉','とびら','door','door'),T('が','が','subject'),T('開いています','あいています','is open','open')],'The red door is open.',['red','door','open'],['red','door'],'Kuroda’s field amendment makes the red door the immediate objective.','Agent Kuroda'), event: { kind: 'priority', headline: 'FIELD AMENDMENT · KURODA', body: 'The planned entrance is blocked. Kuroda transmits a replacement objective for this message only.', speaker: 'Agent Kuroda', portrait: 'kuroda', ruleText: 'FIELD ORDER: ESCALATE RED + DOOR.', ruleOverride: all(fact('red'), fact('door')) }, storyAfter: 'Metal crashes over the line. Kuroda whispers, “Correct door. Keep listening.”' },
      { ...signal('i20-5','telephone',[T('鶴','つる','Crane','crane'),T('は','は','topic'),T('危険','きけん','dangerous','danger'),T('です','です','is')],'Crane is in danger.',['crane','danger'],['crane','danger'],'A final direct warning says danger must be escalated.','The Crane'), event: { kind: 'warning', headline: 'UNSCHEDULED CALL · TRACE ACTIVE', body: 'The trace team has seconds. For this call only, a spoken DANGER warning is sufficient.', speaker: 'Director Mori', portrait: 'mori', ruleText: 'TRACE ORDER: ESCALATE any DANGER warning.', ruleOverride: fact('danger') } },
      signal('i20-6','telegram',[T('夜明け','よあけ','dawn','dawn'),T('に','に','at'),T('駅','えき','station','station'),T('へ','へ','to'),T('行きます','いきます','will go')],'I will go to the station at dawn.',['dawn','station'],['dawn','station'],'Dawn appears, but the required vehicle is a train, not merely a station.')
    ]
  }
];

export function signalShift(id: string): SignalShift { return SIGNAL_SHIFTS.find(shift => shift.id === id) || SIGNAL_SHIFTS[0]!; }
export function nextSignalShift(id: string): SignalShift | null { const index = SIGNAL_SHIFTS.findIndex(shift => shift.id === id); return SIGNAL_SHIFTS[index + 1] || null; }
