// ===== Security+ Adaptive Quiz - frontend app =====

var TOKEN_KEY = 'spq_token';
var USERNAME_KEY = 'spq_username';

var REGULAR_QUESTIONS = [];
var PBQ_QUESTIONS = [];

// ---- Core quiz state (persisted to server) ----
var weights = {};
var streaks = {};
var topicStats = {};
var domainStats = {};
var answerHistory = [];
var questionCount = 0;
var correctCount = 0;
var currentStreak = 0;
var lastQuestionId = null;
var lastPbqId = null;
var current = null;
var currentKind = null;
var shuffleMap = null;
var slotAssignments = {};
var selectedTerm = null;

// ---- New feature state (persisted) ----
var missedQuestionIds = []; // IDs of questions ever answered wrong in practice/review
var accuracyTrend = [];     // [{n, acc}] rolling accuracy snapshots, capped to ~200 points
var examHistory = [];       // [{date, score, total, pct, domainBreakdown}]

// ---- Session-only state (not persisted) ----
var focusDomains = [];       // [] = all domains; non-empty = active focus filter
var currentMode = 'practice'; // 'practice' | 'review' | 'exam'

// Exam transient state
var examQuestions = [];
var examCurrentIndex = 0;
var examAnswers = [];
var examTimeLeft = 0;
var examTotalTime = 0;
var examTimerInterval = null;

// ---------------- API helper ----------------
function getToken() { return localStorage.getItem(TOKEN_KEY); }

function api(path, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';
  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    });
  });
}

// ---------------- State init / snapshot ----------------
function initFreshState() {
  weights = {};
  streaks = {};
  topicStats = {};
  domainStats = {};
  answerHistory = [];
  questionCount = 0;
  correctCount = 0;
  currentStreak = 0;
  lastQuestionId = null;
  lastPbqId = null;
  missedQuestionIds = [];
  accuracyTrend = [];
  examHistory = [];

  REGULAR_QUESTIONS.concat(PBQ_QUESTIONS).forEach(function(q) {
    if (!(q.topic in weights)) {
      weights[q.topic] = 1;
      streaks[q.topic] = 0;
      topicStats[q.topic] = { correct: 0, total: 0 };
    }
    if (!(q.domain in domainStats)) domainStats[q.domain] = { correct: 0, total: 0 };
  });
}

function restoreState(saved) {
  initFreshState();
  if (!saved) return;
  weights = saved.weights || weights;
  streaks = saved.streaks || streaks;
  topicStats = saved.topicStats || topicStats;
  domainStats = saved.domainStats || domainStats;
  answerHistory = saved.answerHistory || [];
  questionCount = saved.questionCount || 0;
  correctCount = saved.correctCount || 0;
  currentStreak = saved.currentStreak || 0;
  lastQuestionId = saved.lastQuestionId || null;
  lastPbqId = saved.lastPbqId || null;
  missedQuestionIds = saved.missedQuestionIds || [];
  accuracyTrend = saved.accuracyTrend || [];
  examHistory = saved.examHistory || [];
}

function snapshotState() {
  return {
    weights: weights,
    streaks: streaks,
    topicStats: topicStats,
    domainStats: domainStats,
    answerHistory: answerHistory.slice(-200),
    questionCount: questionCount,
    correctCount: correctCount,
    currentStreak: currentStreak,
    lastQuestionId: lastQuestionId,
    lastPbqId: lastPbqId,
    missedQuestionIds: missedQuestionIds,
    accuracyTrend: accuracyTrend,
    examHistory: examHistory
  };
}

function saveProgress() {
  api('/api/progress', { method: 'POST', body: snapshotState() }).catch(function(e) {
    console.warn('Could not save progress:', e.message);
  });
}

// ---------------- Pool helpers ----------------
function getActivePool() {
  if (focusDomains.length === 0) return REGULAR_QUESTIONS;
  return REGULAR_QUESTIONS.filter(function(q) {
    return focusDomains.indexOf(q.domain) !== -1;
  });
}

function getMissedPool() {
  var pool = REGULAR_QUESTIONS.filter(function(q) {
    return missedQuestionIds.indexOf(q.id) !== -1;
  });
  if (focusDomains.length > 0) {
    pool = pool.filter(function(q) { return focusDomains.indexOf(q.domain) !== -1; });
  }
  return pool;
}

