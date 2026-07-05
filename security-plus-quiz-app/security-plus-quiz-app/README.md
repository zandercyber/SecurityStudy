# Security+ Adaptive Quiz

A self-hosted adaptive practice app for the CompTIA Security+ SY0-701 exam. Runs on Node/Express with a flat-JSON datastore — no build step, no framework, no external database required.

## Features

- **Adaptive practice** — missed topics appear more often until you answer them correctly twice in a row
- **Performance-based questions** — drag-and-drop matching questions every 20th question
- **Readiness report** — per-domain accuracy breakdown and weakest-topic list every 10 questions
- **Focus mode** — restrict any session to specific SY0-701 domains
- **Review missed questions** — dedicated mode that only serves questions you've gotten wrong
- **Exam simulation** — timed, configurable-length exam with no mid-question feedback
- **Accuracy trend chart** — inline SVG line chart of rolling accuracy over time in the readiness report
- **Keyboard shortcuts** — number/letter keys select choices; Enter submits or advances
- **Reset progress** — wipe all server-side data back to a fresh state

## Quick start

```bash
npm install
npm start
# → http://localhost:3000
```

Node 18+ required.

## Architecture

```
server/
  server.js      Express app + all routes
  auth.js        bcrypt login/register + Bearer token sessions
  progress.js    Read/write/reset per-user progress
  store.js       Flat JSON file store (data/db.json)
public/
  index.html     Single-page shell
  app.js         All client-side quiz logic (vanilla JS, no framework)
  styles.css     Dark-theme CSS
data/
  questions.json Question bank (regular + PBQ)
  db.json        Runtime user/session/progress store (git-ignored)
```

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
Default mode. `pickWeighted()` selects from the full question pool (or the focused subset) with weights that rise on wrong answers and fall after two consecutive correct answers on a topic. Every 20th question is a PBQ; every 10th triggers a readiness report.

### Focus mode
On the start screen, expand "Focus on specific domains" and check one or more of the five SY0-701 domains. While focus is active, `pickWeighted()` only draws from matching questions. A focus indicator appears above the quiz with an "All domains" button to exit. Focus applies to practice, review, and exam modes simultaneously.

### Review missed questions
Tracks every question ID you've answered incorrectly (across all practice and review sessions) in a persisted `missedQuestionIds` array. The "Review Missed" button on the start screen launches a session that draws only from that set using the same adaptive weighting — so the hardest missed questions still surface most. Answering a question correctly in review removes it from the missed set. Getting it wrong again leaves it in (and also adds it if somehow it wasn't there). Adaptive weights/streaks are **not** modified during review; only `topicStats`/`domainStats`/`questionCount`/`correctCount` are updated.

### Exam simulation
Configurable question count (default 90) and time limit (default 90 min). Questions are drawn by plain random shuffle from the active pool — no adaptive weighting. No explanations or correct/incorrect indicators are shown during the exam; each submission moves immediately to the next question. A countdown timer is shown in an orange bar at the top. When all questions are answered or time runs out, a results screen shows overall score, per-domain breakdown, a pass/fail estimate, and a table of past exam attempts. Exam sessions do **not** modify practice-mode weights or streaks.

### Clear progress
The "Reset all progress…" button (confirmation required) calls `DELETE /api/progress`, which sets the server-side progress record to null. The frontend then calls `initFreshState()` and returns to the start screen as if the account were brand new.

## Accuracy trend chart

Every time a question is answered in practice or review mode, a `{n, acc}` point is appended to `accuracyTrend` (rolling accuracy = correct / total so far). The array is downsampled to ≤ 200 points by discarding every other older interior point when it grows beyond that limit, keeping the first and last points intact. The chart renders as a responsive inline SVG in the readiness report, with reference lines at 75% and 80%.

## Keyboard shortcuts

Active only on regular (non-PBQ) questions and only when no form input or button is focused.

| Key | Action |
|-----|--------|
| `1`–`5` or `A`–`E` | Select (single-choice) or toggle (multi-select) the corresponding answer |
| `Enter` | Submit the current answer (when at least one choice is selected) |
| `Enter` or `Space` | Advance to the next question (when feedback is showing) |

PBQ drag-and-drop questions are mouse/click only; keyboard shortcuts are disabled there.

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
