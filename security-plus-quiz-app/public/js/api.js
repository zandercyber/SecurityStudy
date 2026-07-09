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

// Kicked in by api() whenever the server rejects a request with 401 — the token in storage
// is missing/expired/tampered, so the client-side session is no longer trustworthy.
// Returns true if we're already on login.html (so the caller should handle the rejection
// itself, e.g. to reveal the form) rather than us navigating away again.
function handleUnauthorized() {
  clearSession();
  var onLoginPage = /(^|\/)login\.html$/.test(window.location.pathname);
  if (!onLoginPage) window.location.href = 'login.html';
  return onLoginPage;
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
    if (res.status === 401) {
      var onLoginPage = handleUnauthorized();
      if (!onLoginPage) return new Promise(function() {}); // navigating away; never resolve to callers
    }
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    });
  });
}

function logoutAndRedirect() {
  api('/api/logout', { method: 'POST' }).catch(function() {});
  clearSession();
  window.location.href = 'login.html';
}
