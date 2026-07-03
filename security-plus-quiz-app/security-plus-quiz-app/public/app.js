// ===== Security+ Adaptive Quiz - frontend app =====

var TOKEN_KEY = 'spq_token';
var USERNAME_KEY = 'spq_username';

var REGULAR_QUESTIONS = [];
var PBQ_QUESTIONS = [];

// ---- Quiz state (persisted to server) ----
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
var current = null;      // currently displayed question object
var currentKind = null;  // 'regular' or 'pbq'
var shuffleMap = null;   // for regular questions: displayIndex -> originalIndex
var slotAssignments = {}; // for pbq: defIndex -> term (or null)
var selectedTerm = null;  // for click-to-place fallback

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
  }).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    });
  });
}

// ---------------- Init state ----------------
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

  REGULAR_QUESTIONS.concat(PBQ_QUESTIONS).forEach(function (q) {
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
}

function snapshotState() {
  return {
    weights: weights, streaks: streaks, topicStats: topicStats, domainStats: domainStats,
    answerHistory: answerHistory.slice(-200), questionCount: questionCount, correctCount: correctCount,
    currentStreak: currentStreak, lastQuestionId: lastQuestionId, lastPbqId: lastPbqId
  };
}

function saveProgress() {
  api('/api/progress', { method: 'POST', body: snapshotState() }).catch(function (e) {
    console.warn('Could not save progress:', e.message);
  });
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
  var withWeights = pool.map(function (q) {
    var w = weights[q.topic] || 1;
    if (q.id === lastId) w *= 0.15;
    return { q: q, w: w };
  });
  var total = withWeights.reduce(function (s, p) { return s + p.w; }, 0);
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

  var order = shuffleArray(q.choices.map(function (_, i) { return i; }));
  shuffleMap = order; // displayIndex -> originalIndex
  var isMulti = q.type === 'multi';

  var choicesHtml = order.map(function (origIdx, dispIdx) {
    return '<label class="choice" data-disp="' + dispIdx + '">' +
      '<input type="' + (isMulti ? 'checkbox' : 'radio') + '" name="choice" value="' + dispIdx + '">' +
      '<span>' + String.fromCharCode(65 + dispIdx) + '. ' + q.choices[origIdx] + '</span>' +
      '</label>';
  }).join('');

  var area = document.getElementById('quizArea');
  area.innerHTML =
    '<div class="card">' +
    '<div class="domain-chip">' + q.domain + '</div>' +
    '<div class="qtext">' + q.q + '</div>' +
    '<div id="choicesWrap">' + choicesHtml + '</div>' +
    '<button id="submitBtn" disabled>Submit Answer</button>' +
    '<div id="feedbackWrap"></div>' +
    '</div>';

  document.querySelectorAll('.choice input').forEach(function (inp) {
    inp.addEventListener('change', function () {
      document.getElementById('submitBtn').disabled = false;
    });
  });
  document.getElementById('submitBtn').addEventListener('click', submitRegularAnswer);
}

function submitRegularAnswer() {
  var inputs = Array.from(document.querySelectorAll('.choice input'));
  var selectedDisp = inputs.filter(function (i) { return i.checked; }).map(function (i) { return parseInt(i.value); });
  inputs.forEach(function (i) { i.disabled = true; });

  var selectedOrig = selectedDisp.map(function (d) { return shuffleMap[d]; });
  var correctSet = Array.isArray(current.correct) ? current.correct : [current.correct];
  var isCorrect = selectedOrig.length === correctSet.length && selectedOrig.every(function (s) { return correctSet.includes(s); });

  document.querySelectorAll('.choice').forEach(function (label) {
    var dispIdx = parseInt(label.dataset.disp);
    var origIdx = shuffleMap[dispIdx];
    label.classList.add('disabled');
    if (correctSet.includes(origIdx)) label.classList.add('correct');
    else if (selectedOrig.includes(origIdx)) label.classList.add('incorrect');
  });

  recordAnswer(isCorrect);

  var fb = document.getElementById('feedbackWrap');
  fb.innerHTML =
    '<div class="feedback ' + (isCorrect ? 'good' : 'bad') + '">' +
    '<div class="verdict ' + (isCorrect ? 'good' : 'bad') + '">' + (isCorrect ? 'Correct' : 'Incorrect') + '</div>' +
    '<div>' + current.exp + '</div>' +
    '<div class="topic-tag">Topic: ' + current.topic + ' &middot; now weighted ' + weights[current.topic].toFixed(1) + 'x baseline</div>' +
    '</div>';
  document.getElementById('submitBtn').classList.add('hidden');
  appendNextButton(fb);
}

// ---------------- Rendering: performance-based (matching) questions ----------------
function renderPBQ(q) {
  current = q;
  currentKind = 'pbq';
  lastPbqId = q.id;
  slotAssignments = {};
  selectedTerm = null;

  var shuffledPairs = q.pairs.map(function (p, i) { return { term: p[0], def: p[1], idx: i }; });
  var shuffledTerms = shuffleArray(shuffledPairs.map(function (p) { return p.term; }));

  var termsHtml = shuffledTerms.map(function (term) {
    return '<div class="term-chip" draggable="true" data-term="' + escapeAttr(term) + '">' + term + '</div>';
  }).join('');

  var slotsHtml = shuffledPairs.map(function (p) {
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
    var filled = Object.keys(slotAssignments).filter(function (k) { return slotAssignments[k]; }).length;
    document.getElementById('submitBtn').disabled = filled < total;
  }

  function clearSelection() {
    document.querySelectorAll('.term-chip.selected').forEach(function (c) { c.classList.remove('selected'); });
    selectedTerm = null;
  }

  function placeTermInSlot(term, slotEl) {
    var idx = slotEl.dataset.idx;
    // if this slot already had a term, return it to the pool
    if (slotAssignments[idx]) {
      returnTermToPool(slotAssignments[idx]);
    }
    // if term is currently in another slot, clear that slot first
    document.querySelectorAll('.slot-drop').forEach(function (s) {
      if (slotAssignments[s.dataset.idx] === term) {
        slotAssignments[s.dataset.idx] = null;
        s.textContent = 'Drop term here';
        s.classList.remove('filled');
      }
    });
    // remove chip from pool if present
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

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function wireChip(chip) {
    chip.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', chip.dataset.term);
    });
    chip.addEventListener('click', function () {
      document.querySelectorAll('.term-chip.selected').forEach(function (c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      selectedTerm = chip.dataset.term;
    });
  }

  pool.querySelectorAll('.term-chip').forEach(wireChip);

  slots.forEach(function (slot) {
    slot.addEventListener('dragover', function (e) {
      e.preventDefault();
      slot.classList.add('over');
    });
    slot.addEventListener('dragleave', function () { slot.classList.remove('over'); });
    slot.addEventListener('drop', function (e) {
      e.preventDefault();
      slot.classList.remove('over');
      var term = e.dataTransfer.getData('text/plain');
      if (term) placeTermInSlot(term, slot);
    });
    slot.addEventListener('click', function () {
      var idx = slot.dataset.idx;
      if (slotAssignments[idx]) {
        // clicking a filled slot returns its term to the pool
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
  slots.forEach(function (slot) {
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
  document.querySelectorAll('.term-chip').forEach(function (c) { c.style.pointerEvents = 'none'; });

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
  topicStats[current.topic].total++;
  domainStats[current.domain].total++;
  if (isCorrect) {
    correctCount++;
    currentStreak++;
    topicStats[current.topic].correct++;
    domainStats[current.domain].correct++;
    streaks[current.topic]++;
    if (streaks[current.topic] >= 2) {
      weights[current.topic] = Math.max(weights[current.topic] / 2, 1);
    }
  } else {
    currentStreak = 0;
    streaks[current.topic] = 0;
    weights[current.topic] = Math.min((weights[current.topic] || 1) * 2.5, 15);
  }
  answerHistory.push({ topic: current.topic, domain: current.domain, correct: isCorrect });
  renderStatbar();
  saveProgress();
}

function appendNextButton(fb) {
  var btn = document.createElement('button');
  btn.textContent = (questionCount % 10 === 0) ? 'See Readiness Report' : 'Next Question';
  btn.addEventListener('click', function () {
    if (questionCount % 10 === 0) showReport();
    else nextTurn();
  });
  fb.appendChild(btn);
}

function nextTurn() {
  document.getElementById('reportArea').classList.add('hidden');
  document.getElementById('quizArea').classList.remove('hidden');
  var isPbqTurn = PBQ_QUESTIONS.length > 0 && (questionCount + 1) % 20 === 0;
  if (isPbqTurn) {
    renderPBQ(pickWeighted(PBQ_QUESTIONS, lastPbqId));
  } else {
    renderRegular(pickWeighted(REGULAR_QUESTIONS, lastQuestionId));
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

function showReport() {
  document.getElementById('quizArea').classList.add('hidden');
  var reportArea = document.getElementById('reportArea');
  reportArea.classList.remove('hidden');

  var last10 = answerHistory.slice(-10);
  var last10Correct = last10.filter(function (h) { return h.correct; }).length;
  var overallAcc = Math.round(100 * correctCount / questionCount);
  var last10Acc = Math.round(100 * last10Correct / 10);
  var r = readinessLabel(overallAcc);

  var domainRows = Object.keys(domainStats).sort().map(function (d) {
    var s = domainStats[d];
    var acc = s.total ? Math.round(100 * s.correct / s.total) : 0;
    var flag = s.total > 0 && acc < 70 ? ' ⚠️' : '';
    return '<tr><td>' + d + '</td><td>' + s.correct + '/' + s.total + '</td><td>' + (s.total ? acc + '%' : '--') + flag + '</td></tr>';
  }).join('');

  var weakList = Object.keys(topicStats)
    .filter(function (t) { return topicStats[t].total > 0; })
    .map(function (t) { return { topic: t, correct: topicStats[t].correct, total: topicStats[t].total, acc: topicStats[t].correct / topicStats[t].total }; })
    .sort(function (a, b) { return a.acc - b.acc; })
    .slice(0, 5)
    .filter(function (t) { return t.acc < 1; })
    .map(function (t) { return '<li>' + t.topic + ' — ' + t.correct + '/' + t.total + ' correct (' + Math.round(t.acc * 100) + '%)</li>'; })
    .join('');
  var weakHtml = weakList || '<li>No consistently weak topics right now — nice work.</li>';

  reportArea.innerHTML =
    '<div class="card report">' +
    '<h2>Readiness Report — after ' + questionCount + ' questions</h2>' +
    '<div class="readiness-badge ' + r.cls + '">' + r.label + '</div>' +
    '<p>Overall accuracy: <strong>' + overallAcc + '%</strong> (' + correctCount + '/' + questionCount + ') &middot; Last 10: <strong>' + last10Acc + '%</strong></p>' +
    '<table class="domainT"><tr><th>Domain</th><th>Score</th><th>Accuracy</th></tr>' + domainRows + '</table>' +
    '<div style="font-weight:600; margin-bottom:4px;">Weakest topics right now:</div>' +
    '<ul class="weak">' + weakHtml + '</ul>' +
    '<p style="color:var(--muted); font-size:0.82rem;">Reference point: Security+ SY0-701 uses a scaled score out of 900, with 750 needed to pass — roughly equivalent to consistently scoring in the low-to-mid 80s% or better, with no single domain lagging badly behind.</p>' +
    '<button id="continueBtn">Continue Quiz</button>' +
    '</div>';
  document.getElementById('continueBtn').addEventListener('click', nextTurn);
}

// ---------------- Auth screens ----------------
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
    '<li>' + REGULAR_QUESTIONS.length + ' questions across ' + new Set(REGULAR_QUESTIONS.map(function (q) { return q.topic; })).size + ' topics, spanning all 5 SY0-701 domains</li>' +
    '<li>' + PBQ_QUESTIONS.length + ' performance-based drag-and-drop questions, appearing every 20th question</li>' +
    '<li>A readiness grade after every 10 questions answered</li>' +
    '<li>Progress is saved to your account automatically after every answer</li>';

  if (questionCount > 0) {
    document.getElementById('startMsg').innerHTML =
      '<strong>Welcome back.</strong> You have ' + questionCount + ' questions answered (' +
      Math.round(100 * correctCount / Math.max(questionCount, 1)) + '% accuracy) saved to your account. Pick up where you left off.';
    renderStatbar();
  }
}

function wireAuthTabs() {
  document.getElementById('tabLogin').addEventListener('click', function () {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
  });
  document.getElementById('tabRegister').addEventListener('click', function () {
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
  });

  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var username = document.getElementById('loginUsername').value;
    var password = document.getElementById('loginPassword').value;
    api('/api/login', { method: 'POST', body: { username: username, password: password } })
      .then(function (data) { onAuthSuccess(data.token, data.username); })
      .catch(function (err) { showError('loginError', err.message); });
  });

  document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var username = document.getElementById('regUsername').value;
    var password = document.getElementById('regPassword').value;
    api('/api/register', { method: 'POST', body: { username: username, password: password } })
      .then(function (data) { onAuthSuccess(data.token, data.username); })
      .catch(function (err) { showError('registerError', err.message); });
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    api('/api/logout', { method: 'POST' }).catch(function () {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
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
  api('/api/progress').then(function (data) {
    restoreState(data.progress);
    showAppScreen(username);
  }).catch(function () {
    initFreshState();
    showAppScreen(username);
  });
}

// ---------------- Boot ----------------
function boot() {
  wireAuthTabs();

  document.getElementById('startBtn').addEventListener('click', function () {
    document.getElementById('start').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    nextTurn();
  });

  api('/api/questions').then(function (data) {
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
  }).catch(function (e) {
    document.body.innerHTML = '<div style="padding:40px;color:#f85149;font-family:sans-serif;">Could not load question bank: ' + e.message + '</div>';
  });
}

document.addEventListener('DOMContentLoaded', boot);
