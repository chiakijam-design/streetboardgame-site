# Streetboardgame current scope

Streetboardgame is the “わたし理解度診断｜私のこと、ちゃんと分かってるよね？” site.

## Public game modes

- `/challenge`: create 10 questions, register the creator’s answers, and share a join URL.
- `/live-challenge`: a streamer and viewers answer the same 10 questions in real time.

Both modes use `prototype_common_data.js` and the same approved custom-question catalog.
Retired game URLs and `/api/remote/*` return `404`.

## Operations

- `/question-ops`: review, edit, approve, disable, sort, and compare questions.
- `/live-ops`: LIVE operations console.
- D1 binding: `REMOTE_DB` (the historical binding name is retained because current challenge and LIVE tables use it).

## Delivery

- Repository: `chiakijam-design/streetboardgame-site`
- Worker: `streetboardgame`
- Production: `https://www.streetboardgame.com`
