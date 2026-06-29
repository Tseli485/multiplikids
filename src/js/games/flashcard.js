/* ============================================================
   MultipliKids — games/flashcard.js
   Cartes flash avec flip 3D + répétition espacée simple (3 niveaux).
   Contrat : new Flashcard(host, {table, level, onFinish}) → start() / stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };

  class Flashcard {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.onFinish = opts.onFinish || function () {};
      this.deck = [];          // {a,b,answer,mastery}
      this.index = 0;
      this.flipped = false;
      this.correct = 0;
      this.total = 0;
      this.speedBonus = false;
    }

    buildDeck() {
      this.deck = [];
      for (let b = 1; b <= 12; b++) {
        this.deck.push({ a: this.table, b: b, answer: this.table * b, mastery: 0 });
      }
      this.deck = MK.engine.shuffle(this.deck);
    }

    start() {
      this.buildDeck();
      this.index = 0;
      this.render();
    }

    current() { return this.deck[this.index]; }

    render() {
      const c = this.current();
      if (!c) { this.finish(); return; }
      this.flipped = false;
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span>' + t('table_of') + ' ' + this.table + '</span>' +
            '<span class="score">' + (this.index + 1) + ' / ' + this.deck.length + '</span>' +
          '</div>' +
          '<p class="center" style="color:var(--color-text-dim)">' + t('tap_to_flip') + '</p>' +
          '<div class="flashcard-wrap">' +
            '<div class="flashcard" id="fc-card" role="button" tabindex="0" aria-label="' + c.a + ' × ' + c.b + '">' +
              '<div class="face front">' + c.a + ' × ' + c.b + ' = ?</div>' +
              '<div class="face back">' + c.answer + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="center"><button class="btn btn--ghost" id="fc-repeat" aria-label="' + t('btn_repeat') + '">' + t('btn_repeat') + '</button></div>' +
          '<div class="row mt" id="fc-actions"></div>' +
        '</div>';

      const card = this.host.querySelector('#fc-card');
      const flip = () => this.flip();
      card.addEventListener('click', flip);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      this.host.querySelector('#fc-repeat').addEventListener('click', () => {
        MK.audio.speakOperation(c.a, c.b, this.flipped ? c.answer : undefined);
      });
      // prononce l'opération à l'apparition
      MK.audio.speakOperation(c.a, c.b);
    }

    flip() {
      if (this.flipped) return;
      this.flipped = true;
      const c = this.current();
      const card = this.host.querySelector('#fc-card');
      card.classList.add('flipped');
      MK.audio.speakOperation(c.a, c.b, c.answer);
      // affiche les boutons d'auto-évaluation
      const actions = this.host.querySelector('#fc-actions');
      actions.innerHTML =
        '<button class="btn btn--secondary" id="fc-knew">' + t('btn_knew') + '</button>' +
        '<button class="btn btn--ghost" id="fc-didnt">' + t('btn_didnt') + '</button>';
      actions.querySelector('#fc-knew').addEventListener('click', () => this.answer(true));
      actions.querySelector('#fc-didnt').addEventListener('click', () => this.answer(false));
    }

    answer(knew) {
      const c = this.current();
      this.total++;
      MK.progress.recordFact(c.a, c.b, knew);
      if (knew) {
        this.correct++;
        c.mastery = Math.min(3, c.mastery + 1);
        MK.audio.playCorrect();
        MK.progress.addXP(10);
      } else {
        c.mastery = 0;
        MK.audio.playWrong();
        // répétition espacée : la carte ratée revient plus tard dans le deck
        this.deck.push(Object.assign({}, c));
      }
      this.index++;
      this.render();
    }

    finish() {
      const percent = MK.engine.pct(this.correct, this.total);
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + t('level_done') + '</h2>' +
          '<p class="celebrate" style="font-size:2rem">' + this.correct + ' / ' + this.total + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="fc-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#fc-again').addEventListener('click', () => this.start());
      if (percent >= 80) MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.correct, total: this.total, percent: percent, speedBonus: this.speedBonus });
    }

    stop() { /* rien à nettoyer (pas de timer) */ }
  }

  MK.games.Flashcard = Flashcard;
})();