// ---------------- Accuracy trend ----------------
function updateAccuracyTrend() {
  if (questionCount === 0) return;
  var acc = Math.round(100 * correctCount / questionCount);
  accuracyTrend.push({ n: questionCount, acc: acc });
  if (accuracyTrend.length > 200) {
    // Downsample: keep first, every other interior point, and last
    var kept = [accuracyTrend[0]];
    for (var i = 2; i < accuracyTrend.length - 1; i += 2) kept.push(accuracyTrend[i]);
    kept.push(accuracyTrend[accuracyTrend.length - 1]);
    accuracyTrend = kept;
  }
}

// ---------------- Weighted selection ----------------
function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function pickWeighted(pool, lastId) {
  var withWeights = pool.map(function(q) {
    var w = weights[q.topic] || 1;
    if (q.id === lastId) w *= 0.15;
    return { q: q, w: w };
  });
  var total = withWeights.reduce(function(s, p) { return s + p.w; }, 0);
  var r = Math.random() * total;
  for (var i = 0; i < withWeights.length; i++) {
    if (r < withWeights[i].w) return withWeights[i].q;
    r -= withWeights[i].w;
  }
  return withWeights[withWeights.length - 1].q;
}

// ---------------- Rendering: regular questions ----------------
function renderRegular(q) {
  current = q;
  currentKind = 'regular';
  lastQuestionId = q.id;

  var order = shuffleArray(q.choices.map(function(_, i) { return i; }));
  shuffleMap = order;
  var isMulti = q.type === 'multi';

  var choicesHtml = order.map(function(origIdx, dispIdx) {
    return '<label class="choice" data-disp="' + dispIdx + '">' +
      '<input type="' + (isMulti ? 'checkbox' : 'radio') + '" name="choice" value="' + dispIdx + '">' +
      '<span>' + String.fromCharCode(65 + dispIdx) + '. ' + q.choices[origIdx] + '</span>' +
      '</label>';
  }).join('');

  var typeHint = isMulti ? '<div class="type-hint">Select TWO answers</div>' : '';
  var kbdHint = '<div class="kbd-hint">Keyboard: 1&ndash;' + order.length + ' or A&ndash;' + String.fromCharCode(64 + order.length) + ' to select &middot; Enter to submit</div>';

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

  var weightInfo = (currentMode === 'practice')
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

// ---------------- Rendering: PBQ (matching) questions ----------------
function renderPBQ(q) {
  current = q;
  currentKind = 'pbq';
  lastPbqId = q.id;
  slotAssignments = {};
  selectedTerm = null;

  var shuffledPairs = q.pairs.map(function(p, i) { return { term: p[0], def: p[1], idx: i }; });
  var shuffledTerms = shuffleArray(shuffledPairs.map(function(p) { return p.term; }));

  var termsHtml = shuffledTerms.map(function(term) {
    return '<div class="term-chip" draggable="true" data-term="' + escapeAttr(term) + '">' + term + '</div>';
  }).join('');

  var slotsHtml = shuffledPairs.map(function(p) {
    return '<div class="slot-row">' +
      '<div class="slot-def">' + p.def + '</div>' +
      '<div class="slot-drop" data-idx="' + p.idx + '" data-answer="' + escapeAttr(p.term) + '">Drop term here</div>' +
      '</div>';
  }).join('');

  var area = document.getElementById('quizArea');
  area.innerHTML =
    '<div class="card">' +
    '<div class="pbq-chip">PERFORMANCE-BASED QUESTION</div>' +
    '<div class="domain-chip">' + q.domain + '</div>' +
    '<div class="qtext">' + q.q + '</div>' +
    '<div class="pbq-hint">Drag each term onto its matching description, or click a term then click a slot.</div>' +
    '<div class="matching-wrap">' +
    '<div class="terms-pool" id="termsPool">' + termsHtml + '</div>' +
    '<div id="slotsWrap">' + slotsHtml + '</div>' +
    '</div>' +
    '<button id="submitBtn" disabled>Submit Answer</button>' +
    '<div id="feedbackWrap"></div>' +
    '</div>';

  wirePbqInteractions();
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

function wirePbqInteractions() {
  var pool = document.getElementById('termsPool');
  var slots = document.querySelectorAll('.slot-drop');

  function updateSubmitEnabled() {
    var total = document.querySelectorAll('.slot-drop').length;
    var filled = Object.keys(slotAssignments).filter(function(k) { return slotAssignments[k]; }).length;
    document.getElementById('submitBtn').disabled = filled < total;
  }

  function clearSelection() {
    document.querySelectorAll('.term-chip.selected').forEach(function(c) { c.classList.remove('selected'); });
    selectedTerm = null;
  }

  function placeTermInSlot(term, slotEl) {
    var idx = slotEl.dataset.idx;
    if (slotAssignments[idx]) returnTermToPool(slotAssignments[idx]);
    document.querySelectorAll('.slot-drop').forEach(function(s) {
      if (slotAssignments[s.dataset.idx] === term) {
        slotAssignments[s.dataset.idx] = null;
        s.textContent = 'Drop term here';
        s.classList.remove('filled');
      }
    });
    var chip = pool.querySelector('.term-chip[data-term="' + cssEscape(term) + '"]');
    if (chip) chip.remove();
    slotAssignments[idx] = term;
    slotEl.textContent = term;
    slotEl.classList.add('filled');
    clearSelection();
    updateSubmitEnabled();
  }

  function returnTermToPool(term) {
    var chip = document.createElement('div');
    chip.className = 'term-chip';
    chip.draggable = true;
    chip.dataset.term = term;
    chip.textContent = term;
    wireChip(chip);
    pool.appendChild(chip);
  }

  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function wireChip(chip) {
    chip.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', chip.dataset.term);
    });
    chip.addEventListener('click', function() {
      document.querySelectorAll('.term-chip.selected').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      selectedTerm = chip.dataset.term;
    });
  }

  pool.querySelectorAll('.term-chip').forEach(wireChip);

  slots.forEach(function(slot) {
    slot.addEventListener('dragover', function(e) {
      e.preventDefault();
      slot.classList.add('over');
    });
    slot.addEventListener('dragleave', function() { slot.classList.remove('over'); });
    slot.addEventListener('drop', function(e) {
      e.preventDefault();
      slot.classList.remove('over');
      var term = e.dataTransfer.getData('text/plain');
      if (term) placeTermInSlot(term, slot);
    });
    slot.addEventListener('click', function() {
      var idx = slot.dataset.idx;
      if (slotAssignments[idx]) {
        returnTermToPool(slotAssignments[idx]);
        slotAssignments[idx] = null;
        slot.textContent = 'Drop term here';
        slot.classList.remove('filled');
        updateSubmitEnabled();
      } else if (selectedTerm) {
        placeTermInSlot(selectedTerm, slot);
      }
    });
  });

  document.getElementById('submitBtn').addEventListener('click', submitPbqAnswer);
}

