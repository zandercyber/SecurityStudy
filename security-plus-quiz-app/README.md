# Security+ Adaptive Quiz

A self-hosted adaptive practice app for the CompTIA Security+ SY0-701 exam. Runs on Node/Express with a flat-JSON datastore — no build step, no framework, no external database required. Styled as a "Cyber Ops" SOC dashboard: dark navy panels, a warm cream/tan accent, and a persistent sidebar across every page.

## Features

- **Adaptive practice** — missed topics appear more often until you answer them correctly twice in a row
- **Performance-based questions** — drag-and-drop matching questions every 20th question
- **Readiness report** — per-domain accuracy breakdown and weakest-topic list every 10 questions
- **Focus mode** — restrict a session to specific SY0-701 domains
- **Review missed questions** — dedicated mode that only serves questions you've gotten wrong
- **Exam simulation** — timed, configurable-length exam with no mid-question feedback, plus a history of past attempts
- **Stats dashboard** — accuracy trend chart, per-domain breakdown, weakest topics, and exam history in one place
- **Keyboard shortcuts** — number/letter keys select choices; Enter submits or advances
- **Reset progress** — wipe all server-side data back to a fresh state

## Quick start

```bash
npm install
npm start
# → http://localhost:3000
```

Node 18+ required.

## Pages

The frontend is a set of static, multi-page HTML documents (no client-side router) sharing one persistent left sidebar. Every mode page other than Home redirects to Home if there's no valid session token.

| Page | Purpose |
|------|---------|
| `index.html` | **Home.** Logged-out: landing page explaining the adaptive engine, domain coverage, and login/register. Logged-in: dashboard with accuracy, streak, questions answered, a small accuracy-trend preview, and quick-launch cards into every mode. |
| `practice.html` | Adaptive practice across all domains — weighted question selection, PBQ every 20th question, readiness report every 10th. |
| `focus.html` | Domain picker + the same adaptive engine scoped to the selected domain(s). |
| `review.html` | Works through the persisted missed-question queue; answering correctly removes a question from the queue. |
| `exam.html` | Timed exam simulation — no mid-quiz feedback, end-of-exam results with domain breakdown, and a table of past attempts. |
| `stats.html` | Accuracy trend chart, per-domain accuracy, weakest topics, exam history, and the "reset all progress" control. |

## Architecture

```
server/
  server.js      Express app + all routes
  auth.js        bcrypt login/register + Bearer token sessions
  progress.js    Read/write/reset per-user progress
  store.js       Flat JSON file store (data/db.json)
public/
  index.html, practice.html, focus.html, review.html, exam.html, stats.html
  styles.css     Cyber Ops / SOC dashboard theme (shared by every page)
  js/
    api.js       Fetch helper + session storage + requireAuth() guard
    sidebar.js   Renders the persistent left nav + active-page highlight + logout
    state.js     Quiz state, persistence (load/save/reset), pool helpers, scoring
    engine.js    Adaptive regular-question rendering, next-turn flow, readiness report
    pbq.js       Drag-and-drop performance-based question rendering
    keyboard.js  Keyboard shortcuts for regular questions
    charts.js    Inline SVG accuracy trend chart (used by Stats, Home, and reports)
    home.js, practice.js, focus.js, review.js, exam.js, stats.js
                 Page-specific boot scripts, one per page above
data/
  questions.json Question bank (regular + PBQ)
  db.json        Runtime user/session/progress store (git-ignored)
```

