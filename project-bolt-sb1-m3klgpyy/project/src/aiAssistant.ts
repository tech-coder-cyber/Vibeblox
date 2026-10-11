// VibeBlox AI Assistant (client side)
// -----------------------------------------------------------------------
// 1. requestAssistant(): sends the request and streams the answer back.
//    Normally it goes to YOUR server function (/api/ai), which holds the
//    Gemini key, so players never need a key. A "developer key" can be used
//    for testing in Bolt, where the server function doesn't run.
// 2. parseSearchReplace() + applySearchReplace(): turn the AI's
//    SEARCH/REPLACE blocks into edits on the editor's code.
// No framework code here, so it can be reused anywhere.
import { buildGeminiRequest, geminiChunkText, AI_PROMPT_VERSION, API_FUNCTION_COUNT, type AiMode, type AiTurn } from './scripting';

export type { AiMode, AiTurn };

/** What the AI backend says it knows. Shown in the panel so you can tell which server version is live. */
export type AiMeta = { promptVersion: number; apiFunctions: number; model: string };

/** Where requests go. functions/api/ai.ts (a Cloudflare Pages Function) serves this path. */
export const AI_ENDPOINT = '/api/ai';

type Names = { blocks: string[]; items: string[] };

/** Read a Server-Sent Events stream and call onEvent with each JSON payload. */
async function readSse(res: Response, onEvent: (data: unknown) => void) {
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let cut: number;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        let data: unknown;
        try { data = JSON.parse(raw); } catch { continue; }
        onEvent(data);
      }
    }
  }
}

/**
 * Ask the assistant. onText is called with the full answer so far as it streams in.
 * mode: 'normal' (fast) or 'high-effort' (deep reasoning) — the server picks the model.
 */
export async function requestAssistant(opts: {
  mode: AiMode; history: AiTurn[]; code: string; names: Names; devKey?: string; signal?: AbortSignal; onText: (text: string) => void;
  /** Called once per answer. null means the server is an old version that doesn't report what it knows. */
  onMeta?: (meta: AiMeta | null) => void;
}): Promise<string> {
  let out = '';
  const push = (t: string) => { if (t) { out += t; opts.onText(out); } };

  if (opts.devKey) {
    // Testing only: straight to Google with a key saved in this browser
    let usedModel = '';
    const call = async (withThinking: boolean) => {
      const { model, body } = buildGeminiRequest(opts.mode, opts.history, opts.code, opts.names, withThinking);
      usedModel = model;
      return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST', signal: opts.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.devKey! },
        body: JSON.stringify(body),
      });
    };
    let res = await call(true);
    if (res.status === 400) res = await call(false); // if this model doesn't take the reasoning setting, try without it
    if (!res.ok) throw new Error(await errorText(res));
    opts.onMeta?.({ promptVersion: AI_PROMPT_VERSION, apiFunctions: API_FUNCTION_COUNT, model: usedModel });
    await readSse(res, (d) => {
      const err = (d as { error?: { message?: string } }).error;
      if (err) throw new Error(err.message ?? 'The AI stopped with an error');
      push(geminiChunkText(d));
    });
    return out;
  }

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST', signal: opts.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: opts.mode, history: opts.history, code: opts.code, names: opts.names }),
  });
  if (res.status === 404) throw new Error("The AI isn't set up on this site yet. Deploy to Cloudflare Pages with the GEMINI_API_KEY secret set (see functions/api/ai.ts), or add a developer key to test.");
  if (!res.ok) throw new Error(await errorText(res));
  let gotMeta = false;
  await readSse(res, (d) => {
    const ev = d as { text?: string; error?: string; meta?: AiMeta };
    if (ev.error) throw new Error(ev.error);
    if (ev.meta) { gotMeta = true; opts.onMeta?.(ev.meta); }
    if (ev.text) push(ev.text);
  });
  if (!gotMeta) opts.onMeta?.(null); // an older ai.ts that doesn't announce what it knows
  return out;
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error?.message ?? j?.error ?? `Request failed (${res.status})`;
  } catch {
    return res.status === 429 ? 'Too many requests. Wait a few minutes and try again.' : `Request failed (${res.status})`;
  }
}

// ---------------- SEARCH/REPLACE ----------------
export type DiffBlock = { search: string; replace: string };
export type ApplyResult = { code: string; applied: number; failed: Array<{ index: number; search: string }> };

const START = /^\s*<{4,9}\s*SEARCH\s*$/i;
const MID = /^\s*={4,9}\s*$/;
const END = /^\s*>{4,9}\s*REPLACE\s*$/i;

/** Finds every SEARCH/REPLACE block in the AI's answer (ignores anything around them). */
export function parseSearchReplace(text: string): DiffBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: DiffBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!START.test(lines[i])) { i++; continue; }
    const search: string[] = [];
    i++;
    while (i < lines.length && !MID.test(lines[i])) search.push(lines[i++]);
    if (i >= lines.length) break; // unfinished block
    i++;
    const replace: string[] = [];
    while (i < lines.length && !END.test(lines[i])) replace.push(lines[i++]);
    if (i >= lines.length) break; // still streaming, or cut off
    i++;
    blocks.push({ search: search.join('\n'), replace: replace.join('\n') });
  }
  return blocks;
}

/** Locate `search` as whole lines, comparing lines after `norm` (e.g. trimmed). */
function findLines(codeLines: string[], searchLines: string[], norm: (l: string) => string): number {
  const want = searchLines.map(norm);
  outer: for (let i = 0; i + want.length <= codeLines.length; i++) {
    for (let k = 0; k < want.length; k++) if (norm(codeLines[i + k]) !== want[k]) continue outer;
    return i;
  }
  return -1;
}

/**
 * Applies blocks one after another. Matching is exact first, then forgiving
 * about trailing spaces, then about indentation (models often slip there).
 * An empty SEARCH adds the code at the end (or fills an empty editor).
 */
export function applySearchReplace(code: string, blocks: DiffBlock[]): ApplyResult {
  let cur = code.replace(/\r\n?/g, '\n');
  let applied = 0;
  const failed: ApplyResult['failed'] = [];
  blocks.forEach((b, index) => {
    if (b.search.trim() === '') {
      cur = cur.trim() === '' ? b.replace.replace(/^\n+/, '') + '\n' : cur.replace(/\s*$/, '') + '\n\n' + b.replace.replace(/^\n+/, '') + '\n';
      applied++;
      return;
    }
    const at = cur.indexOf(b.search);
    if (at >= 0) {
      cur = cur.slice(0, at) + b.replace + cur.slice(at + b.search.length);
      applied++;
      return;
    }
    const codeLines = cur.split('\n');
    let searchLines = b.search.split('\n');
    while (searchLines.length && searchLines[0].trim() === '') searchLines = searchLines.slice(1);
    while (searchLines.length && searchLines[searchLines.length - 1].trim() === '') searchLines = searchLines.slice(0, -1);
    for (const norm of [(l: string) => l.replace(/\s+$/, ''), (l: string) => l.trim()]) {
      const i = findLines(codeLines, searchLines, norm);
      if (i >= 0) {
        codeLines.splice(i, searchLines.length, ...(b.replace === '' ? [] : b.replace.split('\n')));
        cur = codeLines.join('\n');
        applied++;
        return;
      }
    }
    failed.push({ index, search: b.search });
  });
  return { code: cur, applied, failed };
}
