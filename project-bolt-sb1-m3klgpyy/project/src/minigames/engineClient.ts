// Runs the engine in a Web Worker so the page never freezes; falls back to the main thread when workers cannot start.
import { handle, type EngineRequest, type EngineReply } from './engineCore';
import type { AnalysisEngine } from './chess/analysis';
import { Position } from './chess/rules';
import { startStockfish, stockfishAvailable } from './chess/uci';

type Pending = { res: (r: EngineReply) => void; rej: (e: unknown) => void };
class Client {
  private w: Worker | null = null;
  private broken = false;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private ensure(): Worker | null {
    if (this.broken) return null;
    if (this.w) return this.w;
    try {
      const w = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent) => { const { id, reply, error } = e.data as { id: number; reply?: EngineReply; error?: string }; const p = this.pending.get(id); if (!p) return; this.pending.delete(id); if (error) p.rej(new Error(error)); else p.res(reply!); };
      w.onerror = () => this.fallBack();
      this.w = w;
      return w;
    } catch { this.broken = true; return null; }
  }
  private fallBack() {
    this.broken = true; this.w = null;
    const todo = [...this.pending.entries()]; this.pending.clear();
    for (const [, p] of todo) p.rej(new Error('worker-failed'));
  }
  async call(req: EngineRequest): Promise<EngineReply> {
    const w = this.ensure();
    if (w) {
      try {
        return await new Promise<EngineReply>((res, rej) => {
          const id = ++this.seq; this.pending.set(id, { res, rej });
          // a worker that never answers (blocked file) is given up on
          const t = window.setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); this.broken = true; rej(new Error('worker-timeout')); } }, 20000);
          const done = this.pending.get(id)!;
          this.pending.set(id, { res: (r) => { clearTimeout(t); done.res(r); }, rej: (e) => { clearTimeout(t); done.rej(e); } });
          w.postMessage({ id, req });
        });
      } catch { /* run it here instead */ }
    }
    await new Promise((r) => setTimeout(r, 20)); // let the page paint first
    return handle(req);
  }
}
const client = new Client();
export const engine = {
  chessBot: async (botId: string, startFen: string, moves: string[]) => (await client.call({ type: 'chessBot', botId, startFen, moves })) as Extract<EngineReply, { type: 'chessBot' }>,
  checkersBot: async (botId: string, moves: string[]) => (await client.call({ type: 'checkersBot', botId, moves })) as Extract<EngineReply, { type: 'checkersBot' }>,
  checkersHint: async (moves: string[], depth = 8, timeMs = 800) => (await client.call({ type: 'checkersHint', moves, depth, timeMs })) as Extract<EngineReply, { type: 'checkersHint' }>,
  newGame: async () => { await client.call({ type: 'newGame' }); },
};
export const builtinAnalysis: AnalysisEngine = {
  id: 'builtin', name: 'VibeBlox engine',
  async lines(fen, n, depth, timeMs) {
    const r = (await client.call({ type: 'lines', fen, n, depth, timeMs })) as Extract<EngineReply, { type: 'lines' }>;
    return r.lines;
  },
};
let sf: (AnalysisEngine & { ready: Promise<void> }) | null = null;
let sfChecked: boolean | null = null;
/** True when Stockfish files were put in public/engines/stockfish/. */
export async function hasStockfish(): Promise<boolean> { if (sfChecked === null) sfChecked = await stockfishAvailable(); return sfChecked; }
/** The engine the player chose for analysis; Stockfish when available and chosen, otherwise the built-in one. */
export async function analysisEngine(choice: 'builtin' | 'stockfish'): Promise<AnalysisEngine> {
  if (choice === 'stockfish' && (await hasStockfish())) {
    try { if (!sf) { sf = startStockfish(); } await sf.ready; return sf; } catch { sf = null; }
  }
  return builtinAnalysis;
}
void Position;