Each HTML page includes only the shared scripts it actually needs via plain `<script>` tags — there's no bundler or module loader.

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/questions` | No | Return full question bank |
| POST | `/api/register` | No | Create account, returns `{token, username}` |
| POST | `/api/login` | No | Authenticate, returns `{token, username}` |
| POST | `/api/logout` | Yes | Invalidate current session token |
| GET | `/api/me` | Yes | Return `{username}` for current token |
| GET | `/api/progress` | Yes | Return saved progress snapshot |
| POST | `/api/progress` | Yes | Overwrite saved progress snapshot |
| DELETE | `/api/progress` | Yes | Reset saved progress to null (clear all data) |

All authenticated requests require `Authorization: Bearer <token>`.

## Quiz modes

### Practice (adaptive)
`pickWeighted()` selects from the full question pool with weights that rise on wrong answers and fall after two consecutive correct answers on a topic. Every 20th question is a PBQ; every 10th triggers a readiness report.

### Focus mode
Pick one or more SY0-701 domains on `focus.html`; `pickWeighted()` then only draws from matching questions, using the same adaptive engine as Practice. A mode indicator above the quiz shows the active domain(s) with a "Change domains" control.

### Review missed questions
Tracks every question ID you've answered incorrectly (across practice, focus, and review sessions) in a persisted `missedQuestionIds` array. `review.html` draws only from that set using the same adaptive weighting — so the hardest missed questions still surface most. Answering a question correctly in review removes it from the missed set. Adaptive weights/streaks are **not** modified during review; only `topicStats`/`domainStats`/`questionCount`/`correctCount` are updated.

### Exam simulation
Configurable question count (default 90) and time limit (default 90 min). Questions are drawn by plain random shuffle — no adaptive weighting. No explanations or correct/incorrect indicators are shown during the exam; each submission moves immediately to the next question. A countdown timer is shown in the exam bar. When all questions are answered or time runs out, a results screen shows overall score, per-domain breakdown, a pass/fail estimate, and a table of past exam attempts (also shown on the exam start screen). Exam sessions do **not** modify practice-mode weights or streaks.

### Clear progress
The "Reset all progress…" button on `stats.html` (confirmation required) calls `DELETE /api/progress`, which sets the server-side progress record to null. The frontend then calls `initFreshState()` and re-renders as if the account were brand new.

## Accuracy trend chart

Every time a question is answered in practice, focus, or review mode, a `{n, acc}` point is appended to `accuracyTrend` (rolling accuracy = correct / total so far). The array is downsampled to ≤ 200 points by discarding every other older interior point when it grows beyond that limit, keeping the first and last points intact. The chart renders as a responsive inline SVG (`charts.js`), reused at three sizes: the readiness report, the Stats page, and a small preview on the Home dashboard.

## Keyboard shortcuts

Active only on regular (non-PBQ) questions and only when no form input or button is focused — this never interferes with the login/register forms on Home.

| Key | Action |
|-----|--------|
| `1`–`5` or `A`–`E` | Select (single-choice) or toggle (multi-select) the corresponding answer |
| `Enter` | Submit the current answer (when at least one choice is selected) |
| `Enter` or `Space` | Advance to the next question (when feedback is showing) |

PBQ drag-and-drop questions are mouse/click only; keyboard shortcuts are disabled there.

## Visual style

Dark navy/slate background with panels a step lighter for depth, a warm cream/tan accent (`--accent`) for buttons, links, the active sidebar item, and progress highlights, and dedicated green/red for correct/incorrect and pass/fail states so semantic feedback never gets confused with the accent color. Numbers and stats use a monospace font; body text uses the system sans-serif stack.

## Progress data shape

The POST `/api/progress` body (and GET response's `progress` field) is a flat JSON object:

```json
{
  "weights":            { "Topic Name": 1.0 },
  "streaks":            { "Topic Name": 0 },
  "topicStats":         { "Topic Name": { "correct": 5, "total": 10 } },
  "domainStats":        { "1.0 General Security Concepts": { "correct": 7, "total": 9 } },
  "answerHistory":      [{ "topic": "...", "domain": "...", "correct": true }],
  "questionCount":      75,
  "correctCount":       66,
  "currentStreak":      6,
  "lastQuestionId":     "vpn_types_1",
  "lastPbqId":          "pbq_ports_1",
  "missedQuestionIds":  ["chain_of_custody_1", "..."],
  "accuracyTrend":      [{ "n": 10, "acc": 70 }, { "n": 20, "acc": 75 }],
  "examHistory":        [{ "date": "...", "score": 72, "total": 90, "pct": 80, "domainBreakdown": { ... }, "reason": "completed" }]
}
```