function submitPbqAnswer() {
  var slots = document.querySelectorAll('.slot-drop');
  var allCorrect = true;
  slots.forEach(function(slot) {
    var idx = slot.dataset.idx;
    var correctAnswer = slot.dataset.answer;
    var given = slotAssignments[idx];
    if (given === correctAnswer) {
      slot.classList.add('correct');
    } else {
      slot.classList.add('incorrect');
      allCorrect = false;
    }
  });
  document.querySelectorAll('.term-chip').forEach(function(c) { c.style.pointerEvents = 'none'; });

  recordAnswer(allCorrect);

  var fb = document.getElementById('feedbackWrap');
  fb.innerHTML =
    '<div class="feedback ' + (allCorrect ? 'good' : 'bad') + '">' +
    '<div class="verdict ' + (allCorrect ? 'good' : 'bad') + '">' + (allCorrect ? 'All matched correctly' : 'Some matches were incorrect') + '</div>' +
    '<div>' + current.exp + '</div>' +
    '<div class="topic-tag">Topic: ' + current.topic + '</div>' +
    '</div>';
  document.getElementById('submitBtn').classList.add('hidden');
  appendNextButton(fb);
}

// ---------------- Shared scoring / flow ----------------
function recordAnswer(isCorrect) {
  questionCount++;
  // Update topic/domain stats for all modes
  if (topicStats[current.topic]) {
    topicStats[current.topic].total++;
    if (isCorrect) topicStats[current.topic].correct++;
  }
  if (domainStats[current.domain]) {
    domainStats[current.domain].total++;
    if (isCorrect) domainStats[current.domain].correct++;
  }

  if (isCorrect) {
    correctCount++;
    currentStreak++;
    if (currentMode !== 'review') {
      // Only touch adaptive weights/streaks in practice mode
      streaks[current.topic] = (streaks[current.topic] || 0) + 1;
      if (streaks[current.topic] >= 2) {
        weights[current.topic] = Math.max((weights[current.topic] || 1) / 2, 1);
      }
    }
    if (currentMode === 'review') {
      // Remove from missed set when answered correctly during review
      var removeIdx = missedQuestionIds.indexOf(current.id);
      if (removeIdx !== -1) missedQuestionIds.splice(removeIdx, 1);
      updateModeIndicator();
    }
  } else {
    currentStreak = 0;
    if (currentMode !== 'review') {
      streaks[current.topic] = 0;
      weights[current.topic] = Math.min((weights[current.topic] || 1) * 2.5, 15);
    }
    // Track missed questions in practice and review modes (only regular questions)
    if (currentKind === 'regular' && missedQuestionIds.indexOf(current.id) === -1) {
      missedQuestionIds.push(current.id);
    }
  }

  answerHistory.push({ topic: current.topic, domain: current.domain, correct: isCorrect });
  updateAccuracyTrend();
  renderStatbar();
  saveProgress();
}

