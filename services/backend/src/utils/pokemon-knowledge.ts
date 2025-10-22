/**
 * Pokémon TCG Knowledge Base
 *
 * Reference data for Pokémon Trading Card Game sets, rarities, and patterns.
 * Used for validation and fallback logic in OCR reasoning.
 */

/**
 * Pokémon TCG set information
 */
export interface PokemonSet {
  /** Set symbol or identifier */
  symbol: string;
  /** Years the set was released */
  years: number[];
  /** Alternative names for the set */
  aliases?: string[];
}

/**
 * Comprehensive Pokémon TCG sets with identifiers
 *
 * Complete list of English Pokémon TCG sets for validation and fuzzy matching.
 */
export const POKEMON_SETS: Record<string, PokemonSet> = {
  // Wizards of the Coast Era (1999-2003)
  'Base Set': {
    symbol: 'base',
    years: [1999],
    aliases: ['Base', 'Original Base Set'],
  },
  'Base Set 2': {
    symbol: 'base2',
    years: [2000],
    aliases: ['Base 2'],
  },
  Jungle: {
    symbol: 'jungle',
    years: [1999],
  },
  Fossil: {
    symbol: 'fossil',
    years: [1999],
  },
  'Team Rocket': {
    symbol: 'teamrocket',
    years: [2000],
    aliases: ['Rocket'],
  },
  'Gym Heroes': {
    symbol: 'gymheroes',
    years: [2000],
  },
  'Gym Challenge': {
    symbol: 'gymchallenge',
    years: [2000],
  },
  'Neo Genesis': {
    symbol: 'neogenesis',
    years: [2000],
  },
  'Neo Discovery': {
    symbol: 'neodiscovery',
    years: [2001],
  },
  'Neo Revelation': {
    symbol: 'neorevelation',
    years: [2001],
  },
  'Neo Destiny': {
    symbol: 'neodestiny',
    years: [2002],
  },
  'Legendary Collection': {
    symbol: 'legendary',
    years: [2002],
  },
  'Expedition Base Set': {
    symbol: 'expedition',
    years: [2002],
    aliases: ['Expedition'],
  },
  Aquapolis: {
    symbol: 'aquapolis',
    years: [2003],
  },
  Skyridge: {
    symbol: 'skyridge',
    years: [2003],
  },

  // EX Era (2003-2007)
  'EX Ruby & Sapphire': {
    symbol: 'ex1',
    years: [2003],
    aliases: ['Ruby Sapphire'],
  },
  'EX Sandstorm': {
    symbol: 'ex2',
    years: [2003],
  },
  'EX Dragon': {
    symbol: 'ex3',
    years: [2003],
  },
  'EX Team Magma vs Team Aqua': {
    symbol: 'ex4',
    years: [2004],
    aliases: ['Magma vs Aqua'],
  },
  'EX Hidden Legends': {
    symbol: 'ex5',
    years: [2004],
  },
  'EX FireRed & LeafGreen': {
    symbol: 'ex6',
    years: [2004],
    aliases: ['FireRed LeafGreen', 'FRLG'],
  },
  'EX Team Rocket Returns': {
    symbol: 'ex7',
    years: [2004],
    aliases: ['Rocket Returns'],
  },
  'EX Deoxys': {
    symbol: 'ex8',
    years: [2005],
  },
  'EX Emerald': {
    symbol: 'ex9',
    years: [2005],
  },
  'EX Unseen Forces': {
    symbol: 'ex10',
    years: [2005],
  },
  'EX Delta Species': {
    symbol: 'ex11',
    years: [2005],
  },
  'EX Legend Maker': {
    symbol: 'ex12',
    years: [2006],
  },
  'EX Holon Phantoms': {
    symbol: 'ex13',
    years: [2006],
  },
  'EX Crystal Guardians': {
    symbol: 'ex14',
    years: [2006],
  },
  'EX Dragon Frontiers': {
    symbol: 'ex15',
    years: [2006],
  },
  'EX Power Keepers': {
    symbol: 'ex16',
    years: [2007],
  },

  // Diamond & Pearl Era (2007-2009)
  'Diamond & Pearl': {
    symbol: 'dp1',
    years: [2007],
    aliases: ['DP Base'],
  },
  'Mysterious Treasures': {
    symbol: 'dp2',
    years: [2007],
  },
  'Secret Wonders': {
    symbol: 'dp3',
    years: [2007],
  },
  'Great Encounters': {
    symbol: 'dp4',
    years: [2008],
  },
  'Majestic Dawn': {
    symbol: 'dp5',
    years: [2008],
  },
  'Legends Awakened': {
    symbol: 'dp6',
    years: [2008],
  },
  Stormfront: {
    symbol: 'dp7',
    years: [2008],
  },

  // Platinum Era (2009-2010)
  Platinum: {
    symbol: 'pl1',
    years: [2009],
  },
  'Rising Rivals': {
    symbol: 'pl2',
    years: [2009],
  },
  'Supreme Victors': {
    symbol: 'pl3',
    years: [2009],
  },
  Arceus: {
    symbol: 'pl4',
    years: [2009],
  },

  // HeartGold & SoulSilver Era (2010-2011)
  'HeartGold & SoulSilver': {
    symbol: 'hgss1',
    years: [2010],
    aliases: ['HGSS Base'],
  },
  Unleashed: {
    symbol: 'hgss2',
    years: [2010],
  },
  Undaunted: {
    symbol: 'hgss3',
    years: [2010],
  },
  Triumphant: {
    symbol: 'hgss4',
    years: [2010],
  },
  'Call of Legends': {
    symbol: 'col',
    years: [2011],
  },

  // Black & White Era (2011-2013)
  'Black & White': {
    symbol: 'bw1',
    years: [2011],
    aliases: ['BW Base'],
  },
  'Emerging Powers': {
    symbol: 'bw2',
    years: [2011],
  },
  'Noble Victories': {
    symbol: 'bw3',
    years: [2011],
  },
  'Next Destinies': {
    symbol: 'bw4',
    years: [2012],
  },
  'Dark Explorers': {
    symbol: 'bw5',
    years: [2012],
  },
  'Dragons Exalted': {
    symbol: 'bw6',
    years: [2012],
  },
  'Boundaries Crossed': {
    symbol: 'bw7',
    years: [2012],
  },
  'Plasma Storm': {
    symbol: 'bw8',
    years: [2013],
  },
  'Plasma Freeze': {
    symbol: 'bw9',
    years: [2013],
  },
  'Plasma Blast': {
    symbol: 'bw10',
    years: [2013],
  },
  'Legendary Treasures': {
    symbol: 'bw11',
    years: [2013],
  },

  // XY Era (2014-2016)
  XY: {
    symbol: 'xy1',
    years: [2014],
    aliases: ['XY Base'],
  },
  FlashFire: {
    symbol: 'xy2',
    years: [2014],
  },
  'Furious Fists': {
    symbol: 'xy3',
    years: [2014],
  },
  'Phantom Forces': {
    symbol: 'xy4',
    years: [2014],
  },
  'Primal Clash': {
    symbol: 'xy5',
    years: [2015],
  },
  'Roaring Skies': {
    symbol: 'xy6',
    years: [2015],
  },
  'Ancient Origins': {
    symbol: 'xy7',
    years: [2015],
  },
  BREAKthrough: {
    symbol: 'xy8',
    years: [2015],
  },
  BREAKpoint: {
    symbol: 'xy9',
    years: [2016],
  },
  'Fates Collide': {
    symbol: 'xy10',
    years: [2016],
  },
  'Steam Siege': {
    symbol: 'xy11',
    years: [2016],
  },
  Evolutions: {
    symbol: 'xy12',
    years: [2016],
  },

  // Sun & Moon Era (2017-2019)
  'Sun & Moon': {
    symbol: 'sm1',
    years: [2017],
    aliases: ['SM Base'],
  },
  'Guardians Rising': {
    symbol: 'sm2',
    years: [2017],
  },
  'Burning Shadows': {
    symbol: 'sm3',
    years: [2017],
  },
  'Crimson Invasion': {
    symbol: 'sm4',
    years: [2017],
  },
  'Ultra Prism': {
    symbol: 'sm5',
    years: [2018],
  },
  'Forbidden Light': {
    symbol: 'sm6',
    years: [2018],
  },
  'Celestial Storm': {
    symbol: 'sm7',
    years: [2018],
  },
  'Lost Thunder': {
    symbol: 'sm8',
    years: [2018],
  },
  'Team Up': {
    symbol: 'sm9',
    years: [2019],
  },
  'Unbroken Bonds': {
    symbol: 'sm10',
    years: [2019],
  },
  'Unified Minds': {
    symbol: 'sm11',
    years: [2019],
  },
  'Cosmic Eclipse': {
    symbol: 'sm12',
    years: [2019],
  },

  // Sword & Shield Era (2020-2023)
  'Sword & Shield': {
    symbol: 'swsh1',
    years: [2020],
    aliases: ['SWSH Base'],
  },
  'Rebel Clash': {
    symbol: 'swsh2',
    years: [2020],
  },
  'Darkness Ablaze': {
    symbol: 'swsh3',
    years: [2020],
  },
  'Vivid Voltage': {
    symbol: 'swsh4',
    years: [2020],
  },
  'Shining Fates': {
    symbol: 'swsh45',
    years: [2021],
  },
  'Battle Styles': {
    symbol: 'swsh5',
    years: [2021],
  },
  'Chilling Reign': {
    symbol: 'swsh6',
    years: [2021],
  },
  'Evolving Skies': {
    symbol: 'swsh7',
    years: [2021],
  },
  'Fusion Strike': {
    symbol: 'swsh8',
    years: [2021],
  },
  'Brilliant Stars': {
    symbol: 'swsh9',
    years: [2022],
  },
  'Astral Radiance': {
    symbol: 'swsh10',
    years: [2022],
  },
  'Lost Origin': {
    symbol: 'swsh11',
    years: [2022],
  },
  'Silver Tempest': {
    symbol: 'swsh12',
    years: [2022],
  },
  'Crown Zenith': {
    symbol: 'swsh125',
    years: [2023],
  },

  // Scarlet & Violet Era (2023-Present)
  'Scarlet & Violet': {
    symbol: 'sv1',
    years: [2023],
    aliases: ['SV Base'],
  },
  'Paldea Evolved': {
    symbol: 'sv2',
    years: [2023],
  },
  'Obsidian Flames': {
    symbol: 'sv3',
    years: [2023],
  },
  '151': {
    symbol: 'sv35',
    years: [2023],
    aliases: ['Pokemon 151', 'One Fifty One'],
  },
  'Paradox Rift': {
    symbol: 'sv4',
    years: [2023],
  },
  'Paldean Fates': {
    symbol: 'sv45',
    years: [2024],
  },
  'Temporal Forces': {
    symbol: 'sv5',
    years: [2024],
  },
  'Twilight Masquerade': {
    symbol: 'sv6',
    years: [2024],
  },
  'Shrouded Fable': {
    symbol: 'sv65',
    years: [2024],
  },
  'Stellar Crown': {
    symbol: 'sv7',
    years: [2024],
  },
  'Surging Sparks': {
    symbol: 'sv8',
    years: [2024],
  },
  'Prismatic Evolutions': {
    symbol: 'sv85',
    years: [2025],
  },
};

