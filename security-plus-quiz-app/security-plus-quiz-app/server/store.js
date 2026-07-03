// Minimal JSON-file datastore. Good enough for a personal/portfolio-scale app.
// Swap this out for a real database (SQLite/Postgres) if you outgrow it.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function defaultDb() {
  return { users: {}, sessions: {}, progress: {} };
}

function load() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return defaultDb();
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = { load, save, DB_PATH };
