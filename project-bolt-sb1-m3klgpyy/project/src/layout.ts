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

// ---------------- Menu themes ----------------
// The menus (home, settings, Esc pages, the Admin panel) can be dark, super dark (black), gray, light, or Custom (your own colours,
// Vanguard and up). The game itself never changes. Light mode is a set of CSS overrides in index.css that apply inside elements marked
// with the class "vb-themed"; the Custom theme writes the same kind of overrides from two colours you pick.
export type Theme = 'dark' | 'light' | 'superdark' | 'gray' | 'custom';
export const THEMES: Theme[] = ['dark', 'superdark', 'gray', 'light'];
export const ALL_THEMES: Theme[] = [...THEMES, 'custom'];
export type CustomTheme = { bg: string; accent: string };
export const DEFAULT_CUSTOM_THEME: CustomTheme = { bg: '#1a1530', accent: '#b388ff' };
/** Quick picks for the two colours (the colour picker next to them takes anything). */
export const THEME_BG_SWATCHES = ['#0a0e14', '#1a1530', '#10231c', '#2a1218', '#0f1e30', '#2b2112', '#000000', '#2b2b2b', '#eef1f5', '#fbeef3'];
export const THEME_ACCENT_SWATCHES = ['#00e676', '#b388ff', '#ff6e9c', '#ffb02e', '#40c4ff', '#ff5252', '#64ffda', '#eeff41', '#ffffff', '#ff9100'];
const THEME_KEY = 'vb-theme';
const CUSTOM_KEY = 'vb-theme-custom';
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
let theme: Theme = (() => { try { const v = localStorage.getItem(THEME_KEY) as Theme | null; return v && ALL_THEMES.includes(v) ? v : 'dark'; } catch { return 'dark'; } })();
let custom: CustomTheme = (() => {
  try { const o = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? 'null') as Partial<CustomTheme> | null; return { bg: isHexColor(o?.bg) ? o!.bg!.toLowerCase() : DEFAULT_CUSTOM_THEME.bg, accent: isHexColor(o?.accent) ? o!.accent!.toLowerCase() : DEFAULT_CUSTOM_THEME.accent }; }
  catch { return { ...DEFAULT_CUSTOM_THEME }; }
})();
/** Only Vanguard and up (and Elite, Champion, who have everything Vanguard has) may use the Custom theme. Set by the App from your rank. */
let customAllowed = false;
const themeListeners = new Set<() => void>();

