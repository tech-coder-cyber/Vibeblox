// The enchanting table's offers and the anvil's results. Pure functions (no game state), so the
// inventory screen can show live previews and tests can check the rules.
import {
  ENCHANTMENTS, ARMOR, TOOLS, ITEM_BOOK, ITEM_ENCHANTED_BOOK, ITEM_IRON_INGOT, ITEM_GOLD_INGOT, ITEM_DIAMOND, ITEM_EMERALD,
  ITEM_INFERNIUM_INGOT, ITEM_LEATHER, ITEM_PLANKS, BLOCK_STONE, ITEM_NAME_TAG,
  enchantFits, enchantability, enchantLabel, enchantsConflict, maxDurability, maxStack, craftId,
  type Enchants, type ItemStack, type EnchantDef,
} from './voxelGame';

/** A small seeded random generator, so the table shows the same offers until you enchant something. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type EnchantOffer = {
  /** You need at least this many levels... */
  level: number;
  /** ...but it only costs this many (and this much lapis), like Minecraft. */
  lapis: number;
  ench: Enchants;
  /** What the table shows before you pick (the first enchantment). */
  hint: string;
};

/** Can this item go on the enchanting table at all? */
export function canEnchant(st: ItemStack | null): boolean {
  if (!st || st.ench) return false; // already enchanted items need an anvil
  return enchantability(st.id) > 0 && (st.id === ITEM_BOOK || ENCHANTMENTS.some((d) => !d.treasure && enchantFits(d, st.id)));
}

/** Picks enchantments for an item at an enchanting power (Minecraft's method, slightly simplified). */
export function pickEnchants(id: number, power: number, rnd: () => number): Enchants {
  const e = enchantability(id);
  if (e <= 0) return {};
  const ri = (n: number) => Math.floor(rnd() * n);
  let m = power + 1 + ri(Math.floor(e / 4) + 1) + ri(Math.floor(e / 4) + 1);
  m = Math.max(1, Math.round(m * (1 + (rnd() + rnd() - 1) * 0.15)));
  const out: Enchants = {};
  const options = (pow: number) => ENCHANTMENTS
    .filter((d) => !d.treasure && !(d.key in out) && !Object.keys(out).some((k) => enchantsConflict(k, d.key)) && (id === ITEM_BOOK || enchantFits(d, id)))
    .map((d) => {
      let lvl = 0;
      for (let l = d.max; l >= 1; l--) if (d.minPower(l) <= pow) { lvl = l; break; }
      return { d, lvl };
    })
    .filter((o) => o.lvl > 0);
  const pick = (list: Array<{ d: EnchantDef; lvl: number }>) => {
    const total = list.reduce((n, o) => n + o.d.weight, 0);
    let r = rnd() * total;
    for (const o of list) { r -= o.d.weight; if (r < 0) return o; }
    return list[list.length - 1];
  };
  let list = options(m);
  if (!list.length) return out;
  const first = pick(list);
  out[first.d.key] = first.lvl;
  // A strong enchant sometimes brings more with it
  while (rnd() < (m + 1) / 50) {
    m = Math.floor(m / 2);
    list = options(m);
    if (!list.length) break;
    const o = pick(list);
    out[o.d.key] = o.lvl;
  }
  return out;
}

/** The three offers for an item, given the bookshelves around the table (0-15) and the player's seed. */
export function enchantOffers(st: ItemStack | null, shelves: number, seed: number): Array<EnchantOffer | null> {
  if (!canEnchant(st)) return [null, null, null];
  const b = Math.max(0, Math.min(15, Math.floor(shelves)));
  const rnd = seededRandom(seed ^ Math.imul(st!.id, 0x9e3779b1));
  const ri = (n: number) => Math.floor(rnd() * n);
  const base = 1 + ri(8) + Math.floor(b / 2) + ri(b + 1);
  const levels = [Math.max(Math.floor(base / 3), 1), Math.floor((base * 2) / 3) + 1, Math.max(base, b * 2)];
  return levels.map((level, i) => {
    const ench = pickEnchants(st!.id, level, seededRandom(seed + i * 7919 + st!.id));
    const first = Object.entries(ench)[0];
    if (!first) return null;
    return { level, lapis: i + 1, ench, hint: enchantLabel(first[0], first[1]) };
  });
}

/** The item with its new enchantments (a book becomes an enchanted book). */
export function applyEnchants(st: ItemStack, ench: Enchants): ItemStack {
  if (st.id === ITEM_BOOK) return { id: ITEM_ENCHANTED_BOOK, count: 1, ench: { ...ench } };
  return { ...st, count: 1, ench: { ...(st.ench ?? {}), ...ench } };
}

// ---------------- Anvil ----------------
/** What repairs an item in the anvil (planks for wooden tools, iron for iron, and so on). */
export function repairMaterial(id: number): number | null {
  const t = TOOLS[id];
  if (t) return ({ wood: ITEM_PLANKS, stone: BLOCK_STONE, iron: ITEM_IRON_INGOT, gold: ITEM_GOLD_INGOT, diamond: ITEM_DIAMOND, emerald: ITEM_EMERALD, infernium: ITEM_INFERNIUM_INGOT } as Record<string, number>)[t.material] ?? null;
  const a = ARMOR[id];
  if (a) return ({ leather: ITEM_LEATHER, iron: ITEM_IRON_INGOT, gold: ITEM_GOLD_INGOT, diamond: ITEM_DIAMOND, emerald: ITEM_EMERALD } as Record<string, number>)[a.material] ?? null;
  return null;
}

