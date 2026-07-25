// ===== PBQ-only practice page boot =====
// Draws exclusively from PBQ_QUESTIONS via currentMode === 'pbq', handled in engine.js's nextTurn().
// Reuses the same renderPBQ/adaptive-weighting/stats pipeline as the every-20th-question PBQ cadence.

function boot() {
  renderSidebar('pbq-practice');
  enableKeyboardShortcuts();

  currentMode = 'pbq';
  focusDomains = [];

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    if (questionCount > 0) {
      document.getElementById('startMsg').innerHTML =
        '<strong>Welcome back.</strong> You have ' + questionCount + ' questions answered (' +
        Math.round(100 * correctCount / Math.max(questionCount, 1)) + '% accuracy) saved to your account. ' +
        'This session will drill only performance-based matching questions.';
      document.getElementById('startBtn').textContent = 'Resume PBQ Practice';
      renderStatbar();
    }
  });

  document.getElementById('startBtn').addEventListener('click', function() {
    document.getElementById('start').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    nextTurn();
  });
}

window.onAuthReady(boot);
