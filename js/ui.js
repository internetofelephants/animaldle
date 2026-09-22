/* ==========================================================
   GAME UI — thin layer over the engine. All rules live in the other files.
   ========================================================== */

var game = null;
var slots = [];        // [{ id, value }] one per filter slot in the current guess
var notice = '';       // one-line message (e.g. "Not quite.")
var revealed = false;
var notes = {};        // board mode: animal name -> true when the player has struck it out (player-only notes)

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

/* ---------- photos ---------- */

function photoFor(name) { return (typeof PHOTOS !== 'undefined' && PHOTOS[name]) || null; }

function creditLine(p) {
  var lic = p.licenseUrl ? '<a href="' + esc(p.licenseUrl) + '" target="_blank" rel="noopener">' + esc(p.license) + '</a>' : esc(p.license);
  return 'Photo: ' + esc(p.author) + ' · ' + lic + ' · <a href="' + esc(p.source) + '" target="_blank" rel="noopener">source</a>';
}

/* <img> that opens the photo popup when clicked (data-photo). Empty string when there's no photo. */
function photoImg(name, cls) {
  var p = photoFor(name);
  if (!p) return '';
  return '<img class="' + cls + '" src="' + esc(p.file) + '" alt="' + esc(name) + '" title="' + esc(name) + ' — click to enlarge" data-photo="' + esc(name) + '" onerror="this.style.display=\'none\'">';
}

function openPhoto(name) {
  var p = photoFor(name);
  if (!p) return;
  var m = $('photo-modal');
  m.innerHTML = '<div class="dialog" role="dialog" aria-label="' + esc(name) + '"><button class="close" aria-label="Close">✕</button>' +
    '<img src="' + esc(p.file) + '" alt="' + esc(name) + '"><div class="cap"><b>' + esc(name) + '</b><br>' + creditLine(p) + '</div></div>';
  m.hidden = false;
}
/* Popup listing every possible value of a filter (opened from any filter title). */
var FILTER_HELP = {
  categorical: 'Exact match is green; some values count as "close" (yellow); anything else is gray.',
  ordered: 'Values run in the order shown. Exact is green, one step away is yellow, further is gray.',
  multi: 'An animal can have several of these. Any it has is green (for the first-listed one it may be yellow if it only has it secondarily); ones it lacks are gray.',
  boolean: 'Yes or No. A match is green, otherwise gray.'
};
/* A few familiar animals that have this filter value, for the "what does this mean" popup. */
function examplesFor(def, value) {
  return ANIMALS.filter(function (a) { return def.get(a) === value; })
    .sort(function (a, b) { return (a.fame || 2) - (b.fame || 2); })
    .slice(0, 3).map(function (a) { return a.name; });
}
function openFilterInfo(id) {
  var def = getFilter(id);
  if (!def) return;
  var m = $('photo-modal');
  var opts = def.options.map(function (o, i) {
    var ex = def.showExamples ? examplesFor(def, o) : [];
    return '<li>' + (def.kind === 'ordered' ? (i + 1) + '. ' : '') + '<b>' + esc(o) + '</b>' +
      (ex.length ? ' <span class="dim">e.g. ' + esc(ex.join(', ')) + '</span>' : '') + '</li>';
  }).join('');
  m.innerHTML = '<div class="dialog info" role="dialog" aria-label="' + esc(def.label) + '"><button class="close" aria-label="Close">✕</button>' +
    '<div class="cap"><b>' + esc(def.label) + '</b> <span class="dim">— possible values</span><ul class="opts">' + opts + '</ul>' +
    '<p class="dim">' + esc(FILTER_HELP[def.kind] || '') + '</p></div></div>';
  m.hidden = false;
}
function filterLink(id, label) {
  return '<button type="button" class="filter-link" data-filter="' + esc(id) + '" title="See all possible values">' + esc(label) + '</button>';
}
function closePhoto() { $('photo-modal').hidden = true; }

var creditsFor = null;   // the game whose credits list is currently rendered
function renderCredits() {
  if (creditsFor === game) return;
  creditsFor = game;
  var rows = game.pool.map(function (a) { return a.name; }).sort().map(function (n) {
    var p = photoFor(n);
    return p ? '<li><b>' + esc(n) + '</b> — ' + creditLine(p) + '</li>' : '';
  }).join('');
  $('credits-list').innerHTML = '<ul>' + rows + '</ul>';
}