/**
 * Rarity indicators and patterns
 *
 * Maps rarity levels to common text patterns found on cards.
 */
export const RARITY_PATTERNS: Record<string, string[]> = {
  Common: ['common', '●', 'circle'],
  Uncommon: ['uncommon', '◆', 'diamond'],
  Rare: ['rare', '★', 'star'],
  'Holo Rare': ['holo rare', 'holographic', 'holo', 'shiny'],
  'Reverse Holo': ['reverse holo', 'reverse holographic'],
  'Ultra Rare': ['ultra rare', 'ur'],
  'Secret Rare': ['secret rare', 'sr'],
  'Rare Holo EX': ['ex', 'holo ex'],
  'Rare Holo GX': ['gx', 'holo gx'],
  'Rare Holo V': ['v', 'holo v'],
  'Rare Holo VMAX': ['vmax', 'holo vmax'],
  'Rare Holo VSTAR': ['vstar', 'holo vstar'],
  'Amazing Rare': ['amazing rare', 'amazing'],
  'Radiant Rare': ['radiant', 'radiant rare'],
  'Illustration Rare': ['illustration rare', 'ir'],
  'Special Illustration Rare': ['special illustration rare', 'sir'],
  'Hyper Rare': ['hyper rare', 'hr'],
};

/**
 * Copyright text patterns by era
 *
 * Regular expressions to identify card era from copyright text.
 * Useful for narrowing down set possibilities.
 */