// ---- colour maths ----
function hexToRgb(h: string): [number, number, number] { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rgbToHex(r: number, g: number, b: number): string { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function hexToHsl(h: string): [number, number, number] {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1));
  const hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((hue * 60) + 360) % 360, sat, l];
}
export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/** 0 (black) .. 1 (white), by how bright it looks. */
export function luminance(hex: string): number { const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type CustomPalette = { light: boolean; bg: Record<'05080c' | '0a0e14' | '0d131b' | '121822' | '1a2230' | '243044' | '2a3444', string>; border: Record<'243044' | '1a2230' | '364860', string>; accent: string; onAccent: string; accentRgb: [number, number, number] };
/** The set of colours the Custom theme paints the menus with, worked out from the two you picked. */
export function customPalette(c: CustomTheme): CustomPalette {
  const [h, s0, l0] = hexToHsl(c.bg);
  const light = luminance(c.bg) > 0.5;
  const s = Math.min(s0, 0.6);
  const at = (d: number) => hslToHex(h, s, clamp01(l0 + d));
  const bg = light
    ? { '05080c': at(-0.05), '0a0e14': at(0), '0d131b': at(0.03), '121822': at(0.04), '1a2230': at(-0.04), '243044': at(-0.08), '2a3444': at(-0.1) }
    : { '05080c': at(-0.02), '0a0e14': at(0), '0d131b': at(0.02), '121822': at(0.045), '1a2230': at(0.08), '243044': at(0.13), '2a3444': at(0.16) };
  const border = light ? { '243044': at(-0.12), '1a2230': at(-0.06), '364860': at(-0.2) } : { '243044': at(0.13), '1a2230': at(0.08), '364860': at(0.22) };
  return { light, bg, border, accent: c.accent, onAccent: luminance(c.accent) > 0.35 ? '#0a0e14' : '#ffffff', accentRgb: hexToRgb(c.accent) };
}
const esc = (cls: string) => cls.replace(/[\[\]#/:.()%]/g, (m) => '\\' + m);
/** The CSS for the Custom theme (the same kind of overrides as the built-in themes, but with your colours). */
export function customThemeCss(c: CustomTheme): string {
  const p = customPalette(c);
  const P = 'html.vb-custom.vb-custom .vb-themed';
  const both = (cls: string, decl: string) => `${P} .${esc(cls)}, ${P}.${esc(cls)} { ${decl} !important; }`;
  const out: string[] = [`${P} { color-scheme: ${p.light ? 'light' : 'dark'}; }`];
  for (const k of Object.keys(p.bg) as Array<keyof CustomPalette['bg']>) out.push(both(`bg-[#${k}]`, `background-color: ${p.bg[k]}`));
  out.push(both('bg-[#0a0e14]/95', `background-color: ${p.bg['0a0e14']}f7`), both('bg-[#0a0e14]/80', `background-color: ${p.bg['0a0e14']}d9`));
  for (const k of Object.keys(p.border) as Array<keyof CustomPalette['border']>) out.push(both(`border-[#${k}]`, `border-color: ${p.border[k]}`));
  out.push(both('border-[#3a4a60]', `border-color: ${p.border['364860']}`));
  out.push(`${P} .hover\\:bg-\\[\\#1a2230\\]:hover { background-color: ${p.bg['1a2230']} !important; }`);
  // the accent (the green used for buttons, highlights and links)
  const [r, g, b] = p.accentRgb;
  for (const [pre, prop] of [['bg', 'background-color'], ['text', 'color'], ['border', 'border-color']] as const) {
    out.push(both(`${pre}-[#00e676]`, `${prop}: ${p.accent}`));
    out.push(`${P} .hover\\:${pre}-\\[\\#00e676\\]:hover { ${prop}: ${p.accent} !important; }`);
    for (const a of [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95]) {
      out.push(both(`${pre}-[#00e676]/${a}`, `${prop}: rgba(${r}, ${g}, ${b}, ${a / 100})`));
      out.push(`${P} .hover\\:${pre}-\\[\\#00e676\\]\\/${a}:hover { ${prop}: rgba(${r}, ${g}, ${b}, ${a / 100}) !important; }`);
    }
  }
  out.push(`${P} .bg-\\[\\#00e676\\].text-\\[\\#0a0e14\\], ${P} .bg-\\[\\#00e676\\] .text-\\[\\#0a0e14\\] { color: ${p.onAccent} !important; }`);
  out.push(`${P} .shadow-\\[0_0_6px_\\#00e676\\] { box-shadow: 0 0 6px ${p.accent} !important; }`);
  return out.join('\n');
}
function applyTheme() {
  try {
    const eff = effectiveTheme();
    const c = document.documentElement.classList;
    const pal = eff === 'custom' ? customPalette(custom) : null;
    c.toggle('vb-light', eff === 'light' || !!pal?.light); c.toggle('vb-superdark', eff === 'superdark'); c.toggle('vb-gray', eff === 'gray'); c.toggle('vb-custom', eff === 'custom');
    let el = document.getElementById('vb-custom-theme') as HTMLStyleElement | null;
    if (eff === 'custom') {
      if (!el) { el = document.createElement('style'); el.id = 'vb-custom-theme'; document.head.appendChild(el); }
      el.textContent = customThemeCss(custom);
    } else if (el) el.textContent = '';
  } catch { /* no document (a test, or a server) */ }
}
/** The theme that is really showing: Custom needs the rank, without it the menus fall back to Dark. */
export function effectiveTheme(): Theme { return theme === 'custom' && !customAllowed ? 'dark' : theme; }
applyTheme();
export const getTheme = () => theme;
export function setTheme(t: Theme) {
  theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked */ }
  applyTheme();
  themeListeners.forEach((f) => f());
}
export const getCustomTheme = () => custom;
export function setCustomTheme(next: Partial<CustomTheme>) {
  custom = { bg: isHexColor(next.bg) ? next.bg.toLowerCase() : custom.bg, accent: isHexColor(next.accent) ? next.accent.toLowerCase() : custom.accent };
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); } catch { /* storage blocked */ }
  applyTheme();
  themeListeners.forEach((f) => f());
}
export function resetCustomTheme() { setCustomTheme(DEFAULT_CUSTOM_THEME); }
export function setCustomThemeAllowed(ok: boolean) {
  if (customAllowed === ok) return;
  customAllowed = ok;
  applyTheme();
  themeListeners.forEach((f) => f());
}
export const isCustomThemeAllowed = () => customAllowed;
export function subscribeTheme(f: () => void): () => void { themeListeners.add(f); return () => { themeListeners.delete(f); }; }
export function useTheme(): Theme { return useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme); }
export function useCustomTheme(): CustomTheme { return useSyncExternalStore(subscribeTheme, getCustomTheme, () => DEFAULT_CUSTOM_THEME); }
export function useCustomThemeAllowed(): boolean { return useSyncExternalStore(subscribeTheme, isCustomThemeAllowed, () => false); }
