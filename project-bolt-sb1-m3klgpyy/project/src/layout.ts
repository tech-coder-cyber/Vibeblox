// Phones and small windows get a different layout: the menu bar moves to the bottom, the profile column hides,
// and pages use less padding. A phone held sideways counts too (it is wide but very short).
import { useSyncExternalStore } from 'react';

export function isCompactScreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || window.innerHeight < 520;
}
function subscribe(f: () => void): () => void {
  window.addEventListener('resize', f);
  window.addEventListener('orientationchange', f);
  return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); };
}
/** true on phones and small windows (re-renders when the window changes size or the phone turns). */
export function useCompactLayout(): boolean { return useSyncExternalStore(subscribe, isCompactScreen, () => false); }

// ---------------- Light / dark mode ----------------
// The menus (home, settings, Esc pages, the Admin panel) can be light or dark. The game itself never changes.
// Light mode is a set of CSS overrides in index.css that apply inside elements marked with the class "vb-themed".
export type Theme = 'dark' | 'light';
const THEME_KEY = 'vb-theme';
let theme: Theme = (() => { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } })();
const themeListeners = new Set<() => void>();
function applyTheme() { try { document.documentElement.classList.toggle('vb-light', theme === 'light'); } catch { /* no document */ } }
applyTheme();
export const getTheme = () => theme;
export function setTheme(t: Theme) {
  theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked */ }
  applyTheme();
  themeListeners.forEach((f) => f());
}
export function subscribeTheme(f: () => void): () => void { themeListeners.add(f); return () => { themeListeners.delete(f); }; }
export function useTheme(): Theme { return useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme); }
