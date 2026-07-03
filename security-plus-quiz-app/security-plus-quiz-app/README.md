# Security+ Adaptive Quiz

A self-hosted, adaptive practice quiz for the CompTIA Security+ (SY0-701) exam. Built from a personal set of missed practice questions, then expanded to cover all five exam domains.

## Features

- **354 multiple-choice/multi-select questions** across all 5 SY0-701 domains (General Concepts, Threats/Vulnerabilities/Mitigations, Architecture, Operations, Program Management), grouped into 177 topics.
- **8 performance-based questions (PBQs)** — drag-and-drop matching items (ports, cryptography, access control models, backup types, threat actor motivations, DR site readiness, RAID levels) — one appears every 20th question.
- **Adaptive weighting** — get a topic wrong and it shows up more often (up to 2.5x per miss, capped at 15x baseline) until you answer it correctly twice in a row, then it decays back to normal frequency.
- **Answer order shuffling** — choices are re-shuffled every time a question is shown, so you can't memorize answer position.
- **Readiness report** every 10 questions — overall accuracy, per-domain breakdown, and your current weakest topics, with a rough readiness verdict.
- **Accounts + saved progress** — register/log in, and your weights, stats, and question history are saved server-side so you can resume from any device/browser.

## Tech stack

- Backend: Node.js + Express
- Storage: a flat JSON file (`data/db.json`), created automatically on first run — no database server to install. Swap in SQLite/Postgres later if you want.
- Auth: bcrypt-hashed passwords + random session tokens (`Authorization: Bearer <token>`), no third-party auth service.
- Frontend: plain HTML/CSS/vanilla JS, no build step, no framework.

## Getting started

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser. Create an account, and start the quiz.

By default the server runs on port 3000. Override with the `PORT` environment variable:

```bash
PORT=5050 npm start
```

## Project structure

```
security-plus-quiz-app/
  server/
    server.js       # Express app + routes
    auth.js         # register/login/session logic (bcrypt + tokens)
    progress.js      # get/set per-user saved quiz state
    store.js         # tiny JSON-file datastore
  public/
    index.html
    styles.css
    app.js            # all quiz/PBQ/report/auth logic
  data/
    questions.json    # the question bank (regular + PBQ)
    db.json           # created at runtime, holds users/sessions/progress (gitignored)
```

## API

All endpoints are JSON. Authenticated endpoints expect `Authorization: Bearer <token>`.

| Method | Path             | Auth | Description                                  |
|--------|------------------|------|-----------------------------------------------|
| GET    | `/api/questions` | No   | Returns `{ regular: [...], pbq: [...] }`      |
| POST   | `/api/register`  | No   | `{ username, password }` → `{ token, username }` |
| POST   | `/api/login`     | No   | `{ username, password }` → `{ token, username }` |
| POST   | `/api/logout`    | Yes  | Invalidates the current token                 |
| GET    | `/api/me`        | Yes  | `{ username }`                                |
| GET    | `/api/progress`  | Yes  | `{ progress: {...} or null }`                 |
| POST   | `/api/progress`  | Yes  | Saves the full quiz state snapshot            |

## Notes / known limitations

- `data/db.json` is a flat file, fine for personal/portfolio use but not for concurrent multi-user production traffic — migrate to a real database if you deploy this publicly at scale.
- Session tokens don't expire; add TTL/refresh logic if you productionize this.
- One answer key correction from the original source material: "which threat actor is most likely to attack for direct financial gain" now scores **Organized Crime** as correct (the original marked Hacktivist, which doesn't match CompTIA's objectives — hacktivists are ideologically motivated).

## License

MIT — do whatever you want with it.
