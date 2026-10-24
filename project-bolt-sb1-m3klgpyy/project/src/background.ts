// The picture behind the menus (Home, Servers, Settings...).
//   default  a picture you put in public/images (background.jpg / .png / .webp ...), if there is one
//   custom   a picture you choose in Settings > Video, kept in this browser
//   none     the plain dark background
// `dim` darkens the picture so the text stays readable (0 = as is, 0.85 = almost black).
import { useSyncExternalStore } from 'react';

export type BgMode = 'default' | 'custom' | 'none';
export type BgPrefs = { mode: BgMode; dim: number; custom: string };
export const BG_DEFAULT: BgPrefs = { mode: 'default', dim: 0.55, custom: '' };
const KEY = 'vb-bg';

/** Names tried (in this order) inside public/images for the default background. */
export const DEFAULT_BG_FILES = ['background', 'bg', 'default-background', 'menu-background'].flatMap((n) => ['jpg', 'jpeg', 'png', 'webp', 'gif'].map((e) => `images/${n}.${e}`));

export function cleanBg(o: unknown): BgPrefs {
  const out = { ...BG_DEFAULT };
  if (o && typeof o === 'object') {
    const v = o as Partial<BgPrefs>;
    if (v.mode === 'default' || v.mode === 'custom' || v.mode === 'none') out.mode = v.mode;
    if (typeof v.dim === 'number' && Number.isFinite(v.dim)) out.dim = Math.max(0, Math.min(0.9, v.dim));
    if (typeof v.custom === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(v.custom) && v.custom.length < 4_000_000) out.custom = v.custom;
  }
  if (out.mode === 'custom' && !out.custom) out.mode = 'default';
  return out;
}

function load(): BgPrefs {
  try { const raw = localStorage.getItem(KEY); if (raw) return cleanBg(JSON.parse(raw)); } catch { /* blocked */ }
  return { ...BG_DEFAULT };
}

let prefs: BgPrefs = load();
let defaultUrl: string | null = null;      // the picture found in public/images, once looked for
let looked = false;
const listeners = new Set<() => void>();
let snap = { url: null as string | null, dim: prefs.dim, mode: prefs.mode, hasDefault: false, hasCustom: !!prefs.custom };

function recompute() {
  const url = prefs.mode === 'none' ? null : prefs.mode === 'custom' ? prefs.custom || defaultUrl : defaultUrl;
  snap = { url, dim: prefs.dim, mode: prefs.mode, hasDefault: !!defaultUrl, hasCustom: !!prefs.custom };
  listeners.forEach((f) => f());
}

export function setBackground(patch: Partial<BgPrefs>): boolean {
  prefs = cleanBg({ ...prefs, ...patch });
  let ok = true;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { ok = false; /* too big or blocked: it works until you reload */ }
  recompute();
  return ok;
}

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 1);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Looks in public/images for the default picture (once). A missing file is an error, so a host that answers every address with the home page is not fooled. */
export async function findDefaultBackground(): Promise<string | null> {
  if (looked) return defaultUrl;
  looked = true;
  for (const f of DEFAULT_BG_FILES) {
    if (await probe(f)) { defaultUrl = f; break; }
  }
  recompute();
  return defaultUrl;
}

/** Makes a picked file small enough to keep (at most 1600 px wide, as a JPEG) and returns it as a data URL. */
export function fileToBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('Pick an image file')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read that file'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened'));
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, 1));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

export const getBackground = () => snap;
export function subscribeBackground(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }
export function useBackground() { return useSyncExternalStore(subscribeBackground, getBackground, getBackground); }

/** CSS for a menu panel that sits on the background picture (or nothing, when there is none). The picture always fits the visible panel: it fills it edge to edge on a phone or a computer and stays put while the page scrolls. */
export function backgroundStyle(b: { url: string | null; dim: number }): { [k: string]: string } | undefined {
  if (!b.url) return undefined;
  return { backgroundImage: `linear-gradient(rgba(10,14,20,${b.dim}), rgba(10,14,20,${b.dim})), url("${b.url}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'scroll' } // (cover = fills the screen, phone or computer; 'scroll' = sized to the visible panel, not to the whole scrolling page, so it no longer zooms in on long pages);
}
