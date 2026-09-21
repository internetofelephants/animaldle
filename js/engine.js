/* ==========================================================
   GAME ENGINE — rules and state. No DOM.
   Depends on: filters.js, feedback.js, pool.js
   ========================================================== */

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function currentSettings() {
  return {
    mode: GAME_MODE,
    board: BOARD_MODE && GAME_MODE === 'animal',
    photoHints: PHOTO_HINTS,
    revealCount: REVEALED_TRAITS,
    revealStrategy: REVEAL_STRATEGY,
    revealIds: REVEALED_FILTER_IDS.slice(),
    count: NUMBER_OF_ANIMALS,
    filtersPerGuess: Math.max(1, Math.min(FILTERS_PER_GUESS, FILTERS.length)),
    maxGuesses: MAX_GUESSES,
    showRemaining: SHOW_REMAINING_ANIMALS,
    allowEarlyGuess: ALLOW_EARLY_GUESS
  };
}

/* Pick `count` random animals from the master database (capped at its size). */
function buildPool(db, count) {
  return shuffle(db).slice(0, Math.min(count, db.length));
}

/* opts: { settings, pool?, target? } — pool and target are optional (used by the simulator). */
function createGame(opts) {
  var settings = opts.settings;
  var pool = opts.pool || buildPool(ANIMALS, settings.count);
  var target = opts.target || pool[Math.floor(Math.random() * pool.length)];   // fixed for the whole game
  return {
    settings: settings,
    pool: pool,
    target: target,
    history: [],             // guess records (see pool.js)
    hintsViewed: [],         // animals whose photo the player has looked up as a hint
    remaining: pool.slice(),
    status: 'playing',       // playing | won | lost
    guessCount: 0
  };
}

function afterGuess(game, record) {
  game.guessCount++;
  game.history.push(record);
  game.remaining = computeRemaining(game.pool, game.history);
  record.remainingCount = game.remaining.length;
  record.remainingNames = game.remaining.map(function (a) { return a.name; });
  if (game.status === 'playing' && game.guessCount >= game.settings.maxGuesses) game.status = 'lost';
}

/* Filter+result combinations (e.g. "trunk|gray") already shown to the player in earlier guesses. */
function seenHints(game) {
  var seen = {};
  game.history.forEach(function (r) {
    (r.filters || []).forEach(function (f) { seen[f.id + '|' + f.result] = true; });
  });
  return seen;
}

/* Which characteristics get revealed for one animal guess (kept in FILTERS order).
   A filter+result combination is never shown twice in a game: entries already seen are dropped,
   and a filter with nothing new left is skipped (so a guess may reveal fewer than the usual count). */
function revealForGuess(game, guessed) {
  var settings = game.settings, seen = seenHints(game);
  var pool = FILTERS;
  if (settings.revealStrategy === 'fixed') pool = FILTERS.filter(function (f) { return settings.revealIds.indexOf(f.id) >= 0; });
  var options = [];
  pool.forEach(function (def) {
    var entries = guessedAttributeFeedback(def, guessed, game.target).filter(function (e) { return !seen[def.id + '|' + e.result]; });
    if (entries.length) options.push({ def: def, entries: entries });
  });
  var n = settings.revealStrategy === 'fixed' ? 0 : settings.revealCount;
  if (n && n < options.length) {
    var picked = shuffle(options).slice(0, n);
    options = options.filter(function (o) { return picked.indexOf(o) >= 0; });
  }
  return options;
}

/* Animal-guess mode: guess a whole animal from the pool. The record stores every revealed value with
   the color it earned vs the target, so pool.js filters on it like any other guess. */
function guessAnimal(game, name) {
  if (game.status !== 'playing') throw new Error('Game is over');
  var guessed = game.pool.filter(function (a) { return a.name === name; })[0];
  if (!guessed) throw new Error('Not in the current pool');
  if (game.history.some(function (r) { return r.animal === name; })) throw new Error('Already guessed');
  var filters = [];
  revealForGuess(game, guessed).forEach(function (o) {
    o.entries.forEach(function (e) {
      filters.push({ id: o.def.id, label: o.def.label, value: e.value, result: e.result });
    });
  });
  var record = { type: 'filters', animal: name, filters: filters };
  if (name === game.target.name) game.status = 'won';
  afterGuess(game, record);
  return record;
}

/* selections: [{ id, value }] — must be exactly filtersPerGuess, each from a different filter. */
function submitFilterGuess(game, selections) {
  if (game.status !== 'playing') throw new Error('Game is over');
  if (selections.length !== game.settings.filtersPerGuess) throw new Error('Pick ' + game.settings.filtersPerGuess + ' filters');
  var seen = {};
  var filters = selections.map(function (s) {
    var def = getFilter(s.id);
    if (!def || def.options.indexOf(s.value) < 0) throw new Error('Invalid selection');
    if (seen[s.id]) throw new Error('Same characteristic selected twice');
    seen[s.id] = true;
    return { id: s.id, label: def.label, value: s.value, result: evaluateFilter(def, s.value, game.target) };
  });
  var record = { type: 'filters', filters: filters };
  afterGuess(game, record);
  // Without early guessing, narrowing to a single animal counts as identifying it.
  if (!game.settings.allowEarlyGuess && game.remaining.length === 1) game.status = 'won';
  return record;
}

function submitAnimalGuess(game, name) {
  if (game.status !== 'playing') throw new Error('Game is over');
  if (!game.settings.allowEarlyGuess) throw new Error('Early guessing is disabled');
  var correct = name === game.target.name;
  var record = { type: 'animal', name: name, correct: correct };
  if (correct) game.status = 'won';
  afterGuess(game, record);
  return record;
}

/* Photo hints: the player may look at the photo of `photoHints` different animals per game.
   Looking again at an animal already viewed is free. Once the game is over, viewing is unlimited. */
function photoHintsLeft(game) {
  return Math.max(0, game.settings.photoHints - game.hintsViewed.length);
}

/* Should this animal's name be a link right now? Not once the hints are used up. */
function canViewPhoto(game) {
  return game.status !== 'playing' || photoHintsLeft(game) > 0;
}

/* Returns true if the photo may be shown (and records the hint if it costs one). */
function spendPhotoHint(game, name) {
  if (game.status !== 'playing' || game.hintsViewed.indexOf(name) >= 0) return true;
  if (photoHintsLeft(game) <= 0) return false;
  game.hintsViewed.push(name);
  return true;
}
