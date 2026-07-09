// ===== Auth guard — must be the first script in <head> on every protected page =====
// 1. Synchronously checks localStorage for a token; redirects to login.html immediately if absent.
// 2. Hides the page, then asks the server to confirm the token is actually still valid.
// 3. Only reveals the page and runs the caller's boot function once the server has confirmed it.
// A token existing in storage is not trusted on its own — it could be stale or tampered with.

(function() {
  var TOKEN_KEY = 'spq_token';
  var USERNAME_KEY = 'spq_username';

  var token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.replace('login.html');
    return;
  }

  // Hide the page (the <html> element already exists while <head> is parsing) until
  // the server has confirmed the token is valid, so no protected content can flash.
  document.documentElement.style.visibility = 'hidden';

  function domReady() {
    return new Promise(function(resolve) {
      if (document.readyState !== 'loading') resolve();
      else document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  var verifyPromise = fetch('/api/auth/verify', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(res) {
    if (!res.ok) throw new Error('Session invalid.');
  }).catch(function(err) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    window.location.replace('login.html');
    return Promise.reject(err);
  });

  // Pages call window.onAuthReady(bootFn) instead of listening for DOMContentLoaded directly,
  // so bootFn only ever runs once the server-side verify check has actually passed.
  window.onAuthReady = function(callback) {
    Promise.all([verifyPromise, domReady()]).then(function() {
      document.documentElement.style.visibility = 'visible';
      callback();
    }).catch(function() { /* verifyPromise already redirected to login.html */ });
  };
})();