function newGame() {
  game = createGame({ settings: currentSettings() });
  slots = [];
  for (var i = 0; i < game.settings.filtersPerGuess; i++) slots.push({ id: '', value: '' });
  notice = '';
  revealed = false;
  notes = {};
  render();
}

/* ---------- rendering ---------- */

function render() {
  renderGuessPanel();
  renderResult();
  renderRemaining();
  renderHistory();
  renderDifficulty();
  renderCredits();
  renderSettings();
  if (window.DebugPanel && DEBUG_ENABLED) DebugPanel.render(game);
}

function renderDifficulty() {
  var html = DIFFICULTY_LEVELS.map(function (l) {
    return '<button class="diff' + (l.id === DIFFICULTY ? ' active' : '') + '" data-level="' + l.id + '" aria-pressed="' + (l.id === DIFFICULTY) + '">' + esc(l.label) + '</button>';
  }).join('');
  $('difficulty').innerHTML = html;
  var cur = DIFFICULTY_LEVELS.filter(function (l) { return l.id === DIFFICULTY; })[0];
  $('difficulty-note').textContent = cur
    ? cur.animals + ' animals · ' + cur.traits + ' traits revealed per guess'
    : NUMBER_OF_ANIMALS + ' animals · ' + REVEALED_TRAITS + ' traits revealed per guess (custom settings)';
}

function renderGuessPanel() {
  var panel = $('guess-panel');
  if (game.status !== 'playing') { panel.innerHTML = ''; return; }
  if (game.settings.mode === 'animal') { renderAnimalGuessPanel(panel); return; }
  var n = game.guessCount + 1;
  var used = slots.map(function (s) { return s.id; });
  var html = '<h2>GUESS #' + n + ' <span class="dim">of ' + game.settings.maxGuesses + '</span></h2>';
  slots.forEach(function (s, i) {
    var def = s.id ? getFilter(s.id) : null;
    html += '<div class="slot"><select data-slot="' + i + '" data-role="cat"><option value="">— choose characteristic —</option>';
    var lastGroup = null;
    FILTERS.forEach(function (f) {
      if (f.group !== lastGroup) { if (lastGroup) html += '</optgroup>'; html += '<optgroup label="' + esc(f.group) + '">'; lastGroup = f.group; }
      var taken = used.indexOf(f.id) >= 0 && s.id !== f.id;
      html += '<option value="' + f.id + '"' + (s.id === f.id ? ' selected' : '') + (taken ? ' disabled' : '') + '>' + esc(f.label) + '</option>';
    });
    html += '</optgroup></select> ';
    html += '<select data-slot="' + i + '" data-role="val"' + (def ? '' : ' disabled') + '><option value="">—</option>';
    if (def) def.options.forEach(function (o) { html += '<option' + (s.value === o ? ' selected' : '') + '>' + esc(o) + '</option>'; });
    html += '</select></div>';
  });
  var ready = slots.every(function (s) { return s.id && s.value; });
  html += '<button id="submit-guess" class="primary"' + (ready ? '' : ' disabled') + '>SUBMIT GUESS</button>';

  if (game.settings.allowEarlyGuess) {
    html += '<div class="early"><b>Guess the Animal</b> <span class="dim">(counts as a guess)</span><br>' +
      '<select id="early-select"><option value="">— pick from remaining —</option>';
    game.remaining.map(function (a) { return a.name; }).sort().forEach(function (nm) { html += '<option>' + esc(nm) + '</option>'; });
    html += '</select> <button id="early-guess">Guess</button></div>';
  }
  if (notice) html += '<p class="notice">' + esc(notice) + '</p>';
  panel.innerHTML = html;
}

function guessableNames() {
  var guessed = game.history.map(function (r) { return r.animal; });
  return game.pool.map(function (a) { return a.name; }).filter(function (n) { return guessed.indexOf(n) < 0; }).sort();
}

