/* ============================================================
   MultipliKids — games/speak.js
   Jeu ORAL 🎤 : l'enfant RÉPOND À VOIX HAUTE (dans sa langue).
   MICRO PERMANENT : une seule session de reconnaissance CONTINUE reste ouverte
   tout le jeu (relancée si elle se termine). Pendant que l'app parle, on ignore
   simplement le micro (drapeau `speaking`) → il ne se coupe jamais.
   Calcul énoncé UNE fois ; correct → suivant ; faux → réessayer.
   Nécessite micro + contexte sécurisé (https/localhost) + Internet.
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const MAX = 10;
  const MAX_TRIES = 3;
  const MAX_ERR = 8;

  class Speak {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.i = 1; this.correct = 0; this.attempts = 0;
      this.rec = null;
      this.active = false;     // jeu en cours
      this.speaking = false;   // l'app parle → on ignore le micro (sans le couper)
      this.starting = false;   // une (re)création de session est en cours
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
      this.startMic();   // ouvre le micro et le garde ouvert en permanence
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
          '<div class="center"><button class="mic-btn listening" id="sp-mic" aria-label="' + t('speak_say') + '">🎤</button></div>' +
          '<div class="feedback" id="sp-fb" role="status"></div>' +
          '<div class="center" id="sp-heard" style="color:var(--color-text-dim);min-height:1.4em"></div>' +
          '<div class="row mt" id="sp-actions"></div>' +
          '<div class="game-hud"><span class="score">' + this.i + ' / ' + MAX + '</span></div>' +
        '</div>';
      // le micro reste TOUJOURS ouvert : le bouton sert juste à le relancer s'il a planté
      const mic = this.host.querySelector('#sp-mic');
      mic.addEventListener('click', () => { this.errCount = 0; this.startMic(); });
      // annonce le calcul UNE fois ; le micro se rouvre DÈS la fin de l'annonce
      // (pas de délai fixe → l'enfant peut répondre tout de suite)
      this.speaking = true;
      MK.audio.speakOperation(a, b, undefined, () => { this.speaking = false; });
    }

    // Ouvre (ou rouvre) la session de reconnaissance CONTINUE — micro permanent
    startMic() {
      if (!this.active || this.starting) return;
      this.starting = true;
      this.stopRec();
      MK.audio.resume();
      this.setMic(true);
      const self = this;
      this.rec = MK.audio.listen(this.code(), {
        continuous: true,
        onResult: function (alts) { self.onSaid(alts); },
        onError: function (err) { self.starting = false; self.onErr(err); },
        onEnd: function () {
          self.starting = false;
          // session terminée (silence/limite navigateur) → on RELANCE → micro permanent
          if (self.active) self.later(function () { self.startMic(); }, 300);
          else self.setMic(false);
        },
      });
      // onstart non garanti : on libère le verrou peu après
      this.later(() => { this.starting = false; }, 600);
      if (!this.rec) { this.starting = false; this.setMic(false); }
    }

    stopRec() {
      if (this.rec) { try { this.rec.abort ? this.rec.abort() : this.rec.stop(); } catch (e) {} this.rec = null; }
    }

    setMic(on) {
      const mic = this.host.querySelector('#sp-mic');
      if (mic) mic.classList.toggle('listening', !!on);
    }

    onSaid(alts) {
      if (!this.active || this.speaking) return;   // ignore la voix de l'app / hors-jeu
      const heard = this.host.querySelector('#sp-heard');
      const fb = this.host.querySelector('#sp-fb');
      const said = (alts && alts[0]) ? alts[0] : '';
      if (!said) return;
      if (heard) heard.textContent = '« ' + said + ' »';
      this.errCount = 0;

      const ok = (alts || []).some((tx) => MK.engine.spokenMatchesAnswer(tx, this.answer, MK.i18n.getLang()));
      if (ok) {
        // BONNE réponse → question suivante (sans redire le calcul). Micro garde ouvert.
        this.speaking = true; // ignore le micro pendant la transition + annonce suivante
        this.correct++;
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
        MK.progress.addXP(10);
        this.i++;
        this.later(() => this.next(), 1000);
      } else {
        // réponse FAUSSE
        this.attempts++;
        MK.audio.playWrong();
        MK.visual.shake(this.host.querySelector('.game-stage'));
        if (this.attempts >= MAX_TRIES) {
          this.speaking = true;
          if (fb) { fb.textContent = t('speak_show_answer') + ' ' + this.answer; fb.className = 'feedback ko'; }
          MK.audio.speakOperation(this.table, this.i, this.answer);
          this.i++;
          this.later(() => this.next(), 2200);
        } else {
          // on REDEMANDE (voix courte) ; micro rouvert dès la fin de l'invite
          if (fb) { fb.textContent = t('wrong') + ' ' + t('speak_try_again'); fb.className = 'feedback ko'; }
          this.speaking = true;
          MK.audio.speak(t('speak_try_again'), this.code(), () => { this.speaking = false; });
        }
      }
    }

    onErr(err) {
      // transitoires → la session se relancera via onEnd → micro reste permanent
      if (err === 'no-speech' || err === 'aborted' || err === 'network' || err === 'audio-capture') {
        this.errCount++;
        if (this.errCount >= MAX_ERR) this.hardStop('error');
        return;
      }
      this.hardStop(err); // refus micro / indisponible
    }

    hardStop(err) {
      this.active = false; this.stopRec(); this.clearTimers(); this.setMic(false);
      const fb = this.host.querySelector('#sp-fb');
      const denied = (err === 'not-allowed' || err === 'service-not-allowed');
      if (fb) { fb.textContent = denied ? t('speak_mic_denied') : t('speak_mic_error'); fb.className = 'feedback ko'; }
      const actions = this.host.querySelector('#sp-actions');
      if (actions) {
        actions.innerHTML =
          '<button class="btn btn--primary" id="sp-retry">🎤</button>' +
          '<button class="btn btn--ghost" id="sp-skip">' + t('btn_next') + ' →</button>';
        const r = actions.querySelector('#sp-retry');
        if (r) r.addEventListener('click', () => { this.errCount = 0; this.active = true; this.startMic(); });
        const s = actions.querySelector('#sp-skip');
        if (s) s.addEventListener('click', () => { this.active = true; this.i++; this.next(); this.startMic(); });
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
      this.active = false; this.speaking = true;
      this.clearTimers();
      this.stopRec();
    }
  }

  MK.games.Speak = Speak;
})();
