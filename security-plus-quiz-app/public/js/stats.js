// ===== Stats page: accuracy chart, domain breakdown, weakest topics, exam history =====

function readinessLabel(acc) {
  if (acc >= 85) return { label: 'Likely Exam Ready', cls: 'r-ready' };
  if (acc >= 75) return { label: 'Close — Needs Focused Review', cls: 'r-close' };
  if (acc >= 60) return { label: 'Needs More Practice', cls: 'r-notready' };
  return { label: 'Not Ready — Review Fundamentals', cls: 'r-notready' };
}

function renderStatsContent() {
  var el = document.getElementById('statsContent');

  if (questionCount === 0) {
    el.innerHTML = '<div class="card empty-state">No practice data yet. Answer a few questions in Practice, Focus Mode, or Exam Simulation to see your stats here.</div>';
    return;
  }

  var overallAcc = Math.round(100 * correctCount / questionCount);
  var r = readinessLabel(overallAcc);

  var domainRows = Object.keys(domainStats).sort().map(function(d) {
    var s = domainStats[d];
    var acc = s.total ? Math.round(100 * s.correct / s.total) : 0;
    var flag = s.total > 0 && acc < 70 ? ' ⚠️' : '';
    return '<tr><td>' + d + '</td><td class="mono">' + s.correct + '/' + s.total + '</td><td class="mono">' + (s.total ? acc + '%' : '--') + flag + '</td></tr>';
  }).join('');

  var weakList = Object.keys(topicStats)
    .filter(function(t) { return topicStats[t].total > 0; })
    .map(function(t) {
      return { topic: t, correct: topicStats[t].correct, total: topicStats[t].total, acc: topicStats[t].correct / topicStats[t].total };
    })
    .sort(function(a, b) { return a.acc - b.acc; })
    .slice(0, 8)
    .filter(function(t) { return t.acc < 1; })
    .map(function(t) {
      return '<li>' + t.topic + ' — ' + t.correct + '/' + t.total + ' correct (' + Math.round(t.acc * 100) + '%)</li>';
    })
    .join('');
  var weakHtml = weakList || '<li>No consistently weak topics right now — nice work.</li>';

  var examHistoryHtml = '';
  if (examHistory.length > 0) {
    var histRows = examHistory.slice().reverse().slice(0, 10).map(function(h) {
      var d = new Date(h.date);
      return '<tr><td>' + d.toLocaleDateString() + '</td><td class="mono">' + h.score + '/' + h.total + '</td><td class="mono">' + h.pct + '%</td></tr>';
    }).join('');
    examHistoryHtml =
      '<div class="section-title">Exam History</div>' +
      '<table class="domainT"><tr><th>Date</th><th>Score</th><th>Accuracy</th></tr>' + histRows + '</table>';
  }

  el.innerHTML =
    '<div class="card report">' +
    '<div class="readiness-badge ' + r.cls + '">' + r.label + '</div>' +
    '<p>Overall accuracy: <strong class="mono">' + overallAcc + '%</strong> (' + correctCount + '/' + questionCount + ' questions) &middot; Current streak: <strong class="mono">' + currentStreak + '</strong> &middot; Missed queue: <strong class="mono">' + missedQuestionIds.length + '</strong></p>' +
    renderAccuracyChart(answerHistory) +
    '<div class="section-title">Domain Breakdown</div>' +
    '<table class="domainT"><tr><th>Domain</th><th>Score</th><th>Accuracy</th></tr>' + domainRows + '</table>' +
    '<div class="section-title">Weakest Topics</div>' +
    '<ul class="weak">' + weakHtml + '</ul>' +
    examHistoryHtml +
    '</div>';
}

function confirmResetProgress() {
  if (!confirm('Reset all your progress?\n\nThis will clear your accuracy history, missed question list, adaptive weights, and exam history. This cannot be undone.')) return;
  api('/api/progress', { method: 'DELETE' })
    .then(function() {
      initFreshState();
      renderStatsContent();
      alert('Progress reset. Starting fresh!');
    })
    .catch(function(e) {
      alert('Could not reset progress: ' + e.message);
    });
}

function boot() {
  renderSidebar('stats');

  Promise.all([loadQuestions(), loadProgress()]).then(renderStatsContent);

  document.getElementById('resetBtn').addEventListener('click', confirmResetProgress);
}

window.onAuthReady(boot);
