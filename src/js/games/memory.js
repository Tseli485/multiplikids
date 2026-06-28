/* ============================================================
   MultipliKids — games/memory.js
   Jeu mémoire : associer une opération (6×7) à son résultat (42).
   Tailles : 3×4 (6 paires) / 4×4 (8 paires) / 4×6 (12 paires) selon niveau.
   Contrat : new Memory(host, {table, level, onFinish}) → start()/stop()
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {}; MK.games = MK.games || {};
  const t = function (k) { return MK.i18n.t(k); };

  // niveau → nombre de paires + colonnes
  const SIZES = { 1: { pairs: 6, cols: 4 }, 2: { pairs: 6, cols: 4 }, 3: { pairs: 8, cols: 4 }, 4: { pairs: 12, cols: 4 } };

  class Memory {
    constructor(host, opts) {
      this.host = host;
      this.table = opts.table || 2;
      this.level = opts.level || 1;
      this.onFinish = opts.onFinish || function () {};
      this.cards = [];
      this.first = null;
      this.lock = false;
      this.matched = 0;
      this.moves = 0;
    }

    start() {
      const conf = SIZES[this.level] || SIZES[1];
      const pairs = MK.engine.makeMemoryPairs(this.table, conf.pairs);
      this.totalPairs = pairs.length;
      this.matched = 0; this.moves = 0; this.first = null; this.lock = false;
      // construit les cartes : pour chaque paire, une carte "op" et une carte "résultat"
      const cards = [];
      pairs.forEach(function (p, i) {
        cards.push({ id: i, kind: 'op', label: p.a + '×' + p.b, key: p.result });
        cards.push({ id: i, kind: 'res', label: String(p.result), key: p.result });
      });
      this.cards = MK.engine.shuffle(cards);
      this.cols = conf.cols;
      this.render();
    }

    render() {
      const cells = this.cards.map((c, idx) =>
        '<div class="mem-card" data-idx="' + idx + '" role="button" tabindex="0" aria-label="' + t('find_pair') + '"><span class="face">?</span></div>'
      ).join('');
      this.host.innerHTML =
        '<div class="game-stage screen-enter">' +
          '<div class="game-hud">' +
            '<span>' + t('find_pair') + '</span>' +
            '<span class="score">' + this.matched + ' / ' + this.totalPairs + '</span>' +
          '</div>' +
          '<div class="memory-grid" id="mem-grid" style="grid-template-columns:repeat(' + this.cols + ',1fr)">' + cells + '</div>' +
        '</div>';
      const self = this;
      this.host.querySelectorAll('.mem-card').forEach(function (el) {
        const fn = function () { self.flip(parseInt(el.dataset.idx, 10), el); };
        el.addEventListener('click', fn);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
      });
    }

    flip(idx, el) {
      if (this.lock) return;
      const card = this.cards[idx];
      if (el.classList.contains('matched') || el.classList.contains('flipped')) return;
      el.classList.add('flipped');
      el.querySelector('.face').textContent = card.label;
      if (card.kind === 'op') MK.audio.speakOperation(parseInt(card.label.split('×')[0], 10), parseInt(card.label.split('×')[1], 10));

      if (!this.first) { this.first = { idx: idx, el: el, card: card }; return; }

      // 2e carte
      this.moves++;
      const a = this.first, b = { idx: idx, el: el, card: card };
      const isPair = (a.card.id === b.card.id) && (a.card.kind !== b.card.kind);
      this.first = null;

      if (isPair) {
        a.el.classList.add('matched'); b.el.classList.add('matched');
        this.matched++;
        MK.audio.playCorrect();
        MK.progress.addXP(10);
        this.updateCounter();
        if (this.matched === this.totalPairs) setTimeout(() => this.finish(), 600);
      } else {
        this.lock = true;
        MK.audio.playWrong();
        setTimeout(() => {
          [a, b].forEach(function (x) {
            x.el.classList.remove('flipped');
            x.el.querySelector('.face').textContent = '?';
          });
          this.lock = false;
        }, 900);
      }
    }

    updateCounter() {
      const s = this.host.querySelector('.score');
      if (s) s.textContent = this.matched + ' / ' + this.totalPairs;
    }

    finish() {
      // score % basé sur l'efficacité (paires / coups)
      const percent = Math.min(100, Math.round((this.totalPairs / Math.max(this.moves, this.totalPairs)) * 100));
      this.host.innerHTML =
        '<div class="game-stage center screen-enter">' +
          '<h2 class="screen-title">' + t('level_done') + '</h2>' +
          '<p class="celebrate" style="font-size:1.6rem">👏 ' + this.totalPairs + ' / ' + this.totalPairs + '</p>' +
          '<p>' + t(MK.engine.encourageKey(percent)) + '</p>' +
          '<div class="row mt"><button class="btn btn--primary" id="mem-again">' + t('btn_replay') + '</button></div>' +
        '</div>';
      this.host.querySelector('#mem-again').addEventListener('click', () => this.start());
      MK.visual.confetti();
      this.onFinish({ table: this.table, correct: this.totalPairs, total: this.totalPairs, percent: percent, speedBonus: false });
    }

    stop() { /* pas de timer */ }
  }

  MK.games.Memory = Memory;
})();
