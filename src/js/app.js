/* ============================================================
   MultipliKids — app.js
   Init, routing SPA par hash, rendu des écrans, glue.
   Charge en DERNIER (dépend de i18n, audio, engine, progress, visual, games).
   ============================================================ */
(function () {
  'use strict';
  const MK = window.MK;
  const t = function (k) { return MK.i18n.t(k); };

  const THEME_KEY = 'multiplikids_theme';
  let app, gameInstance = null, currentTheme = 'space';

  // ---------- Helpers ----------
  function el(id) { return document.getElementById(id); }

  // Wake Lock : empêche l'écran de se verrouiller/éteindre pendant l'usage.
  // (nécessite https — actif sur GitHub Pages ; ignoré silencieusement sinon)
  let wakeLock = null;
  function requestWakeLock() {
    try {
      if (!('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(function (wl) {
        wakeLock = wl;
        wl.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {});
    } catch (e) {}
  }

  function setTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    MK.visual.buildDecor(theme);
  }

  // Parse "#play?game=quiz&table=7&level=2" → { route:'play', params:{...} }
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || 'home';
    const [route, query] = raw.split('?');
    const params = {};
    if (query) query.split('&').forEach(function (kv) {
      const [k, v] = kv.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { route: route || 'home', params: params };
  }

  function navigate(hash) { location.hash = hash; }

  // Modale de confirmation : message dans la langue active, boutons ✔/✖ neutres.
  // (évite les libellés OK/Annuler du navigateur, illisibles pour un enfant hellénophone)
  function showConfirm(msg) {
    return new Promise(function (resolve) {
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML =
        '<div class="modal">' +
          '<p>' + msg + '</p>' +
          '<div class="row">' +
            '<button class="btn btn--primary" data-yes aria-label="Oui">✔️</button>' +
            '<button class="btn btn--ghost" data-no aria-label="Non">✖️</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      const done = function (v) { ov.remove(); resolve(v); };
      ov.querySelector('[data-yes]').addEventListener('click', function () { done(true); });
      ov.querySelector('[data-no]').addEventListener('click', function () { done(false); });
      ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
    });
  }

  // Partage robuste : Web Share (mobile) → presse-papier moderne → execCommand → modale.
  // Garantit TOUJOURS un retour visible, même en file:// (contexte non sécurisé).
  function shareSite() {
    const url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: 'MultipliKids', text: t('home_title'), url: url })
        .then(function () {}).catch(function () { fallbackCopy(url); });
      return;
    }
    fallbackCopy(url);
  }

  function fallbackCopy(url) {
    const ok = function () { MK.visual.toast(t('share_done')); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok).catch(function () { legacyCopy(url, ok); });
    } else {
      legacyCopy(url, ok);
    }
  }

  // Copie via textarea + execCommand (fonctionne même en file://) ; sinon modale.
  function legacyCopy(url, ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
      const done = document.execCommand('copy');
      document.body.removeChild(ta);
      if (done) { ok(); return; }
    } catch (e) { /* ignore */ }
    showLinkModal(url);
  }

  // Modale de secours : affiche le lien dans un champ sélectionnable + bouton copier.
  function showLinkModal(url) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML =
      '<div class="modal">' +
        '<p>' + t('share') + '</p>' +
        '<input id="share-link" readonly value="' + url.replace(/"/g, '&quot;') + '" ' +
          'style="width:100%;min-height:48px;border-radius:10px;padding:10px 12px;border:none;' +
          'background:var(--color-surface-2);color:var(--color-text);font-size:1rem;text-align:center">' +
        '<div class="row mt">' +
          '<button class="btn btn--primary" data-copy>📋</button>' +
          '<button class="btn btn--ghost" data-close>✖️</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    const input = ov.querySelector('#share-link');
    input.addEventListener('focus', function () { input.select(); });
    ov.querySelector('[data-copy]').addEventListener('click', function () {
      input.focus(); input.select();
      try { document.execCommand('copy'); MK.visual.toast(t('share_done')); } catch (e) {}
    });
    const close = function () { ov.remove(); };
    ov.querySelector('[data-close]').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  }

  // ---------- Topbar ----------
  function topbar(opts) {
    opts = opts || {};
    const lang = MK.i18n.getLang();
    const back = opts.back
      ? '<button class="btn btn--icon" id="tb-back" aria-label="' + t('btn_back') + '">←</button>'
      : '<button class="btn btn--icon" id="tb-home" aria-label="' + t('btn_home') + '">🏠</button>';
    // roue ⚙️ permanente (sauf sur l'écran Réglages lui-même)
    const gear = opts.noSettings ? '' :
      '<button class="btn btn--icon" id="tb-settings" aria-label="' + t('settings') + '">⚙️</button>';
    return '<div class="topbar">' +
      back +
      '<h1 class="topbar__title">' + (opts.title || t('app_name')) + '</h1>' +
      '<button class="btn btn--lang ' + (lang === 'fr' ? 'active' : '') + '" data-lang="fr" aria-label="Français">🇫🇷</button>' +
      '<button class="btn btn--lang ' + (lang === 'el' ? 'active' : '') + '" data-lang="el" aria-label="Ελληνικά">🇬🇷</button>' +
      gear +
      '</div>';
  }

  function wireTopbar() {
    const b = el('tb-back'), h = el('tb-home');
    if (b) b.addEventListener('click', function () {
      const goBack = function () { history.length > 1 ? history.back() : navigate('home'); };
      if (gameInstance) { showConfirm(t('quit_confirm')).then(function (ok) { if (ok) goBack(); }); }
      else goBack();
    });
    if (h) h.addEventListener('click', function () { navigate('home'); });
    const s = el('tb-settings');
    if (s) s.addEventListener('click', function () {
      const go = function () { navigate('settings'); };
      if (gameInstance) { showConfirm(t('quit_confirm')).then(function (ok) { if (ok) go(); }); }
      else go();
    });
    app.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { MK.audio.resume(); MK.i18n.setLang(btn.dataset.lang); });
    });
  }

  // ---------- Étoiles SVG ----------
  function starBadge(filled) {
    const fill = filled ? 'var(--color-accent)' : 'none';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' + fill + '" stroke="var(--color-accent)" stroke-width="1.5" stroke-linejoin="round" d="M12 2l3 6.5 7 .7-5.2 4.7 1.5 6.9L12 17.8 5.2 20.8l1.5-6.9L1.5 9.2l7-.7z"/></svg>';
  }

  // ============================================================
  //  ÉCRANS
  // ============================================================

  function screenHome() {
    const p = MK.progress.get();
    const tilesHtml = MK.engine.ALL_TABLES.map(function (n) {
      const unlocked = MK.progress.isTableUnlocked(n);
      const stars = MK.progress.starsForTable(n);
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      return '<button class="table-tile ' + (unlocked ? '' : 'locked') + '" data-table="' + n + '" ' + (unlocked ? '' : 'disabled') +
        ' aria-label="' + t('table_of') + ' ' + n + '">' +
        (unlocked ? '' : '<span class="lock">🔒</span>') +
        '×' + n + '<span class="stars">' + starStr + '</span></button>';
    }).join('');

    app.innerHTML = topbar() +
      '<div class="screen-enter">' +
      '<h2 class="screen-title">' + t('home_title') + '</h2>' +
      '<p class="screen-sub">' + t('home_sub') + '</p>' +
      '<div class="row" style="margin-bottom:8px">' +
        '<button class="btn btn--secondary" id="go-progress">' + t('btn_progress') + ' (🔥 ' + p.streak + ')</button>' +
        '<button class="btn btn--ghost" id="go-settings">⚙️ ' + t('btn_settings') + '</button>' +
      '</div>' +
      '<h3 class="mt">' + t('choose_table') + '</h3>' +
      '<div class="table-grid">' + tilesHtml + '</div>' +
      '</div>';

    wireTopbar();
    el('go-progress').addEventListener('click', function () { navigate('progress'); });
    el('go-settings').addEventListener('click', function () { navigate('settings'); });
    app.querySelectorAll('.table-tile:not(.locked)').forEach(function (tile) {
      tile.addEventListener('click', function () {
        MK.audio.resume();
        navigate('learn?table=' + tile.dataset.table);
      });
    });
  }

  function screenLearn(params) {
    const table = parseInt(params.table, 10) || 2;
    const level = MK.engine.levelOfTable(table);
    const playerLevel = MK.progress.get().level;
    // Mode libre → tous les jeux ; sinon jeux du niveau de la table débloqués par le joueur
    const ALL_GAMES = ['flashcard', 'quiz', 'memory', 'rocket', 'rhythm', 'speak'];
    const games = MK.progress.getFreeMode()
      ? ALL_GAMES
      : MK.engine.gamesForLevel(level).filter(function (g) {
          return MK.engine.gamesForLevel(playerLevel).indexOf(g) !== -1;
        });

    const labels = { flashcard: 'game_flashcard', quiz: 'game_quiz', memory: 'game_memory', rocket: 'game_rocket', rhythm: 'game_rhythm', speak: 'game_speak' };
    const list = games.map(function (g) {
      return '<button class="btn btn--primary" data-game="' + g + '">' + t(labels[g]) + '</button>';
    }).join('');

    app.innerHTML = topbar({ back: true, title: t('table_of') + ' ' + table }) +
      '<div class="screen-enter">' +
      '<h2 class="screen-title">' + t('choose_game') + '</h2>' +
      '<p class="screen-sub">' + t('level') + ' ' + level + '</p>' +
      '<div class="row mt"><button class="btn btn--accent" id="learn-listen">🔊 ' + t('btn_learn') + ' ×' + table + '</button></div>' +
      '<div class="game-list">' + list + '</div>' +
      '</div>';

    wireTopbar();
    el('learn-listen').addEventListener('click', function () { MK.audio.resume(); navigate('study?table=' + table); });
    app.querySelectorAll('[data-game]').forEach(function (b) {
      b.addEventListener('click', function () {
        MK.audio.resume();
        navigate('play?game=' + b.dataset.game + '&table=' + table + '&level=' + level);
      });
    });
  }

  // Écran APPRENDRE : visuel + audio synchronisés. La table est affichée et chaque
  // ligne est SURLIGNÉE au moment où elle est prononcée.
  function screenStudy(params) {
    const table = parseInt(params.table, 10) || 2;
    const lang = MK.i18n.getLang();
    const code = (lang === 'fr') ? 'fr-FR' : 'el-GR';
    const times = MK.i18n.t('times');
    const eq = MK.i18n.t('equals');

    const MAX = 10; // les leçons vont jusqu'à ×10
    let rows = '';
    for (let i = 1; i <= MAX; i++) {
      rows += '<button class="study-row" data-i="' + i + '" aria-label="' + table + ' × ' + i + ' = ' + (table * i) + '">' +
        '<span class="op">' + table + ' × ' + i + '</span>' +
        '<span class="eq">=</span>' +
        '<span class="res">' + (table * i) + '</span></button>';
    }

    app.innerHTML = topbar({ back: true, title: t('table_of') + ' ' + table }) +
      '<div class="screen-enter">' +
      '<p class="screen-sub center">' + t('study_hint') + '</p>' +
      '<div class="study-list" id="study-list">' + rows + '</div>' +
      '<div class="row mt"><button class="btn btn--primary" id="study-play">▶️ ' + t('btn_replay') + '</button></div>' +
      '</div>';
    wireTopbar();

    // Phrases à prononcer (intro + lignes ×1..×10) — index aligné avec data-i (ligne k = i=k)
    const lines = [t('table_of') + ' ' + table];
    for (let i = 1; i <= MAX; i++) lines.push(table + ', ' + times + ', ' + i + ', ' + eq + ', ' + (table * i));

    const highlight = function (i) {
      app.querySelectorAll('.study-row.active').forEach(function (e) { e.classList.remove('active'); });
      if (i >= 1) {
        const row = app.querySelector('.study-row[data-i="' + i + '"]');
        if (row) { row.classList.add('active'); try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
      }
    };

    const playAll = function () {
      MK.audio.resume();
      MK.audio.narrate(lines, code, 450, { onLine: highlight, onDone: function () { highlight(0); } });
    };

    el('study-play').addEventListener('click', playAll);
    // clic sur une ligne : prononce SEULEMENT cette opération + la surligne
    app.querySelectorAll('.study-row').forEach(function (r) {
      r.addEventListener('click', function () {
        MK.audio.resume(); MK.audio.stopSpeech();
        const i = parseInt(r.dataset.i, 10);
        highlight(i);
        MK.audio.speakOperation(table, i, table * i);
      });
    });

    playAll(); // démarrage automatique (voix + surlignage)
  }

  function screenPlay(params) {
    const table = parseInt(params.table, 10) || 2;
    const level = parseInt(params.level, 10) || MK.engine.levelOfTable(table);
    const gameKey = params.game || 'flashcard';
    const map = { flashcard: 'Flashcard', quiz: 'Quiz', memory: 'Memory', rocket: 'Rocket', rhythm: 'Rhythm', speak: 'Speak' };
    const Cls = MK.games[map[gameKey]];

    app.innerHTML = topbar({ back: true, title: t('table_of') + ' ' + table }) + '<div id="game-host"></div>';
    wireTopbar();

    if (!Cls) { el('game-host').innerHTML = '<div class="card">⚠️ ' + gameKey + '</div>'; return; }

    MK.progress.touchStreak();
    const host = el('game-host');
    gameInstance = new Cls(host, {
      table: table, level: level,
      onFinish: function (result) {
        const badges = MK.progress.recordSession(result);
        badges.forEach(function (b) {
          MK.visual.toast(t('badge_unlocked') + ' ⭐');
        });
        gameInstance = null; // partie terminée (écran de fin affiché par le jeu)
      },
    });
    gameInstance.start();
  }

  function screenProgress() {
    const p = MK.progress.get();
    const rows = MK.engine.ALL_TABLES.map(function (n) {
      const pct = MK.progress.tablePercent(n);
      const stars = MK.progress.starsForTable(n);
      return '<div class="progress-table">' +
        '<span class="name">×' + n + '</span>' +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<span class="pct">' + ('★'.repeat(stars) || '–') + '</span>' +
        '</div>';
    }).join('');

    const badgesHtml = MK.progress.BADGE_DEFS.map(function (def) {
      const owned = MK.progress.hasBadge(def.id);
      const lbl = def.table ? '×' + def.table : (def.id === 'speed_demon' ? '⚡' : def.id === 'streak_3' ? '🔥' : '🥇');
      return '<div class="badge ' + (owned ? 'badge-pop' : 'locked') + '">' + starBadge(owned) +
        '<div class="badge-lbl">' + lbl + '</div></div>';
    }).join('');

    app.innerHTML = topbar({ back: true, title: t('my_progress') }) +
      '<div class="screen-enter">' +
      '<div class="stat-row">' +
        '<div class="stat"><div class="num">' + p.xp + '</div><div class="lbl">' + t('total_xp') + '</div></div>' +
        '<div class="stat"><div class="num">' + MK.progress.masteredCount() + '</div><div class="lbl">' + t('tables_mastered') + '</div></div>' +
        '<div class="stat"><div class="num">🔥 ' + p.streak + '</div><div class="lbl">' + t('day_streak') + '</div></div>' +
      '</div>' +
      '<h3>' + t('choose_table') + '</h3>' + rows +
      '<h3 class="mt-lg">' + t('badges') + '</h3>' +
      '<div class="badges">' + badgesHtml + '</div>' +
      '</div>';
    wireTopbar();
  }

  function screenSettings() {
    const lang = MK.i18n.getLang();
    const speechPrefix = (lang === 'fr') ? 'fr' : 'el';
    const themeChip = function (key, label) {
      return '<button class="chip ' + (currentTheme === key ? 'active' : '') + '" data-theme="' + key + '">' + t(label) + '</button>';
    };

    // --- Voix disponibles pour la langue active ---
    const vlist = MK.audio.listVoices(speechPrefix);
    const pref = MK.audio.getPreferredVoice();
    let voiceOptions = '<option value="">' + t('voice_default') + '</option>' +
      vlist.map(function (v) {
        const sel = (v.uri === pref) ? ' selected' : '';
        return '<option value="' + v.uri.replace(/"/g, '&quot;') + '"' + sel + '>' + v.name + '</option>';
      }).join('');
    const noGreekWarn = (speechPrefix === 'el' && vlist.length === 0)
      ? '<p class="screen-sub" style="color:var(--color-error)">' + t('no_greek_voice') + '</p>' : '';

    // --- Vitesse ---
    const rate = MK.audio.getRate();
    const speedChip = function (mult, label) {
      const active = Math.abs(rate - mult) < 0.01 ? ' active' : '';
      return '<button class="chip' + active + '" data-rate="' + mult + '">' + t(label) + '</button>';
    };

    const free = MK.progress.getFreeMode();

    app.innerHTML = topbar({ back: true, noSettings: true, title: t('settings') }) +
      '<div class="screen-enter card">' +
      '<h3>' + t('language') + '</h3>' +
      '<div class="choice-row">' +
        '<button class="chip ' + (lang === 'fr' ? 'active' : '') + '" data-set-lang="fr">🇫🇷 Français</button>' +
        '<button class="chip ' + (lang === 'el' ? 'active' : '') + '" data-set-lang="el">🇬🇷 Ελληνικά</button>' +
      '</div>' +

      '<h3>' + t('voice') + '</h3>' + noGreekWarn +
      '<div class="choice-row" style="align-items:center">' +
        '<select id="set-voice" style="flex:1;min-height:48px;border-radius:10px;padding:8px 12px;background:var(--color-surface-2);color:var(--color-text);font-weight:700;border:none">' + voiceOptions + '</select>' +
        '<button class="btn btn--secondary" id="set-test">' + t('test_voice') + '</button>' +
      '</div>' +
      '<h3>' + t('speed') + '</h3>' +
      '<div class="choice-row">' + speedChip(0.75, 'speed_slow') + speedChip(1, 'speed_normal') + speedChip(1.25, 'speed_fast') + '</div>' +

      '<h3>' + t('free_mode') + '</h3>' +
      '<div class="choice-row">' +
        '<button class="chip ' + (free ? 'active' : '') + '" id="set-free">' + (free ? '✅' : '⬜') + ' ' + t('free_mode') + '</button>' +
      '</div>' +
      '<p class="screen-sub">' + t('free_mode_hint') + '</p>' +

      '<h3>' + t('theme') + '</h3>' +
      '<div class="choice-row">' + themeChip('space', 'theme_space') + themeChip('ocean', 'theme_ocean') + themeChip('jungle', 'theme_jungle') + '</div>' +
      '<div class="mt-lg"><button class="btn btn--secondary" id="set-share">📤 ' + t('share') + '</button></div>' +
      '<div class="mt"><button class="btn btn--ghost" id="set-reset" style="color:var(--color-error);border-color:var(--color-error)">🗑️ ' + t('reset') + '</button></div>' +
      '</div>';

    wireTopbar();
    app.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.addEventListener('click', function () { MK.i18n.setLang(b.dataset.setLang); });
    });
    app.querySelectorAll('[data-theme]').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(b.dataset.theme); screenSettings(); });
    });
    // Voix
    el('set-voice').addEventListener('change', function () { MK.audio.setPreferredVoice(this.value || null); });
    el('set-test').addEventListener('click', function () {
      MK.audio.resume();
      MK.audio.setPreferredVoice(el('set-voice').value || null);
      MK.audio.speakOperation(3, 4, 12); // « 3 επί 4 ίσον 12 » avec la voix/vitesse choisies
    });
    // Vitesse
    app.querySelectorAll('[data-rate]').forEach(function (b) {
      b.addEventListener('click', function () {
        MK.audio.setRate(parseFloat(b.dataset.rate));
        MK.audio.speakOperation(2, 3, 6); // aperçu immédiat
        screenSettings();
      });
    });
    // Mode libre
    el('set-free').addEventListener('click', function () {
      MK.progress.setFreeMode(!MK.progress.getFreeMode());
      screenSettings();
    });
    el('set-share').addEventListener('click', shareSite);
    el('set-reset').addEventListener('click', function () {
      showConfirm(t('reset_confirm')).then(function (ok) { if (ok) { MK.progress.reset(); MK.visual.toast('✅'); } });
    });
  }

  // ---------- Router ----------
  function render() {
    if (gameInstance && gameInstance.stop) { gameInstance.stop(); gameInstance = null; }
    if (MK.audio.stopSpeech) MK.audio.stopSpeech(); // coupe toute narration en quittant l'écran
    window.scrollTo(0, 0);
    const { route, params } = parseHash();
    switch (route) {
      case 'home': screenHome(); break;
      case 'learn': screenLearn(params); break;
      case 'study': screenStudy(params); break;
      case 'play': screenPlay(params); break;
      case 'progress': screenProgress(); break;
      case 'settings': screenSettings(); break;
      default: screenHome();
    }
  }

  // ---------- Init ----------
  function init() {
    app = el('app');
    MK.progress.load();
    // thème sauvegardé
    let savedTheme = 'space';
    try { savedTheme = localStorage.getItem(THEME_KEY) || 'space'; } catch (e) {}
    setTheme(savedTheme);

    // re-render au changement de langue
    MK.i18n.onChange(function () { render(); });
    window.addEventListener('hashchange', render);
    // reprise audio + amorçage des voix sur 1re interaction (politique navigateurs)
    document.addEventListener('pointerdown', function once() {
      MK.audio.resume(); MK.audio.primeVoices(); requestWakeLock(); document.removeEventListener('pointerdown', once);
    });
    // garde l'écran allumé (évite que le téléphone se verrouille pendant l'usage)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') requestWakeLock();
    });

    render();

    // PWA : enregistrement service worker (optionnel, échoue silencieusement)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
