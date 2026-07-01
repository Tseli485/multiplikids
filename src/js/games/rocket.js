/* ============================================================
   MultipliKids — games/rocket.js
   La fusée monte si bonne réponse, descend si mauvaise.
   3 vies (étoiles). Boss final : 10 questions en 60 secondes.
   Contrat : new Rocket(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };

  const GOAL = 10;          // questions pour gagner
  const TIME_LIMIT = 60000; // boss : 60s

  class Rocket {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.lives = 3;
      this.correct = 0;
      this.answered = 0;
      this.altitude = 10;   // % depuis le bas
      this.locked = false;
      this.speedBonus = false;
      this.deadline = 0;
      this.raf = null;
    }

    start() {
      this.lives = 3; this.correct = 0; this.answered = 0; this.altitude = 10;
      this.speedBonus = false; this.locked = false;
      this.deadline = performance.now() + TIME_LIMIT;
      this.renderShell();
      this.loopTimer();
      this.next();
    }

    renderShell() {
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span class="lives" id="rk-lives"></span>' +
            '<span>' + t('boss') + '</span>' +
            '<span class="score" id="rk-time"></span>' +
          '</div>' +
          '<div class="rocket-field" id="rk-field">' +
            '<div class="rocket" id="rk-rocket" style="bottom:10%">🚀</div>' +
          '</div>' +
          '<div class="question-big" id="rk-q"></div>' +
          '<div class="answers" id="rk-answers"></div>' +
          '<div class="feedback" id="rk-fb" role="status"></div>' +
        '</div>';
      // étoiles de fond dans le champ
      const field = this.host.querySelector('#rk-field');
      for (let i = 0; i < 24; i++) {
        const s = document.createElement('div');
        s.style.position = 'absolute';
        s.style.width = '2px'; s.style.height = '2px'; s.style.background = '#fff';
        s.style.left = (Math.random() * 100) + '%'; s.style.top = (Math.random() * 100) + '%';
        s.style.opacity = (Math.random() * 0.7 + 0.2);
        field.appendChild(s);
      }
      this.updateLives();
    }

    updateLives() {
      const el = this.host.querySelector('#rk-lives');
      if (el) el.textContent = '⭐'.repeat(this.lives) + '✩'.repeat(3 - this.lives);
    }

    loopTimer() {
      const self = this;
      const tick = function () {
        const left = Math.max(0, self.deadline - performance.now());
        const el = self.host.querySelector('#rk-time');
        if (el) el.textContent = '⏱ ' + Math.ceil(left / 1000) + 's';
        if (left <= 0) { self.end(false); return; }
        self.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    next() {
      if (this.correct >= GOAL) { this.end(true); return; }
      if (this.lives <= 0) { this.end(false); return; }
      this.locked = false;
      this.q = MK.engine.makeQuiz(this.table);
      this.tStart = performance.now();
      const qEl = this.host.querySelector('#rk-q');
      qEl.textContent = this.q.a + ' × ' + this.q.b + ' = ?';
      const ans = this.host.querySelector('#rk-answers');
      ans.innerHTML = this.q.options.map(function (o) {
        return '<button class="answer-btn" data-v="' + o + '">' + o + '</button>';
      }).join('');
      const self = this;
      ans.querySelectorAll('.answer-btn').forEach(function (b) {
        b.addEventListener('click', function () { self.choose(parseInt(b.dataset.v, 10), b); });
      });
      MK.audio.speakOperation(this.q.a, this.q.b);
    }

    setAltitude(pct) {
      this.altitude = Math.max(2, Math.min(92, pct));
      const r = this.host.querySelector('#rk-rocket');
      if (r) r.style.bottom = this.altitude + '%';
    }

    choose(value, btn) {
      if (this.locked) return;
      this.locked = true;
      const elapsed = performance.now() - this.tStart;
      const ok = value === this.q.answer;
      MK.progress.recordFact(this.q.a, this.q.b, ok);
      const fb = this.host.querySelector('#rk-fb');
      this.answered++;

      if (ok) {
        btn.classList.add('correct');
        this.correct++;
        const pts = MK.engine.scoreAnswer(true, elapsed);
        if (pts > 10) this.speedBonus = true;
        MK.progress.addXP(pts);
        this.setAltitude(this.altitude + 9);
        fb.textContent = t('correct'); fb.className = 'feedback ok';
        MK.audio.playCorrect();
      } else {
        btn.classList.add('wrong');
        this.lives--;
        this.updateLives();
        this.setAltitude(this.altitude - 12);
        fb.textContent = t('wrong'); fb.className = 'feedback ko';
        MK.visual.shake(this.host.querySelector('#rk-field'));
        MK.audio.playWrong();
        MK.audio.speakOperation(this.q.a, this.q.b, this.q.answer);
      }
      // délai plus long sur erreur : laisse le temps d'entendre la bonne réponse
      setTimeout(() => this.next(), ok ? 800 : 1900);
    }

    end(win) {
      this.stop();
      const percent = MK.engine.pct(this.correct, Math.max(this.answered, GOAL));
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + (win ? '🏆 ' + t('level_done') : t('game_over')) + '</h2>' +
          '<p class="celebrate" style="font-size:2rem">🚀 ' + this.correct + ' / ' + GOAL + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="rk-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#rk-again').addEventListener('click', () => this.start());
      if (win) MK.visual.confetti(140);
      this.onFinish({ table: this.table, correct: this.correct, total: Math.max(this.answered, GOAL), percent: percent, speedBonus: this.speedBonus });
    }

    stop() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }
  }

  MK.games.Rocket = Rocket;
})();
