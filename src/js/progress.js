/* ============================================================
   MultipliKids — progress.js
   Persistance localStorage : XP, niveaux, badges, streak,
   PROFILS par enfant (avatar) + suivi PAR CALCUL (adaptatif).
   Toujours protégé par try/catch (mode privé).
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {};

  const OLD_KEY = 'multiplikids_progress';     // ancienne clé unique (migration)
  const PROFILES_KEY = 'multiplikids_profiles'; // liste d'avatars
  const ACTIVE_KEY = 'multiplikids_active';      // avatar actif
  const dataKey = function (av) { return 'multiplikids_data_' + av; };

  // Avatars disponibles pour les profils (aucun clavier : l'enfant choisit son animal)
  const AVATARS = ['🐱', '🐶', '🦄', '🦁', '🐸', '🐧', '🐼', '🦊', '🐵', '🐢', '🐰', '🐯'];

  const BADGE_DEFS = [
    { id: 'table1_star', table: 1 }, { id: 'table2_star', table: 2 },
    { id: 'table3_star', table: 3 }, { id: 'table4_star', table: 4 },
    { id: 'table5_star', table: 5 }, { id: 'table6_star', table: 6 },
    { id: 'table7_star', table: 7 }, { id: 'table8_star', table: 8 },
    { id: 'table9_star', table: 9 }, { id: 'table10_star', table: 10 },
    { id: 'table11_star', table: 11 }, { id: 'table12_star', table: 12 },
    { id: 'speed_demon', special: 'speed' },
    { id: 'streak_3', special: 'streak3' },
    { id: 'first_win', special: 'first' },
  ];

  function defaultState() {
    return {
      level: 1, xp: 0,
      tables: {},   // { "2": { sessions, avgScore, recentScores:[], mastered } }
      facts: {},    // { "7x8": { seen, correct, wrong } }  ← suivi par calcul
      badges: [], streak: 0, lastPlayDay: null,
      lang: (MK.i18n ? MK.i18n.getLang() : 'el'),
      freeMode: true,
    };
  }

  let state = defaultState();
  let profiles = [];
  let active = null;

  function readJSON(key, fallback) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  // ---------- Profils ----------
  function ensureProfiles() {
    profiles = readJSON(PROFILES_KEY, null);
    if (!Array.isArray(profiles) || !profiles.length) {
      profiles = ['🐱'];
      // migration : ancienne progression unique → profil par défaut
      const old = readJSON(OLD_KEY, null);
      if (old) writeJSON(dataKey('🐱'), old);
      writeJSON(PROFILES_KEY, profiles);
    }
    active = null;
    try { active = localStorage.getItem(ACTIVE_KEY); } catch (e) {}
    if (!active || profiles.indexOf(active) === -1) { active = profiles[0]; writeJSON(ACTIVE_KEY, active); try { localStorage.setItem(ACTIVE_KEY, active); } catch (e) {} }
  }

  function loadActive() {
    const parsed = readJSON(dataKey(active), null);
    state = Object.assign(defaultState(), parsed || {});
    state.tables = state.tables || {};
    state.facts = state.facts || {};
    state.badges = state.badges || [];
  }

  function load() {
    ensureProfiles();
    loadActive();
    return state;
  }

  function save() { writeJSON(dataKey(active), state); }

  function get() { return state; }

  function listProfiles() { return profiles.slice(); }
  function getActive() { return active; }
  function availableAvatars() { return AVATARS.filter(function (a) { return profiles.indexOf(a) === -1; }); }

  function setActive(av) {
    if (profiles.indexOf(av) === -1) return;
    save();                       // sauve le profil courant avant de changer
    active = av;
    try { localStorage.setItem(ACTIVE_KEY, av); } catch (e) {}
    loadActive();
  }

  function addProfile(av) {
    if (!av || profiles.indexOf(av) !== -1) return false;
    profiles.push(av);
    writeJSON(PROFILES_KEY, profiles);
    save();
    active = av;
    try { localStorage.setItem(ACTIVE_KEY, av); } catch (e) {}
    state = defaultState();       // nouveau profil = progression neuve
    save();
    return true;
  }

  function deleteProfile(av) {
    const idx = profiles.indexOf(av);
    if (idx === -1 || profiles.length <= 1) return false; // garde toujours au moins 1 profil
    profiles.splice(idx, 1);
    writeJSON(PROFILES_KEY, profiles);
    try { localStorage.removeItem(dataKey(av)); } catch (e) {}
    if (active === av) { active = profiles[0]; try { localStorage.setItem(ACTIVE_KEY, active); } catch (e) {} loadActive(); }
    return true;
  }

  // ---------- Divers ----------
  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function addXP(amount) { state.xp += Math.max(0, amount | 0); save(); return state.xp; }

  function touchStreak() {
    const today = todayStr();
    if (state.lastPlayDay === today) return state.streak;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ym = String(y.getMonth() + 1).padStart(2, '0');
    const yd = String(y.getDate()).padStart(2, '0');
    const yesterday = y.getFullYear() + '-' + ym + '-' + yd;
    if (state.lastPlayDay === yesterday) state.streak += 1; else state.streak = 1;
    state.lastPlayDay = today;
    if (state.streak >= 3) unlockBadge('streak_3');
    save();
    return state.streak;
  }

  // ---------- Suivi PAR CALCUL (adaptatif) ----------
  function factKey(a, b) { return a + 'x' + b; }
  function recordFact(a, b, ok) {
    if (!a || !b) return;
    const k = factKey(a, b);
    const f = state.facts[k] || { seen: 0, correct: 0, wrong: 0 };
    f.seen += 1;
    if (ok) f.correct += 1; else f.wrong += 1;
    state.facts[k] = f;
    save();
  }
  function factStats(a, b) { return state.facts[factKey(a, b)] || null; }
  // 0 = jamais vu · 1 = en cours · 2 = bien · 3 = maîtrisé
  function factMastery(a, b) {
    const f = state.facts[factKey(a, b)];
    if (!f || f.seen === 0) return 0;
    if (f.correct >= 3 && f.correct > f.wrong * 2) return 3;
    if (f.correct > f.wrong) return 2;
    return 1;
  }
  // Les calculs les plus faibles (à réviser en priorité). table=null → mix toutes tables.
  function weakestFacts(table, n) {
    const cands = [];
    const as = table ? [table] : [2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let ai = 0; ai < as.length; ai++) {
      for (let b = 1; b <= 10; b++) {
        const a = as[ai];
        const f = state.facts[factKey(a, b)] || { seen: 0, correct: 0, wrong: 0 };
        // score de faiblesse : jamais vu = priorité moyenne, erreurs = priorité haute
        const weakness = (f.seen === 0 ? 1.5 : 0) + f.wrong * 2 - f.correct + (f.seen === 0 ? 0 : 0);
        cands.push({ a: a, b: b, answer: a * b, weakness: weakness, seen: f.seen });
      }
    }
    cands.sort(function (x, y) { return y.weakness - x.weakness; });
    return cands.slice(0, n || 10);
  }

  function recordSession(result) {
    const tk = String(result.table);
    const T = state.tables[tk] || { sessions: 0, avgScore: 0, recentScores: [], mastered: false };
    T.sessions += 1;
    T.recentScores = (T.recentScores || []).concat(result.percent).slice(-3);
    T.avgScore = Math.round(((T.avgScore * (T.sessions - 1)) + result.percent) / T.sessions);
    const newBadges = [];
    if (!T.mastered && T.recentScores.length >= 3 && T.recentScores.every(function (s) { return s >= 80; })) {
      T.mastered = true;
      const b = 'table' + result.table + '_star';
      if (unlockBadge(b)) newBadges.push(b);
    }
    state.tables[tk] = T;
    if (result.percent >= 50 && unlockBadge('first_win')) newBadges.push('first_win');
    if (result.speedBonus && unlockBadge('speed_demon')) newBadges.push('speed_demon');
    if (state.streak >= 3 && unlockBadge('streak_3')) newBadges.push('streak_3');
    recomputeLevel();
    save();
    return newBadges;
  }

  function unlockBadge(id) { if (state.badges.indexOf(id) === -1) { state.badges.push(id); return true; } return false; }
  function hasBadge(id) { return state.badges.indexOf(id) !== -1; }

  function recomputeLevel() {
    for (let lvl = 1; lvl <= 4; lvl++) {
      const tables = MK.engine.LEVEL_TABLES[lvl];
      const allMastered = tables.every(function (t) { const T = state.tables[String(t)]; return T && T.mastered; });
      if (allMastered && state.level < lvl + 1 && lvl < 4) state.level = lvl + 1;
      if (!allMastered) break;
    }
    if (state.level > 4) state.level = 4;
  }

  function isLevelUnlocked(level) { return state.freeMode || level <= state.level; }
  function isTableUnlocked(table) { if (state.freeMode) return true; return isLevelUnlocked(MK.engine.levelOfTable(table)); }
  function getFreeMode() { return !!state.freeMode; }
  function setFreeMode(v) { state.freeMode = !!v; save(); }

  function starsForTable(table) {
    const T = state.tables[String(table)];
    if (!T) return 0;
    if (T.mastered || T.avgScore >= 90) return 3;
    if (T.avgScore >= 70) return 2;
    if (T.avgScore >= 40 || T.sessions > 0) return 1;
    return 0;
  }
  function tablePercent(table) { const T = state.tables[String(table)]; return T ? T.avgScore : 0; }
  function masteredCount() { return Object.keys(state.tables).filter(function (k) { return state.tables[k].mastered; }).length; }

  function reset() { state = defaultState(); save(); }

  window.MK.progress = {
    BADGE_DEFS: BADGE_DEFS, AVATARS: AVATARS,
    load: load, save: save, get: get,
    listProfiles: listProfiles, getActive: getActive, setActive: setActive,
    addProfile: addProfile, deleteProfile: deleteProfile, availableAvatars: availableAvatars,
    addXP: addXP, touchStreak: touchStreak,
    recordFact: recordFact, factStats: factStats, factMastery: factMastery, weakestFacts: weakestFacts,
    recordSession: recordSession,
    unlockBadge: unlockBadge, hasBadge: hasBadge,
    isLevelUnlocked: isLevelUnlocked, isTableUnlocked: isTableUnlocked,
    getFreeMode: getFreeMode, setFreeMode: setFreeMode,
    starsForTable: starsForTable, tablePercent: tablePercent,
    masteredCount: masteredCount,
    reset: reset,
  };
})();
