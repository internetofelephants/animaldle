/* ==========================================================
   SIMULATOR — "Test All Animals" diagnostic. No DOM.
   Plays every animal in the pool as the target with a deliberately dumb bot:
     each turn: pick random characteristics; for each, use the value held by a
     random still-possible animal (never peeks at the target).
     When only one animal remains: guess it (if early guessing is allowed).
   The bot ignores MAX_GUESSES (uses SIM_GUESS_CAP) so you see the true distribution.
   ========================================================== */

function botSelections(game) {
  var pick = game.remaining[Math.floor(Math.random() * game.remaining.length)];
  return shuffle(FILTERS).slice(0, game.settings.filtersPerGuess).map(function (def) {
    var v = def.get(pick);
    if (Array.isArray(v)) v = v.length ? v[Math.floor(Math.random() * v.length)] : def.options[Math.floor(Math.random() * def.options.length)];
    return { id: def.id, value: v };
  });
}

function playBotGame(settings, pool, target) {
  var s = Object.assign({}, settings, { maxGuesses: SIM_GUESS_CAP });
  var game = createGame({ settings: s, pool: pool, target: target });
  var trace = [], stalled = 0;
  if (s.mode === 'animal') {
    // Bot: guess a random animal that is still possible (never peeks at the target).
    while (game.status === 'playing') {
      var guessed = game.history.map(function (r) { return r.animal; });
      var fresh = function (a) { return guessed.indexOf(a.name) < 0; };
      var cands = game.remaining.filter(fresh);
      if (!cands.length) cands = game.pool.filter(fresh);
      guessAnimal(game, cands[Math.floor(Math.random() * cands.length)].name);
      trace.push(game.history[game.history.length - 1].remainingCount);
    }
    return { guesses: game.guessCount, won: game.status === 'won', trace: trace };
  }
  while (game.status === 'playing') {
    var before = game.remaining.length;
    // Guess an animal when one is left, or when several guesses in a row failed to narrow the pool
    // (the remaining animals can't be told apart, so a coin-flip guess is all that's left).
    if (s.allowEarlyGuess && (before === 1 || stalled >= 3)) {
      submitAnimalGuess(game, game.remaining[Math.floor(Math.random() * before)].name);
      stalled = 0;
    } else {
      submitFilterGuess(game, botSelections(game));
      stalled = game.remaining.length === before ? stalled + 1 : 0;
    }
    trace.push(game.history[game.history.length - 1].remainingCount);
  }
  return { guesses: game.guessCount, won: game.status === 'won', trace: trace };
}

/* Signature of how an animal answers EVERY possible guess. Equal signatures = can't be told apart. */
function feedbackSignature(animal) {
  var out = [];
  FILTERS.forEach(function (def) {
    def.options.forEach(function (opt) { out.push({ green: 'G', yellow: 'Y', gray: '.' }[evaluateFilter(def, opt, animal)]); });
  });
  return out.join('');
}

function findIndistinguishable(pool) {
  var groups = {};
  pool.forEach(function (a) { (groups[feedbackSignature(a)] = groups[feedbackSignature(a)] || []).push(a.name); });
  return Object.keys(groups).map(function (k) { return groups[k]; }).filter(function (g) { return g.length > 1; });
}

function median(sorted) {
  var n = sorted.length, m = Math.floor(n / 2);
  return n % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function simulateAll(settings, pool) {
  var results = pool.map(function (t) { var r = playBotGame(settings, pool, t); r.name = t.name; return r; });
  var guesses = results.map(function (r) { return r.guesses; }).sort(function (a, b) { return a - b; });
  var sum = guesses.reduce(function (a, b) { return a + b; }, 0);

  var maxLen = Math.max.apply(null, results.map(function (r) { return r.trace.length; }));
  var avgRemaining = [];
  for (var i = 0; i < maxLen; i++) {
    var vals = results.filter(function (r) { return r.trace.length > i; }).map(function (r) { return r.trace[i]; });
    avgRemaining.push({ guess: i + 1, games: vals.length, avg: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length });
  }

  var groups = findIndistinguishable(pool);
  var sorted = results.slice().sort(function (a, b) { return a.guesses - b.guesses; });
  return {
    games: results.length,
    average: sum / guesses.length,
    median: median(guesses),
    min: guesses[0],
    max: guesses[guesses.length - 1],
    withinMax: results.filter(function (r) { return r.won && r.guesses <= settings.maxGuesses; }).length,
    unsolved: results.filter(function (r) { return !r.won; }).length,
    indistinguishableGroups: groups,
    indistinguishableCount: groups.reduce(function (a, g) { return a + g.length; }, 0),
    avgRemaining: avgRemaining,
    easiest: sorted.slice(0, 5).map(function (r) { return r.name + ' (' + r.guesses + ')'; }),
    hardest: sorted.slice(-5).reverse().map(function (r) { return r.name + ' (' + r.guesses + ')'; })
  };
}
