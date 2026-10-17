// Small quality-of-life options, kept in the browser (one switch each in Settings > HUD):
//   outline    a dark outline and a soft glow on the block you are aiming at
//   lookingAt  the name of that block on screen
//   uiSounds   a soft tick when you press a button in the menus
//   nowPlaying "Now Playing" pop-up when a new song starts
//   blockBreak / blockPlace / footsteps   the sounds blocks make (Settings > Audio), and blockVolume how loud they are
import { useSyncExternalStore } from 'react';

export type QolPrefs = {
  outline: boolean; lookingAt: boolean; uiSounds: boolean; nowPlaying: boolean;
  blockBreak: boolean; blockPlace: boolean; footsteps: boolean; blockVolume: number;
};
export const QOL_DEFAULT: QolPrefs = { outline: true, lookingAt: true, uiSounds: true, nowPlaying: true, blockBreak: true, blockPlace: true, footsteps: true, blockVolume: 1 };
const KEY = 'vb-qol';

function load(): QolPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<QolPrefs>;
      const out = { ...QOL_DEFAULT };
      for (const k of Object.keys(QOL_DEFAULT) as Array<keyof QolPrefs>) {
        if (k === 'blockVolume') { if (typeof o[k] === 'number' && Number.isFinite(o[k])) out[k] = Math.max(0, Math.min(1, o[k] as number)); }
        else if (typeof o[k] === 'boolean') (out as Record<string, unknown>)[k] = o[k];
      }
      return out;
    }
  } catch { /* storage blocked or broken: use the defaults */ }
  return { ...QOL_DEFAULT };
}

let prefs: QolPrefs = load();
const listeners = new Set<() => void>();
export const getQol = () => prefs;
export function setQol(patch: Partial<QolPrefs>) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
  listeners.forEach((f) => f());
}
export function subscribeQol(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }
export function useQol(): QolPrefs { return useSyncExternalStore(subscribeQol, getQol, getQol); }

// ---------------- the soft tick for menu buttons ----------------
let uiCtx: AudioContext | null = null;
let uiVolume = 0.6;
export function setUiSoundVolume(v: number) { uiVolume = Math.max(0, Math.min(1, v)); }
export function uiClick(kind: 'tick' | 'back' = 'tick') {
  if (!prefs.uiSounds || uiVolume <= 0) return;
  try {
    if (!uiCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      uiCtx = new Ctor();
    }
    const ctx = uiCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(kind === 'back' ? 520 : 880, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'back' ? 380 : 620, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1 * uiVolume, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
  } catch { /* no audio: no tick */ }
}

/** Pressing a button, tab or switch in a menu ticks. Not while the mouse is captured by the game (the game has its own sounds). */
export function installUiSounds(): () => void {
  const onDown = (e: PointerEvent) => {
    if (document.pointerLockElement) return;
    const el = (e.target as HTMLElement | null)?.closest?.('button, [role="button"], a[href], summary, select, label[for]') as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.closest('[data-testid="touch-controls"]')) return; // the on-screen game controls stay quiet
    const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase();
    uiClick(/^(back|close|cancel|exit|leave|✕|×)/.test(label) ? 'back' : 'tick');
  };
  document.addEventListener('pointerdown', onDown, true);
  return () => document.removeEventListener('pointerdown', onDown, true);
}
