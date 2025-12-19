"use client";

import { useState, useRef, useEffect, useMemo } from "react";

// Comprehensive Magic card types from Scryfall
const MAGIC_TYPES = {
  "Card Types": [
    "Artifact",
    "Battle",
    "Conspiracy",
    "Creature",
    "Dungeon",
    "Emblem",
    "Enchantment",
    "Hero",
    "Instant",
    "Kindred",
    "Land",
    "Phenomenon",
    "Plane",
    "Planeswalker",
    "Scheme",
    "Sorcery",
    "Vanguard",
  ],
  Supertypes: [
    "Basic",
    "Elite",
    "Legendary",
    "Ongoing",
    "Snow",
    "Token",
    "World",
  ],
  "Artifact Types": [
    "Attraction",
    "Blood",
    "Bobblehead",
    "Clue",
    "Contraption",
    "Equipment",
    "Food",
    "Fortification",
    "Gold",
    "Incubator",
    "Infinity",
    "Junk",
    "Map",
    "Powerstone",
    "Stone",
    "Treasure",
    "Vehicle",
    "Spacecraft",
  ],
  "Enchantment Types": [
    "Aura",
    "Background",
    "Cartouche",
    "Case",
    "Class",
    "Curse",
    "Role",
    "Room",
    "Rune",
    "Saga",
    "Shard",
    "Shrine",
  ],
  "Land Types": [
    "Cave",
    "Cloud",
    "Desert",
    "Forest",
    "Gate",
    "Island",
    "Lair",
    "Locus",
    "Mine",
    "Mountain",
    "Sphere",
    "Plains",
    "Planet",
    "Power-Plant",
    "Swamp",
    "Tower",
    "Town",
    "Urza's",
  ],
  "Spell Types": ["Adventure", "Arcane", "Chorus", "Lesson", "Omen", "Trap"],
  "Planeswalker Types": [
    "Abian",
    "Ajani",
    "Aminatou",
    "Angrath",
    "Arlinn",
    "Ashiok",
    "B.O.B.",
    "Bahamut",
    "Basri",
    "Bolas",
    "Calix",
    "Chandra",
    "Comet",
    "Dack",
    "Dakkon",
    "Daretti",
    "Davriel",
    "Deb",
    "Dihada",
    "Domri",
    "Dovin",
    "Duck",
    "Dungeon",
    "Ellywick",
    "Elminster",
    "Elspeth",
    "Equipment",
    "Ersta",
    "Estrid",
    "Freyalise",
    "Garruk",
    "Gideon",
    "Grist",
    "Guff",
    "Huatli",
    "Inzerva",
    "Jace",
    "Jared",
    "Jaya",
    "Jeska",
    "Kaito",
    "Karn",
    "Kasmina",
    "Kaya",
    "Kiora",
    "Koth",
    "Liliana",
    "Lolth",
    "Lukka",
    "Luxior",
    "Master",
    "Minsc",
    "Mordenkainen",
    "Nahiri",
    "Narset",
    "Niko",
    "Nissa",
    "Nixilis",
    "Oko",
    "Quintorius",
    "Ral",
    "Rowan",
    "Saheeli",
    "Samut",
    "Sarkhan",
    "Serra",
    "Sivitri",
    "Sorin",
    "Svega",
    "Szat",
    "Tamiyo",
    "Tasha",
    "Teferi",
    "Teyo",
    "Tezzeret",
    "Tibalt",
    "Tyvar",
    "Ugin",
    "Urza",
    "Venser",
    "Vivien",
    "Vraska",
    "Vronos",
    "Wanderer",
    "Will",
    "Windgrace",
    "Wrenn",
    "Xenagos",
    "Yanggu",
    "Yanling",
    "Zariel",
  ],
  "Creature Types": [
    "Advisor",
    "Aetherborn",
    "Alicorn",
    "Alien",
    "Ally",
    "Angel",
    "Antelope",
    "Ape",
    "Archer",
    "Archon",
    "Armadillo",
    "Armored",
    "Army",
    "Art",
    "Artifact",
    "Artificer",
    "Artist",
    "Assassin",
    "Assembly-Worker",
    "Astartes",
    "Athlete",
    "Atog",
    "Aurochs",
    "Autobot",
    "Automaton",
    "Avatar",
    "Azra",
    "Badger",
    "Balloon",
    "Barbarian",
    "Bard",
    "Basilisk",
    "Bat",
    "Bear",
    "Beast",
    "Beaver",
    "Beeble",
    "Beholder",
    "Berserker",
    "Bird",
    "Bison",
    "Blinkmoth",
    "Boar",
    "Boxer",
    "Brainiac",
    "Bringer",
    "Brushwagg",
    "Bureaucrat",
    "C'tan",
    "Camarid",
    "Camel",
    "Capybara",
    "Caribou",
    "Carrier",
    "Cat",
    "Centaur",
    "Cephalid",
    "Chameleon",
    "Champion",
    "Chef",
    "Chicken",
    "Child",
    "Chimera",
    "Citizen",
    "Clamfolk",
    "Cleric",
    "Clown",
    "Cockatrice",
    "Construct",
    "Cow",
    "Coward",
    "Coyote",
    "Crab",
    "Crocodile",
    "Custodes",
    "Cyberman",
    "Cyborg",
    "Cyclops",
    "Dalek",
    "Dauthi",
    "Deer",
    "Demigod",
    "Demon",
    "Deserter",
    "Designer",
    "Detective",
    "Devil",
    "Dinosaur",
    "Djinn",
    "Doctor",
    "Dog",
    "Donkey",
    "Dragon",
    "Drake",
    "Dreadnought",
    "Drix",
    "Drone",
    "Druid",
    "Dryad",
    "Dwarf",
    "Echidna",
    "Efreet",
    "Egg",
    "Elder",
    "Eldrazi",
    "Elemental",
    "Elephant",
    "Elf",
    "Elk",
    "Elves",
    "Employee",
    "Etiquette",
    "Eye",
    "Faerie",
    "Ferret",
    "Fish",
    "Flagbearer",
    "Fox",
    "Fractal",
    "Frog",
    "Fungus",
    "Gamer",
    "Gargoyle",
    "Germ",
    "Giant",
    "Gith",
    "Glimmer",
    "Gnoll",
    "Gnome",
    "Goat",
    "Goblin",
    "God",
    "Golem",
    "Gorgon",
    "Grandchild",
    "Graveborn",
    "Gremlin",
    "Griffin",
    "Guest",
    "Gus",
    "Hag",
    "Halfling",
    "Hamster",
    "Harpy",
    "Hatificer",
    "Hawk",
    "Head",
    "Hedgehog",
    "Hellion",
    "Hero",
    "Hippo",
    "Hippogriff",
    "Homarid",
    "Homunculus",
    "Hornet",
    "Horror",
    "Horse",
    "Human",
    "Hydra",
    "Hyena",
    "Illusion",
    "Imp",
    "Incarnation",
    "Inkling",
    "Inquisitor",
    "Insect",
    "Jackal",
    "Jellyfish",
    "Judge",
    "Juggernaut",
    "Kangaroo",
    "Kavu",
    "Killbot",
    "Kirin",
    "Kithkin",
    "Knight",
    "Kobold",
    "Kor",
    "Kraken",
    "Lady",
    "Lamia",
    "Lammasu",
    "Leech",
    "Lemur",
    "Leviathan",
    "Lhurgoyf",
    "Licid",
    "Lizard",
    "Lobster",
    "Mammoth",
    "Manticore",
    "Masticore",
    "Mercenary",
    "Merfolk",
    "Metathran",
    "Mime",
    "Minion",
    "Minotaur",
    "Mite",
    "Mole",
    "Monger",
    "Mongoose",
    "Monk",
    "Monkey",
    "Moogle",
    "Moonfolk",
    "Mount",
    "Mouse",
    "Mummy",
    "Mutant",
    "Myr",
    "Mystic",
    "Naga",
    "Nautilus",
    "Necron",
    "Nephilim",
    "Nightmare",
    "Nightstalker",
    "Ninja",
    "Noble",
    "Noggle",
    "Nomad",
    "Nymph",
    "Octopus",
    "Ogre",
    "Ooze",
    "Orb",
    "Orc",
    "Orgg",
    "Otter",
    "Ouphe",
    "Ox",
    "Oyster",
    "Pangolin",
    "Paratrooper",
    "Peasant",
    "Pegasus",
    "Pentavite",
    "Performer",
    "Pest",
    "Phelddagrif",
    "Phoenix",
    "Phyrexian",
    "Pilot",
    "Pincher",
    "Pirate",
    "Plant",
    "Pony",
    "Porcupine",
    "Possum",
    "Praetor",
    "Primarch",
    "Prism",
    "Processor",
    "Proper",
    "Qu",
    "Rabbit",
    "Raccoon",
    "Ranger",
    "Rat",
    "Rebel",
    "Reflection",
    "Reveler",
    "Rhino",
    "Rigger",
    "Robot",
    "Rogue",
    "Rukh",
    "Sable",
    "Salamander",
    "Samurai",
    "Sand",
    "Saproling",
    "Satyr",
    "Scarecrow",
    "Scientist",
    "Scion",
    "Scorpion",
    "Scout",
    "Sculpture",
    "Seal",
    "Serf",
    "Serpent",
    "Servo",
    "Shade",
    "Shaman",
    "Shapeshifter",
    "Shark",
    "Sheep",
    "Ship",
    "Siren",
    "Skeleton",
    "Skunk",
    "Slith",
    "Sliver",
    "Sloth",
    "Slug",
    "Snail",
    "Snake",
    "Soldier",
    "Soltari",
    "Spawn",
    "Specter",
    "Spellshaper",
    "Sphinx",
    "Spider",
    "Spike",
    "Spirit",
    "Splinter",
    "Sponge",
    "Spuzzem",
    "Spy",
    "Squid",
    "Squirrel",
    "Starfish",
    "Surrakar",
    "Survivor",
    "Symbiote",
    "Synth",
    "Teddy",
    "Tentacle",
    "Tetravite",
    "Thalakos",
    "The",
    "Thopter",
    "Thrull",
    "Tiefling",
    "Time Lord",
    "Townsfolk",
    "Toy",
    "Tree",
    "Treefolk",
    "Trilobite",
    "Triskelavite",
    "Troll",
    "Turtle",
    "Tyranid",
    "Unicorn",
    "Urzan",
    "Vampire",
    "Vampyre",
    "Varmint",
    "Vedalken",
    "Villain",
    "Volver",
    "Waiter",
    "Wall",
    "Walrus",
    "Warlock",
    "Warrior",
    "Wasp",
    "Weasel",
    "Weird",
    "Werewolf",
    "Whale",
    "Wizard",
    "Wolf",
    "Wolverine",
    "Wombat",
    "Worm",
    "Wraith",
    "Wrestler",
    "Wurm",
    "Yeti",
    "Zombie",
    "Zonian",
    "Zubera",
  ],
};

