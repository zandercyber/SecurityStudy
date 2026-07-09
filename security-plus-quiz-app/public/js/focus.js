// ===== Focus Mode page boot =====

function escapeAttrLocal(s) { return String(s).replace(/"/g, '&quot;'); }

function buildDomainCheckboxes() {
  var domains = Array.from(new Set(REGULAR_QUESTIONS.map(function(q) { return q.domain; }))).sort();
  var container = document.getElementById('domainCheckboxes');
  container.innerHTML = domains.map(function(d) {
    var checked = focusDomains.indexOf(d) !== -1 ? ' checked' : '';
    var safeId = 'dom_' + d.replace(/\W+/g, '_');
    return '<label class="domain-check">' +
      '<input type="checkbox" id="' + safeId + '" value="' + escapeAttrLocal(d) + '"' + checked + '> ' + d + '</label>';
  }).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      focusDomains = Array.from(container.querySelectorAll('input:checked')).map(function(c) { return c.value; });
    });
  });
}

function updateModeIndicator() {
  var el = document.getElementById('modeIndicator');
  el.className = 'mode-indicator';
  if (focusDomains.length === 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.add('focus-mode');
  el.classList.remove('hidden');
  var label = focusDomains.length === 1 ? focusDomains[0] : focusDomains.length + ' domains';
  el.innerHTML =
    '<span>Focus: ' + label + '</span>' +
    '<button id="exitFocusBtn" class="secondary small">Change domains</button>';
  document.getElementById('exitFocusBtn').addEventListener('click', exitToPicker);
}

function exitToPicker() {
  document.getElementById('quizArea').classList.add('hidden');
  document.getElementById('reportArea').classList.add('hidden');
  document.getElementById('modeIndicator').classList.add('hidden');
  document.getElementById('start').classList.remove('hidden');
}

function boot() {
  renderSidebar('focus');
  enableKeyboardShortcuts();

  currentMode = 'practice';
  focusDomains = [];

  Promise.all([loadQuestions(), loadProgress()]).then(function() {
    buildDomainCheckboxes();
    if (questionCount > 0) renderStatbar();
  });

  document.getElementById('startBtn').addEventListener('click', function() {
    document.getElementById('start').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    updateModeIndicator();
    nextTurn();
  });
}

window.onAuthReady(boot);
