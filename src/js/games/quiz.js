/* ============================================================
   MultipliKids — games/quiz.js
   QCM chronométré : 10 questions, chrono 10s, 4 réponses.
   Contrat : new Quiz(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };

  const TOTAL_Q = 10;
  const TIME_MS = 10000;

  class Quiz {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.qIndex = 0;
      this.correct = 0;
      this.score = 0;
      this.speedBonus = false;
      this.timer = null;
      this.tStart = 0;
      this.locked = false;
    }

    start() {
      this.qIndex = 0; this.correct = 0; this.score = 0; this.speedBonus = false;
      this.next();
    }

    next() {
      if (this.qIndex >= TOTAL_Q) { this.finish(); return; }
      this.locked = false;
      this.q = MK.engine.makeQuiz(this.table);
      this.render();
      this.startTimer();
      MK.audio.speakOperation(this.q.a, this.q.b);
    }

    render() {
      const opts = this.q.options.map(function (o) {
        return '<button class="answer-btn" data-v="' + o + '">' + o + '</button>';
      }).join('');
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span>' + t('table_of') + ' ' + this.table + '</span>' +
            '<span class="score">' + t('score') + ' : ' + this.score + '</span>' +
          '</div>' +
          '<div class="bar" id="q-bar"><span></span></div>' +
          '<div class="question-big">' + this.q.a + ' × ' + this.q.b + ' = ?</div>' +
          '<div class="center" style="margin-bottom:10px"><button class="btn btn--ghost" id="q-repeat" aria-label="' + t('btn_repeat') + '">' + t('btn_repeat') + '</button></div>' +
          '<div class="answers" id="q-answers">' + opts + '</div>' +
          '<div class="feedback" id="q-fb" role="status"></div>' +
          '<div class="game-hud"><span class="score">' + (this.qIndex + 1) + ' / ' + TOTAL_Q + '</span></div>' +
        '</div>';

      const self = this;
      this.host.querySelectorAll('.answer-btn').forEach(function (b) {
        b.addEventListener('click', function () { self.choose(parseInt(b.dataset.v, 10), b); });
      });
      this.host.querySelector('#q-repeat').addEventListener('click', function () {
        MK.audio.speakOperation(self.q.a, self.q.b);
      });
    }

    startTimer() {
      this.tStart = performance.now();
      const bar = this.host.querySelector('#q-bar > span');
      const barWrap = this.host.querySelector('#q-bar');
      const self = this;
      const tick = function () {
        const elapsed = performance.now() - self.tStart;
        const ratio = Math.max(0, 1 - elapsed / TIME_MS);
        if (bar) bar.style.width = (ratio * 100) + '%';
        if (barWrap && ratio < 0.3) barWrap.classList.add('bar--danger');
        if (ratio <= 0) { self.timeUp(); return; }
        self.timer = requestAnimationFrame(tick);
      };
      this.timer = requestAnimationFrame(tick);
    }

    clearTimer() { if (this.timer) { cancelAnimationFrame(this.timer); this.timer = null; } }

    choose(value, btn) {
      if (this.locked) return;
      this.locked = true;
      this.clearTimer();
      const elapsed = performance.now() - this.tStart;
      const ok = value === this.q.answer;
      const fb = this.host.querySelector('#q-fb');

      if (ok) {
        btn.classList.add('correct');
        const pts = MK.engine.scoreAnswer(true, elapsed);
        this.score += pts; this.correct++;
        if (pts > 10) this.speedBonus = true;
        MK.progress.addXP(pts);
        fb.textContent = t('correct'); fb.className = 'feedback ok celebrate';
        MK.audio.playCorrect();
      } else {
        btn.classList.add('wrong');
        // surligne la bonne réponse
        this.host.querySelectorAll('.answer-btn').forEach((b) => {
          if (parseInt(b.dataset.v, 10) === this.q.answer) b.classList.add('correct');
        });
        fb.textContent = t('wrong'); fb.className = 'feedback ko';
        MK.visual.shake(this.host.querySelector('.game-stage'));
        MK.audio.playWrong();
      }
      this.qIndex++;
      setTimeout(() => this.next(), 1200);
    }

    timeUp() {
      if (this.locked) return;
      this.locked = true;
      this.clearTimer();
      const fb = this.host.querySelector('#q-fb');
      if (fb) { fb.textContent = t('time_up'); fb.className = 'feedback ko'; }
      this.host.querySelectorAll('.answer-btn').forEach((b) => {
        if (parseInt(b.dataset.v, 10) === this.q.answer) b.classList.add('correct');
      });
      MK.audio.playWrong();
      this.qIndex++;
      setTimeout(() => this.next(), 1200);
    }

    finish() {
      const percent = MK.engine.pct(this.correct, TOTAL_Q);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + t('game_over') + '</h2>' +
          '<p class="celebrate" style="font-size:1.6rem">' + t('your_score') + ' : ' + this.score + '</p>' +
          '<p>' + this.correct + ' / ' + TOTAL_Q + ' — ' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="q-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#q-again').addEventListener('click', () => this.start());
      if (percent >= 80) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: TOTAL_Q, percent: percent, speedBonus: this.speedBonus });
    }

    stop() { this.clearTimer(); }
  }

  MK.games.Quiz = Quiz;
})();
