// Minecraft-style advancements. Each planet keeps its own list (like Minecraft worlds do),
// and a toast slides in at the top right the moment one is earned.
//
// Most are earned by HAVING an item (crafted, smelted, picked up, traded or given): the game
// checks your inventory, armor and off-hand whenever they change. The rest come from game
// events (going to the Nether, killing a monster, eating, trading, sleeping...).
import {
  BLOCK_WOOD, BLOCK_CRAFTING_TABLE, BLOCK_STONE, BLOCK_FURNACE, BLOCK_OBSIDIAN,
  ITEM_WOOD_PICKAXE, ITEM_WOOD_SWORD, ITEM_STONE_PICKAXE, ITEM_IRON_PICKAXE,
  ITEM_IRON_INGOT, ITEM_DIAMOND, ITEM_EMERALD, ITEM_LAVA_BUCKET, ITEM_BLAZE_ROD, ITEM_BREAD,
  ITEM_ENDER_PEARL, ITEM_INFERNIUM_INGOT, ITEM_BED, ITEM_SPYGLASS,
  ITEM_ENCHANTED_BOOK, ARMOR, isLog, type ItemStack,
  ITEM_BOW, ITEM_ARROW, ITEM_STRING, ITEM_REDSTONE, ITEM_LAPIS, ITEM_FISHING_ROD, ITEM_SHEARS, ITEM_WATER_BUCKET, ITEM_QUARTZ,
  ITEM_GHAST_TEAR, ITEM_BOOK, ITEM_BOAT, ITEM_GOLD_INGOT, ITEM_DIAMOND_SWORD, ITEM_FLINT_AND_STEEL, ITEM_BONE, ITEM_STEAK,
  BLOCK_BOOKSHELF, BLOCK_ENCHANTING_TABLE, BLOCK_ANVIL, BLOCK_PISTON, BLOCK_REDSTONE_LAMP, BLOCK_COMPARATOR, BLOCK_REPEATER,
  BLOCK_TNT, BLOCK_CAMPFIRE, BLOCK_BLUE_ICE, BLOCK_BREWING_STAND, BLOCK_REDSTONE_BLOCK, BLOCK_LEVER, BLOCK_GLOWSTONE, BLOCK_CHEST,
  BLOCK_DIAMOND_BLOCK, BLOCK_IRON_BLOCK, isPotionItem, ITEM_INFERNIUM_INGOT as INFERNIUM, ITEM_DIAMOND as DIAMOND, ITEM_EMERALD as EMERALD, ITEM_GHAST_TEAR as TEAR, ITEM_IRON_INGOT as IRON, ITEM_BLAZE_ROD as ROD, ITEM_ENDER_PEARL as PEARL,
} from './voxelGame';

export type AdvancementTab = 'story' | 'nether' | 'adventure' | 'husbandry';
/** What a hard advancement hands you the moment you earn it (the easy ones give nothing). */
export type AdvReward = { xp: number; items?: Array<[number, number]> };
export type Advancement = {
  id: string;
  title: string;
  description: string;
  icon: number;           // item id drawn on the toast
  tab: AdvancementTab;
  goal?: boolean;         // a bigger one: the toast says "Goal Reached!"
  challenge?: boolean;    // the hardest: "Challenge Complete!" in purple
  experimental?: boolean; // only exists in planets made with experimental features
  /** Hard ones pay out: experience and sometimes items. */
  reward?: AdvReward;
  /** Earned by holding an item that passes this test. */
  item?: (id: number) => boolean;
  /** Earned by a game event. */
  event?: (name: string, data: Record<string, unknown>) => boolean;
};

const HOSTILE = new Set(['zombie', 'skeleton', 'creeper', 'spider', 'ghast', 'blaze', 'piglin']);
const is = (...ids: number[]) => (id: number) => ids.includes(id);

