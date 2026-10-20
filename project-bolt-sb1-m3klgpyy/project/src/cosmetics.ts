// Skins and capes sold in the Cosmetics shop. Pure data (no three.js), shared by the
// engine (which draws them) and the shop (which sells them).

export type SkinDetail = 'none' | 'ninja' | 'knight' | 'astronaut' | 'robot' | 'lava' | 'frost' | 'golden' | 'explorer';
export type SkinDef = {
  name: string; price: number; detail: SkinDetail;
  skin: string; skinS: string[];   // face/hands
  shirt: string; shirtS: string[];
  pants: string; pantsS: string[];
  hair: string; eyes: string;
};
export type CapePattern = 'solid' | 'stripe' | 'checker' | 'flame' | 'stars' | 'logo';
export type CapeDef = { name: string; price: number; base: string; accent: string; pattern: CapePattern };

export const SKINS: Record<string, SkinDef> = {
  classic: { name: 'Classic', price: 0, detail: 'none', skin: '#a8734f', skinS: ['#9b6845', '#b47e58'], shirt: '#3a7bd5', shirtS: ['#2c5fa8'], pants: '#3b3f8f', pantsS: ['#31357a'], hair: '#3b2213', eyes: '#3b4a9c' },
  explorer: { name: 'Explorer', price: 150, detail: 'explorer', skin: '#e0b48c', skinS: ['#d4a57c', '#ebc29c'], shirt: '#7a8a3a', shirtS: ['#687830', '#8a9a48'], pants: '#8a6a44', pantsS: ['#765a38'], hair: '#c8862a', eyes: '#3f7a3a' },
  ninja: { name: 'Ninja', price: 300, detail: 'ninja', skin: '#1c1c22', skinS: ['#15151a', '#24242c'], shirt: '#1c1c22', shirtS: ['#15151a', '#24242c'], pants: '#1c1c22', pantsS: ['#15151a'], hair: '#1c1c22', eyes: '#ffffff' },
  knight: { name: 'Knight', price: 400, detail: 'knight', skin: '#b8bec6', skinS: ['#a4aab2', '#ccd2da'], shirt: '#b8bec6', shirtS: ['#a4aab2', '#ccd2da'], pants: '#8a9098', pantsS: ['#787e86'], hair: '#b8bec6', eyes: '#1a1a1a' },
  astronaut: { name: 'Astronaut', price: 500, detail: 'astronaut', skin: '#eef0f2', skinS: ['#dfe2e6', '#f8f9fa'], shirt: '#eef0f2', shirtS: ['#dfe2e6'], pants: '#e2e5e9', pantsS: ['#d2d6db'], hair: '#eef0f2', eyes: '#2a6ad8' },
  robot: { name: 'Robot', price: 600, detail: 'robot', skin: '#7c8a96', skinS: ['#6c7a86', '#8c9aa6'], shirt: '#5c6a76', shirtS: ['#4c5a66', '#6c7a86'], pants: '#4c5a66', pantsS: ['#3c4a56'], hair: '#7c8a96', eyes: '#4af0ff' },
  lava: { name: 'Lava Walker', price: 800, detail: 'lava', skin: '#3a1a12', skinS: ['#2a120c', '#4a2218'], shirt: '#3a1a12', shirtS: ['#2a120c'], pants: '#2a120c', pantsS: ['#1e0c08'], hair: '#ff6a1a', eyes: '#ffd23a' },
  frost: { name: 'Frost', price: 800, detail: 'frost', skin: '#bfe6f5', skinS: ['#acdaee', '#d2f0fa'], shirt: '#5aa8e0', shirtS: ['#4a96cc', '#7ac0f0'], pants: '#3a78b8', pantsS: ['#2e68a4'], hair: '#f4fbff', eyes: '#1a4a9a' },
  golden: { name: 'Golden Legend', price: 1500, detail: 'golden', skin: '#f2c230', skinS: ['#d9a820', '#ffe066'], shirt: '#f2c230', shirtS: ['#d9a820', '#ffe066'], pants: '#d9a820', pantsS: ['#c09018'], hair: '#ffe066', eyes: '#7a3a00' },
};

export const CAPES: Record<string, CapeDef> = {
  none: { name: 'No cape', price: 0, base: '#000000', accent: '#000000', pattern: 'solid' },
  crimson: { name: 'Crimson', price: 200, base: '#b0202a', accent: '#d8404a', pattern: 'solid' },
  ocean: { name: 'Ocean Stripe', price: 250, base: '#1a5aa8', accent: '#7ac8f0', pattern: 'stripe' },
  forest: { name: 'Forest Stripe', price: 250, base: '#2a6a2a', accent: '#8ad06a', pattern: 'stripe' },
  checker: { name: 'Checkerboard', price: 400, base: '#202020', accent: '#f0f0f0', pattern: 'checker' },
  flame: { name: 'Flame', price: 600, base: '#3a0a06', accent: '#ff7a1a', pattern: 'flame' },
  galaxy: { name: 'Galaxy', price: 900, base: '#1a0a3a', accent: '#c8a8ff', pattern: 'stars' },
  vibeblox: { name: 'VibeBlox', price: 1200, base: '#0d131b', accent: '#00e676', pattern: 'logo' },
};

/** The skin id of a Champion's own uploaded skin (its PNG travels in `custom`). */
export const CUSTOM_SKIN_ID = 'custom';
/** A custom skin is a small PNG kept as a data: URL (a re-encoded 64x64 skin is a few KB). */
export const MAX_CUSTOM_SKIN_CHARS = 12000;
export function isCustomSkinData(s: unknown): s is string {
  return typeof s === 'string' && s.length > 40 && s.length <= MAX_CUSTOM_SKIN_CHARS && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);
}

/** The cape id of a Champion's / [YOUTUBE]'s own uploaded cape (its PNG travels in `capeData`). */
export const CUSTOM_CAPE_ID = 'custom';
export type PlayerLook = { skin: string; cape: string; /** the PNG, when skin is 'custom' */ custom?: string; /** the PNG, when cape is 'custom' (a standard 64x32 cape picture) */ capeData?: string };
export const DEFAULT_LOOK: PlayerLook = { skin: 'classic', cape: 'none' };
/** Anything unknown (old saves, other players on newer versions) falls back to the default. */
export function cleanLook(l: Partial<PlayerLook> | null | undefined): PlayerLook {
  const customCape = l?.cape === CUSTOM_CAPE_ID && isCustomSkinData(l.capeData);
  const cape = customCape ? CUSTOM_CAPE_ID : l?.cape && l.cape !== CUSTOM_CAPE_ID && CAPES[l.cape] ? l.cape : 'none';
  const extra = customCape ? { capeData: l!.capeData as string } : {};
  if (l?.skin === CUSTOM_SKIN_ID && isCustomSkinData(l.custom)) return { skin: CUSTOM_SKIN_ID, cape, custom: l.custom, ...extra };
  return { skin: l?.skin && SKINS[l.skin] ? l.skin : 'classic', cape, ...extra };
}
