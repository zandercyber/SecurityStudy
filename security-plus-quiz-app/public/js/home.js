// ===== Home page: logged-in dashboard =====
// auth-guard.js has already confirmed a valid session before boot() runs.

function showDashboard() {
  renderSidebar('home');

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    document.getElementById('welcomeHeading').textContent = 'Welcome back, ' + getUsername();

    var acc = questionCount ? Math.round(100 * correctCount / questionCount) : 0;
    document.getElementById('dashAccuracy').textContent = questionCount ? acc + '%' : '--';
    document.getElementById('dashStreak').textContent = currentStreak;

    var dashFlame = document.getElementById('dash-streak-flame');
    if (dashFlame) {
      var dashTier = flameTierForStreak(currentStreak);
      dashFlame.setAttribute('data-tier', dashTier);
      var dashBadge = document.getElementById('dash-streak-badge');
      if (dashBadge) {
        if (dashTier >= 4) { dashBadge.textContent = currentStreak; dashBadge.classList.remove('hidden'); }
        else dashBadge.classList.add('hidden');
      }
    }
    var dashBest = document.getElementById('dash-streak-best');
    if (dashBest) dashBest.textContent = 'Best: ' + bestStreak;

    document.getElementById('dashQuestions').textContent = questionCount;
    document.getElementById('dashMissed').textContent = missedQuestionIds.length;

    var badge = document.getElementById('dashMissedBadge');
    if (badge) badge.textContent = missedQuestionIds.length > 0 ? '(' + missedQuestionIds.length + ')' : '';

    document.getElementById('dashChartWrap').innerHTML = renderAccuracyChart(answerHistory, { title: 'Accuracy trend', height: 84 });
  });
}

window.onAuthReady(showDashboard);
