/* ==========================================================
   FAME — how well known each animal is (subjective, DRAFT — edit freely).
     1 = Familiar  (nearly everyone can picture it)
     2 = Known     (most people have heard of it)
     3 = Obscure   (many players will have to think, or won't know it)
   Anything not listed in FAME_FAMILIAR / FAME_OBSCURE is tier 2.
   Sets animal.fame on every entry of ALL_ANIMALS. Depends on: animals.js
   ========================================================== */

var FAME_FAMILIAR = [
  'Lion', 'Tiger', 'Leopard', 'Cheetah', 'African Elephant', 'Giraffe', 'Zebra', 'Hippopotamus', 'White Rhinoceros',
  'Gorilla', 'Chimpanzee', 'Giant Panda', 'Polar Bear', 'Grizzly Bear', 'Gray Wolf', 'Red Fox', 'Gray Squirrel',
  'Red Kangaroo', 'Koala', 'Three-toed Sloth', 'Meerkat', 'Beaver', 'Moose', 'Bottlenose Dolphin', 'Blue Whale', 'Orca',
  'Bald Eagle', 'Crow', 'Ostrich', 'Flamingo', 'Peacock', 'Toucan', 'Hummingbird', 'Scarlet Macaw', 'Emperor Penguin',
  'Wild Turkey', 'Canada Goose',
  'Nile Crocodile', 'Chameleon', 'American Alligator', 'Rattlesnake', 'Komodo Dragon', 'King Cobra', 'Galapagos Tortoise', 'Green Sea Turtle',
  'Great White Shark', 'Clownfish', 'Goldfish', 'Atlantic Salmon',
  'Honeybee', 'Ladybug', 'Garden Snail', 'Earthworm', 'Monarch Butterfly', 'American Lobster', 'Common Octopus', 'Starfish', 'Tarantula', 'Mosquito', 'Blue Crab'
];

var FAME_OBSCURE = [
  'Little Brown Bat', 'European Badger', 'Dingo', 'Canada Lynx', 'Ocelot', 'African Wild Dog', 'Olive Baboon', 'Cape Buffalo', 'Impala',
  'Pronghorn', 'Bighorn Sheep', 'Mountain Goat', 'Short-beaked Echidna', 'Okapi', 'Aardvark', 'Pangolin', 'Tapir', 'Wombat',
  'Hornbill', 'Kookaburra', 'Cassowary', 'Blue-footed Booby', 'Harpy Eagle', 'European Robin', 'Wandering Albatross', 'Peregrine Falcon',
  'Tokay Gecko', 'Nile Monitor', 'Leopard Tortoise', 'Gila Monster', 'Gharial', 'Marine Iguana',
  'Hellbender', 'Chinese Giant Salamander', 'Fire Salamander', 'Tiger Salamander', 'European Common Frog', 'Goliath Frog', "White's Tree Frog",
  'Arapaima', 'Beluga Sturgeon', 'Channel Catfish', 'Great Barracuda',
  'Chambered Nautilus', 'Mantis Shrimp', 'Horseshoe Crab', 'Banana Slug', 'Dung Beetle', 'Desert Locust', 'Leafcutter Ant', 'Emperor Scorpion', 'Stag Beetle', 'Giant Squid'
];

ALL_ANIMALS.forEach(function (a) {
  a.fame = FAME_FAMILIAR.indexOf(a.name) >= 0 ? 1 : FAME_OBSCURE.indexOf(a.name) >= 0 ? 3 : 2;
});
