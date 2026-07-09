// ===== Exam Simulation page boot =====

var examQuestions = [];
var examCurrentIndex = 0;
var examAnswers = [];
var examTimeLeft = 0;
var examTotalTime = 0;
var examTimerInterval = null;

function readinessLabel(acc) {
  if (acc >= 85) return { label: 'Likely Exam Ready', cls: 'r-ready' };
  if (acc >= 75) return { label: 'Close — Needs Focused Review', cls: 'r-close' };
  if (acc >= 60) return { label: 'Needs More Practice', cls: 'r-notready' };
  return { label: 'Not Ready — Review Fundamentals', cls: 'r-notready' };
}

function renderPastExams() {
  var wrap = document.getElementById('pastExamsWrap');
  if (examHistory.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  var rows = examHistory.slice().reverse().slice(0, 6).map(function(h) {
    var d = new Date(h.date);
    return '<tr><td>' + d.toLocaleDateString() + '</td><td class="mono">' + h.score + '/' + h.total + '</td><td class="mono">' + h.pct + '%</td></tr>';
  }).join('');
  wrap.innerHTML =
    '<div class="section-title">Past Exam Attempts</div>' +
    '<table class="domainT"><tr><th>Date</th><th>Score</th><th>Accuracy</th></tr>' + rows + '</table>';
}

function startExamSession() {
  var qCount = parseInt(document.getElementById('examQCount').value) || 90;
  var minutes = parseInt(document.getElementById('examMinutes').value) || 90;
  var pool = REGULAR_QUESTIONS;

  var shuffled = shuffleArray(pool);
  examQuestions = shuffled.slice(0, Math.min(qCount, shuffled.length));
  examCurrentIndex = 0;
  examAnswers = [];
  examTotalTime = minutes * 60;
  examTimeLeft = examTotalTime;

  document.getElementById('start').classList.add('hidden');
  document.getElementById('quizArea').classList.remove('hidden');
  document.getElementById('examBar').classList.remove('hidden');

  updateExamBar();
  startExamTimer();
  nextExamQuestion();
}

function nextExamQuestion() {
  if (examCurrentIndex >= examQuestions.length) {
    finishExam('completed');
    return;
  }
  updateExamBar();
  renderExamQuestion(examQuestions[examCurrentIndex]);
}

function renderExamQuestion(q) {
  current = q;
  currentKind = 'regular'; // enables keyboard shortcuts

  var order = shuffleArray(q.choices.map(function(_, i) { return i; }));
  shuffleMap = order;
  var isMulti = q.type === 'multi';
  resetStrikeState();

  var choicesHtml = buildChoicesHtml(q, order, isMulti);

  var typeHint = isMulti ? '<div class="type-hint">Select TWO answers</div>' : '';

  var area = document.getElementById('quizArea');
  area.innerHTML =
    '<div class="card">' +
    '<div class="domain-chip">' + q.domain + '</div>' +
    typeHint +
    '<div class="qtext">' + q.q + '</div>' +
    '<div id="choicesWrap">' + choicesHtml + '</div>' +
    '<button id="submitBtn" disabled>Submit &amp; Next</button>' +
    '</div>';

  document.querySelectorAll('.choice input').forEach(function(inp) {
    inp.addEventListener('change', function() {
      document.getElementById('submitBtn').disabled = false;
    });
  });
  attachStrikeHandlers();
  document.getElementById('submitBtn').addEventListener('click', submitExamAnswer);
}

function submitExamAnswer() {
  var inputs = Array.from(document.querySelectorAll('.choice input'));
  var selectedDisp = inputs.filter(function(i) { return i.checked; }).map(function(i) { return parseInt(i.value); });
  var selectedOrig = selectedDisp.map(function(d) { return shuffleMap[d]; });
  var correctSet = Array.isArray(current.correct) ? current.correct : [current.correct];
  var isCorrect = selectedOrig.length === correctSet.length && selectedOrig.every(function(s) { return correctSet.includes(s); });

  examAnswers.push({ questionId: current.id, domain: current.domain, topic: current.topic, isCorrect: isCorrect });
  examCurrentIndex++;
  nextExamQuestion();
}

function startExamTimer() {
  if (examTimerInterval) clearInterval(examTimerInterval);
  examTimerInterval = setInterval(function() {
    examTimeLeft = Math.max(0, examTimeLeft - 1);
    updateExamBar();
    if (examTimeLeft === 0) {
      clearInterval(examTimerInterval);
      examTimerInterval = null;
      finishExam('timeout');
    }
  }, 1000);
}

function updateExamBar() {
  var progressEl = document.getElementById('examProgress');
  var timerEl = document.getElementById('examTimerDisplay');
  if (!progressEl || !timerEl) return;

  progressEl.textContent = 'Question ' + (examCurrentIndex + 1) + ' of ' + examQuestions.length;

  var mins = Math.floor(examTimeLeft / 60);
  var secs = examTimeLeft % 60;
  timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
  timerEl.className = 'exam-timer-display';
  if (examTimeLeft < 60) timerEl.classList.add('critical');
  else if (examTimeLeft < 300) timerEl.classList.add('warn');
}

function finishExam(reason) {
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }

  var total = examAnswers.length;
  var correct = examAnswers.filter(function(a) { return a.isCorrect; }).length;
  var pct = total > 0 ? Math.round(100 * correct / total) : 0;

  var domainBreakdown = {};
  examAnswers.forEach(function(a) {
    if (!domainBreakdown[a.domain]) domainBreakdown[a.domain] = { correct: 0, total: 0 };
    domainBreakdown[a.domain].total++;
    if (a.isCorrect) domainBreakdown[a.domain].correct++;
  });

  var attempt = { date: new Date().toISOString(), score: correct, total: total, pct: pct, domainBreakdown: domainBreakdown, reason: reason };
  examHistory.push(attempt);
  saveProgress();

  document.getElementById('examBar').classList.add('hidden');
  document.getElementById('quizArea').classList.add('hidden');
  showExamResults(attempt);
}

