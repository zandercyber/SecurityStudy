// ===== Persistent sidebar nav — loaded on every page =====
// Renders into <nav id="sidebar"></nav>, which every page includes in its shell.

var SIDEBAR_LINKS = [
  ['index.html', 'home', 'Home'],
  ['practice.html', 'practice', 'Practice'],
  ['focus.html', 'focus', 'Focus Mode'],
  ['review.html', 'review', 'Review Missed'],
  ['exam.html', 'exam', 'Exam Simulation'],
  ['stats.html', 'stats', 'Stats']
];

function renderSidebar(activePage) {
  var el = document.getElementById('sidebar');
  if (!el) return;

  var loggedIn = isLoggedIn();

  var navHtml = SIDEBAR_LINKS.map(function(link) {
    var active = link[1] === activePage ? ' active' : '';
    return '<li><a class="nav-link' + active + '" href="' + link[0] + '">' + link[2] + '</a></li>';
  }).join('');

  var footerHtml = loggedIn
    ? '<div class="sidebar-username">' + escapeHtml(getUsername()) + '</div>' +
      '<button id="sidebarLogoutBtn" class="sidebar-logout">Log out</button>'
    : '<a class="sidebar-login-link" href="index.html">Log in</a>';

  el.innerHTML =
    '<div class="sidebar-brand"><span class="brand-mark">&#9635;</span><span class="brand-name">SEC+ OPS</span></div>' +
    '<ul class="sidebar-nav">' + navHtml + '</ul>' +
    '<div class="sidebar-footer">' + footerHtml + '</div>';

  var logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutAndRedirect);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
