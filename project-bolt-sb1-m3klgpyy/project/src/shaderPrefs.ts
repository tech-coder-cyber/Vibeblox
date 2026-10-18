// Settings > Shaders: lighting, shadows and atmosphere, plus shader packs you can insert.
// Until you change something here, every effect follows your graphics quality (Low .. Max). Once you change one,
// your choices win on every graphics level; "Reset to default" goes back to following the graphics quality.
// Effects like bloom, god rays and eye adaptation run in the shader pipeline Max uses; turning one on starts it on
// other graphics levels too.

export type LightingMode = 'fast' | 'fancy' | 'realistic';
export type Level = 'off' | 'low' | 'high';
export type ShadowMode = 'none' | 'low' | 'medium' | 'high' | 'ultra';
/** A shader pack's colour grade (applied at the very end of the shader pipeline). 1 = unchanged. */
export type Grade = { saturation: number; contrast: number; brightness: number; warmth: number; vignette: number };
export type ShaderPrefs = {
  /** false: everything follows the graphics quality (the settings below are only shown) */
  custom: boolean;
  lighting: LightingMode;
  /** a torch, lantern, glowstone or lava bucket in your hand lights up what's around you */
  dynamicLighting: boolean;
  /** soft light bouncing off nearby blocks (ambient occlusion plus a coloured fill) */
  globalIllumination: Level;
  volumetricFog: boolean;
  godRays: Level;
  /** 0..100 (%) */
  bloom: number;
  /** 0..100 (%): your eyes get used to dark caves and bright skies */
  eyeAdaptation: number;
  motionBlur: boolean;
  waterShaders: boolean;
  shadows: ShadowMode;
  grassWave: boolean;
  /** The shader pack in use (null: none). Its grade (and optional GLSL) is applied on top. */
  pack: ShaderPack | null;
};
/**
 * A shader pack (a .vbshader file, or pasted text): JSON with a name, any of the settings above, an optional colour
 * grade, and optionally a GLSL function `vec3 customGrade(vec3 c, vec2 uv, float t)` that runs on every pixel last.
 */
export type ShaderPack = { name: string; settings?: Partial<Omit<ShaderPrefs, 'custom' | 'pack'>>; grade?: Partial<Grade>; glsl?: string };

export const DEFAULT_SHADERS: ShaderPrefs = {
  // The plain, fast look (what Medium graphics draws): no bloom, god rays, fog, shadows or waving grass. Turn on what you like.
  custom: false, lighting: 'fast', dynamicLighting: false, globalIllumination: 'off', volumetricFog: false, godRays: 'off',
  bloom: 0, eyeAdaptation: 0, motionBlur: false, waterShaders: false, shadows: 'none', grassWave: false, pack: null,
};
export const NEUTRAL_GRADE: Grade = { saturation: 1, contrast: 1, brightness: 1, warmth: 0, vignette: 0 };

/** Packs that come with the game. */
export const BUILTIN_PACKS: ShaderPack[] = [
  { name: 'Vibrant', settings: { lighting: 'fancy', bloom: 60, godRays: 'high', grassWave: true }, grade: { saturation: 1.3, contrast: 1.08, warmth: 0.05 } },
  { name: 'Cinematic', settings: { lighting: 'realistic', bloom: 70, godRays: 'high', volumetricFog: true, eyeAdaptation: 60, globalIllumination: 'high' }, grade: { saturation: 0.92, contrast: 1.15, warmth: 0.12, vignette: 0.6 } },
  { name: 'Cozy Autumn', settings: { lighting: 'fancy', bloom: 45, volumetricFog: true }, grade: { saturation: 1.05, warmth: 0.3, brightness: 1.04, vignette: 0.3 } },
  { name: 'Noir', settings: { lighting: 'realistic', bloom: 25, godRays: 'low' }, grade: { saturation: 0, contrast: 1.3, vignette: 0.9 } },
];

const LIGHTING: LightingMode[] = ['fast', 'fancy', 'realistic'];
const LEVELS: Level[] = ['off', 'low', 'high'];
const SHADOWS: ShadowMode[] = ['none', 'low', 'medium', 'high', 'ultra'];
const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);
const pct = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : d; };
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

