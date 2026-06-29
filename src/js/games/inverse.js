/* ============================================================
   MultipliKids — games/inverse.js
   TABLES INVERSÉES 🔢 : « 7 × ? = 56 » → trouver le facteur manquant.
   Fait comprendre la division / les facteurs. QCM, ×1..×10.
   Contrat : new Inverse(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const TOTAL_Q = 10;

  function distractFactor(b) {
    const set = new Set([b]);
    let guard = 0;
    while (set.size < 4 && guard < 50) {
      const v = Math.min(10, Math.max(1, b + MK.engine.randInt(-3, 3)));
      set.add(v); guard++;
    }
    return MK.engine.shuffle(Array.from(set));
  }

  class Inverse {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.qIndex = 0; this.correct = 0; this.locked = false;
    }
    start() { this.qIndex = 0; this.correct = 0; this.next(); }

    next() {
      if (this.qIndex >= TOTAL_Q) { this.finish(); return; }
      this.locked = false;
      const a = this.table, b = MK.engine.randInt(1, 10);
      this.b = b; this.product = a * b;
      this.options = distractFactor(b);
      this.render();
      MK.audio.speakOperation(a, b, this.product); // énonce le calcul complet (indice)
    }

    render() {
      const a = this.table;
      const opts = this.options.map(function (o) {
        return '<button class="answer-btn" data-v="' + o + '">' + o + '</button>';
      }).join('');
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud"><span>🔢 ' + t('table_of') + ' ' + a + '</span>' +
            '<span class="score">' + t('score') + ' : ' + this.correct + '</span></div>' +
          '<div class="question-big">' + a + ' × <span style="color:var(--color-accent)">?</span> = ' + this.product + '</div>' +
          '<div class="answers">' + opts + '</div>' +
          '<div class="feedback" id="iv-fb" role="status"></div>' +
          '<div class="game-hud"><span class="score">' + (this.qIndex + 1) + ' / ' + TOTAL_Q + '</span></div>' +
        '</div>';
      const self = this;
      this.host.querySelectorAll('.answer-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { self.choose(parseInt(btn.dataset.v, 10), btn); });
      });
    }

    choose(value, btn) {
      if (this.locked) return;
      this.locked = true;
      const ok = value === this.b;
      MK.progress.recordFact(this.table, this.b, ok);
      const fb = this.host.querySelector('#iv-fb');
      if (ok) {
        btn.classList.add('correct'); this.correct++; MK.progress.addXP(10);
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
      } else {
        btn.classList.add('wrong');
        this.host.querySelectorAll('.answer-btn').forEach((b) => { if (parseInt(b.dataset.v, 10) === this.b) b.classList.add('correct'); });
        if (fb) { fb.textContent = t('speak_almost'); fb.className = 'feedback'; }
        MK.audio.playWrong();
      }
      this.qIndex++;
      setTimeout(() => this.next(), 1200);
    }

    finish() {
      const percent = MK.engine.pct(this.correct, TOTAL_Q);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">🔢 ' + t('level_done') + '</h2>' +
          '<p class="celebrate" style="font-size:1.6rem">' + this.correct + ' / ' + TOTAL_Q + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="iv-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#iv-again').addEventListener('click', () => this.start());
      if (percent >= 70) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: TOTAL_Q, percent: percent, speedBonus: false });
    }
    stop() {}
  }
  MK.games.Inverse = Inverse;
})();