function renderAnimalGuessPanel(panel) {
  if (game.settings.board) {   // guessing happens with the ✓ button on the board
    var left = photoHintsLeft(game);
    var hintText = left === 0 ? 'No photo hints left' : left + ' photo hint' + (left === 1 ? '' : 's') + ' left';
    panel.innerHTML = '<h2>GUESS #' + (game.guessCount + 1) + ' <span class="dim">of ' + game.settings.maxGuesses + '</span>' +
      '<span class="hints' + (left === 0 ? ' none' : '') + '" title="Click an animal\'s name to see its photo">📷 ' + hintText + '</span></h2>' +
      '<p class="dim">Pick an animal on the board below. You\'ll see some of its traits colored against the mystery animal. ' +
      'Tap an animal\'s name to see its photo — you get ' + game.settings.photoHints + ' photo hints per game.</p>';
    return;
  }
  var html = '<h2>GUESS #' + (game.guessCount + 1) + ' <span class="dim">of ' + game.settings.maxGuesses + '</span></h2>' +
    '<p class="dim">Pick any animal. You\'ll see all its traits colored against the mystery animal.</p>' +
    '<input id="animal-input" list="animal-list" placeholder="Type or pick an animal…" autocomplete="off"> ' +
    '<datalist id="animal-list">' + guessableNames().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
    '<button id="submit-animal" class="primary" disabled>SUBMIT GUESS</button>';
  panel.innerHTML = html;
}

/* Resolve the typed text to a guessable animal name (case-insensitive), or '' */
function typedAnimal() {
  var el = $('animal-input');
  if (!el) return '';
  var v = el.value.trim().toLowerCase();
  return guessableNames().filter(function (n) { return n.toLowerCase() === v; })[0] || '';
}

function renderResult() {
  var box = $('result');
  var html = '';
  var pic = photoImg(game.target.name, 'result-photo');
  var tp = photoFor(game.target.name);
  var credit = tp ? '<div class="credit">' + creditLine(tp) + '</div>' : '';
  var wrap = function (cls, inner) { return '<div class="banner ' + cls + (pic ? ' withphoto' : '') + '">' + pic + '<div class="txt">' + inner + credit + '</div></div>'; };
  if (game.status === 'won') {
    var last = game.history[game.history.length - 1];
    if (last.type === 'animal') html += '<p class="big">CORRECT!</p><p>You found the ' + esc(game.target.name) + ' in ' + plural(game.guessCount, 'guess', 'guesses') + '.</p>';
    html += wrap('win', '<div class="big">YOU FOUND IT!</div>Animal: ' + esc(game.target.name) + '<br>Guesses: ' + game.guessCount);
  } else if (game.status === 'lost') {
    html += wrap('lose', '<div class="big">OUT OF GUESSES</div>The animal was: ' + esc(game.target.name) + '<br>Guesses used: ' + game.guessCount);
  } else if (revealed) {
    html += '<div class="banner reveal">Answer: ' + esc(game.target.name) + '</div>';
  }
  if (game.status !== 'playing') {
    html += '<button id="play-again" class="primary">PLAY AGAIN</button>' + summaryHTML();
  }
  box.innerHTML = html;
}

function summaryHTML() {
  var html = '<div class="summary"><div>Starting animals: ' + game.pool.length + '</div>';
  var g = 0;
  game.history.forEach(function (r) {
    g++;
    html += '<div>' + (g === 1 ? 'Animals remaining after Guess 1: ' : 'After Guess ' + g + ': ') + r.remainingCount + '</div>';
  });
  html += '<div><b>' + (game.status === 'won' ? 'Solved in: ' + plural(game.guessCount, 'guess', 'guesses') : 'Not solved in ' + game.guessCount + ' guesses') + '</b></div></div>';
  return html;
}

/* Board mode: every animal in the pool, always. Clicking a tile strikes it out (a note, not a game rule). */
function renderBoard(box) {
  var names = game.pool.map(function (a) { return a.name; }).sort();
  var guessed = {};
  game.history.forEach(function (r) { if (r.animal) guessed[r.animal] = true; });
  var html = '<p class="dim"><span class="key ok">✓</span> guess that animal &nbsp; <span class="key no">✕</span> rule it out (again to undo)</p>' +
    '<ul class="names board">';
  names.forEach(function (n) {
    var cls = 'tile';
    if (guessed[n]) cls += n === game.target.name ? ' found' : ' guessed';
    else if (notes[n]) cls += ' struck';
    if (game.status !== 'playing' && n === game.target.name) cls += ' found';
    var guessBtn = '', outBtn = '';
    if (game.status === 'playing' && !guessed[n]) {
      guessBtn = '<button class="tile-guess" data-name="' + esc(n) + '" title="Guess ' + esc(n) + '" aria-label="Guess ' + esc(n) + '">✓</button>';
      outBtn = '<button class="tile-out" data-name="' + esc(n) + '" title="' + (notes[n] ? 'Bring back' : 'Rule out') + '" aria-label="' + (notes[n] ? 'Bring back ' : 'Rule out ') + esc(n) + '">' + (notes[n] ? '↺' : '✕') + '</button>';
    }
    var label = (photoFor(n) && canViewPhoto(game))
      ? '<a href="#" class="nm animal-link" data-photo="' + esc(n) + '" title="See a photo of the ' + esc(n) + '">' + esc(n) + '</a>'
      : '<span class="nm">' + esc(n) + '</span>';
    html += '<li class="' + cls + '">' + guessBtn + label + outBtn + '</li>';
  });
  box.innerHTML = html + '</ul>' + (Object.keys(notes).length ? '<button id="clear-notes">Clear my notes</button>' : '');
}

