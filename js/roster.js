/* ==========================================================
   ROSTER — which animals are playable. Everything else reads ANIMALS, not ALL_ANIMALS.
   Depends on: config.js (REQUIRE_PHOTO), animals.js (ALL_ANIMALS), photos.js (PHOTOS)
   ========================================================== */

function hasApprovedPhoto(animal) {
  return !!(PHOTOS[animal.name] && PHOTOS[animal.name].approved);
}

var ANIMALS = REQUIRE_PHOTO ? ALL_ANIMALS.filter(hasApprovedPhoto) : ALL_ANIMALS.slice();
