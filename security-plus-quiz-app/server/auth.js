const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { load, save } = require('./store');

function normalizeUsername(username) {
  return (username || '').trim().toLowerCase();
}

function register(username, password) {
  username = normalizeUsername(username);
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const db = load();
  if (db.users[username]) {
    throw new Error('That username is already taken.');
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  db.users[username] = { username, passwordHash, createdAt: new Date().toISOString() };
  db.progress[username] = null;
  save(db);
  return createSession(username);
}

function login(username, password) {
  username = normalizeUsername(username);
  const db = load();
  const user = db.users[username];
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    throw new Error('Invalid username or password.');
  }
  return createSession(username);
}

function createSession(username) {
  const db = load();
  const token = crypto.randomUUID();
  db.sessions[token] = { username, createdAt: new Date().toISOString() };
  save(db);
  return { token, username };
}

function logout(token) {
  const db = load();
  delete db.sessions[token];
  save(db);
}

function getUserFromToken(token) {
  if (!token) return null;
  const db = load();
  const session = db.sessions[token];
  return session ? session.username : null;
}

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const username = getUserFromToken(token);
  if (!username) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  req.username = username;
  req.token = token;
  next();
}

module.exports = { register, login, logout, getUserFromToken, authMiddleware };
