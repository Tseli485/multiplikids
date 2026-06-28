# 🎯 MultipliKids

Site éducatif **bilingue Français / Ελληνικά** pour apprendre les tables de multiplication (×1 à ×12) en jouant. Enfants 6–12 ans. **Zéro dépendance, zéro backend, 100 % hors-ligne.**

5 jeux : 🃏 Cartes flash · ⏱️ Quiz chrono · 🧠 Mémoire · 🚀 Fusée · 🎵 Rythme.
Prononciation vocale claire (Web Speech API), progression XP + badges, 3 thèmes, PWA installable.

---

## ▶️ Utiliser / Partager directement

Le fichier **`index.html` est auto-suffisant** (tout le CSS et le JS sont inclus dedans).

- **Ouvrir** : double-clic sur `index.html` → s'ouvre dans le navigateur.
- **Partager directement** : envoie simplement le fichier `index.html` (e-mail, WhatsApp, clé USB). Il fonctionne seul.
- Dans l'app, bouton **📤 Partager** (Réglages) : partage natif sur mobile, sinon copie le lien.

> 💡 Le bouton 🇫🇷 / 🇬🇷 en haut à droite bascule **toute l'interface ET la voix**. Quand le grec est choisi, l'enfant n'entend et ne lit que du grec.

---

## 🌍 Publier sur GitHub Pages (lien partageable)

```bash
# depuis le dossier multiplikids/
git init
git add .
git commit -m "MultipliKids"
git branch -M main
git remote add origin https://github.com/<ton-compte>/multiplikids.git
git push -u origin main
```

Puis sur GitHub : **Settings → Pages → Source : `main` / root → Save**.
Le site sera en ligne sous quelques minutes à :
`https://<ton-compte>.github.io/multiplikids/`

---

## 🛠️ Développement

La **source** est dans `src/` (modulaire). `index.html` à la racine est **généré** — ne pas l'éditer à la main.

```bash
# après toute modification dans src/
python build.py        # régénère index.html (inline CSS + JS)
```

Structure :

```
multiplikids/
├── index.html          ← fichier final auto-suffisant (généré, à partager)
├── build.py            ← inline src/ → index.html
├── manifest.json       ← PWA (installable tablette)
├── sw.js               ← cache offline
├── README.md · CLAUDE.md
└── src/
    ├── css/  main.css · animations.css · themes.css
    └── js/   i18n.js · audio.js · engine.js · progress.js · visual.js · app.js
        └── games/  flashcard.js · quiz.js · memory.js · rocket.js · rhythm.js
```

---

## 📱 Responsive

Conçu **mobile-first** : testé de 320 px (petit GSM) à tablette, en portrait **et** paysage.
Cibles tactiles ≥ 48 px, pas de zoom intempestif, animations désactivées si `prefers-reduced-motion`.

## 🎓 Progression pédagogique

| Niveau | Âge | Tables | Jeux |
|--------|-----|--------|------|
| 1 | 6–7 | ×1 ×2 ×5 ×10 | Cartes flash |
| 2 | 7–9 | ×3 ×4 ×6 | + Quiz, Mémoire |
| 3 | 9–11 | ×7 ×8 ×9 | + Fusée, Rythme |
| 4 | 11–12 | ×11 ×12 | tous |

Déblocage automatique : 80 % de réussite sur 3 sessions d'une table.
