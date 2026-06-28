/* ============================================================
   MultipliKids — i18n.js
   Système bilingue FR / GR. Toute string visible passe par t().
   ============================================================ */
(function () {
  'use strict';
  window.MK = window.MK || {};

  const STRINGS = {
    fr: {
      app_name: 'MultipliKids',
      home_title: 'Apprends tes tables en jouant !',
      home_sub: 'Choisis une table et un jeu pour commencer.',
      choose_table: 'Choisis ta table',
      choose_level: 'Choisis ton niveau',
      choose_game: 'Choisis un jeu',
      level: 'Niveau',
      level_1: 'Niveau 1 (6–7 ans)',
      level_2: 'Niveau 2 (7–9 ans)',
      level_3: 'Niveau 3 (9–11 ans)',
      level_4: 'Niveau 4 (11–12 ans)',
      btn_play: 'Jouer',
      btn_learn: 'Apprendre',
      btn_progress: 'Mon progrès',
      btn_settings: 'Réglages',
      btn_back: 'Retour',
      btn_home: 'Accueil',
      btn_repeat: '🔊 Répéter',
      btn_replay: 'Recommencer',
      btn_next: 'Suivant',
      btn_knew: '✅ Je savais',
      btn_didnt: '❌ Je ne savais pas',
      table_of: 'Table de',
      game_flashcard: '🃏 Cartes Flash',
      game_quiz: '⏱️ Quiz chrono',
      game_memory: '🧠 Jeu Mémoire',
      game_rocket: '🚀 Fusée',
      game_rhythm: '🎵 Rythme',
      correct: 'Bravo ! 🎉',
      wrong: 'Réessaie ! 💪',
      correct_short: 'Réponse correcte',
      time_up: 'Temps écoulé',
      tap_to_flip: 'Touche la carte pour voir la réponse',
      score: 'Score',
      points: 'Points',
      xp: 'XP',
      lives: 'Vies',
      streak: 'Série',
      level_done: 'Niveau terminé !',
      game_over: 'Partie terminée',
      your_score: 'Ton score',
      encourage_high: 'Champion·ne des tables ! 🌟',
      encourage_mid: 'Bien joué, continue ! 👍',
      encourage_low: 'Tu progresses, encore un essai ! 💪',
      my_progress: 'Mon progrès',
      tables_mastered: 'Tables maîtrisées',
      total_xp: 'XP total',
      day_streak: 'Jours de suite',
      badges: 'Récompenses',
      badge_unlocked: 'Badge débloqué !',
      no_badges: 'Joue pour gagner des badges !',
      settings: 'Réglages',
      language: 'Langue',
      theme: 'Thème',
      theme_space: '🌌 Espace',
      theme_ocean: '🌊 Océan',
      theme_jungle: '🌿 Jungle',
      reset: 'Réinitialiser ma progression',
      reset_confirm: 'Effacer toute ta progression ?',
      sound_on: 'Sons activés',
      locked: 'Verrouillé',
      unlock_hint: 'Termine les niveaux précédents pour débloquer.',
      boss: 'Boss : 10 questions, 60 secondes !',
      quit_confirm: 'Quitter le jeu en cours ?',
      times: 'fois',
      equals: 'égale',
      find_pair: 'Trouve les paires !',
      tap_correct: 'Tape la bonne réponse !',
      share: 'Partager',
      share_done: 'Lien copié !',
      free_mode: 'Mode libre (toutes les tables)',
      free_mode_hint: 'Activé : toutes les tables sont accessibles.',
      voice: 'Voix',
      voice_default: 'Voix par défaut',
      no_greek_voice: '⚠️ Aucune voix grecque détectée — installe-la dans Windows.',
      speed: 'Vitesse de la voix',
      speed_slow: 'Lente',
      speed_normal: 'Normale',
      speed_fast: 'Rapide',
      test_voice: '🔊 Tester',
      study_hint: 'Écoute et regarde la table 👀👂',
      game_speak: '🎤 Récite (parle)',
      speak_tap: 'Touche le micro et dis la réponse',
      speak_listening: '🎙️ J\'écoute…',
      speak_try_again: 'Redis la réponse !',
      speak_no_speech: 'Je n\'ai pas entendu, réessaie 🎤',
      speak_show_answer: 'La réponse était',
      speak_mic_error: 'Micro indisponible',
      speak_mic_denied: 'Autorise le micro pour jouer 🎤',
      speak_need_https: 'Le micro marche en ligne (https) ou sur localhost, pas en ouverture directe du fichier.',
    },
    el: {
      app_name: 'MultipliKids',
      home_title: 'Μάθε τους πολλαπλασιασμούς παίζοντας!',
      home_sub: 'Διάλεξε έναν πίνακα και ένα παιχνίδι για να ξεκινήσεις.',
      choose_table: 'Διάλεξε τον πίνακα',
      choose_level: 'Διάλεξε επίπεδο',
      choose_game: 'Διάλεξε παιχνίδι',
      level: 'Επίπεδο',
      level_1: 'Επίπεδο 1 (6–7 ετών)',
      level_2: 'Επίπεδο 2 (7–9 ετών)',
      level_3: 'Επίπεδο 3 (9–11 ετών)',
      level_4: 'Επίπεδο 4 (11–12 ετών)',
      btn_play: 'Παίξε',
      btn_learn: 'Μάθε',
      btn_progress: 'Η πρόοδός μου',
      btn_settings: 'Ρυθμίσεις',
      btn_back: 'Πίσω',
      btn_home: 'Αρχική',
      btn_repeat: '🔊 Ξανά',
      btn_replay: 'Ξανά',
      btn_next: 'Επόμενο',
      btn_knew: '✅ Το ήξερα',
      btn_didnt: '❌ Δεν το ήξερα',
      table_of: 'Πίνακας του',
      game_flashcard: '🃏 Κάρτες',
      game_quiz: '⏱️ Κουίζ',
      game_memory: '🧠 Μνήμη',
      game_rocket: '🚀 Πύραυλος',
      game_rhythm: '🎵 Ρυθμός',
      correct: 'Μπράβο! 🎉',
      wrong: 'Δοκίμασε ξανά! 💪',
      correct_short: 'Σωστή απάντηση',
      time_up: 'Ο χρόνος τελείωσε',
      tap_to_flip: 'Άγγιξε την κάρτα για την απάντηση',
      score: 'Σκορ',
      points: 'Πόντοι',
      xp: 'XP',
      lives: 'Ζωές',
      streak: 'Σερί',
      level_done: 'Το επίπεδο τελείωσε!',
      game_over: 'Τέλος παιχνιδιού',
      your_score: 'Το σκορ σου',
      encourage_high: 'Πρωταθλητής στους πίνακες! 🌟',
      encourage_mid: 'Μπράβο, συνέχισε! 👍',
      encourage_low: 'Προοδεύεις, δοκίμασε ξανά! 💪',
      my_progress: 'Η πρόοδός μου',
      tables_mastered: 'Πίνακες που κατέκτησες',
      total_xp: 'Σύνολο XP',
      day_streak: 'Συνεχόμενες μέρες',
      badges: 'Βραβεία',
      badge_unlocked: 'Ξεκλείδωσες αστέρι!',
      no_badges: 'Παίξε για να κερδίσεις βραβεία!',
      settings: 'Ρυθμίσεις',
      language: 'Γλώσσα',
      theme: 'Θέμα',
      theme_space: '🌌 Διάστημα',
      theme_ocean: '🌊 Ωκεανός',
      theme_jungle: '🌿 Ζούγκλα',
      reset: 'Μηδενισμός προόδου',
      reset_confirm: 'Να σβηστεί όλη η πρόοδος;',
      sound_on: 'Ήχοι ενεργοί',
      locked: 'Κλειδωμένο',
      unlock_hint: 'Τελείωσε τα προηγούμενα επίπεδα για ξεκλείδωμα.',
      boss: 'Αφεντικό: 10 ερωτήσεις σε 60 δευτερόλεπτα!',
      quit_confirm: 'Έξοδος από το παιχνίδι;',
      times: 'επί',
      equals: 'ίσον',
      find_pair: 'Βρες τα ζευγάρια!',
      tap_correct: 'Πάτα τη σωστή απάντηση!',
      share: 'Μοιράσου',
      share_done: 'Ο σύνδεσμος αντιγράφηκε!',
      free_mode: 'Ελεύθερη λειτουργία (όλοι οι πίνακες)',
      free_mode_hint: 'Ενεργό: όλοι οι πίνακες είναι διαθέσιμοι.',
      voice: 'Φωνή',
      voice_default: 'Προεπιλεγμένη φωνή',
      no_greek_voice: '⚠️ Δεν βρέθηκε ελληνική φωνή — εγκατέστησέ την στα Windows.',
      speed: 'Ταχύτητα φωνής',
      speed_slow: 'Αργή',
      speed_normal: 'Κανονική',
      speed_fast: 'Γρήγορη',
      test_voice: '🔊 Δοκιμή',
      study_hint: 'Άκου και κοίτα τον πίνακα 👀👂',
      game_speak: '🎤 Πες το (φωνή)',
      speak_tap: 'Πάτα το μικρόφωνο και πες την απάντηση',
      speak_listening: '🎙️ Ακούω…',
      speak_try_again: 'Πες ξανά την απάντηση!',
      speak_no_speech: 'Δεν άκουσα, δοκίμασε ξανά 🎤',
      speak_show_answer: 'Η απάντηση ήταν',
      speak_mic_error: 'Το μικρόφωνο δεν είναι διαθέσιμο',
      speak_mic_denied: 'Επίτρεψε το μικρόφωνο για να παίξεις 🎤',
      speak_need_https: 'Το μικρόφωνο δουλεύει online (https) ή σε localhost, όχι με άνοιγμα του αρχείου απευθείας.',
    },
  };

  const LANG_KEY = 'multiplikids_lang';
  let current = 'el'; // DÉFAUT = GREC (l'enfant ne comprend que le grec)

  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'fr' || saved === 'el') current = saved;
  } catch (e) { /* mode privé : on garde le grec */ }

  const listeners = [];

  function t(key) {
    const dict = STRINGS[current] || STRINGS.fr;
    return (key in dict) ? dict[key] : (STRINGS.fr[key] || key);
  }

  function getLang() { return current; }

  function setLang(lang) {
    if (lang !== 'fr' && lang !== 'el') return;
    current = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.lang = (lang === 'el') ? 'el' : 'fr';
    listeners.forEach(function (fn) { fn(lang); });
  }

  // Code de langue pour la Web Speech API
  function speechLang() { return current === 'fr' ? 'fr-FR' : 'el-GR'; }

  // Abonnement aux changements de langue (l'UI se re-render)
  function onChange(fn) { listeners.push(fn); }

  document.documentElement.lang = (current === 'el') ? 'el' : 'fr';

  window.MK.i18n = { t: t, getLang: getLang, setLang: setLang, speechLang: speechLang, onChange: onChange, STRINGS: STRINGS };
})();
