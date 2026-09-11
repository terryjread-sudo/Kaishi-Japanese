export type SeasonalHeroId='spring'|'summer'|'autumn'|'winter'|'halloween'|'christmas'|'new-year'|'tanabata';

export interface SeasonalHero {
  id: SeasonalHeroId;
  src: string;
  alt: string;
}

const heroes:Record<SeasonalHeroId,SeasonalHero>={
  spring:{id:'spring',src:'media/experimental/kaishi-journey-hero.png',alt:'Kaishi Japanese learners enjoying spring in Japan'},
  summer:{id:'summer',src:'media/experimental/heroes/summer.jpg',alt:'Kaishi Japanese learners enjoying summer in Japan'},
  autumn:{id:'autumn',src:'media/experimental/heroes/autumn.jpg',alt:'Kaishi Japanese learners enjoying autumn in Japan'},
  winter:{id:'winter',src:'media/experimental/heroes/winter.jpg',alt:'Kaishi Japanese learners enjoying winter in Japan'},
  halloween:{id:'halloween',src:'media/experimental/heroes/halloween.jpg',alt:'Kaishi Japanese learners enjoying a friendly Halloween evening in Japan'},
  christmas:{id:'christmas',src:'media/experimental/heroes/christmas.jpg',alt:'Kaishi Japanese learners enjoying a warm Christmas in Japan'},
  'new-year':{id:'new-year',src:'media/experimental/heroes/new-year.jpg',alt:'Kaishi Japanese learners celebrating Japanese New Year'},
  tanabata:{id:'tanabata',src:'media/experimental/heroes/tanabata.jpg',alt:'Kaishi Japanese learners enjoying Tanabata in Japan'},
};

const eventWindows:[SeasonalHeroId,number,number][]=[
  ['halloween',1015,1102],
  ['christmas',1201,1226],
  ['new-year',1227,115],
  ['tanabata',701,710],
];

const seasonWindows:[SeasonalHeroId,number,number][]=[
  ['spring',301,531],
  ['summer',601,831],
  ['autumn',901,1130],
  ['winter',1201,228],
];

function dateKey(date:Date){return(date.getMonth()+1)*100+date.getDate()}
function inWindow(value:number,start:number,end:number){return start<=end?value>=start&&value<=end:value>=start||value<=end}

export function seasonalHeroForDate(date:Date=new Date()):SeasonalHero{
  const value=dateKey(date);
  const match=[...eventWindows,...seasonWindows].find(([,start,end])=>inWindow(value,start,end));
  return heroes[match?.[0]||'spring'];
}

export function seasonalHeroCatalog(){return Object.values(heroes)}

export function installSeasonalHero(){
  if(typeof document==='undefined')return()=>{};
  const selector='.experimental-journey-hero-art,#firstLaunchOverlay .first-launch-visual img';
  const loaded=new Set<string>(),pending=new Map<string,Promise<boolean>>();
  let scheduled=false;
  const preload=(src:string)=>{
    if(loaded.has(src))return Promise.resolve(true);
    const existing=pending.get(src);if(existing)return existing;
    const promise=new Promise<boolean>(resolve=>{const image=new Image();image.decoding='async';image.onload=()=>{loaded.add(src);resolve(true)};image.onerror=()=>resolve(false);image.src=src}).finally(()=>pending.delete(src));
    pending.set(src,promise);return promise;
  };
  const apply=()=>{
    scheduled=false;
    const selected=seasonalHeroForDate();
    document.querySelectorAll<HTMLImageElement>(selector).forEach(image=>{
      if(image.dataset.seasonalHero===selected.id)return;
      void preload(selected.src).then(ok=>{if(!ok||!image.isConnected)return;image.src=selected.src;image.alt=selected.alt;image.dataset.seasonalHero=selected.id});
    });
  };
  const schedule=()=>{if(scheduled)return;scheduled=true;window.requestAnimationFrame(apply)};
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
  schedule();
  let midnightTimer=0;
  const refreshAtMidnight=()=>{schedule();midnightTimer=window.setTimeout(refreshAtMidnight,Math.max(60000,new Date(new Date().setHours(24,0,0,0)).getTime()-Date.now()))};
  midnightTimer=window.setTimeout(refreshAtMidnight,Math.max(60000,new Date(new Date().setHours(24,0,0,0)).getTime()-Date.now()));
  document.addEventListener('visibilitychange',schedule);
  return()=>{observer.disconnect();window.clearTimeout(midnightTimer);document.removeEventListener('visibilitychange',schedule)};
}