export const ADVANCEMENTS: Advancement[] = [
  // ---- Story ----
  { id: 'getting_wood', title: 'Getting Wood', description: 'Punch a tree until a log pops out', icon: BLOCK_WOOD, tab: 'story', item: isLog },
  { id: 'benchmarking', title: 'Benchmarking', description: 'Craft a crafting table', icon: BLOCK_CRAFTING_TABLE, tab: 'story', item: is(BLOCK_CRAFTING_TABLE) },
  { id: 'time_to_mine', title: 'Time to Mine!', description: 'Use planks and sticks to make a pickaxe', icon: ITEM_WOOD_PICKAXE, tab: 'story', item: is(ITEM_WOOD_PICKAXE) },
  { id: 'time_to_strike', title: 'Time to Strike!', description: 'Use planks and sticks to make a sword', icon: ITEM_WOOD_SWORD, tab: 'story', item: is(ITEM_WOOD_SWORD) },
  { id: 'stone_age', title: 'Stone Age', description: 'Mine stone with your new pickaxe', icon: BLOCK_STONE, tab: 'story', item: is(BLOCK_STONE) },
  { id: 'getting_an_upgrade', title: 'Getting an Upgrade', description: 'Construct a better pickaxe', icon: ITEM_STONE_PICKAXE, tab: 'story', item: is(ITEM_STONE_PICKAXE) },
  { id: 'hot_topic', title: 'Hot Topic', description: 'Construct a furnace out of stone', icon: BLOCK_FURNACE, tab: 'story', item: is(BLOCK_FURNACE) },
  { id: 'acquire_hardware', title: 'Acquire Hardware', description: 'Smelt an iron ingot', icon: ITEM_IRON_INGOT, tab: 'story', item: is(ITEM_IRON_INGOT) },
  { id: 'suit_up', title: 'Suit Up', description: 'Protect yourself with a piece of iron armor', icon: 147, tab: 'story', item: (id) => ARMOR[id]?.material === 'iron' },
  { id: 'hot_stuff', title: 'Hot Stuff', description: 'Fill a bucket with lava', icon: ITEM_LAVA_BUCKET, tab: 'story', item: is(ITEM_LAVA_BUCKET) },
  { id: 'isnt_it_iron_pick', title: "Isn't It Iron Pick", description: 'Upgrade your pickaxe', icon: ITEM_IRON_PICKAXE, tab: 'story', item: is(ITEM_IRON_PICKAXE) },
  { id: 'diamonds', reward: { xp: 25 }, title: 'Diamonds!', description: 'Acquire diamonds', icon: ITEM_DIAMOND, tab: 'story', item: is(ITEM_DIAMOND) },
  { id: 'ice_bucket_challenge', title: 'Ice Bucket Challenge', description: 'Obtain a block of obsidian', icon: BLOCK_OBSIDIAN, tab: 'story', item: is(BLOCK_OBSIDIAN) },
  { id: 'cover_me_in_diamonds', reward: { xp: 60, items: [[EMERALD, 4]] }, title: 'Cover Me with Diamonds', description: 'Diamond armor saves lives', icon: 155, tab: 'story', goal: true, item: (id) => ARMOR[id]?.material === 'diamond' },
  { id: 'enchanter', reward: { xp: 20 }, title: 'Enchanter', description: 'Enchant an item at an Enchanting Table', icon: ITEM_ENCHANTED_BOOK, tab: 'story', event: (n) => n === 'itemEnchanted' },
  { id: 'we_need_to_go_deeper', reward: { xp: 30, items: [[PEARL, 1]] }, title: 'We Need to Go Deeper', description: 'Build, light and enter a Nether Portal', icon: BLOCK_OBSIDIAN, tab: 'story', event: (n, d) => n === 'dimensionChange' && d.dimension === 'nether' },

  // ---- Nether ----
  { id: 'into_fire', title: 'Into Fire', description: 'Relieve a Blaze of its rod', icon: ITEM_BLAZE_ROD, tab: 'nether', item: is(ITEM_BLAZE_ROD) },
  { id: 'hidden_in_the_depths', reward: { xp: 120, items: [[INFERNIUM, 2]] }, title: 'Hidden in the Depths', description: 'Smelt an Infernium ingot', icon: ITEM_INFERNIUM_INGOT, tab: 'nether', challenge: true, item: is(ITEM_INFERNIUM_INGOT) },
  { id: 'return_to_sender', reward: { xp: 80, items: [[TEAR, 2], [ROD, 3]] }, title: 'Return to Sender', description: 'Destroy a Ghast', icon: ITEM_BLAZE_ROD, tab: 'nether', goal: true, event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'ghast' },

  // ---- Adventure ----
  { id: 'monster_hunter', title: 'Monster Hunter', description: 'Kill any hostile monster', icon: ITEM_WOOD_SWORD, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && HOSTILE.has(String(d.type)) },
  { id: 'what_a_deal', title: 'What a Deal!', description: 'Successfully trade with a Villager', icon: ITEM_EMERALD, tab: 'adventure', event: (n) => n === 'playerTrade' },
  { id: 'sweet_dreams', title: 'Sweet Dreams', description: 'Sleep in a bed through the night', icon: ITEM_BED, tab: 'adventure', event: (n) => n === 'playerSleep' },
  { id: 'teleport', title: 'Pearl of Wisdom', description: 'Get your hands on an Ender Pearl', icon: ITEM_ENDER_PEARL, tab: 'adventure', item: is(ITEM_ENDER_PEARL) },
  { id: 'is_it_a_bird', title: 'Is It a Bird?', description: 'Look at something through a Spyglass', icon: ITEM_SPYGLASS, tab: 'adventure', experimental: true, event: (n, d) => n === 'zoomChange' && d.spyglass === true },

  // ---- Husbandry ----
  { id: 'husbandry', title: 'Husbandry', description: 'Eat something', icon: ITEM_BREAD, tab: 'husbandry', event: (n) => n === 'playerEat' },
  { id: 'bake_bread', title: 'Bake Bread', description: 'Turn wheat into bread', icon: ITEM_BREAD, tab: 'husbandry', item: is(ITEM_BREAD) },
  // ---- More Minecraft ----
  { id: 'cargo', title: 'Cargo', description: 'Craft a chest to keep your things in', icon: BLOCK_CHEST, tab: 'story', item: is(BLOCK_CHEST) },
  { id: 'bucket_brigade', title: 'Bucket Brigade', description: 'Fill a bucket with water', icon: ITEM_WATER_BUCKET, tab: 'story', item: is(ITEM_WATER_BUCKET) },
  { id: 'spark', title: 'Spark', description: 'Make a flint and steel', icon: ITEM_FLINT_AND_STEEL, tab: 'story', item: is(ITEM_FLINT_AND_STEEL) },
  { id: 'diamond_edge', title: 'Diamond Edge', description: 'Craft a diamond sword', icon: ITEM_DIAMOND_SWORD, tab: 'story', item: is(ITEM_DIAMOND_SWORD) },
  { id: 'gold_rush', title: 'Gold Rush', description: 'Smelt a gold ingot', icon: ITEM_GOLD_INGOT, tab: 'story', item: is(ITEM_GOLD_INGOT) },
  { id: 'shiny_blocks', title: 'Shiny Blocks', description: 'Pack iron ingots into a block of iron', icon: BLOCK_IRON_BLOCK, tab: 'story', item: is(BLOCK_IRON_BLOCK) },
  { id: 'filthy_rich', reward: { xp: 50, items: [[EMERALD, 2]] }, title: 'Filthy Rich', description: 'Make a whole block of diamond', icon: BLOCK_DIAMOND_BLOCK, tab: 'story', item: is(BLOCK_DIAMOND_BLOCK) },
  { id: 'bookworm', title: 'Bookworm', description: 'Make a book', icon: ITEM_BOOK, tab: 'story', item: is(ITEM_BOOK) },
  { id: 'library', title: 'Library', description: 'Build a bookshelf', icon: BLOCK_BOOKSHELF, tab: 'story', item: is(BLOCK_BOOKSHELF) },
  { id: 'magic_table', title: 'Magic Table', description: 'Craft an enchanting table', icon: BLOCK_ENCHANTING_TABLE, tab: 'story', item: is(BLOCK_ENCHANTING_TABLE) },
  { id: 'heavy_metal', title: 'Heavy Metal', description: 'Forge an anvil', icon: BLOCK_ANVIL, tab: 'story', item: is(BLOCK_ANVIL) },
  { id: 'ice_ice_baby', title: 'Ice Ice Baby', description: 'Get your hands on blue ice', icon: BLOCK_BLUE_ICE, tab: 'story', item: is(BLOCK_BLUE_ICE) },
  { id: 'cozy_camp', title: 'Cozy Camp', description: 'Light up a campfire', icon: BLOCK_CAMPFIRE, tab: 'story', item: is(BLOCK_CAMPFIRE) },
  { id: 'fire_in_the_hole', title: 'Fire in the Hole', description: 'Craft some TNT', icon: BLOCK_TNT, tab: 'story', item: is(BLOCK_TNT) },
  { id: 'sailor', title: 'Sailor', description: 'Build a boat', icon: ITEM_BOAT, tab: 'story', item: is(ITEM_BOAT) },

  // ---- Redstone (it is in the Adventure tab) ----
  { id: 'redstone_rookie', title: 'Redstone Rookie', description: 'Mine some redstone dust', icon: ITEM_REDSTONE, tab: 'adventure', item: is(ITEM_REDSTONE) },
  { id: 'blue_gems', title: 'Blue Gems', description: 'Mine some lapis lazuli', icon: ITEM_LAPIS, tab: 'adventure', item: is(ITEM_LAPIS) },
  { id: 'power_up', title: 'Power Up', description: 'Make a block of redstone', icon: BLOCK_REDSTONE_BLOCK, tab: 'adventure', item: is(BLOCK_REDSTONE_BLOCK) },
  { id: 'switch_it_on', title: 'Switch It On', description: 'Craft a lever', icon: BLOCK_LEVER, tab: 'adventure', item: is(BLOCK_LEVER) },
  { id: 'lights_on', title: 'Lights On', description: 'Craft a redstone lamp', icon: BLOCK_REDSTONE_LAMP, tab: 'adventure', item: is(BLOCK_REDSTONE_LAMP) },
  { id: 'push_it', title: 'Push It', description: 'Build a piston', icon: BLOCK_PISTON, tab: 'adventure', item: is(BLOCK_PISTON) },
  { id: 'on_a_timer', title: 'On a Timer', description: 'Craft a redstone repeater', icon: BLOCK_REPEATER, tab: 'adventure', item: is(BLOCK_REPEATER) },
  { id: 'compare_and_contrast', title: 'Compare and Contrast', description: 'Craft a redstone comparator', icon: BLOCK_COMPARATOR, tab: 'adventure', item: is(BLOCK_COMPARATOR) },

  // ---- Combat & hunting (Adventure) ----
  { id: 'ranged_weapon', title: 'Ranged Weapon', description: 'Get a bow, maybe from a skeleton', icon: ITEM_BOW, tab: 'adventure', item: is(ITEM_BOW) },
  { id: 'pointy_things', title: 'Pointy Things', description: 'Pick up an arrow', icon: ITEM_ARROW, tab: 'adventure', item: is(ITEM_ARROW) },
  { id: 'sniper_duel', title: 'Take Aim', description: 'Draw a bow back and let an arrow fly', icon: ITEM_BOW, tab: 'adventure', event: (n) => n === 'bowShot' },
  { id: 'spiders_silk', title: "Spider's Silk", description: 'Collect string from a spider', icon: ITEM_STRING, tab: 'adventure', item: is(ITEM_STRING) },
  { id: 'bone_collector', title: 'Bone Collector', description: 'Collect a bone', icon: ITEM_BONE, tab: 'adventure', item: is(ITEM_BONE) },
  { id: 'skeleton_crew', title: 'Skeleton Crew', description: 'Defeat a skeleton', icon: ITEM_BONE, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'skeleton' },
  { id: 'creeper_aw_man', title: 'Creeper? Aw Man', description: 'Defeat a creeper before it goes off', icon: 117, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'creeper' },
  { id: 'web_cleaner', title: 'Web Cleaner', description: 'Defeat a spider', icon: ITEM_STRING, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'spider' },
  { id: 'zombie_slayer', title: 'Zombie Slayer', description: 'Defeat a zombie', icon: ITEM_WOOD_SWORD, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'zombie' },
  { id: 'iron_giant', reward: { xp: 40, items: [[IRON, 6]] }, title: 'Iron Giant', description: 'Take down an iron golem', icon: ITEM_IRON_INGOT, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'iron_golem' },
  { id: 'wither_away', reward: { xp: 250, items: [[EMERALD, 8], [DIAMOND, 4]] }, title: 'Tyrant Slayer', description: 'Defeat the Hollow Tyrant', icon: ITEM_INFERNIUM_INGOT, tab: 'adventure', challenge: true, event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'hollow_tyrant' },

  // ---- More Nether ----
  { id: 'nether_crystals', title: 'Nether Crystals', description: 'Mine some nether quartz', icon: ITEM_QUARTZ, tab: 'nether', item: is(ITEM_QUARTZ) },
  { id: 'tearful', title: 'Tearful', description: 'Get a ghast tear', icon: ITEM_GHAST_TEAR, tab: 'nether', item: is(ITEM_GHAST_TEAR) },
  { id: 'let_there_be_light', title: 'Let There Be Light', description: 'Collect glowstone', icon: BLOCK_GLOWSTONE, tab: 'nether', item: is(BLOCK_GLOWSTONE) },
  { id: 'local_brewery', title: 'Local Brewery', description: 'Set up a brewing stand', icon: BLOCK_BREWING_STAND, tab: 'nether', item: is(BLOCK_BREWING_STAND) },
  { id: 'bottoms_up', title: 'Bottoms Up', description: 'Get a potion', icon: BLOCK_BREWING_STAND, tab: 'nether', item: isPotionItem },
  { id: 'monster_of_the_nether', reward: { xp: 40, items: [[IRON, 3]] }, title: 'Bone Breaker', description: 'Defeat a Cinderbone', icon: ITEM_BONE, tab: 'nether', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'cinderbone' },

  // ---- More Husbandry ----
  { id: 'gone_fishing', title: 'Gone Fishing', description: 'Craft a fishing rod', icon: ITEM_FISHING_ROD, tab: 'husbandry', item: is(ITEM_FISHING_ROD) },
  { id: 'fish_on', title: 'Fish On!', description: 'Catch something with your fishing rod', icon: ITEM_FISHING_ROD, tab: 'husbandry', event: (n) => n === 'fishCaught' },
  { id: 'shear_genius', title: 'Shear Genius', description: 'Make a pair of shears', icon: ITEM_SHEARS, tab: 'husbandry', item: is(ITEM_SHEARS) },
  { id: 'steak_dinner', title: 'Steak Dinner', description: 'Cook a steak', icon: ITEM_STEAK, tab: 'husbandry', item: is(ITEM_STEAK) },
];

