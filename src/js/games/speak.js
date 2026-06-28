/* ============================================================
   MultipliKids — games/speak.js
   Jeu ORAL 🎤 : l'enfant RÉPOND À VOIX HAUTE (dans sa langue).
   Micro EN CONTINU : il se ré-arme automatiquement → l'enfant peut répondre
   à tout moment, sans jamais retaper le micro. Redemande si la réponse est fausse.
   Nécessite micro + contexte sécurisé (https/localhost) + Internet.
   Contrat : new Speak(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const MAX = 10;          // ×1 à ×10
  const MAX_TRIES = 3;     // après 3 essais ratés, on révèle et on avance
  const MAX_ERR = 6;       // erreurs dures consécutives → on s'arrête proprement

  class Speak {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.i = 1;
      this.correct = 0;
      this.attempts = 0;
      this.rec = null;
      this.active = false;   // jeu en cours
      this.paused = false;   // micro suspendu (pendant la voix / l'avance)
      this.busy = false;     // une session de reconnaissance est ouverte
      this.errCount = 0;
      this.timers = [];
    }

    code() { return (MK.i18n.getLang() === 'fr') ? 'fr-FR' : 'el-GR'; }
    later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); return id; }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

    start() {
      this.i = 1; this.correct = 0; this.errCount = 0; this.active = true;
      if (!MK.audio.canRecognize()) { this.renderUnsupported(); return; }
      this.next();
    }

    renderUnsupported() {
      this.active = false;
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<p style="font-size:2.4rem">🎤❌</p>' +
          '<p>' + t('speak_mic_error') + '</p>' +
          '<p class="screen-sub">' + t('speak_need_https') + '</p>' +
        '</div>';
    }

    next() {
      if (this.i > MAX) { this.finish(); return; }
      this.attempts = 0;
      const a = this.table, b = this.i;
      this.answer = a * b;
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span>' + t('table_of') + ' ' + a + '</span>' +
            '<span class="score">' + this.correct + ' / ' + MAX + '</span>' +
          '</div>' +
          '<p class="center" style="color:var(--color-text-dim)">' + t('speak_say') + '</p>' +
          '<div class="question-big">' + a + ' × ' + b + ' = ?</div>' +
          '<div class="center"><button class="mic-btn" id="sp-mic" aria-label="' + t('speak_say') + '">🎤</button></div>' +
          '<div class="feedback" id="sp-fb" role="status"></div>' +
          '<div class="center" id="sp-heard" style="color:var(--color-text-dim);min-height:1.4em"></div>' +
          '<div class="row mt" id="sp-actions"></div>' +
          '<div class="game-hud"><span class="score">' + this.i + ' / ' + MAX + '</span></div>' +
        '</div>';
      const mic = this.host.querySelector('#sp-mic');
      mic.addEventListener('click', () => { this.paused = false; this.arm(true); }); // relance immédiate
      // annonce la question, PUIS ouvre le micro en continu
      this.paused = true;
      this.stopRec();
      MK.audio.speakOperation(a, b);
      this.later(() => { this.paused = false; this.arm(); }, 1900);
    }

    setMic(listening) {
      const mic = this.host.querySelector('#sp-mic');
      if (mic) mic.classList.toggle('listening', !!listening);
      const fb = this.host.querySelector('#sp-fb');
      if (listening && fb && !fb.classList.contains('ok') && !fb.classList.contains('ko')) {
        fb.textContent = t('speak_listening'); fb.className = 'feedback';
      }
    }

    // Arme (ou ré-arme) la reconnaissance. force=true → relance même si une session tourne.
    arm(force) {
      if (!this.active || this.paused) return;
      if (this.busy && !force) return;
      if (force) this.stopRec();
      this.busy = true;
      MK.audio.resume();
      this.setMic(true);
      const self = this;
      this.rec = MK.audio.listen(this.code(), {
        onResult: function (alts) { self.onSaid(alts); },
        onError: function (err) { self.onErr(err); },
        onEnd: function () {
          self.busy = false;
          self.setMic(false);
          // RE-ARMEMENT AUTOMATIQUE → micro en continu
          if (self.active && !self.paused) self.later(function () { self.arm(); }, 250);
        },
      });
      if (!this.rec) { this.busy = false; this.setMic(false); }
    }

    stopRec() {
      if (this.rec) { try { this.rec.abort ? this.rec.abort() : this.rec.stop(); } catch (e) {} this.rec = null; }
      this.busy = false;
    }

    // Énonce une courte invite (PAS le calcul) en suspendant le micro, puis le rouvre
    sayThenListen(text, delay) {
      this.paused = true; this.stopRec();
      MK.audio.speak(text, this.code());
      this.later(() => { this.paused = false; this.arm(); }, delay || 1600);
    }

    onSaid(alts) {
      const heard = this.host.querySelector('#sp-heard');
      const fb = this.host.querySelector('#sp-fb');
      const said = (alts && alts[0]) ? alts[0] : '';
      if (heard) heard.textContent = said ? '« ' + said + ' »' : '';
      this.errCount = 0;

      const ok = (alts || []).some((tx) => MK.engine.spokenMatchesAnswer(tx, this.answer, MK.i18n.getLang()));
      if (ok) {
        // BONNE réponse → on passe à la suivante (SANS redire le calcul : entendu 1 fois)
        this.paused = true; this.stopRec();
        this.correct++;
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
        MK.progress.addXP(10);
        this.i++;
        this.later(() => this.next(), 1000);
      } else if (said) {
        // réponse FAUSSE et audible
        this.attempts++;
        MK.audio.playWrong();
        MK.visual.shake(this.host.querySelector('.game-stage'));
        if (this.attempts >= MAX_TRIES) {
          this.paused = true; this.stopRec();
          if (fb) { fb.textContent = t('speak_show_answer') + ' ' + this.answer; fb.className = 'feedback ko'; }
          MK.audio.speakOperation(this.table, this.i, this.answer);
          this.i++;
          this.later(() => this.next(), 2200);
        } else {
          // on REDEMANDE de réessayer (voix courte, SANS redire le calcul), puis micro
          if (fb) { fb.textContent = t('wrong') + ' ' + t('speak_try_again'); fb.className = 'feedback ko'; }
          this.sayThenListen(t('speak_try_again'), 1700);
        }
      }
      // si rien d'audible (said vide) → on ne fait rien, le micro se ré-arme
    }

    onErr(err) {
      this.setMic(false);
      // erreurs transitoires : le micro se ré-armera via onEnd (silence, réseau bref…)
      if (err === 'no-speech' || err === 'aborted' || err === 'network') {
        const fb = this.host.querySelector('#sp-fb');
        if (err === 'no-speech' && fb && !fb.classList.contains('ok') && !fb.classList.contains('ko')) {
          fb.textContent = t('speak_no_speech'); fb.className = 'feedback';
        }
        this.errCount++;
        if (this.errCount >= MAX_ERR) this.hardStop('error');
        return;
      }
      // erreurs dures : micro refusé / indisponible
      this.hardStop(err);
    }

    hardStop(err) {
      this.paused = true; this.stopRec(); this.clearTimers();
      const fb = this.host.querySelector('#sp-fb');
      const denied = (err === 'not-allowed' || err === 'service-not-allowed');
      if (fb) { fb.textContent = denied ? t('speak_mic_denied') : t('speak_mic_error'); fb.className = 'feedback ko'; }
      const actions = this.host.querySelector('#sp-actions');
      if (actions) {
        actions.innerHTML =
          '<button class="btn btn--primary" id="sp-retry">🎤</button>' +
          '<button class="btn btn--ghost" id="sp-skip">' + t('btn_next') + ' →</button>';
        const r = actions.querySelector('#sp-retry');
        if (r) r.addEventListener('click', () => { this.errCount = 0; this.paused = false; this.arm(true); });
        const s = actions.querySelector('#sp-skip');
        if (s) s.addEventListener('click', () => { this.i++; this.next(); });
      }
    }

    finish() {
      this.active = false; this.stopRec(); this.clearTimers();
      const percent = MK.engine.pct(this.correct, MAX);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + t('level_done') + '</h2>' +
          '<p class="celebrate" style="font-size:1.8rem">🎤 ' + this.correct + ' / ' + MAX + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="sp-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#sp-again').addEventListener('click', () => this.start());
      if (percent >= 80) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: MAX, percent: percent, speedBonus: false });
    }

    stop() {
      this.active = false; this.paused = true;
      this.clearTimers();
      this.stopRec();
    }
  }

  MK.games.Speak = Speak;
})();
