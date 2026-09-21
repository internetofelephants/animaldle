/* ==========================================================
   REMAINING-ANIMAL CALCULATION
   An animal remains possible iff, for every past guess, it would have produced
   exactly the same feedback the real target produced.
   The target always produces its own feedback, so it can never be eliminated.
   Guess records:
     { type:'filters', filters:[{ id, value, result }] }
     { type:'animal',  name, correct }
   ========================================================== */

function isConsistent(animal, record) {
  if (record.type === 'animal') return record.correct ? animal.name === record.name : animal.name !== record.name;
  for (var i = 0; i < record.filters.length; i++) {
    var f = record.filters[i];
    if (f.result === RESULT.GRAY && !GRAY_ELIMINATES) continue;   // gray carries no elimination
    if (evaluateFilter(getFilter(f.id), f.value, animal) !== f.result) return false;
  }
  return true;
}

function computeRemaining(pool, history) {
  return pool.filter(function (a) {
    for (var i = 0; i < history.length; i++) if (!isConsistent(a, history[i])) return false;
    return true;
  });
}