export const ADVANCEMENT_TABS: Array<{ id: AdvancementTab; label: string }> = [
  { id: 'story', label: 'Minecraft' }, { id: 'nether', label: 'Nether' }, { id: 'adventure', label: 'Adventure' }, { id: 'husbandry', label: 'Husbandry' },
];

/** The advancements this planet can have (experimental ones only in experimental planets). */
export function advancementsFor(experimental: boolean): Advancement[] {
  return ADVANCEMENTS.filter((a) => !a.experimental || experimental);
}

/** New advancements earned by holding these items. */
export function checkItems(stacks: Array<ItemStack | null>, have: ReadonlySet<string>, experimental: boolean): Advancement[] {
  const ids = new Set<number>();
  for (const s of stacks) if (s && s.count > 0) ids.add(s.id);
  return advancementsFor(experimental).filter((a) => a.item && !have.has(a.id) && [...ids].some(a.item));
}

/** New advancements earned by a game event. */
export function checkEvent(name: string, data: Record<string, unknown>, have: ReadonlySet<string>, experimental: boolean): Advancement[] {
  return advancementsFor(experimental).filter((a) => a.event && !have.has(a.id) && a.event(name, data));
}

// ---- Saving: one list per planet ----
const key = (worldId: string) => `vb-advancements-${worldId}`;
export function loadAdvancements(worldId: string | null): Set<string> {
  if (!worldId) return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(key(worldId)) ?? '[]');
    const known = new Set(ADVANCEMENTS.map((a) => a.id));
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && known.has(x)) : []);
  } catch { return new Set(); }
}
export function saveAdvancements(worldId: string | null, have: ReadonlySet<string>) {
  if (!worldId) return; // Quick Play isn't saved
  try { localStorage.setItem(key(worldId), JSON.stringify([...have])); } catch { /* storage full or blocked */ }
}
export function clearAdvancements(worldId: string) {
  try { localStorage.removeItem(key(worldId)); } catch { /* ignore */ }
}

/** A reward as words, e.g. "60 XP, 4 emeralds" (the item names come from the game's own list). */
export function rewardText(r: AdvReward | undefined, nameOf: (id: number) => string): string {
  if (!r) return '';
  return [`${r.xp} XP`, ...(r.items ?? []).map(([id, n]) => `${n} ${nameOf(id)}`)].join(', ');
}
