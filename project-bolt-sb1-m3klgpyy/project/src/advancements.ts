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
} from './voxelGame';

export type AdvancementTab = 'story' | 'nether' | 'adventure' | 'husbandry';
export type Advancement = {
  id: string;
  title: string;
  description: string;
  icon: number;           // item id drawn on the toast
  tab: AdvancementTab;
  goal?: boolean;         // a bigger one: the toast says "Goal Reached!"
  challenge?: boolean;    // the hardest: "Challenge Complete!" in purple
  experimental?: boolean; // only exists in planets made with experimental features
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
  { id: 'diamonds', title: 'Diamonds!', description: 'Acquire diamonds', icon: ITEM_DIAMOND, tab: 'story', item: is(ITEM_DIAMOND) },
  { id: 'ice_bucket_challenge', title: 'Ice Bucket Challenge', description: 'Obtain a block of obsidian', icon: BLOCK_OBSIDIAN, tab: 'story', item: is(BLOCK_OBSIDIAN) },
  { id: 'cover_me_in_diamonds', title: 'Cover Me with Diamonds', description: 'Diamond armor saves lives', icon: 155, tab: 'story', goal: true, item: (id) => ARMOR[id]?.material === 'diamond' },
  { id: 'enchanter', title: 'Enchanter', description: 'Enchant an item at an Enchanting Table', icon: ITEM_ENCHANTED_BOOK, tab: 'story', event: (n) => n === 'itemEnchanted' },
  { id: 'we_need_to_go_deeper', title: 'We Need to Go Deeper', description: 'Build, light and enter a Nether Portal', icon: BLOCK_OBSIDIAN, tab: 'story', event: (n, d) => n === 'dimensionChange' && d.dimension === 'nether' },

  // ---- Nether ----
  { id: 'into_fire', title: 'Into Fire', description: 'Relieve a Blaze of its rod', icon: ITEM_BLAZE_ROD, tab: 'nether', item: is(ITEM_BLAZE_ROD) },
  { id: 'hidden_in_the_depths', title: 'Hidden in the Depths', description: 'Smelt an Infernium ingot', icon: ITEM_INFERNIUM_INGOT, tab: 'nether', challenge: true, item: is(ITEM_INFERNIUM_INGOT) },
  { id: 'return_to_sender', title: 'Return to Sender', description: 'Destroy a Ghast', icon: ITEM_BLAZE_ROD, tab: 'nether', goal: true, event: (n, d) => n === 'entityDeath' && d.byPlayer === true && d.type === 'ghast' },

  // ---- Adventure ----
  { id: 'monster_hunter', title: 'Monster Hunter', description: 'Kill any hostile monster', icon: ITEM_WOOD_SWORD, tab: 'adventure', event: (n, d) => n === 'entityDeath' && d.byPlayer === true && HOSTILE.has(String(d.type)) },
  { id: 'what_a_deal', title: 'What a Deal!', description: 'Successfully trade with a Villager', icon: ITEM_EMERALD, tab: 'adventure', event: (n) => n === 'playerTrade' },
  { id: 'sweet_dreams', title: 'Sweet Dreams', description: 'Sleep in a bed through the night', icon: ITEM_BED, tab: 'adventure', event: (n) => n === 'playerSleep' },
  { id: 'teleport', title: 'Pearl of Wisdom', description: 'Get your hands on an Ender Pearl', icon: ITEM_ENDER_PEARL, tab: 'adventure', item: is(ITEM_ENDER_PEARL) },
  { id: 'is_it_a_bird', title: 'Is It a Bird?', description: 'Look at something through a Spyglass', icon: ITEM_SPYGLASS, tab: 'adventure', experimental: true, event: (n, d) => n === 'zoomChange' && d.spyglass === true },

  // ---- Husbandry ----
  { id: 'husbandry', title: 'Husbandry', description: 'Eat something', icon: ITEM_BREAD, tab: 'husbandry', event: (n) => n === 'playerEat' },
  { id: 'bake_bread', title: 'Bake Bread', description: 'Turn wheat into bread', icon: ITEM_BREAD, tab: 'husbandry', item: is(ITEM_BREAD) },
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
