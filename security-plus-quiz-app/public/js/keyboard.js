// ===== Keyboard shortcuts for regular (non-PBQ) questions =====
// Active on practice/focus/review/exam pages. Never intercepts form input.

function handleKeyDown(e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;

  if (currentKind !== 'regular') return;
  var quizArea = document.getElementById('quizArea');
  if (!quizArea || quizArea.classList.contains('hidden')) return;

  var submitBtn = document.getElementById('submitBtn');
  var feedbackShowing = submitBtn && submitBtn.classList.contains('hidden');

  if (feedbackShowing) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      var nextBtn = document.querySelector('#feedbackWrap button');
      if (nextBtn) nextBtn.click();
    }
    return;
  }

  if (e.shiftKey) {
    var digitMatch = /^Digit([1-9])$/.exec(e.code);
    if (digitMatch) {
      var strikeIdx = parseInt(digitMatch[1], 10) - 1;
      var choiceLabels = document.querySelectorAll('.choice');
      if (strikeIdx < choiceLabels.length) {
        e.preventDefault();
        toggleStrike(strikeIdx);
      }
    }
    return;
  }

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

function enableKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyDown);
}