function appendNextButton(fb) {
  var btn = document.createElement('button');
  var showReport = (questionCount % 10 === 0) && currentMode !== 'exam';
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

  // Practice mode
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
  document.getElementById('statbar').classList.remove('hidden');
  document.getElementById('stat-qnum').textContent = questionCount;
  document.getElementById('stat-correct').textContent = correctCount;
  document.getElementById('stat-acc').textContent = questionCount ? Math.round(100 * correctCount / questionCount) + '%' : '--';
  document.getElementById('stat-streak').textContent = currentStreak;
}

function readinessLabel(acc) {
  if (acc >= 85) return { label: 'Likely Exam Ready', cls: 'r-ready' };
  if (acc >= 75) return { label: 'Close — Needs Focused Review', cls: 'r-close' };
  if (acc >= 60) return { label: 'Needs More Practice', cls: 'r-notready' };
  return { label: 'Not Ready — Review Fundamentals', cls: 'r-notready' };
}

// Renamed to avoid collision with the variable `showReport` in appendNextButton
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
    return '<tr><td>' + d + '</td><td>' + s.correct + '/' + s.total + '</td><td>' + (s.total ? acc + '%' : '--') + flag + '</td></tr>';
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

  var chartHtml = renderAccuracyChart(accuracyTrend);

  reportArea.innerHTML =
    '<div class="card report">' +
    '<h2>Readiness Report — after ' + questionCount + ' questions</h2>' +
    '<div class="readiness-badge ' + r.cls + '">' + r.label + '</div>' +
    '<p>Overall accuracy: <strong>' + overallAcc + '%</strong> (' + correctCount + '/' + questionCount + ') &middot; Last ' + last10.length + ': <strong>' + last10Acc + '%</strong></p>' +
    chartHtml +
    '<table class="domainT"><tr><th>Domain</th><th>Score</th><th>Accuracy</th></tr>' + domainRows + '</table>' +
    '<div style="font-weight:600; margin-bottom:4px;">Weakest topics right now:</div>' +
    '<ul class="weak">' + weakHtml + '</ul>' +
    '<p style="color:var(--muted); font-size:0.82rem;">Reference point: Security+ SY0-701 uses a scaled score out of 900, with 750 needed to pass — roughly equivalent to consistently scoring in the low-to-mid 80s% or better, with no single domain lagging badly behind.</p>' +
    '<button id="continueBtn">Continue Quiz</button>' +
    '</div>';

  document.getElementById('continueBtn').addEventListener('click', nextTurn);
}

// ==================== FEATURE 1: Focus Mode ====================

