// ===== Performance-based (drag-and-drop matching) question rendering =====
// Used by practice.html and focus.html (PBQs appear every 20th adaptive question).

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

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
