// ===== Adaptive quiz engine: regular questions, next-turn flow, readiness report =====
// Used by practice.html, focus.html, and review.html.

function renderRegular(q) {
  current = q;
  currentKind = 'regular';
  lastQuestionId = q.id;
  recordRecentQuestion(q.id);

  var order = shuffleArray(q.choices.map(function(_, i) { return i; }));
  shuffleMap = order;
  var isMulti = q.type === 'multi';
  resetStrikeState();

  var choicesHtml = buildChoicesHtml(q, order, isMulti);

  var typeHint = isMulti ? '<div class="type-hint">Select TWO answers</div>' : '';
  var kbdHint = '<div class="kbd-hint">Keyboard: 1&ndash;' + order.length + ' or A&ndash;' + String.fromCharCode(64 + order.length) + ' to select &middot; Enter to submit &middot; Shift+1&ndash;' + order.length + ' to cross out</div>';

  var area = document.getElementById('quizArea');
  area.innerHTML =
    '<div class="card">' +
    '<div class="domain-chip">' + q.domain + '</div>' +
    typeHint +
    '<div class="qtext">' + q.q + '</div>' +
    '<div id="choicesWrap">' + choicesHtml + '</div>' +
    '<button id="submitBtn" disabled>Submit Answer</button>' +
    kbdHint +
    '<div id="feedbackWrap"></div>' +
    '</div>';

  document.querySelectorAll('.choice input').forEach(function(inp) {
    inp.addEventListener('change', function() {
      document.getElementById('submitBtn').disabled = false;
    });
  });
  attachStrikeHandlers();
  document.getElementById('submitBtn').addEventListener('click', submitRegularAnswer);
}

function submitRegularAnswer() {
  var inputs = Array.from(document.querySelectorAll('.choice input'));
  var selectedDisp = inputs.filter(function(i) { return i.checked; }).map(function(i) { return parseInt(i.value); });
  inputs.forEach(function(i) { i.disabled = true; });

  var selectedOrig = selectedDisp.map(function(d) { return shuffleMap[d]; });
  var correctSet = Array.isArray(current.correct) ? current.correct : [current.correct];
  var isCorrect = selectedOrig.length === correctSet.length && selectedOrig.every(function(s) { return correctSet.includes(s); });

  document.querySelectorAll('.choice').forEach(function(label) {
    var dispIdx = parseInt(label.dataset.disp);
    var origIdx = shuffleMap[dispIdx];
    label.classList.add('disabled');
    if (correctSet.includes(origIdx)) label.classList.add('correct');
    else if (selectedOrig.includes(origIdx)) label.classList.add('incorrect');
  });

  recordAnswer(isCorrect);

  var weightInfo = (currentMode !== 'review')
    ? '<div class="topic-tag">Topic: ' + current.topic + ' &middot; now weighted ' + (weights[current.topic] || 1).toFixed(1) + 'x baseline</div>'
    : '<div class="topic-tag">Topic: ' + current.topic + '</div>';

  var fb = document.getElementById('feedbackWrap');
  fb.innerHTML =
    '<div class="feedback ' + (isCorrect ? 'good' : 'bad') + '">' +
    '<div class="verdict ' + (isCorrect ? 'good' : 'bad') + '">' + (isCorrect ? 'Correct' : 'Incorrect') + '</div>' +
    '<div>' + current.exp + '</div>' +
    weightInfo +
    '</div>';
  document.getElementById('submitBtn').classList.add('hidden');
  appendNextButton(fb);
}

function appendNextButton(fb) {
  var btn = document.createElement('button');
  var showReport = (questionCount % 10 === 0);
  btn.textContent = showReport ? 'See Readiness Report' : 'Next Question';
  btn.addEventListener('click', function() {
    if (showReport) showReport_fn();
    else nextTurn();
  });
  fb.appendChild(btn);
}

function nextTurn() {
  document.getElementById('reportArea').classList.add('hidden');
  document.getElementById('quizArea').classList.remove('hidden');

  if (currentMode === 'review') {
    nextReviewQuestion();
    return;
  }

  if (currentMode === 'pbq') {
    renderPBQ(pickWeighted(PBQ_QUESTIONS, lastPbqId));
    return;
  }

  // Practice / focus mode
  var isPbqTurn = PBQ_QUESTIONS.length > 0 && (questionCount + 1) % 20 === 0;
  if (isPbqTurn) {
    renderPBQ(pickWeighted(PBQ_QUESTIONS, lastPbqId));
  } else {
    var pool = getActivePool();
    if (pool.length === 0) pool = REGULAR_QUESTIONS; // fallback if focus yields empty
    renderRegular(pickWeighted(pool, lastQuestionId));
  }
}