export const COPYRIGHT_PATTERNS: Record<string, RegExp> = {
  'WOTC Era (1999-2003)': /©\s*199[5-9].*Wizards/i,
  'WOTC Era Alt': /©.*Wizards.*199[5-9]/i,
  'Nintendo Era (2003-2016)': /©.*Nintendo.*Creatures.*GAMEFREAK/i,
  'Modern Era (2016+)': /©.*Pokémon.*©.*Nintendo/i,
  'Modern Era Alt': /©.*Nintendo.*©.*Creatures/i,
  'TPCi Era': /©.*The Pokémon Company International/i,
};

/**
 * Common collector number patterns
 *
 * Regular expressions to extract collector numbers from text.
 */
export const COLLECTOR_NUMBER_PATTERNS: RegExp[] = [
  /\b(\d{1,3})\/(\d{1,3})\b/, // Standard format: 25/102
  /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/, // With spaces: 25 / 102
  /\bNo\.\s*(\d{1,3})\/(\d{1,3})\b/i, // With "No.": No. 25/102
];

/**
 * Determine card era from copyright text
 *
 * @param copyrightText - Copyright text from card
 * @returns Era name or null if not determined
 */
export function determineEra(copyrightText: string): string | null {
  for (const [era, pattern] of Object.entries(COPYRIGHT_PATTERNS)) {
    if (pattern.test(copyrightText)) {
      return era;
    }
  }
  return null;
}