function buildDomainCheckboxes() {
  var domains = Array.from(new Set(REGULAR_QUESTIONS.map(function(q) { return q.domain; }))).sort();
  var container = document.getElementById('domainCheckboxes');
  if (!container) return;
  container.innerHTML = domains.map(function(d) {
    var checked = focusDomains.indexOf(d) !== -1 ? ' checked' : '';
    var safeId = 'dom_' + d.replace(/\W+/g, '_');
    return '<label class="domain-check">' +
      '<input type="checkbox" id="' + safeId + '" value="' + escapeAttr(d) + '"' + checked + '> ' + d + '</label>';
  }).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      focusDomains = Array.from(container.querySelectorAll('input:checked')).map(function(c) { return c.value; });
      updateFocusSummary();
    });
  });
}

function updateFocusSummary() {
  var summary = document.getElementById('focusSummary');
  if (!summary) return;
  if (focusDomains.length > 0) {
    summary.textContent = 'Focus: ' + focusDomains.length + ' domain(s) selected';
  } else {
    summary.textContent = 'Focus on specific domains (optional)';
  }
}

function updateModeIndicator() {
  var el = document.getElementById('modeIndicator');
  if (!el) return;
  el.className = 'mode-indicator';

  if (currentMode === 'review') {
    var remaining = getMissedPool().length;
    el.classList.add('review-mode');
    el.classList.remove('hidden');
    el.innerHTML =
      '<span>Reviewing missed questions &mdash; <strong>' + remaining + '</strong> remaining</span>' +
      '<button id="exitReviewBtn" class="secondary small">Exit review</button>';
    document.getElementById('exitReviewBtn').addEventListener('click', function() {
      exitCurrentMode();
    });
    return;
  }

  if (focusDomains.length > 0) {
    el.classList.add('focus-mode');
    el.classList.remove('hidden');
    var label = focusDomains.length === 1 ? focusDomains[0] : focusDomains.length + ' domains';
    el.innerHTML =
      '<span>Focus: ' + label + '</span>' +
      '<button id="exitFocusBtn" class="secondary small">All domains</button>';
    document.getElementById('exitFocusBtn').addEventListener('click', function() {
      focusDomains = [];
      // Uncheck all domain checkboxes
      document.querySelectorAll('#domainCheckboxes input').forEach(function(cb) { cb.checked = false; });
      updateFocusSummary();
      updateModeIndicator();
    });
    return;
  }

  el.classList.add('hidden');
}

// ==================== FEATURE 2: Review Missed ====================

function nextReviewQuestion() {
  var pool = getMissedPool();
  if (pool.length === 0) {
    exitCurrentMode();
    alert('All missed questions cleared! Great work.');
    return;
  }
  updateModeIndicator();
  renderRegular(pickWeighted(pool, lastQuestionId));
}

// ==================== FEATURE 3: Exam Simulation ====================

