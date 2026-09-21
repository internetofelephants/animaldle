/* ==========================================================
   FEEDBACK LOGIC — turns (filter, selected value, animal) into a color.
   Pure functions: no DOM, no game state. Edit the rules here.
   ========================================================== */

var RESULT = { GREEN: 'green', YELLOW: 'yellow', GRAY: 'gray' };
var RESULT_EMOJI = { green: '🟩', yellow: '🟨', gray: '⬜' };

var ORDERED_YELLOW_DISTANCE = 1;  // ordered filters: within this many steps → yellow

var FEEDBACK_RULES = {
  // exact match = green; optional def.related map gives yellow; otherwise gray
  categorical: function (def, sel, animal) {
    var v = def.get(animal);
    if (v === sel) return RESULT.GREEN;
    if (def.related && def.related[sel] && def.related[sel].indexOf(v) >= 0) return RESULT.YELLOW;
    return RESULT.GRAY;
  },

  // exact = green, adjacent = yellow, else gray
  ordered: function (def, sel, animal) {
    var d = Math.abs(def.options.indexOf(def.get(animal)) - def.options.indexOf(sel));
    if (d === 0) return RESULT.GREEN;
    if (d <= ORDERED_YELLOW_DISTANCE) return RESULT.YELLOW;
    return RESULT.GRAY;
  },

  // animal has a LIST of values. In list → green (or, if primaryIsGreen, green only for the
  // first entry and yellow for later ones). Not in list → gray.
  multi: function (def, sel, animal) {
    var vals = def.get(animal);
    if (sel === 'None') return vals.length === 0 ? RESULT.GREEN : RESULT.GRAY;   // "no special diet"
    var i = vals.indexOf(sel);
    if (i < 0) return RESULT.GRAY;
    if (def.primaryIsGreen && i > 0) return RESULT.YELLOW;
    return RESULT.GREEN;
  },

  // yes/no traits: green/gray only
  boolean: function (def, sel, animal) {
    return def.get(animal) === sel ? RESULT.GREEN : RESULT.GRAY;
  }
};

function evaluateFilter(def, selectedValue, animal) {
  var rule = def.feedback || FEEDBACK_RULES[def.kind];
  return rule(def, selectedValue, animal);
}

/* Animal-guess mode: how each of the GUESSED animal's values on this filter compares to the target.
   Returns [{ value, result }] — one entry per value (lists like locomotion give several). */
function guessedAttributeFeedback(def, guessed, target) {
  var v = def.get(guessed);
  if (!Array.isArray(v)) v = [v];
  else if (!v.length) v = ['None'];
  return v.map(function (val) { return { value: val, result: evaluateFilter(def, val, target) }; });
}
