// ===== Accuracy trend chart (inline SVG) =====
// Used by the readiness report, the Stats page, and the Home dashboard preview.

function renderAccuracyChart(trend, opts) {
  opts = opts || {};
  var title = opts.title !== undefined ? opts.title : 'Accuracy trend';

  if (!trend || trend.length < 2) {
    return '<div class="chart-wrap"><div class="chart-title">' + title + '</div>' +
      '<p class="chart-empty">Answer more questions to see your accuracy trend.</p></div>';
  }

  var W = opts.width || 560, H = opts.height || 120;
  var PL = 28, PR = 36, PT = 8, PB = 18;
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

  return '<div class="chart-wrap"><div class="chart-title">' + title + '</div>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img" aria-label="Accuracy trend chart">' +
    '<line x1="' + xStart + '" y1="' + y80 + '" x2="' + xEnd + '" y2="' + y80 + '" stroke="rgba(52,211,153,0.35)" stroke-dasharray="4,3" stroke-width="1"/>' +
    '<text x="' + (xEnd + 3) + '" y="' + (parseFloat(y80) + 4) + '" fill="rgba(52,211,153,0.8)" font-size="9" font-family="ui-monospace,Consolas,monospace">80%</text>' +
    '<line x1="' + xStart + '" y1="' + y75 + '" x2="' + xEnd + '" y2="' + y75 + '" stroke="rgba(226,145,60,0.35)" stroke-dasharray="4,3" stroke-width="1"/>' +
    '<text x="' + (xEnd + 3) + '" y="' + (parseFloat(y75) + 4) + '" fill="rgba(226,145,60,0.8)" font-size="9" font-family="ui-monospace,Consolas,monospace">75%</text>' +
    '<polygon points="' + fillPts + '" fill="rgba(217,184,119,0.10)"/>' +
    '<polyline points="' + pts + '" fill="none" stroke="#d9b877" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<text x="' + (W / 2) + '" y="' + (H - 2) + '" text-anchor="middle" fill="rgba(143,160,189,0.75)" font-size="9" font-family="ui-monospace,Consolas,monospace">' + xLabel + '</text>' +
    '</svg></div>';
}
