// ===== Review Missed page boot =====

function updateModeIndicator() {
  var el = document.getElementById('modeIndicator');
  el.className = 'mode-indicator review-mode';
  el.classList.remove('hidden');
  var remaining = getMissedPool().length;
  el.innerHTML =
    '<span>Reviewing missed questions &mdash; <strong>' + remaining + '</strong> remaining</span>' +
    '<button id="exitReviewBtn" class="secondary small">Exit review</button>';
  document.getElementById('exitReviewBtn').addEventListener('click', exitToStart);
}

function exitToStart() {
  document.getElementById('quizArea').classList.add('hidden');
  document.getElementById('reportArea').classList.add('hidden');
  document.getElementById('modeIndicator').classList.add('hidden');
  document.getElementById('start').classList.remove('hidden');
  updateStartScreen();
}

function nextReviewQuestion() {
  var pool = getMissedPool();
  if (pool.length === 0) {
    exitToStart();
    alert('All missed questions cleared! Great work.');
    return;
  }
  updateModeIndicator();
  renderRegular(pickWeighted(pool, lastQuestionId));
}

function updateStartScreen() {
  var count = missedQuestionIds.length;
  var intro = document.getElementById('reviewIntro');
  var startBtn = document.getElementById('startBtn');
  if (count === 0) {
    intro.textContent = 'No missed questions right now — nice work. Answer a few questions wrong in Practice, Focus Mode, or Review and they will queue up here.';
    startBtn.classList.add('hidden');
  } else {
    intro.textContent = 'You have ' + count + ' missed question' + (count === 1 ? '' : 's') + ' queued for review.';
    startBtn.classList.remove('hidden');
  }
}

function boot() {
  renderSidebar('review');
  enableKeyboardShortcuts();

  currentMode = 'review';
  focusDomains = [];

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    updateStartScreen();
    if (questionCount > 0) renderStatbar();
  });

  document.getElementById('startBtn').addEventListener('click', function() {
    if (getMissedPool().length === 0) {
      alert('No missed questions to review.');
      return;
    }
    document.getElementById('start').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    nextReviewQuestion();
  });
}

window.onAuthReady(boot);
