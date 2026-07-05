// ===== Home page: logged-out landing / logged-in dashboard =====

var DOMAINS = [
  '1.0 General Security Concepts',
  '2.0 Threats, Vulnerabilities & Mitigations',
  '3.0 Security Architecture',
  '4.0 Security Operations',
  '5.0 Security Program Management'
];

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
  renderSidebar('home');
  showDashboard();
}

function showLanding() {
  document.getElementById('landingView').classList.remove('hidden');
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('domainList').innerHTML = DOMAINS.map(function(d) {
    return '<span class="domain-pill">' + d + '</span>';
  }).join('');
  wireAuthTabs();
}

function showDashboard() {
  document.getElementById('landingView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    document.getElementById('welcomeHeading').textContent = 'Welcome back, ' + getUsername();

    var acc = questionCount ? Math.round(100 * correctCount / questionCount) : 0;
    document.getElementById('dashAccuracy').textContent = questionCount ? acc + '%' : '--';
    document.getElementById('dashStreak').textContent = currentStreak;
    document.getElementById('dashQuestions').textContent = questionCount;
    document.getElementById('dashMissed').textContent = missedQuestionIds.length;

    var badge = document.getElementById('dashMissedBadge');
    if (badge) badge.textContent = missedQuestionIds.length > 0 ? '(' + missedQuestionIds.length + ')' : '';

    document.getElementById('dashChartWrap').innerHTML = renderAccuracyChart(accuracyTrend, { title: 'Accuracy trend', height: 100 });
  });
}

function boot() {
  renderSidebar('home');
  if (isLoggedIn()) {
    showDashboard();
  } else {
    showLanding();
  }
}

document.addEventListener('DOMContentLoaded', boot);
