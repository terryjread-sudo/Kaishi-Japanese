/*
 * Kotoba Rain — 言葉の雨
 * "Catch the match" falling-word game for Kaishi Quest.
 *
 * INTEGRATION NOTES
 * - Load this file with a plain <script> tag AFTER app.js (it reads app.js's
 *   top-level `vocab`, `progress`, `meta`, and reuses app.js's own
 *   `grade`, `save`, `distractors`, `shuffle`, `wordIntroduced`, `esc`,
 *   `show`, `toast`, `$`, `updateHome`).
 * - It does NOT touch app.js's session/index/current/battle/battleActive
 *   state, so it can never collide with the SRS Decay Battle, Kotoba
 *   Colosseum, or any other activity. It is purely additive.
 * - It only needs one new screen element (#wordRain) and one launch button
 *   in index.html — see the accompanying README for the exact markup.
 *
 * GAMEPLAY
 * - Your platform sits at the bottom and displays a target word (Japanese
 *   or English, chosen at random each round).
 * - Words in the OTHER language fall from the top — one correct
 *   translation plus a growing number of decoys as rounds progress. Each
 *   falling word stays in its own fixed lane, so they never cross paths.
 * - Drag/tap to move the platform under the correct falling word to catch
 *   it. Arrow keys also work on desktop.
 * - You start with 60 seconds on the clock, ticking down in real time.
 *   Missing the correct word (letting it reach the bottom uncaught) costs
 *   5 extra seconds; catching a wrong word costs 10 extra seconds.
 * - The run ends when the clock hits zero. A summary shows accuracy and,
 *   importantly, which specific words you got right vs. wrong.
 * - Only words you've already met (wordIntroduced) are used.
 */