function startExamSession() {
  var qCount = parseInt(document.getElementById('examQCount').value) || 90;
  var minutes = parseInt(document.getElementById('examMinutes').value) || 90;
  var pool = getActivePool();
  if (pool.length === 0) pool = REGULAR_QUESTIONS;

  // Plain random selection (no adaptive weighting)
  var shuffled = shuffleArray(pool);
  examQuestions = shuffled.slice(0, Math.min(qCount, shuffled.length));
  examCurrentIndex = 0;
  examAnswers = [];
  examTotalTime = minutes * 60;
  examTimeLeft = examTotalTime;

  document.getElementById('start').classList.add('hidden');
  document.getElementById('quizArea').classList.remove('hidden');
  document.getElementById('statbar').classList.add('hidden'); // hide practice statbar
  document.getElementById('examBar').classList.remove('hidden');
  document.getElementById('modeIndicator').classList.add('hidden');

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
  lastQuestionId = q.id;

  var order = shuffleArray(q.choices.map(function(_, i) { return i; }));
  shuffleMap = order;
  var isMulti = q.type === 'multi';

  var choicesHtml = order.map(function(origIdx, dispIdx) {
    return '<label class="choice" data-disp="' + dispIdx + '">' +
      '<input type="' + (isMulti ? 'checkbox' : 'radio') + '" name="choice" value="' + dispIdx + '">' +
      '<span>' + String.fromCharCode(65 + dispIdx) + '. ' + q.choices[origIdx] + '</span>' +
      '</label>';
  }).join('');

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

  // Per-domain breakdown
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
    return '<tr><td>' + d + '</td><td>' + s.correct + '/' + s.total + '</td><td>' + acc + '%' + flag + '</td></tr>';
  }).join('');

  var historyHtml = '';
  if (examHistory.length > 1) {
    var histRows = examHistory.slice().reverse().slice(0, 6).map(function(h) {
      var d = new Date(h.date);
      return '<tr><td>' + d.toLocaleDateString() + '</td><td>' + h.score + '/' + h.total + '</td><td>' + h.pct + '%</td></tr>';
    }).join('');
    historyHtml = '<h3>Past Exam Attempts</h3>' +
      '<table class="domainT"><tr><th>Date</th><th>Score</th><th>Accuracy</th></tr>' + histRows + '</table>';
  }

  reportArea.innerHTML =
    '<div class="card report">' +
    '<h2>Exam Results — ' + attempt.total + ' Questions</h2>' +
    timeoutNote +
    '<div class="readiness-badge ' + r.cls + '">' + r.label + '</div>' +
    '<p>Score: <strong>' + attempt.score + '/' + attempt.total + ' (' + attempt.pct + '%)</strong></p>' +
    '<table class="domainT"><tr><th>Domain</th><th>Score</th><th>Accuracy</th></tr>' + domainRows + '</table>' +
    historyHtml +
    '<p style="color:var(--muted);font-size:0.82rem;">Reference: Security+ SY0-701 uses a scaled score of 750/900 to pass — roughly equivalent to 80%+ with no domain badly lagging.</p>' +
    '<button id="returnToMenuBtn">Return to Menu</button>' +
    '</div>';

  document.getElementById('returnToMenuBtn').addEventListener('click', exitCurrentMode);
}

// ==================== FEATURE 4: Clear Progress ====================

function confirmResetProgress() {
  if (!confirm('Reset all your progress?\n\nThis will clear your accuracy history, missed question list, adaptive weights, and exam history. This cannot be undone.')) return;
  api('/api/progress', { method: 'DELETE' })
    .then(function() {
      initFreshState();
      currentMode = 'practice';
      focusDomains = [];
      updateStartScreen();
      updateModeIndicator();
      document.getElementById('statbar').classList.add('hidden');
      alert('Progress reset. Starting fresh!');
    })
    .catch(function(e) {
      alert('Could not reset progress: ' + e.message);
    });
}

// ==================== FEATURE 5: Accuracy Chart ====================

function renderAccuracyChart(trend) {
  if (!trend || trend.length < 2) {
    return '<div class="chart-wrap"><div class="chart-title">Accuracy trend</div>' +
      '<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:16px 0 8px;">Answer more questions to see your accuracy trend.</p></div>';
  }

  var W = 560, H = 120, PL = 28, PR = 36, PT = 8, PB = 18;
  var plotW = W - PL - PR;
  var plotH = H - PT - PB;
  var minN = trend[0].n;
  var maxN = trend[trend.length - 1].n;
  var rangeN = maxN - minN || 1;

  function toX(n) { return PL + (n - minN) / rangeN * plotW; }
  function toY(acc) { return PT + (1 - acc / 100) * plotH; }

  var pts = trend.map(function(p) {
    return toX(p.n).toFixed(1) + ',' + toY(p.acc).toFixed(1);
  }).join(' ');

  var lastX = toX(trend[trend.length - 1].n);
  var firstX = toX(trend[0].n);
  var baseline = (PT + plotH).toFixed(1);
  var fillPts = pts + ' ' + lastX.toFixed(1) + ',' + baseline + ' ' + firstX.toFixed(1) + ',' + baseline;

  var y80 = toY(80).toFixed(1);
  var y75 = toY(75).toFixed(1);
  var xStart = PL, xEnd = W - PR;
  var xLabel = 'Questions ' + minN + '–' + maxN;

  return '<div class="chart-wrap"><div class="chart-title">Accuracy trend</div>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img" aria-label="Accuracy trend chart">' +
    // 80% guide
    '<line x1="' + xStart + '" y1="' + y80 + '" x2="' + xEnd + '" y2="' + y80 + '" stroke="rgba(63,185,80,0.35)" stroke-dasharray="4,3" stroke-width="1"/>' +
    '<text x="' + (xEnd + 3) + '" y="' + (parseFloat(y80) + 4) + '" fill="rgba(63,185,80,0.75)" font-size="9" font-family="system-ui,sans-serif">80%</text>' +
    // 75% guide
    '<line x1="' + xStart + '" y1="' + y75 + '" x2="' + xEnd + '" y2="' + y75 + '" stroke="rgba(210,153,34,0.35)" stroke-dasharray="4,3" stroke-width="1"/>' +
    '<text x="' + (xEnd + 3) + '" y="' + (parseFloat(y75) + 4) + '" fill="rgba(210,153,34,0.75)" font-size="9" font-family="system-ui,sans-serif">75%</text>' +
    // Fill area
    '<polygon points="' + fillPts + '" fill="rgba(88,166,255,0.07)"/>' +
    // Line
    '<polyline points="' + pts + '" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    // X-axis label
    '<text x="' + (W / 2) + '" y="' + (H - 2) + '" text-anchor="middle" fill="rgba(139,148,158,0.65)" font-size="9" font-family="system-ui,sans-serif">' + xLabel + '</text>' +
    '</svg></div>';
}

