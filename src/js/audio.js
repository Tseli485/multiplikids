/* ============================================================
   MultipliKids — audio.js
   Web Speech API (prononciation CLAIRE) + Web Audio API (sons générés)
   Fallback silencieux si non supporté.
   Diction : voix adaptée à la langue, débit lent, pauses, opérateur énoncé.
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {};

  let audioCtx = null;
  let enabled = true;
  let voices = [];

  /* Préférences persistées : voix choisie + multiplicateur de vitesse */
  const VOICE_KEY = 'multiplikids_voice';
  const RATE_KEY = 'multiplikids_rate';
  let prefVoiceURI = null;
  let rateMult = 1;
  try {
    prefVoiceURI = localStorage.getItem(VOICE_KEY) || null;
    const r = parseFloat(localStorage.getItem(RATE_KEY));
    if (!isNaN(r) && r >= 0.5 && r <= 1.5) rateMult = r;
  } catch (e) {}
  const BASE_RATE = 0.8; // débit de référence (enfant) ; rate effectif = BASE_RATE * rateMult

  /* ---------- Chargement des voix (asynchrone selon navigateur) ----------
     Les voix arrivent souvent APRÈS le 1er getVoices() (event 'voiceschanged').
     Tant qu'elles ne sont pas prêtes, on ne sait pas si une voix grecque existe :
     parler tout de suite ferait lire le grec par la voix par défaut (français !).
     → on attend qu'elles soient chargées avant de parler. */
  function loadVoices() {
    try { voices = window.speechSynthesis.getVoices() || []; }
    catch (e) { voices = []; }
    return voices;
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {}
    // certains navigateurs ne déclenchent getVoices qu'après un appel : on amorce
    try { window.speechSynthesis.getVoices(); } catch (e) {}
  }

  const norm = function (l) { return (l || '').toLowerCase().replace('_', '-'); };

  // Choisit la meilleure voix pour 'el' (grec) ou 'fr' (français)
  function pickVoice(prefix) {
    loadVoices(); // re-lecture systématique : capte une voix installée tardivement
    const matches = voices.filter(function (v) { return norm(v.lang).indexOf(prefix) === 0; });
    if (!matches.length) return null;
    // 1) voix choisie par l'utilisateur (si compatible avec la langue)
    if (prefVoiceURI) {
      const chosen = matches.find(function (v) { return v.voiceURI === prefVoiceURI; });
      if (chosen) return chosen;
    }
    // 2) sinon, préfère une voix locale (meilleure qualité hors-ligne)
    const local = matches.find(function (v) { return v.localService; });
    return local || matches[0];
  }

  function hasVoice(prefix) { return !!pickVoice(prefix); }

  // Liste des voix d'une langue (pour le sélecteur dans les Réglages)
  function listVoices(prefix) {
    loadVoices();
    return voices
      .filter(function (v) { return norm(v.lang).indexOf(prefix) === 0; })
      .map(function (v) { return { name: v.name, lang: v.lang, uri: v.voiceURI, local: !!v.localService }; });
  }
  function setPreferredVoice(uri) { prefVoiceURI = uri || null; try { uri ? localStorage.setItem(VOICE_KEY, uri) : localStorage.removeItem(VOICE_KEY); } catch (e) {} }
  function getPreferredVoice() { return prefVoiceURI; }
  function setRate(mult) { rateMult = Math.max(0.5, Math.min(1.5, mult || 1)); try { localStorage.setItem(RATE_KEY, String(rateMult)); } catch (e) {} }
  function getRate() { return rateMult; }
  function effectiveRate() { return Math.max(0.4, Math.min(1.6, BASE_RATE * rateMult)); }

  // Exécute fn quand les voix sont disponibles (ou après un court délai garde-fou)
  function whenVoicesReady(fn) {
    loadVoices();
    if (voices.length) { fn(); return; }
    if (!('speechSynthesis' in window)) { fn(); return; }
    let done = false;
    const run = function () { if (done) return; done = true; loadVoices(); fn(); };
    try { window.speechSynthesis.addEventListener('voiceschanged', run, { once: true }); } catch (e) {}
    setTimeout(run, 400); // garde-fou si l'event ne se déclenche pas
  }

  /* ---------- Web Audio (sons générés) ---------- */
  function ensureCtx() {
    if (!enabled) return null;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  function tone(freq, start, dur, type, gainPeak) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.2, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function playCorrect() {
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.09, 0.22, 'triangle', 0.18); });
  }
  function playWrong() {
    tone(155.56, 0, 0.28, 'sawtooth', 0.16);
    tone(130.81, 0.06, 0.3, 'square', 0.12);
  }
  function playFanfare() {
    [523.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.16, 0.35, 'triangle', 0.22); });
    tone(1318.5, 0.5, 0.5, 'sine', 0.18);
  }
  function playTick() { tone(880, 0, 0.06, 'square', 0.08); }

  /* ---------- Prononciation (Web Speech API) ---------- */
  // Énonce un texte clairement dans la langue donnée.
  // La voix est choisie AU MOMENT de parler (après chargement des voix) → la
  // bonne voix grecque est utilisée, jamais la voix française par défaut.
  // onDone (optionnel) : appelé une seule fois quand la voix a FINI de parler
  // (sert à rouvrir le micro exactement à la fin de l'annonce → réponse immédiate)
  function speak(text, langCode, onDone) {
    let fired = false;
    const done = function () { if (fired || !onDone) return; fired = true; try { onDone(); } catch (e) {} };
    if (!enabled || !('speechSynthesis' in window)) { if (onDone) setTimeout(done, 0); return; }
    const code = langCode || (MK.i18n ? MK.i18n.speechLang() : 'el-GR');
    const prefix = code.toLowerCase().slice(0, 2); // 'el' | 'fr'
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const str = String(text);
    whenVoicesReady(function () {
      try {
        const utt = new SpeechSynthesisUtterance(str);
        utt.lang = code;
        const v = pickVoice(prefix);
        if (v) utt.voice = v;        // voix de la BONNE langue (grec en mode grec)
        utt.rate = effectiveRate();  // vitesse réglable (Réglages)
        utt.pitch = 1.1;
        utt.volume = 1;
        utt.onend = done;
        utt.onerror = done;
        setTimeout(function () { try { window.speechSynthesis.speak(utt); } catch (e) { done(); } }, 60);
        // sécurité : si onend ne se déclenche pas (bug Chrome), on libère quand même
        if (onDone) setTimeout(done, Math.max(1500, str.length * 130) / effectiveRate() + 1600);
      } catch (e) { done(); }
    });
  }

  // Énonce « a FOIS b ÉGALE r » (ou sans résultat). onDone appelé à la fin.
  // L'opérateur (× = « fois » / « επί ») est TOUJOURS énoncé.
  function speakOperation(a, b, r, onDone) {
    const lang = MK.i18n ? MK.i18n.getLang() : 'el';
    const code = (lang === 'fr') ? 'fr-FR' : 'el-GR';
    const times = MK.i18n.t('times');   // fr: "fois"  | el: "επί"
    const eq = MK.i18n.t('equals');     // fr: "égale" | el: "ίσον"
    let txt = a + ', ' + times + ', ' + b;
    if (r !== undefined && r !== null) txt += ', ' + eq + ', ' + r;
    speak(txt, code, onDone);
  }

  function cancel() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {} }

  /* ---------- Narration fluide (séquence enchaînée) ----------
     Pour APPRENDRE une table : on enchaîne les phrases via l'évènement onend
     (on attend que chaque ligne finisse avant la suivante) — JAMAIS de cancel()
     entre les lignes, sinon le son est haché/coupé. Anti-pause Chrome inclus. */
  let seqId = 0;
  let keepAlive = null;

  function clearKeepAlive() { if (keepAlive) { clearInterval(keepAlive); keepAlive = null; } }

  // Stoppe toute narration en cours (et toute parole)
  function stopSpeech() { seqId++; clearKeepAlive(); cancel(); }

  // lines : tableau de chaînes à dire l'une après l'autre.
  // opts.onLine(index) : appelé quand la ligne `index` COMMENCE (pour surligner le visuel)
  // opts.onDone()      : appelé à la fin de la séquence
  function narrate(lines, langCode, gap, opts) {
    if (!enabled || !('speechSynthesis' in window) || !lines || !lines.length) return;
    opts = opts || {};
    stopSpeech();
    const my = ++seqId;
    const code = langCode || (MK.i18n ? MK.i18n.speechLang() : 'el-GR');
    const prefix = code.toLowerCase().slice(0, 2);
    const pause = (gap == null) ? 350 : gap; // pause naturelle entre les lignes
    whenVoicesReady(function () {
      if (my !== seqId) return;            // une autre narration a démarré entre-temps
      const v = pickVoice(prefix);
      // Chrome met la synthèse en pause après ~15 s : on la relance si besoin
      clearKeepAlive();
      keepAlive = setInterval(function () {
        try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch (e) {}
      }, 4000);
      const rate = effectiveRate();
      let k = 0;
      const next = function () {
        if (my !== seqId) { clearKeepAlive(); return; }
        if (k >= lines.length) { clearKeepAlive(); if (opts.onDone) try { opts.onDone(); } catch (e) {} return; }
        const idx = k;
        const text = String(lines[idx]);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = code; if (v) u.voice = v;
        u.rate = rate; u.pitch = 1.1; u.volume = 1;

        let advanced = false;
        let watchdog = null;
        const advance = function () {
          if (advanced || my !== seqId) return;
          advanced = true;
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          k++; setTimeout(next, pause);
        };
        u.onstart = function () { if (my === seqId && opts.onLine) try { opts.onLine(idx); } catch (e) {} };
        u.onend = advance;
        u.onerror = advance; // un échec ne doit pas bloquer la suite
        // garde-fou surlignage si onstart ne se déclenche pas
        if (opts.onLine) setTimeout(function () { if (my === seqId && !advanced) try { opts.onLine(idx); } catch (e) {} }, 30);

        // CHIEN DE GARDE : si onend ne se déclenche jamais (bug Chrome), on avance
        // quand même après la durée estimée → aucune ligne « ratée »/bloquée.
        const estMs = Math.max(1400, text.length * 130) / rate + 1400;
        watchdog = setTimeout(advance, estMs);

        try { window.speechSynthesis.speak(u); } catch (e) { advance(); }
      };
      // léger délai : laisse le cancel() initial se terminer (sinon 1re ligne perdue)
      setTimeout(next, 140);
    });
  }

  /* ---------- Reconnaissance vocale (Web Speech Recognition) ----------
     Pour le jeu ORAL : l'enfant répond à voix haute. Nécessite micro +
     contexte sécurisé (https/localhost) + Internet. Sinon onError. */
  function canRecognize() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  function listen(langCode, opts) {
    opts = opts || {};
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (opts.onError) opts.onError('unsupported'); return null; }
    let rec;
    try { rec = new SR(); } catch (e) { if (opts.onError) opts.onError('unsupported'); return null; }
    rec.lang = langCode || (MK.i18n ? MK.i18n.speechLang() : 'el-GR');
    rec.interimResults = false;
    rec.maxAlternatives = 8;       // plus d'hypothèses → meilleure reconnaissance de l'enfant
    rec.continuous = !!opts.continuous; // session permanente si demandé
    rec.onresult = function (e) {
      const alts = [];
      const start = (typeof e.resultIndex === 'number') ? e.resultIndex : 0;
      for (let r = start; r < e.results.length; r++) {
        const res = e.results[r];
        for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
      }
      if (alts.length && opts.onResult) opts.onResult(alts);
    };
    rec.onerror = function (e) { if (opts.onError) opts.onError((e && e.error) || 'error'); };
    rec.onend = function () { if (opts.onEnd) opts.onEnd(); };
    // coupe la voix de l'app pour ne pas qu'elle soit captée par le micro
    cancel();
    try { rec.start(); } catch (e) { if (opts.onError) opts.onError('start'); return null; }
    return rec;
  }

  function setEnabled(v) { enabled = !!v; if (!enabled) stopSpeech(); }
  function isEnabled() { return enabled; }

  // Amorce le chargement des voix (à appeler sur la 1re interaction utilisateur)
  function primeVoices() { whenVoicesReady(function () {}); }

  window.MK.audio = {
    playCorrect: playCorrect, playWrong: playWrong, playFanfare: playFanfare, playTick: playTick,
    speak: speak, speakOperation: speakOperation, cancel: cancel,
    narrate: narrate, stopSpeech: stopSpeech,
    setEnabled: setEnabled, isEnabled: isEnabled, resume: ensureCtx,
    primeVoices: primeVoices, hasVoice: hasVoice,
    listVoices: listVoices, setPreferredVoice: setPreferredVoice, getPreferredVoice: getPreferredVoice,
    setRate: setRate, getRate: getRate,
    canRecognize: canRecognize, listen: listen,
  };
})();
