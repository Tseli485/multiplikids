/* ============================================================
   MultipliKids — progress.js
   Persistance localStorage : XP, niveaux, badges, streak.
   Toujours protégé par try/catch (mode privé).
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {};

  const KEY = 'multiplikids_progress';

  // Définition des badges (id → table associée ou condition spéciale)
  const BADGE_DEFS = [
    { id: 'table1_star', table: 1 }, { id: 'table2_star', table: 2 },
    { id: 'table3_star', table: 3 }, { id: 'table4_star', table: 4 },
    { id: 'table5_star', table: 5 }, { id: 'table6_star', table: 6 },
    { id: 'table7_star', table: 7 }, { id: 'table8_star', table: 8 },
    { id: 'table9_star', table: 9 }, { id: 'table10_star', table: 10 },
    { id: 'table11_star', table: 11 }, { id: 'table12_star', table: 12 },
    { id: 'speed_demon', special: 'speed' },     // bonus vitesse atteint
    { id: 'streak_3', special: 'streak3' },        // 3 jours de suite
    { id: 'first_win', special: 'first' },          // 1re session réussie
  ];

  function defaultState() {
    return {
      level: 1,
      xp: 0,
      tables: {},           // { "2": { sessions, avgScore, recentScores:[], mastered } }
      badges: [],
      streak: 0,
      lastPlayDay: null,    // 'YYYY-MM-DD'
      lang: (MK.i18n ? MK.i18n.getLang() : 'el'),
      freeMode: true,       // DÉFAUT : toutes les tables/jeux accessibles (mode libre)
    };
  }

  let state = defaultState();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(defaultState(), parsed);
        state.tables = state.tables || {};
        state.badges = state.badges || [];
      }
    } catch (e) { state = defaultState(); }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function get() { return state; }

  // Date locale 'YYYY-MM-DD'
  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function addXP(amount) {
    state.xp += Math.max(0, amount | 0);
    save();
    return state.xp;
  }

  // Met à jour le streak journalier en début de session
  function touchStreak() {
    const today = todayStr();
    if (state.lastPlayDay === today) return state.streak;
    // jour précédent ?
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ym = String(y.getMonth() + 1).padStart(2, '0');
    const yd = String(y.getDate()).padStart(2, '0');
    const yesterday = y.getFullYear() + '-' + ym + '-' + yd;
    if (state.lastPlayDay === yesterday) state.streak += 1;
    else state.streak = 1;
    state.lastPlayDay = today;
    if (state.streak >= 3) unlockBadge('streak_3');
    save();
    return state.streak;
  }

  // Enregistre le résultat d'une session sur une table
  // result = { table, percent, speedBonus:bool }
  // Retourne la liste des badges nouvellement débloqués.
  function recordSession(result) {
    const tk = String(result.table);
    const T = state.tables[tk] || { sessions: 0, avgScore: 0, recentScores: [], mastered: false };
    T.sessions += 1;
    T.recentScores = (T.recentScores || []).concat(result.percent).slice(-3);
    // moyenne globale lissée
    T.avgScore = Math.round(((T.avgScore * (T.sessions - 1)) + result.percent) / T.sessions);

    const newBadges = [];

    // Maîtrise : 80% sur les 3 dernières sessions consécutives
    if (!T.mastered && T.recentScores.length >= 3 && T.recentScores.every(function (s) { return s >= 80; })) {
      T.mastered = true;
      const b = 'table' + result.table + '_star';
      if (unlockBadge(b)) newBadges.push(b);
    }
    state.tables[tk] = T;

    // Première victoire
    if (result.percent >= 50 && unlockBadge('first_win')) newBadges.push('first_win');
    // Démon de vitesse
    if (result.speedBonus && unlockBadge('speed_demon')) newBadges.push('speed_demon');
    if (state.streak >= 3 && unlockBadge('streak_3')) newBadges.push('streak_3');

    recomputeLevel();
    save();
    return newBadges;
  }

  function unlockBadge(id) {
    if (state.badges.indexOf(id) === -1) { state.badges.push(id); return true; }
    return false;
  }

  function hasBadge(id) { return state.badges.indexOf(id) !== -1; }

  // Déblocage de niveau : toutes les tables du niveau courant maîtrisées → niveau+1
  function recomputeLevel() {
    for (let lvl = 1; lvl <= 4; lvl++) {
      const tables = MK.engine.LEVEL_TABLES[lvl];
      const allMastered = tables.every(function (t) {
        const T = state.tables[String(t)];
        return T && T.mastered;
      });
      if (allMastered && state.level < lvl + 1 && lvl < 4) state.level = lvl + 1;
      if (!allMastered) break;
    }
    if (state.level > 4) state.level = 4;
  }

  function isLevelUnlocked(level) { return state.freeMode || level <= state.level; }
  function isTableUnlocked(table) {
    if (state.freeMode) return true;
    const lvl = MK.engine.levelOfTable(table);
    return isLevelUnlocked(lvl);
  }

  function getFreeMode() { return !!state.freeMode; }
  function setFreeMode(v) { state.freeMode = !!v; save(); }

  // Étoiles 0..3 pour une table (selon avgScore)
  function starsForTable(table) {
    const T = state.tables[String(table)];
    if (!T) return 0;
    if (T.mastered || T.avgScore >= 90) return 3;
    if (T.avgScore >= 70) return 2;
    if (T.avgScore >= 40 || T.sessions > 0) return 1;
    return 0;
  }

  function tablePercent(table) {
    const T = state.tables[String(table)];
    return T ? T.avgScore : 0;
  }

  function masteredCount() {
    return Object.keys(state.tables).filter(function (k) { return state.tables[k].mastered; }).length;
  }

  function reset() {
    state = defaultState();
    save();
  }

  window.MK.progress = {
    BADGE_DEFS: BADGE_DEFS,
    load: load, save: save, get: get,
    addXP: addXP,
    touchStreak: touchStreak,
    recordSession: recordSession,
    unlockBadge: unlockBadge, hasBadge: hasBadge,
    isLevelUnlocked: isLevelUnlocked, isTableUnlocked: isTableUnlocked,
    getFreeMode: getFreeMode, setFreeMode: setFreeMode,
    starsForTable: starsForTable, tablePercent: tablePercent,
    masteredCount: masteredCount,
    reset: reset,
  };
})();
