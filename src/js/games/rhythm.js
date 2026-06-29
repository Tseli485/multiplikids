/* ============================================================
   MultipliKids — games/rhythm.js
   Des réponses tombent du haut ; taper la bonne avant la ligne.
   Vitesse augmente avec le niveau. Tap (mobile) + click (desktop).
   Contrat : new Rhythm(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };

  const ROUNDS = 10;

  class Rhythm {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.level = opts.level || 3;
      this.onFinish = opts.onFinish || function () {};
      this.round = 0;
      this.correct = 0;
      this.lives = 3;
      this.speedBonus = false;
      this.raf = null;
      this.tiles = [];          // {el, value, y, speed, correct}
      this.fieldH = 360;
      this.locked = false;
    }

    start() {
      this.round = 0; this.correct = 0; this.lives = 3; this.speedBonus = false; this.locked = false;
      this.renderShell();
      this.nextRound();
      this.loop();
    }

    renderShell() {
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span class="lives" id="ry-lives"></span>' +
            '<span id="ry-q"></span>' +
            '<span class="score" id="ry-score">0</span>' +
          '</div>' +
          '<p class="center" style="color:var(--color-text-dim)">' + t('tap_correct') + '</p>' +
          '<div class="rhythm-field" id="ry-field"><div class="rhythm-hitline"></div></div>' +
        '</div>';
      this.field = this.host.querySelector('#ry-field');
      this.fieldH = this.field.clientHeight || 360;
      this.updateLives();
    }

    updateLives() {
      const el = this.host.querySelector('#ry-lives');
      if (el) el.textContent = '❤'.repeat(this.lives) + '♡'.repeat(3 - this.lives);
      const sc = this.host.querySelector('#ry-score');
      if (sc) sc.textContent = String(this.correct);
    }

    nextRound() {
      if (this.round >= ROUNDS || this.lives <= 0) { this.finish(); return; }
      this.round++;
      this.locked = false;
      // nettoie les tuiles précédentes
      this.tiles.forEach((ti) => ti.el.remove());
      this.tiles = [];

      this.q = MK.engine.makeQuiz(this.table);
      this.host.querySelector('#ry-q').textContent = this.q.a + ' × ' + this.q.b;
      MK.audio.speakOperation(this.q.a, this.q.b);

      // vitesse : croît avec le niveau et le round (ralentie pour les enfants)
      const baseSpeed = 0.4 + (this.level * 0.08) + (this.round * 0.03); // px par frame approx (×60fps)
      const cols = this.q.options.length;
      const colW = 100 / cols;
      const self = this;
      this.q.options.forEach(function (val, i) {
        const el = document.createElement('div');
        el.className = 'rhythm-target';
        el.textContent = val;
        el.style.left = (i * colW + colW / 2) + '%';
        el.style.transform = 'translateX(-50%)';
        el.style.top = '-40px';
        self.field.appendChild(el);
        const tile = { el: el, value: val, y: -40, speed: baseSpeed * (1 + Math.random() * 0.15), correct: val === self.q.answer, dead: false };
        el.addEventListener('click', function () { self.hit(tile); });
        self.tiles.push(tile);
      });
    }

    loop() {
      const self = this;
      const limit = this.fieldH - 56; // ligne de frappe
      const step = function () {
        if (!self.locked) {
          let allPast = self.tiles.length > 0;
          self.tiles.forEach(function (ti) {
            if (ti.dead) return;
            ti.y += ti.speed * 1.5;
            ti.el.style.top = ti.y + 'px';
            if (ti.y < limit) allPast = false;
          });
          // si toutes les tuiles ont dépassé la ligne sans frappe correcte → vie perdue
          if (allPast && self.tiles.length) self.miss();
        }
        self.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    hit(tile) {
      if (this.locked || tile.dead) return;
      if (tile.correct) {
        this.locked = true;
        MK.progress.recordFact(this.q.a, this.q.b, true);
        tile.el.classList.add('correct');
        tile.el.style.background = 'var(--color-success)';
        this.correct++;
        MK.audio.playCorrect();
        const pts = (tile.y < this.fieldH * 0.6) ? 15 : 10; // frappe tôt = bonus
        if (pts > 10) this.speedBonus = true;
        MK.progress.addXP(pts);
        this.updateLives();
        setTimeout(() => this.nextRound(), 450);
      } else {
        tile.dead = true;
        MK.progress.recordFact(this.q.a, this.q.b, false);
        tile.el.style.opacity = '0.2';
        this.lives--;
        MK.audio.playWrong();
        MK.visual.shake(this.field);
        this.updateLives();
        if (this.lives <= 0) { this.locked = true; setTimeout(() => this.finish(), 500); }
      }
    }

    miss() {
      if (this.locked) return;
      this.locked = true;
      if (this.q) MK.progress.recordFact(this.q.a, this.q.b, false);
      this.lives--;
      MK.audio.playWrong();
      this.updateLives();
      setTimeout(() => { (this.lives <= 0) ? this.finish() : this.nextRound(); }, 500);
    }

    finish() {
      this.stop();
      const percent = MK.engine.pct(this.correct, ROUNDS);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + (this.lives > 0 ? '🎵 ' + t('level_done') : t('game_over')) + '</h2>' +
          '<p class="celebrate" style="font-size:1.8rem">' + this.correct + ' / ' + ROUNDS + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="ry-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#ry-again').addEventListener('click', () => this.start());
      if (percent >= 80) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: ROUNDS, percent: percent, speedBonus: this.speedBonus });
    }

    stop() {
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
      this.tiles.forEach((ti) => { if (ti.el && ti.el.remove) ti.el.remove(); });
      this.tiles = [];
    }
  }

  MK.games.Rhythm = Rhythm;
})();
