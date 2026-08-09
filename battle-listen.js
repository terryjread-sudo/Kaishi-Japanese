/*
 * Kotoba Colosseum — 言葉コロシアム
 * FF Tactics-style "Listen & Strike" battle mini-game for Kaishi Quest.
 *
 * INTEGRATION NOTES
 * - Load this file with a plain <script> tag AFTER app.js (it reads app.js's
 *   top-level `vocab`, `progress`, `meta`, and reuses app.js's own
 *   `grade`, `save`, `distractors`, `shuffle`, `play`, `speakJapanese`,
 *   `wordIntroduced`, `esc`, `show`, `toast`, `$`, `updateHome`,
 *   `BATTLE_MONSTERS`, `startedAt`, `hintUsed`).
 * - It does NOT touch app.js's session/index/current/battle/battleActive
 *   state, so it can never collide with the existing SRS Decay Battle or
 *   any other activity. It is purely additive.
 * - It only needs one new screen element (#listenBattle) and one launch
 *   button in index.html — see the accompanying README for the exact
 *   markup to paste in.
 *
 * GAMEPLAY (v2)
 * - A word is read aloud; the player selects the correct ENGLISH MEANING
 *   from 4 choices — this tests comprehension, not just word recognition.
 * - The party has 3 characters. Before each round the player chooses
 *   ATTACK (send the next party member into battle) or REVIVE (attempt to
 *   bring back a knocked-out member) — an FF Tactics-style command menu.
 * - A correct answer lands the chosen action. A wrong answer lets the
 *   monster strike back and knock out a random standing party member.
 * - Losing all 3 party members ends the run; clearing all 4 monsters wins it.
 */
