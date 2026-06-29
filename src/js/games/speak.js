/* ============================================================
   MultipliKids — games/speak.js
   Jeu ORAL 🎤 pour ENFANT : patient et bienveillant.
   - Le calcul est énoncé UNE fois, puis le micro s'ouvre DÈS la fin de l'annonce.
   - Le micro reste ouvert et ATTEND l'enfant aussi longtemps qu'il faut
     (le silence ne déclenche aucun reproche : on se ré-arme en silence).
   - Le micro ne s'ouvre jamais PENDANT que l'app parle → il ne s'entend pas lui-même.
   - Erreur → encouragement DOUX, jamais de réprimande.
   Nécessite micro + contexte sécurisé (https/localhost) + Internet.
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const MAX = 10;
  const GENTLE_TRIES = 3;   // après 3 essais, on donne gentiment la réponse et on avance
  const NET_MAX = 10;       // erreurs réseau d'affilée avant message « vérifie Internet »

  class Speak {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.i = 1; this.correct = 0; this.attempts = 0;
      this.rec = null;
      this.active = false;     // jeu en cours
      this.speaking = false;   // l'app parle → micro fermé pendant ce temps
      this.opening = false;    // une ouverture de session est en cours
      this.netErr = 0;
      this.timers = [];
    }

    code() { return (MK.i18n.getLang() === 'fr') ? 'fr-FR' : 'el-GR'; }
    later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); return id; }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

    start() {
      this.i = 1; this.correct = 0; this.netErr = 0; this.active = true;
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
          '<p class="center" id="sp-hint" style="color:var(--color-text-dim)">' + t('speak_say') + '</p>' +
          '<div class="question-big">' + a + ' × ' + b + ' = ?</div>' +
          '<div class="center"><button class="mic-btn" id="sp-mic" aria-label="' + t('speak_say') + '">🎤</button></div>' +
          '<div class="feedback" id="sp-fb" role="status"></div>' +
          '<div class="center" id="sp-heard" style="color:var(--color-text-dim);min-height:1.4em"></div>' +
          '<div class="row mt" id="sp-actions"></div>' +
          '<div class="game-hud"><span class="score">' + this.i + ' / ' + MAX + '</span></div>' +
        '</div>';
      // bouton micro = relance manuelle (au cas où)
      const mic = this.host.querySelector('#sp-mic');
      mic.addEventListener('click', () => { this.netErr = 0; this.speaking = false; this.openMic(true); });
      // énonce le calcul UNE fois, PUIS ouvre le micro (jamais pendant l'annonce)
      this.announce(a, b);
    }

    announce(a, b) {
      this.speaking = true;
      this.closeMic();
      this.setMic(false);
      MK.audio.speakOperation(a, b, undefined, () => {
        this.speaking = false;
        this.openMic();   // micro prêt dès la fin de l'annonce
      });
    }

    // Ouvre la session d'écoute (continue) et la garde ouverte ; PATIENTE.
    openMic(force) {
      if (!this.active || this.speaking) return;
      if (this.rec && !force) return;
      if (this.opening) return;
      this.opening = true;
      this.closeMic();
      MK.audio.resume();
      this.setMic(true);
      const hint = this.host.querySelector('#sp-hint');
      if (hint) hint.textContent = t('speak_ready');
      const self = this;
      this.rec = MK.audio.listen(this.code(), {
        continuous: true,
        onResult: function (alts) { self.onSaid(alts); },
        onError: function (err) { self.opening = false; self.onErr(err); },
        onEnd: function () {
          self.opening = false; self.rec = null; self.setMic(false);
          // silence / fin de session → on rouvre en SILENCE (aucun reproche, attente illimitée)
          if (self.active && !self.speaking) self.later(function () { self.openMic(); }, 250);
        },
      });
      this.later(() => { this.opening = false; }, 700);
      if (!this.rec) { this.opening = false; this.setMic(false); }
    }

    closeMic() {
      if (this.rec) { try { this.rec.abort ? this.rec.abort() : this.rec.stop(); } catch (e) {} this.rec = null; }
    }

    setMic(on) {
      const mic = this.host.querySelector('#sp-mic');
      if (mic) mic.classList.toggle('listening', !!on);
    }

    onSaid(alts) {
      if (!this.active || this.speaking) return;   // ignore tant que l'app parle
      const said = (alts && alts[0]) ? alts[0] : '';
      if (!said) return;
      const heard = this.host.querySelector('#sp-heard');
      const fb = this.host.querySelector('#sp-fb');
      if (heard) heard.textContent = '« ' + said + ' »';
      this.netErr = 0;

      const ok = (alts || []).some((tx) => MK.engine.spokenMatchesAnswer(tx, this.answer, MK.i18n.getLang()));
      MK.progress.recordFact(this.table, this.i, ok);
      if (ok) {
        this.speaking = true; this.closeMic(); this.setMic(false);
        this.correct++;
        if (fb) { fb.textContent = t('speak_bravo_kind'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
        MK.progress.addXP(10);
        this.i++;
        this.later(() => this.next(), 1100);   // → calcul suivant (annoncé une fois)
      } else {
        this.attempts++;
        if (this.attempts >= GENTLE_TRIES) {
          // on donne GENTIMENT la réponse puis on avance (l'enfant n'est jamais bloqué)
          this.speaking = true; this.closeMic(); this.setMic(false);
          if (fb) { fb.textContent = t('speak_reveal_kind') + ' ' + this.answer; fb.className = 'feedback'; }
          MK.audio.playTick();
          MK.audio.speakOperation(this.table, this.i, this.answer, () => {
            this.i++; this.later(() => this.next(), 200);
          });
        } else {
          // encouragement DOUX, puis on rouvre le micro tranquillement
          if (fb) { fb.textContent = t('speak_almost'); fb.className = 'feedback'; }
          MK.audio.playTick();
          this.speaking = true; this.closeMic();
          MK.audio.speak(t('speak_again_kind'), this.code(), () => { this.speaking = false; this.openMic(); });
        }
      }
    }

    onErr(err) {
      this.setMic(false);
      if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') {
        return; // PATIENT : aucun reproche, onEnd rouvrira le micro
      }
      if (err === 'network') {
        this.netErr++;
        if (this.netErr >= NET_MAX) { const fb = this.host.querySelector('#sp-fb'); if (fb) { fb.textContent = t('speak_mic_error'); fb.className = 'feedback'; } }
        return; // on continue d'essayer
      }
      this.hardStop(err); // micro refusé / indisponible
    }

    hardStop(err) {
      this.active = false; this.closeMic(); this.clearTimers(); this.setMic(false);
      const fb = this.host.querySelector('#sp-fb');
      const denied = (err === 'not-allowed' || err === 'service-not-allowed');
      if (fb) { fb.textContent = denied ? t('speak_mic_denied') : t('speak_mic_error'); fb.className = 'feedback'; }
      const actions = this.host.querySelector('#sp-actions');
      if (actions) {
        actions.innerHTML =
          '<button class="btn btn--primary" id="sp-retry">🎤</button>' +
          '<button class="btn btn--ghost" id="sp-skip">' + t('btn_next') + ' →</button>';
        const r = actions.querySelector('#sp-retry');
        if (r) r.addEventListener('click', () => { this.netErr = 0; this.active = true; this.speaking = false; this.openMic(true); });
        const s = actions.querySelector('#sp-skip');
        if (s) s.addEventListener('click', () => { this.active = true; this.i++; this.next(); });
      }
    }

    finish() {
      this.active = false; this.closeMic(); this.clearTimers();
      const percent = MK.engine.pct(this.correct, MAX);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + t('level_done') + '</h2>' +
          '<p class="celebrate" style="font-size:1.8rem">🎤 ' + this.correct + ' / ' + MAX + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="sp-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#sp-again').addEventListener('click', () => this.start());
      if (percent >= 70) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: MAX, percent: percent, speedBonus: false });
    }

    stop() {
      this.active = false; this.speaking = true;
      this.clearTimers();
      this.closeMic();
    }
  }

  MK.games.Speak = Speak;
})();
