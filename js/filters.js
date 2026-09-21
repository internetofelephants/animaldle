/* ==========================================================
   FILTER DEFINITIONS — what the player can ask about.
   Each filter:
     id      unique key
     label   shown in UI
     group   optgroup heading in UI
     kind    which feedback rule applies (see feedback.js): categorical | ordered | multi | boolean
     options allowed values (for 'ordered' the ORDER MATTERS: low → high)
     get     (animal) => value (or array of values for 'multi')
   Optional per filter:
     related        { value: [values considered "adjacent"] }  → yellow for categorical kinds
     primaryIsGreen for 'multi': green only if it's the first (primary) entry, yellow if elsewhere in the list
     feedback       custom (def, selected, animal) => 'green'|'yellow'|'gray' overriding the kind rule
   No UI or game logic lives here.
   ========================================================== */

function traitFilter(key, label) {
  return {
    id: key, label: label, group: 'Other traits', kind: 'boolean', options: ['Yes', 'No'],
    get: function (a) { return (a.traits || []).indexOf(key) >= 0 ? 'Yes' : 'No'; }
  };
}

var FILTERS = [
  // Taxonomy
  { id: 'class', label: 'Class', group: 'Taxonomy', kind: 'categorical',
    options: ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Invertebrate'],
    get: function (a) { return a.class; } },

  // Geography
  { id: 'region', label: 'Region', group: 'Geography', kind: 'categorical',
    options: ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Polar', 'Worldwide'],
    get: function (a) { return a.region; } },
  { id: 'climate', label: 'Climate', group: 'Geography', kind: 'categorical',
    options: ['Tropical', 'Temperate', 'Desert', 'Polar'],
    get: function (a) { return a.climate; } },

  // Habitat
  { id: 'habitat', label: 'Habitat', group: 'Habitat', kind: 'categorical',
    options: ['Forest', 'Grassland', 'Savanna', 'Desert', 'Wetland', 'Freshwater', 'Ocean', 'Mountain', 'Tundra'],
    related: {
      Grassland: ['Savanna'], Savanna: ['Grassland'],
      Wetland: ['Freshwater'], Freshwater: ['Wetland'],
      Mountain: ['Tundra'], Tundra: ['Mountain']
    },
    get: function (a) { return a.habitat; } },
  { id: 'environment', label: 'Environment', group: 'Habitat', kind: 'ordered',
    options: ['Terrestrial', 'Amphibious', 'Aquatic'],
    get: function (a) { return a.environment; } },

  // Size
  { id: 'size', label: 'Size', group: 'Size', kind: 'ordered',
    options: ['Tiny', 'Small', 'Medium', 'Large', 'Huge'],
    get: function (a) { return a.size; } },

  // Diet
  { id: 'diet', label: 'Diet', group: 'Diet', kind: 'categorical',
    options: ['Herbivore', 'Carnivore', 'Omnivore'],
    get: function (a) { return a.diet; } },
  { id: 'diet2', label: 'Special diet', group: 'Diet', kind: 'multi',
    options: ['Insectivore', 'Piscivore', 'Frugivore'],
    get: function (a) { return a.diet2 || []; } },

  // Activity
  { id: 'activity', label: 'Activity', group: 'Behavior', kind: 'ordered',
    options: ['Diurnal', 'Crepuscular', 'Nocturnal'],
    get: function (a) { return a.activity; } },
  { id: 'social', label: 'Social behavior', group: 'Behavior', kind: 'ordered',
    options: ['Solitary', 'Pair', 'Small group', 'Large group', 'Colony'],
    get: function (a) { return a.social; } },

  // Locomotion & body
  { id: 'locomotion', label: 'Locomotion', group: 'Body', kind: 'multi', primaryIsGreen: true,
    options: ['Walks', 'Swims', 'Flies', 'Climbs', 'Burrows', 'Hops', 'Slithers'],
    get: function (a) { return a.locomotion; } },
  { id: 'covering', label: 'Body covering', group: 'Body', kind: 'categorical',
    options: ['Fur', 'Feathers', 'Scales', 'Shell', 'Exoskeleton', 'Smooth skin'],
    get: function (a) { return a.covering; } },

  // Other traits (yes/no)
  traitFilter('wings', 'Has wings'),
  traitFilter('horns', 'Has horns/antlers'),
  traitFilter('tail', 'Has a tail'),
  traitFilter('shell', 'Has a shell'),
  traitFilter('stripes', 'Has stripes'),
  traitFilter('spots', 'Has spots'),
  traitFilter('snout', 'Has a long snout')
];

function getFilter(id) {
  for (var i = 0; i < FILTERS.length; i++) if (FILTERS[i].id === id) return FILTERS[i];
  return null;
}
