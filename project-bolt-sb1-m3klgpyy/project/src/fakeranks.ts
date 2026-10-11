// Fake ranks for servers and worlds: /rank add Owner, /rank join Owner, /rank modify Owner \gold\\shiny\OWNER.
// They are just names in front of a player (in chat, the player list, Manage Server and over their head) and
// give no powers. They live with the world (the host keeps the list and the server tells everyone).
import { stripFancy } from './fancycore';

export type FakeRank = { name: string; tag: string };
export type FakeRanks = {
  /** by lowercase rank name */
  defs: Record<string, FakeRank>;
  /** lowercase player name -> lowercase rank name */
  members: Record<string, string>;
};
export const MAX_FAKE_RANKS = 30;
export const MAX_RANK_TAG = 80;
export const MAX_RANK_MEMBERS = 200;
export const RANK_NAME_RE = /^[A-Za-z0-9_]{1,16}$/;
const PLAYER_RE = /^[A-Za-z0-9_]{3,16}$/;

export const emptyRanks = (): FakeRanks => ({ defs: {}, members: {} });

/** Makes anything (a saved file, a message from the network) into a safe list. */
export function cleanFakeRanks(v: unknown): FakeRanks {
  const out = emptyRanks();
  if (!v || typeof v !== 'object') return out;
  const o = v as { defs?: unknown; members?: unknown };
  if (o.defs && typeof o.defs === 'object') {
    for (const [k, d] of Object.entries(o.defs as Record<string, unknown>)) {
      if (Object.keys(out.defs).length >= MAX_FAKE_RANKS) break;
      const dd = d as { name?: unknown; tag?: unknown } | null;
      if (!dd || typeof dd.name !== 'string' || typeof dd.tag !== 'string' || !RANK_NAME_RE.test(dd.name)) continue;
      if (k !== dd.name.toLowerCase()) continue;
      out.defs[k] = { name: dd.name, tag: dd.tag.slice(0, MAX_RANK_TAG) };
    }
  }
  if (o.members && typeof o.members === 'object') {
    for (const [p, r] of Object.entries(o.members as Record<string, unknown>)) {
      if (Object.keys(out.members).length >= MAX_RANK_MEMBERS) break;
      if (typeof r !== 'string' || !out.defs[r] || !PLAYER_RE.test(p) || p !== p.toLowerCase()) continue;
      out.members[p] = r;
    }
  }
  return out;
}

/** The tag text in front of a player's name ('' if they have no fake rank). Colour codes still inside. */
export function rankTagOf(ranks: FakeRanks | null | undefined, player: string): string {
  if (!ranks) return '';
  const r = ranks.members[player.toLowerCase()];
  return r && ranks.defs[r] ? ranks.defs[r].tag : '';
}
/** The same, with no colour codes. */
export const plainRankTag = (ranks: FakeRanks | null | undefined, player: string) => stripFancy(rankTagOf(ranks, player));

export const FAKE_RANK_USAGE = [
  '/rank add <name> [tag]  ·  make a rank (the tag defaults to [name])',
  '/rank modify <name> <tag>  ·  change how it looks, e.g. /rank modify Owner \\gold\\\\shiny\\OWNER',
  '/rank join <name> [player]  ·  put yourself (or a player) in a rank',
  '/rank leave [player]  ·  take the rank away',
  '/rank remove <name>  ·  delete a rank  ·  /rank list  ·  /rank who <name>',
].join('\n');

export type RankCmdResult = { ranks: FakeRanks; changed: boolean; message?: string; error?: string };

/**
 * Runs one /rank command. `rest` is everything typed after "/rank " (spacing kept, because tags are free text),
 * `me` is who typed it and `resolve` turns a target (a name, or @p/@s/...) into player names.
 */
