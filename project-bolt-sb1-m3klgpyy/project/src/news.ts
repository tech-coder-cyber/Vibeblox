// What's new. Add a new entry at the TOP of NEWS (and bump GAME_VERSION) with every update;
// the News page in the sidebar shows this list, and a dot appears on it until the newest one has been read.
export const GAME_VERSION = 15;

export type NewsEntry = { version: number; date: string; title: string; changes: string[] };

export const NEWS: NewsEntry[] = [
  {
    version: 15,
    date: 'October 10, 2026',
    title: 'Squads, crouching & a brand new Max',
    changes: [
      'EggWars and Bridge Duels: pick Solo, Duos or Squads before you play.',
      'New EggWars shop: Quick Buy plus Armor, Tools, Ranged, Blocks and Utility tabs, and it scrolls.',
      'New Bridge Egg: throw it and a bridge builds itself behind it.',
      'Crouching (hold C): you can not fall off the edge of a block. Crouching and blocking with a sword slow you down and stop you from running.',
      'Suffocation: being inside a solid block now hurts.',
      'Graphics: the old Max is now Epic, and there is a brand new Max with shader-style lighting, bloom, sun rays and more. It is heavy!',
      'Double-click an item in a chest or your inventory to gather every matching item onto your cursor.',
      'Scrolling inside the inventory, scripts, shop and other panels no longer changes your hotbar slot.',
      'Third person: the held item is on the player model again instead of floating like the first-person view.',
      'New News page in the sidebar, and the game now shows its version number.',
    ],
  },
  {
    version: 14,
    date: 'October 6, 2026',
    title: 'EggWars, Bridge Duels & the Hollow Tyrant',
    changes: [
      'New minigames: EggWars and Bridge Duels against bots (easy, normal or hard).',
      'Ice, packed ice and blue ice, boats (with ice boating and pearl pulling), soul sand and soul soil bubble columns, magma blocks.',
      'The Hollow Tyrant boss, the Cinderbone mob, player heads, spawn eggs and the Hollow Star.',
      'Selectors in commands: @s @p @a @r @e, plus /effect and a search box in /help and in Creative.',
      'Minimap and HUD overlays: ping, coordinates, direction, clock and speed.',
      'Real player counts on the home page. The owner account (Master) gets the admin panel.',
    ],
  },
];
