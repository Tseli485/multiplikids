# CLAUDE.md — MultipliKids
## Identité projet
Site éducatif bilingue FR/GR, tables ×1 à ×12, enfants 6–12 ans, zero-backend.

## Build & structure (IMPORTANT)
- **Source = `src/`** (CSS + JS modulaires). **`index.html` à la racine est GÉNÉRÉ** par `build.py` (tout inliné, fichier auto-suffisant). Ne jamais éditer `index.html` à la main.
- Après toute modif dans `src/` : `python build.py` régénère `index.html`.
- Pourquoi un seul fichier : partage direct (1 fichier), prévisualisation iframe fiable (les chemins relatifs cassaient en sandbox), GitHub Pages.

## Stack & contraintes
- Vanilla JS ES6+, aucun framework, aucun CDN externe (sauf Google Fonts via @import)
- **Pas de modules ES** : tout passe par le namespace global `window.MK`.
- Ordre de chargement (géré par build.py) : i18n → audio → engine → progress → visual → games/* → app
- Web Speech API pour prononciation (fallback silencieux si non supportée)
- Web Audio API pour sons générés programmatiquement (aucun fichier audio externe)
- localStorage pour persistance (clé : `multiplikids_progress`, langue : `multiplikids_lang`)
- CSS custom properties (variables), pas de Tailwind, pas de Bootstrap

## Architecture décisions
- SPA routing par hash (#home, #learn, #play, #progress, #settings)
- i18n centralisé dans js/i18n.js — toute string visible passe par `MK.i18n.t('clé')`
- Audio : Web Speech API prononce les tables à voix haute (`fr-FR` / `el-GR`)
- Progression : système XP + badges par table maîtrisée
- Chaque jeu = classe JS autonome : `new Game(host, {table, level})` → `.start()` / `.stop()`

## Règles de code
- Pas de var, uniquement const/let
- Fonctions pures dans engine.js, effets de bord isolés dans app.js
- Commentaires en français
- Aucune dépendance externe — zero npm, zero CDN
- Mobile-first (375px → up)

## Commandes dev
- Ouvrir index.html directement dans le navigateur
- Tester PWA : `npx serve .` (si disponible)

## Progression pédagogique
- Niveau 1 (6–7 ans) : ×1, ×2, ×5, ×10 — flashcards uniquement
- Niveau 2 (7–9 ans) : ×3, ×4, ×6 — quiz + mémoire
- Niveau 3 (9–11 ans) : ×7, ×8, ×9 — tous jeux
- Niveau 4 (11–12 ans) : ×11, ×12 + tests mixtes — rocket + rhythm
- Déblocage automatique : 80% score sur 3 sessions consécutives
