import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CONTENT_DATA_FILES, OFFLINE_CORE_FILES } from './content-manifest';
import { buildJourneyCurriculum } from '../domains/curriculum/journey-curriculum';

type Word = { id: string; word: string; reading?: string; [key: string]: unknown };
type Asset = { url: string; bytes: number; sha256: string; kind: 'text' | 'images' | 'audio' };
export async function buildOfflineCatalog(root: string, production: boolean) {
  const assets = new Map<string,Asset>();
  const json = async (file: string) => JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
  async function add(raw: string): Promise<string | null> {
    const url=raw.replace(/^\.\//,'').split('?')[0] || 'index.html';
    if(url.includes('..')||/^(https?:|data:|blob:)/.test(url))return null;
    if(assets.has(url))return url;
    try { const stat=await fs.stat(path.join(root,url)); if(!stat.isFile())return null;
      const sha256=createHash('sha256').update(await fs.readFile(path.join(root,url))).digest('hex');
      assets.set(url,{url,bytes:stat.size,sha256,kind:/\.(mp3|m4a|aac|ogg|wav)$/.test(url)?'audio':/\.(png|webp|jpg|jpeg|svg|gif)$/.test(url)?'images':'text'}); return url;
    }catch{return null;}
  }
  async function references(value: unknown, collected=new Set<string>()): Promise<Set<string>> {
    if(typeof value==='string'&&/\.(mp3|m4a|aac|ogg|wav|png|webp|jpg|jpeg|svg|gif)(?:\?.*)?$/.test(value)) {
      const isAudio=/\.(mp3|m4a|aac|ogg|wav)(?:\?.*)?$/.test(value);
      const url=await add(isAudio&&!value.includes('/')?`media/${value}`:value) || await add(`media/${value}`);
      if(url)collected.add(url);
    } else if(value&&typeof value==='object') for(const child of Object.values(value))await references(child,collected);
    return collected;
  }
  const core=new Set<string>();
  for(const entry of OFFLINE_CORE_FILES){const url=await add(entry);if(url)core.add(url);}
  const html=await fs.readFile(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const url=await add(match[1]||'');if(url)core.add(url);}
  if(production){for(const name of await fs.readdir(path.join(root,'assets'))){const url=await add(`assets/${name}`);if(url)core.add(url);}}
  const vocabulary: Word[]=await json('data/vocabulary.json');
  const katakana=await json('data/katakana-core-10k.json');
  const extra: Word[]=Array.isArray(katakana)?katakana:(katakana.records||[]);
  const words=[...vocabulary,...extra];
  const scenes=await json('memory-scenes.json'),visual=await json('visual-mnemonics.json');
  const wordAssets:Record<string,string[]>={};
  for(const word of words){const refs=await references(word);await references(visual[`${word.word}|${word.reading||word.word}`]||scenes[`${word.word}|${word.reading||word.word}`],refs);wordAssets[word.id]=[...refs];}
  const curriculum=buildJourneyCurriculum(words);
  const kanaAssets=await references(await json('data/kana.json'));
  const groups=curriculum.map(lesson=>({id:`lesson-${lesson.lessonNumber}`,title:`Lesson ${lesson.lessonNumber} · ${lesson.arc.title}`,wordIds:[...lesson.wordIds],urls:['data/vocabulary.json','memory-scenes.json','visual-mnemonics.json',...[...new Set(lesson.wordIds.flatMap(id=>wordAssets[id]||[]))],...kanaAssets],speechOnly:false}));
  const travel=await json('data/japan-ready-v90.json');
  for(const scenario of travel.scenarios){groups.push({id:`travel-${scenario.id}`,title:scenario.title,wordIds:[],urls:['data/japan-ready-v90.json','media/guides/aiko-guide-icon.webp','media/guides/aiko-guide-portrait.webp'],speechOnly:true});}
  for(const file of CONTENT_DATA_FILES)await references(await json(file));
  // Avatar evolutions and guides are selected dynamically from progress rather than JSON.
  for(const directory of ['media/profiles','media/guides/sensei','media/branding']) {
    try{for(const name of await fs.readdir(path.join(root,directory))){const url=await add(`${directory}/${name}`);if(url)core.add(url);}}catch{/* Optional art directory. */}
  }
  return {schemaVersion:1,production,core:[...core],assets:[...assets.values()],groups};
}