// ==================== FEATURE 6: Keyboard Shortcuts ====================

function handleKeyDown(e) {
  // Never intercept when typing in a form field or button is focused
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;

  // Only active for regular questions (not PBQ, not exam results, not report screen)
  if (currentKind !== 'regular') return;
  var quizArea = document.getElementById('quizArea');
  if (!quizArea || quizArea.classList.contains('hidden')) return;

  var submitBtn = document.getElementById('submitBtn');
  // feedbackShowing means the submit button was hidden after submission
  var feedbackShowing = submitBtn && submitBtn.classList.contains('hidden');

  if (feedbackShowing) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      var nextBtn = document.querySelector('#feedbackWrap button');
      if (nextBtn) nextBtn.click();
    }
    return;
  }

  // Number or letter key → toggle/select a choice
  var choiceIndex = -1;
  var k = e.key;
  if (k >= '1' && k <= '5') {
    choiceIndex = parseInt(k) - 1;
  } else if (k.length === 1 && k.toLowerCase() >= 'a' && k.toLowerCase() <= 'e') {
    choiceIndex = k.toLowerCase().charCodeAt(0) - 97;
  }

  if (choiceIndex >= 0) {
    var inputs = Array.from(document.querySelectorAll('.choice input'));
    if (choiceIndex < inputs.length) {
      e.preventDefault();
      var inp = inputs[choiceIndex];
      if (inp.type === 'checkbox') {
        inp.checked = !inp.checked;
      } else {
        // Radio: deselect siblings first
        inputs.forEach(function(r) { r.checked = false; });
        inp.checked = true;
      }
      inp.dispatchEvent(new Event('change'));
    }
    return;
  }

  if (e.key === 'Enter') {
    if (submitBtn && !submitBtn.disabled) {
      e.preventDefault();
      submitBtn.click();
    }
  }
}

// ==================== Auth screens ====================

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('userBar').classList.add('hidden');
}

function showAppScreen(username) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBar').classList.remove('hidden');
  document.getElementById('userLabel').textContent = 'Signed in as ' + username;

  document.getElementById('startFacts').innerHTML =
    '<li>' + REGULAR_QUESTIONS.length + ' questions across ' + new Set(REGULAR_QUESTIONS.map(function(q) { return q.topic; })).size + ' topics, spanning all 5 SY0-701 domains</li>' +
    '<li>' + PBQ_QUESTIONS.length + ' performance-based drag-and-drop questions, appearing every 20th question</li>' +
    '<li>A readiness grade after every 10 questions answered</li>' +
    '<li>Progress is saved to your account automatically after every answer</li>';

  if (questionCount > 0) {
    document.getElementById('startMsg').innerHTML =
      '<strong>Welcome back.</strong> You have ' + questionCount + ' questions answered (' +
      Math.round(100 * correctCount / Math.max(questionCount, 1)) + '% accuracy) saved to your account. Pick up where you left off.';
    renderStatbar();
  }

  buildDomainCheckboxes();
  updateStartScreen();
  updateModeIndicator();
}