export function cleanGrade(raw: unknown): Grade {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    saturation: num(r.saturation, 0, 2, 1), contrast: num(r.contrast, 0.5, 1.6, 1), brightness: num(r.brightness, 0.5, 1.6, 1),
    warmth: num(r.warmth, -1, 1, 0), vignette: num(r.vignette, 0, 1.5, 0),
  };
}
/** Only the shape of a GLSL function is accepted (no #extension, no uniforms of its own), and it must be short. */
export function cleanGlsl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const g = v.trim();
  if (!g || g.length > 4000 || /#\s*(extension|version|include)|uniform\s|gl_Frag|discard/.test(g)) return undefined;
  if (!/vec3\s+customGrade\s*\(\s*vec3\s+\w+\s*,\s*vec2\s+\w+\s*,\s*float\s+\w+\s*\)/.test(g)) return undefined;
  return g;
}
export function cleanPack(raw: unknown): ShaderPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : null;
  if (!name) return null;
  const settings = r.settings && typeof r.settings === 'object' ? cleanSettings(r.settings, false) : undefined;
  const out: ShaderPack = { name };
  if (settings) { const { custom: _c, pack: _p, ...rest } = settings; void _c; void _p; out.settings = rest; }
  if (r.grade) out.grade = cleanGrade(r.grade);
  const glsl = cleanGlsl(r.glsl);
  if (glsl) out.glsl = glsl;
  return out;
}
function cleanSettings(raw: unknown, withPack = true): ShaderPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SHADERS;
  return {
    custom: bool(r.custom, d.custom),
    lighting: pick(LIGHTING, r.lighting, d.lighting),
    dynamicLighting: bool(r.dynamicLighting, d.dynamicLighting),
    globalIllumination: pick(LEVELS, r.globalIllumination, d.globalIllumination),
    volumetricFog: bool(r.volumetricFog, d.volumetricFog),
    godRays: pick(LEVELS, r.godRays, d.godRays),
    bloom: pct(r.bloom, d.bloom),
    eyeAdaptation: pct(r.eyeAdaptation, d.eyeAdaptation),
    motionBlur: bool(r.motionBlur, d.motionBlur),
    waterShaders: bool(r.waterShaders, d.waterShaders),
    shadows: pick(SHADOWS, r.shadows, d.shadows),
    grassWave: bool(r.grassWave, d.grassWave),
    pack: withPack ? cleanPack(r.pack) : null,
  };
}
export const cleanShaders = (raw: unknown) => cleanSettings(raw, true);

/** Reads a pack someone shared (JSON text). Returns the pack, or why it can't be used. */
export function parsePack(text: string): { pack: ShaderPack } | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: "That isn't a shader pack (it should be JSON, like an exported .vbshader file)." }; }
  const pack = cleanPack(raw);
  if (!pack) return { error: 'A shader pack needs at least a "name".' };
  const g = (raw as { glsl?: unknown }).glsl;
  if (typeof g === 'string' && g.trim() && !pack.glsl) return { error: 'The GLSL part must be one function: vec3 customGrade(vec3 c, vec2 uv, float t) { ... } (no uniforms, #extension or discard).' };
  return { pack };
}
export function exportPack(p: ShaderPrefs, name = 'My shaders'): string {
  const { custom: _c, pack, ...settings } = p; void _c;
  return JSON.stringify({ name, settings, ...(pack?.grade ? { grade: pack.grade } : {}), ...(pack?.glsl ? { glsl: pack.glsl } : {}) }, null, 2);
}

const KEY = 'vb-shaders';
function load(): ShaderPrefs { try { return cleanShaders(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return { ...DEFAULT_SHADERS }; } }
let current: ShaderPrefs = load();
const listeners = new Set<() => void>();
export const getShaders = () => current;
/** Change some settings (this makes them yours: they stop following the graphics quality). */
export function updateShaders(patch: Partial<ShaderPrefs>) {
  current = cleanShaders({ ...current, ...patch, custom: patch.custom ?? true });
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage blocked */ }
  listeners.forEach((f) => f());
}
export function resetShaders() {
  current = { ...DEFAULT_SHADERS };
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  listeners.forEach((f) => f());
}
/** Use a pack: its settings replace yours, its grade and GLSL go on top. */
export function applyPack(pack: ShaderPack) {
  updateShaders({ ...(pack.settings ?? {}), pack });
}
export function subscribeShaders(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }

// ---------------- Settings > Crosshair ----------------
export type CrosshairStyle = 'cross' | 'dot' | 'circle' | 'crossdot' | 'tshape' | 'none';
export type Crosshair = { style: CrosshairStyle; size: number; thickness: number; gap: number; color: string; opacity: number; outline: boolean };
export const DEFAULT_CROSSHAIR: Crosshair = { style: 'cross', size: 24, thickness: 2, gap: 0, color: '#ffffff', opacity: 80, outline: false };
const STYLES: CrosshairStyle[] = ['cross', 'dot', 'circle', 'crossdot', 'tshape', 'none'];
export function cleanCrosshair(raw: unknown): Crosshair {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_CROSSHAIR;
  return {
    style: pick(STYLES, r.style, d.style), size: Math.round(num(r.size, 8, 64, d.size)), thickness: Math.round(num(r.thickness, 1, 8, d.thickness)),
    gap: Math.round(num(r.gap, 0, 16, d.gap)), color: typeof r.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color.toLowerCase() : d.color,
    opacity: pct(r.opacity, d.opacity), outline: bool(r.outline, d.outline),
  };
}
const CKEY = 'vb-crosshair';
let cross: Crosshair = (() => { try { return cleanCrosshair(JSON.parse(localStorage.getItem(CKEY) ?? '{}')); } catch { return { ...DEFAULT_CROSSHAIR }; } })();
const cListeners = new Set<() => void>();
export const getCrosshair = () => cross;
export function updateCrosshair(patch: Partial<Crosshair>) {
  cross = cleanCrosshair({ ...cross, ...patch });
  try { localStorage.setItem(CKEY, JSON.stringify(cross)); } catch { /* storage blocked */ }
  cListeners.forEach((f) => f());
}
export function resetCrosshair() { updateCrosshair({ ...DEFAULT_CROSSHAIR }); }
export function subscribeCrosshair(f: () => void): () => void { cListeners.add(f); return () => { cListeners.delete(f); }; }
