// ===== Shared quiz state + persistence — loaded on practice/focus/review/exam/stats pages =====

var REGULAR_QUESTIONS = [];
var PBQ_QUESTIONS = [];
var FLASHCARDS = [];

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
var recentQuestionIds = []; // FIFO of the last RECENT_HISTORY_SIZE question IDs served (regular + PBQ), per user
var current = null;
var currentKind = null;
var shuffleMap = null;
var slotAssignments = {};
var selectedTerm = null;
var strikeSet = {}; // { [dispIdx]: true } - ephemeral process-of-elimination state, per-question, never persisted

// ---- Flashcard self-assessment (persisted to server, separate from adaptive quiz scoring) ----
var flashcardStats = {}; // { [cardId]: { gotIt, stillLearning } }

var missedQuestionIds = []; // IDs of questions ever answered wrong in practice/focus/review
var examHistory = [];       // [{date, score, total, pct, domainBreakdown}]

// ---- Session-only state (not persisted) ----
var focusDomains = [];       // [] = all domains; non-empty = active focus filter
var currentMode = 'practice'; // 'practice' | 'review' | 'exam'

// ---------------- Questions ----------------
function loadQuestions() {
  return api('/api/questions').then(function(data) {
    REGULAR_QUESTIONS = data.regular || [];
    PBQ_QUESTIONS = data.pbq || [];
  });
}