(() => {
  'use strict';

  const ROUNDS_PER_MONSTER = 3;
  const MONSTERS_PER_RUN = 4;
  const CHOICE_COUNT = 4;

  const SPRITE_BASE = 'media/battle-listen';
  const SPRITE_V = '1';

  const PARTY_TEMPLATE = [
    { id: 'kenji', name: 'Kenji', role: 'Warrior', sprite: `${SPRITE_BASE}/party-warrior.png`, move: 'Blade Strike', color: '#f87171' },
    { id: 'aya', name: 'Aya', role: 'Mage', sprite: `${SPRITE_BASE}/party-mage.png`, move: 'Kotoba Bolt', color: '#60a5fa' },
    { id: 'sora', name: 'Sora', role: 'Guardian', sprite: `${SPRITE_BASE}/party-guardian.png`, move: 'Word Ward', color: '#4ade80' },
  ];

  let kb = null;

  // --- Synthesized SFX (no audio files needed) --------------------------
  const SFX = (() => {
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
        const { type = 'square', volume = 0.18, glideTo = null } = opts;
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
        /* ignore audio failures — never let SFX break the game */
      }
    }
    return {
      isMuted: () => muted,
      toggle: () => {
        muted = !muted;
        return muted;
      },
      select() {
        tone(600, 0, 0.06, { type: 'square', volume: 0.12 });
      },
      hit() {
        tone(760, 0, 0.09, { type: 'square', volume: 0.2 });
        tone(420, 0.05, 0.08, { type: 'square', volume: 0.15 });
      },
      miss() {
        tone(280, 0, 0.22, { type: 'sawtooth', volume: 0.18, glideTo: 90 });
      },
      revive() {
        tone(440, 0, 0.12, { type: 'sine', volume: 0.16 });
        tone(660, 0.1, 0.14, { type: 'sine', volume: 0.16 });
        tone(880, 0.2, 0.2, { type: 'sine', volume: 0.14 });
      },
      monsterDefeat() {
        [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.14, { type: 'square', volume: 0.18 }));
      },
      victory() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, { type: 'square', volume: 0.18 }));
      },
      defeat() {
        [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, { type: 'sawtooth', volume: 0.16 }));
      },
    };
  })();

  // --- Background music (looped, quiet, ducked under the Japanese audio) --
  const BGM_SRC = `${SPRITE_BASE}/bgm.mp3?v=${SPRITE_V}`;
  const BGM_TARGET_VOLUME = 0.16; // kept low so the word audio stays clearly audible
  let bgmAudio = null;
  let bgmFadeTimer = null;

  function ensureBgm() {
    if (!bgmAudio) {
      bgmAudio = new Audio(BGM_SRC);
      bgmAudio.loop = true;
      bgmAudio.volume = 0;
      bgmAudio.muted = SFX.isMuted();
    }
    return bgmAudio;
  }

  function fadeBgm(to, ms = 500) {
    const a = ensureBgm();
    if (bgmFadeTimer) clearInterval(bgmFadeTimer);
    const steps = 20;
    const start = a.volume;
    let i = 0;
    bgmFadeTimer = setInterval(() => {
      i++;
      a.volume = Math.max(0, Math.min(1, start + ((to - start) * i) / steps));
      if (i >= steps) {
        clearInterval(bgmFadeTimer);
        bgmFadeTimer = null;
        if (to === 0) a.pause();
      }
    }, ms / steps);
  }

  function playBgm() {
    const a = ensureBgm();
    a.muted = SFX.isMuted();
    a.play().catch(() => {});
    fadeBgm(BGM_TARGET_VOLUME, 600);
  }

  function stopBgm() {
    if (bgmAudio) fadeBgm(0, 400);
  }

  function pool() {
    const seen = vocab.filter(wordIntroduced);
    const weighted = seen
      .map(v => ({ v, strength: Number(progress[v.id]?.skills?.listening?.strength || 0) }))
      .sort((a, b) => a.strength - b.strength)
      .map(x => x.v);
    const top = weighted.slice(0, Math.max(20, Math.ceil(weighted.length * 0.6)));
    return shuffle(top.length >= CHOICE_COUNT ? top : seen);
  }

  function ensureStyles() {
    if ($('#kbStyles')) return;
    const style = document.createElement('style');
    style.id = 'kbStyles';
    style.textContent = `
      .kb-wrap{font-family:'Courier New',monospace}
      .kb-hud{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;font-size:.8rem}
      .kb-hud b{background:#fff;border-radius:12px;padding:6px 10px;box-shadow:0 5px 16px #17255414}
      .kb-mute{background:#fff;border-radius:12px;padding:6px 12px;box-shadow:0 5px 16px #17255414;font-size:1rem;line-height:1}
      .kb-field{background:linear-gradient(rgba(6,12,30,.6),rgba(6,12,30,.8)),url(${SPRITE_BASE}/arena-backdrop.jpg?v=${SPRITE_V}) center/cover no-repeat;border:3px solid #101c3d;border-radius:18px;padding:20px 14px 16px;position:relative;overflow:hidden;box-shadow:inset 0 0 40px #00000066}
      .kb-monster-row{position:relative;text-align:center;padding-top:6px;padding-bottom:14px}
      .kb-monster-sprite{height:130px;width:auto;display:inline-block;filter:drop-shadow(0 10px 12px #000a);transition:transform .15s ease}
      .kb-monster-name{display:block;color:#fde68a;font-weight:800;letter-spacing:.05em;text-shadow:0 2px 3px #000;margin-top:4px}
      .kb-monster-hp{display:flex;justify-content:center;gap:4px;margin-top:6px}
      .kb-monster-hp span{width:24px;height:7px;border-radius:4px;background:#ffffff25}
      .kb-monster-hp span.filled{background:#f43f5e}
      .kb-monster-hit{animation:kbShake .32s ease}
      .kb-monster-defeat{animation:kbPop .5s ease forwards}
      @keyframes kbShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px) rotate(-4deg)}75%{transform:translateX(8px) rotate(4deg)}}
      @keyframes kbPop{to{transform:scale(0) rotate(30deg);opacity:0}}
      .kb-party-row{position:relative;display:flex;justify-content:center;gap:14px;padding-top:6px}
      .kb-hero{text-align:center;font-size:.68rem;color:#e2e8f0;opacity:1;transition:opacity .2s ease,transform .2s ease;width:78px}
      .kb-hero.ko{opacity:.4}
      .kb-hero.acting{transform:translateY(-6px)}
      .kb-hero-sprite-wrap{position:relative;height:78px;display:flex;align-items:flex-end;justify-content:center}
      .kb-hero-sprite{max-height:78px;max-width:78px;width:auto;display:block;filter:drop-shadow(0 5px 7px #000a);transition:filter .2s ease}
      .kb-hero.ko .kb-hero-sprite{filter:grayscale(1) brightness(.55) drop-shadow(0 5px 7px #000a)}
      .kb-hero-ko-badge{position:absolute;top:-2px;right:2px;font-size:1rem;text-shadow:0 2px 3px #000}
      .kb-hero-sprite.hit{animation:kbFlash .3s ease}
      @keyframes kbFlash{0%,100%{filter:drop-shadow(0 4px 6px #000a) brightness(1)}50%{filter:drop-shadow(0 4px 6px #000a) brightness(2.4)}}
      .kb-hero b{display:block;margin-top:2px}
      .kb-hero small{display:block;color:#94a3b8}
      .kb-menu{margin-top:16px;background:#0b1330;border:3px solid #fde68a;border-radius:12px;padding:10px;display:grid;gap:8px}
      .kb-menu-title{color:#fde68a;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;padding:0 4px 4px;border-bottom:1px solid #ffffff22}
      .kb-menu button{background:#172554;color:#fff;text-align:left;border:2px solid #2c3f75;border-radius:8px;padding:12px 14px;font-family:inherit;font-weight:800;display:flex;justify-content:space-between;align-items:center}
      .kb-menu button:disabled{opacity:.35}
      .kb-menu button:not(:disabled):active{background:#2563eb}
      .kb-cast-banner{margin:14px 0 6px;text-align:center;color:#fde68a;font-weight:800;letter-spacing:.03em;text-shadow:0 2px 3px #000}
      .kb-listen{display:block;width:100%;margin:10px 0 16px;background:#172554;color:#fff;font-size:1.05rem;padding:16px;border-radius:12px}
      .kb-listen small{display:block;font-weight:600;opacity:.75;font-size:.72rem;margin-top:4px}
      .kb-choices{display:grid;gap:10px}
      .kb-choice{background:#f1f5f9;border:2px solid transparent;font-size:1.05rem;padding:16px;text-align:left;font-weight:700}
      .kb-choice.correct{background:#dcfce7;border-color:#22c55e}
      .kb-choice.wrong{background:#fee2e2;border-color:#ef4444}
    `;
    document.head.appendChild(style);
  }

  function monsterSprite(id) {
    return `${SPRITE_BASE}/${id}.png?v=${SPRITE_V}`;
  }

  function currentMonster() {
    return kb.roster[kb.monsterIndex % kb.roster.length];
  }

  function alive() {
    return kb.party.filter(p => p.alive);
  }

  function nextActor() {
    const standing = alive();
    if (!standing.length) return null;
    kb.actorCursor = (kb.actorCursor + 1) % standing.length;
    return standing[kb.actorCursor];
  }

  function startKotobaBattle() {
    const words = pool();
    if (words.length < CHOICE_COUNT) {
      toast('Study a few more words first — Kotoba Colosseum needs at least 4 met words');
      return;
    }
    ensureStyles();
    kb = {
      roster: shuffle(BATTLE_MONSTERS).slice(0, MONSTERS_PER_RUN),
      monsterIndex: 0,
      monsterHp: ROUNDS_PER_MONSTER,
      party: PARTY_TEMPLATE.map(p => ({ ...p, alive: true })),
      actorCursor: -1,
      defeated: 0,
      deck: words,
      deckIndex: 0,
      correct: 0,
      total: 0,
      critical: 0,
      hinted: 0,
      missed: [],
      mode: null,
      actor: null,
      target: null,
      startedAt: Date.now(),
    };
    show('listenBattle');
    playBgm();
    renderMenu();
  }

  function nextWord() {
    if (kb.deckIndex >= kb.deck.length) {
      kb.deck = shuffle(pool());
      kb.deckIndex = 0;
    }
    return kb.deck[kb.deckIndex++];
  }

  function partyRowHtml(actingId) {
    return `<div class="kb-party-row">${kb.party
      .map(
        p => `<div class="kb-hero ${p.alive ? '' : 'ko'} ${p.id === actingId ? 'acting' : ''}">
          <div class="kb-hero-sprite-wrap">
            <img class="kb-hero-sprite" id="kbHero-${p.id}" src="${p.sprite}?v=${SPRITE_V}" alt="${esc(p.name)}">
            ${p.alive ? '' : '<span class="kb-hero-ko-badge">💀</span>'}
          </div>
          <b>${esc(p.name)}</b>
          <small>${p.alive ? esc(p.role) : 'Knocked out'}</small>
        </div>`
      )
      .join('')}</div>`;
  }

  function fieldHtml(actingId) {
    const m = currentMonster();
    return `
      <section class="kb-field" aria-label="${esc(m.name)} battlefield">
        <div class="kb-monster-row">
          <img class="kb-monster-sprite" id="kbMonsterEmoji" src="${monsterSprite(m.id)}" alt="${esc(m.name)}">
          <span class="kb-monster-name">${esc(m.name)}</span>
          <div class="kb-monster-hp">${Array.from({ length: ROUNDS_PER_MONSTER }, (_, i) => `<span class="${i < kb.monsterHp ? 'filled' : ''}"></span>`).join('')}</div>
        </div>
        ${partyRowHtml(actingId)}
      </section>
    `;
  }

  function renderMenu() {
    const koCount = kb.party.filter(p => !p.alive).length;
    const canRevive = koCount > 0 && alive().length > 0;
    const nextName = (alive()[(kb.actorCursor + 1) % Math.max(1, alive().length)] || {}).name || '';
    $('#kbCard').innerHTML = `
      <div class="eyebrow">Kotoba Colosseum · 言葉コロシアム</div>
      <div class="kb-hud">
        <b>Monsters defeated ${kb.defeated}/${MONSTERS_PER_RUN}</b>
        <b>Party standing ${alive().length}/3</b>
        <button id="kbMute" class="kb-mute" aria-label="${SFX.isMuted() ? 'Unmute sound' : 'Mute sound'}">${SFX.isMuted() ? '🔇' : '🔊'}</button>
      </div>
      ${fieldHtml(null)}
      <div class="kb-menu">
        <div class="kb-menu-title">Command</div>
        <button id="kbCmdAttack"><span>⚔ Attack</span><span>${esc(nextName)}</span></button>
        <button id="kbCmdRevive" ${canRevive ? '' : 'disabled'}><span>✚ Revive</span><span>${canRevive ? 'Restore a fallen ally' : 'No one is down'}</span></button>
      </div>
    `;
    $('#kbCmdAttack').onclick = () => {
      SFX.select();
      beginRound('attack');
    };
    const reviveBtn = $('#kbCmdRevive');
    if (reviveBtn)
      reviveBtn.onclick = () => {
        SFX.select();
        beginRound('revive');
      };
    const muteBtn = $('#kbMute');
    if (muteBtn)
      muteBtn.onclick = () => {
        SFX.toggle();
        if (bgmAudio) bgmAudio.muted = SFX.isMuted();
        muteBtn.textContent = SFX.isMuted() ? '🔇' : '🔊';
        muteBtn.setAttribute('aria-label', SFX.isMuted() ? 'Unmute sound' : 'Mute sound');
      };
  }

  function beginRound(mode) {
    kb.mode = mode;
    kb.actor = nextActor();
    kb.target = mode === 'revive' ? kb.party.find(p => !p.alive) : null;
    if (!kb.actor || (mode === 'revive' && !kb.target)) {
      renderMenu();
      return;
    }
    renderRound();
  }

  function renderRound() {
    kb.answered = false;
    kb.hint = false;
    const v = (kb.round = nextWord());
    const choices = shuffle([v.meaning, ...distractors(v, 'meaning', CHOICE_COUNT - 1)]);
    const actionLabel =
      kb.mode === 'attack'
        ? `${esc(kb.actor.name)} casts <b>${esc(kb.actor.move)}</b>!`
        : `${esc(kb.actor.name)} channels a revival rite on ${esc(kb.target.name)}!`;

    $('#kbCard').innerHTML = `
      <div class="eyebrow">Kotoba Colosseum · 言葉コロシアム</div>
      ${fieldHtml(kb.actor.id)}
      <p class="kb-cast-banner">${actionLabel}</p>
      <button id="kbListen" class="kb-listen">🔊 Listen to the word<small>Tap to hear it again — replaying costs a critical-hit bonus</small></button>
      <h2>What does it mean?</h2>
      <div class="kb-choices">${choices.map(m => `<button class="kb-choice" data-meaning="${encodeURIComponent(m)}">${esc(m)}</button>`).join('')}</div>
      <section id="kbFeedback" class="game-feedback" aria-live="polite" hidden></section>
    `;

    $('#kbListen').onclick = () => speakRound(v);
    document.querySelectorAll('.kb-choice').forEach(btn => (btn.onclick = () => resolveChoice(btn, v)));

    startedAt = Date.now();
    hintUsed = false;
    speakRound(v);
  }

  function speakRound(v) {
    if (kb.answered) return;
    const btn = $('#kbListen');
    if (btn && btn.dataset.played) {
      kb.hint = true;
      hintUsed = true;
      kb.hinted++;
    }
    if (btn) btn.dataset.played = '1';
    if (v.wordAudio) play(v.wordAudio);
    else speakJapanese(v.word);
  }

  function knockOutRandom() {
    const standing = alive();
    if (!standing.length) return null;
    const victim = standing[Math.floor(Math.random() * standing.length)];
    victim.alive = false;
    return victim;
  }

  function resolveChoice(button, v) {
    if (kb.answered) return;
    kb.answered = true;
    const chosen = decodeURIComponent(button.dataset.meaning);
    const ok = chosen === v.meaning;
    document.querySelectorAll('.kb-choice').forEach(b => {
      b.disabled = true;
      if (decodeURIComponent(b.dataset.meaning) === v.meaning) b.classList.add('correct');
    });
    if (!ok) button.classList.add('wrong');

    kb.total++;
    const rating = ok ? (kb.hint ? 3 : 4) : 1;
    grade(v, 'listening', rating, ok, false);

    let result;
    let victim = null;
    const emoji = $('#kbMonsterEmoji');
    if (ok) {
      kb.correct++;
      if (!kb.hint) kb.critical++;
      if (kb.mode === 'attack') {
        kb.monsterHp--;
        SFX.hit();
        if (emoji) {
          emoji.classList.add('kb-monster-hit');
          setTimeout(() => emoji.classList.remove('kb-monster-hit'), 320);
        }
        result = `${esc(kb.actor.name)}'s ${esc(kb.actor.move)} lands true!`;
        if (kb.monsterHp <= 0) {
          kb.defeated++;
          recordVictory();
          result = `${esc(currentMonster().name)} is defeated!`;
          if (emoji) emoji.classList.add('kb-monster-defeat');
          setTimeout(() => SFX.monsterDefeat(), 120);
        }
      } else {
        kb.target.alive = true;
        SFX.revive();
        result = `${esc(kb.target.name)} rejoins the fight!`;
      }
    } else {
      victim = knockOutRandom();
      SFX.miss();
      result = victim ? `${esc(currentMonster().name)} strikes down ${esc(victim.name)}!` : `${esc(currentMonster().name)} lunges, but the party holds.`;
      kb.missed.push(v.id);
      if (victim) {
        const heroSprite = $(`#kbHero-${victim.id}`);
        if (heroSprite) {
          heroSprite.classList.add('hit');
          setTimeout(() => heroSprite.classList.remove('hit'), 300);
        }
      }
    }

    const partyWiped = alive().length === 0;
    const runWon = kb.defeated >= MONSTERS_PER_RUN;
    const advancingMonster = kb.mode === 'attack' && ok && kb.monsterHp <= 0 && !runWon;
    const done = partyWiped || runWon;

    const feedback = $('#kbFeedback');
    feedback.hidden = false;
    feedback.innerHTML = `
      <p class="game-result ${ok ? 'game-result-correct' : 'game-result-wrong'}">${result}</p>
      <div class="game-answer">
        <div class="jp">${esc(v.word)}</div>
        <div class="reading">${esc(v.reading)}</div>
        <div class="meaning">${esc(v.meaning)}</div>
      </div>
      <button id="kbNext" class="primary reveal">${done ? 'Battle results →' : 'Next turn →'}</button>
    `;
    $('#kbNext').onclick = () => {
      if (done) {
        showSummary(runWon);
        return;
      }
      if (advancingMonster) {
        kb.monsterIndex++;
        kb.monsterHp = ROUNDS_PER_MONSTER;
      }
      renderMenu();
    };
  }

  function recordVictory() {
    meta.monsterVictories = Array.isArray(meta.monsterVictories) ? meta.monsterVictories : [];
    meta.monsterVictories.push(Date.now());
    meta.totalMonsterVictories = Number(meta.totalMonsterVictories || 0) + 1;
    save();
  }

  function showSummary(won) {
    stopBgm();
    won ? SFX.victory() : SFX.defeat();
    const accuracy = kb.total ? Math.round((kb.correct / kb.total) * 100) : 0;
    const weak = [...new Set(kb.missed)].map(id => vocab.find(v => v.id === id)).filter(Boolean);
    const elapsed = Math.max(1, Math.round((Date.now() - kb.startedAt) / 60000));
    updateHome();
    $('#kbCard').innerHTML = `
      <div class="eyebrow">Battle summary</div>
      <h2 class="battle-summary-title">${won ? 'Colosseum cleared!' : 'The party has fallen'}</h2>
      <div class="battle-summary-grid">
        <article><strong>${kb.defeated}</strong><span>Monsters defeated</span></article>
        <article><strong>${kb.total}</strong><span>Words heard</span></article>
        <article><strong>${accuracy}%</strong><span>Accuracy</span></article>
        <article><strong>${kb.critical}</strong><span>No-hint criticals</span></article>
        <article><strong>${kb.hinted}</strong><span>Audio-assisted hits</span></article>
        <article><strong>${alive().length}/3</strong><span>Party standing</span></article>
      </div>
      <p class="battle-summary-note">${won ? `Great work — the colosseum was cleared in about ${elapsed} minute${elapsed === 1 ? '' : 's'}.` : 'Every round still strengthened your listening recall, even without a full clear.'}</p>
      ${weak.length ? `<section class="battle-weak"><b>Words to reinforce</b><p>${weak.map(v => `${esc(v.word)} — ${esc(v.meaning)}`).join('<br>')}</p></section>` : '<p class="ok">No missed words this run.</p>'}
      <button id="kbAgain" class="primary reveal">Fight again</button>
      <button id="kbDone" class="reveal">Return to games</button>
    `;
    $('#kbAgain').onclick = startKotobaBattle;
    $('#kbDone').onclick = () => {
      stopBgm();
      show('games');
    };
  }

  function wire() {
    const launch = $('#kotobaColosseumMode');
    if (launch) launch.onclick = startKotobaBattle;
    const back = $('#kbBack');
    if (back)
      back.onclick = () => {
        stopBgm();
        show('games');
      };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
