// ===== Practice page boot =====

function boot() {
  if (!requireAuth()) return;
  renderSidebar('practice');
  enableKeyboardShortcuts();

  currentMode = 'practice';
  focusDomains = [];

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    if (questionCount > 0) {
      document.getElementById('startMsg').innerHTML =
        '<strong>Welcome back.</strong> You have ' + questionCount + ' questions answered (' +
        Math.round(100 * correctCount / Math.max(questionCount, 1)) + '% accuracy) saved to your account. Pick up where you left off.';
      document.getElementById('startBtn').textContent = 'Resume Practice';
      renderStatbar();
    }
  });

  document.getElementById('startBtn').addEventListener('click', function() {
    document.getElementById('start').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    nextTurn();
  });
}

document.addEventListener('DOMContentLoaded', boot);