(() => {
  'use strict';

  const START_SECONDS = 60;
  const PENALTY_MISS = 5;
  const PENALTY_WRONG = 10;
  const MAX_DISTRACTORS = 3;
  const ROUND_GAP_MS = 450;

  let requestedWordIds = null;
  let requestedSource = 'bonus';

  let wr = null;
  let dragging = false;

  function ensureWordRainScreen() {
    const screen = $('#wordRain');
    const card = $('#wrCard');
    if (screen && card) return true;
    console.error('[Kotoba Rain] Required static screen markup is missing');
    toast('Kotoba Rain could not open — please refresh Kaishi Quest');
    return false;
  }

  // --- Small synthesized SFX (no audio files needed) ---------------------
  const SFXR = (() => {
    let ctx = null;
    let muted = false;
    function ac() {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, start, dur, opts = {}) {
      if (muted) return;
      try {
        const c = ac();
        if (!c) return;
        const { type = 'square', volume = 0.16, glideTo = null } = opts;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + start);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), c.currentTime + start + dur);
        gain.gain.setValueAtTime(0, c.currentTime + start);
        gain.gain.linearRampToValueAtTime(volume, c.currentTime + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(c.currentTime + start);
        osc.stop(c.currentTime + start + dur + 0.02);
      } catch (e) {
        /* never let SFX break the game */
      }
    }
    return {
      isMuted: () => muted,
      toggle: () => {
        muted = !muted;
        return muted;
      },
      correct() {
        tone(880, 0, 0.09, { type: 'square', volume: 0.18 });
        tone(1180, 0.06, 0.1, { type: 'square', volume: 0.14 });
      },
      wrong() {
        tone(220, 0, 0.24, { type: 'sawtooth', volume: 0.18, glideTo: 80 });
      },
      missed() {
        tone(300, 0, 0.2, { type: 'sine', volume: 0.14, glideTo: 140 });
      },
      gameover() {
        [523, 440, 349, 262].forEach((f, i) => tone(f, i * 0.14, 0.26, { type: 'triangle', volume: 0.16 }));
      },
    };
  })();

  function pool() {
    const seen = vocab.filter(wordIntroduced);
    const weighted = seen
      .map(v => {
        const sm = Number(progress[v.id]?.skills?.meaning?.strength || 0);
        const sp = Number(progress[v.id]?.skills?.production?.strength || 0);
        return { v, strength: Math.min(sm, sp) };
      })
      .sort((a, b) => a.strength - b.strength)
      .map(x => x.v);

    if (Array.isArray(requestedWordIds) && requestedWordIds.length) {
      const requested = requestedWordIds
        .map(id => seen.find(v => v.id === id))
        .filter(Boolean)
        .sort((a, b) => {
          const sa = Math.min(
            Number(progress[a.id]?.skills?.meaning?.strength || 0),
            Number(progress[a.id]?.skills?.production?.strength || 0)
          );
          const sb = Math.min(
            Number(progress[b.id]?.skills?.meaning?.strength || 0),
            Number(progress[b.id]?.skills?.production?.strength || 0)
          );
          return sa - sb;
        });
      const fill = weighted.filter(v => !requested.includes(v));
      return shuffle([...requested, ...fill.slice(0, Math.max(0, 6 - requested.length))]);
    }

    const top = weighted.slice(0, Math.max(20, Math.ceil(weighted.length * 0.6)));
    return shuffle(top.length >= 4 ? top : seen);
  }

  function ensureStyles() {
    if ($('#wrStyles')) return;
    const style = document.createElement('style');
    style.id = 'wrStyles';
    style.textContent = `
      .wr-hud{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;font-size:.8rem}
      .wr-hud b{background:#eff6ff;border-radius:12px;padding:6px 10px}
      .wr-hud b.wr-time-low{background:#fee2e2;color:#991b1b}
      .wr-mute{background:#eff6ff;border-radius:12px;padding:6px 12px;font-size:1rem;line-height:1}
      .wr-playfield{position:relative;height:340px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#dbeafe,#eef2ff 60%,#e0e7ff);border:1px solid #c7d2fe;touch-action:none}
      .wr-playfield:before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,#93c5fd55 1px,transparent 1.5px);background-size:22px 22px;opacity:.5}
      .wr-drop{position:absolute;top:-14%;transform:translate(-50%,0);background:#172554;color:#fff;padding:8px 12px;border-radius:10px;font-weight:800;font-size:.85rem;max-width:110px;text-align:center;line-height:1.2;box-shadow:0 5px 14px #17255440;transition:top linear}
      .wr-drop.correct{background:#16a34a}
      .wr-drop.wrong{background:#dc2626}
      .wr-drop.wr-missed-flag{background:#f59e0b;animation:wrPulse .5s ease}
      @keyframes wrPulse{0%,100%{transform:translate(-50%,0) scale(1)}50%{transform:translate(-50%,0) scale(1.15)}}
      .wr-platform{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);min-width:78px;max-width:120px;background:#fff;border:3px solid #2563eb;border-radius:14px;padding:10px 10px;text-align:center;font-weight:900;font-size:.95rem;color:#172554;box-shadow:0 8px 18px #17255430;transition:left .05s linear,border-color .2s ease,background .2s ease}
      .wr-platform small{display:block;font-weight:700;font-size:.6rem;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
      .wr-platform.wr-correct{border-color:#16a34a;background:#dcfce7}
      .wr-platform.wr-wrong{border-color:#dc2626;background:#fee2e2}
      .wr-controls{display:flex;gap:10px;margin-top:12px}
      .wr-controls button{flex:1;background:#e2e8f0;font-size:1.3rem;padding:14px}
      .wr-hint{text-align:center;font-size:.78rem;color:#64748b;margin-top:8px}
      .wr-review{display:grid;gap:8px;margin-top:6px}
      .wr-review-group b{display:block;margin-bottom:6px}
      .wr-review-item{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;background:#f8fafc;font-size:.85rem}
      .wr-review-item span.jp{font-weight:800}
      .wr-review.wr-right .wr-review-item{background:#f0fdf4}
      .wr-review.wr-wrong-list .wr-review-item{background:#fef2f2}
    `;
    document.head.appendChild(style);
  }

  function fieldRect() {
    const f = $('#wrPlayfield');
    return f ? f.getBoundingClientRect() : null;
  }

  function movePlatformToClientX(clientX) {
    const rect = fieldRect();
    if (!rect) return;
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(8, Math.min(92, pct));
    wr.platformPct = pct;
    applyPlatformPos();
  }

  function nudgePlatform(delta) {
    if (!wr) return;
    wr.platformPct = Math.max(8, Math.min(92, wr.platformPct + delta));
    applyPlatformPos();
  }

  function applyPlatformPos() {
    const plat = $('#wrPlatform');
    if (plat) plat.style.left = wr.platformPct + '%';
  }

  function flashPlatform(kind) {
    const plat = $('#wrPlatform');
    if (!plat) return;
    plat.classList.remove('wr-correct', 'wr-wrong');
    void plat.offsetWidth;
    plat.classList.add(kind === 'correct' ? 'wr-correct' : 'wr-wrong');
    setTimeout(() => plat.classList.remove('wr-correct', 'wr-wrong'), 400);
  }

  function updateHud() {
    const timeEl = $('#wrTime');
    if (timeEl) {
      timeEl.textContent = `⏱ ${wr.timeLeft}s`;
      timeEl.classList.toggle('wr-time-low', wr.timeLeft <= 15);
    }
    const roundEl = $('#wrRound');
    if (roundEl) roundEl.textContent = `Round ${wr.roundsPlayed + 1}`;
  }

  function startWordRain(options = {}) {
    if (options instanceof Event) options = {};
    if (!ensureWordRainScreen()) return;
    requestedWordIds = Array.isArray(options?.wordIds) ? [...new Set(options.wordIds)] : null;
    requestedSource = options?.source || 'bonus';
    const words = pool();
    if (words.length < 4) {
      toast('Study a few more words first — Kotoba Rain needs at least 4 met words');
      return;
    }
    ensureStyles();
    wr = {
      deck: words,
      deckIndex: 0,
      lastWordId: null,
      timeLeft: START_SECONDS,
      running: true,
      roundsPlayed: 0,
      correctCount: 0,
      wrongCount: 0,
      missCount: 0,
      history: [],
      platformPct: 50,
      activeItems: [],
      roundResolved: false,
      rafId: null,
      roundTimeoutId: null,
      clockId: null,
      promptWord: null,
      promptLang: null,
      startedAt: Date.now(),
    };
    show('wordRain');
    renderShell();
    startClock();
    nextRound();
  }

  function renderShell() {
    $('#wrCard').innerHTML = `
      <div class="eyebrow">Kotoba Rain · 言葉の雨</div>
      <div class="wr-hud">
        <b id="wrTime">⏱ ${wr.timeLeft}s</b>
        <b id="wrRound">Round 1</b>
        <button id="wrMute" class="wr-mute" aria-label="${SFXR.isMuted() ? 'Unmute sound' : 'Mute sound'}">${SFXR.isMuted() ? '🔇' : '🔊'}</button>
      </div>
      <section class="wr-playfield" id="wrPlayfield">
        <div class="wr-platform" id="wrPlatform" style="left:${wr.platformPct}%"><small>Catch</small><span id="wrPlatformLabel">…</span></div>
      </section>
      <div class="wr-controls">
        <button id="wrLeft" aria-label="Move left">◀</button>
        <button id="wrRight" aria-label="Move right">▶</button>
      </div>
      <p class="wr-hint">Drag anywhere on the field, or use the arrows / arrow keys, to catch the matching word as it falls.</p>
    `;
    const field = $('#wrPlayfield');
    field.addEventListener('pointerdown', e => {
      dragging = true;
      movePlatformToClientX(e.clientX);
    });
    field.addEventListener('pointermove', e => {
      if (dragging) movePlatformToClientX(e.clientX);
    });
    window.addEventListener('pointerup', () => (dragging = false));
    $('#wrLeft').addEventListener('pointerdown', () => nudgePlatform(-10));
    $('#wrRight').addEventListener('pointerdown', () => nudgePlatform(10));
    const muteBtn = $('#wrMute');
    muteBtn.onclick = () => {
      SFXR.toggle();
      muteBtn.textContent = SFXR.isMuted() ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', SFXR.isMuted() ? 'Unmute sound' : 'Mute sound');
    };
  }

  function drawNextWord() {
    if (wr.deckIndex >= wr.deck.length) {
      wr.deck = shuffle(pool());
      wr.deckIndex = 0;
    }
    let v = wr.deck[wr.deckIndex++];
    if (v.id === wr.lastWordId && wr.deck.length > 1) {
      v = wr.deck[wr.deckIndex] || v;
      wr.deckIndex++;
    }
    wr.lastWordId = v.id;
    return v;
  }

  function currentRoundDurationMs() {
    return Math.max(2500, 5200 - wr.roundsPlayed * 150);
  }

  function nextRound() {
    if (!wr.running) return;
    wr.roundResolved = false;
    const v = drawNextWord();
    wr.promptWord = v;
    wr.promptLang = Math.random() < 0.5 ? 'jp' : 'en';
    const answerKey = wr.promptLang === 'jp' ? 'meaning' : 'word';
    const promptText = wr.promptLang === 'jp' ? v.word : v.meaning;
    const correctText = wr.promptLang === 'jp' ? v.meaning : v.word;
    const distractorCount = Math.min(MAX_DISTRACTORS, 1 + Math.floor(wr.roundsPlayed / 3));
    const wrongTexts = distractors(v, answerKey, distractorCount);
    const items = shuffle([{ text: correctText, isCorrect: true }, ...wrongTexts.map(t => ({ text: t, isCorrect: false }))]);

    const label = $('#wrPlatformLabel');
    if (label) label.textContent = promptText;

    spawnFallingItems(items);
    updateHud();
  }

  function spawnFallingItems(items) {
    const field = $('#wrPlayfield');
    field.querySelectorAll('.wr-drop').forEach(el => el.remove());
    const n = items.length;
    wr.activeItems = items.map((item, i) => {
      const el = document.createElement('div');
      el.className = 'wr-drop';
      el.textContent = item.text;
      const xPct = Math.max(10, Math.min(90, ((i + 0.5) / n) * 100));
      el.style.left = xPct + '%';
      el.style.top = '-14%';
      field.appendChild(el);
      return { el, isCorrect: item.isCorrect, text: item.text };
    });

    const durationMs = currentRoundDurationMs();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wr.activeItems.forEach(item => {
          item.el.style.transitionDuration = durationMs + 'ms';
          item.el.style.top = '112%';
        });
      });
    });

    wr.roundTimeoutId = setTimeout(() => handleRoundTimeout(), durationMs + 90);
    wr.rafId = requestAnimationFrame(collisionTick);
  }

  function collisionTick() {
    if (!wr || !wr.running || wr.roundResolved) return;
    const plat = $('#wrPlatform');
    if (plat) {
      const platRect = plat.getBoundingClientRect();
      for (const item of wr.activeItems) {
        const r = item.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cy >= platRect.top && cy <= platRect.bottom && cx >= platRect.left && cx <= platRect.right) {
          handleCatch(item);
          return;
        }
      }
    }
    wr.rafId = requestAnimationFrame(collisionTick);
  }

  function clearRoundTimers() {
    if (wr.rafId) cancelAnimationFrame(wr.rafId);
    if (wr.roundTimeoutId) clearTimeout(wr.roundTimeoutId);
    wr.rafId = null;
    wr.roundTimeoutId = null;
  }

  function clearFallingItemsSoon(delay) {
    setTimeout(() => {
      const field = $('#wrPlayfield');
      if (field) field.querySelectorAll('.wr-drop').forEach(el => el.remove());
    }, delay);
  }

  function recordRound(ok, action) {
    const v = wr.promptWord;
    const skill = wr.promptLang === 'jp' ? 'meaning' : 'production';
    grade(v, skill, ok ? 3 : 1, ok, false);
    wr.history.push({ id: v.id, ok, action });
    if (ok) wr.correctCount++;
    else if (action === 'wrong') wr.wrongCount++;
    else wr.missCount++;
  }

  function maybeEndOrContinue() {
    wr.roundsPlayed++;
    if (wr.timeLeft <= 0 || !wr.running) {
      endGame();
      return;
    }
    setTimeout(() => {
      if (wr.running) nextRound();
    }, ROUND_GAP_MS);
  }

  function handleCatch(item) {
    if (wr.roundResolved) return;
    wr.roundResolved = true;
    clearRoundTimers();
    item.el.classList.add(item.isCorrect ? 'correct' : 'wrong');
    if (item.isCorrect) {
      SFXR.correct();
      flashPlatform('correct');
      recordRound(true, 'caught');
    } else {
      SFXR.wrong();
      flashPlatform('wrong');
      subtractTime(PENALTY_WRONG);
      recordRound(false, 'wrong');
    }
    clearFallingItemsSoon(260);
    maybeEndOrContinue();
  }

  function handleRoundTimeout() {
    if (wr.roundResolved) return;
    wr.roundResolved = true;
    clearRoundTimers();
    const correctItem = wr.activeItems.find(i => i.isCorrect);
    if (correctItem) correctItem.el.classList.add('wr-missed-flag');
    SFXR.missed();
    subtractTime(PENALTY_MISS);
    recordRound(false, 'missed');
    clearFallingItemsSoon(320);
    maybeEndOrContinue();
  }

  function subtractTime(n) {
    wr.timeLeft = Math.max(0, wr.timeLeft - n);
    updateHud();
    if (wr.timeLeft <= 0) wr.running = false;
  }

  function startClock() {
    wr.clockId = setInterval(() => {
      if (!wr || !wr.running) return;
      wr.timeLeft = Math.max(0, wr.timeLeft - 1);
      updateHud();
      if (wr.timeLeft <= 0) {
        wr.running = false;
      }
    }, 1000);
  }

  function recordRunMeta() {
    meta.totalWordRainRuns = Number(meta.totalWordRainRuns || 0) + 1;
    save();
  }

  function endGame() {
    if (!wr) return;
    wr.running = false;
    if (wr.clockId) clearInterval(wr.clockId);
    clearRoundTimers();
    SFXR.gameover();
    showSummary();
  }

  function showSummary() {
    const total = wr.correctCount + wr.wrongCount + wr.missCount;
    const accuracy = total ? Math.round((wr.correctCount / total) * 100) : 0;
    const rightWords = [...new Map(wr.history.filter(h => h.ok).map(h => [h.id, h])).keys()].map(id => vocab.find(v => v.id === id)).filter(Boolean);
    const wrongWords = [...new Map(wr.history.filter(h => !h.ok).map(h => [h.id, h])).keys()].map(id => vocab.find(v => v.id === id)).filter(Boolean);
    recordRunMeta();
    updateHome();

    $('#wrCard').innerHTML = `
      <div class="eyebrow">Kotoba Rain results</div>
      <h2 class="battle-summary-title">Time's up!</h2>
      <div class="battle-summary-grid">
        <article><strong>${wr.roundsPlayed}</strong><span>Words seen</span></article>
        <article><strong>${accuracy}%</strong><span>Accuracy</span></article>
        <article><strong>${wr.correctCount}</strong><span>Caught correctly</span></article>
        <article><strong>${wr.wrongCount}</strong><span>Wrong catches</span></article>
        <article><strong>${wr.missCount}</strong><span>Missed drops</span></article>
        <article><strong>${wr.roundsPlayed ? Math.round((wr.correctCount / wr.roundsPlayed) * 100) : 0}%</strong><span>Round success</span></article>
      </div>
      ${
        wrongWords.length
          ? `<section class="battle-weak"><b>Words to review</b><div class="wr-review wr-wrong-list">${wrongWords
              .map(v => `<div class="wr-review-item"><span class="jp">${esc(v.word)}</span><span>${esc(v.meaning)}</span></div>`)
              .join('')}</div></section>`
          : '<p class="ok">No missed or wrong catches this run!</p>'
      }
      ${
        rightWords.length
          ? `<section class="battle-summary-note"><b>Caught correctly</b><div class="wr-review wr-right">${rightWords
              .map(v => `<div class="wr-review-item"><span class="jp">${esc(v.word)}</span><span>${esc(v.meaning)}</span></div>`)
              .join('')}</div></section>`
          : ''
      }
      ${wrongWords.length ? '<button id="wrQuickReview" class="primary reveal">🔥 Quick review missed words</button>' : ''}
      <button id="wrAgain" class="reveal">Play again</button>
      <button id="wrDone" class="reveal">Finish</button>
    `;
    const quickReview = $('#wrQuickReview');
    if (quickReview) quickReview.onclick = () => {
      const ids = wrongWords.map(v => v.id);
      window.KaishiCampfire?.start(ids, { source: 'word-rain' });
    };
    $('#wrAgain').onclick = () => startWordRain({ wordIds: requestedWordIds, source: requestedSource });
    $('#wrDone').onclick = () => show('journey');
  }

  function handleKeydown(e) {
    if (!wr || !wr.running) return;
    const screenEl = $('#wordRain');
    if (!screenEl || !screenEl.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') {
      nudgePlatform(-6);
    } else if (e.key === 'ArrowRight') {
      nudgePlatform(6);
    }
  }

  window.KaishiWordRain = {
    start: startWordRain,
    stop: () => {
      if (wr) {
        wr.running = false;
        if (wr.clockId) clearInterval(wr.clockId);
        clearRoundTimers();
      }
      show('journey');
    },
  };

  function wire() {
    const launch = $('#wordRainMode');
    if (launch) launch.onclick = startWordRain;
    const back = $('#wrBack');
    if (back)
      back.onclick = () => {
        if (wr) {
          wr.running = false;
          if (wr.clockId) clearInterval(wr.clockId);
          clearRoundTimers();
        }
        show('journey');
      };
    document.addEventListener('keydown', handleKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