function showExamResults(attempt) {
  var reportArea = document.getElementById('reportArea');
  reportArea.classList.remove('hidden');

  var r = readinessLabel(attempt.pct);
  var timeoutNote = attempt.reason === 'timeout' ? '<p style="color:var(--warn);font-size:0.85rem;">Time expired — ' + attempt.total + ' questions answered.</p>' : '';

  var domainRows = Object.keys(attempt.domainBreakdown).sort().map(function(d) {
    var s = attempt.domainBreakdown[d];
    var acc = s.total ? Math.round(100 * s.correct / s.total) : 0;
    var flag = s.total > 0 && acc < 70 ? ' ⚠️' : '';
    return '<tr><td>' + d + '</td><td class="mono">' + s.correct + '/' + s.total + '</td><td class="mono">' + acc + '%' + flag + '</td></tr>';
  }).join('');

  var historyHtml = '';
  if (examHistory.length > 1) {
    var histRows = examHistory.slice().reverse().slice(0, 6).map(function(h) {
      var d = new Date(h.date);
      return '<tr><td>' + d.toLocaleDateString() + '</td><td class="mono">' + h.score + '/' + h.total + '</td><td class="mono">' + h.pct + '%</td></tr>';
    }).join('');
    historyHtml = '<h3>Past Exam Attempts</h3>' +
      '<table class="domainT"><tr><th>Date</th><th>Score</th><th>Accuracy</th></tr>' + histRows + '</table>';
  }

  reportArea.innerHTML =
    '<div class="card report">' +
    '<h2>Exam Results — ' + attempt.total + ' Questions</h2>' +
    timeoutNote +
    '<div class="readiness-badge ' + r.cls + '">' + r.label + '</div>' +
    '<p>Score: <strong class="mono">' + attempt.score + '/' + attempt.total + ' (' + attempt.pct + '%)</strong></p>' +
    '<table class="domainT"><tr><th>Domain</th><th>Score</th><th>Accuracy</th></tr>' + domainRows + '</table>' +
    historyHtml +
    '<p style="color:var(--muted);font-size:0.82rem;">Reference: Security+ SY0-701 uses a scaled score of 750/900 to pass — roughly equivalent to 80%+ with no domain badly lagging.</p>' +
    '<button id="returnToMenuBtn">Return to Menu</button>' +
    '</div>';

  document.getElementById('returnToMenuBtn').addEventListener('click', returnToExamMenu);
}

function returnToExamMenu() {
  document.getElementById('reportArea').classList.add('hidden');
  document.getElementById('start').classList.remove('hidden');
  renderPastExams();
}

function boot() {
  if (!requireAuth()) return;
  renderSidebar('exam');
  enableKeyboardShortcuts();

  currentMode = 'exam';

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    renderPastExams();
  });

  document.getElementById('startBtn').addEventListener('click', startExamSession);

  document.getElementById('exitExamBtn').addEventListener('click', function() {
    if (!confirm('Exit the exam? Your current answers will be scored up to this point.')) return;
    finishExam('abandoned');
  });
}

document.addEventListener('DOMContentLoaded', boot);
