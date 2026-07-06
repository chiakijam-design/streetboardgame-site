# Codex Project Notes

This folder is the Codex-managed copy of the Genspark-built `streetboardgame.com` site.

## Current Site

- Domain: `streetboardgame.com`
- Production URL: `https://streetboardgame.com`
- GitHub repository target: `chiakijam-design/streetboardgame-site`
- Hosting: Cloudflare Pages / Workers
- Analytics: GA4 `G-X07PVDQWYX`
- Contact form: Formspree `https://formspree.io/f/xrevejjr`

## Important Files

- `index.html`: entry point, SEO, OGP, GA4, route bootstrap
- `prototype_app.jsx`: main React app
- `prototype_character.jsx`: character component
- `prototype_quiz_data.js`: 42 quiz cards and color choices
- `assets/cards/`: card images
- `assets/character/`: character images
- `_worker.js`: Cloudflare Worker routing
- `wrangler.jsonc`: Cloudflare Worker and asset binding config
- `RESTORE_GUIDE.md`: original restore guide from the Genspark backup
- `CHAT_HISTORY_SUMMARY.md`: original project history summary

## Local Preview

Run from this folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Useful route checks:

- `http://localhost:8000/?screen=intro`
- `http://localhost:8000/?screen=about`
- `http://localhost:8000/?screen=about&to=contact`

## Git Setup

Git was not available in PATH during the initial Codex migration. Once Git is installed or available:

```powershell
git init
git add .
git commit -m "Import Genspark site backup"
git branch -M main
git remote add origin https://github.com/chiakijam-design/streetboardgame-site.git
git push -u origin main
```

Before pushing, confirm whether the GitHub repository already has newer production changes.

## Editing Rule Of Thumb

Keep this as a static site unless there is a clear reason to introduce a build step. The current production model depends on direct static files plus Cloudflare Worker routing.