function updateStartScreen() {
  document.getElementById('missedCount').textContent = missedQuestionIds.length;
  var reviewBtn = document.getElementById('modeReviewBtn');
  reviewBtn.disabled = missedQuestionIds.length === 0;

  var btn = document.getElementById('startBtn');
  if (currentMode === 'exam') btn.textContent = 'Start Exam';
  else if (currentMode === 'review') btn.textContent = 'Start Review';
  else btn.textContent = questionCount > 0 ? 'Resume Practice' : 'Start Practice';
}

// ==================== Exit / return helpers ====================

function exitCurrentMode() {
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  currentMode = 'practice';
  currentKind = null;
  document.getElementById('examBar').classList.add('hidden');
  document.getElementById('quizArea').classList.add('hidden');
  document.getElementById('reportArea').classList.add('hidden');
  document.getElementById('statbar').classList.remove('hidden');
  if (questionCount > 0) renderStatbar();
  document.getElementById('start').classList.remove('hidden');
  updateStartScreen();
  updateModeIndicator();
  // Reset mode buttons to Practice
  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('modePracticeBtn').classList.add('active');
  document.getElementById('examConfig').classList.add('hidden');
}

// ==================== Auth wiring ====================

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

  document.getElementById('logoutBtn').addEventListener('click', function() {
    api('/api/logout', { method: 'POST' }).catch(function() {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
    showAuthScreen();
  });
}

function showError(elId, msg) {
  var el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function onAuthSuccess(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
  loadProgressAndShowApp(username);
}

function loadProgressAndShowApp(username) {
  api('/api/progress').then(function(data) {
    restoreState(data.progress);
    showAppScreen(username);
  }).catch(function() {
    initFreshState();
    showAppScreen(username);
  });
}

// ==================== Boot ====================

function boot() {
  wireAuthTabs();

  // Mode selector buttons
  document.getElementById('modePracticeBtn').addEventListener('click', function() {
    currentMode = 'practice';
    document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    document.getElementById('examConfig').classList.add('hidden');
    updateStartScreen();
  });

  document.getElementById('modeReviewBtn').addEventListener('click', function() {
    if (missedQuestionIds.length === 0) return;
    currentMode = 'review';
    document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    document.getElementById('examConfig').classList.add('hidden');
    updateStartScreen();
  });

  document.getElementById('modeExamBtn').addEventListener('click', function() {
    currentMode = 'exam';
    document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    document.getElementById('examConfig').classList.remove('hidden');
    updateStartScreen();
  });

  // Start button
  document.getElementById('startBtn').addEventListener('click', function() {
    if (currentMode === 'exam') {
      startExamSession();
      return;
    }
    if (currentMode === 'review') {
      var pool = getMissedPool();
      if (pool.length === 0) {
        alert('No missed questions to review' + (focusDomains.length > 0 ? ' in the selected domains.' : '.'));
        return;
      }
    }
    document.getElementById('start').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    updateModeIndicator();
    nextTurn();
  });

  // Clear focus button
  document.getElementById('clearFocusBtn').addEventListener('click', function() {
    focusDomains = [];
    document.querySelectorAll('#domainCheckboxes input').forEach(function(cb) { cb.checked = false; });
    updateFocusSummary();
    updateModeIndicator();
  });

  // Exit exam button
  document.getElementById('exitExamBtn').addEventListener('click', function() {
    if (!confirm('Exit the exam? Your current answers will be scored up to this point.')) return;
    finishExam('abandoned');
  });

  // Reset progress button
  document.getElementById('resetBtn').addEventListener('click', confirmResetProgress);

  // Keyboard shortcut handler
  document.addEventListener('keydown', handleKeyDown);

  // Load questions then check session
  api('/api/questions').then(function(data) {
    REGULAR_QUESTIONS = data.regular || [];
    PBQ_QUESTIONS = data.pbq || [];
    initFreshState();

    var token = getToken();
    var username = localStorage.getItem(USERNAME_KEY);
    if (token && username) {
      loadProgressAndShowApp(username);
    } else {
      showAuthScreen();
    }
  }).catch(function(e) {
    document.body.innerHTML = '<div style="padding:40px;color:#f85149;font-family:sans-serif;">Could not load question bank: ' + e.message + '</div>';
  });
}

document.addEventListener('DOMContentLoaded', boot);
