/* ==========================================================
   CONFIG — change these and reload (or use the Settings panel)
   ========================================================== */
var GAME_MODE              = 'animal';  // 'animal': guess whole animals, see all their traits colored vs the target
                                        // 'filters': pick FILTERS_PER_GUESS characteristics per guess (original mode)
/* Animal mode only: how much of a guessed animal's profile is revealed */
var REVEALED_TRAITS        = 8;         // characteristics shown per guess (0 or >= total = show all)
var REVEAL_STRATEGY        = 'random';  // 'random': a fresh random subset each guess
                                        // 'fixed' : always the ids in REVEALED_FILTER_IDS (REVEALED_TRAITS ignored)
var REVEALED_FILTER_IDS    = ['class', 'region', 'habitat', 'size', 'diet', 'activity', 'covering', 'social'];

/* Animal mode only: "notebook board". The whole pool is always on screen; the game never removes
   animals or reports how many remain. The player strikes animals out themselves as notes.
   (SHOW_REMAINING_ANIMALS / GRAY_ELIMINATES then only affect the debug panel and simulator.) */
var BOARD_MODE             = true;

var NUMBER_OF_ANIMALS      = 25;// random subset of the master database (capped at database size)
var FILTERS_PER_GUESS      = 3;     // 1–5 to test; each must be from a different characteristic
var MAX_GUESSES            = 6;     // lose when this many guesses are used without finding it
var SHOW_REMAINING_ANIMALS = false; // show the list of names still possible (the count is always shown)
var ALLOW_EARLY_GUESS      = true;  // enable the "Guess the Animal" control
                                    // (if false, you win automatically when only 1 animal remains)

var GRAY_ELIMINATES        = true;  // true: gray removes animals that would have been green/yellow
                                    // false: gray is display-only and removes nothing from the pool

/* Difficulty levels — choosing one sets NUMBER_OF_ANIMALS and REVEALED_TRAITS, then starts a new game */
var DIFFICULTY = 'easy';
var BINARY_CLUE_SHARE = 0.2;   // chance that each revealed trait slot is a yes/no trait (wings, tail, ...)

var DIFFICULTY_LEVELS = [
  { id: 'easy',     label: 'Easy',      animals: 20,  traits: 5 },
  { id: 'medium',   label: 'Medium',    animals: 30,  traits: 4 },
  { id: 'hard',     label: 'Hard',      animals: 50,  traits: 3 },
  { id: 'veryhard', label: 'Very Hard', animals: 100, traits: 3 }
];
var SETTINGS_LOCKED = true;   // true: the Game Settings panel is visible but disabled while difficulty levels are in use

function applyDifficulty(id) {
  var lvl = DIFFICULTY_LEVELS.filter(function (l) { return l.id === id; })[0];
  if (!lvl) return;
  DIFFICULTY = id;
  NUMBER_OF_ANIMALS = lvl.animals;
  REVEALED_TRAITS = lvl.traits;
  REVEAL_STRATEGY = 'random';
}

/* Photos */
var PHOTO_HINTS = 3;         // board mode: how many different animals a player may look up a photo for per game
var REQUIRE_PHOTO = true;     // true: only animals with an approved photo (see js/photos.js) can appear in the game
                              // false: the full database, photo or not

/* Developer options */
var DEBUG_ENABLED  = true;  // false hides the debug panel (or just delete debug.js's <script> tag)
var SIM_GUESS_CAP  = 40;    // safety cap on guesses per game in "Test All Animals"
