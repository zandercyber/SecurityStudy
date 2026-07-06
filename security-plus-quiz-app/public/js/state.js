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
var current = null;
var currentKind = null;
var shuffleMap = null;
var slotAssignments = {};
var selectedTerm = null;

// ---- Flashcard self-assessment (persisted to server, separate from adaptive quiz scoring) ----
var flashcardStats = {}; // { [cardId]: { gotIt, stillLearning } }

var missedQuestionIds = []; // IDs of questions ever answered wrong in practice/focus/review
var accuracyTrend = [];     // [{n, acc}] rolling accuracy snapshots, capped to ~200 points
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
  missedQuestionIds = [];
  accuracyTrend = [];
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
  missedQuestionIds = saved.missedQuestionIds || [];
  accuracyTrend = saved.accuracyTrend || [];
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
    missedQuestionIds: missedQuestionIds,
    accuracyTrend: accuracyTrend,
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
  updateAccuracyTrend();
  if (typeof renderStatbar === 'function') renderStatbar();
  saveProgress();
}
