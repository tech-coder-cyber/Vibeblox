// Video settings that go beyond the graphics tier: clouds, stars, fast render, frame cap, bobbing and dynamic FOV.
export type CloudMode = 'fancy' | 'fast' | 'none';
export type VideoPrefs = {
  clouds: CloudMode;
  /** How far above the top of the world the clouds float (blocks). */
  cloudHeight: number;
  stars: boolean;
  /** Draws less: lower resolution, no shadows, no waving leaves, no post effects. */
  fastRender: boolean;
  /** 0 = no limit. */
  maxFps: number;
  viewBobbing: boolean;
  /** Your view widens a little while you sprint. */
  dynamicFov: boolean;
  /** Distance fog. Off shows far chunks sharply (underwater and lava still tint the view). */
  fog: boolean;
};

export const DEFAULT_VIDEO: VideoPrefs = { clouds: 'fancy', cloudHeight: 14, stars: true, fastRender: false, maxFps: 0, viewBobbing: true, dynamicFov: true, fog: true };
export const CLOUD_HEIGHT_RANGE = { min: 0, max: 120 };
export const FPS_RANGE = { min: 10, max: 360 };
const KEY = 'vb-video';

/** Clean up anything (saved settings, a script, a typo) into valid settings. */
export function cleanVideo(raw: unknown): VideoPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const clouds: CloudMode = r.clouds === 'fast' || r.clouds === 'none' || r.clouds === 'fancy' ? r.clouds : DEFAULT_VIDEO.clouds;
  const h = Number(r.cloudHeight);
  const cloudHeight = Number.isFinite(h) ? Math.max(CLOUD_HEIGHT_RANGE.min, Math.min(CLOUD_HEIGHT_RANGE.max, Math.round(h))) : DEFAULT_VIDEO.cloudHeight;
  const f = Number(r.maxFps);
  const maxFps = Number.isFinite(f) && f >= FPS_RANGE.min ? Math.min(FPS_RANGE.max, Math.round(f)) : 0;
  return { clouds, cloudHeight, stars: bool(r.stars, true), fastRender: bool(r.fastRender, false), maxFps, viewBobbing: bool(r.viewBobbing, true), dynamicFov: bool(r.dynamicFov, true), fog: bool(r.fog, true) };
}

export function loadVideo(): VideoPrefs {
  try { return cleanVideo(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return { ...DEFAULT_VIDEO }; }
}
export function saveVideo(p: VideoPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

// A tiny shared store, so the settings screen and the running game see the same values without passing props around.
let current: VideoPrefs = loadVideo();
const listeners = new Set<() => void>();
export const getVideo = () => current;
export function updateVideo(patch: Partial<VideoPrefs>) {
  current = cleanVideo({ ...current, ...patch });
  saveVideo(current);
  listeners.forEach((f) => f());
}
export function subscribeVideo(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
