// ===== Accuracy trend chart (inline SVG) =====
// Used by the readiness report, the Stats page, and the Home dashboard preview.
//
// Renders a rolling-window accuracy trend (not lifetime cumulative accuracy) so
// recent improvement/decline is actually visible instead of flattening out as
// more questions accumulate. The y-axis auto-fits the data range instead of a
// fixed 0-100 scale, so real swings aren't squashed into a thin band.

function renderAccuracyChart(answerHistory, opts) {
  opts = opts || {};
  var title = opts.title !== undefined ? opts.title : 'Accuracy trend';
  var windowSize = opts.window || 10;

  if (!answerHistory || answerHistory.length < 2) {
    return '<div class="chart-wrap"><div class="chart-title">' + title + '</div>' +
      '<p class="chart-empty">Answer more questions to see your accuracy trend.</p></div>';
  }

  // Rolling accuracy: each point averages the trailing `windowSize` answers
  // (expanding to whatever's available for the first few points).
  var pts = [];
  for (var i = 0; i < answerHistory.length; i++) {
    var start = Math.max(0, i - windowSize + 1);
    var correct = 0, total = i - start + 1;
    for (var j = start; j <= i; j++) { if (answerHistory[j].correct) correct++; }
    pts.push({ n: i + 1, acc: Math.round(100 * correct / total) });
  }

  var W = opts.width || 480, H = opts.height || 96;
  var PL = 30, PR = 8, PT = 10, PB = 6;
  var plotW = W - PL - PR;
  var plotH = H - PT - PB;

  var minN = pts[0].n, maxN = pts[pts.length - 1].n;
  var rangeN = (maxN - minN) || 1;

  // Auto-fit the y-axis to the data (padded, snapped to 5%) instead of a fixed
  // 0-100 range, so real accuracy swings are visible rather than compressed.
  // Fit against the stabilized (full-window) points only: the first few points
  // use a small expanding window and can swing to 0%/100% on a single answer,
  // which would otherwise force the whole chart back to the full scale.
  var stablePts = pts.filter(function(p) { return p.n >= windowSize; });
  var fitPts = stablePts.length >= 2 ? stablePts : pts;
  var accs = fitPts.map(function(p) { return p.acc; });
  var dataMin = Math.min.apply(null, accs);
  var dataMax = Math.max.apply(null, accs);
  var pad = Math.max(4, Math.round((dataMax - dataMin) * 0.2));
  var yMin = Math.max(0, Math.floor((dataMin - pad) / 5) * 5);
  var yMax = Math.min(100, Math.ceil((dataMax + pad) / 5) * 5);
  if (yMax - yMin < 10) {
    yMax = Math.min(100, yMin + 10);
    yMin = Math.max(0, yMax - 10);
  }
  var rangeY = (yMax - yMin) || 1;

  function toX(n) { return PL + (n - minN) / rangeN * plotW; }
  function toY(acc) {
    // Clamp: early low-sample points can fall outside the fitted range (see
    // stablePts above) — pin them to the plot edge instead of drawing off-canvas.
    var y = PT + (1 - (acc - yMin) / rangeY) * plotH;
    return Math.max(PT, Math.min(PT + plotH, y));
  }

  var linePts = pts.map(function(p) {
    return toX(p.n).toFixed(1) + ',' + toY(p.acc).toFixed(1);
  }).join(' ');

  var lastX = toX(pts[pts.length - 1].n);
  var firstX = toX(pts[0].n);
  var baseline = (PT + plotH).toFixed(1);
  var fillPts = linePts + ' ' + lastX.toFixed(1) + ',' + baseline + ' ' + firstX.toFixed(1) + ',' + baseline;

  // Gridlines at the bottom/mid/top of the fitted range, with value labels.
  var gridLines = [yMin, (yMin + yMax) / 2, yMax].map(function(v) {
    var y = toY(v).toFixed(1);
    return '<line x1="' + PL + '" y1="' + y + '" x2="' + (W - PR) + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"/>' +
      '<text x="' + (PL - 5) + '" y="' + (parseFloat(y) + 3) + '" text-anchor="end" fill="var(--muted)" font-size="8" font-family="var(--font-mono)">' + Math.round(v) + '%</text>';
  }).join('');

  // Exam-readiness reference line, shown only when it's within the visible range.
  var refLine = '';
  if (75 > yMin && 75 < yMax) {
    var y75 = toY(75).toFixed(1);
    refLine = '<line x1="' + PL + '" y1="' + y75 + '" x2="' + (W - PR) + '" y2="' + y75 + '" stroke="var(--warn)" stroke-opacity="0.5" stroke-dasharray="3,3" stroke-width="1"/>';
  }

  // Point markers double as accessible hover tooltips (native <title>), thinned
  // out on long histories so the chart doesn't turn into a solid row of dots.
  var markerStep = Math.max(1, Math.ceil(pts.length / 30));
  var markers = pts.filter(function(p, idx) {
    return idx % markerStep === 0 || idx === pts.length - 1;
  }).map(function(p) {
    return '<circle cx="' + toX(p.n).toFixed(1) + '" cy="' + toY(p.acc).toFixed(1) + '" r="2.5" ' +
      'fill="var(--panel2)" stroke="var(--accent)" stroke-width="1.5"><title>Question ' + p.n + ': ' + p.acc + '%</title></circle>';
  }).join('');

  var last = pts[pts.length - 1];
  var deltaBase = pts[Math.max(0, pts.length - 1 - windowSize)];
  var delta = last.acc - deltaBase.acc;
  var deltaColor = delta > 0 ? 'var(--good)' : (delta < 0 ? 'var(--bad)' : 'var(--muted)');
  var deltaLabel = delta === 0 ? '±0%' : ((delta > 0 ? '+' : '') + delta + '%');

  return '<div class="chart-wrap">' +
    '<div class="chart-head">' +
      '<div class="chart-title">' + title + '</div>' +
      '<div class="chart-current"><span class="chart-current-val mono">' + last.acc + '%</span>' +
      '<span class="chart-current-delta mono" style="color:' + deltaColor + '">' + deltaLabel + '</span></div>' +
    '</div>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img" ' +
      'aria-label="Accuracy trend, rolling ' + windowSize + '-question average, currently ' + last.acc + '%">' +
      gridLines + refLine +
      '<polygon points="' + fillPts + '" fill="var(--accent)" fill-opacity="0.10"/>' +
      '<polyline points="' + linePts + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      markers +
      '<circle cx="' + lastX.toFixed(1) + '" cy="' + toY(last.acc).toFixed(1) + '" r="3" fill="var(--accent)"/>' +
    '</svg>' +
    '<div class="chart-foot">Rolling ' + windowSize + '-question accuracy &middot; Q' + pts[0].n + '–Q' + last.n + '</div>' +
  '</div>';
}
