// @mentions in private messages: finding them, highlighting them, and completing a name while you type.
// Pure functions, so they are easy to test.

export type MentionPart = { text: string; mention: boolean };

/** Splits a message into plain text and @names. Only names in `known` (friends and you) count as pings; any other @word stays plain. */
export function splitMentions(text: string, known: Iterable<string>): MentionPart[] {
  const set = new Set([...known].map((n) => n.toLowerCase()));
  const out: MentionPart[] = [];
  const re = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,16})(?![A-Za-z0-9_])/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!set.has(m[2].toLowerCase())) continue;
    const start = m.index + m[1].length; // at the "@"
    if (start > last) out.push({ text: text.slice(last, start), mention: false });
    out.push({ text: '@' + m[2], mention: true });
    last = start + 1 + m[2].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out.length ? out : [{ text, mention: false }];
}

/** The "@par" being typed right before the caret, if any. */
export function mentionQuery(draft: string, caret: number): { start: number; query: string } | null {
  const before = draft.slice(0, caret);
  const m = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{0,16})$/.exec(before);
  if (!m) return null;
  return { start: before.length - m[2].length - 1, query: m[2] };
}

/** Names to offer for what was typed: names that start with it first, then names that contain it, each A to Z. */
export function suggestNames(names: string[], query: string, limit = 6): string[] {
  const q = query.toLowerCase();
  const uniq = [...new Set(names)];
  const starts = uniq.filter((n) => n.toLowerCase().startsWith(q)).sort((a, b) => a.localeCompare(b));
  const has = uniq.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b));
  return [...starts, ...has].slice(0, limit);
}

/** Puts the chosen name in place of the half-typed one. Returns the new text and where the caret goes. */
export function applyMention(draft: string, caret: number, name: string): { text: string; caret: number } {
  const q = mentionQuery(draft, caret);
  if (!q) return { text: draft, caret };
  const after = draft.slice(caret);
  const insert = `@${name}${after.startsWith(' ') ? '' : ' '}`;
  const text = draft.slice(0, q.start) + insert + after;
  return { text, caret: q.start + insert.length + (after.startsWith(' ') ? 1 : 0) };
}