function loadFlashcards() {
  return api('/api/flashcards').then(function(data) {
    FLASHCARDS = data || [];
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
  recentQuestionIds = [];
  missedQuestionIds = [];
  examHistory = [];
  flashcardStats = {};

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
  recentQuestionIds = saved.recentQuestionIds || [];
  missedQuestionIds = saved.missedQuestionIds || [];
  examHistory = saved.examHistory || [];
  flashcardStats = saved.flashcardStats || {};
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
    recentQuestionIds: recentQuestionIds.slice(-RECENT_HISTORY_SIZE),
    missedQuestionIds: missedQuestionIds,
    examHistory: examHistory,
    flashcardStats: flashcardStats
  };
}

function saveProgress() {
  api('/api/progress', { method: 'POST', body: snapshotState() }).catch(function(e) {
    console.warn('Could not save progress:', e.message);
  });
}

function loadProgress() {
  return api('/api/progress').then(function(data) {
    restoreState(data.progress);
  }).catch(function() {
    initFreshState();
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

// ---------------- Weighted selection ----------------
var RECENT_HISTORY_SIZE = 18; // rolling window of recently-served question IDs (regular + PBQ), per user
var MIN_CANDIDATE_POOL = 3;   // if an exclusion step would leave fewer candidates than this, relax it instead

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Records that a question was just served, for the recency-exclusion window in pickWeighted.
function recordRecentQuestion(id) {
  if (id == null) return;
  var idx = recentQuestionIds.indexOf(id);
  if (idx !== -1) recentQuestionIds.splice(idx, 1);
  recentQuestionIds.push(id);
  if (recentQuestionIds.length > RECENT_HISTORY_SIZE) {
    recentQuestionIds.splice(0, recentQuestionIds.length - RECENT_HISTORY_SIZE);
  }
}

function findQuestionById(id) {
  for (var i = 0; i < REGULAR_QUESTIONS.length; i++) {
    if (REGULAR_QUESTIONS[i].id === id) return REGULAR_QUESTIONS[i];
  }
  for (var j = 0; j < PBQ_QUESTIONS.length; j++) {
    if (PBQ_QUESTIONS[j].id === id) return PBQ_QUESTIONS[j];
  }
  return null;
}

function weightedDraw(pool, lastId) {
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

// Picks the next question from `pool` using the existing topic-weight random draw, but first
// excludes anything served too recently so the same question/topic can't resurface a few
// questions later. Exclusion is relaxed (topic-level first, then question-ID level) whenever
// a narrow pool (e.g. Focus Mode with 1-2 topics) would otherwise leave too few candidates.
function pickWeighted(pool, lastId) {
  var idExcluded = pool.filter(function(q) {
    return recentQuestionIds.indexOf(q.id) === -1;
  });

  var recentTopics = {};
  recentQuestionIds.forEach(function(id) {
    var rq = findQuestionById(id);
    if (rq) recentTopics[rq.topic] = true;
  });
  var topicAndIdExcluded = idExcluded.filter(function(q) {
    return !recentTopics[q.topic];
  });

  var candidates;
  if (topicAndIdExcluded.length >= MIN_CANDIDATE_POOL) {
    candidates = topicAndIdExcluded;       // strictest: no recent question, no recent topic
  } else if (idExcluded.length >= MIN_CANDIDATE_POOL) {
    candidates = idExcluded;               // relax topic exclusion, keep question-ID exclusion
  } else {
    candidates = pool;                     // relax everything (e.g. narrow Focus Mode pool)
  }

  return weightedDraw(candidates, lastId);
}

// ---------------- Shared scoring ----------------
function recordAnswer(isCorrect) {
  questionCount++;
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
      // Only touch adaptive weights/streaks in practice/focus mode
      streaks[current.topic] = (streaks[current.topic] || 0) + 1;
      if (streaks[current.topic] >= 2) {
        weights[current.topic] = Math.max((weights[current.topic] || 1) / 2, 1);
      }
    }
    if (currentMode === 'review') {
      var removeIdx = missedQuestionIds.indexOf(current.id);
      if (removeIdx !== -1) missedQuestionIds.splice(removeIdx, 1);
      if (typeof updateModeIndicator === 'function') updateModeIndicator();
    }
  } else {
    currentStreak = 0;
    if (currentMode !== 'review') {
      streaks[current.topic] = 0;
      weights[current.topic] = Math.min((weights[current.topic] || 1) * 2.5, 15);
    }
    if (currentKind === 'regular' && missedQuestionIds.indexOf(current.id) === -1) {
      missedQuestionIds.push(current.id);
    }
  }

  answerHistory.push({ topic: current.topic, domain: current.domain, correct: isCorrect });
  if (typeof renderStatbar === 'function') renderStatbar();
  saveProgress();
}

// ---------------- Shared regular-choice rendering (practice/focus/review/exam) ----------------
// Process-of-elimination strikethrough is a scratch-pad aid only: never persisted, reset per question.
function buildChoicesHtml(q, order, isMulti) {
  return order.map(function(origIdx, dispIdx) {
    return '<label class="choice" data-disp="' + dispIdx + '">' +
      '<input type="' + (isMulti ? 'checkbox' : 'radio') + '" name="choice" value="' + dispIdx + '">' +
      '<span class="choice-text">' + String.fromCharCode(65 + dispIdx) + '. ' + q.choices[origIdx] + '</span>' +
      '<button type="button" class="strike-btn" data-strike-disp="' + dispIdx + '" ' +
      'title="Cross out this choice" aria-label="Cross out this choice" aria-pressed="false">&#10005;</button>' +
      '</label>';
  }).join('');
}

function resetStrikeState() {
  strikeSet = {};
}

function toggleStrike(dispIdx) {
  var label = document.querySelector('.choice[data-disp="' + dispIdx + '"]');
  if (!label) return;
  var isStruck = !strikeSet[dispIdx];
  if (isStruck) strikeSet[dispIdx] = true;
  else delete strikeSet[dispIdx];
  label.classList.toggle('struck', isStruck);
  var btn = label.querySelector('.strike-btn');
  if (btn) {
    btn.classList.toggle('active', isStruck);
    btn.setAttribute('aria-pressed', isStruck ? 'true' : 'false');
  }
}

function attachStrikeHandlers() {
  document.querySelectorAll('.strike-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleStrike(parseInt(btn.dataset.strikeDisp, 10));
    });
  });
}
