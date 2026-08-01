import fs from 'node:fs';

const ROOT=new URL('../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,ROOT),'utf8'));
const write=(name,value)=>fs.writeFileSync(new URL(name,ROOT),JSON.stringify(value,null,2)+'\n');
const manifestFile='data/mnemonic-expansion-600.json';

const cue={
 あ:'apple',い:'eel',う:'ooze',え:'egg',お:'oak',か:'car',き:'key',く:'cuckoo',け:'keg',こ:'coat',
 が:'garden',ぎ:'guitar',ぐ:'goose',げ:'gate',ご:'goat',さ:'sun',し:'sheep',す:'soup',せ:'sail',そ:'soap',
 ざ:'zebra',じ:'jeans',ず:'zoo',ぜ:'zeppelin',ぞ:'zone',た:'taco',ち:'cheese',つ:'tsunami',て:'tea',と:'toe',
 だ:'dart',ぢ:'jeep',づ:'zoo',で:'desk',ど:'dough',な:'nachos',に:'knee',ぬ:'noodle',ね:'net',の:'nose',
 は:'hat',ひ:'heel',ふ:'food',へ:'hay',ほ:'hoe',ば:'bat',び:'bee',ぶ:'boot',べ:'bell',ぼ:'boat',
 ぱ:'pan',ぴ:'pea',ぷ:'pool',ぺ:'pen',ぽ:'pole',ま:'map',み:'meat',む:'moon',め:'melon',も:'mower',
 や:'yak',ゆ:'unicorn',よ:'yo-yo',ら:'ram',り:'reef',る:'ruby',れ:'rain',ろ:'rope',わ:'wand',を:'wall',ん:'hen'
};
const combos={
 きゃ:'cat',きゅ:'cube',きょ:'cure',しゃ:'shark',しゅ:'shoe',しょ:'show',ちゃ:'chair',ちゅ:'chew',ちょ:'chocolate',
 にゃ:'nylon',にゅ:'newspaper',にょ:'gnome',ひゃ:'hyena',ひゅ:'human',ひょ:'yo-yo',みゃ:'meow',みゅ:'music',みょ:'mule',
 りゃ:'ram',りゅ:'ruler',りょ:'yo-yo',ぎゃ:'gadget',ぎゅ:'guitar',ぎょ:'goldfish',じゃ:'jar',じゅ:'juice',じょ:'jogger',
 びゃ:'beaker',びゅ:'beauty',びょ:'bicycle',ぴゃ:'piano',ぴゅ:'pewter',ぴょ:'penguin'
};
function morae(reading){
 const value=String(reading).split(/[・／/]/)[0].replace(/[ーっ]/g,'');const result=[];
 for(let i=0;i<value.length;i++){const pair=value.slice(i,i+2);if(combos[pair]){result.push(pair);i++}else if(cue[value[i]])result.push(value[i])}
 return result;
}
function phoneticProps(reading){const result=morae(reading).slice(0,3).map(mora=>combos[mora]||cue[mora]).filter(Boolean);return result.length?result:['ringing memory bell']}
function clean(value=''){return String(value).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}

function build(){
 const vocab=read('data/vocabulary.json'),scenes=read('memory-scenes.json'),visuals=read('visual-mnemonics.json');
 const used=new Set([...Object.keys(scenes),...Object.keys(visuals)]),selected=new Set(),chosen=[];
 for(const entry of vocab){const key=`${entry.word}|${entry.reading}`;if(used.has(key)||selected.has(key))continue;selected.add(key);chosen.push({...entry,key});if(chosen.length===100)break}
 if(chosen.length!==100)throw Error(`Expected 100 unmapped words, found ${chosen.length}`);
 const cards=chosen.map((entry,index)=>{
  const number=501+index,props=phoneticProps(entry.reading),meaning=clean(entry.meaning),context=clean(entry.sentenceMeaning||entry.sentence);
  const file=`gold-${number}-word-${String(entry.order||number).padStart(4,'0')}.webp`;
  const soundMnemonic=props.join(' + ');
  const story=`Kai and Mia use ${props.join(' and ')} while acting out “${meaning}”${context?`: ${context}`:''}.`;
  return {number,key:entry.key,word:entry.word,reading:entry.reading,meaning,order:entry.order,file,soundMnemonic,story,status:'pending',prompt:`Japanese vocabulary mnemonic for ${entry.word}, read ${entry.reading}, meaning “${meaning}”. Use these visible sound-alike pronunciation props: ${props.join(', ')}. Make every prop essential to one clear, memorable action that unmistakably communicates “${meaning}”. ${context?`Meaning context to dramatize: ${context}.`:''}`};
 });
 write(manifestFile,{schemaVersion:1,targetTotal:600,styleVersion:'kaishi-phonetic-comic-v2',cards});
 console.log(JSON.stringify({count:cards.length,first:cards[0],last:cards.at(-1)},null,2));
}

function apply(){
 const manifest=read(manifestFile),scenes=read('memory-scenes.json'),visuals=read('visual-mnemonics.json');
 const missing=manifest.cards.filter(card=>!fs.existsSync(new URL(card.file,ROOT)));
 if(missing.length)throw Error(`${missing.length} generated image files are missing; first: ${missing[0].file}`);
 for(const [index,card] of manifest.cards.entries()){
  scenes[card.key]={pack:6,row:Math.floor(index/10)+1,col:index%10+1,alt:`Mnemonic scene for ${card.word}, read ${card.reading}, meaning ${card.meaning}.`,caption:card.story,meaning:card.meaning,file:card.file,soundMnemonic:card.soundMnemonic,status:'approved',imageStatus:'approved'};
  visuals[card.key]={word:card.word,reading:card.reading,katakana:'',romaji:'',meaning:card.meaning,soundMnemonic:card.soundMnemonic,story:card.story,scene:card.file,overlay:card.word,overlayOpacity:1,overlaySize:1,overlayAnimation:'fade',overlayColour:'#ffffff',pack:'gold-04',status:'approved',imageStatus:'approved',reviewNote:'Reference-guided phonetic comic: pronunciation cue and meaning combined in one scene.',imageVersion:1,approvedAt:'2026-08-01'};
  card.status='installed';
 }
 if(Object.keys(scenes).length!==600)throw Error(`Expected 600 memory scenes after apply, got ${Object.keys(scenes).length}`);
 write('memory-scenes.json',scenes);write('visual-mnemonics.json',visuals);write(manifestFile,manifest);
 console.log(JSON.stringify({memoryScenes:Object.keys(scenes).length,visualMnemonics:Object.keys(visuals).length,installed:manifest.cards.length},null,2));
}

if(process.argv.includes('--apply'))apply();else build();
