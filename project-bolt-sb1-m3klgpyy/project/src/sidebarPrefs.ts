// What the left sidebar shows: which buttons, in what order, how big, and whether they have labels. Saved on this device.
import { useSyncExternalStore } from 'react';

export type SidebarSize = 'small' | 'normal' | 'large';
export type SidebarPrefs = {
  /** views whose buttons are hidden (Home and Settings can never be hidden) */ hidden: string[];
  /** the order of the buttons (views not listed keep their place at the end) */ order: string[];
  size: SidebarSize; labels: boolean; discord: boolean; news: boolean; version: boolean;
};
export const SIDEBAR_DEFAULT: SidebarPrefs = { hidden: [], order: [], size: 'normal', labels: true, discord: true, news: true, version: true };
export const SIDEBAR_LOCKED = ['home', 'settings'];
const KEY = 'vb-sidebar';

export function normalizeSidebar(v: unknown): SidebarPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<SidebarPrefs>;
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 30) : []);
  return {
    hidden: arr(o.hidden).filter((s) => !SIDEBAR_LOCKED.includes(s)), order: arr(o.order),
    size: o.size === 'small' || o.size === 'large' ? o.size : 'normal',
    labels: o.labels !== false, discord: o.discord !== false, news: o.news !== false, version: o.version !== false,
  };
}
/** Put the items in the saved order and leave out the hidden ones. */
export function arrangeSidebar<T extends { view?: string }>(items: T[], p: SidebarPrefs): T[] {
  const rank = (it: T) => { const i = p.order.indexOf(it.view ?? ''); return i < 0 ? 1000 + items.indexOf(it) : i; };
  return items.filter((it) => !it.view || !p.hidden.includes(it.view)).sort((a, b) => rank(a) - rank(b));
}

let cache: SidebarPrefs | null = null;
const listeners = new Set<() => void>();
export function loadSidebar(): SidebarPrefs {
  if (cache) return cache;
  try { cache = normalizeSidebar(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { cache = normalizeSidebar(null); }
  return cache;
}
export function saveSidebar(p: SidebarPrefs) {
  cache = normalizeSidebar(p);
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage blocked */ }
  listeners.forEach((f) => f());
}
export function useSidebarPrefs(): SidebarPrefs {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, loadSidebar, loadSidebar);
}
