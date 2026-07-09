// ===== Home page: logged-in dashboard =====
// auth-guard.js has already confirmed a valid session before boot() runs.

function showDashboard() {
  renderSidebar('home');

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

window.onAuthReady(showDashboard);
