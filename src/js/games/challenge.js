/* ============================================================
   MultipliKids — games/challenge.js
   DÉFI DU JOUR 🏆 : QCM MIXTE (toutes les tables ×2..×10), 10 questions.
   À faire une fois par jour → renforce la série 🔥. Bonus d'XP à la fin.
   Contrat : new Challenge(host, {onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const TOTAL_Q = 10;

  class Challenge {
    constructor(host, opts) {
      this.host = host;
      this.onFinish = opts.onFinish || function () {};
      this.qIndex = 0; this.correct = 0; this.locked = false;
    }
    start() { this.qIndex = 0; this.correct = 0; this.next(); }

    next() {
      if (this.qIndex >= TOTAL_Q) { this.finish(); return; }
      this.locked = false;
      this.q = MK.engine.makeQuiz(null); // table mixte
      this.render();
      MK.audio.speakOperation(this.q.a, this.q.b);
    }

    render() {
      const opts = this.q.options.map(function (o) { return '<button class="answer-btn" data-v="' + o + '">' + o + '</button>'; }).join('');
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud"><span>🏆 ' + t('challenge') + '</span>' +
            '<span class="score">' + t('score') + ' : ' + this.correct + '</span></div>' +
          '<div class="question-big">' + this.q.a + ' × ' + this.q.b + ' = ?</div>' +
          '<div class="answers">' + opts + '</div>' +
          '<div class="feedback" id="ch-fb" role="status"></div>' +
          '<div class="game-hud"><span class="score">' + (this.qIndex + 1) + ' / ' + TOTAL_Q + '</span></div>' +
        '</div>';
      const self = this;
      this.host.querySelectorAll('.answer-btn').forEach(function (b) { b.addEventListener('click', function () { self.choose(parseInt(b.dataset.v, 10), b); }); });
    }

    choose(value, btn) {
      if (this.locked) return;
      this.locked = true;
      const ok = value === this.q.answer;
      MK.progress.recordFact(this.q.a, this.q.b, ok);
      const fb = this.host.querySelector('#ch-fb');
      if (ok) {
        btn.classList.add('correct'); this.correct++; MK.progress.addXP(10);
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
      } else {
        btn.classList.add('wrong');
        this.host.querySelectorAll('.answer-btn').forEach((b) => { if (parseInt(b.dataset.v, 10) === this.q.answer) b.classList.add('correct'); });
        if (fb) { fb.textContent = t('speak_almost'); fb.className = 'feedback'; }
        MK.audio.playWrong();
        MK.audio.speakOperation(this.q.a, this.q.b, this.q.answer);
      }
      this.qIndex++;
      setTimeout(() => this.next(), 1200);
    }

    finish() {
      const percent = MK.engine.pct(this.correct, TOTAL_Q);
      MK.progress.addXP(30);                 // bonus du défi
      MK.progress.markChallengeDone();
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">🏆 ' + t('challenge') + '</h2>' +
          '<p class="celebrate" style="font-size:1.6rem">' + this.correct + ' / ' + TOTAL_Q + '</p>' +
          '<p>+30 XP · ' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="ch-home">' + t('btn_home') + '</button></div>' +
        '</div>';
      this.host.querySelector('#ch-home').addEventListener('click', () => { location.hash = 'home'; });
      if (percent >= 70) MK.visual.confetti(140);
      this.onFinish({ percent: percent, correct: this.correct, total: TOTAL_Q });
    }
    stop() {}
  }
  MK.games.Challenge = Challenge;
})();
