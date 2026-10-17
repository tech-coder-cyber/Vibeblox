// Server tags: up to three labels a host puts on a world (Survival, PvP, Roleplay...) so the Servers page can be filtered.
// The ids here must match the list in server/vibeblox_round20.sql.

export type WorldTag = { id: string; label: string; color: string };

export const WORLD_TAGS: WorldTag[] = [
  { id: 'survival', label: 'Survival', color: '#7cfc7c' },
  { id: 'pvp', label: 'PvP', color: '#ff6b6b' },
  { id: 'minigames', label: 'Minigames', color: '#ffb300' },
  { id: 'creative', label: 'Creative', color: '#6ec6ff' },
  { id: 'building', label: 'Building', color: '#c8a2ff' },
  { id: 'adventure', label: 'Adventure', color: '#ff9a3c' },
  { id: 'roleplay', label: 'Roleplay', color: '#ff8ad8' },
  { id: 'redstone', label: 'Redstone', color: '#ff4d4d' },
  { id: 'parkour', label: 'Parkour', color: '#4dfff2' },
  { id: 'skyblock', label: 'Skyblock', color: '#9be7ff' },
  { id: 'friendly', label: 'Family friendly', color: '#b6ff00' },
  { id: 'modded', label: 'Mods & scripts', color: '#e0b0ff' },
];

export const MAX_WORLD_TAGS = 3;
const KNOWN = new Map(WORLD_TAGS.map((t) => [t.id, t]));

export const tagInfo = (id: string): WorldTag | undefined => KNOWN.get(id);

/** Whatever was saved or received: only known tags, no repeats, at most three, in the order given. */
export function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === 'string' && KNOWN.has(x) && !out.includes(x)) out.push(x);
    if (out.length >= MAX_WORLD_TAGS) break;
  }
  return out;
}

/** Turns a tag on or off in a list, keeping the limit: a fourth tag is ignored. */
export function toggleTag(tags: string[], id: string): string[] {
  const cur = cleanTags(tags);
  if (cur.includes(id)) return cur.filter((t) => t !== id);
  if (!KNOWN.has(id) || cur.length >= MAX_WORLD_TAGS) return cur;
  return [...cur, id];
}

/** Handy suggestions for a world that has no tags yet (what a new world would likely be). */
export function suggestTags(mode: string, worldType: string): string[] {
  if (worldType === 'eggwars' || worldType === 'bridge') return ['minigames', 'pvp'];
  if (worldType === 'oneblock' || worldType === 'skyblock') return ['skyblock', mode === 'creative' ? 'creative' : 'survival'];
  if (mode === 'creative') return ['creative', 'building'];
  if (mode === 'adventure') return ['adventure'];
  return ['survival'];
}