/**
 * Extract collector number from text
 *
 * @param text - Text that may contain collector number
 * @returns Collector number in format "XX/YYY" or null
 */
export function extractCollectorNumber(text: string): string | null {
  for (const pattern of COLLECTOR_NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

/**
 * Check if text indicates holographic card
 *
 * @param text - Text to check for holo indicators
 * @returns True if text suggests holographic finish
 */
export function isHolographicIndicator(text: string): boolean {
  const lowerText = text.toLowerCase();
  const holoKeywords = ['holo', 'holographic', 'shiny', 'foil', 'reverse'];
  return holoKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Get set names that match a given year
 *
 * @param year - Year to search for
 * @returns Array of set names released in that year
 */
export function getSetsByYear(year: number): string[] {
  return Object.entries(POKEMON_SETS)
    .filter(([_, set]) => set.years.includes(year))
    .map(([name, _]) => name);
}

/**
 * Find set by symbol
 *
 * @param symbol - Set symbol to search for
 * @returns Set name or null if not found
 */
export function findSetBySymbol(symbol: string): string | null {
  const normalizedSymbol = symbol.toLowerCase().trim();

  for (const [name, set] of Object.entries(POKEMON_SETS)) {
    if (set.symbol.toLowerCase() === normalizedSymbol) {
      return name;
    }
  }

  return null;
}
