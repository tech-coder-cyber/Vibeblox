// Chat autocomplete (Indev 36): works on every word of a command, not just the first.
//   /tp <player> [player]        -> the players on the server
//   /give <@p @a @s @e @r | player> <item> [count]   -> the selectors and players, then every item from A to Z (modded items last)
// Pure functions, so they are easy to test.

export type Completion = { /** what the list shows */ label: string; /** the word that goes into the text */ word: string; hint?: string };
export type CompleteKind = 'none' | 'player' | 'target' | 'item';
export type CompleteResult = { kind: CompleteKind; options: Completion[] };

export const SELECTORS: Completion[] = [
  { label: '@p', word: '@p', hint: 'nearest player' },
  { label: '@a', word: '@a', hint: 'every player' },
  { label: '@s', word: '@s', hint: 'yourself' },
  { label: '@e', word: '@e', hint: 'every mob too' },
  { label: '@r', word: '@r', hint: 'a random player' },
];

type Slot = 'players' | 'target' | 'items' | null;
/** What each word of a command can be, in order. */
const ARGS: Record<string, Slot[]> = {
  tp: ['players', 'players'], teleport: ['players', 'players'],
  give: ['target', 'items'], enchant: ['target'],
  kick: ['players'], ban: ['players'], pardon: ['players'], unban: ['players'], mute: ['players'], unmute: ['players'],
  promote: ['players'], demote: ['players'],
  whisper: ['players'], w: ['players'], msg: ['players'], tell: ['players'],
  globalban: ['players'], globalunban: ['players'],
};

const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '_');

/** Players that start with what was typed first, then the ones that only contain it; each group A to Z. */
function matchNames<T extends { word: string }>(list: T[], typed: string): T[] {
  const q = norm(typed).replace(/_/g, '');
  const key = (w: string) => norm(w).replace(/_/g, '');
  if (!q) return list;
  const starts = list.filter((x) => key(x.word).startsWith(q));
  const has = list.filter((x) => !key(x.word).startsWith(q) && key(x.word).includes(q));
  return [...starts, ...has];
}

/** Every item name from A to Z. Names from mods (they contain a ":") go to the bottom. */
export function sortItemNames(names: string[]): string[] {
  const uniq = [...new Set(names.map(norm).filter(Boolean))];
  const plain = uniq.filter((n) => !n.includes(':')).sort((a, b) => a.localeCompare(b));
  const mods = uniq.filter((n) => n.includes(':')).sort((a, b) => a.localeCompare(b));
  return [...plain, ...mods];
}

/**
 * What can be completed at the end of this text. `text` is what is typed in the chat box so far (it starts with "/").
 * Returns no options for the command name itself (the chat box lists the commands) and for chat that is not a command.
 */
export function completeChat(text: string, ctx: { players: string[]; items: string[] }): CompleteResult {
  const none: CompleteResult = { kind: 'none', options: [] };
  if (!text.startsWith('/')) return none;
  const parts = text.slice(1).split(' ');
  if (parts.length < 2) return none; // still typing the command name
  const cmd = parts[0].toLowerCase();
  const argAt = parts.length - 2;
  const slots = ARGS[cmd];
  const slot = slots ? slots[argAt] ?? null : null;
  if (!slot) return none;
  const typed = parts[parts.length - 1];
  const players: Completion[] = [...new Set(ctx.players)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).map((n) => ({ label: n, word: n }));
  if (slot === 'players') {
    // /tp x y z: once a number or ~ is typed it is coordinates, not a player
    if (/^[~\d-]/.test(typed) || (cmd === 'tp' || cmd === 'teleport') && argAt === 1 && /^[~\d-]/.test(parts[1])) return none;
    return { kind: 'player', options: matchNames(players, typed) };
  }
  if (slot === 'target') {
    const sel = typed.startsWith('@') ? SELECTORS.filter((s) => s.word.startsWith(typed.toLowerCase())) : SELECTORS;
    return { kind: 'target', options: typed.startsWith('@') ? sel : [...sel, ...matchNames(players, typed)] };
  }
  const items: Completion[] = sortItemNames(ctx.items).map((n) => ({ label: n, word: n }));
  return { kind: 'item', options: matchNames(items, typed) };
}

/** The new chat text after picking an option: it replaces the word being typed and leaves a space for the next one. */
export function applyCompletion(text: string, word: string): string {
  const i = text.lastIndexOf(' ');
  return text.slice(0, i + 1) + word + ' ';
}
