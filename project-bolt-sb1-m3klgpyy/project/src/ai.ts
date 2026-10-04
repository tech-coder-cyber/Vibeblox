// VibeBlox AI proxy (Cloudflare Pages Function: this file at functions/api/ai.ts is served at /api/ai)
// -----------------------------------------------------------------------
// Your Gemini key lives HERE, on the server, as an environment variable,
// never in the game's code. Players call /api/ai without any key.
//
// Setup (Cloudflare dashboard -> Workers & Pages -> your project -> Settings ->
// Variables and Secrets -> Add, type "Secret", for Production), then redeploy:
//   GEMINI_API_KEY = your key from https://aistudio.google.com/apikey
// Optional (type "Text"):
//   AI_REQUESTS_PER_WINDOW = 20   (per player IP, per 10 minutes)
//
// Strongly recommended: in Google AI Studio / Google Cloud billing, set a
// budget alert or stay on the free tier, so a flood of requests can't cost
// you money. The rate limit below is best-effort (per server instance).
import { buildGeminiRequest, geminiChunkText, AI_MODELS, AI_PROMPT_VERSION, API_FUNCTION_COUNT, type AiMode, type AiTurn } from '../../src/scripting';

type Env = { GEMINI_API_KEY?: string; AI_REQUESTS_PER_WINDOW?: string };

const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(env: Env, ip: string): boolean {
  const limit = Number(env.AI_REQUESTS_PER_WINDOW ?? 20) || 20;
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return false;
}

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const req = context.request;
  const env = context.env;
  // Open https://your-site/api/ai in a browser: it shows which version of this function is live
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      ok: true, service: 'vibeblox-ai', promptVersion: AI_PROMPT_VERSION, apiFunctions: API_FUNCTION_COUNT,
      models: { normal: AI_MODELS.normal.model, 'high-effort': AI_MODELS['high-effort'].model },
      keyConfigured: !!env.GEMINI_API_KEY,
    }, null, 2), { headers: { 'content-type': 'application/json' } });
  }
  if (req.method !== 'POST') return json(405, 'Use POST or GET');
  const key = env.GEMINI_API_KEY;
  if (!key) return json(500, 'The server has no GEMINI_API_KEY set yet.');
  if (rateLimited(env, req.headers.get('CF-Connecting-IP') ?? 'unknown')) return json(429, 'Too many requests. Wait a few minutes and try again.');

  let input: { mode?: string; history?: AiTurn[]; code?: string; names?: { blocks?: string[]; items?: string[] } };
  try { input = await req.json(); } catch { return json(400, 'Bad request'); }
  const mode: AiMode = input.mode === 'high-effort' ? 'high-effort' : 'normal'; // only these two models can ever be used
  const history = Array.isArray(input.history) ? input.history.filter((t) => t && typeof t.text === 'string').slice(-10) : [];
  if (!history.length || history[history.length - 1].role !== 'user') return json(400, 'The last message must be from the player');
  if (JSON.stringify(input).length > 200_000) return json(413, 'That request is too big');
  const names = { blocks: (input.names?.blocks ?? []).map(String), items: (input.names?.items ?? []).map(String) };

  const call = (withThinking: boolean) => {
    const { model, body } = buildGeminiRequest(mode, history, String(input.code ?? ''), names, withThinking);
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
  };
  let upstream = await call(true);
  if (upstream.status === 400) upstream = await call(false); // model doesn't take the reasoning setting: try without
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('Gemini error', upstream.status, AI_MODELS[mode].model, detail.slice(0, 500));
    return json(502, upstream.status === 429 ? 'The AI is busy right now. Try again in a minute.' : 'The AI request failed. Try again.');
  }

  // Re-stream Gemini's answer as simple { text } events (the hidden reasoning is dropped)
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // Tell the game what this server knows, so the panel can show it
      send({ meta: { promptVersion: AI_PROMPT_VERSION, apiFunctions: API_FUNCTION_COUNT, model: AI_MODELS[mode].model } });
      const reader = upstream.body!.getReader();
      let buf = '';
      try {
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
              try {
                const text = geminiChunkText(JSON.parse(line.slice(5).trim()));
                if (text) send({ text });
              } catch { /* skip partial lines */ }
            }
          }
        }
        send({ done: true });
      } catch {
        send({ error: 'The connection to the AI dropped. Try again.' });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
}
