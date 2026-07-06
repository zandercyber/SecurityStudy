const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');
const progressStore = require('./progress');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const QUESTIONS_PATH = path.join(__dirname, '..', 'data', 'questions.json');
const FLASHCARDS_PATH = path.join(__dirname, '..', 'data', 'flashcards.json');

app.get('/api/questions', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Could not load question bank.' });
  }
});

app.get('/api/flashcards', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(FLASHCARDS_PATH, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Could not load flashcards.' });
  }
});

app.post('/api/register', (req, res) => {
  try {
    const { username, password } = req.body || {};
    res.json(auth.register(username, password));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    res.json(auth.login(username, password));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/logout', auth.authMiddleware, (req, res) => {
  auth.logout(req.token);
  res.json({ ok: true });
});

app.get('/api/me', auth.authMiddleware, (req, res) => {
  res.json({ username: req.username });
});

app.get('/api/progress', auth.authMiddleware, (req, res) => {
  res.json({ progress: progressStore.getProgress(req.username) });
});

app.post('/api/progress', auth.authMiddleware, (req, res) => {
  try {
    progressStore.setProgress(req.username, req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/progress', auth.authMiddleware, (req, res) => {
  try {
    progressStore.resetProgress(req.username);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Security+ Adaptive Quiz running at http://localhost:${PORT}`);
});
