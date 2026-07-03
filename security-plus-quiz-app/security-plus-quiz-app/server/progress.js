const { load, save } = require('./store');

function getProgress(username) {
  const db = load();
  return db.progress[username] || null;
}

function setProgress(username, progress) {
  const db = load();
  progress.updatedAt = new Date().toISOString();
  db.progress[username] = progress;
  save(db);
}

module.exports = { getProgress, setProgress };