function renderRemaining() {
  var box = $('remaining');
  if (game.settings.board) { renderBoard(box); return; }
  var n = game.remaining.length;
  var html = '<div class="count">' + n + ' ' + (n === 1 ? 'ANIMAL REMAINS' : 'ANIMALS REMAIN') + '</div>';
  if (game.settings.showRemaining) {
    html += '<ul class="names">' + game.remaining.map(function (a) { return a.name; }).sort()
      .map(function (nm) {
        return game.settings.mode === 'animal' && game.status === 'playing'
          ? '<li class="pick" data-name="' + esc(nm) + '">' + esc(nm) + '</li>' : '<li>' + esc(nm) + '</li>';
      }).join('') + '</ul>';
  } else {
    html += '<p class="dim">(list hidden by settings)</p>';
  }
  box.innerHTML = html;
}

function renderHistory() {
  var box = $('history');
  if (game.settings.board) { box.innerHTML = cluesHTML(); return; }
  if (!game.history.length) { box.innerHTML = '<h2>GUESS HISTORY</h2><p class="dim">No guesses yet.</p>'; return; }
  var html = '<h2>GUESS HISTORY</h2>';
  var order = game.history.map(function (r, i) { return i; });
  if (game.settings.mode === 'animal') order.reverse();   // newest first: it's the one you're reasoning about
  order.forEach(function (i) {
    var r = game.history[i];
    if (r.animal) { html += animalCardHTML(r, i); return; }
    html += '<div class="hist"><b>GUESS ' + (i + 1) + '</b>';
    if (r.type === 'animal') {
      html += '<div>Guessed animal: ' + esc(r.name) + ' ' + (r.correct ? '🟩' : '⬜') + '</div>';
    } else {
      r.filters.forEach(function (f) {
        html += '<div class="' + f.result + '">' + filterLink(f.id, f.label) + ': ' + esc(f.value) + ' ' + RESULT_EMOJI[f.result] + '</div>';
      });
      html += '<div>' + r.filters.map(function (f) { return RESULT_EMOJI[f.result]; }).join(' ') + '</div>';
    }
    html += '<div class="dim">' + r.remainingCount + ' remain</div></div>';
  });
  box.innerHTML = html;
}

/* Board mode: everything learned so far, pooled per characteristic.
   Green = the mystery animal has this, gray (struck through) = it doesn't, yellow = close.
   Colors are consistent per value across guesses, so each value appears once. */
function cluesHTML() {
  var guesses = game.history.filter(function (r) { return r.animal; });
  var html = '<h2>WHAT YOU KNOW</h2>';
  if (!guesses.length) return html + '<p class="dim">No clues yet. Make a guess.</p>';

  var byId = {};
  guesses.forEach(function (r, gi) {
    var isLatest = gi === guesses.length - 1;
    r.filters.forEach(function (f) {
      var row = byId[f.id] = byId[f.id] || { id: f.id, label: f.label, seen: {}, items: [], isNew: false };
      if (!row.seen[f.value]) {
        row.seen[f.value] = true;
        row.items.push(f);
        if (isLatest) row.isNew = true;   // first time this value has appeared, and it came from the latest guess
      }
    });
  });
  var rank = { green: 0, yellow: 1, gray: 2 };
  html += '<div class="card clues"><div class="legend"><span class="chip green">is</span> <span class="chip yellow">close</span> <span class="chip gray">is not</span></div>';
  FILTERS.forEach(function (def) {
    var row = byId[def.id];
    if (!row) return;
    var chips = row.items.slice().sort(function (a, b) { return rank[a.result] - rank[b.result]; })
      .map(function (f) { return '<span class="chip ' + f.result + '">' + esc(f.value) + '</span>'; }).join('');
    html += '<div class="row"><span class="lbl">' + filterLink(row.id, row.label) + '</span>' + chips + (row.isNew ? '<span class="new-tag">NEW</span>' : '') + '</div>';
  });
  html += '</div><p class="dim">Guessed: ' + guesses.map(function (r) { return esc(r.animal); }).join(', ') + '</p>';
  html += '<details><summary>Per-guess detail</summary>';
  guesses.map(function (r) { return r; }).reverse().forEach(function (r) { html += animalCardHTML(r, game.history.indexOf(r)); });
  return html + '</details>';
}

