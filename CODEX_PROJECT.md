# Streetboardgame current scope

Streetboardgame is the “わたし理解度診断｜私のこと、ちゃんと分かってるよね？” site.

## Public game mode

- `/challenge`: create 1–10 questions, register the creator’s answers, and share a join URL (up to 50 players).
- LIVE (`/live-challenge`) ended on 2026-10-23 and its code and tables were removed on 2026-11-15; old LIVE URLs answer 410.

The game uses `prototype_common_data.js` and the approved custom-question catalog.
Retired game URLs and `/api/remote/*` return `404`.

## Operations

- `/question-ops`: review, edit, approve, disable, sort, and compare questions. Sign-in: `/api/admin/session` (src/admin/), secrets `LIVE_ADMIN_TOKEN`, `LIVE_ADMIN_TOTP_SECRET`, `LIVE_ADMIN_SESSION_SECRET` (historical names).
- D1 binding: `REMOTE_DB`. Operational events (errors, CSP reports) go to Workers Logs.

## Delivery

- Repository: `chiakijam-design/streetboardgame-site`
- Worker: `streetboardgame` (Workers Builds deploys `main`)
- Production: `https://www.streetboardgame.com`
