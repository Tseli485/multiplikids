/* ============================================================
   MultipliKids — games/review.js
   RÉVISION ADAPTATIVE 🎯 : rejoue en priorité les calculs que l'enfant
   rate le plus (suivi par calcul). QCM SANS chrono (calme, pédagogique).
   Contrat : new Review(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const TOTAL_Q = 10;

  class Review {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.qIndex = 0; this.correct = 0; this.locked = false;
    }

    start() {
      this.qIndex = 0; this.correct = 0;
      // construit la file : les calculs les plus faibles d'abord
      this.pool = MK.progress.weakestFacts(this.table, TOTAL_Q);
      this.next();
    }

    next() {
      if (this.qIndex >= TOTAL_Q) { this.finish(); return; }
      this.locked = false;
      const f = this.pool[this.qIndex % this.pool.length];
      this.q = { a: f.a, b: f.b, answer: f.answer, options: MK.engine.makeDistractors(f.answer, f.a, f.b) };
      this.render();
      MK.audio.speakOperation(this.q.a, this.q.b);
    }

    render() {
      const opts = this.q.options.map(function (o) {
        return '<button class="answer-btn" data-v="' + o + '">' + o + '</button>';
      }).join('');
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span>🎯 ' + t('game_review') + '</span>' +
            '<span class="score">' + t('score') + ' : ' + this.correct + '</span>' +
          '</div>' +
          '<div class="question-big">' + this.q.a + ' × ' + this.q.b + ' = ?</div>' +
          '<div class="center" style="margin-bottom:10px"><button class="btn btn--ghost" id="rv-repeat" aria-label="' + t('btn_repeat') + '">' + t('btn_repeat') + '</button></div>' +
          '<div class="answers" id="rv-answers">' + opts + '</div>' +
          '<div class="feedback" id="rv-fb" role="status"></div>' +
          '<div class="game-hud"><span class="score">' + (this.qIndex + 1) + ' / ' + TOTAL_Q + '</span></div>' +
        '</div>';
      const self = this;
      this.host.querySelectorAll('.answer-btn').forEach(function (b) {
        b.addEventListener('click', function () { self.choose(parseInt(b.dataset.v, 10), b); });
      });
      this.host.querySelector('#rv-repeat').addEventListener('click', function () { MK.audio.speakOperation(self.q.a, self.q.b); });
    }

    choose(value, btn) {
      if (this.locked) return;
      this.locked = true;
      const ok = value === this.q.answer;
      MK.progress.recordFact(this.q.a, this.q.b, ok);
      const fb = this.host.querySelector('#rv-fb');
      if (ok) {
        btn.classList.add('correct');
        this.correct++;
        MK.progress.addXP(10);
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
        this.qIndex++;
        setTimeout(() => this.next(), 1100);
      } else {
        btn.classList.add('wrong');
        this.host.querySelectorAll('.answer-btn').forEach((b) => { if (parseInt(b.dataset.v, 10) === this.q.answer) b.classList.add('correct'); });
        if (fb) { fb.textContent = t('speak_almost'); fb.className = 'feedback'; }
        MK.audio.playWrong();
        // on réénonce la bonne réponse (pédagogique), puis on avance
        MK.audio.speakOperation(this.q.a, this.q.b, this.q.answer);
        this.qIndex++;
        setTimeout(() => this.next(), 1800);
      }
    }

    finish() {
      const percent = MK.engine.pct(this.correct, TOTAL_Q);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">🎯 ' + t('level_done') + '</h2>' +
          '<p class="celebrate" style="font-size:1.6rem">' + this.correct + ' / ' + TOTAL_Q + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="rv-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#rv-again').addEventListener('click', () => this.start());
      if (percent >= 70) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: TOTAL_Q, percent: percent, speedBonus: false });
    }

    stop() {}
  }

  MK.games.Review = Review;
})();
