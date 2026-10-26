// Talking to Stockfish (or any UCI engine) running as a Web Worker. The engine files are not bundled with the game:
// drop stockfish.js (and its .wasm) into public/engines/stockfish/ and it shows up as a choice in Analysis.
import { Position } from './rules';
import { MATE, type SearchLine } from './engine';
import type { AnalysisEngine } from './analysis';

export type UciInfo = { depth: number; multipv: number; cp: number | null; mate: number | null; pv: string[] };
/** Parse one "info ..." line; returns null if it carries no score. */
export function parseInfo(line: string): UciInfo | null {
  if (!line.startsWith('info ') || !/\bscore\b/.test(line)) return null;
  const t = line.split(/\s+/);
  const get = (k: string) => { const i = t.indexOf(k); return i >= 0 ? t[i + 1] : undefined; };
  const depth = parseInt(get('depth') ?? '0', 10);
  const multipv = parseInt(get('multipv') ?? '1', 10);
  const si = t.indexOf('score');
  const kind = t[si + 1], val = parseInt(t[si + 2], 10);
  if (isNaN(val)) return null;
  const pi = t.indexOf('pv');
  return { depth, multipv, cp: kind === 'cp' ? val : null, mate: kind === 'mate' ? val : null, pv: pi >= 0 ? t.slice(pi + 1) : [] };
}
/** UCI score to our scale: centipawns for the side to move, mate as +-(MATE - plies). */
export function uciScore(i: Pick<UciInfo, 'cp' | 'mate'>): number {
  if (i.mate !== null) return i.mate > 0 ? MATE - (2 * i.mate - 1) : -(MATE - 2 * -i.mate);
  return i.cp ?? 0;
}
export function parseBestMove(line: string): string | null { const m = /^bestmove\s+(\S+)/.exec(line); return m ? m[1] : null; }

export const STOCKFISH_URL = 'engines/stockfish/stockfish.js';
/** Is there an engine file we can load? */
export async function stockfishAvailable(url = STOCKFISH_URL): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') ?? '';
    return r.ok && !/text\/html/.test(type);
  } catch { return false; }
}

type WorkerLike = { postMessage(m: string): void; terminate(): void; onmessage: ((e: { data: unknown }) => void) | null };

/** Wrap a UCI worker as an AnalysisEngine. `make` is injectable for tests. */
export function uciEngine(make: () => WorkerLike, name = 'Stockfish'): AnalysisEngine & { ready: Promise<void> } {
  const w = make();
  let waiter: ((line: string) => void) | null = null;
  w.onmessage = (e) => { const s = typeof e.data === 'string' ? e.data : String((e.data as { data?: string })?.data ?? ''); for (const line of s.split('\n')) waiter?.(line.trim()); };
  const send = (c: string) => w.postMessage(c);
  const until = (pred: (l: string) => boolean, timeout = 15000) => new Promise<void>((res, rej) => {
    const t = setTimeout(() => { waiter = null; rej(new Error('engine timeout')); }, timeout);
    waiter = (l) => { if (pred(l)) { clearTimeout(t); waiter = null; res(); } };
  });
  const ready = (async () => { send('uci'); await until((l) => l === 'uciok'); send('isready'); await until((l) => l === 'readyok'); })();
  let busy: Promise<unknown> = ready;
  return {
    id: 'stockfish', name, ready,
    lines(fen, n, depth, timeMs) {
      const run = async (): Promise<SearchLine[]> => {
        await ready;
        const pos = Position.fromFen(fen);
        const found = new Map<number, UciInfo>();
        const done = new Promise<void>((res) => {
          waiter = (l) => {
            const inf = parseInfo(l);
            if (inf && inf.multipv <= n) found.set(inf.multipv, inf);
            if (parseBestMove(l) !== null) { waiter = null; res(); }
          };
        });
        send(`setoption name MultiPV value ${n}`);
        send(`position fen ${fen}`);
        send(`go depth ${depth} movetime ${Math.max(100, timeMs)}`);
        await done;
        const out: SearchLine[] = [];
        for (const k of [...found.keys()].sort((a, b) => a - b)) {
          const inf = found.get(k)!;
          const first = inf.pv[0] ? pos.parseUci(inf.pv[0]) : 0;
          if (!first) continue;
          const p2 = pos.clone(); const pv: number[] = [];
          for (const u of inf.pv) { const m = p2.parseUci(u); if (!m) break; pv.push(m); p2.make(m); }
          out.push({ move: first, score: uciScore(inf), pv });
        }
        return out;
      };
      const p = busy.then(run, run);
      busy = p.catch(() => undefined);
      return p;
    },
    stop() { send('stop'); },
    dispose() { try { send('quit'); } catch { /* gone */ } w.terminate(); },
  };
}
/** Start the real Stockfish worker (browser only). */
export function startStockfish(url = STOCKFISH_URL): AnalysisEngine & { ready: Promise<void> } {
  return uciEngine(() => new Worker(url) as unknown as WorkerLike);
}
