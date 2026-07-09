// ===== Login / Create Account page =====

function revealPage() {
  document.documentElement.style.visibility = 'visible';
}

function redirectIfAlreadyLoggedIn() {
  var token = getToken();
  if (!token) {
    revealPage();
    return;
  }
  api('/api/auth/verify').then(function() {
    window.location.replace('index.html');
  }).catch(function() {
    clearSession();
    revealPage();
  });
}

function wireAuthTabs() {
  document.getElementById('tabLogin').addEventListener('click', function() {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
  });
  document.getElementById('tabRegister').addEventListener('click', function() {
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
  });

  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var username = document.getElementById('loginUsername').value;
    var password = document.getElementById('loginPassword').value;
    api('/api/login', { method: 'POST', body: { username: username, password: password } })
      .then(function(data) { onAuthSuccess(data.token, data.username); })
      .catch(function(err) { showError('loginError', err.message); });
  });

  document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var username = document.getElementById('regUsername').value;
    var password = document.getElementById('regPassword').value;
    api('/api/register', { method: 'POST', body: { username: username, password: password } })
      .then(function(data) { onAuthSuccess(data.token, data.username); })
      .catch(function(err) { showError('registerError', err.message); });
  });
}

function showError(elId, msg) {
  var el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function onAuthSuccess(token, username) {
  setSession(token, username);
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
  wireAuthTabs();
  redirectIfAlreadyLoggedIn();
});
