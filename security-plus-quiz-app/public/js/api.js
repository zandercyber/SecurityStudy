// ===== Shared API/session helper — loaded on every page =====

var TOKEN_KEY = 'spq_token';
var USERNAME_KEY = 'spq_username';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUsername() { return localStorage.getItem(USERNAME_KEY); }
function isLoggedIn() { return !!getToken(); }

function setSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

// Redirects to Home if there's no session token. Returns false when redirecting
// so callers can bail out of their boot sequence immediately.
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function api(path, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';
  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    });
  });
}

function logoutAndRedirect() {
  api('/api/logout', { method: 'POST' }).catch(function() {});
  clearSession();
  window.location.href = 'index.html';
}
