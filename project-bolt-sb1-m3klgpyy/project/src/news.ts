// What's new. Add a new entry at the TOP of NEWS (and bump GAME_VERSION) with every update;
// the News page in the sidebar shows this list, and a dot appears on it until the newest one has been read.
export const GAME_VERSION = 17;

export type NewsEntry = { version: number; date: string; title: string; changes: string[] };

export const NEWS: NewsEntry[] = [
  {
    version: 17,
    date: 'October 11, 2026',
    title: 'Join friends, Leaderboard, Rising Creator & pistons',
    changes: [
      'Friends: when a friend is playing on a server, a Join button appears next to them in Social. One click and you are in their world.',
      'Leaderboard in the sidebar: the players with the most plays. A play is another player joining a world you host.',
      'Rising Creator: reach 1,000 plays and you unlock it. Your scripts get a little more CPU time per tick, and your world holds 24 players instead of 18.',
      'Custom skins: P2W Champion rank can upload their own 64x64 skin in the Shop, and other players see it.',
      'The owner account is now Master_at_Pvp. Usernames are only reserved once you have verified your email, so an unverified sign-up no longer takes a name.',
      'Change your username once a week in Social.',
      'The coins on the right of the sidebar are now the same coins you spend in the Shop.',
      'Redstone: Block of Redstone (always powered), Piston (pushes up to 12 blocks, the way you faced) and Sticky Piston (pulls the block in front of it back). Chests, furnaces, doors, obsidian and bedrock stay put. Pistons rest in minigames.',
    ],
  },
  {
    version: 16,
    date: 'October 10, 2026',
    title: 'OneBlock, your own keys & 15 languages',
    changes: [
      'OneBlock is real: one block floating in the void. Break it and it comes back as the next block, through 7 phases (Overworld, Mining, Frozen Peaks, Desert, Nether, Ancient Vault and Endless), with mobs and a chest every 25 blocks.',
      'Settings > Controls: change any key (jump, sprint, crouch, walking, inventory, drop, swap hands). Want Shift to jump? Click Jump, press Shift.',
      'Crouch is now Left Alt by default.',
      'Settings > Language: English, Spanish, Portuguese, French, German, Russian, Chinese, Japanese, Korean, Hindi, Turkish, Indonesian, Italian, Polish and Vietnamese. Item and block names stay in English for now.',
      'Shops: the mouse is free while a shop is open, and the inventory key (E) closes the shop instead of opening your inventory.',
      'EggWars and Bridge Duels: the Esc menu only shows Resume, Settings and Exit Game, and there are no commands, cheats, scripts, mods or server settings.',
      'Worlds you do not own (joined servers where you are not the host) have no commands, cheats, mods, scripts or Manage Server either.',
      'Advancements only count in survival worlds: none in creative, adventure, EggWars or Bridge Duels, and the button is hidden there.',
      'Better hand animation: items rise into your hand when you switch, the hand breathes while you stand, dips when you sprint and crouch, and swords wind up before a faster, smoother swing.',
    ],
  },
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
      'Real player counts on the home page. The owner account (Master_at_Pvp) gets the admin panel.',
    ],
  },
];
