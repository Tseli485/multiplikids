/* ============================================================
   MultipliKids — games/duel.js
   DUEL ⚔️ : 2 joueurs sur le même écran, à tour de rôle.
   8 questions mixtes (4 chacun). Le plus de bonnes réponses gagne.
   Contrat : new Duel(host, {onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };
  const TOTAL_Q = 8;
  const P = [{ tag: '🔵', cls: 'duel-p1' }, { tag: '🔴', cls: 'duel-p2' }];

  class Duel {
    constructor(host, opts) {
      this.host = host;
      this.onFinish = opts.onFinish || function () {};
      this.qIndex = 0; this.scores = [0, 0]; this.turn = 0; this.locked = false;
    }
    start() { this.qIndex = 0; this.scores = [0, 0]; this.turn = 0; this.next(); }

    next() {
      if (this.qIndex >= TOTAL_Q) { this.finish(); return; }
      this.locked = false;
      this.q = MK.engine.makeQuiz(null);
      this.render();
      MK.audio.speakOperation(this.q.a, this.q.b);
    }

    render() {
      const p = P[this.turn];
      const opts = this.q.options.map(function (o) { return '<button class="answer-btn" data-v="' + o + '">' + o + '</button>'; }).join('');
      this.host.innerHTML =
        '<div class="game-stage screen-enter ' + p.cls + '">' +
          '<div class="game-hud">' +
            '<span class="duel-s1">🔵 ' + this.scores[0] + '</span>' +
            '<span class="score">' + (this.qIndex + 1) + ' / ' + TOTAL_Q + '</span>' +
            '<span class="duel-s2">🔴 ' + this.scores[1] + '</span>' +
          '</div>' +
          '<p class="center duel-turn">' + p.tag + ' ' + t('duel_turn') + '</p>' +
          '<div class="question-big">' + this.q.a + ' × ' + this.q.b + ' = ?</div>' +
          '<div class="answers">' + opts + '</div>' +
          '<div class="feedback" id="du-fb" role="status"></div>' +
        '</div>';
      const self = this;
      this.host.querySelectorAll('.answer-btn').forEach(function (b) { b.addEventListener('click', function () { self.choose(parseInt(b.dataset.v, 10), b); }); });
    }

    choose(value, btn) {
      if (this.locked) return;
      this.locked = true;
      const ok = value === this.q.answer;
      const fb = this.host.querySelector('#du-fb');
      if (ok) {
        btn.classList.add('correct'); this.scores[this.turn]++;
        if (fb) { fb.textContent = t('correct'); fb.className = 'feedback ok celebrate'; }
        MK.audio.playCorrect();
      } else {
        btn.classList.add('wrong');
        this.host.querySelectorAll('.answer-btn').forEach((b) => { if (parseInt(b.dataset.v, 10) === this.q.answer) b.classList.add('correct'); });
        if (fb) { fb.textContent = t('wrong'); fb.className = 'feedback ko'; }
        MK.audio.playWrong();
      }
      this.qIndex++;
      this.turn = 1 - this.turn;   // au joueur suivant
      setTimeout(() => this.next(), 1200);
    }

    finish() {
      const s = this.scores;
      const winner = s[0] === s[1] ? t('duel_tie') : (s[0] > s[1] ? '🔵' : '🔴') + ' ' + t('duel_wins');
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">⚔️ ' + t('duel') + '</h2>' +
          '<p class="celebrate" style="font-size:1.6rem">🔵 ' + s[0] + '  —  ' + s[1] + ' 🔴</p>' +
          '<p style="font-size:1.3rem">' + winner + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="du-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#du-again').addEventListener('click', () => this.start());
      MK.visual.confetti();
      this.onFinish({ scores: s });
    }
    stop() {}
  }
  MK.games.Duel = Duel;
})();
