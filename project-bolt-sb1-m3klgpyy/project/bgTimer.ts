// Timers that keep their pace when the tab is in the background.
//
// Browsers slow `setInterval` in a hidden tab to once a second (or once a minute after a while) and stop `requestAnimationFrame`
// altogether. For an online game that means a host who switches tabs stops sending everyone's movement and a player who switches
// tabs freezes in place for everybody else. A Web Worker's timers are not slowed like that, so one small worker does the counting
// and the page just reacts to its ticks. If workers are not available it quietly falls back to ordinary setInterval.

type Entry = { fn: () => void; ms: number; next: number; fallback?: ReturnType<typeof setInterval> };

let worker: Worker | null = null;
let workerFailed = false;
let seq = 0;
const entries = new Map<number, Entry>();

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (workerFailed || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null;
  try {
    // The worker only counts: every 25 ms it says "tick", and the page decides which timers are due.
    const src = 'let t=setInterval(function(){postMessage(1)},25);onmessage=function(e){if(e.data===0){clearInterval(t)}}';
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = () => {
      const now = performance.now();
      for (const e of entries.values()) {
        if (e.fallback !== undefined || now < e.next) continue;
        e.next = Math.max(e.next + e.ms, now - e.ms); // catch up, but never fire a burst of missed ticks
        try { e.fn(); } catch (err) { console.error(err); }
      }
    };
    worker.onerror = () => { workerFailed = true; stopWorker(); for (const e of entries.values()) if (e.fallback === undefined) e.fallback = setInterval(e.fn, e.ms); };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function stopWorker() {
  if (!worker) return;
  try { worker.postMessage(0); worker.terminate(); } catch { /* already gone */ }
  worker = null;
}

/** Like setInterval, but it keeps running at full pace while the tab is hidden. Returns an id for clearBgInterval. */
export function setBgInterval(fn: () => void, ms: number): number {
  const id = ++seq;
  const e: Entry = { fn, ms, next: performance.now() + ms };
  entries.set(id, e);
  if (!ensureWorker()) e.fallback = setInterval(fn, ms);
  return id;
}

export function clearBgInterval(id: number | undefined | null) {
  if (id === undefined || id === null) return;
  const e = entries.get(id);
  if (!e) return;
  if (e.fallback !== undefined) clearInterval(e.fallback);
  entries.delete(id);
  if (!entries.size) stopWorker();
}

/** For tests: how many background timers are running and whether the worker is doing the counting. */
export function bgTimerInfo() { return { timers: entries.size, worker: worker !== null }; }