export function runRankCommand(state: FakeRanks, rest: string, me: string, resolve?: (tok: string) => string[] | string): RankCmdResult {
  const r = cleanFakeRanks(JSON.parse(JSON.stringify(state)));
  const fail = (error: string): RankCmdResult => ({ ranks: state, changed: false, error });
  const m = /^\s*(\S+)\s*(.*)$/s.exec(rest);
  if (!m) return fail(`Usage:\n${FAKE_RANK_USAGE}`);
  const sub = m[1].toLowerCase();
  const afterSub = m[2];
  const m2 = /^(\S+)\s*(.*)$/s.exec(afterSub);
  const nameTok = m2?.[1] ?? '';
  const tail = (m2?.[2] ?? '').trim();
  const findRank = (n: string) => r.defs[n.toLowerCase()];
  const players = (tok: string | undefined): string[] | string => {
    if (!tok) return [me];
    if (resolve) return resolve(tok);
    return PLAYER_RE.test(tok) ? [tok] : `No player named ${tok}`;
  };
  switch (sub) {
    case 'add': case 'create': case 'new': {
      if (!nameTok) return fail('Usage: /rank add <name> [tag]');
      if (!RANK_NAME_RE.test(nameTok)) return fail('A rank name is 1-16 letters, numbers or underscores');
      if (findRank(nameTok)) return fail(`A rank called ${findRank(nameTok).name} already exists`);
      if (Object.keys(r.defs).length >= MAX_FAKE_RANKS) return fail(`You can have up to ${MAX_FAKE_RANKS} ranks`);
      r.defs[nameTok.toLowerCase()] = { name: nameTok, tag: (tail || `[${nameTok}]`).slice(0, MAX_RANK_TAG) };
      return { ranks: r, changed: true, message: `Made the rank ${nameTok}. Use /rank join ${nameTok} to wear it, and /rank modify ${nameTok} <tag> to style it.` };
    }
    case 'modify': case 'edit': case 'set': case 'tag': {
      if (!nameTok || !tail) return fail('Usage: /rank modify <name> <tag>   (colour codes work: \\gold\\\\shiny\\OWNER)');
      const d = findRank(nameTok);
      if (!d) return fail(`There is no rank called ${nameTok}. Make it with /rank add ${nameTok}`);
      d.tag = tail.slice(0, MAX_RANK_TAG);
      return { ranks: r, changed: true, message: `${d.name} now shows as: ${d.tag}` };
    }
    case 'remove': case 'delete': {
      const d = findRank(nameTok);
      if (!d) return fail(nameTok ? `There is no rank called ${nameTok}` : 'Usage: /rank remove <name>');
      const key = d.name.toLowerCase();
      delete r.defs[key];
      for (const [p, rk] of Object.entries(r.members)) if (rk === key) delete r.members[p];
      return { ranks: r, changed: true, message: `Removed the rank ${d.name}` };
    }
    case 'join': {
      const d = findRank(nameTok);
      if (!nameTok) return fail('Usage: /rank join <name> [player]');
      if (!d) return fail(`There is no rank called ${nameTok}. Make it with /rank add ${nameTok}`);
      const who = players(tail.split(/\s+/)[0] || undefined);
      if (typeof who === 'string') return fail(who);
      if (!who.length) return fail('Nobody to give the rank to');
      for (const p of who) {
        if (Object.keys(r.members).length >= MAX_RANK_MEMBERS && !r.members[p.toLowerCase()]) return fail(`Up to ${MAX_RANK_MEMBERS} players can have ranks`);
        r.members[p.toLowerCase()] = d.name.toLowerCase();
      }
      return { ranks: r, changed: true, message: `Gave ${who.join(', ')} the rank ${d.name}` };
    }
    case 'leave': {
      const who = players(nameTok || undefined);
      if (typeof who === 'string') return fail(who);
      let n = 0;
      for (const p of who) if (r.members[p.toLowerCase()]) { delete r.members[p.toLowerCase()]; n++; }
      if (!n) return fail('That player has no rank');
      return { ranks: r, changed: true, message: `${who.join(', ')} left their rank` };
    }
    case 'list': {
      const names = Object.values(r.defs);
      if (!names.length) return { ranks: state, changed: false, message: 'No ranks yet. Make one with /rank add <name>' };
      return { ranks: state, changed: false, message: `Ranks (${names.length}): ${names.map((d) => `${d.name} = ${d.tag}`).join(' · ')}` };
    }
    case 'who': case 'members': {
      const d = findRank(nameTok);
      if (!d) return fail(nameTok ? `There is no rank called ${nameTok}` : 'Usage: /rank who <name>');
      const key = d.name.toLowerCase();
      const who = Object.entries(r.members).filter(([, rk]) => rk === key).map(([p]) => p);
      return { ranks: state, changed: false, message: who.length ? `${d.name}: ${who.join(', ')}` : `Nobody has the rank ${d.name} yet` };
    }
    default:
      return fail(`Usage:\n${FAKE_RANK_USAGE}`);
  }
}

// ---- keeping them with the world (a saved world remembers its ranks) ----
const KEY = (worldId: string) => `vb-franks-${worldId}`;
export function loadFakeRanks(worldId: string | null): FakeRanks {
  if (!worldId) return emptyRanks();
  try { return cleanFakeRanks(JSON.parse(localStorage.getItem(KEY(worldId)) ?? 'null')); } catch { return emptyRanks(); }
}
export function saveFakeRanks(worldId: string | null, ranks: FakeRanks): void {
  if (!worldId) return;
  try {
    if (Object.keys(ranks.defs).length) localStorage.setItem(KEY(worldId), JSON.stringify(ranks));
    else localStorage.removeItem(KEY(worldId));
  } catch { /* storage blocked */ }
}
