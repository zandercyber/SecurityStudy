// ===== Flashcards page boot =====

var deckOrder = [];   // array of card ids in play order
var deckIndex = 0;
var isFlipped = false;
var shuffleOn = false;
var stillLearningOnly = false;

function cardById(id) {
  return FLASHCARDS.find(function(c) { return c.id === id; });
}

function statsFor(id) {
  return flashcardStats[id] || { gotIt: 0, stillLearning: 0 };
}

function buildDeck() {
  var pool = FLASHCARDS.slice();
  if (stillLearningOnly) {
    pool = pool.filter(function(c) {
      var s = statsFor(c.id);
      return s.stillLearning > s.gotIt;
    });
  }
  var ids = pool.map(function(c) { return c.id; });
  if (shuffleOn) ids = shuffleArray(ids);
  deckOrder = ids;
  deckIndex = 0;
  isFlipped = false;
}

function currentCard() {
  if (deckOrder.length === 0) return null;
  return cardById(deckOrder[deckIndex]);
}

function escapeHtmlLocal(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function renderCard() {
  var wrap = document.getElementById('flashcardArea');
  var markButtons = document.getElementById('markButtons');
  var card = currentCard();

  if (!card) {
    wrap.innerHTML = '<div class="empty-state">No cards match this filter right now. Turn off "Still learning only" to see the full deck.</div>';
    markButtons.classList.add('hidden');
    return;
  }

  var s = statsFor(card.id);
  wrap.innerHTML =
    '<div class="flashcard-counter">' + (deckIndex + 1) + ' / ' + deckOrder.length + '</div>' +
    '<div id="flashcard" class="flashcard' + (isFlipped ? ' flipped' : '') + '" tabindex="0">' +
      '<div class="flashcard-inner">' +
        '<div class="flashcard-face flashcard-front">' + escapeHtmlLocal(card.term) + '</div>' +
        '<div class="flashcard-face flashcard-back">' + escapeHtmlLocal(card.definition) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="flashcard-hint">Click the card or press Space to flip</div>' +
    '<div class="flashcard-progress-note">Got it ' + s.gotIt + ' &middot; Still learning ' + s.stillLearning + '</div>';

  document.getElementById('flashcard').addEventListener('click', flipCard);
  markButtons.classList.toggle('hidden', !isFlipped);
}

function flipCard() {
  if (!currentCard()) return;
  isFlipped = !isFlipped;
  renderCard();
}

function goNext() {
  if (deckOrder.length === 0) return;
  deckIndex = (deckIndex + 1) % deckOrder.length;
  isFlipped = false;
  renderCard();
}

function goPrev() {
  if (deckOrder.length === 0) return;
  deckIndex = (deckIndex - 1 + deckOrder.length) % deckOrder.length;
  isFlipped = false;
  renderCard();
}

function markCard(kind) {
  var card = currentCard();
  if (!card || !isFlipped) return;
  if (!flashcardStats[card.id]) flashcardStats[card.id] = { gotIt: 0, stillLearning: 0 };
  flashcardStats[card.id][kind]++;
  saveProgress();
  goNext();
}

function handleFlashcardKeys(e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;

  if (e.key === ' ') {
    e.preventDefault();
    flipCard();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    goNext();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    goPrev();
  } else if (e.key === '1' && isFlipped) {
    e.preventDefault();
    markCard('gotIt');
  } else if (e.key === '2' && isFlipped) {
    e.preventDefault();
    markCard('stillLearning');
  }
}

function boot() {
  if (!requireAuth()) return;
  renderSidebar('flashcards');

  Promise.all([loadQuestions(), loadFlashcards(), loadProgress()]).then(function() {
    buildDeck();
    renderCard();
  });

  document.getElementById('nextBtn').addEventListener('click', goNext);
  document.getElementById('prevBtn').addEventListener('click', goPrev);
  document.getElementById('gotItBtn').addEventListener('click', function() { markCard('gotIt'); });
  document.getElementById('stillLearningBtn').addEventListener('click', function() { markCard('stillLearning'); });

  document.getElementById('shuffleToggle').addEventListener('change', function(e) {
    shuffleOn = e.target.checked;
    buildDeck();
    renderCard();
  });

  document.getElementById('stillLearningToggle').addEventListener('change', function(e) {
    stillLearningOnly = e.target.checked;
    buildDeck();
    renderCard();
  });

  document.addEventListener('keydown', handleFlashcardKeys);
}

document.addEventListener('DOMContentLoaded', boot);
