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
  const NET_MAX = 3;        // erreurs réseau d'affilée avant message « vérifie Internet » (diagnostic rapide)

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
      this.pendingFragment = null; // fragment de reconnaissance en attente de recomposition
      this._fragTimer = null; this._judgeTimer = null;
      this.micGen = 0; // jeton de génération anti-évènements-tardifs (voir openMic)
      this.dbgLines = []; this.dbgT0 = Date.now(); // panneau de diagnostic (voir dbg())
    }

    // Journal de diagnostic TOUJOURS VISIBLE (aucune information cachée pendant
    // le dépannage) : montre en direct le support, la permission, chaque erreur
    // brute et chaque texte capté, avec horodatage relatif au début de la partie.
    dbg(msg) {
      const ms = Date.now() - this.dbgT0;
      this.dbgLines.unshift('[' + ms + 'ms] ' + msg);
      if (this.dbgLines.length > 8) this.dbgLines.length = 8;
      const el = this.host && this.host.querySelector('#sp-debug');
      if (el) el.textContent = this.dbgLines.join('\n');
    }

    code() { return (MK.i18n.getLang() === 'fr') ? 'fr-FR' : 'el-GR'; }
    later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); return id; }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

    start() {
      this.i = 1; this.correct = 0; this.netErr = 0; this.active = true;
      this.everHeard = false; this.silentStreak = 0; this.audioCapErr = 0;
      this.dbgLines = []; this.dbgT0 = Date.now();
      this.dbg('secure=' + window.isSecureContext + ' support=' + MK.audio.canRecognize() + ' ua=' + navigator.userAgent.slice(0, 40));
      if (!MK.audio.canRecognize()) { this.renderUnsupported(); return; }
      this.renderAsking(); // écran d'attente pendant qu'on demande le micro
      // Demande EXPLICITE et FIABLE du micro (getUserMedia) AVANT de démarrer la
      // reconnaissance : si l'enfant n'a jamais cliqué « Autoriser » (ou que la
      // popup est passée inaperçue), la reconnaissance vocale ne capte JAMAIS
      // rien, en silence — sans qu'on le sache. getUserMedia force une réponse
      // claire (accordé / refusé) au lieu de laisser la permission indéfiniment
      // « en attente ».
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          this.dbg('✅ permission micro accordée (getUserMedia)');
          stream.getTracks().forEach((tr) => tr.stop()); // la reconnaissance gère son propre flux
          if (this.active) this.next();
        }).catch((e) => {
          this.dbg('❌ permission micro refusée/impossible: ' + (e && e.name));
          this.hardStop('not-allowed');
        });
      } else {
        this.dbg('getUserMedia indisponible → démarrage direct (moins fiable)');
        this.next();
      }
    }

    renderAsking() {
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<p style="font-size:2.4rem">🎤</p>' +
          '<p>' + t('speak_ready') + '…</p>' +
        '</div>';
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
      this.pendingFragment = null;
      clearTimeout(this._fragTimer); clearTimeout(this._judgeTimer);
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
          '<pre id="sp-debug" style="margin-top:14px;padding:10px;background:#00000055;border-radius:8px;font-size:.7rem;line-height:1.4;color:#9fb4c7;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto"></pre>' +
        '</div>';
      // bouton micro = relance manuelle (au cas où)
      const mic = this.host.querySelector('#sp-mic');
      mic.addEventListener('click', () => { this.netErr = 0; this.speaking = false; this.openMic(true); });
      // republie le journal de diagnostic (le HTML vient d'être recréé pour cette question)
      const dbgEl = this.host.querySelector('#sp-debug');
      if (dbgEl) dbgEl.textContent = this.dbgLines.join('\n');
      this.dbg('Q' + this.i + ' : ' + a + '×' + b + '=' + this.answer);
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
    // Jeton de génération (micGen) : une session de reconnaissance FERMÉE peut
    // encore envoyer ses évènements (onEnd/onError) EN RETARD, après qu'une
    // NOUVELLE session ait déjà démarré. Sans garde, ces évènements périmés
    // écrasaient `this.rec` de la session ACTUELLE (this.rec = null) et
    // déclenchaient une réouverture concurrente → la reconnaissance cessait de
    // fonctionner après la 1re question. Chaque callback vérifie maintenant
    // qu'il appartient bien à la génération EN COURS avant d'agir.
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
      const myGen = ++this.micGen;
      this.dbg('🎤 ouverture micro (gen ' + myGen + ') lang=' + this.code());
      this.rec = MK.audio.listen(this.code(), {
        continuous: true,
        onResult: function (alts, isFinal) {
          self.dbg((isFinal ? '📝final: ' : '📝interim: ') + JSON.stringify(alts));
          if (myGen !== self.micGen) { self.dbg('(ignoré : session périmée)'); return; }
          self.onSaid(alts, isFinal);
        },
        onError: function (err) {
          self.dbg('⚠️ erreur reconnaissance: ' + err + (myGen !== self.micGen ? ' (session périmée, ignorée)' : ''));
          if (myGen !== self.micGen) return;
          self.opening = false; self.onErr(err);
        },
        onEnd: function () {
          if (myGen !== self.micGen) { self.dbg('fin session périmée (gen ' + myGen + '), ignorée'); return; }
          self.dbg('session micro terminée (gen ' + myGen + ')');
          self.opening = false; self.rec = null; self.setMic(false);
          // silence / fin de session → on rouvre en SILENCE (aucun reproche, attente illimitée)
          if (self.active && !self.speaking) self.later(function () { self.openMic(); }, 250);
        },
      });
      if (!this.rec) this.dbg('❌ MK.audio.listen() a renvoyé null (non supporté ?)');
      this.later(() => { this.opening = false; }, 700);
      if (!this.rec) { this.opening = false; this.setMic(false); }
    }

    closeMic() {
      this.micGen++; // invalide immédiatement toute callback tardive de CETTE session
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
      // le micro capte bel et bien du son → annule tout diagnostic « rien ne marche »
      this.everHeard = true; this.silentStreak = 0; this.audioCapErr = 0;
      const heard = this.host.querySelector('#sp-heard');
      const fb = this.host.querySelector('#sp-fb');
      if (heard) heard.textContent = '« ' + said + ' »';
      this.netErr = 0;

      // Le navigateur découpe parfois un nombre en 2 mots (« cinquante » PUIS « six »
      // dans deux résultats séparés) → on teste aussi CHAQUE alternative combinée
      // avec le fragment précédent, pour recomposer les nombres à deux mots.
      const lang = MK.i18n.getLang();
      const candidates = alts.slice();
      if (this.pendingFragment) {
        alts.forEach((tx) => candidates.push(this.pendingFragment + ' ' + tx));
      }
      const ok = candidates.some((tx) => MK.engine.spokenMatchesAnswer(tx, this.answer, lang));

      if (ok) {
        // BONNE réponse (éventuellement recomposée à partir de 2 fragments)
        clearTimeout(this._fragTimer); clearTimeout(this._judgeTimer);
        this.pendingFragment = null;
        MK.progress.recordFact(this.table, this.i, true);
        this.speaking = true; this.closeMic(); this.setMic(false);
        this.correct++;
        if (fb) { fb.textContent = t('speak_bravo_kind'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
        MK.progress.addXP(10);
        this.i++;
        this.later(() => this.next(), 1100);   // → calcul suivant (annoncé une fois)
        return;
      }

      // PAS de correspondance pour l'instant : le navigateur découpe parfois un
      // nombre en 2 mots séparés (« cinquante » PUIS « six ») → on ne juge PAS
      // « faux » tout de suite. On garde ce fragment et on attend un court instant
      // (600 ms) : si un fragment suivant arrive et se combine en bonne réponse,
      // le jugement « faux » ci-dessous est annulé — l'enfant n'est jamais pénalisé
      // pour une réponse correcte simplement coupée en deux par la reconnaissance.
      this.pendingFragment = said;
      clearTimeout(this._fragTimer);
      this._fragTimer = this.later(() => { this.pendingFragment = null; }, 2500);
      clearTimeout(this._judgeTimer);
      this._judgeTimer = this.later(() => this.judgeWrong(), 600);
    }

    // Confirmé faux après le court délai de recomposition (voir onSaid)
    judgeWrong() {
      if (!this.active || this.speaking) return;
      const fb = this.host.querySelector('#sp-fb');
      MK.progress.recordFact(this.table, this.i, false);
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

    onErr(err) {
      this.setMic(false);
      // « audio-capture » = le navigateur n'arrive PAS DU TOUT à lire le micro
      // (permission bloquée au niveau OS, aucun périphérique, micro pris par une
      // autre appli...). C'est un vrai problème persistant, PAS un simple silence :
      // on ne doit JAMAIS le cacher indéfiniment, sinon rien ne s'affiche jamais.
      if (err === 'audio-capture') {
        this.audioCapErr = (this.audioCapErr || 0) + 1;
        if (this.audioCapErr >= 3) { this.hardStop(err); return; }
        return; // 1-2 fois : peut être transitoire, on retente encore
      }
      if (err === 'no-speech' || err === 'aborted') {
        this.audioCapErr = 0;
        // Silence prolongé anormal : si après beaucoup de tentatives on n'a JAMAIS
        // entendu le moindre son, c'est probablement un vrai souci micro (pas de
        // la patience) → on le signale au lieu de rester silencieux pour toujours.
        this.silentStreak = (this.silentStreak || 0) + 1;
        if (!this.everHeard && this.silentStreak >= 12) { this.hardStop('audio-capture'); return; }
        return; // PATIENT : aucun reproche, onEnd rouvrira le micro
      }
      if (err === 'network') {
        this.netErr++;
        // Erreur RÉSEAU = le navigateur n'arrive pas à joindre le service de
        // reconnaissance vocale de Google (pare-feu, extension de blocage,
        // réseau filtré...). Ce n'est PAS un souci de micro ni de matching :
        // on le signale clairement et vite, avec des boutons d'action.
        if (this.netErr >= NET_MAX) { this.hardStop('network'); return; }
        return; // 1-2 fois : peut être transitoire, on retente encore
      }
      this.hardStop(err); // micro refusé / indisponible
    }

    hardStop(err) {
      this.active = false; this.closeMic(); this.clearTimers(); this.setMic(false);
      this.dbg('🛑 arrêt : ' + err);
      const fb = this.host.querySelector('#sp-fb');
      const denied = (err === 'not-allowed' || err === 'service-not-allowed');
      const msg = (err === 'network') ? t('speak_network_error') : (denied ? t('speak_mic_denied') : t('speak_mic_error'));
      if (fb) { fb.textContent = msg; fb.className = 'feedback'; }
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