function renderStatbar() {
  var bar = document.getElementById('statbar');
  if (!bar) return;
  bar.classList.remove('hidden');
  document.getElementById('stat-qnum').textContent = questionCount;
  document.getElementById('stat-correct').textContent = correctCount;
  document.getElementById('stat-acc').textContent = questionCount ? Math.round(100 * correctCount / questionCount) + '%' : '--';
  document.getElementById('stat-streak').textContent = currentStreak;
  updateStreakFlame();
}

// ---- Streak flame widget: purely presentational, driven off currentStreak/bestStreak. ----
// Tracks the previously-rendered values itself so it can tell "grew a tier" from "just
// broke" from "surpassed personal best" without state.js needing to know animations exist.
var _flameLastStreak = null;
var _flameLastBest = null;
var _flameBreakTimeout = null;

function setFlameTier(flame, badge, tier, streakForBadge) {
  flame.setAttribute('data-tier', tier);
  if (!badge) return;
  if (tier >= 4) {
    badge.textContent = streakForBadge;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function updateStreakFlame() {
  var flame = document.getElementById('stat-streak-flame');
  if (!flame) return;
  var badge = document.getElementById('stat-streak-badge');
  var bestEl = document.getElementById('stat-streak-best');

  if (_flameBreakTimeout) { clearTimeout(_flameBreakTimeout); _flameBreakTimeout = null; }

  var broke = _flameLastStreak !== null && _flameLastStreak > 0 && currentStreak === 0;
  var grew = _flameLastStreak !== null && currentStreak > _flameLastStreak;
  var newBest = _flameLastBest !== null && bestStreak > _flameLastBest && currentStreak === bestStreak;

  flame.classList.remove('flame-break', 'flame-pulse');

  if (broke) {
    flame.classList.add('flame-break');
    _flameBreakTimeout = setTimeout(function() {
      flame.classList.remove('flame-break');
      setFlameTier(flame, badge, 0, currentStreak);
      _flameBreakTimeout = null;
    }, 520);
  } else {
    setFlameTier(flame, badge, flameTierForStreak(currentStreak), currentStreak);
    if (grew) {
      void flame.offsetWidth; // restart the pulse animation even if it was just showing
      flame.classList.add('flame-pulse');
    }
  }

  if (bestEl) {
    bestEl.textContent = 'Best: ' + bestStreak;
    if (newBest) {
      bestEl.classList.remove('best-flash');
      void bestEl.offsetWidth;
      bestEl.classList.add('best-flash');
    }
  }

  _flameLastStreak = currentStreak;
  _flameLastBest = bestStreak;
}

function readinessLabel(acc) {
  if (acc >= 85) return { label: 'Likely Exam Ready', cls: 'r-ready' };
  if (acc >= 75) return { label: 'Close — Needs Focused Review', cls: 'r-close' };
  if (acc >= 60) return { label: 'Needs More Practice', cls: 'r-notready' };
  return { label: 'Not Ready — Review Fundamentals', cls: 'r-notready' };
}

function showReport_fn() {
  document.getElementById('quizArea').classList.add('hidden');
  var reportArea = document.getElementById('reportArea');
  reportArea.classList.remove('hidden');

  var last10 = answerHistory.slice(-10);
  var last10Correct = last10.filter(function(h) { return h.correct; }).length;
  var overallAcc = questionCount ? Math.round(100 * correctCount / questionCount) : 0;
  var last10Acc = last10.length ? Math.round(100 * last10Correct / last10.length) : 0;
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
    .slice(0, 5)
    .filter(function(t) { return t.acc < 1; })
    .map(function(t) {
      return '<li>' + t.topic + ' — ' + t.correct + '/' + t.total + ' correct (' + Math.round(t.acc * 100) + '%)</li>';
    })
    .join('');
  var weakHtml = weakList || '<li>No consistently weak topics right now — nice work.</li>';

  var chartHtml = renderAccuracyChart(answerHistory);

  reportArea.innerHTML =
    '<div class="card report">' +
    '<h2>Readiness Report — after ' + questionCount + ' questions</h2>' +
    '<div class="readiness-badge ' + r.cls + '">' + r.label + '</div>' +
    '<p>Overall accuracy: <strong class="mono">' + overallAcc + '%</strong> (' + correctCount + '/' + questionCount + ') &middot; Last ' + last10.length + ': <strong class="mono">' + last10Acc + '%</strong></p>' +
    chartHtml +
    '<table class="domainT"><tr><th>Domain</th><th>Score</th><th>Accuracy</th></tr>' + domainRows + '</table>' +
    '<div style="font-weight:600; margin-bottom:4px;">Weakest topics right now:</div>' +
    '<ul class="weak">' + weakHtml + '</ul>' +
    '<p style="color:var(--muted); font-size:0.82rem;">Reference point: Security+ SY0-701 uses a scaled score out of 900, with 750 needed to pass — roughly equivalent to consistently scoring in the low-to-mid 80s% or better, with no single domain lagging badly behind.</p>' +
    '<button id="continueBtn">Continue Quiz</button>' +
    '</div>';

  document.getElementById('continueBtn').addEventListener('click', nextTurn);
}