// Flatten all types for search
const ALL_TYPES = Object.entries(MAGIC_TYPES).flatMap(([category, types]) =>
  types.map((type) => ({ type, category }))
);

interface TypeSearchFieldProps {
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
}

export function TypeSearchField({
  selectedTypes,
  onTypeChange,
}: TypeSearchFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter types based on input using useMemo (derived state)
  const filteredTypes = useMemo(() => {
    if (!inputValue.trim()) {
      return [];
    }
    return ALL_TYPES.filter(({ type }) =>
      type.toLowerCase().includes(inputValue.toLowerCase())
    ).slice(0, 50); // Limit to 50 results for performance
  }, [inputValue]);

  // Compute whether dropdown should be shown (derived from filteredTypes)
  const shouldShowDropdown = showDropdown && filteredTypes.length > 0;

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTypeSelect = (type: string) => {
    if (!selectedTypes.includes(type)) {
      onTypeChange([...selectedTypes, type]);
    }
    setInputValue("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveType = (typeToRemove: string) => {
    onTypeChange(selectedTypes.filter((type) => type !== typeToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      setInputValue("");
    }
  };

  // Group filtered types by category
  const groupedTypes = filteredTypes.reduce((acc, { type, category }) => {
    if (!acc[category]) acc[category] = [];
    acc[category].push(type);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="space-y-2">
      {/* Selected Types Display */}
      {selectedTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTypes.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 px-2 py-1 bg-[#4ade80] text-black text-xs border border-[#4ade80]"
            >
              {type}
              <button
                onClick={() => handleRemoveType(type)}
                className="hover:text-red-600 transition-colors"
                title={`Remove ${type}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search for card types"
          className="w-full px-3 py-2 bg-[#2a2a2a] text-[#e5e5e5] border border-[#404040] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30 focus:outline-none transition-all duration-200 text-sm"
        />

        {/* Dropdown */}
        {shouldShowDropdown && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#2a2a2a] border border-[#404040] max-h-64 overflow-y-auto"
          >
            {Object.entries(groupedTypes).map(([category, types]) => (
              <div key={category}>
                <div className="px-3 py-2 bg-[#1a1a1a] text-[#cccccc] text-xs font-semibold border-b border-[#404040]">
                  {category}
                </div>
                {types.map((type) => (
                  <button
                    key={`${category}-${type}`}
                    onClick={() => handleTypeSelect(type)}
                    disabled={selectedTypes.includes(type)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      selectedTypes.includes(type)
                        ? "bg-[#374151] text-[#6b7280] cursor-not-allowed"
                        : "text-[#e5e5e5] hover:bg-[#3a3a3a]"
                    }`}
                  >
                    {type}
                    {selectedTypes.includes(type) && (
                      <span className="ml-2 text-xs text-[#6b7280]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
