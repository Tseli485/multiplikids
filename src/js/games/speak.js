/* ============================================================
   MultipliKids — games/speak.js
   Jeu ORAL 🎤 : l'enfant RÉPOND À VOIX HAUTE (dans sa langue).
   L'app reconnaît le nombre, valide, et REDEMANDE si la réponse est fausse.
   Nécessite micro + contexte sécurisé (https/localhost) + Internet.
   Contrat : new Speak(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const MAX = 10;          // ×1 à ×10
  const MAX_TRIES = 3;     // après 3 essais ratés, on révèle et on avance

  class Speak {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.i = 1;
      this.correct = 0;
      this.attempts = 0;
      this.rec = null;
      this.busy = false;
    }

    code() { return (MK.i18n.getLang() === 'fr') ? 'fr-FR' : 'el-GR'; }

    start() {
      this.i = 1; this.correct = 0; this.attempts = 0;
      if (!MK.audio.canRecognize()) { this.renderUnsupported(); return; }
      this.renderQuestion();
    }

    renderUnsupported() {
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<p style="font-size:2.4rem">🎤❌</p>' +
          '<p>' + t('speak_mic_error') + '</p>' +
          '<p class="screen-sub">' + t('speak_need_https') + '</p>' +
        '</div>';
    }

    renderQuestion() {
      if (this.i > MAX) { this.finish(); return; }
      this.attempts = 0;
      const a = this.table, b = this.i, answer = a * b;
      this.answer = answer;
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span>' + t('table_of') + ' ' + a + '</span>' +
            '<span class="score">' + this.correct + ' / ' + MAX + '</span>' +
          '</div>' +
          '<p class="center" style="color:var(--color-text-dim)">' + t('speak_tap') + '</p>' +
          '<div class="question-big">' + a + ' × ' + b + ' = ?</div>' +
          '<div class="center"><button class="mic-btn" id="sp-mic" aria-label="' + t('speak_tap') + '">🎤</button></div>' +
          '<div class="feedback" id="sp-fb" role="status"></div>' +
          '<div class="center" id="sp-heard" style="color:var(--color-text-dim);min-height:1.4em"></div>' +
          '<div class="row mt" id="sp-actions"></div>' +
          '<div class="game-hud"><span class="score">' + this.i + ' / ' + MAX + '</span></div>' +
        '</div>';
      const mic = this.host.querySelector('#sp-mic');
      mic.addEventListener('click', () => this.listen());
      // énonce la question (sans la réponse) PUIS écoute automatiquement
      MK.audio.speakOperation(a, b);
      this.scheduleListen(2000); // auto-écoute : pas besoin de retaper le micro
    }

    // Démarre l'écoute après un délai (laisse finir la voix avant d'ouvrir le micro)
    scheduleListen(delay) {
      clearTimeout(this.autoTimer);
      const self = this;
      this.autoTimer = setTimeout(function () {
        if (!self.busy && self.host.querySelector('#sp-mic')) self.listen();
      }, delay || 1800);
    }

    listen() {
      clearTimeout(this.autoTimer);
      if (this.busy) return;
      this.busy = true;
      const mic = this.host.querySelector('#sp-mic');
      const fb = this.host.querySelector('#sp-fb');
      if (mic) mic.classList.add('listening');
      if (fb) { fb.textContent = t('speak_listening'); fb.className = 'feedback'; }
      MK.audio.resume();
      const self = this;
      this.rec = MK.audio.listen(this.code(), {
        onResult: function (alts) { self.handleResult(alts); },
        onError: function (err) { self.handleError(err); },
        onEnd: function () { if (mic) mic.classList.remove('listening'); self.busy = false; },
      });
      if (!this.rec) { this.busy = false; if (mic) mic.classList.remove('listening'); }
    }

    handleResult(alts) {
      const heard = this.host.querySelector('#sp-heard');
      const fb = this.host.querySelector('#sp-fb');
      const said = (alts && alts[0]) ? alts[0] : '';
      if (heard) heard.textContent = said ? '« ' + said + ' »' : '';

      const ok = (alts || []).some((tx) => MK.engine.spokenMatchesAnswer(tx, this.answer, MK.i18n.getLang()));
      if (ok) {
        this.correct++;
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
        MK.progress.addXP(10);
        MK.audio.speakOperation(this.table, this.i, this.answer); // confirme à voix haute
        this.i++;
        setTimeout(() => this.renderQuestion(), 1600);
      } else {
        this.attempts++;
        MK.audio.playWrong();
        MK.visual.shake(this.host.querySelector('.game-stage'));
        if (this.attempts >= MAX_TRIES) {
          // on révèle la bonne réponse puis on passe
          if (fb) { fb.textContent = t('speak_show_answer') + ' ' + this.answer; fb.className = 'feedback ko'; }
          MK.audio.speakOperation(this.table, this.i, this.answer);
          this.i++;
          setTimeout(() => this.renderQuestion(), 2200);
        } else {
          // on REDEMANDE (même question) puis on ré-écoute automatiquement
          if (fb) { fb.textContent = t('wrong') + ' ' + t('speak_try_again'); fb.className = 'feedback ko'; }
          setTimeout(() => { MK.audio.speak(t('speak_try_again'), this.code()); }, 300);
          this.scheduleListen(2200);
        }
      }
    }

    handleError(err) {
      const fb = this.host.querySelector('#sp-fb');
      const mic = this.host.querySelector('#sp-mic');
      if (mic) mic.classList.remove('listening');
      this.busy = false;
      if (err === 'no-speech' || err === 'aborted') {
        if (fb) { fb.textContent = t('speak_no_speech'); fb.className = 'feedback ko'; }
        this.scheduleListen(1200); // ré-écoute auto (pas besoin de retaper)
        return;
      }
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        if (fb) { fb.textContent = t('speak_mic_denied'); fb.className = 'feedback ko'; }
      } else {
        if (fb) { fb.textContent = t('speak_mic_error'); fb.className = 'feedback ko'; }
      }
      // bouton « passer » pour ne pas rester bloqué
      const actions = this.host.querySelector('#sp-actions');
      if (actions && !actions.querySelector('#sp-skip')) {
        actions.innerHTML = '<button class="btn btn--ghost" id="sp-skip">' + t('btn_next') + ' →</button>';
        actions.querySelector('#sp-skip').addEventListener('click', () => { this.i++; this.renderQuestion(); });
      }
    }

    finish() {
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
      clearTimeout(this.autoTimer);
      if (this.rec) { try { this.rec.abort ? this.rec.abort() : this.rec.stop(); } catch (e) {} this.rec = null; }
      this.busy = false;
    }
  }

  MK.games.Speak = Speak;
})();