export type AnvilResult =
  | { ok: true; out: ItemStack; cost: number; useRight: number }
  | { ok: false; error: string };
export const ANVIL_MAX_COST = 40; // at this many levels or more: "Too Expensive!"
/** The anvil won't put more than this many enchantments on one item (commands and scripts still can). */
export const ANVIL_MAX_ENCHANTS = 4;

/**
 * Left = the item you're working on, right = what you add (the same item, an enchanted book, or
 * repair material). `name` = what's typed in the name box (undefined = leave the name alone).
 * Returns null when there's nothing to do.
 */
export function anvilResult(left: ItemStack | null, right: ItemStack | null, name?: string): AnvilResult | null {
  if (!left) return null;
  if (left.id === ITEM_NAME_TAG) {
    if (right) return { ok: false, error: 'A Name Tag can only be renamed' };
    if (left.count > 1) return { ok: false, error: 'Rename one Name Tag at a time' };
  } else if (maxStack(left.id) > 1) return right ? { ok: false, error: 'Only tools, armor, bows and enchanted books go in an anvil' } : null;
  const out: ItemStack = { ...left, count: 1, ench: left.ench ? { ...left.ench } : undefined };
  const max = maxDurability(left.id);
  let cost = 0, useRight = 0, changed = false;

  if (right) {
    const mat = repairMaterial(left.id);
    if (mat !== null && (right.id === mat || craftId(right.id) === mat)) {
      if (!left.damage) return { ok: false, error: "It isn't damaged" };
      const per = Math.max(1, Math.floor(max / 4)); // each piece fixes a quarter
      useRight = Math.min(right.count, Math.ceil(left.damage / per));
      out.damage = Math.max(0, left.damage - useRight * per);
      cost += useRight;
      changed = true;
    } else if (right.id === left.id || right.id === ITEM_ENCHANTED_BOOK) {
      useRight = 1;
      if (right.id === left.id && max > 0 && (left.damage || right.damage)) {
        // two of the same tool: their durability adds up, plus a 12% bonus
        const remain = (max - (left.damage ?? 0)) + (max - (right.damage ?? 0)) + Math.floor(max * 0.12);
        const dmg = Math.max(0, max - remain);
        if (dmg !== (left.damage ?? 0)) { out.damage = dmg; cost += 2; changed = true; }
      }
      const fromBook = right.id === ITEM_ENCHANTED_BOOK;
      let fitted = 0, skipped = 0, capped = 0;
      for (const [k, lv] of Object.entries(right.ench ?? {})) {
        const def = ENCHANTMENTS.find((d) => d.key === k);
        if (!def) continue;
        if (left.id !== ITEM_ENCHANTED_BOOK && !enchantFits(def, left.id, true)) { skipped++; continue; }
        if (Object.keys(out.ench ?? {}).some((o) => enchantsConflict(o, k))) { skipped++; cost += 1; continue; } // e.g. Sharpness and Smite
        if (!(k in (out.ench ?? {})) && Object.keys(out.ench ?? {}).length >= ANVIL_MAX_ENCHANTS) { skipped++; capped++; continue; } // no all-in-one super weapons
        fitted++;
        const cur = out.ench?.[k] ?? 0;
        const next = cur === lv ? Math.min(def.max, lv + 1) : Math.max(cur, lv); // two of the same level make the next one up
        if (next !== cur) {
          out.ench = { ...(out.ench ?? {}), [k]: next };
          cost += next * (fromBook ? 1 : 2);
          changed = true;
        }
      }
      if (!changed) return { ok: false, error: capped && !fitted ? `Too many enchantments (the anvil allows ${ANVIL_MAX_ENCHANTS} per item)` : fitted || !skipped ? 'Nothing to add' : "Those enchantments don't fit this item" };
    } else {
      return { ok: false, error: "Those can't be combined" };
    }
  }

  if (name !== undefined) {
    const clean = name.trim().slice(0, 64);
    const current = left.name ?? '';
    if (clean !== current) {
      if (clean) out.name = clean; else delete out.name;
      cost += 1;
      changed = true;
    }
  }
  if (!changed) return null;
  if (out.damage === 0) delete out.damage;
  if (out.ench && !Object.keys(out.ench).length) delete out.ench;
  if (cost >= ANVIL_MAX_COST) return { ok: false, error: 'Too Expensive!' };
  return { ok: true, out, cost: Math.max(1, cost), useRight };
}

/** Two worn tools or armor pieces of the same kind in the crafting grid make one: their durability adds up (plus 5%).
 *  Enchanted or renamed ones are not combined here (use the anvil, which keeps the enchantments). Returns null when it doesn't apply. */
export function combineWorn(a: ItemStack | null | undefined, b: ItemStack | null | undefined): ItemStack | null {
  if (!a || !b || a.id !== b.id || a.count !== 1 || b.count !== 1) return null;
  const max = maxDurability(a.id);
  if (!(max > 0)) return null;
  if (!(a.damage || b.damage)) return null; // two new ones: nothing to repair
  const odd = (s: ItemStack) => !!s.name || (!!s.ench && Object.keys(s.ench).length > 0);
  if (odd(a) || odd(b)) return null;
  const remain = (max - (a.damage ?? 0)) + (max - (b.damage ?? 0)) + Math.floor(max * 0.05);
  const dmg = Math.max(0, max - remain);
  return dmg > 0 ? { id: a.id, count: 1, damage: dmg } : { id: a.id, count: 1 };
}
