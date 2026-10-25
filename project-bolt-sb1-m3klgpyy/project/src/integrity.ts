// Looks for outside scripts running in the game's page: userscript managers (Tampermonkey, Greasemonkey, Violentmonkey),
// scripts that add themselves to the page, browser functions that have been swapped out, and clicks that no hand made.
//
// Nothing in a browser can be proven: a careful script hides from every check here. So this only raises a flag, and the flag
// goes to the people who run the world (an "Outside script" anti-cheat alert), never to a ban by itself. Safe things are never
// flagged: the game's own files, the ad network, the Cloudflare and Google helpers, and normal extensions that only change the
// look of the page.

import { PLATFORM } from './adEconomy';

export type Flag = 'userscript manager' | 'injected script' | 'patched browser functions' | 'scripted clicks';
export const FLAG_LABELS: Record<Flag, string> = {
  'userscript manager': 'A userscript manager (Tampermonkey, Greasemonkey, Violentmonkey) is running a script here',
  'injected script': 'A script that is not part of the game was added to the page',
  'patched browser functions': 'Core browser functions were replaced (a speed or timing hack does this)',
  'scripted clicks': 'Clicks were sent by a script instead of a mouse',
};

/** Script sources that belong to the game's normal setup (ads, analytics and the CDN it is served from). */
const SAFE_HOSTS = /(^|\.)(google\.com|googlesyndication\.com|doubleclick\.net|googleadservices\.com|gstatic\.com|googletagmanager\.com|google-analytics\.com|googleapis\.com|adtrafficquality\.google|cloudflareinsights\.com|cloudflare\.com|vibeblox\.online|crazygames\.com|poki\.com|poki-cdn\.com|adinplay\.com|gameads\.com|imasdk\.googleapis\.com)$/i;
/** Names a userscript manager puts on the page (or in it). */
const GM_GLOBALS = ['GM_info', 'GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_addStyle', 'GM_registerMenuCommand', 'unsafeWindow', 'Tampermonkey', 'Violentmonkey', 'Greasemonkey'];
const GM_SELECTOR = '[id*="tampermonkey" i],[class*="tampermonkey" i],[id*="violentmonkey" i],[class*="violentmonkey" i],[id*="greasemonkey" i],[class*="greasemonkey" i],[data-tampermonkey],[data-violentmonkey],[data-userscript]';
/** Browser functions a timing / speed / network hack replaces. A real one prints "[native code]". */
const NATIVES: Array<[string, string]> = [
  ['window', 'fetch'], ['window', 'WebSocket'], ['window', 'requestAnimationFrame'], ['window', 'setTimeout'], ['window', 'setInterval'],
  ['performance', 'now'], ['Date', 'now'], ['Math', 'random'],
];

type Env = { window: Record<string, unknown>; document: { querySelector?: (s: string) => unknown; currentScript?: unknown; querySelectorAll?: (s: string) => ArrayLike<unknown> }; location?: { origin?: string; hostname?: string } };

const isNative = (fn: unknown, toString: (f: unknown) => string): boolean => {
  if (typeof fn !== 'function') return true; // (not there at all: not our business)
  try { return /\[native code\]/.test(toString(fn)); } catch { return false; }
};

/** Whether a script element is something the game / ad network / CDN put there. */
export function scriptIsOurs(src: string, text: string, origin: string): boolean {
  if (!src) return !/==UserScript==|GM_[a-zA-Z]+|unsafeWindow|Tampermonkey|Violentmonkey|Greasemonkey/.test(text); // inline: fine unless it talks like a userscript
  if (src.startsWith('blob:') || src.startsWith('data:')) return false; // userscript managers hand scripts over as blobs
  try {
    const u = new URL(src, origin || 'https://localhost');
    if (origin && u.origin === origin) return true;
    return SAFE_HOSTS.test(u.hostname);
  } catch { return false; }
}

/** One look at the page right now. */
export function scanOutsideScripts(env?: Partial<Env>): Flag[] {
  const w = (env?.window ?? (typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {})) as Record<string, unknown>;
  const doc = (env?.document ?? (typeof document !== 'undefined' ? document : {})) as Env['document'];
  const out = new Set<Flag>();
  // 1. a userscript manager
  try {
    if (GM_GLOBALS.some((g) => typeof w[g] !== 'undefined')) out.add('userscript manager');
    const ext = w.external as { Tampermonkey?: unknown; Violentmonkey?: unknown } | undefined;
    if (ext && (typeof ext.Tampermonkey !== 'undefined' || typeof ext.Violentmonkey !== 'undefined')) out.add('userscript manager');
    if (doc.querySelector && doc.querySelector(GM_SELECTOR)) out.add('userscript manager');
  } catch { /* a page that fights back is not our problem */ }
  // 2. scripts that are not the game's
  try {
    const origin = env?.location?.origin ?? (typeof location !== 'undefined' ? location.origin : '');
    const list = doc.querySelectorAll ? Array.from(doc.querySelectorAll('script')) : [];
    for (const s of list as Array<{ src?: string; textContent?: string | null }>) {
      if (!scriptIsOurs(s.src ?? '', (s.textContent ?? '').slice(0, 4000), origin)) { out.add('injected script'); break; }
    }
  } catch { /* ignore */ }
  // 3. swapped-out browser functions (check the checker first: if toString was replaced, that is the answer)
  try {
    const realToString = (Function.prototype.toString as (this: unknown) => string);
    if (!/\[native code\]/.test(realToString.call(realToString))) out.add('patched browser functions');
    else {
      const ts = (f: unknown) => realToString.call(f);
      for (const [owner, name] of NATIVES) {
        const o = owner === 'window' ? w : (w[owner] as Record<string, unknown> | undefined);
        if (o && !isNative(o[name], ts)) { out.add('patched browser functions'); break; }
      }
    }
  } catch { /* ignore */ }
  return [...out];
}

/**
 * Keeps watching: scans now and every few seconds, notices scripts added later, and counts mouse clicks that were not made
 * by a hand (event.isTrusted is false for clicks a script sends). onChange gets the whole list whenever it changes.
 */
export function watchOutsideScripts(onChange: (flags: Flag[]) => void, opts?: { every?: number }): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let flags: Flag[] = [];
  let fakeClicks = 0;
  const push = () => {
    let next = scanOutsideScripts();
    // On CrazyGames and Poki the portal owns the page: its SDK adds ad scripts and may wrap timers. Only a userscript manager counts there.
    if (PLATFORM !== 'web') next = next.filter((f) => f === 'userscript manager');
    if (fakeClicks >= 4) next.push('scripted clicks');
    const key = (a: Flag[]) => a.slice().sort().join(',');
    if (key(next) !== key(flags)) { flags = next; onChange(flags.slice()); }
  };
  const onMouse = (e: Event) => { if (!e.isTrusted) { fakeClicks++; if (fakeClicks === 4) push(); } };
  const types = ['mousedown', 'mouseup', 'click'];
  for (const t of types) window.addEventListener(t, onMouse, true);
  let mo: MutationObserver | null = null;
  try {
    mo = new MutationObserver((records) => {
      for (const r of records) for (const n of Array.from(r.addedNodes)) if ((n as Element).tagName === 'SCRIPT') { push(); return; }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* no observer */ }
  const timer = window.setInterval(push, opts?.every ?? 15_000);
  window.setTimeout(push, 1500); // the page and any manager have settled
  return () => { for (const t of types) window.removeEventListener(t, onMouse, true); mo?.disconnect(); window.clearInterval(timer); };
}
