'use strict';
/*
 * Kaishi Quest v11.25.13
 *
 * This intentionally updates the existing lesson patch source file
 * (patch-11.25.7.js) rather than adding another overlay patch.
 *
 * 1. Lesson activities and roadmap use the same scheduler.
 * 2. Picture Matching is not injected into every lesson.
 * 3. Listening remains routine and is not the roadmap headline.
 * 4. Sentence Understanding / Audio Reflex are opt-in only when a real
 *    lesson adapter exists; no unsupported skill is fabricated.
 * 5. SRS Battle remains a Journey Key Event, not a lesson activity.
 * 6. The fifth-card checkpoint saves silently and continues normally.
 *    The checkpoint branch is changed at next(), so no dialog is opened
 *    and no function is left waiting for a dialog result.
 */
(() => {
  const PATCH = '11.25.13';
  const log = message => {
    try { window.kaishiLog?.('patch', `[${PATCH}] ${message}`); } catch (_) {}
  };

  const sceneAvailable = word => {
    try {
      return Boolean(word && typeof memoryScenes === 'object' &&
        memoryScenes[sceneKey(word)]?.file);
    } catch (_) { return false; }
  };

  const audioAvailable = word => Boolean(word?.wordAudio);

  const hasAdapter = id => {
    try {
      const a = window.KaishiLessonActivities;
      if (!a) return false;
      if (id === 'sentence-understanding') return typeof a.sentenceUnderstanding === 'function';
      if (id === 'audio-reflex') return typeof a.audioReflex === 'function';
      if (id === 'kanji-gate') return typeof a.kanjiGate === 'function';
    } catch (_) {}
    return false;
  };

  /*
   * Only activities that have a real lesson renderer can be inserted.
   * Picture/listening use the application's existing card renderer.
   */
  const ACTIVITY_RULES = [
    {
      id:'picture', icon:'🌄', label:'Picture Matching',
      core:true, roadmap:true, unlockWords:5, cadence:3,
      eligible: words => words.some(sceneAvailable),
      build: (words) => {
        const target = words.find(sceneAvailable);
        return target ? {v:target, skill:'picture', pictureMode:'picture-word',
          activityScheduleId:'picture'} : null;
      }
    },
    {
      id:'listening', icon:'🎧', label:'Listening',
      core:true, roadmap:false, unlockWords:8, cadence:1,
      eligible: words => words.some(audioAvailable),
      build: words => {
        const target = words.find(audioAvailable);
        return target ? {v:target, skill:'listening', activityScheduleId:'listening'} : null;
      }
    },
    {
      id:'sentence-understanding', icon:'📝', label:'Sentence Understanding',
      core:true, roadmap:true, unlockWords:5, cadence:3,
      eligible: words => words.length > 0 && hasAdapter('sentence-understanding'),
      build: words => {
        try { return window.KaishiLessonActivities.sentenceUnderstanding(words[0], words); }
        catch (_) { return null; }
      }
    },
    {
      id:'audio-reflex', icon:'🔊', label:'Audio Reflex Match',
      core:true, roadmap:true, unlockWords:8, cadence:3,
      eligible: words => words.some(audioAvailable) && hasAdapter('audio-reflex'),
      build: words => {
        try { return window.KaishiLessonActivities.audioReflex(words.find(audioAvailable) || words[0], words); }
        catch (_) { return null; }
      }
    },
    {
      id:'karuta', icon:'🎴', label:'Karuta Challenge',
      core:false, roadmap:true, unlockWords:12,
      eligible: words => words.some(w => audioAvailable(w) && sceneAvailable(w))
    },
    {
      id:'theatre', icon:'🎭', label:'Theatre',
      core:false, roadmap:true, unlockWords:12, eligible: () => true
    },
    {
      id:'manga', icon:'📖', label:'Manga Stories',
      core:false, roadmap:true, unlockWords:25, eligible: () => true
    }
  ];

  const ruleFor = id => ACTIVITY_RULES.find(r => r.id === id) || null;

  const introducedCountAtChapter = (chapterIndex, currentChapterIndex) => {
    const base = Math.max(0, Number(vocab?.filter?.(wordIntroduced)?.length || 0));
    const currentWords = typeof chapterWords === 'function'
      ? chapterWords(currentChapterIndex).length : 3;
    return base + Math.max(0, chapterIndex - currentChapterIndex) * currentWords;
  };

  const scheduleForLesson = (chapterIndex, currentChapterIndex, words, opts = {}) => {
    const introduced = opts.introduced ??
      introducedCountAtChapter(chapterIndex, currentChapterIndex);

    const result = {
      chapterIndex,
      lessonNumber: chapterIndex + 1,
      core: [],
      sideQuests: [],
      available: []
    };

    ACTIVITY_RULES.forEach(rule => {
      if (introduced < rule.unlockWords || !rule.eligible(words)) return;
      result.available.push(rule.id);

      if (rule.core) {
        const cadence = Math.max(1, Number(rule.cadence || 1));
        const relative = chapterIndex - (currentChapterIndex + 1);
        if (relative % cadence === 0 || opts.forceFirst) result.core.push(rule.id);
      } else {
        result.sideQuests.push(rule.id);
      }
    });

    /*
     * Keep lessons focused. Select at most one distinctive immersive activity.
     * Listening may accompany it.
     */
    const distinctive = result.core.filter(id => ruleFor(id)?.roadmap);
    if (distinctive.length > 1) {
      const keep = distinctive[0];
      result.core = result.core.filter(id => id === keep || id === 'listening');
    }

    return result;
  };

  const buildCard = (id, words) => {
    const rule = ruleFor(id);
    if (!rule?.build) return null;
    try { return rule.build(words); } catch (_) { return null; }
  };

  /*
   * Lesson insertion uses the same schedule as the roadmap.
   * It never injects Picture Matching solely because scene assets exist.
   */
  function patchMakeSession() {
    if (window.__kaishi113MakeSessionPatched || typeof window.makeSession !== 'function') {
      return Boolean(window.__kaishi113MakeSessionPatched);
    }

    const original = window.makeSession;
    const source = Function.prototype.toString.call(original);
    const marker = 'clearMissionResume();index=0;current=null;showJourneySessionPreview';

    if (!source.includes(marker)) {
      log('makeSession marker not found; leaving original lesson builder untouched');
      return false;
    }

    const injection = `(() => {
      try {
        const chapter = chapterMode ? chapterIndex : currentWordChapterIndex();
        const lessonWords = typeof chapterWords === 'function' ? chapterWords(chapter) : [];
        const introduced = Number(vocab?.filter?.(wordIntroduced)?.length || 0);
        const schedule = window.KaishiActivitySchedule.scheduleForLesson(
          chapter, currentWordChapterIndex(), lessonWords,
          { introduced, forceFirst: false }
        );

        const existing = new Set(session.map(item => item?.activityScheduleId || item?.skill));
        const additions = [];

        for (const id of schedule.core) {
          if (existing.has(id)) continue;
          const card = window.KaishiActivitySchedule.buildCard(id, lessonWords);
          if (card) additions.push(card);
        }

        additions.forEach(item => {
          const limit = typeof MISSION_CARD_LIMIT === 'number' ? MISSION_CARD_LIMIT : 15;
          if (session.length >= limit) session.pop();
          const position = Math.min(session.length, Math.max(0, Math.floor(session.length * .65)));
          session.splice(position, 0, item);
        });
      } catch (error) {
        try { window.kaishiLog?.('patch','[11.25.13] activity insertion failed: '+(error?.message||error)); } catch (_) {}
      }
    })();${marker}`;

    try {
      const patched = (0, eval)(`(${source.replace(marker, injection)})`);
      window.makeSession = patched;
      window.__kaishi113MakeSessionPatched = true;
      log('lesson scheduler updated');
      return true;
    } catch (error) {
      log(`makeSession patch failed: ${error?.message || error}`);
      return false;
    }
  }

  /*
   * Fifth-card checkpoint.
   * Patch the checkpoint branch itself rather than suppressing dialog.showModal().
   * This is the critical freeze fix.
   */
  const savingBubble = () => {
    let bubble = document.getElementById('kaishiSavingProgress');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'kaishiSavingProgress';
      bubble.setAttribute('role','status');
      bubble.setAttribute('aria-live','polite');
      Object.assign(bubble.style, {
        position:'fixed', left:'50%', bottom:'24px',
        transform:'translateX(-50%)', zIndex:'2147483647',
        padding:'10px 16px', borderRadius:'999px',
        background:'rgba(15,23,42,.94)', color:'#fff',
        font:'600 14px system-ui,sans-serif',
        boxShadow:'0 8px 30px rgba(0,0,0,.22)',
        opacity:'0', transition:'opacity .18s ease',
        pointerEvents:'none'
      });
      document.body.appendChild(bubble);
    }
    bubble.textContent = 'Saving progress';
    bubble.style.opacity = '1';
    clearTimeout(bubble.__timer);
    bubble.__timer = setTimeout(() => bubble.style.opacity='0', 1500);
  };

  function findCheckpointBlocks(source) {
    const hits = [];
    let from = 0;

    while (true) {
      const idx = source.indexOf('CHECKPOINT_INTERVAL', from);
      if (idx < 0) break;

      let pos = idx;
      while (pos >= 0) {
        const ifIdx = source.lastIndexOf('if', pos);
        if (ifIdx < 0) break;

        const open = source.indexOf('(', ifIdx + 2);
        if (open < 0 || open > idx) { pos = ifIdx - 1; continue; }

        let depth = 0, close = -1, quote = null, escaped = false;
        for (let i=open; i<source.length; i++) {
          const ch=source[i];
          if (quote) {
            if (escaped) escaped=false;
            else if (ch==='\\\\') escaped=true;
            else if (ch===quote) quote=null;
            continue;
          }
          if (ch==='\"'||ch===\"'\"||ch==='`') { quote=ch; continue; }
          if (ch==='(') depth++;
          else if (ch===')' && --depth===0) { close=i; break; }
        }

        if (close > idx && source.slice(open+1,close).includes('CHECKPOINT_INTERVAL')) {
          let bodyStart=close+1;
          while (/\\s/.test(source[bodyStart]||'')) bodyStart++;

          if (source[bodyStart]==='{') {
            let bdepth=0, bodyEnd=-1, q=null, esc=false;
            for (let i=bodyStart;i<source.length;i++) {
              const ch=source[i];
              if(q){
                if(esc) esc=false;
                else if(ch==='\\\\') esc=true;
                else if(ch===q) q=null;
                continue;
              }
              if(ch==='\"'||ch===\"'\"||ch==='`'){q=ch;continue;}
              if(ch==='{') bdepth++;
              else if(ch==='}' && --bdepth===0){bodyEnd=i;break;}
            }
            if(bodyEnd>bodyStart) hits.push({bodyStart,bodyEnd});
          }
          break;
        }
        pos=ifIdx-1;
      }
      from=idx+'CHECKPOINT_INTERVAL'.length;
    }
    return [...new Map(hits.map(h=>[h.bodyStart,h])).values()];
  }

  function patchCheckpointInNext() {
    if (window.__kaishi113CheckpointPatched || typeof window.next !== 'function') {
      return Boolean(window.__kaishi113CheckpointPatched);
    }

    const source = Function.prototype.toString.call(window.next);
    if (!source.includes('CHECKPOINT_INTERVAL')) {
      log('next() has no checkpoint interval; checkpoint patch not installed');
      return false;
    }

    const hits = findCheckpointBlocks(source);
    if (!hits.length) {
      log('checkpoint condition found but checkpoint block could not be located');
      return false;
    }

    let patchedSource = source;
    hits.sort((a,b)=>b.bodyStart-a.bodyStart).forEach(hit => {
      patchedSource =
        patchedSource.slice(0,hit.bodyStart) +
        '{ saveMissionResume(); savingBubble(); }' +
        patchedSource.slice(hit.bodyEnd+1);
    });

    try {
      window.next = (0,eval)(`(${patchedSource})`);
      window.__kaishi113CheckpointPatched = true;
      log(`checkpoint branch updated: ${hits.length} save point(s) now save silently`);
      return true;
    } catch(error) {
      log(`checkpoint source update failed: ${error?.message||error}`);
      return false;
    }
  }

  window.KaishiActivitySchedule = {
    version: PATCH,
    rules: ACTIVITY_RULES,
    ruleFor,
    scheduleForLesson,
    buildCard
  };

  function start() {
    if (window.__kaishi113Started) return;
    window.__kaishi113Started = true;

    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      const lesson=patchMakeSession();
      const checkpoint=patchCheckpointInNext();

      if ((lesson && checkpoint) || attempts>120) clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded',start,{once:true});
  } else {
    start();
  }
})();