/* One guessed animal: a row per characteristic, each value a colored chip */
function animalCardHTML(r, i) {
  var html = '<div class="card guesscard"><div class="main"><b>GUESS ' + (i + 1) + ' — ' + esc(r.animal) + '</b>';
  var rows = [], byId = {};
  r.filters.forEach(function (f) {
    if (!byId[f.id]) { byId[f.id] = { id: f.id, label: f.label, chips: [] }; rows.push(byId[f.id]); }
    byId[f.id].chips.push('<span class="chip ' + f.result + '">' + esc(f.value) + '</span>');
  });
  rows.forEach(function (row) { html += '<div class="row"><span class="lbl">' + filterLink(row.id, row.label) + '</span>' + row.chips.join('') + '</div>'; });
  return html + '</div>' + photoImg(r.animal, 'thumb') + '</div>';
}

function renderSettings() {
  var el = $('settings-form');
  if (el.dataset.built) return;
  el.dataset.built = '1';
  el.innerHTML =
    '<p id="settings-lock-note" class="locked-note">Locked for now: pool size and traits revealed are set by the difficulty level. (Set SETTINGS_LOCKED = false in config.js to edit.)</p>' +
    '<label>Game mode <select id="set-mode"><option value="animal">Guess animals (see all traits)</option><option value="filters">Pick filters</option></select></label>' +
    '<label>Photo hints per game <input type="number" id="set-hints" min="0" max="20"> <span class="dim">(board mode)</span></label>' +
    '<label>Traits revealed per guess <input type="number" id="set-reveal" min="0" max="' + FILTERS.length + '"> <span class="dim">(0 = all)</span></label>' +
    '<label>Reveal strategy <select id="set-strategy"><option value="random">Random subset each guess</option><option value="fixed">Fixed traits (REVEALED_FILTER_IDS)</option></select></label>' +
    '<label><input type="checkbox" id="set-board"> Notebook board (animal mode: whole pool always shown, you strike animals out yourself)</label>' +
    '<label>Starting animal pool size <input type="number" id="set-count" min="2" max="' + ANIMALS.length + '"> <span class="dim">(database has ' + ANIMALS.length + ')</span></label>' +
    '<label>Filters per guess <input type="number" id="set-filters" min="1" max="' + FILTERS.length + '"></label>' +
    '<label>Maximum guesses <input type="number" id="set-max" min="1" max="99"></label>' +
    '<label><input type="checkbox" id="set-show"> Show remaining animals</label>' +
    '<label><input type="checkbox" id="set-early"> Allow early guessing</label>' +
    '<label><input type="checkbox" id="set-gray"> Gray eliminates animals <span class="dim">(off = gray removes nothing)</span></label>' +
    '<button id="apply-settings">Apply &amp; start new game</button> <span id="settings-note" class="dim"></span>';
  syncSettingsInputs();
  applySettingsLock();
}

function applySettingsLock() {
  var el = $('settings-form');
  el.classList.toggle('locked', SETTINGS_LOCKED);
  [].forEach.call(el.querySelectorAll('input, select, button'), function (c) { c.disabled = SETTINGS_LOCKED; });
  var note = $('settings-lock-note');
  if (note) note.hidden = !SETTINGS_LOCKED;
}

function syncSettingsInputs() {
  $('set-mode').value = GAME_MODE;
  $('set-board').checked = BOARD_MODE;
  $('set-hints').value = PHOTO_HINTS;
  $('set-reveal').value = REVEALED_TRAITS;
  $('set-strategy').value = REVEAL_STRATEGY;
  $('set-count').value = NUMBER_OF_ANIMALS;
  $('set-filters').value = FILTERS_PER_GUESS;
  $('set-max').value = MAX_GUESSES;
  $('set-show').checked = SHOW_REMAINING_ANIMALS;
  $('set-early').checked = ALLOW_EARLY_GUESS;
  $('set-gray').checked = GRAY_ELIMINATES;
}

/* ---------- events ---------- */

