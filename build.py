#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MultipliKids — build.py
Inline tout le CSS + JS de src/ dans un index.html AUTO-SUFFISANT (un seul fichier).
But : partage direct (1 fichier), prévisualisation fiable (iframe sandbox), GitHub Pages.

Usage :  python build.py     (depuis le dossier multiplikids/)
Source unique de vérité = src/  →  ne jamais éditer index.html à la main.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

# Ordre OBLIGATOIRE (main.css en 1er car contient le @import des polices)
CSS_FILES = ["css/main.css", "css/animations.css", "css/themes.css"]
JS_FILES = [
    "js/i18n.js", "js/audio.js", "js/engine.js", "js/progress.js", "js/visual.js",
    "js/games/flashcard.js", "js/games/quiz.js", "js/games/memory.js",
    "js/games/rocket.js", "js/games/rhythm.js", "js/games/speak.js", "js/games/review.js", "js/app.js",
]


def read(rel):
    return (SRC / rel).read_text(encoding="utf-8")


def main():
    css = "\n".join(read(f) for f in CSS_FILES)
    js = "\n".join(read(f) for f in JS_FILES)

    # Garde-fou : un </script> littéral casserait l'inlining
    if "</script>" in js.lower():
        raise SystemExit("ERREUR : un fichier JS contient '</script>' — inlining impossible.")

    head = (
        '<!DOCTYPE html>\n'
        '<html lang="fr">\n'
        '<head>\n'
        '  <meta charset="UTF-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover">\n'
        '  <meta name="theme-color" content="#1A1A2E">\n'
        '  <meta name="description" content="MultipliKids — apprends les tables de multiplication en jouant, en francais et en grec.">\n'
        '  <meta name="mobile-web-app-capable" content="yes">\n'
        '  <meta name="apple-mobile-web-app-capable" content="yes">\n'
        '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
        '  <title>MultipliKids — Tables de multiplication</title>\n'
        '  <link rel="manifest" href="manifest.json">\n'
        "  <link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9C%96%EF%B8%8F%3C/text%3E%3C/svg%3E\">\n"
    )

    parts = [
        head,
        "  <style>\n", css, "\n  </style>\n",
        "</head>\n",
        '<body data-theme="space">\n',
        '  <div id="bg-decor" aria-hidden="true"></div>\n',
        '  <main id="app" role="main"></main>\n',
        "  <script>\n", js, "\n  </script>\n",
        "</body>\n</html>\n",
    ]
    html = "".join(parts)

    out = ROOT / "index.html"
    out.write_text(html, encoding="utf-8")
    print("OK : index.html genere ({:,} octets, {} CSS + {} JS inlines).".format(
        len(html.encode("utf-8")), len(CSS_FILES), len(JS_FILES)))


if __name__ == "__main__":
    main()
