# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Animaldle is a Wordle-style animal deduction game. It is a static page with no build step, bundler, package.json, or test suite: plain ES5 scripts loaded with `<script>` tags in `index.html`, sharing globals. Open `index.html` in a browser (or serve the folder statically) to play. `tools/review.html` fetches `images/images.json`, so serve the repo root over HTTP to use it (e.g. `python3 -m http.server`).

## Commands

```bash
python3 tools/animal_data.py build      # data/animals.xlsx -> js/animals.js + js/fame.js (validates first; needs openpyxl + node)
python3 tools/animal_data.py export     # js -> Excel (recovery only; OVERWRITES the sheet)
node tools/fetch-images.mjs rest        # fetch Wikipedia lead images for animals missing from images/images.json ("all", or "Lion,Tiger" also work)
node tools/set-image.mjs "Animal" "File:Name.jpg"   # replace one animal's photo with a chosen Commons file
node tools/build-photos.mjs             # regenerate js/photos.js from images/images.json (fetch/set-image run this automatically)
node tools/report.mjs                   # list animals whose images need a human look
```

Image shrinking uses macOS `sips`. When an animal's name doesn't resolve to the right Wikipedia page, add a name → page-title override in `tools/wiki-titles.json` (read by `fetch-images.mjs`). Lead images are often composites, drawings or the wrong sex/species, so look at new photos (e.g. `tools/review.html?from=N&to=M`) and swap bad ones with `set-image.mjs`.

## Generated files: never hand-edit

- `js/animals.js` (`ALL_ANIMALS`) and `js/fame.js` (`FAME`, 1=Familiar/2=Known/3=Obscure) are generated from **`data/animals.xlsx`, the source of truth**. Edit the sheet, then run the `build` command.
- `js/photos.js` (`PHOTOS`) is generated from `images/images.json` + `tools/manual-notes.json`. A photo is `approved` only if its licence is ok (PD/CC0/CC BY/CC BY-SA) and it has no entry in `manual-notes.json` (a hand-written note about a bad picture).
- Allowed values for every attribute live in `js/filters.js` (`FILTERS[].options`). `animal_data.py` reads them from there via node to validate the sheet, so a new value must be added in `filters.js` before the sheet can use it.

## Architecture

The script load order in `index.html` is the dependency order. Everything except `ui.js` (and the disabled `debug.js`) is pure logic with no DOM.

- `config.js`: tunable globals (game mode, `DIFFICULTY_LEVELS` with pool size / traits revealed / fame mix, `BINARY_CLUE_SHARE`, `PHOTO_HINTS`, `REQUIRE_PHOTO`). `applyDifficulty()` copies a level into the globals; `engine.currentSettings()` snapshots them into `game.settings`.
- `roster.js`: `ANIMALS` = the playable subset of `ALL_ANIMALS` (only those with approved photos when `REQUIRE_PHOTO`). Game code reads `ANIMALS`, never `ALL_ANIMALS`.
- `filters.js`: the characteristics. Each has a `kind` (`categorical` | `ordered` | `multi` | `boolean`) plus optional `related` (yellow neighbours), `primaryIsGreen`, or a custom `feedback`. Yes/no traits come from `traitFilter()` over `animal.traits`.
- `feedback.js`: `FEEDBACK_RULES` turn (filter, value, animal) into green/yellow/gray. Ordered filters: adjacent = yellow.
- `pool.js`: an animal stays possible iff it would have produced exactly the same feedback as the target for every past guess record.
- `engine.js`: game state and rules. `buildPool` samples by fame tier per the difficulty mix. `revealForGuess` decides which clues a guessed animal reveals: it never repeats a filter+result, skips filters already solved (green seen), shows each yes/no trait only once, and limits yes/no traits to ~`BINARY_CLUE_SHARE` of the slots.
- `sim.js`: "Test All Animals" bot simulator (used by the debug panel).
- `ui.js`: all rendering and DOM state (difficulty buttons, board, struck-out notes, photo hints, info popups, How to play).

**Game modes:** `GAME_MODE = 'animal'` (current) means guessing whole animals and seeing a random subset of their traits colored against the target. `BOARD_MODE` shows the whole pool as a "notebook" the player strikes out by hand; the game itself never removes animals. `'filters'` is the original mode, where the player picks characteristics per guess; it is still supported by the engine.

**Debug panel:** currently disabled. To restore it, uncomment the `debug.js` script tag and `#debug-root` in `index.html`, plus the two `DebugPanel` lines in `js/ui.js`.