document.addEventListener('change', function (e) {
  var t = e.target, role = t.dataset && t.dataset.role;
  if (!role) return;
  var s = slots[+t.dataset.slot];
  if (role === 'cat') { s.id = t.value; s.value = ''; }
  else s.value = t.value;
  render();
});

function submitTypedAnimal() {
  var name = typedAnimal();
  if (!name) return;
  guessAnimal(game, name);
  render();
}

document.addEventListener('input', function (e) {
  if (e.target.id === 'animal-input') $('submit-animal').disabled = !typedAnimal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.id === 'animal-input') submitTypedAnimal();
});

document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePhoto(); });

document.addEventListener('click', function (e) {
  var id = e.target.id;
  var ph = e.target.closest && e.target.closest('[data-photo]');
  if (ph) {
    e.preventDefault();
    if (ph.classList.contains('animal-link')) {            // board name: costs a photo hint (free after the game)
      if (!spendPhotoHint(game, ph.dataset.photo)) return;
      openPhoto(ph.dataset.photo);
      render();                                            // update the counter; names stop being links at 0
    } else {
      openPhoto(ph.dataset.photo);                         // thumbnails / result photo: always free
    }
    return;
  }
  if (e.target.classList.contains('filter-link')) { openFilterInfo(e.target.dataset.filter); return; }
  if (id === 'photo-modal' || e.target.classList.contains('close')) { closePhoto(); return; }
  if (e.target.classList.contains('diff')) {
    applyDifficulty(e.target.dataset.level);
    syncSettingsInputs();
    newGame();
  } else if (e.target.classList.contains('tile-guess')) {          // board: ✓ guess this animal now
    guessAnimal(game, e.target.dataset.name);
    render();
  } else if (e.target.classList.contains('tile-out')) {     // board: ✕ toggle a personal strike-out note
    var nm = e.target.dataset.name;
    if (notes[nm]) delete notes[nm]; else notes[nm] = true;
    renderRemaining();
  } else if (id === 'clear-notes') {
    notes = {};
    renderRemaining();
  } else if (e.target.classList.contains('pick') && $('animal-input')) {   // click a name in the remaining list
    $('animal-input').value = e.target.dataset.name;
    $('submit-animal').disabled = false;
    $('animal-input').focus();
  } else if (id === 'submit-animal') {
    submitTypedAnimal();
  } else if (id === 'submit-guess') {
    submitFilterGuess(game, slots.map(function (s) { return { id: s.id, value: s.value }; }));
    slots.forEach(function (s) { s.id = ''; s.value = ''; });
    notice = '';
    render();
  } else if (id === 'early-guess') {
    var name = $('early-select').value;
    if (!name) return;
    var rec = submitAnimalGuess(game, name);
    notice = rec.correct ? '' : 'Not quite.';
    render();
  } else if (id === 'play-again' || id === 'new-game') {
    newGame();
  } else if (id === 'apply-settings') {
    if (SETTINGS_LOCKED) return;
    DIFFICULTY = 'custom';
    var count = parseInt($('set-count').value, 10) || NUMBER_OF_ANIMALS;
    NUMBER_OF_ANIMALS = Math.max(2, Math.min(count, ANIMALS.length));
    FILTERS_PER_GUESS = Math.max(1, Math.min(parseInt($('set-filters').value, 10) || 3, FILTERS.length));
    MAX_GUESSES = Math.max(1, parseInt($('set-max').value, 10) || 10);
    SHOW_REMAINING_ANIMALS = $('set-show').checked;
    ALLOW_EARLY_GUESS = $('set-early').checked;
    GRAY_ELIMINATES = $('set-gray').checked;
    GAME_MODE = $('set-mode').value;
    BOARD_MODE = $('set-board').checked;
    PHOTO_HINTS = Math.max(0, parseInt($('set-hints').value, 10) || 0);
    REVEALED_TRAITS = Math.max(0, parseInt($('set-reveal').value, 10) || 0);
    REVEAL_STRATEGY = $('set-strategy').value;
    syncSettingsInputs();
    $('settings-note').textContent = count > ANIMALS.length ? 'Pool capped at database size (' + ANIMALS.length + ').' : '';
    newGame();
  }
});

/* Hooks the debug panel can use without knowing UI internals */
function revealAnswer() { revealed = true; render(); }

window.addEventListener('DOMContentLoaded', function () {
  $('debug-root').hidden = !(DEBUG_ENABLED && window.DebugPanel);
  applyDifficulty(DIFFICULTY);
  newGame();
});
