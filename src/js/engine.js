/* ============================================================
   MultipliKids — engine.js
   Logique pédagogique PURE : tables, questions, distracteurs, score.
   Aucun effet de bord (pas de DOM, pas de localStorage).
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {};

  // Tables disponibles par niveau pédagogique
  const LEVEL_TABLES = {
    1: [1, 2, 5, 10],
    2: [3, 4, 6],
    3: [7, 8, 9],
    4: [11, 12],
  };

  // Jeux débloqués par niveau
  const LEVEL_GAMES = {
    1: ['flashcard'],
    2: ['flashcard', 'quiz', 'memory'],
    3: ['flashcard', 'quiz', 'memory', 'rocket', 'rhythm'],
    4: ['flashcard', 'quiz', 'memory', 'rocket', 'rhythm'],
  };

  const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Entier aléatoire [min, max]
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Limite des multiplicateurs : les tables vont jusqu'à ×10 (leçons ET jeux)
  const MAX_MULT = 10;

  // Génère une question pour une table donnée (multiplicateur 1..10)
  // table = null → table mixte (multiplications variées)
  function makeQuestion(table) {
    const a = (table && table >= 1) ? table : randInt(2, MAX_MULT);
    const b = randInt(1, MAX_MULT);
    return { a: a, b: b, answer: a * b };
  }

  // 3 distracteurs proches et plausibles + la bonne réponse
  function makeDistractors(answer, a, b) {
    const set = new Set([answer]);
    // candidats : ±a, ±b, ±1, tables voisines
    const candidates = [
      answer + a, answer - a,
      answer + b, answer - b,
      answer + 1, answer - 1,
      a * (b + 1), a * (b - 1),
      (a + 1) * b, (a - 1) * b,
    ];
    const pool = shuffle(candidates);
    for (let i = 0; i < pool.length && set.size < 4; i++) {
      const v = pool[i];
      if (v > 0 && v !== answer && !set.has(v)) set.add(v);
    }
    // complète si besoin avec des valeurs proches aléatoires
    let guard = 0;
    while (set.size < 4 && guard < 50) {
      const v = answer + randInt(-6, 6);
      if (v > 0 && !set.has(v)) set.add(v);
      guard++;
    }
    return shuffle(Array.from(set));
  }

  // Question prête à l'emploi pour un QCM
  function makeQuiz(table) {
    const q = makeQuestion(table);
    return { a: q.a, b: q.b, answer: q.answer, options: makeDistractors(q.answer, q.a, q.b) };
  }

  // Paires pour le jeu mémoire : n paires (opération ↔ résultat) sans résultats dupliqués
  function makeMemoryPairs(table, count) {
    const pairs = [];
    const usedResults = new Set();
    let guard = 0;
    while (pairs.length < count && guard < 200) {
      guard++;
      const b = randInt(1, MAX_MULT);
      const a = (table && table >= 1) ? table : randInt(2, MAX_MULT);
      const res = a * b;
      if (usedResults.has(res)) continue; // évite l'ambiguïté de matching
      usedResults.add(res);
      pairs.push({ a: a, b: b, result: res });
    }
    return pairs;
  }

  // Score : bonne réponse = +base, bonus vitesse si rapide
  function scoreAnswer(correct, msElapsed, opts) {
    opts = opts || {};
    const base = opts.base || 10;
    const speedBonusMax = opts.speedBonus || 5;
    const fastThreshold = opts.fastMs || 3000;
    if (!correct) return 0;
    let pts = base;
    if (msElapsed != null && msElapsed <= fastThreshold) pts += speedBonusMax;
    return pts;
  }

  // Pourcentage de réussite
  function pct(correct, total) {
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }

  // Message d'encouragement selon le score %
  function encourageKey(percent) {
    if (percent >= 80) return 'encourage_high';
    if (percent >= 50) return 'encourage_mid';
    return 'encourage_low';
  }

  function tablesForLevel(level) { return LEVEL_TABLES[level] || LEVEL_TABLES[1]; }
  function gamesForLevel(level) { return LEVEL_GAMES[level] || LEVEL_GAMES[1]; }

  // Niveau auquel appartient une table
  function levelOfTable(table) {
    for (const lvl of [1, 2, 3, 4]) {
      if (LEVEL_TABLES[lvl].indexOf(table) !== -1) return lvl;
    }
    return 1;
  }

  /* ============================================================
     RECONNAISSANCE DE NOMBRE PARLÉ (0–100), FR + GR.
     Sert à valider la réponse orale de l'enfant (jeu Oral 🎤).
     ============================================================ */

  // Normalise : enlève accents (NFD), minuscule, tirets→espaces, garde lettres/chiffres
  function normSpoken(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire tonos grec + accents fr
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/[^a-z0-9α-ως\s]/gi, ' ')   // lettres latines/grecques + chiffres
      .replace(/\s+/g, ' ').trim();
  }

  // Unités (variantes orthographiques), formes SANS accent
  const EL_UNITS = [['μηδεν'], ['ενα', 'μια', 'ενας'], ['δυο'], ['τρια', 'τρεις'],
    ['τεσσερα', 'τεσσερις'], ['πεντε'], ['εξι'], ['εφτα', 'επτα'], ['οχτω', 'οκτω'], ['εννια', 'εννεα']];
  const EL_TEENS = { 10: ['δεκα'], 11: ['εντεκα', 'ενδεκα'], 12: ['δωδεκα'], 13: ['δεκατρια'],
    14: ['δεκατεσσερα'], 15: ['δεκαπεντε'], 16: ['δεκαεξι'], 17: ['δεκαεφτα', 'δεκαεπτα'],
    18: ['δεκαοχτω', 'δεκαοκτω'], 19: ['δεκαεννια', 'δεκαεννεα'] };
  const EL_TENS = { 20: 'εικοσι', 30: 'τριαντα', 40: 'σαραντα', 50: 'πενηντα', 60: 'εξηντα', 70: 'εβδομηντα', 80: 'ογδοντα', 90: 'ενενηντα' };

  const FR_UNITS = [['zero'], ['un'], ['deux'], ['trois'], ['quatre'], ['cinq'], ['six'], ['sept'], ['huit'], ['neuf']];
  const FR_TEENS = { 10: ['dix'], 11: ['onze'], 12: ['douze'], 13: ['treize'], 14: ['quatorze'], 15: ['quinze'], 16: ['seize'], 17: ['dix sept'], 18: ['dix huit'], 19: ['dix neuf'] };
  const FR_TENS = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

  // Renvoie les formes écrites possibles d'un nombre (0..100) dans la langue
  function numberWords(n, lang) {
    if (lang === 'fr') return frWords(n);
    return elWords(n);
  }
  function elWords(n) {
    if (n <= 9) return EL_UNITS[n].slice();
    if (n <= 19) return EL_TEENS[n].slice();
    if (n === 100) return ['εκατο', 'εκατον'];
    const t = Math.floor(n / 10) * 10, r = n % 10;
    if (r === 0) return [EL_TENS[t]];
    return EL_UNITS[r].map(function (u) { return EL_TENS[t] + ' ' + u; });
  }
  function frWords(n) {
    if (n <= 9) return FR_UNITS[n].slice();
    if (n <= 19) return FR_TEENS[n].slice();
    if (n === 100) return ['cent'];
    if (n < 70) {
      const t = Math.floor(n / 10) * 10, r = n % 10;
      if (r === 0) return [FR_TENS[t]];
      if (r === 1) return [FR_TENS[t] + ' et un', FR_TENS[t] + ' un'];
      return [FR_TENS[t] + ' ' + FR_UNITS[r][0]];
    }
    if (n < 80) { // 70–79 : soixante + 10..19
      const forms = FR_TEENS[n - 60].map(function (x) { return 'soixante ' + x; });
      if (n === 71) forms.push('soixante et onze');
      return forms;
    }
    if (n === 80) return ['quatre vingts', 'quatre vingt'];
    if (n < 90) return ['quatre vingt ' + FR_UNITS[n - 80][0]]; // 81..89
    return FR_TEENS[n - 80].map(function (x) { return 'quatre vingt ' + x; }); // 90..99
  }

  // La réponse orale correspond-elle au résultat attendu ? (chiffres OU mots, tolérant aux accents)
  function spokenMatchesAnswer(transcript, answer, lang) {
    const norm = normSpoken(transcript);
    if (!norm) return false;
    // 1) chiffres détectés
    const digits = norm.match(/\d+/g);
    if (digits && digits.some(function (d) { return parseInt(d, 10) === answer; })) return true;
    // 2) mots (comparaison par tokens → évite les faux positifs type « εξι » dans « δεκαεξι »)
    const tokens = norm.split(' ');
    const forms = numberWords(answer, lang).map(normSpoken);
    for (let fi = 0; fi < forms.length; fi++) {
      const f = forms[fi];
      if (f.indexOf(' ') === -1) {
        if (tokens.indexOf(f) !== -1) return true;
        if (tokens.indexOf(f.replace(/ /g, '')) !== -1) return true;
      } else {
        if (tokens.indexOf(f.replace(/ /g, '')) !== -1) return true; // forme « collée »
        const ft = f.split(' ');
        for (let i = 0; i + ft.length <= tokens.length; i++) {
          if (tokens.slice(i, i + ft.length).join(' ') === f) return true;
        }
      }
    }
    return false;
  }

  window.MK.engine = {
    MAX_MULT: MAX_MULT,
    ALL_TABLES: ALL_TABLES,
    LEVEL_TABLES: LEVEL_TABLES,
    LEVEL_GAMES: LEVEL_GAMES,
    randInt: randInt,
    shuffle: shuffle,
    makeQuestion: makeQuestion,
    makeDistractors: makeDistractors,
    makeQuiz: makeQuiz,
    makeMemoryPairs: makeMemoryPairs,
    scoreAnswer: scoreAnswer,
    pct: pct,
    encourageKey: encourageKey,
    tablesForLevel: tablesForLevel,
    gamesForLevel: gamesForLevel,
    levelOfTable: levelOfTable,
    numberWords: numberWords,
    spokenMatchesAnswer: spokenMatchesAnswer,
  };
})();
