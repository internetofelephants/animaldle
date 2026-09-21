/* ==========================================================
   DEBUG PANEL — optional. Remove the <script> tag for this file in index.html
   (or set DEBUG_ENABLED = false in config.js) to turn it off.
   ========================================================== */

var DebugPanel = (function () {
  var simOutput = '';

  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  function runSim() {
    var s = simulateAll(game.settings, game.pool);
    var out = [];
    out.push('TEST ALL ANIMALS  (' + s.games + ' games, ' + (game.settings.mode === 'animal' ? 'animal-guess mode; bot guesses random still-possible animals' : game.settings.filtersPerGuess + ' filters/guess, random-bot play') + ')');
    out.push('Average guesses: ' + fmt(s.average));
    out.push('Median guesses:  ' + s.median);
    out.push('Min / Max:       ' + s.min + ' / ' + s.max);
    out.push('Solved within MAX_GUESSES (' + game.settings.maxGuesses + '): ' + s.withinMax + ' / ' + s.games);
    if (s.unsolved) out.push('Not solved at all (cap ' + SIM_GUESS_CAP + '): ' + s.unsolved);
    out.push('Animals that cannot be uniquely identified: ' + s.indistinguishableCount);
    s.indistinguishableGroups.forEach(function (g) { out.push('   identical: ' + g.join(', ')); });
    out.push('Average animals remaining after each guess:');
    s.avgRemaining.forEach(function (r) { out.push('   after guess ' + r.guess + ': ' + fmt(r.avg) + '   (' + r.games + ' games still going/ended here)'); });
    out.push('Fewest guesses: ' + s.easiest.join(', '));
    out.push('Most guesses:   ' + s.hardest.join(', '));
    simOutput = out.join('\n');
  }

  function render(g) {
    var root = document.getElementById('debug-root');
    var wasOpen = root.querySelector('details') && root.querySelector('details').open;
    var names = g.remaining.map(function (a) { return a.name; }).sort();
    var h = '<details' + (wasOpen ? ' open' : '') + '><summary>DEBUG</summary>';
    h += '<p><b>Target animal:</b> ' + esc(g.target.name) + '</p>';
    h += '<p><b>Current possible animals:</b> ' + names.length + '</p>';
    h += '<p><b>Current possible animal names:</b> [' + names.map(esc).join(', ') + ']</p>';
    g.history.forEach(function (r, i) {
      h += '<div class="hist"><b>Guess ' + (i + 1) + '</b> ';
      if (r.type === 'animal') h += '— animal guess: ' + esc(r.name) + ' (' + (r.correct ? 'correct' : 'wrong') + ')';
      else if (r.animal) h += '— ' + esc(r.animal) + '<br>' + r.filters.map(function (f) { return esc(f.label) + '=' + esc(f.value) + ' ' + f.result[0].toUpperCase(); }).join(', ');
      else h += '<br>' + r.filters.map(function (f) { return esc(f.label) + '=' + esc(f.value) + ' → ' + f.result.toUpperCase(); }).join('<br>');
      h += '<br>Remaining: ' + r.remainingCount + '</div>';
    });
    h += '<p><button id="dbg-reveal">Reveal Answer</button> <button id="dbg-sim">Test All Animals</button></p>';
    if (simOutput) h += '<pre>' + esc(simOutput) + '</pre>';
    h += '</details>';
    root.innerHTML = h;
  }

  document.addEventListener('click', function (e) {
    if (e.target.id === 'dbg-reveal') revealAnswer();
    if (e.target.id === 'dbg-sim') { e.target.textContent = 'Running…'; setTimeout(function () { runSim(); render(game); }, 20); }
  });

  return { render: render };
})();
