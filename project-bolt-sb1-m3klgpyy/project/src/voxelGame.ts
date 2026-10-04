import { SKINS, CAPES, cleanLook, DEFAULT_LOOK, type PlayerLook } from './cosmetics';
import * as THREE from 'three';

// ===================================================================
//  Procedural textures (canvas-generated — no external assets)
// ===================================================================

function makeGrassTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a8c3a';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 64, y = Math.random() * 64, s = Math.random();
    ctx.fillStyle = s < 0.33 ? '#3d7530' : s < 0.66 ? '#5ba04a' : '#6bb858';
    ctx.fillRect(x, y, 2, 3);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = '#2d5a22';
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  return tex;
}

function makeDirtTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6b4f2e';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 64, y = Math.random() * 64, s = Math.random();
    ctx.fillStyle = s < 0.33 ? '#5a4126' : s < 0.66 ? '#7d5f3a' : '#8c6f45';
    ctx.fillRect(x, y, 2, 2);
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = '#4a3820';
    ctx.beginPath();
    ctx.arc(Math.random() * 64, Math.random() * 64, 1.5 + Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  return tex;
}

function makeWoodTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  // Base wood brown
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(0, 0, 64, 64);
  // Vertical grain stripes
  for (let i = 0; i < 12; i++) {
    const x = (i * 5) + Math.random() * 3;
    const shade = Math.random();
    ctx.fillStyle = shade < 0.5 ? '#5a3d22' : '#7d5a35';
    ctx.fillRect(x, 0, 2, 64);
  }
  // Bark texture noise
  for (let i = 0; i < 80; i++) {
    const s = Math.random();
    ctx.fillStyle = s < 0.33 ? '#4a2d15' : s < 0.66 ? '#7a5a3a' : '#8b6a45';
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  return tex;
}

function makeLeafTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  // Base dark green
  ctx.fillStyle = '#2d6a2d';
  ctx.fillRect(0, 0, 64, 64);
  // Leaf clusters
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 64, y = Math.random() * 64, s = Math.random();
    ctx.fillStyle = s < 0.25 ? '#1a4a1a' : s < 0.5 ? '#3a7a3a' : s < 0.75 ? '#4a8a4a' : '#5a9a5a';
    ctx.fillRect(x, y, 3, 3);
  }
  // Highlights
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = '#6abb6a';
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  return tex;
}

function makeStoneTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 200; i++) {
    const s = Math.random();
    ctx.fillStyle = s < 0.33 ? '#6a6a6a' : s < 0.66 ? '#888888' : '#9a9a9a';
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 3, 3);
  }
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = '#555555';
    ctx.beginPath();
    ctx.arc(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  return tex;
}

// ===================================================================
//  Item art, 3D inventory icons, and in-world item meshes
// ===================================================================

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ===================================================================
//  Texture resolution: 16x16 (classic) or 32x32 (detailed)
// ===================================================================
// Every built-in texture is drawn once at its classic 16x16 size. In 32x32
// mode each one is redrawn at double detail: edges are smoothed with the
// classic "EPX" pixel-art scaler (so diagonals stop looking jagged) and a
// fine grain is added on top (so flat areas stop looking blocky). Textures
// that mods bring along are the author's art and are never changed.
export type TextureRes = 16 | 32;
let textureRes: TextureRes = 16;
export function getTextureResolution(): TextureRes {
  return textureRes;
}

type TexCanvas = HTMLCanvasElement & { __base?: HTMLCanvasElement };

/** The size of one art "pixel" in a canvas: a 64px canvas drawn in 4px cells is really 16x16 art. */
function logicalCell(data: Uint8ClampedArray, w: number, h: number): number {
  if (w < 32 || h < 32) return 1; // small canvases (mob skins, tools, chests) are drawn one art pixel per canvas pixel
  for (const cell of [8, 4, 2]) {
    if (w % cell || h % cell) continue;
    let uniform = true;
    check: for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        const i0 = (cy * w + cx) * 4;
        for (let dy = 0; dy < cell; dy++) {
          for (let dx = 0; dx < cell; dx++) {
            const i = ((cy + dy) * w + cx + dx) * 4;
            if (data[i] !== data[i0] || data[i + 1] !== data[i0 + 1] || data[i + 2] !== data[i0 + 2] || data[i + 3] !== data[i0 + 3]) { uniform = false; break check; }
          }
        }
      }
    }
    if (uniform) return cell;
  }
  return 1;
}

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) + str.charCodeAt(i)) | 0;
  return h;
}

/**
 * Redraws a texture at double detail. `kind` sets how much grain is added:
 * blocks get the most (and wrap around at the edges so they still tile),
 * item art the least (so outlines stay clean).
 */
function enhanceTexture(src: HTMLCanvasElement, kind: 'block' | 'item' | 'mob', seed = 0): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const cell = logicalCell(data, w, h);
  const nx = w / cell, ny = h / cell;
  if (nx >= 32 || ny >= 32) return src; // already finely detailed
  const grid = new Uint32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = (y * cell * w + x * cell) * 4;
      grid[y * nx + x] = (((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0);
    }
  }
  const wrap = kind === 'block';
  const at = (x: number, y: number, fallback: number): number => {
    if (x < 0 || y < 0 || x >= nx || y >= ny) {
      if (!wrap) return fallback;
      return grid[((y + ny) % ny) * nx + ((x + nx) % nx)];
    }
    return grid[y * nx + x];
  };
  const outCell = cell >= 2 ? cell / 2 : 1;
  const ow = nx * 2 * outCell, oh = ny * 2 * outCell;
  const out = makeCanvas(ow, oh) as TexCanvas;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(ow, oh);
  const amount = kind === 'block' ? 0.07 : kind === 'mob' ? 0.055 : 0.025;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const P = grid[y * nx + x];
      const A = at(x, y - 1, P), B = at(x + 1, y, P), C = at(x - 1, y, P), D = at(x, y + 1, P);
      // EPX: a corner takes its neighbours' colour only where two of them agree
      const sub = [
        C === A && C !== D && A !== B ? A : P, // top-left
        A === B && A !== C && B !== D ? B : P, // top-right
        D === C && D !== B && C !== A ? C : P, // bottom-left
        B === D && B !== A && D !== C ? D : P, // bottom-right
      ];
      for (let q = 0; q < 4; q++) {
        const px = x * 2 + (q & 1), py = y * 2 + (q >> 1);
        const v = sub[q];
        const a = v & 255;
        const f = a > 0 ? 1 + (hash2(px, py, seed) - 0.5) * 2 * amount : 1;
        const r = Math.max(0, Math.min(255, Math.round(((v >>> 24) & 255) * f)));
        const g = Math.max(0, Math.min(255, Math.round(((v >>> 16) & 255) * f)));
        const b = Math.max(0, Math.min(255, Math.round(((v >>> 8) & 255) * f)));
        for (let dy = 0; dy < outCell; dy++) {
          for (let dx = 0; dx < outCell; dx++) {
            const o = ((py * outCell + dy) * ow + px * outCell + dx) * 4;
            img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a;
          }
        }
      }
    }
  }
  octx.putImageData(img, 0, 0);
  out.__base = (src as TexCanvas).__base ?? src;
  return out;
}

const enhancedItemCache = new Map<number, HTMLCanvasElement>();
let mobTexCounter = 0;

/** Switch between 16x16 and 32x32 textures. Clears every cached texture; the running game then calls reloadTextures(). */
export function setTextureResolution(res: TextureRes) {
  if (res === textureRes) return;
  textureRes = res;
  faceCanvasCache = null;
  enhancedItemCache.clear();
  for (const k of Object.keys(iconCache)) delete iconCache[Number(k)];
  for (const t of faceTexCache.values()) t.dispose();
  faceTexCache.clear();
}

/** Sample textures for the Settings page, drawn at either resolution no matter which one is active. */
export function getTexturePreviews(res: TextureRes): Array<{ name: string; canvas: HTMLCanvasElement }> {
  const f = faceCanvases();
  const baseOf = (c: HTMLCanvasElement) => (c as TexCanvas).__base ?? c;
  const at = (c: HTMLCanvasElement, kind: 'block' | 'item', seed: number) => (res === 32 ? enhanceTexture(c, kind, seed) : c);
  const list = [
    { name: 'Grass', canvas: at(baseOf(f.grass), 'block', 1) },
    { name: 'Stone', canvas: at(baseOf(f.stone), 'block', 2) },
    { name: 'Planks', canvas: at(baseOf(f.planks), 'block', 3) },
    { name: 'Diamond ore', canvas: at(baseOf(f.diamondOre), 'block', 4) },
    { name: 'Bedrock', canvas: res === 32 ? enhanceTexture(drawBedrockCanvas(4), 'block', 5) : drawBedrockCanvas(8) },
  ];
  const sword = itemCanvasBase(ITEM_DIAMOND_SWORD);
  if (sword) list.push({ name: 'Diamond sword', canvas: at(sword, 'item', 6) });
  return list;
}

/** The textures for a player skin (8x8 per face, like mob skins). */
function playerSkinCanvases(skinId: string) {
  const k = SKINS[skinId] ?? SKINS.classic;
  const d = k.detail;
  const face = mobTex(k.skin, k.skinS, 0.2, (ctx) => {
    if (d === 'ninja') { // mask with an eye slit
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 3, 8, 2);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1);
      ctx.fillStyle = '#b02020'; ctx.fillRect(0, 1, 8, 1);
      return;
    }
    if (d === 'knight') { // helmet visor
      ctx.fillStyle = '#5a6068'; ctx.fillRect(0, 3, 8, 2);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(1, 3, 6, 1);
      ctx.fillStyle = '#8a9098'; ctx.fillRect(3, 5, 2, 3);
      return;
    }
    if (d === 'astronaut') { // glass visor
      ctx.fillStyle = '#1a2a5a'; ctx.fillRect(1, 2, 6, 5);
      ctx.fillStyle = '#5a8ae0'; ctx.fillRect(2, 3, 2, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(2, 2, 1, 1);
      return;
    }
    if (d === 'robot') {
      ctx.fillStyle = '#2a3440'; ctx.fillRect(1, 2, 6, 3);
      ctx.fillStyle = k.eyes; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1);
      ctx.fillStyle = '#2a3440'; ctx.fillRect(2, 6, 4, 1);
      ctx.fillStyle = k.eyes; ctx.fillRect(3, 6, 1, 1);
      return;
    }
    ctx.fillStyle = k.hair; ctx.fillRect(0, 0, 8, 2);
    if (d === 'explorer') ctx.fillRect(0, 2, 1, 2), ctx.fillRect(7, 2, 1, 2);
    ctx.fillStyle = d === 'lava' ? '#ff9a2a' : '#ffffff'; ctx.fillRect(1, 4, 2, 1); ctx.fillRect(5, 4, 2, 1);
    ctx.fillStyle = k.eyes; ctx.fillRect(2, 4, 1, 1); ctx.fillRect(5, 4, 1, 1);
    ctx.fillStyle = d === 'golden' ? '#b07a10' : d === 'lava' ? '#ff6a1a' : '#7a4a33'; ctx.fillRect(3, 6, 2, 1);
    if (d === 'lava') { ctx.fillStyle = '#ff6a1a'; ctx.fillRect(0, 7, 1, 1); ctx.fillRect(6, 2, 1, 1); }
    if (d === 'frost') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 2, 1, 1); ctx.fillRect(7, 6, 1, 1); }
  });
  const side = mobTex(k.skin, k.skinS, 0.3, (ctx) => {
    if (d === 'ninja' || d === 'knight' || d === 'astronaut' || d === 'robot') return;
    ctx.fillStyle = k.hair; ctx.fillRect(0, 0, 8, 3);
    if (d === 'explorer') ctx.fillRect(4, 3, 4, 2);
  });
  const top = mobTex(k.hair, [k.hair], 0.1, d === 'ninja' ? (ctx) => { ctx.fillStyle = '#b02020'; ctx.fillRect(0, 6, 8, 1); } : undefined);
  const body = mobTex(k.shirt, k.shirtS, 0.25, (ctx) => {
    if (d === 'explorer') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(0, 6, 8, 1); ctx.fillRect(2, 0, 1, 6); }
    if (d === 'ninja') { ctx.fillStyle = '#b02020'; ctx.fillRect(0, 5, 8, 1); }
    if (d === 'knight') { ctx.fillStyle = '#c03030'; ctx.fillRect(3, 1, 2, 5); ctx.fillRect(1, 2, 6, 2); }
    if (d === 'astronaut') { ctx.fillStyle = '#d04a2a'; ctx.fillRect(1, 1, 2, 2); ctx.fillStyle = '#2a6ad8'; ctx.fillRect(5, 1, 2, 2); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(2, 4, 4, 2); }
    if (d === 'robot') { ctx.fillStyle = '#2a3440'; ctx.fillRect(2, 2, 4, 3); ctx.fillStyle = k.eyes; ctx.fillRect(3, 3, 2, 1); }
    if (d === 'lava') { ctx.fillStyle = '#ff6a1a'; ctx.fillRect(1, 1, 1, 3); ctx.fillRect(5, 3, 2, 1); ctx.fillRect(3, 6, 1, 2); ctx.fillStyle = '#ffd23a'; ctx.fillRect(5, 2, 1, 1); }
    if (d === 'frost') { ctx.fillStyle = '#f4fbff'; ctx.fillRect(0, 0, 8, 1); ctx.fillRect(3, 2, 2, 2); }
    if (d === 'golden') { ctx.fillStyle = '#fff2a0'; ctx.fillRect(3, 1, 2, 2); ctx.fillStyle = '#c09018'; ctx.fillRect(0, 6, 8, 1); }
  });
  const arms = mobTex(k.shirt, k.shirtS, 0.25, (ctx) => {
    ctx.fillStyle = k.skin; if (d === 'none' || d === 'explorer' || d === 'frost') ctx.fillRect(0, 6, 8, 2); // bare hands
    if (d === 'lava') { ctx.fillStyle = '#ff6a1a'; ctx.fillRect(2, 2, 1, 2); }
  });
  const legs = mobTex(k.pants, k.pantsS, 0.25, (ctx) => {
    ctx.fillStyle = d === 'golden' ? '#a07810' : d === 'astronaut' ? '#9aa0a8' : '#3a2a1e'; ctx.fillRect(0, 6, 8, 2); // boots
  });
  return { face, side, top, body, arms, legs };
}

/** A cape texture (8x8, drawn on the back of a 10x16 strip). */
function capeCanvas(capeId: string): HTMLCanvasElement {
  const c = CAPES[capeId] ?? CAPES.crimson;
  return mobTex(c.base, [c.base], 0.15, (ctx) => {
    ctx.fillStyle = c.accent;
    if (c.pattern === 'stripe') { ctx.fillRect(3, 0, 2, 8); }
    else if (c.pattern === 'checker') { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x >> 1) % 2 === (y >> 1) % 2) ctx.fillRect(x, y, 1, 1); }
    else if (c.pattern === 'flame') { ctx.fillRect(0, 5, 8, 3); ctx.fillRect(1, 3, 2, 2); ctx.fillRect(5, 2, 2, 3); ctx.fillStyle = '#ffd23a'; ctx.fillRect(1, 6, 2, 2); ctx.fillRect(5, 5, 2, 3); }
    else if (c.pattern === 'stars') { for (const [x, y] of [[1, 1], [5, 2], [3, 4], [6, 6], [1, 6], [4, 0]]) ctx.fillRect(x, y, 1, 1); ctx.fillStyle = '#6a3ac8'; ctx.fillRect(2, 2, 2, 1); }
    else if (c.pattern === 'logo') { ctx.fillRect(1, 1, 6, 1); ctx.fillRect(1, 6, 6, 1); ctx.fillRect(2, 2, 1, 2); ctx.fillRect(5, 2, 1, 2); ctx.fillRect(3, 4, 2, 2); }
    else { ctx.fillRect(0, 7, 8, 1); }
  });
}

/** Point a model material at a new base texture (respecting the 16/32 setting). */
function setModelTexture(model: MobModel, m: THREE.Material | undefined, base: HTMLCanvasElement) {
  const i = model.materials.indexOf(m as THREE.MeshLambertMaterial);
  if (i < 0) return;
  const next = textureRes === 32 ? enhanceTexture(base as TexCanvas, 'mob', i + 1) : base;
  const t = new THREE.CanvasTexture(next);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  model.textures[i]?.dispose();
  model.textures[i] = t;
  model.materials[i].map = t;
  model.materials[i].needsUpdate = true;
}

/** Change a player model's skin and cape in place (armor and held items stay attached). */
export function applyPlayerLook(model: MobModel, look: Partial<PlayerLook>) {
  const L = cleanLook(look);
  const parts = model.root.userData.skinParts as { legs: THREE.Material; body: THREE.Material; arms: THREE.Material; head: THREE.Material[]; cape: THREE.Material; capePivot: THREE.Object3D } | undefined;
  if (!parts) return;
  const prev = model.root.userData.look as PlayerLook | undefined;
  if (!prev || prev.skin !== L.skin) {
    const c = playerSkinCanvases(L.skin);
    setModelTexture(model, parts.legs, c.legs);
    setModelTexture(model, parts.body, c.body);
    setModelTexture(model, parts.arms, c.arms);
    // head: +x, -x, top, bottom, back, front
    [c.side, c.side, c.top, c.side, c.side, c.face].forEach((cv, i) => setModelTexture(model, parts.head[i], cv));
  }
  if (L.cape !== 'none' && (!prev || prev.cape !== L.cape)) setModelTexture(model, parts.cape, capeCanvas(L.cape));
  parts.capePivot.visible = L.cape !== 'none';
  model.root.userData.look = L;
}

/** Capes swing back further the faster you move, with a little flutter. */
function swayCape(model: MobModel, speed: number, t: number) {
  const pv = (model.root.userData.skinParts as { capePivot?: THREE.Object3D } | undefined)?.capePivot;
  if (!pv || !pv.visible) return;
  const target = 0.08 + Math.min(speed, 7) * 0.09 + Math.sin(t * 3.1) * 0.035 * (0.4 + Math.min(speed, 7) / 7);
  pv.rotation.x += (-target - pv.rotation.x) * 0.2; // negative = away from the back
}

/** A flat front/back picture of a skin + cape for shop cards (no WebGL needed). */
export function drawLookPreview(canvas: HTMLCanvasElement, look: Partial<PlayerLook>, view: 'front' | 'back' = 'front') {
  const L = cleanLook(look);
  const c = playerSkinCanvases(L.skin);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const u = Math.floor(Math.min(canvas.width / 16, canvas.height / 34)); // one model unit
  const ox = Math.floor(canvas.width / 2), oy = Math.floor((canvas.height - 32 * u) / 2);
  const put = (img: HTMLCanvasElement, x: number, y: number, w: number, h: number) => ctx.drawImage(img, ox + x * u, oy + y * u, w * u, h * u);
  put(c.legs, -4, 20, 4, 12); put(c.legs, 0, 20, 4, 12);
  put(c.body, -4, 8, 8, 12);
  put(c.arms, -8, 8, 4, 12); put(c.arms, 4, 8, 4, 12);
  put(view === 'front' ? c.face : c.side, -4, 0, 8, 8);
  if (view === 'back' && L.cape !== 'none') put(capeCanvas(L.cape), -5, 8, 10, 16);
}

/** Re-skin a mob/player model with the current texture resolution (used when you switch mid-game). */
function retextureModel(model: MobModel) {
  model.materials.forEach((m, i) => {
    const old = model.textures[i] as THREE.CanvasTexture | undefined;
    if (!old) return;
    const cur = old.image as TexCanvas;
    const base = cur.__base ?? cur;
    const next = textureRes === 32 ? enhanceTexture(base, 'mob', i + 1) : base;
    if (next === cur) return;
    const t = new THREE.CanvasTexture(next);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    m.map = t;
    m.needsUpdate = true;
    model.textures[i] = t;
    old.dispose();
  });
}

const STICK_LIGHT = '#a07a45';
const STICK_DARK = '#5e4224';

// 16x16 pixel maps. '.' = transparent. h/H = tool head light/dark,
// s/S = handle light/dark, g = sword guard.
const PICKAXE_MAP = [
  '................',
  '....hhhhhhh.....',
  '..hhHHHHHHHhh...',
  '.hH.......SsHh..',
  '.h.......Ss..Hh.',
  '........Ss....h.',
  '.......Ss.......',
  '......Ss........',
  '.....Ss.........',
  '....Ss..........',
  '...Ss...........',
  '..Ss............',
  '.Ss.............',
  'Ss..............',
  '................',
  '................',
];
const SWORD_MAP = [
  '................',
  '.............hH.',
  '............hHH.',
  '...........hHh..',
  '..........hHh...',
  '.........hHh....',
  '........hHh.....',
  '.......hHh......',
  '......hHh.......',
  '..g..hHh........',
  '...ghHh.........',
  '....gh..........',
  '...Ssg..........',
  '..Ss..g.........',
  '.Ss.............',
  'S...............',
];
const HOE_MAP = [
  '................',
  '......hhhhh.....',
  '.....hHHHHHs....',
  '.....HH...Ss....',
  '.........Ss.....',
  '........Ss......',
  '.......Ss.......',
  '......Ss........',
  '.....Ss.........',
  '....Ss..........',
  '...Ss...........',
  '..Ss............',
  '.Ss.............',
  'Ss..............',
  '................',
  '................',
];
const AXE_MAP = [
  '................',
  '........hhh.....',
  '.......hHHHh....',
  '......hHHHHH....',
  '......hHHHSs....',
  '.......hHSs.....',
  '........Ss......',
  '.......Ss.......',
  '......Ss........',
  '.....Ss.........',
  '....Ss..........',
  '...Ss...........',
  '..Ss............',
  '.Ss.............',
  'Ss..............',
  '................',
];

function drawPixelMap(map: string[], palette: Record<string, string>): HTMLCanvasElement {
  // 16x16 like Minecraft, up to 64x64 for detailed art (guns, uploaded pictures); the 3D model stays the same size
  const size = Math.max(16, Math.min(64, map.length), ...map.map((r) => Math.min(r.length, 64)));
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}

function drawStickCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  // A 2px-wide pixel staircase from bottom-left to top-right, like Minecraft's stick
  for (let i = 0; i < 11; i++) {
    ctx.fillStyle = STICK_LIGHT; ctx.fillRect(2 + i, 13 - i, 1, 1);
    ctx.fillStyle = STICK_DARK; ctx.fillRect(3 + i, 13 - i, 1, 1);
  }
  return c;
}

function drawPlanksCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b5884f';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#8f6a3a';
  for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  ctx.fillRect(5, 0, 1, 3); ctx.fillRect(11, 4, 1, 3); ctx.fillRect(3, 8, 1, 3); ctx.fillRect(9, 12, 1, 3);
  ctx.fillStyle = '#c79a5e';
  ctx.fillRect(1, 1, 2, 1); ctx.fillRect(8, 5, 3, 1); ctx.fillRect(12, 9, 2, 1); ctx.fillRect(4, 13, 3, 1);
  return c;
}

function drawSandCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#dbcf9a';
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#cfc08a' : '#e6dcae';
    ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
  }
  return c;
}

function drawCraftingTableCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9c6f3f';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#7d5730';
  ctx.fillRect(0, 0, 16, 3);
  ctx.fillRect(0, 7, 16, 1);
  ctx.fillRect(7, 8, 1, 8);
  ctx.fillStyle = '#5d4023';
  ctx.fillRect(2, 10, 3, 3);
  ctx.fillRect(10, 10, 3, 3);
  ctx.fillStyle = '#b8874f';
  ctx.fillRect(1, 4, 5, 2);
  ctx.fillRect(9, 4, 5, 2);
  return c;
}

function oreCanvas(stone: HTMLCanvasElement, light: string, dark: string): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(stone, 0, 0);
  const spots = [[8, 6], [38, 4], [22, 24], [48, 28], [6, 42], [32, 46], [52, 52]];
  for (const [x, y] of spots) {
    ctx.fillStyle = dark;
    ctx.fillRect(x + 2, y + 2, 8, 4);
    ctx.fillRect(x + 2, y + 6, 4, 4);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, 8, 4);
    ctx.fillRect(x, y + 4, 4, 4);
  }
  return c;
}

// Bedrock: the original look: charcoal blocks scattered on grey. The cells
// are 8px in 16x16 mode and 4px in 32x32 mode (which then gets the detail pass).
function drawBedrockCanvas(cellSize?: number): HTMLCanvasElement {
  const cell = cellSize ?? (textureRes === 32 ? 4 : 8);
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, 64, 64);
  const tones = ['#2e2e2e', '#6e6e6e', '#1c1c1c', '#454545'];
  for (let y = 0; y < 64; y += cell) {
    for (let x = 0; x < 64; x += cell) {
      if (Math.random() < 0.55) {
        ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
  return c;
}

function drawSnowCanvas(): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2f6fa';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = Math.random() < 0.6 ? '#dfe8f0' : '#ffffff';
    ctx.fillRect(Math.floor(Math.random() * 16) * 4, Math.floor(Math.random() * 16) * 4, 4, 4);
  }
  return c;
}

function drawLogTopCanvas(): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5a3d22';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#b08a55';
  ctx.fillRect(6, 6, 52, 52);
  ctx.strokeStyle = '#8a6a3c';
  ctx.lineWidth = 4;
  for (const r of [10, 18, 26]) ctx.strokeRect(32 - r, 32 - r, r * 2, r * 2);
  return c;
}

// Fancy leaves: punch see-through holes like Minecraft's fancy graphics
function withLeafHoles(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  for (let i = 0; i < 28; i++) {
    ctx.clearRect(Math.floor(Math.random() * 16) * 4, Math.floor(Math.random() * 16) * 4, 4, 4);
  }
  return c;
}

function drawGemCanvas(light: string, mid: string, dark: string): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5) * 1.15;
      if (d > 6.6) continue;
      ctx.fillStyle = d > 5.5 ? dark : (x < 8 && y < 8 && d < 4.2) ? light : mid;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function drawLumpCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const jitter = ((x * 7 + y * 13) % 5) * 0.05;
      const d = ((x - 7.5) ** 2) / 34 + ((y - 8) ** 2) / 24 + jitter;
      if (d > 1) continue;
      ctx.fillStyle = d > 0.78 ? '#141414' : ((x * 3 + y * 5) % 7 === 0) ? '#5c5c5c' : '#2f2f2f';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function setPx(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
}

function linePx(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    setPx(ctx, x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function blobPx(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, base: string, dark: string, light: string) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1) continue;
      setPx(ctx, x, y, d > 0.7 ? dark : x < cx && y < cy && d < 0.35 ? light : base);
    }
  }
}

function drawFoodCanvas(id: number): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  const bone = (len: number) => {
    linePx(ctx, 2, 13, 2 + len, 13 - len, '#f2efe6');
    setPx(ctx, 1, 13, '#f2efe6'); setPx(ctx, 2, 14, '#f2efe6'); setPx(ctx, 1, 14, '#d6d0c0');
  };
  switch (id) {
    case ITEM_PORKCHOP:
      blobPx(ctx, 9.5, 7, 5.5, 4.5, '#f19a9a', '#c96b6b', '#ffc4c4'); bone(3); break;
    case ITEM_BEEF:
      blobPx(ctx, 9.5, 7, 5.5, 4.5, '#c0392b', '#7d1f17', '#e8705f');
      linePx(ctx, 6, 9, 12, 5, '#f4e4d4'); break;
    case ITEM_CHICKEN:
      blobPx(ctx, 10, 6.5, 4.5, 4.5, '#f3d1b5', '#c9a07e', '#fff0e0'); bone(4); break;
    default: // rotten flesh
      blobPx(ctx, 8, 8, 6, 5, '#6f7d3a', '#46511f', '#94a35a');
      setPx(ctx, 6, 7, '#46511f'); setPx(ctx, 10, 9, '#46511f'); setPx(ctx, 8, 5, '#a8b86a');
  }
  return c;
}

function drawMiscItemCanvas(id: number): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  switch (id) {
    case ITEM_BONE:
      linePx(ctx, 3, 12, 12, 3, '#f2efe6'); linePx(ctx, 4, 12, 12, 4, '#c9c4b5');
      for (const [x, y] of [[2, 12], [2, 13], [3, 13], [12, 2], [13, 2], [13, 3]]) setPx(ctx, x, y, '#f2efe6');
      break;
    case ITEM_ARROW:
      linePx(ctx, 3, 12, 11, 4, '#8a6a3c');
      for (const [x, y] of [[12, 3], [12, 2], [13, 3], [11, 3], [13, 2]]) setPx(ctx, x, y, '#bdbdbd');
      setPx(ctx, 13, 1, '#7a7a7a'); setPx(ctx, 14, 2, '#7a7a7a');
      for (const [x, y] of [[2, 12], [2, 13], [3, 13], [1, 13], [2, 14], [1, 12], [3, 14]]) setPx(ctx, x, y, '#e8e8e8');
      break;
    case ITEM_FEATHER:
      linePx(ctx, 3, 13, 12, 4, '#bdbdbd'); linePx(ctx, 4, 11, 11, 4, '#ffffff');
      linePx(ctx, 5, 12, 12, 5, '#eeeeee'); linePx(ctx, 4, 10, 10, 4, '#f7f7f7');
      break;
    case ITEM_GUNPOWDER:
      blobPx(ctx, 8, 10.5, 6.5, 4, '#6b6b6b', '#3d3d3d', '#9a9a9a');
      for (const [x, y] of [[5, 9], [9, 11], [11, 9], [7, 12], [4, 11], [10, 13]]) setPx(ctx, x, y, (x + y) % 2 ? '#3d3d3d' : '#b0b0b0');
      break;
    case ITEM_LEATHER:
      blobPx(ctx, 8, 8, 6.5, 6, '#8b5a2b', '#5e3a17', '#b07a45');
      break;
    default: { // bow
      for (let t = 0; t <= 1.0001; t += 0.04) {
        const bulge = Math.sin(Math.PI * t) * 3.5;
        const x = Math.round(3 + 10 * t - bulge), y = Math.round(13 - 10 * t - bulge);
        setPx(ctx, x, y, '#8a5a2b');
        setPx(ctx, Math.min(15, x + 1), y, '#b07a45');
      }
      linePx(ctx, 3, 13, 13, 3, '#e6e6e6');
    }
  }
  return c;
}

export type MobKind = 'pig' | 'cow' | 'chicken' | 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'ghast' | 'piglin' | 'villager' | 'iron_golem';
export const MOB_KINDS: MobKind[] = ['pig', 'cow', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider', 'ghast', 'piglin', 'villager', 'iron_golem'];

type MobModel = {
  root: THREE.Group;
  head: THREE.Object3D;
  body: THREE.Object3D;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  materials: THREE.MeshLambertMaterial[];
  textures: THREE.Texture[];
};

/** 8x8 noisy skin texture; `draw` adds features such as faces. */
function mobTex(base: string, specks: string[], density = 0.3, draw?: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = makeCanvas(8, 8);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 8, 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (Math.random() < density) setPx(ctx, x, y, specks[Math.floor(Math.random() * specks.length)]);
    }
  }
  if (draw) draw(ctx);
  return textureRes === 32 ? enhanceTexture(c, 'mob', ++mobTexCounter) : c;
}

/**
 * Blocky Minecraft-style models built from boxes, 1 unit = 1/16 block.
 * Every model faces -Z (the same way the camera looks), so rotation.y = yaw
 * points it where it's walking. Limbs hang from pivot groups so they swing.
 */
function buildMobModel(kind: MobKind | 'player', variant = 0): MobModel {
  const P = 1 / 16;
  const root = new THREE.Group();
  const materials: THREE.MeshLambertMaterial[] = [];
  const textures: THREE.Texture[] = [];
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const mat = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    textures.push(t);
    const m = new THREE.MeshLambertMaterial({ map: t });
    materials.push(m);
    return m;
  };
  const box = (parent: THREE.Object3D, size: number[], pivot: number[], offset: number[], m: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0] * P, size[1] * P, size[2] * P), m);
    mesh.position.set(offset[0] * P, offset[1] * P, offset[2] * P);
    mesh.castShadow = true;
    const pv = new THREE.Group();
    pv.position.set(pivot[0] * P, pivot[1] * P, pivot[2] * P);
    pv.add(mesh);
    parent.add(pv);
    return pv;
  };
  // Box face order: +X, -X, +Y, -Y, +Z, -Z (front)
  const headMats = (side: HTMLCanvasElement, face: HTMLCanvasElement, top?: HTMLCanvasElement): THREE.MeshLambertMaterial[] => {
    const sm = mat(side);
    const tm = top ? mat(top) : sm;
    return [sm, sm, tm, sm, sm, mat(face)];
  };
  let head: THREE.Object3D;
  let body: THREE.Object3D;

  if (kind === 'zombie' || kind === 'skeleton' || kind === 'player') {
    const skel = kind === 'skeleton';
    const lw = skel ? 2 : 4;
    const pal = kind === 'zombie'
      ? { skin: '#4e8a3e', skinS: ['#3f7432', '#5c9a4a'], shirt: '#2f8b96', shirtS: ['#277782'], pants: '#3b3f8f', pantsS: ['#31357a'] }
      : skel
        ? { skin: '#c7c7c7', skinS: ['#a8a8a8', '#d8d8d8'], shirt: '#c7c7c7', shirtS: ['#9a9a9a'], pants: '#c7c7c7', pantsS: ['#a8a8a8'] }
        : { skin: '#a8734f', skinS: ['#9b6845', '#b47e58'], shirt: '#3a7bd5', shirtS: ['#2c5fa8'], pants: '#3b3f8f', pantsS: ['#31357a'] };
    const legM = mat(mobTex(pal.pants, pal.pantsS));
    legs.push(box(root, [lw, 12, lw], [-2, 12, 0], [0, -6, 0], legM));
    legs.push(box(root, [lw, 12, lw], [2, 12, 0], [0, -6, 0], legM));
    const bodyTex = skel
      ? mobTex(pal.shirt, pal.shirtS, 0.15, (ctx) => { ctx.fillStyle = '#6e6e6e'; for (let y = 1; y < 8; y += 2) ctx.fillRect(1, y, 6, 1); })
      : mobTex(pal.shirt, pal.shirtS);
    body = box(root, [8, 12, 4], [0, 12, 0], [0, 6, 0], mat(bodyTex));
    const armM = mat(kind === 'player' ? mobTex(pal.shirt, pal.shirtS) : mobTex(pal.skin, pal.skinS));
    arms.push(box(root, [lw, 12, lw], [-(4 + lw / 2), 22, 0], [0, -4, 0], armM));
    arms.push(box(root, [lw, 12, lw], [4 + lw / 2, 22, 0], [0, -4, 0], armM));
    const face = mobTex(pal.skin, pal.skinS, 0.2, (ctx) => {
      if (skel) {
        ctx.fillStyle = '#111111'; ctx.fillRect(1, 3, 2, 2); ctx.fillRect(5, 3, 2, 2);
        ctx.fillStyle = '#555555'; ctx.fillRect(3, 5, 2, 1);
        ctx.fillStyle = '#6e6e6e'; ctx.fillRect(1, 6, 6, 1);
      } else if (kind === 'zombie') {
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(1, 4, 2, 1); ctx.fillRect(5, 4, 2, 1);
        ctx.fillStyle = '#2f5a25'; ctx.fillRect(3, 6, 2, 1);
      } else {
        ctx.fillStyle = '#3b2213'; ctx.fillRect(0, 0, 8, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(1, 4, 2, 1); ctx.fillRect(5, 4, 2, 1);
        ctx.fillStyle = '#3b4a9c'; ctx.fillRect(2, 4, 1, 1); ctx.fillRect(5, 4, 1, 1);
        ctx.fillStyle = '#7a4a33'; ctx.fillRect(3, 6, 2, 1);
      }
    });
    const side = kind === 'player'
      ? mobTex(pal.skin, pal.skinS, 0.3, (ctx) => { ctx.fillStyle = '#3b2213'; ctx.fillRect(0, 0, 8, 3); })
      : mobTex(pal.skin, pal.skinS);
    const top = kind === 'player' ? mobTex('#3b2213', ['#2e1a0e']) : undefined;
    const hm = headMats(side, face, top);
    head = box(root, [8, 8, 8], [0, 24, 0], [0, 4, 0], hm);
    if (kind === 'player') {
      // A cape hangs from the shoulders on the back (+z); hidden until one is equipped
      const capeM = mat(capeCanvas('crimson'));
      const capePivot = box(root, [10, 16, 1], [0, 24, 2.6], [0, -8, 0], capeM);
      capePivot.visible = false;
      root.userData.skinParts = { legs: legM, body: (body.children[0] as THREE.Mesh).material, arms: armM, head: hm, cape: capeM, capePivot };
      root.userData.look = { ...DEFAULT_LOOK };
    }
    if (skel) {
      const bow = makeItemMesh(ITEM_BOW, false);
      if (bow) {
        bow.scale.setScalar(0.7);
        bow.position.set(0, -10 * P, -1 * P);
        bow.rotation.set(0, Math.PI / 2, Math.PI / 4);
        arms[1].add(bow);
      }
    }
  } else if (kind === 'creeper') {
    const camo = () => mobTex('#4caf3f', ['#2f7d2a', '#7ad66b', '#3c9a33'], 0.45);
    const legM = mat(camo());
    for (const [x, z] of [[-2, -4], [2, -4], [-2, 4], [2, 4]]) legs.push(box(root, [4, 6, 4], [x, 6, z], [0, -3, 0], legM));
    body = box(root, [8, 12, 4], [0, 6, 0], [0, 6, 0], mat(camo()));
    const face = mobTex('#4caf3f', ['#2f7d2a', '#7ad66b'], 0.35, (ctx) => {
      ctx.fillStyle = '#111111';
      ctx.fillRect(1, 2, 2, 2); ctx.fillRect(5, 2, 2, 2);
      ctx.fillRect(3, 4, 2, 3); ctx.fillRect(2, 5, 1, 3); ctx.fillRect(5, 5, 1, 3);
    });
    head = box(root, [8, 8, 8], [0, 18, 0], [0, 4, 0], headMats(camo(), face));
  } else if (kind === 'pig') {
    const skin = () => mobTex('#f0a5a2', ['#e89490', '#f7b8b5'], 0.3);
    const legM = mat(skin());
    for (const [x, z] of [[-3, -5], [3, -5], [-3, 5], [3, 5]]) legs.push(box(root, [4, 6, 4], [x, 6, z], [0, -3, 0], legM));
    body = box(root, [10, 8, 16], [0, 6, 0], [0, 4, 0], mat(skin()));
    const face = mobTex('#f0a5a2', ['#e89490'], 0.2, (ctx) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(1, 2, 2, 1); ctx.fillRect(5, 2, 2, 1);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(2, 2, 1, 1); ctx.fillRect(5, 2, 1, 1);
    });
    head = box(root, [8, 8, 8], [0, 10, -8], [0, 0, -4], headMats(skin(), face));
    box(head, [4, 3, 1], [0, 0, 0], [0, -1, -8.5], mat(mobTex('#e07f7f', ['#d06f6f'], 0.2, (ctx) => {
      ctx.fillStyle = '#8a3f3f'; ctx.fillRect(2, 3, 1, 2); ctx.fillRect(5, 3, 1, 2);
    })));
  } else if (kind === 'cow') {
    const hide = () => mobTex('#4a3524', ['#3d2b1d'], 0.2, (ctx) => {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(1, 1, 3, 2); ctx.fillRect(5, 4, 2, 3); ctx.fillRect(2, 5, 2, 2);
    });
    const legM = mat(mobTex('#4a3524', ['#3d2b1d'], 0.2, (ctx) => { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 5, 8, 3); }));
    for (const [x, z] of [[-4, -7], [4, -7], [-4, 7], [4, 7]]) legs.push(box(root, [4, 12, 4], [x, 12, z], [0, -6, 0], legM));
    body = box(root, [12, 10, 18], [0, 12, 0], [0, 5, 0], mat(hide()));
    const face = mobTex('#4a3524', ['#3d2b1d'], 0.15, (ctx) => {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(2, 4, 4, 4);
      ctx.fillStyle = '#111111'; ctx.fillRect(1, 2, 1, 1); ctx.fillRect(6, 2, 1, 1);
      ctx.fillStyle = '#8a8a8a'; ctx.fillRect(3, 6, 2, 1);
    });
    head = box(root, [8, 8, 6], [0, 19, -9], [0, 0, -3], headMats(hide(), face));
    const hornM = mat(mobTex('#d8d0b8', ['#bdb49a'], 0.2));
    box(head, [1, 3, 1], [-4.5, 3, -4], [0, 1.5, 0], hornM);
    box(head, [1, 3, 1], [4.5, 3, -4], [0, 1.5, 0], hornM);
  } else if (kind === 'ghast') {
    // A huge floating cube (2.5 blocks) with nine dangling tentacles. The face swaps to
    // glowing red eyes and an open mouth while it charges a fireball.
    const sm = mat(mobTex('#f4f4f4', ['#e4e4e4', '#ffffff', '#d6d6d6'], 0.3));
    const calm = mat(mobTex('#f4f4f4', ['#e4e4e4'], 0.15, (ctx) => {
      ctx.fillStyle = '#3d3d3d';
      ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); // closed eyes
      ctx.fillRect(3, 6, 2, 1); // small mouth
    }));
    const angry = mat(mobTex('#f4f4f4', ['#e4e4e4'], 0.1, (ctx) => {
      ctx.fillStyle = '#d11a1a'; ctx.fillRect(1, 2, 2, 2); ctx.fillRect(5, 2, 2, 2); // glowing red eyes
      ctx.fillStyle = '#3a1212'; ctx.fillRect(2, 5, 4, 3); // open mouth
    }));
    body = box(root, [40, 40, 40], [0, 28, 0], [0, 0, 0], [sm, sm, sm, sm, sm, calm]);
    head = body;
    const tent = mat(mobTex('#e9e9e9', ['#d4d4d4', '#f6f6f6'], 0.3));
    const lens = [9, 11, 8, 12, 9, 10, 8, 11, 10];
    let n = 0;
    for (const x of [-13, 0, 13]) {
      for (const z of [-13, 0, 13]) {
        const len = lens[n++];
        legs.push(box(root, [4, len, 4], [x, 9, z], [0, -len / 2, 0], tent));
      }
    }
    root.userData.ghastFace = { mesh: body.children[0], calm, angry };
  } else if (kind === 'piglin') {
    const skin = '#e0a08c', skinS = ['#d08e7a', '#ecb09c'];
    const legM = mat(mobTex('#6b4a2b', ['#593c22', '#7c5834']));
    legs.push(box(root, [4, 12, 4], [-2, 12, 0], [0, -6, 0], legM));
    legs.push(box(root, [4, 12, 4], [2, 12, 0], [0, -6, 0], legM));
    body = box(root, [8, 12, 4], [0, 12, 0], [0, 6, 0], mat(mobTex('#a97b3c', ['#8f6730', '#bb8d4a'], 0.2, (ctx) => {
      ctx.fillStyle = '#f2c230'; ctx.fillRect(0, 5, 8, 1); ctx.fillRect(3, 0, 2, 5); // gold trim down the front
    })));
    const armM = mat(mobTex(skin, skinS));
    arms.push(box(root, [4, 12, 4], [-6, 22, 0], [0, -4, 0], armM));
    arms.push(box(root, [4, 12, 4], [6, 22, 0], [0, -4, 0], armM));
    const face = mobTex(skin, skinS, 0.15, (ctx) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1);
      ctx.fillStyle = '#2a1a12'; ctx.fillRect(2, 3, 1, 1); ctx.fillRect(5, 3, 1, 1);
      ctx.fillRect(1, 2, 2, 1); ctx.fillRect(5, 2, 2, 1); // heavy brow
    });
    head = box(root, [8, 8, 8], [0, 24, 0], [0, 4, 0], headMats(mobTex(skin, skinS), face));
    box(head, [4, 3, 2], [0, 0, 0], [0, 2.5, -5], mat(mobTex('#d58a78', ['#c47866'], 0.2, (ctx) => {
      ctx.fillStyle = '#7a3f33'; ctx.fillRect(2, 3, 1, 2); ctx.fillRect(5, 3, 1, 2); // nostrils
    })));
    const earM = mat(mobTex(skin, skinS));
    box(head, [1, 4, 3], [0, 0, 0], [-4.5, 5, 0], earM);
    box(head, [1, 4, 3], [0, 0, 0], [4.5, 5, 0], earM);
    const tusk = mat(mobTex('#f2ead2', ['#e0d6b8'], 0.1));
    box(head, [1, 2, 1], [0, 0, 0], [-1.5, 0.3, -5.5], tusk);
    box(head, [1, 2, 1], [0, 0, 0], [1.5, 0.3, -5.5], tusk);
    const gold = mat(mobTex('#f2c230', ['#d9a820', '#ffe066'], 0.2)); // a golden sword in the right hand
    box(arms[1], [1, 10, 2], [0, -10, -2], [0, -4, 0], gold);
    box(arms[1], [4, 1, 2], [0, -10, -2], [0, 0, 0], gold);
  } else if (kind === 'villager') {
    // Five robe colours, picked per villager
    const tones = [['#8a6a3a', '#725630'], ['#e8e2d2', '#d2cab6'], ['#4a4a4a', '#383838'], ['#7a3f9a', '#63317f'], ['#a8884a', '#8f7238']][variant % 5];
    const skin = '#d8a98a', skinS = ['#c8987a', '#e4baa0'];
    const robe = () => mobTex(tones[0], [tones[1]], 0.25);
    const legM = mat(mobTex(tones[1], [tones[0]], 0.2));
    legs.push(box(root, [4, 12, 4], [-2, 12, 0], [0, -6, 0], legM));
    legs.push(box(root, [4, 12, 4], [2, 12, 0], [0, -6, 0], legM));
    body = box(root, [8, 12, 6], [0, 12, 0], [0, 6, 0], mat(robe()));
    box(root, [9, 8, 7], [0, 12, 0], [0, -4, 0], mat(robe())); // the robe's skirt hangs over the legs
    box(root, [8, 4, 4], [0, 19, -3], [0, 0, 0], mat(robe())); // arms folded across the chest
    const face = mobTex(skin, skinS, 0.15, (ctx) => {
      ctx.fillStyle = '#3b2a1c'; ctx.fillRect(0, 2, 8, 1); // one long brow
      ctx.fillStyle = '#ffffff'; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1);
      ctx.fillStyle = '#3f8a3a'; ctx.fillRect(2, 3, 1, 1); ctx.fillRect(5, 3, 1, 1); // green eyes
      ctx.fillStyle = '#8a5a44'; ctx.fillRect(3, 6, 2, 1);
    });
    head = box(root, [8, 10, 8], [0, 24, 0], [0, 5, 0], headMats(mobTex(skin, skinS), face, mobTex('#6b4a2a', ['#573b20'])));
    box(head, [2, 4, 2], [0, 0, 0], [0, 3, -5], mat(mobTex('#c48e72', ['#b27c60'], 0.2))); // the big nose
  } else if (kind === 'iron_golem') {
    // 3 blocks tall: stumpy legs, a broad mossy chest, and arms that hang down past the knees
    const iron = () => mobTex('#cfcfcf', ['#b9b9b9', '#e6e6e6', '#a3a3a3'], 0.4);
    const mossy = () => mobTex('#cfcfcf', ['#b9b9b9', '#e6e6e6', '#6fa04e'], 0.4, (ctx) => {
      ctx.fillStyle = '#5f9a45'; ctx.fillRect(1, 5, 2, 3); ctx.fillRect(5, 1, 1, 4); // vines
    });
    const legM = mat(iron());
    legs.push(box(root, [6, 14, 6], [-5, 14, 0], [0, -7, 0], legM));
    legs.push(box(root, [6, 14, 6], [5, 14, 0], [0, -7, 0], legM));
    box(root, [12, 10, 8], [0, 14, 0], [0, 5, 0], mat(iron())); // waist
    body = box(root, [22, 14, 10], [0, 24, 0], [0, 7, 0], mat(mossy())); // chest
    const armM = mat(mossy());
    arms.push(box(root, [5, 30, 6], [-13.5, 37, 0], [0, -14, 0], armM));
    arms.push(box(root, [5, 30, 6], [13.5, 37, 0], [0, -14, 0], armM));
    const face = mobTex('#cfcfcf', ['#b9b9b9', '#e6e6e6'], 0.2, (ctx) => {
      ctx.fillStyle = '#6e6e6e'; ctx.fillRect(0, 2, 8, 1); // heavy brow
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); // eyes
    });
    head = box(root, [8, 10, 8], [0, 38, 0], [0, 5, 0], headMats(iron(), face));
    box(head, [2, 4, 2], [0, 0, 0], [0, 3, -5], mat(mobTex('#a98f7a', ['#8f7863'], 0.2))); // nose
  } else if (kind === 'spider') {
    const hide = () => mobTex('#2b2420', ['#3a302a', '#1e1915'], 0.35);
    body = box(root, [10, 8, 12], [0, 6, 0], [0, 3, 8], mat(hide())); // abdomen, behind
    box(root, [6, 6, 6], [0, 6, 0], [0, 3, 0], mat(hide())); // thorax
    const face = mobTex('#2b2420', ['#3a302a'], 0.2, (ctx) => {
      ctx.fillStyle = '#e01b1b';
      ctx.fillRect(1, 2, 2, 2); ctx.fillRect(5, 2, 2, 2); // two big red eyes
      ctx.fillRect(3, 3, 1, 1); ctx.fillRect(4, 3, 1, 1); ctx.fillRect(2, 5, 1, 1); ctx.fillRect(5, 5, 1, 1); // and small ones
    });
    head = box(root, [8, 8, 8], [0, 6, -3], [0, 3, -4], headMats(hide(), face));
    const legM = mat(mobTex('#1e1915', ['#2b2420'], 0.3));
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const leg = box(root, [16, 2, 2], [side * 3, 7, -2 + k * 1.7], [side * 8, 0, 0], legM);
        leg.rotation.z = -side * 0.45; // the outer end bends down to the ground
        leg.userData.baseY = (k - 1.5) * 0.35 * side; // fanned out front to back
        leg.rotation.y = leg.userData.baseY;
        legs.push(leg);
      }
    }
  } else {
    const feathers = () => mobTex('#f4f4f4', ['#dedede'], 0.2);
    const legM = mat(mobTex('#e8a33a', ['#c98a2a'], 0.2));
    legs.push(box(root, [1, 5, 1], [-1.5, 5, 0], [0, -2.5, 0], legM));
    legs.push(box(root, [1, 5, 1], [1.5, 5, 0], [0, -2.5, 0], legM));
    for (const leg of legs) box(leg, [3, 1, 3], [0, 0, 0], [0, -4.5, -0.5], legM); // feet
    body = box(root, [6, 6, 8], [0, 5, 0], [0, 3, 0], mat(feathers()));
    const wingM = mat(feathers());
    arms.push(box(root, [1, 4, 6], [-3.5, 10, 0], [0, -2, 0], wingM));
    arms.push(box(root, [1, 4, 6], [3.5, 10, 0], [0, -2, 0], wingM));
    const face = mobTex('#f4f4f4', ['#dedede'], 0.1, (ctx) => {
      ctx.fillStyle = '#111111'; ctx.fillRect(0, 1, 2, 2); ctx.fillRect(6, 1, 2, 2); // eyes, high enough that the beak can't hide them
    });
    head = box(root, [4, 6, 3], [0, 9, -4], [0, 3, -1.5], headMats(feathers(), face));
    box(head, [4, 2, 2], [0, 0, 0], [0, 2.2, -4], mat(mobTex('#e8a33a', ['#c98a2a'], 0.1))); // beak
    box(head, [2, 2, 1], [0, 0, 0], [0, 0.6, -3.5], mat(mobTex('#d32f2f', ['#b71c1c'], 0.2))); // wattle
  }
  return { root, head, body, legs, arms, materials, textures };
}

/** Put colored armor plates on a player model (helmet, chestplate, leggings, boots). */
export function applyArmorOverlay(model: MobModel, armorIds: Array<number | null>) {
  const old = (model.root.userData.armorMeshes ?? []) as THREE.Mesh[];
  for (const m of old) { m.parent?.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
  const meshes: THREE.Mesh[] = [];
  const P = 1 / 16;
  const add = (parent: THREE.Object3D, size: number[], offset: number[], color: string) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0] * P, size[1] * P, size[2] * P), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(offset[0] * P, offset[1] * P, offset[2] * P);
    parent.add(mesh);
    meshes.push(mesh);
  };
  armorIds.forEach((id, slot) => {
    const def = id !== null ? ARMOR[id] : undefined;
    if (!def) return;
    const color = ARMOR_COLORS[def.material];
    if (slot === 0) add(model.head, [9, 9, 9], [0, 4, 0], color);
    else if (slot === 1) { add(model.body, [9, 13, 5], [0, 6, 0], color); for (const arm of model.arms) add(arm, [5, 6, 5], [0, -1, 0], color); }
    else if (slot === 2) for (const leg of model.legs) add(leg, [5, 9, 5], [0, -4.5, 0], color);
    else for (const leg of model.legs) add(leg, [5, 4, 5], [0, -10, 0], color);
  });
  model.root.userData.armorMeshes = meshes;
}

/**
 * The little 3D player in the inventory screen. Its head follows your
 * cursor, like Minecraft's. It has its own small renderer.
 */
export function createPlayerPreview(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const light = new THREE.DirectionalLight(0xffffff, 0.7);
  light.position.set(2, 3, 4);
  scene.add(light);
  const cam = new THREE.PerspectiveCamera(30, (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height), 0.1, 50);
  cam.position.set(0, 1.05, 4.6);
  cam.lookAt(0, 0.95, 0);
  const model = buildMobModel('player');
  model.root.rotation.y = Math.PI; // face the viewer
  scene.add(model.root);
  const render = () => renderer.render(scene, cam);
  render();
  return {
    /** nx / ny: cursor offset from the preview's head, roughly -1..1 */
    setLook(nx: number, ny: number) {
      const cx = Math.max(-1, Math.min(1, nx)), cy = Math.max(-1, Math.min(1, ny));
      model.root.rotation.y = Math.PI + cx * 0.35; // the body turns a little
      model.head.rotation.y = cx * 0.6; // and the head the rest of the way
      model.head.rotation.x = -cy * 0.6;
      render();
    },
    setArmor(ids: Array<number | null>) {
      applyArmorOverlay(model, ids);
      render();
    },
    /** Skin and cape */
    setAppearance(look: Partial<PlayerLook>) {
      applyPlayerLook(model, look);
      render();
    },
    dispose() {
      applyArmorOverlay(model, []);
      scene.remove(model.root);
      disposeObject(model.root);
      for (const t of model.textures) t.dispose();
      renderer.dispose();
    },
  };
}

const MOB_INFO: Record<MobKind, { hp: number; speed: number; hostile: boolean; width: number; height: number }> = {
  pig: { hp: 10, speed: 1.6, hostile: false, width: 0.9, height: 0.9 },
  cow: { hp: 10, speed: 1.5, hostile: false, width: 0.9, height: 1.4 },
  chicken: { hp: 4, speed: 1.6, hostile: false, width: 0.4, height: 0.7 },
  zombie: { hp: 20, speed: 2.6, hostile: true, width: 0.6, height: 1.9 },
  skeleton: { hp: 20, speed: 2.4, hostile: true, width: 0.6, height: 1.9 },
  creeper: { hp: 20, speed: 2.3, hostile: true, width: 0.6, height: 1.7 },
  spider: { hp: 16, speed: 2.8, hostile: true, width: 1.4, height: 0.9 },
  ghast: { hp: 10, speed: 2.4, hostile: true, width: 2.6, height: 3 },        // floats, spits fireballs
  piglin: { hp: 16, speed: 2.7, hostile: true, width: 0.6, height: 1.9 },     // leaves you alone in gold armor
  villager: { hp: 20, speed: 1.4, hostile: false, width: 0.6, height: 2.1 },
  iron_golem: { hp: 100, speed: 1.6, hostile: false, width: 1.4, height: 3 }, // 3 blocks tall; guards villages
};

/** Every mob drops at least one item when killed. */
function mobDrops(kind: MobKind): Array<[number, number]> {
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  const list: Array<[number, number]> =
    kind === 'pig' ? [[ITEM_PORKCHOP, r(1, 3)]]
    : kind === 'cow' ? [[ITEM_BEEF, r(1, 3)], [ITEM_LEATHER, r(0, 2)]]
    : kind === 'chicken' ? [[ITEM_CHICKEN, 1], [ITEM_FEATHER, r(0, 2)]]
    : kind === 'zombie' ? [[ITEM_ROTTEN_FLESH, r(1, 2)]]
    : kind === 'skeleton' ? [[ITEM_BONE, r(1, 2)], [ITEM_ARROW, r(0, 2)]]
    : kind === 'spider' ? [[ITEM_STRING, r(1, 2)], [ITEM_SPIDER_EYE, r(0, 1)]]
    : kind === 'ghast' ? [[ITEM_GUNPOWDER, r(0, 2)], [ITEM_GHAST_TEAR, r(0, 1)]]
    : kind === 'piglin' ? [[ITEM_GOLD_INGOT, r(0, 2)], [ITEM_GOLD_SWORD, Math.random() < 0.15 ? 1 : 0]]
    : kind === 'iron_golem' ? [[ITEM_IRON_INGOT, r(3, 5)]]
    : kind === 'villager' ? []
    : [[ITEM_GUNPOWDER, r(1, 2)]];
  return list.filter(([, n]) => n > 0);
}

function shadeColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawObsidianCanvas(): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#140f1f';
  ctx.fillRect(0, 0, 64, 64);
  const tones = ['#231a35', '#0a0710', '#3a2a55', '#1b1428'];
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    ctx.fillRect(Math.floor(Math.random() * 16) * 4, Math.floor(Math.random() * 16) * 4, 8, 4);
  }
  return c;
}

function drawChestCanvas(top: boolean): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#a0682a';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#8a5622';
  for (let y = 3; y < 16; y += 4) ctx.fillRect(1, y, 14, 1);
  ctx.fillStyle = '#4a2c0f';
  ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  if (!top) {
    ctx.fillRect(0, 5, 16, 1); // lid seam
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(7, 4, 2, 3); // latch
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(7, 6, 2, 1);
  }
  return c;
}

let tallGrassCanvas: HTMLCanvasElement | null = null;
function drawTallGrassCanvas(): HTMLCanvasElement {
  if (tallGrassCanvas) return tallGrassCanvas;
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  const blades: Array<[number, number, number, string]> = [
    [2, 9, 0, '#4f8a2f'], [4, 13, 1, '#5c9e3a'], [5, 8, -1, '#6db547'], [7, 14, 0, '#4f8a2f'],
    [9, 11, 1, '#5c9e3a'], [11, 13, -1, '#6db547'], [12, 9, 1, '#4f8a2f'], [14, 12, 0, '#5c9e3a'],
  ];
  for (const [x, h, lean, col] of blades) linePx(ctx, x, 15, Math.max(0, Math.min(15, x + lean)), 15 - h, col);
  tallGrassCanvas = c;
  return c;
}

function drawBucketCanvas(fill: string | null): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  for (let y = 4; y <= 13; y++) {
    const inset = Math.floor((y - 4) / 3);
    for (let x = 3 + inset; x <= 12 - inset; x++) {
      const edge = x === 3 + inset || x === 12 - inset || y === 13;
      setPx(ctx, x, y, edge ? '#6e6e6e' : '#b8b8b8');
    }
  }
  for (let x = 3; x <= 12; x++) setPx(ctx, x, 4, '#d8d8d8'); // rim
  if (fill) for (let x = 4; x <= 11; x++) { setPx(ctx, x, 5, fill); setPx(ctx, x, 6, fill); }
  linePx(ctx, 3, 4, 5, 1, '#8a8a8a'); linePx(ctx, 5, 1, 10, 1, '#8a8a8a'); linePx(ctx, 10, 1, 12, 4, '#8a8a8a'); // handle
  return c;
}

function drawPearlCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  blobPx(ctx, 8, 8, 5.5, 5.5, '#1f8a7a', '#0f4b46', '#6fe0c8');
  setPx(ctx, 6, 6, '#c8fff0');
  return c;
}

function drawConcreteCanvas(color: string): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 16);
  // Very faint speckle so it reads as concrete, not plastic
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
  }
  return c;
}

function drawStringCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  const pts: Array<[number, number]> = [[2, 13], [4, 10], [3, 7], [6, 5], [9, 6], [11, 3], [13, 2]];
  for (let i = 0; i < pts.length - 1; i++) linePx(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? '#d8d8d8' : '#f4f4f4');
  return c;
}

function drawSpiderEyeCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  blobPx(ctx, 8, 8, 5.5, 5, '#c0263a', '#7a1020', '#ec6a7a');
  ctx.fillStyle = '#1a0508';
  ctx.fillRect(7, 7, 3, 3);
  return c;
}

function drawTimeCoreCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f5c542'; ctx.fillRect(3, 1, 10, 2); ctx.fillRect(3, 13, 10, 2); // gold caps
  ctx.fillStyle = '#a8801f'; ctx.fillRect(3, 2, 10, 1); ctx.fillRect(3, 13, 10, 1);
  ctx.fillStyle = '#a8801f'; ctx.fillRect(3, 3, 1, 10); ctx.fillRect(12, 3, 1, 10); // frame posts
  blobPx(ctx, 8, 8, 3.5, 4.5, '#3fd0ff', '#1a6a9a', '#e0fbff'); // glowing core
  return c;
}

const ARMOR_MAPS = [
  ['', '', '...HHHHHHHHHH...', '..HhhhhhhhhhhH..', '..HhhhhhhhhhhH..', '..HhHHHHHHHHhH..', '..HhH......HhH..', '..HhH......HhH..', '..HHH......HHH..'],
  ['', '..HHH......HHH..', '..HhHH....HHhH..', '..HhhHHHHHHhhH..', '..HhhhhhhhhhhH..', '...HhhhhhhhhH...', '....HhhhhhhH....', '....HhhhhhhH....', '....HhhhhhhH....', '....HhhhhhhH....', '....HhhhhhhH....', '....HHHHHHHH....'],
  ['', '...HHHHHHHHHH...', '...HhhhhhhhhH...', '...HhhhhhhhhH...', '...HhhhHHhhhH...', '...HhhH..HhhH...', '...HhhH..HhhH...', '...HhhH..HhhH...', '...HhhH..HhhH...', '...HhhH..HhhH...', '...HHHH..HHHH...'],
  ['', '', '', '', '', '', '...HHH....HHH...', '...HhH....HhH...', '...HhH....HhH...', '..HHhH....HhHH..', '..HhhH....HhhH..', '..HHHH....HHHH..'],
];
const ARMOR_PALETTES: Record<ArmorMaterial, Record<string, string>> = {
  leather: { h: '#a0672f', H: '#5e3a17' }, iron: { h: '#e6e6e6', H: '#8a8a8a' }, gold: { h: '#ffe066', H: '#c99a1a' },
  diamond: { h: '#8ff7ff', H: '#1fa9b5' }, emerald: { h: '#5cf59a', H: '#0e8a3c' },
};

function speckleCanvas(base: string, tones: string[], count: number, block = 1): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), block, block);
  }
  return c;
}

function drawFlintAndSteelCanvas(): HTMLCanvasElement {
  return drawPixelMap([
    '', '', '..HHHHHH........', '..HhhhhH........', '..HHHHhH........', '.....HhH........', '.....HhH........', '.....HHH........',
    '', '.........FFFF...', '........FfffF...', '........FffffF..', '........FfffF...', '.........FFF....',
  ], { h: '#c8c8c8', H: '#6e6e6e', f: '#5a5a5a', F: '#2a2a2a' });
}


// ---- Phase C art: ingots, crops, food, blocks ----
function drawIngotCanvas(light: string, mid: string, dark: string): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 12 - y; x++) setPx(ctx, 2 + x + y, 6 + y, y === 0 ? light : y === 4 ? dark : mid);
  for (let x = 3; x < 13; x++) setPx(ctx, x, 6, light);
  linePx(ctx, 2, 6, 6, 10, dark);
  setPx(ctx, 5, 7, '#ffffff');
  return c;
}
function drawAppleCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  blobPx(ctx, 8, 9.5, 5, 4.5, '#d8282a', '#8a1214', '#ff6a5a');
  linePx(ctx, 8, 3, 8, 5, '#5a3a1a');
  setPx(ctx, 9, 3, '#3f8a2a'); setPx(ctx, 10, 3, '#3f8a2a'); setPx(ctx, 10, 2, '#5aaa3a');
  return c;
}
function drawWheatItemCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  for (const [x, top] of [[5, 3], [8, 2], [11, 4]]) {
    linePx(ctx, x, top + 4, x - 2, 14, '#a8862a');
    for (let k = 0; k < 4; k++) { setPx(ctx, x, top + k, '#e8c45a'); setPx(ctx, x + (k % 2 ? 1 : -1), top + k, '#c89a3a'); }
  }
  return c;
}
function drawSeedsCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 9], [4, 11], [9, 12], [6, 13]]) { setPx(ctx, x, y, '#6aa83a'); setPx(ctx, x + 1, y, '#3f7a22'); }
  return c;
}
function drawBreadCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  blobPx(ctx, 8, 9, 6.5, 3.5, '#c8893a', '#8a5a1e', '#e8b46a');
  for (const x of [5, 8, 11]) linePx(ctx, x, 7, x + 1, 8, '#8a5a1e');
  return c;
}
function drawDoorItemCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a5f30'; ctx.fillRect(4, 1, 8, 14);
  ctx.fillStyle = '#a8793e'; ctx.fillRect(5, 2, 6, 12);
  ctx.fillStyle = '#9fd4ea'; ctx.fillRect(6, 3, 4, 4);
  ctx.fillStyle = '#6a4520'; ctx.fillRect(5, 8, 6, 1);
  setPx(ctx, 10, 9, '#d8c06a');
  return c;
}
function drawPaneItemCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  ctx.fillStyle = '#dbeef5'; ctx.fillRect(7, 0, 2, 16);
  ctx.fillStyle = 'rgba(190,225,240,0.35)'; ctx.fillRect(2, 0, 12, 16);
  ctx.fillStyle = '#dbeef5'; ctx.fillRect(2, 0, 12, 1); ctx.fillRect(2, 15, 12, 1);
  setPx(ctx, 4, 4, '#ffffff'); setPx(ctx, 5, 3, '#ffffff'); setPx(ctx, 11, 10, '#ffffff');
  return c;
}
function drawCookedCanvas(id: number): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  const bone = (len: number) => { linePx(ctx, 2, 13, 2 + len, 13 - len, '#f2efe6'); setPx(ctx, 1, 13, '#f2efe6'); setPx(ctx, 2, 14, '#d6d0c0'); };
  if (id === ITEM_COOKED_PORKCHOP) { blobPx(ctx, 9.5, 7, 5.5, 4.5, '#c8865a', '#8a5030', '#e8b48a'); bone(3); }
  else if (id === ITEM_STEAK) { blobPx(ctx, 9.5, 7, 5.5, 4.5, '#8a4a2a', '#4a2412', '#b46a3e'); linePx(ctx, 6, 9, 12, 5, '#d8a87a'); }
  else { blobPx(ctx, 10, 6.5, 4.5, 4.5, '#c8823a', '#8a5420', '#e8aa6a'); bone(4); }
  return c;
}
// Block faces
function drawFarmlandCanvas(): HTMLCanvasElement {
  const c = speckleCanvas('#5a3a1e', ['#4a2e16', '#6a4626', '#3e2612'], 50);
  const ctx = c.getContext('2d')!;
  const w = c.width, u = w / 16;
  ctx.fillStyle = '#3a2410';
  for (let y = 2; y < 16; y += 4) ctx.fillRect(0, y * u, w, u);
  return c;
}
function drawWheatStageCanvas(stage: number): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  const h = stage === 0 ? 4 : stage === 1 ? 9 : 13;
  const stalk = stage === 2 ? '#b8962e' : '#4f9a2e', leaf = stage === 2 ? '#d8b44a' : '#6ac23a';
  for (const x of [1, 4, 7, 10, 13]) {
    const hh = h - ((x * 7) % 3);
    linePx(ctx, x, 15, x, 16 - hh, stalk);
    if (hh > 3) setPx(ctx, x + 1, 13 - Math.floor(hh / 3), leaf);
    if (stage === 2) for (let k = 0; k < 4; k++) { setPx(ctx, x, 16 - hh + k, '#e8c45a'); setPx(ctx, x + 1, 16 - hh + k + 1, '#c89a3a'); }
  }
  return c;
}
function drawFurnaceCanvas(front: boolean): HTMLCanvasElement {
  const c = speckleCanvas('#7a7a7a', ['#6a6a6a', '#8a8a8a', '#5e5e5e'], 70);
  const ctx = c.getContext('2d')!;
  const u = c.width / 16;
  ctx.fillStyle = '#4e4e4e';
  ctx.fillRect(0, 0, c.width, u); ctx.fillRect(0, c.height - u, c.width, u); ctx.fillRect(0, 0, u, c.height); ctx.fillRect(c.width - u, 0, u, c.height);
  if (front) {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4 * u, 8 * u, 8 * u, 5 * u);
    ctx.fillStyle = '#3a3a3a'; for (let x = 5; x < 12; x += 2) ctx.fillRect(x * u, 9 * u, u, 3 * u);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(4 * u, 3 * u, 8 * u, 2 * u);
  }
  return c;
}
function drawGlassCanvas(): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  ctx.fillStyle = '#dbeef5';
  ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  ctx.fillStyle = '#ffffff';
  for (const [x, y] of [[3, 4], [4, 3], [5, 2], [11, 10], [12, 9], [3, 12]]) setPx(ctx, x, y, '#ffffff');
  return c;
}
function drawDoorCanvas(top: boolean): HTMLCanvasElement {
  const c = makeCanvas(16, 16), ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a5f30'; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#a8793e'; ctx.fillRect(1, 1, 14, 14);
  ctx.fillStyle = '#946832'; for (const x of [4, 8, 12]) ctx.fillRect(x, 1, 1, 14);
  if (top) { ctx.clearRect(3, 3, 4, 5); ctx.clearRect(9, 3, 4, 5); ctx.fillStyle = '#8a5f30'; ctx.fillRect(1, 10, 14, 1); }
  else { ctx.fillStyle = '#6a4520'; ctx.fillRect(1, 7, 14, 1); setPx(ctx, 12, 1, '#d8c06a'); setPx(ctx, 12, 2, '#a88a3a'); }
  return c;
}

export type FaceSet = { top: HTMLCanvasElement; side: HTMLCanvasElement; bottom: HTMLCanvasElement };
let faceCanvasCache: Record<string, HTMLCanvasElement> | null = null; // rebuilt whenever the texture resolution changes

function faceCanvases(): Record<string, HTMLCanvasElement> {
  if (faceCanvasCache) return faceCanvasCache;
  const img = (t: THREE.Texture) => t.image as HTMLCanvasElement;
  const grass = img(makeGrassTexture());
  const dirt = img(makeDirtTexture());
  // Grass side = dirt with a green fringe along the top, like Minecraft
  const grassSide = makeCanvas(64, 64);
  const gctx = grassSide.getContext('2d')!;
  gctx.drawImage(dirt, 0, 0);
  gctx.fillStyle = '#4a8c3a';
  gctx.fillRect(0, 0, 64, 10);
  for (let x = 0; x < 64; x += 4) gctx.fillRect(x, 10, 4, Math.floor(Math.random() * 6));
  faceCanvasCache = {
    grass, dirt, grassSide,
    stone: img(makeStoneTexture()),
    wood: img(makeWoodTexture()),
    leaves: withLeafHoles(img(makeLeafTexture())),
    sand: drawSandCanvas(),
    planks: drawPlanksCanvas(),
    table: drawCraftingTableCanvas(),
    bedrock: drawBedrockCanvas(),
    snow: drawSnowCanvas(),
    logTop: drawLogTopCanvas(),
    obsidian: drawObsidianCanvas(),
    chestTop: drawChestCanvas(true),
    chestSide: drawChestCanvas(false),
    tallGrass: drawTallGrassCanvas(),
    netherrack: speckleCanvas('#6e2b2b', ['#8a3a36', '#4f1c1c', '#7a302d', '#5c2424'], 110),
    soulSand: speckleCanvas('#5a4231', ['#3e2d21', '#6b5140', '#2e2118'], 70, 2),
    glowstone: speckleCanvas('#d9a84e', ['#ffe08a', '#a8752e', '#fff3c4'], 60, 2),
    portal: speckleCanvas('#5a1a9a', ['#8a3ae0', '#3a0a70', '#b070ff', '#6a20b8'], 120),
    farmland: drawFarmlandCanvas(),
    wheat0: drawWheatStageCanvas(0), wheat1: drawWheatStageCanvas(1), wheat2: drawWheatStageCanvas(2),
    furnaceFront: drawFurnaceCanvas(true), furnaceTop: drawFurnaceCanvas(false),
    glass: drawGlassCanvas(),
    doorBottom: drawDoorCanvas(false), doorTop: drawDoorCanvas(true),
  };
  {
    // Quartz ore: netherrack with white crystals
    const q = makeCanvas(16, 16);
    const qctx = q.getContext('2d')!;
    qctx.drawImage(faceCanvasCache.netherrack, 0, 0);
    qctx.fillStyle = '#efe9e1';
    for (const [x, y] of [[2, 3], [9, 2], [5, 9], [12, 8], [3, 13], [10, 13]]) { qctx.fillRect(x, y, 2, 1); qctx.fillRect(x + 1, y + 1, 1, 1); }
    faceCanvasCache.quartzOre = q;
  }
  {
    // Infernium ore: netherrack with glowing orange-red chunks
    const g = makeCanvas(16, 16);
    const gctx = g.getContext('2d')!;
    gctx.drawImage(faceCanvasCache.netherrack, 0, 0);
    for (const [x, y] of [[3, 3], [10, 4], [6, 9], [12, 11], [2, 12]]) {
      gctx.fillStyle = '#8a1e12'; gctx.fillRect(x, y, 3, 2);
      gctx.fillStyle = '#ff6a1a'; gctx.fillRect(x, y, 2, 1);
      gctx.fillStyle = '#ffcf4a'; gctx.fillRect(x + 1, y, 1, 1);
    }
    faceCanvasCache.infernium = g;
  }
  for (const cc of CONCRETE) faceCanvasCache[`concrete${cc.id}`] = drawConcreteCanvas(cc.color);
  const st = faceCanvasCache.stone;
  faceCanvasCache.coalOre = oreCanvas(st, '#3a3a3a', '#141414');
  faceCanvasCache.ironOre = oreCanvas(st, '#d8af93', '#9c7458');
  faceCanvasCache.goldOre = oreCanvas(st, '#f5d33d', '#b8901c');
  faceCanvasCache.diamondOre = oreCanvas(st, '#7ff3fa', '#1fa9b5');
  faceCanvasCache.emeraldOre = oreCanvas(st, '#3df07f', '#0e8a3c');
  if (textureRes === 32) {
    // Ores were built from the classic stone above; now everything gets the detail pass
    const cache = faceCanvasCache;
    for (const key of Object.keys(cache)) cache[key] = enhanceTexture(cache[key], 'block', hashString(key));
  }
  return faceCanvasCache;
}

/** Face textures for anything that should look like a cube; null for flat items. */
export function blockFaces(id: number): FaceSet | null {
  const f = faceCanvases();
  const all = (c: HTMLCanvasElement): FaceSet => ({ top: c, side: c, bottom: c });
  if (isConcrete(id)) return all(f[`concrete${id}`]);
  const cb = CUSTOM_BLOCKS.get(id);
  if (cb) return cb.shape === 'cube' ? all(cb.canvas) : null;
  switch (id) {
    case BLOCK_GRASS: return { top: f.grass, side: f.grassSide, bottom: f.dirt };
    case BLOCK_DIRT: return all(f.dirt);
    case BLOCK_STONE: return all(f.stone);
    case BLOCK_SAND: return all(f.sand);
    case BLOCK_WOOD: return { top: f.logTop, side: f.wood, bottom: f.logTop };
    case BLOCK_LEAVES: return all(f.leaves);
    case BLOCK_CRAFTING_TABLE: return { top: f.table, side: f.table, bottom: f.planks };
    case ITEM_PLANKS: return all(f.planks);
    case BLOCK_BEDROCK: return all(f.bedrock);
    case BLOCK_COAL_ORE: return all(f.coalOre);
    case BLOCK_IRON_ORE: return all(f.ironOre);
    case BLOCK_GOLD_ORE: return all(f.goldOre);
    case BLOCK_DIAMOND_ORE: return all(f.diamondOre);
    case BLOCK_EMERALD_ORE: return all(f.emeraldOre);
    case BLOCK_SNOW: return all(f.snow);
    case BLOCK_OBSIDIAN: return all(f.obsidian);
    case BLOCK_NETHERRACK: return all(f.netherrack);
    case BLOCK_SOUL_SAND: return all(f.soulSand);
    case BLOCK_GLOWSTONE: return all(f.glowstone);
    case BLOCK_QUARTZ_ORE: return all(f.quartzOre);
    case BLOCK_NETHER_PORTAL: return all(f.portal);
    case BLOCK_FARMLAND: return { top: f.farmland, side: f.dirt, bottom: f.dirt };
    case BLOCK_FURNACE: return { top: f.furnaceTop, side: f.furnaceFront, bottom: f.furnaceTop };
    case BLOCK_GLASS: return all(f.glass);
    case BLOCK_INFERNIUM_ORE: return all(f.infernium);
    case BLOCK_CHEST: return { top: f.chestTop, side: f.chestSide, bottom: f.chestTop };
    default: return null;
  }
}

const TOOL_PALETTES: Record<ToolInfo['material'], Record<string, string>> = {
  wood: { h: '#c9995b', H: '#8a5f30', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' },
  stone: { h: '#a3a3a3', H: '#5f5f5f', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' },
  iron: { h: '#e0e0e0', H: '#8a8a8a', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' },
  gold: { h: '#ffe066', H: '#c99a1a', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' },
  diamond: { h: '#8ff7ff', H: '#1fa9b5', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' },
  emerald: { h: '#5cf59a', H: '#0e8a3c', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' },
  infernium: { h: '#ff8a3a', H: '#8a1e12', s: '#3a1612', S: '#1e0a08', g: '#ffcf4a' },
};

/** Flat pixel art for non-block items (sticks, tools). */
function itemCanvas(id: number): HTMLCanvasElement | null {
  const base = itemCanvasBase(id);
  // Items and blocks that mods bring are the author's art and stay exactly as drawn
  if (!base || textureRes !== 32 || CUSTOM_ITEMS.has(id) || CUSTOM_BLOCKS.has(id)) return base;
  let hi = enhancedItemCache.get(id);
  if (!hi) {
    hi = enhanceTexture(base, 'item', id);
    enhancedItemCache.set(id, hi);
  }
  return hi;
}

function itemCanvasBase(id: number): HTMLCanvasElement | null {
  const ci = CUSTOM_ITEMS.get(id);
  if (ci) return ci.canvas;
  const cb = CUSTOM_BLOCKS.get(id);
  if (cb && cb.shape === 'cross') return cb.canvas;
  const armor = ARMOR[id];
  if (armor) return drawPixelMap(ARMOR_MAPS[armor.slot], ARMOR_PALETTES[armor.material]);
  const tool = TOOLS[id];
  if (tool) return drawPixelMap(tool.kind === 'pickaxe' ? PICKAXE_MAP : tool.kind === 'sword' ? SWORD_MAP : tool.kind === 'hoe' ? HOE_MAP : AXE_MAP, TOOL_PALETTES[tool.material]);
  switch (id) {
    case ITEM_STICK: return drawStickCanvas();
    case ITEM_COAL: return drawLumpCanvas();
    case ITEM_DIAMOND: return drawGemCanvas('#c8fbff', '#4fd8e6', '#1d8a96');
    case ITEM_EMERALD: return drawGemCanvas('#b8ffcf', '#2ad46a', '#0e7a37');
    case ITEM_PORKCHOP: case ITEM_BEEF: case ITEM_CHICKEN: case ITEM_ROTTEN_FLESH: return drawFoodCanvas(id);
    case BLOCK_TALL_GRASS: return drawTallGrassCanvas();
    case ITEM_BUCKET: return drawBucketCanvas(null);
    case ITEM_WATER_BUCKET: return drawBucketCanvas('#3a6fd8');
    case ITEM_LAVA_BUCKET: return drawBucketCanvas('#ff7a1a');
    case ITEM_ENDER_PEARL: return drawPearlCanvas();
    case ITEM_STRING: return drawStringCanvas();
    case ITEM_SPIDER_EYE: return drawSpiderEyeCanvas();
    case ITEM_TIME_CORE: return drawTimeCoreCanvas();
    case ITEM_FLINT_AND_STEEL: return drawFlintAndSteelCanvas();
    case ITEM_QUARTZ: return drawGemCanvas('#ffffff', '#e8e0d8', '#a89e94');
    case ITEM_GHAST_TEAR: return drawGemCanvas('#f4fbff', '#cfe6ee', '#8fb4c2');
    case ITEM_IRON_INGOT: return drawIngotCanvas('#f2f2f2', '#c8c8c8', '#8a8a8a');
    case ITEM_GOLD_INGOT: return drawIngotCanvas('#fff2a0', '#f2c230', '#b07a10');
    case ITEM_INFERNIUM_INGOT: return drawIngotCanvas('#ffb06a', '#d8401a', '#6a120a');
    case ITEM_APPLE: return drawAppleCanvas();
    case ITEM_WHEAT: return drawWheatItemCanvas();
    case ITEM_SEEDS: return drawSeedsCanvas();
    case ITEM_BREAD: return drawBreadCanvas();
    case ITEM_DOOR: return drawDoorItemCanvas();
    case BLOCK_GLASS_PANE: return drawPaneItemCanvas();
    case ITEM_COOKED_PORKCHOP: case ITEM_STEAK: case ITEM_COOKED_CHICKEN: return drawCookedCanvas(id);
    case ITEM_BONE: case ITEM_ARROW: case ITEM_FEATHER: case ITEM_GUNPOWDER: case ITEM_LEATHER: case ITEM_BOW: return drawMiscItemCanvas(id);
    default: return null;
  }
}

const iconCache: Record<number, string> = {}; // eslint-disable-line prefer-const

/**
 * Inventory/hotbar icon as a data URL. Blocks are drawn as a shaded
 * isometric cube (3 visible faces), items as crisp pixel art — the same
 * split Minecraft uses.
 */
export function getItemIconURL(id: number): string {
  if (iconCache[id]) return iconCache[id];
  const S = 48;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const faces = blockFaces(id);
  if (faces) {
    const drawFace = (src: HTMLCanvasElement, a: number, b: number, cc: number, d: number, e: number, f: number, shade: number) => {
      const T = src.width;
      ctx.setTransform(a / T, b / T, cc / T, d / T, e, f);
      ctx.drawImage(src, 0, 0);
      if (shade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(0, 0, T, T);
      }
    };
    drawFace(faces.side, 21, 11, 0, 22, 3, 13, 0.18);   // left face
    drawFace(faces.side, 21, -11, 0, 22, 24, 24, 0.36); // right face (darker)
    drawFace(faces.top, 21, -11, 21, 11, 3, 13, 0);     // top face
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const art = itemCanvas(id);
    if (art) ctx.drawImage(art, 0, 0, S, S);
  }
  iconCache[id] = c.toDataURL();
  return iconCache[id];
}

/**
 * Turns 16x16 pixel art into a real 3D mesh: every opaque pixel becomes a
 * tiny box, with only the outward-facing edge faces generated. This is how
 * Minecraft gives dropped/held items like sticks visible thickness.
 */
function buildExtrudedGeometry(canvas: HTMLCanvasElement): THREE.BufferGeometry {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const px = 1 / w;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  const quad = (verts: number[][], r: number, g: number, b: number, shade: number) => {
    const base = pos.length / 3;
    for (const v of verts) { pos.push(v[0], v[1], v[2]); col.push(r * shade, g * shade, b * shade); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue;
      const i = (y * w + x) * 4;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const x0 = x * px - 0.5, x1 = x0 + px;
      const y0 = 0.5 - (y + 1) * px, y1 = y0 + px;
      const z0 = -px / 2, z1 = px / 2;
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], r, g, b, 1);
      quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], r, g, b, 0.8);
      if (!opaque(x - 1, y)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], r, g, b, 0.7);
      if (!opaque(x + 1, y)) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], r, g, b, 0.7);
      if (!opaque(x, y - 1)) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], r, g, b, 0.9);
      if (!opaque(x, y + 1)) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], r, g, b, 0.6);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const faceTexCache = new Map<HTMLCanvasElement, THREE.CanvasTexture>();
function texForCanvas(c: HTMLCanvasElement): THREE.CanvasTexture {
  let t = faceTexCache.get(c);
  if (!t) {
    t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    faceTexCache.set(c, t);
  }
  return t;
}

/**
 * A 1-unit mesh for an item: a textured cube for blocks, an extruded pixel
 * mesh for items. `unlit` uses MeshBasicMaterial, needed for the held item
 * because the hand renders in a separate pass with no scene lights.
 */
function makeItemMesh(id: number, unlit: boolean): THREE.Mesh | null {
  const faces = blockFaces(id);
  if (faces) {
    const order = [faces.side, faces.side, faces.top, faces.bottom, faces.side, faces.side];
    const mats = order.map((c) => unlit
      ? new THREE.MeshBasicMaterial({ map: texForCanvas(c), alphaTest: 0.5 })
      : new THREE.MeshLambertMaterial({ map: texForCanvas(c), alphaTest: 0.5 }));
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  }
  const art = itemCanvas(id);
  if (!art) return null;
  const mat = unlit
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return new THREE.Mesh(buildExtrudedGeometry(art), mat);
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mm) => mm.dispose()); // textures are shared & cached, not disposed here
    }
  });
}

// ===================================================================
//  Inline Perlin noise — lightweight, no external deps
// ===================================================================

class PerlinNoise {
  private perm: Uint8Array;

  constructor(seed: number = 12345) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle seeded with LCG
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(s) % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  private static grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3d(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = PerlinNoise.fade(x);
    const v = PerlinNoise.fade(y);
    const w = PerlinNoise.fade(z);
    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;
    return PerlinNoise.lerp(
      PerlinNoise.lerp(
        PerlinNoise.lerp(PerlinNoise.grad(this.perm[AA], x, y, z), PerlinNoise.grad(this.perm[BA], x - 1, y, z), u),
        PerlinNoise.lerp(PerlinNoise.grad(this.perm[AB], x, y - 1, z), PerlinNoise.grad(this.perm[BB], x - 1, y - 1, z), u),
        v,
      ),
      PerlinNoise.lerp(
        PerlinNoise.lerp(PerlinNoise.grad(this.perm[AA + 1], x, y, z - 1), PerlinNoise.grad(this.perm[BA + 1], x - 1, y, z - 1), u),
        PerlinNoise.lerp(PerlinNoise.grad(this.perm[AB + 1], x, y - 1, z - 1), PerlinNoise.grad(this.perm[BB + 1], x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  }

  // Fractal Brownian Motion — multi-octave noise for natural terrain
  fbm(x: number, y: number, z: number, octaves: number, persistence: number, scale: number): number {
    let total = 0, amplitude = 1, frequency = scale, maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise3d(x * frequency, y * frequency, z * frequency) * amplitude;
      maxVal += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxVal;
  }
}

// ===================================================================
//  World constants & block types
// ===================================================================

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const SEA_LEVEL = 30;

export const BLOCK_AIR = 0;
export const BLOCK_GRASS = 1;
export const BLOCK_DIRT = 2;
export const BLOCK_STONE = 3;
export const BLOCK_SAND = 4;
export const BLOCK_WOOD = 5;
export const BLOCK_LEAVES = 6;
// Crafted-only items — ids deliberately outside the block-id range above so
// they never collide with a placeable block id.
export const ITEM_PLANKS = 32; // a placeable block (it used to be item 100, and items can't be placed)
export const ITEM_STICK = 101;
export const BLOCK_CRAFTING_TABLE = 7;
export const ITEM_WOOD_PICKAXE = 102;
export const ITEM_WOOD_SWORD = 103;
export const ITEM_STONE_PICKAXE = 104;
export const ITEM_STONE_SWORD = 105;
export const ITEM_WOOD_AXE = 106;
export const ITEM_STONE_AXE = 107;
export const BLOCK_BEDROCK = 8;
export const BLOCK_COAL_ORE = 9;
export const BLOCK_IRON_ORE = 10;
export const BLOCK_GOLD_ORE = 11;
export const BLOCK_DIAMOND_ORE = 12;
export const BLOCK_EMERALD_ORE = 13;
export const BLOCK_SNOW = 14;
export const ITEM_COAL = 108;
export const ITEM_DIAMOND = 109;
export const ITEM_EMERALD = 110;
export const ITEM_PORKCHOP = 111;
export const ITEM_BEEF = 112;
export const ITEM_CHICKEN = 113;
export const ITEM_ROTTEN_FLESH = 114;
export const ITEM_BONE = 115;
export const ITEM_ARROW = 116;
export const ITEM_GUNPOWDER = 117;
export const ITEM_FEATHER = 118;
export const ITEM_LEATHER = 119;
export const ITEM_BOW = 120;
export const ITEM_BUCKET = 121;
export const ITEM_WATER_BUCKET = 122;
export const ITEM_LAVA_BUCKET = 123;
export const ITEM_ENDER_PEARL = 124;
export const ITEM_GOLD_PICKAXE = 125;
export const ITEM_GOLD_SWORD = 126;
export const ITEM_GOLD_AXE = 127;
export const ITEM_DIAMOND_PICKAXE = 128;
export const ITEM_DIAMOND_SWORD = 129;
export const ITEM_DIAMOND_AXE = 130;
export const ITEM_EMERALD_PICKAXE = 131;
export const ITEM_EMERALD_SWORD = 132;
export const ITEM_EMERALD_AXE = 133;
export const ITEM_STRING = 134;
export const ITEM_SPIDER_EYE = 135;
export const ITEM_TIME_CORE = 136;
export const ITEM_IRON_PICKAXE = 137;
export const ITEM_IRON_SWORD = 138;
export const ITEM_IRON_AXE = 139;
export const ITEM_FLINT_AND_STEEL = 140;
export const ITEM_QUARTZ = 141;
export const ITEM_GHAST_TEAR = 162; // (142-161 are armor)
// Armor: 5 materials x [helmet, chestplate, leggings, boots] = ids 142-161
export const ARMOR_MATERIALS = ['leather', 'iron', 'gold', 'diamond', 'emerald'] as const;
export type ArmorMaterial = typeof ARMOR_MATERIALS[number];
export const ARMOR_PIECES = ['Helmet', 'Chestplate', 'Leggings', 'Boots'] as const;
const ARMOR_POINTS: Record<ArmorMaterial, number[]> = {
  leather: [1, 3, 2, 1], gold: [2, 5, 3, 1], iron: [2, 6, 5, 2], diamond: [3, 8, 6, 3], emerald: [3, 8, 7, 3],
};
export const ARMOR_COLORS: Record<ArmorMaterial, string> = {
  leather: '#8b5a2b', iron: '#d6d6d6', gold: '#f2c218', diamond: '#4fd8e6', emerald: '#2ad46a',
};
/** slot: 0 helmet, 1 chestplate, 2 leggings, 3 boots */
export const ARMOR: Record<number, { slot: number; material: ArmorMaterial; points: number }> = {};
ARMOR_MATERIALS.forEach((m, mi) => {
  for (let slot = 0; slot < 4; slot++) ARMOR[142 + mi * 4 + slot] = { slot, material: m, points: ARMOR_POINTS[m][slot] };
});
export const armorId = (m: ArmorMaterial, slot: number) => 142 + ARMOR_MATERIALS.indexOf(m) * 4 + slot;

// ---------------- Farming, furnaces, glass, doors and the Nether ingot ----------------
// Built-in blocks must stay below 100 (ids 100+ are items, 60-99 belong to mods).
export const BLOCK_FARMLAND = 46;
export const BLOCK_WHEAT_0 = 47; // just planted
export const BLOCK_WHEAT_1 = 48;
export const BLOCK_WHEAT_2 = 49; // ripe
export const BLOCK_FURNACE = 50;
export const BLOCK_GLASS = 51;
export const BLOCK_GLASS_PANE = 52;
export const BLOCK_INFERNIUM_ORE = 53; // deep in the Nether
// A door is two blocks. The bottom half says which edge of the cell it sits on
// (54-57 = north, east, south, west); the top half says whether it is open.
export const BLOCK_DOOR_N = 54;
export const BLOCK_DOOR_TOP = 58;
export const BLOCK_DOOR_TOP_OPEN = 59;
export function isWheat(b: number): boolean { return b >= BLOCK_WHEAT_0 && b <= BLOCK_WHEAT_2; }
export function isDoor(b: number): boolean { return b >= BLOCK_DOOR_N && b <= BLOCK_DOOR_TOP_OPEN; }
export function isDoorBottom(b: number): boolean { return b >= BLOCK_DOOR_N && b < BLOCK_DOOR_TOP; }

export const ITEM_IRON_INGOT = 163;
export const ITEM_GOLD_INGOT = 164;
export const ITEM_INFERNIUM_INGOT = 165;
export const ITEM_COOKED_PORKCHOP = 166;
export const ITEM_STEAK = 167;
export const ITEM_COOKED_CHICKEN = 168;
export const ITEM_APPLE = 169;
export const ITEM_WHEAT = 170;
export const ITEM_SEEDS = 171;
export const ITEM_BREAD = 172;
export const ITEM_WOOD_HOE = 173;
export const ITEM_STONE_HOE = 174;
export const ITEM_IRON_HOE = 175;
export const ITEM_DIAMOND_HOE = 176;
export const ITEM_INFERNIUM_PICKAXE = 177;
export const ITEM_INFERNIUM_SWORD = 178;
export const ITEM_INFERNIUM_AXE = 179;
export const ITEM_INFERNIUM_HOE = 180;
export const ITEM_DOOR = 181;

/** Furnace recipes: what each input turns into. */
export const SMELTING: Record<number, number> = {};
/** How many seconds one of each fuel burns (a furnace cooks one item every 8 seconds). */
export const FUEL_SECONDS: Record<number, number> = {};
export const COOK_SECONDS = 8;

/**
 * Collision/drawing boxes (0..1 inside the cell) for blocks that aren't whole
 * cubes: doors and glass panes. `at` reads the neighbouring blocks. null = a cube.
 */
export function shapeBoxes(b: number, at: (dx: number, dy: number, dz: number) => number): Array<[number, number, number, number, number, number]> | null {
  if (isDoor(b)) {
    const below = at(0, -1, 0);
    const edge = isDoorBottom(b) ? b - BLOCK_DOOR_N : isDoorBottom(below) ? below - BLOCK_DOOR_N : 0;
    const T = 3 / 16;
    if (edge === 0) return [[0, 0, 0, 1, 1, T]];
    if (edge === 1) return [[1 - T, 0, 0, 1, 1, 1]];
    if (edge === 2) return [[0, 0, 1 - T, 1, 1, 1]];
    return [[0, 0, 0, T, 1, 1]];
  }
  if (b === BLOCK_GLASS_PANE) {
    const joins = (dx: number, dz: number) => { const n = at(dx, 0, dz); return n === BLOCK_GLASS_PANE || n === BLOCK_GLASS || isOpaque(n); };
    let n = joins(0, -1), sth = joins(0, 1), w = joins(-1, 0), e = joins(1, 0);
    if (!n && !sth && !w && !e) { w = true; e = true; } // a lone pane stands east-west
    const lo = 7 / 16, hi = 9 / 16;
    const out: Array<[number, number, number, number, number, number]> = [[lo, 0, lo, hi, 1, hi]];
    if (n) out.push([lo, 0, 0, hi, 1, lo]);
    if (sth) out.push([lo, 0, hi, hi, 1, 1]);
    if (w) out.push([0, 0, lo, lo, 1, hi]);
    if (e) out.push([hi, 0, lo, 1, 1, hi]);
    return out;
  }
  return null;
}

// ---------------- Tool tiers ----------------
// tier = how tough a block it can mine (see requiredTier): 1 stone & coal,
// 2 iron/gold/diamond/emerald ores, 3 obsidian. speed multiplies mining
// speed on the blocks that tool is for. Gold is fast but weak, like Minecraft.
export type ToolKind = 'pickaxe' | 'axe' | 'sword' | 'hoe';
export type ToolInfo = { kind: ToolKind; material: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'infernium'; tier: number; speed: number; damage: number };
const TOOL_MATERIALS = {
  wood: { tier: 1, speed: 2, damage: { pickaxe: 2, axe: 3, sword: 4, hoe: 1 } },
  stone: { tier: 2, speed: 4, damage: { pickaxe: 3, axe: 4, sword: 5, hoe: 1 } },
  iron: { tier: 3, speed: 6, damage: { pickaxe: 4, axe: 5, sword: 6, hoe: 1 } },
  gold: { tier: 1, speed: 12, damage: { pickaxe: 2, axe: 3, sword: 4, hoe: 1 } },
  diamond: { tier: 4, speed: 8, damage: { pickaxe: 5, axe: 6, sword: 7, hoe: 1 } },
  emerald: { tier: 5, speed: 10, damage: { pickaxe: 6, axe: 7, sword: 8, hoe: 1 } },
  infernium: { tier: 6, speed: 13, damage: { pickaxe: 7, axe: 9, sword: 10, hoe: 2 } }, // from the Nether
} as const;
const toolOf = (kind: ToolKind, material: ToolInfo['material']): ToolInfo =>
  ({ kind, material, tier: TOOL_MATERIALS[material].tier, speed: TOOL_MATERIALS[material].speed, damage: TOOL_MATERIALS[material].damage[kind] });
export const TOOLS: Record<number, ToolInfo> = {
  [ITEM_WOOD_PICKAXE]: toolOf('pickaxe', 'wood'), [ITEM_WOOD_SWORD]: toolOf('sword', 'wood'), [ITEM_WOOD_AXE]: toolOf('axe', 'wood'),
  [ITEM_STONE_PICKAXE]: toolOf('pickaxe', 'stone'), [ITEM_STONE_SWORD]: toolOf('sword', 'stone'), [ITEM_STONE_AXE]: toolOf('axe', 'stone'),
  [ITEM_GOLD_PICKAXE]: toolOf('pickaxe', 'gold'), [ITEM_GOLD_SWORD]: toolOf('sword', 'gold'), [ITEM_GOLD_AXE]: toolOf('axe', 'gold'),
  [ITEM_DIAMOND_PICKAXE]: toolOf('pickaxe', 'diamond'), [ITEM_DIAMOND_SWORD]: toolOf('sword', 'diamond'), [ITEM_DIAMOND_AXE]: toolOf('axe', 'diamond'),
  [ITEM_IRON_PICKAXE]: toolOf('pickaxe', 'iron'), [ITEM_IRON_SWORD]: toolOf('sword', 'iron'), [ITEM_IRON_AXE]: toolOf('axe', 'iron'),
  [ITEM_EMERALD_PICKAXE]: toolOf('pickaxe', 'emerald'), [ITEM_EMERALD_SWORD]: toolOf('sword', 'emerald'), [ITEM_EMERALD_AXE]: toolOf('axe', 'emerald'),
  [ITEM_INFERNIUM_PICKAXE]: toolOf('pickaxe', 'infernium'), [ITEM_INFERNIUM_SWORD]: toolOf('sword', 'infernium'), [ITEM_INFERNIUM_AXE]: toolOf('axe', 'infernium'),
  [ITEM_WOOD_HOE]: toolOf('hoe', 'wood'), [ITEM_STONE_HOE]: toolOf('hoe', 'stone'), [ITEM_IRON_HOE]: toolOf('hoe', 'iron'), [ITEM_DIAMOND_HOE]: toolOf('hoe', 'diamond'), [ITEM_INFERNIUM_HOE]: toolOf('hoe', 'infernium'),
};
export const TIER_NAMES = ['', 'wooden', 'stone', 'iron', 'diamond', 'emerald', 'infernium'];

// ---------------- Concrete ----------------
// Smooth, bright building blocks. White is crafted from sand + stone; the
// other colors are 8 white concrete around a coloring ingredient.
export const BLOCK_CONCRETE_WHITE = 33;
export const CONCRETE: Array<{ id: number; name: string; color: string }> = [
  { id: 33, name: 'White', color: '#e9ecec' },
  { id: 34, name: 'Black', color: '#14161a' },
  { id: 35, name: 'Gray', color: '#5a5e63' },
  { id: 36, name: 'Yellow', color: '#f2c218' },
  { id: 37, name: 'Orange', color: '#ea6a0c' },
  { id: 38, name: 'Lime', color: '#5fb81c' },
  { id: 39, name: 'Cyan', color: '#158991' },
  { id: 40, name: 'Purple', color: '#6a20a6' },
];
export function isConcrete(b: number): boolean { return b >= 33 && b <= 40; }

/** How strong a pickaxe a block needs (0 = anything, even bare hands). */
export function requiredTier(b: number): number {
  if (b === BLOCK_OBSIDIAN || b === BLOCK_INFERNIUM_ORE) return 4; // diamond, like Minecraft
  if (b === BLOCK_DIAMOND_ORE || b === BLOCK_EMERALD_ORE) return 3; // iron
  if (b === BLOCK_IRON_ORE || b === BLOCK_GOLD_ORE) return 2; // stone
  if (b === BLOCK_STONE || b === BLOCK_COAL_ORE || isConcrete(b) || b === BLOCK_NETHERRACK || b === BLOCK_QUARTZ_ORE || b === BLOCK_GLOWSTONE || b === BLOCK_FURNACE) return 1;
  return CUSTOM_BLOCKS.get(b)?.tier ?? 0;
}

// Fluids: one id per state. Source = still block, flowing levels 1..max get
// weaker the farther they are from a source, "fall" = pouring straight down.
export const BLOCK_WATER = 15;      // water source; flowing water is 16..22 (levels 1..7)
export const BLOCK_WATER_FALL = 23;
export const BLOCK_LAVA = 24;       // lava source; flowing lava is 25..27 (levels 1..3)
export const BLOCK_LAVA_FALL = 28;
export const BLOCK_OBSIDIAN = 29;
export const BLOCK_TALL_GRASS = 30;
export const BLOCK_CHEST = 31;
// The Nether
export const BLOCK_NETHERRACK = 41;
export const BLOCK_SOUL_SAND = 42;
export const BLOCK_GLOWSTONE = 43;
export const BLOCK_QUARTZ_ORE = 44;
export const BLOCK_NETHER_PORTAL = 45;
const WATER_MAX = 7;
const LAVA_MAX = 3;

export function isWater(b: number): boolean { return b >= BLOCK_WATER && b <= BLOCK_WATER_FALL; }
export function isLava(b: number): boolean { return b >= BLOCK_LAVA && b <= BLOCK_LAVA_FALL; }
export function isFluid(b: number): boolean { return b >= BLOCK_WATER && b <= BLOCK_LAVA_FALL; }
function isSourceFluid(b: number): boolean { return b === BLOCK_WATER || b === BLOCK_LAVA; }
function isFallFluid(b: number): boolean { return b === BLOCK_WATER_FALL || b === BLOCK_LAVA_FALL; }
function flowLevel(b: number): number {
  if (isSourceFluid(b) || isFallFluid(b)) return 0;
  return isWater(b) ? b - BLOCK_WATER : b - BLOCK_LAVA;
}
/** Blocks you collide with and can stand on (not air, fluids or plants). */
// One lookup table instead of a chain of checks: these run millions of
// times while building meshes, and mods can register their own blocks.
const BLOCK_FLAGS = new Uint8Array(256); // bit 1 = solid, bit 2 = opaque
for (let b = 0; b < 256; b++) {
  const solid = b !== BLOCK_AIR && !isFluid(b) && b !== BLOCK_TALL_GRASS && b !== BLOCK_NETHER_PORTAL && !(b >= 47 && b <= 49); // 47-49: wheat
  // Leaves, glass, panes and doors are solid but see-through (54-59 are doors)
  BLOCK_FLAGS[b] = solid ? (b === BLOCK_LEAVES || b === 51 || b === 52 || (b >= 54 && b <= 59) ? 1 : 3) : 0;
}
/** Blocks you collide with and can stand on (not air, fluids, plants or portals). */
export function isSolid(b: number): boolean { return (BLOCK_FLAGS[b] & 1) !== 0; }
/** Solid blocks you can't see through: these hide neighboring faces and cast ambient occlusion. */
export function isOpaque(b: number): boolean { return (BLOCK_FLAGS[b] & 2) !== 0; }
/** Cells a new block, fluid or item can be put into. */
export function isReplaceable(b: number): boolean { return b === BLOCK_AIR || b === BLOCK_TALL_GRASS || (isFluid(b) && !isSourceFluid(b)); }

// ---------------- Slot-based inventory (like Minecraft) ----------------
export type ItemStack = { id: number; count: number };
export type Slots = Array<ItemStack | null>;
/** Slots 0-8 are the hotbar, 9-35 the main inventory. */
export const INVENTORY_SIZE = 36;
export const CHEST_SIZE = 27;

export function maxStack(id: number): number {
  if (id === ITEM_ENDER_PEARL) return 16;
  if (id === ITEM_BUCKET || id === ITEM_WATER_BUCKET || id === ITEM_LAVA_BUCKET) return 1;
  if (TOOLS[id] || ARMOR[id] || id === ITEM_FLINT_AND_STEEL) return 1; // tools and armor don't stack
  const custom = CUSTOM_ITEMS.get(id);
  if (custom) return custom.maxStack;
  if (id === ITEM_TIME_CORE) return 1;
  if (id === ITEM_BOW) return 1;
  return 64;
}

/** Add items: top up existing stacks first, then fill empty slots. Returns how many didn't fit. */
export function addToSlots(slots: Slots, id: number, count: number): number {
  const max = maxStack(id);
  let left = count;
  for (let i = 0; i < slots.length && left > 0; i++) {
    const s = slots[i];
    if (s && s.id === id && s.count < max) {
      const n = Math.min(max - s.count, left);
      slots[i] = { id, count: s.count + n };
      left -= n;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (!slots[i]) {
      const n = Math.min(max, left);
      slots[i] = { id, count: n };
      left -= n;
    }
  }
  return left;
}

export function countInSlots(slots: Slots, id: number): number {
  let n = 0;
  for (const s of slots) if (s && s.id === id) n += s.count;
  return n;
}

/** Remove items, taking from the back of the inventory first so the hotbar is spared. Returns how many were removed. */
export function removeFromSlots(slots: Slots, id: number, count: number): number {
  let left = count;
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const s = slots[i];
    if (s && s.id === id) {
      const n = Math.min(s.count, left);
      slots[i] = s.count - n > 0 ? { id, count: s.count - n } : null;
      left -= n;
    }
  }
  return count - left;
}

export function emptySlots(n: number): Slots {
  return Array.from({ length: n }, () => null);
}

export const ITEM_INFO: Record<number, { name: string; color: string; hidden?: boolean; lore?: string[] }> = {
  [BLOCK_GRASS]: { name: 'Grass', color: '#4caf50' },
  [BLOCK_DIRT]: { name: 'Dirt', color: '#8d6e4a' },
  [BLOCK_STONE]: { name: 'Stone', color: '#8a8a8a' },
  [BLOCK_SAND]: { name: 'Sand', color: '#e0d097' },
  [BLOCK_WOOD]: { name: 'Wood', color: '#6b4a2b' },
  [BLOCK_LEAVES]: { name: 'Leaves', color: '#3a7d3a' },
  [ITEM_PLANKS]: { name: 'Planks', color: '#c19a5b' },
  [ITEM_STICK]: { name: 'Stick', color: '#a9814f' },
  [BLOCK_CRAFTING_TABLE]: { name: 'Crafting Table', color: '#9c6f3f' },
  [ITEM_WOOD_PICKAXE]: { name: 'Wood Pickaxe', color: '#b98a52' },
  [ITEM_WOOD_SWORD]: { name: 'Wood Sword', color: '#caa06a' },
  [ITEM_STONE_PICKAXE]: { name: 'Stone Pickaxe', color: '#9a9a9a' },
  [ITEM_STONE_SWORD]: { name: 'Stone Sword', color: '#ababab' },
  [ITEM_WOOD_AXE]: { name: 'Wood Axe', color: '#c99a5f' },
  [ITEM_STONE_AXE]: { name: 'Stone Axe', color: '#a3a3a3' },
  [BLOCK_BEDROCK]: { name: 'Bedrock', color: '#3b3b3b' },
  [BLOCK_COAL_ORE]: { name: 'Coal Ore', color: '#4a4a4a' },
  [BLOCK_IRON_ORE]: { name: 'Iron Ore', color: '#c9a58c' },
  [BLOCK_GOLD_ORE]: { name: 'Gold Ore', color: '#e8c94a' },
  [BLOCK_DIAMOND_ORE]: { name: 'Diamond Ore', color: '#5decf5' },
  [BLOCK_EMERALD_ORE]: { name: 'Emerald Ore', color: '#17dd62' },
  [BLOCK_SNOW]: { name: 'Snow', color: '#f2f6fa' },
  [ITEM_COAL]: { name: 'Coal', color: '#2b2b2b' },
  [ITEM_DIAMOND]: { name: 'Diamond', color: '#4fd8e6' },
  [ITEM_EMERALD]: { name: 'Emerald', color: '#2ad46a' },
  [ITEM_PORKCHOP]: { name: 'Raw Porkchop', color: '#f19a9a' },
  [ITEM_BEEF]: { name: 'Raw Beef', color: '#c0392b' },
  [ITEM_CHICKEN]: { name: 'Raw Chicken', color: '#f3d1b5' },
  [ITEM_ROTTEN_FLESH]: { name: 'Rotten Flesh', color: '#6f7d3a' },
  [ITEM_BONE]: { name: 'Bone', color: '#f2efe6' },
  [ITEM_ARROW]: { name: 'Arrow', color: '#8a6a3c' },
  [ITEM_GUNPOWDER]: { name: 'Gunpowder', color: '#6b6b6b' },
  [ITEM_FEATHER]: { name: 'Feather', color: '#f7f7f7' },
  [ITEM_LEATHER]: { name: 'Leather', color: '#8b5a2b' },
  [ITEM_BOW]: { name: 'Bow', color: '#8a5a2b' },
  [BLOCK_OBSIDIAN]: { name: 'Obsidian', color: '#1b1428' },
  [BLOCK_TALL_GRASS]: { name: 'Tall Grass', color: '#5c9e3a' },
  [BLOCK_CHEST]: { name: 'Chest', color: '#a0682a' },
  [ITEM_BUCKET]: { name: 'Bucket', color: '#b8b8b8' },
  [ITEM_WATER_BUCKET]: { name: 'Water Bucket', color: '#3a6fd8' },
  [ITEM_LAVA_BUCKET]: { name: 'Lava Bucket', color: '#ff7a1a' },
  [ITEM_ENDER_PEARL]: { name: 'Ender Pearl', color: '#1f8a7a' },
  [ITEM_GOLD_PICKAXE]: { name: 'Gold Pickaxe', color: '#ffe066' },
  [ITEM_GOLD_SWORD]: { name: 'Gold Sword', color: '#ffe066' },
  [ITEM_GOLD_AXE]: { name: 'Gold Axe', color: '#ffe066' },
  [ITEM_DIAMOND_PICKAXE]: { name: 'Diamond Pickaxe', color: '#8ff7ff' },
  [ITEM_DIAMOND_SWORD]: { name: 'Diamond Sword', color: '#8ff7ff' },
  [ITEM_DIAMOND_AXE]: { name: 'Diamond Axe', color: '#8ff7ff' },
  [ITEM_EMERALD_PICKAXE]: { name: 'Emerald Pickaxe', color: '#5cf59a' },
  [ITEM_EMERALD_SWORD]: { name: 'Emerald Sword', color: '#5cf59a' },
  [ITEM_EMERALD_AXE]: { name: 'Emerald Axe', color: '#5cf59a' },
  [ITEM_STRING]: { name: 'String', color: '#e8e8e8' },
  [ITEM_SPIDER_EYE]: { name: 'Spider Eye', color: '#c0263a' },
  [ITEM_TIME_CORE]: { name: 'Time Core', color: '#3fd0ff' },
  [ITEM_IRON_PICKAXE]: { name: 'Iron Pickaxe', color: '#e0e0e0' },
  [ITEM_IRON_SWORD]: { name: 'Iron Sword', color: '#e0e0e0' },
  [ITEM_IRON_AXE]: { name: 'Iron Axe', color: '#e0e0e0' },
  [ITEM_FLINT_AND_STEEL]: { name: 'Flint and Steel', color: '#8a8a8a' },
  [ITEM_QUARTZ]: { name: 'Nether Quartz', color: '#efe9e1' },
  [BLOCK_NETHERRACK]: { name: 'Netherrack', color: '#7a302d' },
  [BLOCK_SOUL_SAND]: { name: 'Soul Sand', color: '#5a4231' },
  [BLOCK_GLOWSTONE]: { name: 'Glowstone', color: '#e8b75a' },
  [BLOCK_QUARTZ_ORE]: { name: 'Nether Quartz Ore', color: '#a65a52' },
  [ITEM_GHAST_TEAR]: { name: 'Ghast Tear', color: '#e8f4f8' },
  [BLOCK_FARMLAND]: { name: 'Farmland', color: '#5a3a1e', hidden: true },
  [BLOCK_WHEAT_0]: { name: 'Wheat Crop', color: '#4f9a2e', hidden: true },
  [BLOCK_WHEAT_1]: { name: 'Wheat Crop', color: '#4f9a2e', hidden: true },
  [BLOCK_WHEAT_2]: { name: 'Wheat Crop', color: '#d8b44a', hidden: true },
  [BLOCK_FURNACE]: { name: 'Furnace', color: '#7a7a7a' },
  [BLOCK_GLASS]: { name: 'Glass', color: '#dbeef5' },
  [BLOCK_GLASS_PANE]: { name: 'Glass Pane', color: '#dbeef5' },
  [BLOCK_INFERNIUM_ORE]: { name: 'Infernium Ore', color: '#ff6a1a' },
  [BLOCK_DOOR_N]: { name: 'Door Block', color: '#a8793e', hidden: true },
  [BLOCK_DOOR_N + 1]: { name: 'Door Block', color: '#a8793e', hidden: true },
  [BLOCK_DOOR_N + 2]: { name: 'Door Block', color: '#a8793e', hidden: true },
  [BLOCK_DOOR_N + 3]: { name: 'Door Block', color: '#a8793e', hidden: true },
  [BLOCK_DOOR_TOP]: { name: 'Door Block', color: '#a8793e', hidden: true },
  [BLOCK_DOOR_TOP_OPEN]: { name: 'Door Block', color: '#a8793e', hidden: true },
  [ITEM_IRON_INGOT]: { name: 'Iron Ingot', color: '#d8d8d8' },
  [ITEM_GOLD_INGOT]: { name: 'Gold Ingot', color: '#f2c230' },
  [ITEM_INFERNIUM_INGOT]: { name: 'Infernium Ingot', color: '#d8401a', lore: ['Forged from ore found deep in the Nether.', 'Makes the strongest tools in the game.'] },
  [ITEM_COOKED_PORKCHOP]: { name: 'Cooked Porkchop', color: '#c8865a' },
  [ITEM_STEAK]: { name: 'Steak', color: '#8a4a2a' },
  [ITEM_COOKED_CHICKEN]: { name: 'Cooked Chicken', color: '#c8823a' },
  [ITEM_APPLE]: { name: 'Apple', color: '#d8282a' },
  [ITEM_WHEAT]: { name: 'Wheat', color: '#d8b44a' },
  [ITEM_SEEDS]: { name: 'Seeds', color: '#6aa83a', lore: ['Plant on farmland (hoe some grass or dirt first).'] },
  [ITEM_BREAD]: { name: 'Bread', color: '#c8893a' },
  [ITEM_WOOD_HOE]: { name: 'Wooden Hoe', color: '#c9995b', lore: ['Right-click grass or dirt to make farmland.'] },
  [ITEM_STONE_HOE]: { name: 'Stone Hoe', color: '#a3a3a3', lore: ['Right-click grass or dirt to make farmland.'] },
  [ITEM_IRON_HOE]: { name: 'Iron Hoe', color: '#e0e0e0', lore: ['Right-click grass or dirt to make farmland.'] },
  [ITEM_DIAMOND_HOE]: { name: 'Diamond Hoe', color: '#8ff7ff', lore: ['Right-click grass or dirt to make farmland.'] },
  [ITEM_INFERNIUM_PICKAXE]: { name: 'Infernium Pickaxe', color: '#ff8a3a' },
  [ITEM_INFERNIUM_SWORD]: { name: 'Infernium Sword', color: '#ff8a3a' },
  [ITEM_INFERNIUM_AXE]: { name: 'Infernium Axe', color: '#ff8a3a' },
  [ITEM_INFERNIUM_HOE]: { name: 'Infernium Hoe', color: '#ff8a3a' },
  [ITEM_DOOR]: { name: 'Door', color: '#a8793e' },
};
Object.assign(SMELTING, {
  [BLOCK_IRON_ORE]: ITEM_IRON_INGOT, [BLOCK_GOLD_ORE]: ITEM_GOLD_INGOT, [BLOCK_INFERNIUM_ORE]: ITEM_INFERNIUM_INGOT,
  [BLOCK_SAND]: BLOCK_GLASS, [BLOCK_WOOD]: ITEM_COAL,
  [ITEM_PORKCHOP]: ITEM_COOKED_PORKCHOP, [ITEM_BEEF]: ITEM_STEAK, [ITEM_CHICKEN]: ITEM_COOKED_CHICKEN,
});
Object.assign(FUEL_SECONDS, {
  [ITEM_COAL]: 80, [ITEM_LAVA_BUCKET]: 1000, [BLOCK_WOOD]: 15, [ITEM_PLANKS]: 15, [BLOCK_CRAFTING_TABLE]: 15, [ITEM_STICK]: 5,
  [ITEM_WOOD_PICKAXE]: 10, [ITEM_WOOD_SWORD]: 10, [ITEM_WOOD_AXE]: 10, [ITEM_WOOD_HOE]: 10,
});
ARMOR_MATERIALS.forEach((m) => {
  ARMOR_PIECES.forEach((piece, slot) => {
    ITEM_INFO[armorId(m, slot)] = { name: `${m.charAt(0).toUpperCase() + m.slice(1)} ${piece}`, color: ARMOR_COLORS[m] };
  });
});
for (const c of CONCRETE) ITEM_INFO[c.id] = { name: `${c.name} Concrete`, color: c.color };

// ---------------- Custom items & blocks (added by mods) ----------------
export type TextureSpec = { pixels?: string[]; palette?: Record<string, string>; color?: string };
export type HoldStyle = 'item' | 'one_hand' | 'two_hands';
export type CustomItemDef = { id: number; key: string; name: string; canvas: HTMLCanvasElement; maxStack: number; hold: HoldStyle; leftClickUse: boolean };
export type CustomBlockDef = {
  id: number; key: string; name: string; canvas: HTMLCanvasElement; shape: 'cube' | 'cross';
  solid: boolean; drops: number | null; hardness: number; tier: number;
};
export const CUSTOM_ITEMS = new Map<number, CustomItemDef>();
export const CUSTOM_BLOCKS = new Map<number, CustomBlockDef>();
const CUSTOM_KEYS = new Map<string, number>();
/** Material slot for each custom cube block, and for every cross-shaped plant (filled in by the engine). */
export const CUSTOM_MAT_INDEX = new Int16Array(256).fill(-1);
export const CROSS_MAT = new Int16Array(256).fill(-1);
CROSS_MAT[BLOCK_TALL_GRASS] = 17;
CROSS_MAT[BLOCK_WHEAT_0] = 36;
CROSS_MAT[BLOCK_WHEAT_1] = 37;
CROSS_MAT[BLOCK_WHEAT_2] = 38;

export function customIdForKey(key: string): number | null {
  return CUSTOM_KEYS.get(key) ?? null;
}

// The same key always gets the same id (remembered in the browser), so
// saved worlds and inventories keep pointing at the right modded things.
function allocateCustomId(key: string, min: number, max: number): number {
  let ids: Record<string, number> = {};
  try { ids = JSON.parse(localStorage.getItem('vb-custom-ids') ?? '{}') as Record<string, number>; } catch { /* storage blocked */ }
  const have = ids[key];
  if (have !== undefined && have >= min && have <= max) return have;
  const used = new Set(Object.values(ids));
  for (let id = min; id <= max; id++) {
    if (!used.has(id)) {
      ids[key] = id;
      try { localStorage.setItem('vb-custom-ids', JSON.stringify(ids)); } catch { /* storage blocked */ }
      return id;
    }
  }
  throw new Error('No room for more custom ' + (max < 100 ? 'blocks' : 'items'));
}

export function drawTexture(t: TextureSpec | undefined, fallback: string): HTMLCanvasElement {
  if (t?.pixels && t.palette) return drawPixelMap(t.pixels.slice(0, 64).map((r) => String(r).slice(0, 64)), t.palette);
  return speckleCanvas(t?.color && /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : fallback, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 30);
}

const KEY_RE = /^[a-z0-9_]+:[a-z0-9_]+$/;

export function registerCustomItem(spec: {
  key: string; name: string; texture?: TextureSpec; maxStack?: number; food?: number;
  hold?: HoldStyle; lore?: string[]; leftClickUse?: boolean;
}): number {
  if (!KEY_RE.test(spec.key)) throw new Error(`Item ids look like "mymod:thing" (got "${spec.key}")`);
  const id = allocateCustomId(spec.key, 200, 999);
  const hold: HoldStyle = spec.hold === 'one_hand' || spec.hold === 'two_hands' ? spec.hold : 'item';
  const def: CustomItemDef = {
    id, key: spec.key, name: String(spec.name).slice(0, 40), canvas: drawTexture(spec.texture, '#c8c8c8'),
    maxStack: Math.max(1, Math.min(64, Math.floor(spec.maxStack ?? 64))), hold, leftClickUse: !!spec.leftClickUse,
  };
  CUSTOM_ITEMS.set(id, def);
  CUSTOM_KEYS.set(spec.key, id);
  ITEM_INFO[id] = { name: def.name, color: spec.texture?.color ?? '#c8c8c8', lore: (spec.lore ?? []).slice(0, 8).map((l) => String(l).slice(0, 80)) };
  if (spec.food && spec.food > 0) FOOD_VALUES[id] = Math.min(20, Math.floor(spec.food));
  else delete FOOD_VALUES[id];
  delete iconCache[id];
  return id;
}

/** Block faces are mipmapped, so make the picture a power-of-two size (a 20x20 upload becomes 32x32). */
function toPowerOfTwo(c: HTMLCanvasElement): HTMLCanvasElement {
  const size = Math.max(c.width, c.height);
  let p = 16;
  while (p < size) p *= 2;
  if (c.width === p && c.height === p) return c;
  const out = makeCanvas(p, p);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, p, p);
  return out;
}

export function registerCustomBlock(spec: {
  key: string; name: string; texture?: TextureSpec; shape?: 'cube' | 'cross'; solid?: boolean;
  drops?: number | null; hardness?: number; tier?: number; hidden?: boolean;
}): number {
  if (!KEY_RE.test(spec.key)) throw new Error(`Block ids look like "mymod:thing" (got "${spec.key}")`);
  const id = allocateCustomId(spec.key, 60, 99);
  const shape = spec.shape === 'cross' ? 'cross' : 'cube';
  const solid = shape === 'cube' && spec.solid !== false;
  const def: CustomBlockDef = {
    id, key: spec.key, name: String(spec.name).slice(0, 40), canvas: toPowerOfTwo(drawTexture(spec.texture, '#9a9a9a')), shape, solid,
    drops: spec.drops === undefined ? id : spec.drops, hardness: Math.max(0, Math.min(30, spec.hardness ?? 0.6)), tier: Math.max(0, Math.min(5, Math.floor(spec.tier ?? 0))),
  };
  CUSTOM_BLOCKS.set(id, def);
  CUSTOM_KEYS.set(spec.key, id);
  BLOCK_FLAGS[id] = solid ? 3 : 0;
  ITEM_INFO[id] = { name: def.name, color: spec.texture?.color ?? '#9a9a9a', hidden: !!spec.hidden };
  delete iconCache[id];
  return id;
}

/** Hunger points restored by eating (right-click while holding). */
export const FOOD_VALUES: Record<number, number> = {
  [ITEM_PORKCHOP]: 3,
  [ITEM_BEEF]: 3,
  [ITEM_CHICKEN]: 2,
  [ITEM_ROTTEN_FLESH]: 4,
  [ITEM_APPLE]: 4,
  [ITEM_BREAD]: 5,
  [ITEM_COOKED_PORKCHOP]: 8,
  [ITEM_STEAK]: 8,
  [ITEM_COOKED_CHICKEN]: 6,
};

export type Recipe = {
  id: string;
  name: string;
  /**
   * Shaped pattern, row-major. `null` = must be empty.
   * `width`/`height` are the pattern's own dimensions; it can be placed
   * anywhere within a large enough grid (so a 2x2 recipe works in the
   * 3x3 crafting table too).
   */
  pattern: (number | null)[];
  width: number;
  height: number;
  output: { id: number; count: number };
  /** true = needs the 3x3 crafting table, not the 2x2 inventory grid */
  needsTable: boolean;
};

export const RECIPES: Recipe[] = [
  {
    id: 'planks', name: 'Planks',
    pattern: [BLOCK_WOOD], width: 1, height: 1,
    output: { id: ITEM_PLANKS, count: 4 }, needsTable: false,
  },
  {
    id: 'sticks', name: 'Sticks',
    pattern: [ITEM_PLANKS, ITEM_PLANKS], width: 1, height: 2,
    output: { id: ITEM_STICK, count: 4 }, needsTable: false,
  },
  {
    id: 'crafting_table', name: 'Crafting Table',
    pattern: [ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS], width: 2, height: 2,
    output: { id: BLOCK_CRAFTING_TABLE, count: 1 }, needsTable: false,
  },
  {
    id: 'wood_pickaxe', name: 'Wood Pickaxe',
    pattern: [
      ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS,
      null, ITEM_STICK, null,
      null, ITEM_STICK, null,
    ], width: 3, height: 3,
    output: { id: ITEM_WOOD_PICKAXE, count: 1 }, needsTable: true,
  },
  {
    id: 'wood_sword', name: 'Wood Sword',
    pattern: [ITEM_PLANKS, ITEM_PLANKS, ITEM_STICK], width: 1, height: 3,
    output: { id: ITEM_WOOD_SWORD, count: 1 }, needsTable: true,
  },
  {
    id: 'stone_pickaxe', name: 'Stone Pickaxe',
    pattern: [
      BLOCK_STONE, BLOCK_STONE, BLOCK_STONE,
      null, ITEM_STICK, null,
      null, ITEM_STICK, null,
    ], width: 3, height: 3,
    output: { id: ITEM_STONE_PICKAXE, count: 1 }, needsTable: true,
  },
  {
    id: 'stone_sword', name: 'Stone Sword',
    pattern: [BLOCK_STONE, BLOCK_STONE, ITEM_STICK], width: 1, height: 3,
    output: { id: ITEM_STONE_SWORD, count: 1 }, needsTable: true,
  },
  {
    id: 'wood_axe', name: 'Wood Axe',
    pattern: [
      ITEM_PLANKS, ITEM_PLANKS, null,
      ITEM_PLANKS, ITEM_STICK, null,
      null, ITEM_STICK, null,
    ], width: 3, height: 3,
    output: { id: ITEM_WOOD_AXE, count: 1 }, needsTable: true,
  },
  {
    id: 'chest', name: 'Chest',
    pattern: [
      ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS,
      ITEM_PLANKS, null, ITEM_PLANKS,
      ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS,
    ], width: 3, height: 3,
    output: { id: BLOCK_CHEST, count: 1 }, needsTable: true,
  },
  {
    // No furnace yet, so buckets use iron ore directly
    id: 'bucket', name: 'Bucket',
    pattern: [
      ITEM_IRON_INGOT, null, ITEM_IRON_INGOT,
      null, ITEM_IRON_INGOT, null,
    ], width: 3, height: 2,
    output: { id: ITEM_BUCKET, count: 1 }, needsTable: true,
  },
  {
    id: 'stone_axe', name: 'Stone Axe',
    pattern: [
      BLOCK_STONE, BLOCK_STONE, null,
      BLOCK_STONE, ITEM_STICK, null,
      null, ITEM_STICK, null,
    ], width: 3, height: 3,
    output: { id: ITEM_STONE_AXE, count: 1 }, needsTable: true,
  },
];

// Every tool material uses the same shapes as wood and stone
for (const [mat, label, pick, sword, axe] of [
  [ITEM_IRON_INGOT, 'Iron', ITEM_IRON_PICKAXE, ITEM_IRON_SWORD, ITEM_IRON_AXE],
  [ITEM_GOLD_INGOT, 'Gold', ITEM_GOLD_PICKAXE, ITEM_GOLD_SWORD, ITEM_GOLD_AXE],
  [ITEM_INFERNIUM_INGOT, 'Infernium', ITEM_INFERNIUM_PICKAXE, ITEM_INFERNIUM_SWORD, ITEM_INFERNIUM_AXE],
  [ITEM_DIAMOND, 'Diamond', ITEM_DIAMOND_PICKAXE, ITEM_DIAMOND_SWORD, ITEM_DIAMOND_AXE],
  [ITEM_EMERALD, 'Emerald', ITEM_EMERALD_PICKAXE, ITEM_EMERALD_SWORD, ITEM_EMERALD_AXE],
] as Array<[number, string, number, number, number]>) {
  const key = label.toLowerCase();
  RECIPES.push(
    { id: `${key}_pickaxe`, name: `${label} Pickaxe`, pattern: [mat, mat, mat, null, ITEM_STICK, null, null, ITEM_STICK, null], width: 3, height: 3, output: { id: pick, count: 1 }, needsTable: true },
    { id: `${key}_sword`, name: `${label} Sword`, pattern: [mat, mat, ITEM_STICK], width: 1, height: 3, output: { id: sword, count: 1 }, needsTable: true },
    { id: `${key}_axe`, name: `${label} Axe`, pattern: [mat, mat, null, mat, ITEM_STICK, null, null, ITEM_STICK, null], width: 3, height: 3, output: { id: axe, count: 1 }, needsTable: true },
  );
}
// Hoes: right-click grass or dirt to make farmland
for (const [mat, label, hoe] of [
  [ITEM_PLANKS, 'Wooden', ITEM_WOOD_HOE], [BLOCK_STONE, 'Stone', ITEM_STONE_HOE], [ITEM_IRON_INGOT, 'Iron', ITEM_IRON_HOE],
  [ITEM_DIAMOND, 'Diamond', ITEM_DIAMOND_HOE], [ITEM_INFERNIUM_INGOT, 'Infernium', ITEM_INFERNIUM_HOE],
] as Array<[number, string, number]>) {
  RECIPES.push({ id: `${label.toLowerCase()}_hoe`, name: `${label} Hoe`, pattern: [mat, mat, null, ITEM_STICK, null, ITEM_STICK], width: 2, height: 3, output: { id: hoe, count: 1 }, needsTable: true });
}
RECIPES.push(
  { id: 'furnace', name: 'Furnace', pattern: [BLOCK_STONE, BLOCK_STONE, BLOCK_STONE, BLOCK_STONE, null, BLOCK_STONE, BLOCK_STONE, BLOCK_STONE, BLOCK_STONE], width: 3, height: 3, output: { id: BLOCK_FURNACE, count: 1 }, needsTable: true },
  { id: 'door', name: 'Door', pattern: [ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS, ITEM_PLANKS], width: 2, height: 3, output: { id: ITEM_DOOR, count: 3 }, needsTable: true },
  { id: 'glass_pane', name: 'Glass Pane', pattern: [BLOCK_GLASS, BLOCK_GLASS, BLOCK_GLASS, BLOCK_GLASS, BLOCK_GLASS, BLOCK_GLASS], width: 3, height: 2, output: { id: BLOCK_GLASS_PANE, count: 16 }, needsTable: true },
  { id: 'bread', name: 'Bread', pattern: [ITEM_WHEAT, ITEM_WHEAT, ITEM_WHEAT], width: 3, height: 1, output: { id: ITEM_BREAD, count: 1 }, needsTable: false },
);
// Time Core: hold it in your off-hand. If you'd die, it shatters and rewinds you 5 seconds.
RECIPES.push({
  id: 'time_core', name: 'Time Core',
  pattern: [ITEM_GOLD_INGOT, ITEM_EMERALD, ITEM_GOLD_INGOT, ITEM_DIAMOND, ITEM_ENDER_PEARL, ITEM_DIAMOND, ITEM_GOLD_INGOT, ITEM_EMERALD, ITEM_GOLD_INGOT],
  width: 3, height: 3, output: { id: ITEM_TIME_CORE, count: 1 }, needsTable: true,
});
// Armor, in Minecraft's shapes
const ARMOR_INGREDIENT: Record<ArmorMaterial, number> = {
  leather: ITEM_LEATHER, iron: ITEM_IRON_INGOT, gold: ITEM_GOLD_INGOT, diamond: ITEM_DIAMOND, emerald: ITEM_EMERALD,
};
for (const m of ARMOR_MATERIALS) {
  const M = ARMOR_INGREDIENT[m];
  const shapes: Array<[(number | null)[], number]> = [
    [[M, M, M, M, null, M], 2],
    [[M, null, M, M, M, M, M, M, M], 3],
    [[M, M, M, M, null, M, M, null, M], 3],
    [[M, null, M, M, null, M], 2],
  ];
  shapes.forEach(([pattern, height], slot) => {
    const id = armorId(m, slot);
    RECIPES.push({ id: `${m}_${ARMOR_PIECES[slot].toLowerCase()}`, name: ITEM_INFO[id].name, pattern, width: 3, height, output: { id, count: 1 }, needsTable: true });
  });
}
// Lights Nether portals (no gravel or flint yet, so it's iron ore + coal)
RECIPES.push({
  id: 'flint_and_steel', name: 'Flint and Steel',
  pattern: [ITEM_IRON_INGOT, null, null, ITEM_COAL], width: 2, height: 2,
  output: { id: ITEM_FLINT_AND_STEEL, count: 1 }, needsTable: false,
});
RECIPES.push({
  id: 'white_concrete', name: 'White Concrete',
  pattern: [BLOCK_SAND, BLOCK_STONE, BLOCK_STONE, BLOCK_SAND], width: 2, height: 2,
  output: { id: BLOCK_CONCRETE_WHITE, count: 4 }, needsTable: false,
});
const W = BLOCK_CONCRETE_WHITE;
for (const [dye, id] of [[ITEM_COAL, 34], [BLOCK_STONE, 35], [BLOCK_GOLD_ORE, 36], [BLOCK_IRON_ORE, 37], [ITEM_EMERALD, 38], [ITEM_DIAMOND, 39], [ITEM_ENDER_PEARL, 40]]) {
  const c = CONCRETE.find((x) => x.id === id)!;
  RECIPES.push({
    id: `${c.name.toLowerCase()}_concrete`, name: `${c.name} Concrete`,
    pattern: [W, W, W, W, dye, W, W, W, W], width: 3, height: 3,
    output: { id, count: 8 }, needsTable: true,
  });
}

/**
 * Match a crafting grid against the recipe list. `grid` is row-major with
 * `size`x`size` cells (2 for the inventory grid, 3 for the table); null =
 * empty. Patterns are matched at every valid offset so a small recipe can
 * sit anywhere in a bigger grid, exactly like Minecraft's shaped crafting.
 */
export function matchRecipe(grid: (number | null)[], size: number, hasTable: boolean): Recipe | null {
  for (const recipe of RECIPES) {
    if (recipe.needsTable && !hasTable) continue;
    if (recipe.width > size || recipe.height > size) continue;

    for (let offY = 0; offY <= size - recipe.height; offY++) {
      for (let offX = 0; offX <= size - recipe.width; offX++) {
        let ok = true;
        for (let y = 0; y < size && ok; y++) {
          for (let x = 0; x < size && ok; x++) {
            const cell = grid[y * size + x] ?? null;
            const inPattern =
              x >= offX && x < offX + recipe.width &&
              y >= offY && y < offY + recipe.height;
            const want = inPattern
              ? recipe.pattern[(y - offY) * recipe.width + (x - offX)] ?? null
              : null;
            if (cell !== want) ok = false;
          }
        }
        if (ok) return recipe;
      }
    }
  }
  return null;
}

// Tree structure blueprint: [dx, dy, dz, blockType]
// Trunk is 4 blocks high, leaves are a 5x5x3 cluster at top
const TREE_BLUEPRINT: Array<[number, number, number, number]> = [
  // Trunk (0,0,0 is the base on the ground)
  [0, 0, 0, BLOCK_WOOD],
  [0, 1, 0, BLOCK_WOOD],
  [0, 2, 0, BLOCK_WOOD],
  [0, 3, 0, BLOCK_WOOD],
  // Leaves layer 1 (y=3, 5x5 ring minus center which is trunk)
  [-2, 4, -2, BLOCK_LEAVES], [-1, 4, -2, BLOCK_LEAVES], [0, 4, -2, BLOCK_LEAVES], [1, 4, -2, BLOCK_LEAVES], [2, 4, -2, BLOCK_LEAVES],
  [-2, 4, -1, BLOCK_LEAVES], [-1, 4, -1, BLOCK_LEAVES], [0, 4, -1, BLOCK_LEAVES], [1, 4, -1, BLOCK_LEAVES], [2, 4, -1, BLOCK_LEAVES],
  [-2, 4, 0, BLOCK_LEAVES], [-1, 4, 0, BLOCK_LEAVES], [1, 4, 0, BLOCK_LEAVES], [2, 4, 0, BLOCK_LEAVES],
  [-2, 4, 1, BLOCK_LEAVES], [-1, 4, 1, BLOCK_LEAVES], [0, 4, 1, BLOCK_LEAVES], [1, 4, 1, BLOCK_LEAVES], [2, 4, 1, BLOCK_LEAVES],
  [-2, 4, 2, BLOCK_LEAVES], [-1, 4, 2, BLOCK_LEAVES], [0, 4, 2, BLOCK_LEAVES], [1, 4, 2, BLOCK_LEAVES], [2, 4, 2, BLOCK_LEAVES],
  // Leaves layer 2 (y=5, 5x5 full)
  [-2, 5, -2, BLOCK_LEAVES], [-1, 5, -2, BLOCK_LEAVES], [0, 5, -2, BLOCK_LEAVES], [1, 5, -2, BLOCK_LEAVES], [2, 5, -2, BLOCK_LEAVES],
  [-2, 5, -1, BLOCK_LEAVES], [-1, 5, -1, BLOCK_LEAVES], [0, 5, -1, BLOCK_LEAVES], [1, 5, -1, BLOCK_LEAVES], [2, 5, -1, BLOCK_LEAVES],
  [-2, 5, 0, BLOCK_LEAVES], [-1, 5, 0, BLOCK_LEAVES], [0, 5, 0, BLOCK_LEAVES], [1, 5, 0, BLOCK_LEAVES], [2, 5, 0, BLOCK_LEAVES],
  [-2, 5, 1, BLOCK_LEAVES], [-1, 5, 1, BLOCK_LEAVES], [0, 5, 1, BLOCK_LEAVES], [1, 5, 1, BLOCK_LEAVES], [2, 5, 1, BLOCK_LEAVES],
  [-2, 5, 2, BLOCK_LEAVES], [-1, 5, 2, BLOCK_LEAVES], [0, 5, 2, BLOCK_LEAVES], [1, 5, 2, BLOCK_LEAVES], [2, 5, 2, BLOCK_LEAVES],
  // Leaves layer 3 (y=6, 3x3 cap)
  [-1, 6, -1, BLOCK_LEAVES], [0, 6, -1, BLOCK_LEAVES], [1, 6, -1, BLOCK_LEAVES],
  [-1, 6, 0, BLOCK_LEAVES], [0, 6, 0, BLOCK_LEAVES], [1, 6, 0, BLOCK_LEAVES],
  [-1, 6, 1, BLOCK_LEAVES], [0, 6, 1, BLOCK_LEAVES], [1, 6, 1, BLOCK_LEAVES],
  // Top leaf
  [0, 7, 0, BLOCK_LEAVES],
];

// Minimum spacing between tree bases (in world blocks)
const TREE_MIN_SPACING = 4;

// ===================================================================
//  Chunk data — stores voxel IDs in a flat array
// ===================================================================

class Chunk {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  mesh: THREE.Mesh | null = null;
  fluidMesh: THREE.Mesh | null = null;
  generated = false;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  idx(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return BLOCK_AIR;
    return this.blocks[this.idx(x, y, z)];
  }

  set(x: number, y: number, z: number, v: number) {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
    this.blocks[this.idx(x, y, z)] = v;
  }
}

// Extension of Chunk to support setting blocks in world coordinates that
// may land in a neighboring chunk. This handles cross-boundary tree leaves.

// ===================================================================
//  World — manages chunks, noise generation, and mesh building
// ===================================================================

type Biome = 'plains' | 'forest' | 'desert' | 'snowy' | 'mountains' | 'ocean' | 'nether' | 'custom';

/** A dimension a mod can create with game.dimensions.create(). */
export type DimensionSpec = {
  id: string; name: string; type: 'flat' | 'void' | 'islands' | 'caves';
  top: number; filler: number; base: number; liquid: number; sky: string; fog: string; light: number;
};
const NETHER_LAVA_LEVEL = 12;

// ---------------- Villages ----------------
/** One piece of a village (a road, a house, the well...). build() writes blocks; the chunk keeps only the ones inside it. */
export type VillagePiece = {
  kind: 'road' | 'house' | 'well' | 'lamp';
  x0: number; z0: number; x1: number; z1: number; // area it can touch, in world blocks (inclusive)
  build: (set: (x: number, y: number, z: number, block: number) => void) => void;
};
export type Village = {
  id: string; cx: number; cz: number; biome: Biome; baseY: number;
  wellY: number; // the ground at the well, which sits on the real terrain
  pieces: VillagePiece[];
  homes: Array<[number, number, number]>; // where each villager lives (feet position)
  houses: Array<{ x: number; z: number; y0: number; w: number; d: number; face: number }>; // x,z is the centre; y0 the floor level
  golemSpawn: [number, number, number];
  radius: number;
};
/** Villages are checked once per 256x256 area, and only about 1 area in 10 actually gets one. */
export const VILLAGE_REGION = 256;
const VILLAGE_CHANCE = 0.35;
const WATER_LEVEL = SEA_LEVEL + 2;
const LAVA_LEVEL = 8; // caves below this are flooded with lava

// Which entry of the chunk materials array each block face uses.
// Face order: 0 +X, 1 -X, 2 +Y (top), 3 -Y (bottom), 4 +Z, 5 -Z.
// ---------------- Holding things in third person ----------------
// Every kind of item is held differently: a pistol is aimed one-handed, a rifle with two,
// a sword is raised, a pickaxe rests on the shoulder, a bow is held out in the left hand.
export type HeldStyle = 'tool' | 'sword' | 'block' | 'item' | 'gun1' | 'gun2' | 'bow';
export function heldStyleOf(id: number): HeldStyle {
  const hold = CUSTOM_ITEMS.get(id)?.hold;
  if (hold === 'one_hand') return 'gun1';
  if (hold === 'two_hands') return 'gun2';
  if (id === ITEM_BOW) return 'bow';
  const t = TOOLS[id];
  if (t) return t.kind === 'sword' ? 'sword' : 'tool';
  if (blockFaces(id)) return 'block';
  return 'item';
}
// scale: size in blocks; rot: how the flat sprite is turned onto the arm; grip: the spot on the
// sprite (-0.5..0.5, up and right positive) that sits in the hand
const HELD_LOOK: Record<HeldStyle, { scale: number; rot: [number, number, number]; grip: [number, number] }> = {
  tool: { scale: 0.7, rot: [0, Math.PI / 2, 0], grip: [-0.36, -0.36] },
  sword: { scale: 0.8, rot: [0, Math.PI / 2, 0], grip: [-0.36, -0.36] },
  item: { scale: 0.46, rot: [0, Math.PI / 2, 0], grip: [-0.2, -0.2] },
  block: { scale: 0.26, rot: [0, Math.PI / 4, 0], grip: [0, 0] },
  gun1: { scale: 0.66, rot: [0, Math.PI / 2, -Math.PI / 2], grip: [-0.16, -0.2] },
  gun2: { scale: 0.88, rot: [0, Math.PI / 2, -Math.PI / 2], grip: [-0.12, -0.2] },
  bow: { scale: 0.78, rot: [Math.PI, Math.PI / 2, -Math.PI / 4], grip: [0, 0] },
};

/** Put the item in a model's hand (the right hand, or the left for a bow). Cheap to call every frame. */
function holdOnModel(model: MobModel, id: number | null) {
  const ud = model.root.userData as { heldId?: number | null; heldMesh?: THREE.Mesh | null; heldStyle?: HeldStyle | null };
  if (ud.heldId === id) return;
  if (ud.heldMesh) { ud.heldMesh.parent?.remove(ud.heldMesh); disposeObject(ud.heldMesh); }
  ud.heldMesh = null;
  ud.heldStyle = null;
  ud.heldId = id;
  if (id === null || id === 0) return;
  const m = makeItemMesh(id, false);
  if (!m) return;
  const style = heldStyleOf(id);
  const look = HELD_LOOK[style];
  const arm = style === 'bow' ? model.arms[0] : model.arms[1];
  if (!arm) { disposeObject(m); return; }
  const rot = new THREE.Euler(look.rot[0], look.rot[1], look.rot[2]);
  const hand = new THREE.Vector3(0, -10 / 16, 0); // a model unit is 1/16 of a block
  const grip = new THREE.Vector3(look.grip[0], look.grip[1], 0).multiplyScalar(look.scale).applyEuler(rot);
  m.scale.setScalar(look.scale);
  m.rotation.copy(rot);
  m.position.copy(hand).sub(grip);
  arm.add(m);
  ud.heldMesh = m;
  ud.heldStyle = style;
}

/** The off-hand item in a model's left hand (mirrored). */
function holdOffhandOnModel(model: MobModel, id: number | null) {
  const ud = model.root.userData as { offId?: number | null; offMesh?: THREE.Mesh | null };
  if (ud.offId === id) return;
  if (ud.offMesh) { ud.offMesh.parent?.remove(ud.offMesh); disposeObject(ud.offMesh); }
  ud.offMesh = null;
  ud.offId = id;
  const arm = model.arms[0];
  if (id === null || id === 0 || !arm) return;
  const m = makeItemMesh(id, false);
  if (!m) return;
  const look = HELD_LOOK[blockFaces(id) ? 'block' : 'item'];
  const rot = new THREE.Euler(look.rot[0], look.rot[1], look.rot[2]);
  const grip = new THREE.Vector3(look.grip[0], look.grip[1], 0).multiplyScalar(look.scale).applyEuler(rot);
  m.scale.set(-look.scale, look.scale, look.scale); // mirror image for the left hand
  m.rotation.copy(rot);
  m.position.set(grip.x, -10 / 16 - grip.y, -grip.z);
  arm.add(m);
  ud.offMesh = m;
}

/** Arms for whatever is held. pitch: where the player looks; punch: 0..1 swing bump; kick: gun recoil. */
function poseArms(model: MobModel, o: { swing: number; punch: number; slash?: number; pitch: number; aiming: boolean; drawing: boolean; kick: number; blocking?: boolean }) {
  const [L, R] = model.arms;
  if (!L || !R) return;
  const style = (model.root.userData as { heldStyle?: HeldStyle | null }).heldStyle ?? null;
  const s = o.swing, up = Math.PI / 2 + o.pitch * 0.92 - o.kick * 0.22; // pointing where you look
  L.rotation.set(-s, 0, 0);
  R.rotation.set(s + o.punch * 1.2, 0, 0);
  // A slash starts with the arm raised and sweeps down (slash goes 0 -> 1 over the swing)
  const wind = o.slash !== undefined && o.slash >= 0 ? 1.25 * (1 - o.slash) ** 2 : 0;
  if (style === 'tool') {
    R.rotation.set(0.32 + s * 0.15 + wind, 0, 0);
  } else if (style === 'item') {
    R.rotation.set(0.5 + s * 0.15 + o.punch * 0.9, 0, 0);
  } else if (style === 'sword') {
    if (o.blocking) R.rotation.set(1.15, 0, -0.75); // sword held across the body
    else R.rotation.set(0.4 + s * 0.15 + wind, 0, 0);
  } else if (style === 'block') {
    R.rotation.set(0.4 + s * 0.2 + o.punch * 1.0, 0, -0.1);
  } else if (style === 'gun1') {
    R.rotation.set(up, 0, o.aiming ? -0.16 : -0.06);
    L.rotation.set(-s * 0.3, 0, 0.05);
  } else if (style === 'gun2') {
    R.rotation.set(up, 0, o.aiming ? -0.62 : -0.5);
    L.rotation.set(up - 0.14, 0, o.aiming ? 0.66 : 0.54);
  }
  // Something in the off-hand: carry it a little forward (unless both hands are busy)
  if ((model.root.userData as { offMesh?: THREE.Mesh | null }).offMesh && style !== 'gun2' && style !== 'bow') L.rotation.set(0.42 - s * 0.15, 0, 0.04);
  if (style === 'bow') {
    L.rotation.set(up, 0, 0.08);
    if (o.drawing) R.rotation.set(up - 0.2, 0, -0.95);
    else R.rotation.set(s, 0, 0);
  }
}

function matIndexFor(block: number, f: number): number {
  const top = f === 2, bottom = f === 3;
  switch (block) {
    case BLOCK_GRASS: return top ? 1 : bottom ? 2 : 8;
    case BLOCK_DIRT: return 0;
    case BLOCK_STONE: return 3;
    case BLOCK_SAND: return 4;
    case BLOCK_WOOD: return top || bottom ? 15 : 5;
    case BLOCK_LEAVES: return 6;
    case BLOCK_CRAFTING_TABLE: return 7;
    case BLOCK_BEDROCK: return 9;
    case BLOCK_COAL_ORE: return 10;
    case BLOCK_IRON_ORE: return 11;
    case BLOCK_GOLD_ORE: return 12;
    case BLOCK_DIAMOND_ORE: return 13;
    case BLOCK_EMERALD_ORE: return 14;
    case BLOCK_SNOW: return 16;
    case BLOCK_TALL_GRASS: return 17;
    case BLOCK_OBSIDIAN: return 18;
    case BLOCK_CHEST: return top || bottom ? 19 : 20;
    case ITEM_PLANKS: return 21;
    case BLOCK_NETHERRACK: return 30;
    case BLOCK_SOUL_SAND: return 31;
    case BLOCK_GLOWSTONE: return 32;
    case BLOCK_QUARTZ_ORE: return 33;
    case BLOCK_NETHER_PORTAL: return 34;
    case BLOCK_FARMLAND: return top ? 35 : 0;
    case BLOCK_FURNACE: return top || bottom ? 40 : 39;
    case BLOCK_GLASS: case BLOCK_GLASS_PANE: return 41;
    case BLOCK_INFERNIUM_ORE: return 44;
    default:
      if (isDoorBottom(block)) return 42;
      if (block === BLOCK_DOOR_TOP || block === BLOCK_DOOR_TOP_OPEN) return 43;
      if (isConcrete(block)) return block - 11; // concrete 33-40 -> materials 22-29
      return CUSTOM_MAT_INDEX[block] >= 0 ? CUSTOM_MAT_INDEX[block] : 3;
  }
}

class World {
  noise: PerlinNoise;
  biomeNoise: PerlinNoise;
  treeNoise: PerlinNoise;
  mountainNoise: PerlinNoise;
  flat: boolean;
  chunks: Map<string, Chunk> = new Map();

  kind: 'overworld' | 'nether' | 'custom';
  custom: DimensionSpec | null;

  constructor(seed: number = 42, flat = false, kind: 'overworld' | 'nether' | 'custom' = 'overworld', custom: DimensionSpec | null = null) {
    this.flat = flat;
    this.kind = kind;
    this.custom = custom;
    this.noise = new PerlinNoise(seed);
    // Secondary noise layers for biome density and tree placement
    this.biomeNoise = new PerlinNoise(seed + 1000);
    this.treeNoise = new PerlinNoise(seed + 2000);
    this.mountainNoise = new PerlinNoise(seed + 3000);
  }

  key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.key(cx, cz));
  }

  // Set a block at world coordinates, injecting into the correct chunk.
  // If the target chunk isn't generated yet, create it so tree leaves
  // that cross chunk boundaries don't get lost.
  setWorldBlock(wx: number, wy: number, wz: number, v: number) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const k = this.key(cx, cz);
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(k, chunk);
    }
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    chunk.set(lx, wy, lz, v);
  }

  // Biomes use very low-frequency noise so each one spans hundreds of
  // blocks, instead of switching type every few chunks.
  getBiome(wx: number, wz: number): Biome {
    if (this.kind !== 'overworld') return this.kind;
    if (this.flat) return 'plains';
    if (this.oceanFactor(wx, wz) > 0.3 && this.terrainHeight(wx, wz) <= WATER_LEVEL - 2) return 'ocean';
    const temp = this.biomeNoise.fbm(wx, 0, wz, 2, 0.5, 0.0017);
    const moist = this.treeNoise.fbm(wx, 100, wz, 2, 0.5, 0.0017);
    const mount = this.mountainNoise.fbm(wx, 0, wz, 2, 0.5, 0.003);
    if (mount > 0.22) return 'mountains';
    if (temp > 0.12 && moist < 0.08) return 'desert';
    if (temp < -0.18) return 'snowy';
    if (moist > 0.08) return 'forest';
    return 'plains';
  }

  // 0..1, blended smoothly so terrain height never jumps at a biome border
  mountainFactor(wx: number, wz: number): number {
    const m = this.mountainNoise.fbm(wx, 0, wz, 2, 0.5, 0.003);
    const t = Math.min(1, Math.max(0, (m - 0.1) / 0.25));
    return t * t * (3 - 2 * t);
  }

  terrainHeight(wx: number, wz: number): number {
    const n = this.noise.fbm(wx, 0, wz, 4, 0.5, 0.012);
    const m = this.mountainFactor(wx, wz);
    const ridge = this.noise.fbm(wx, 50, wz, 3, 0.5, 0.02);
    const o = this.oceanFactor(wx, wz);
    const h = SEA_LEVEL + 12 + n * (12 + m * 16) + m * (10 + Math.abs(ridge) * 14) - o * 24;
    return Math.max(4, Math.min(CHUNK_HEIGHT - 10, Math.floor(h)));
  }

  // 0..1: how far into an ocean this spot is (very low-frequency, so oceans are big)
  oceanFactor(wx: number, wz: number): number {
    const c = this.biomeNoise.fbm(wx, 300, wz, 2, 0.5, 0.0013);
    const t = Math.min(1, Math.max(0, (-c - 0.06) / 0.18));
    return t * t * (3 - 2 * t);
  }

  // ---- Inland lakes: at most one per 64x64 area, only on flat ground ----
  private lakeCache = new Map<string, { cx: number; cz: number; r: number; surface: number } | null>();

  lakeInCell(gx: number, gz: number): { cx: number; cz: number; r: number; surface: number } | null {
    const key = `${gx},${gz}`;
    const cached = this.lakeCache.get(key);
    if (cached !== undefined) return cached;
    let lake: { cx: number; cz: number; r: number; surface: number } | null = null;
    if (!this.flat && this.hash3(gx, 0, gz, 41) < 0.45) {
      const r = 4 + Math.floor(this.hash3(gx, 1, gz, 43) * 6); // radius 4-9
      const cx = gx * 64 + r + 2 + Math.floor(this.hash3(gx, 2, gz, 47) * (60 - 2 * r));
      const cz = gz * 64 + r + 2 + Math.floor(this.hash3(gx, 3, gz, 53) * (60 - 2 * r));
      const biome = this.getBiome(cx, cz);
      if (biome === 'plains' || biome === 'forest' || biome === 'snowy') {
        const surface = this.terrainHeight(cx, cz);
        // Only where the ground all around is level, so the water can't spill out
        let ok = surface > WATER_LEVEL + 2 && surface < CHUNK_HEIGHT - 12;
        for (let a = 0; a < 16 && ok; a++) {
          const ang = (a / 16) * Math.PI * 2;
          const h = this.terrainHeight(Math.round(cx + Math.cos(ang) * (r + 1)), Math.round(cz + Math.sin(ang) * (r + 1)));
          if (h < surface || h > surface + 3) ok = false;
        }
        if (ok) lake = { cx, cz, r, surface };
      }
    }
    this.lakeCache.set(key, lake);
    return lake;
  }

  /** If this column is in a lake: where its bed is and where the water surface is. */
  lakeAt(wx: number, wz: number): { bottom: number; surface: number } | null {
    const lake = this.lakeInCell(Math.floor(wx / 64), Math.floor(wz / 64));
    if (!lake) return null;
    const d = Math.hypot(wx - lake.cx, wz - lake.cz) / lake.r;
    if (d >= 1) return null;
    const depth = Math.max(1, Math.round((1 - d * d) * 4)); // deepest in the middle
    return { bottom: lake.surface - depth, surface: lake.surface };
  }

  /** True when this column is dry land (used to avoid spawning players in the sea). */
  isDryLand(wx: number, wz: number): boolean {
    return this.flat || (this.terrainHeight(wx, wz) > WATER_LEVEL + 1 && !this.lakeAt(wx, wz));
  }

  // Deterministic 0..1 pseudo-random value from integer coordinates
  hashCoord(wx: number, wz: number): number {
    let h = (wx * 374761393 + wz * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16)) | 0;
    return ((h >>> 0) % 100000) / 100000;
  }

  // 3D version with a salt, so separate rolls (ore type, vein shape) don't correlate
  hash3(x: number, y: number, z: number, salt: number): number {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(salt, 144269504)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) | 0;
    return ((h >>> 0) % 100000) / 100000;
  }

  // Ores come in veins: the ore type is picked per 3x3x3 cell, then about
  // half the blocks in that cell become ore. Rarer ores only appear deeper.
  oreAt(wx: number, y: number, wz: number, biome: Biome): number {
    if (this.hash3(wx, y, wz, 7) >= 0.45) return BLOCK_STONE;
    const cx = Math.floor(wx / 3), cy = Math.floor(y / 3), cz = Math.floor(wz / 3);
    if (y < 12 && this.hash3(cx, cy, cz, 11) < 0.004) return BLOCK_DIAMOND_ORE;
    if (biome === 'mountains' && y < 30 && this.hash3(cx, cy, cz, 13) < 0.002) return BLOCK_EMERALD_ORE;
    if (y < 22 && this.hash3(cx, cy, cz, 17) < 0.005) return BLOCK_GOLD_ORE;
    if (y < 40 && this.hash3(cx, cy, cz, 19) < 0.016) return BLOCK_IRON_ORE;
    if (y < 54 && this.hash3(cx, cy, cz, 23) < 0.035) return BLOCK_COAL_ORE;
    return BLOCK_STONE;
  }

  // Forests are dense; everywhere else trees are rare and spread out.
  treeSettings(biome: Biome): { chance: number; spacing: number } {
    switch (biome) {
      case 'forest': return { chance: 0.07, spacing: 3 };
      case 'plains': return { chance: 0.0035, spacing: 7 };
      case 'snowy': return { chance: 0.006, spacing: 6 };
      case 'mountains': return { chance: 0.004, spacing: 6 };
      default: return { chance: 0, spacing: 0 }; // desert: no trees
    }
  }

  // A column is a tree candidate based only on noise + hashing of its coordinates
  treeCandidate(wx: number, wz: number): { h: number; roll: number; spacing: number } | null {
    const roll = this.hashCoord(wx, wz);
    if (roll >= 0.07) return null; // 0.07 = the highest chance of any biome
    const biome = this.getBiome(wx, wz);
    const { chance, spacing } = this.treeSettings(biome);
    if (roll >= chance) return null;
    const h = this.terrainHeight(wx, wz);
    if (h <= SEA_LEVEL + 1 || h + 8 >= CHUNK_HEIGHT) return null; // beach sand / too high
    if (biome === 'mountains' && h >= 45) return null; // bare stone and snow peaks
    if (this.lakeAt(wx, wz)) return null; // no trees growing out of lakes
    return { h, roll, spacing };
  }

  // Among nearby candidates, only the one with the lowest roll grows a tree
  treeWins(wx: number, wz: number, c: { roll: number; spacing: number }): boolean {
    for (let dx = -c.spacing; dx <= c.spacing; dx++) {
      for (let dz = -c.spacing; dz <= c.spacing; dz++) {
        if (dx === 0 && dz === 0) continue;
        const o = this.treeCandidate(wx + dx, wz + dz);
        if (!o) continue;
        if (o.roll < c.roll || (o.roll === c.roll && (dx < 0 || (dx === 0 && dz < 0)))) return false;
      }
    }
    return true;
  }

  // Place a tree at world coordinates (wx, surfaceY, wz) using the
  // TREE_BLUEPRINT. Blocks that cross chunk boundaries are injected
  // into neighboring chunks via setWorldBlock.
  /**
   * Draws one tree, but only the part that falls inside `chunk`. A chunk never
   * writes into its neighbours: instead every chunk also looks at the trees
   * just outside its edge (see generateChunk), so a canopy that crosses a chunk
   * border comes out identical whichever side loads first.
   */
  placeTree(wx: number, surfaceY: number, wz: number, chunk: Chunk) {
    const baseX = chunk.cx * CHUNK_SIZE, baseZ = chunk.cz * CHUNK_SIZE;
    for (const [dx, dy, dz, blockType] of TREE_BLUEPRINT) {
      const by = surfaceY + 1 + dy;
      if (by < 0 || by >= CHUNK_HEIGHT) continue;
      const lx = wx + dx - baseX, lz = wz + dz - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
      if (blockType === BLOCK_LEAVES) {
        // leaves never overwrite real terrain or a trunk
        const existing = chunk.get(lx, by, lz);
        if (existing !== BLOCK_AIR && existing !== BLOCK_LEAVES && existing !== BLOCK_TALL_GRASS) continue;
      }
      chunk.set(lx, by, lz, blockType);
    }
  }

  generateChunk(chunk: Chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    if (this.kind === 'nether') {
      this.generateCaverns(chunk, BLOCK_NETHERRACK, BLOCK_NETHERRACK, BLOCK_LAVA, true);
      chunk.generated = true;
      return;
    }
    if (this.kind === 'custom' && this.custom) {
      this.generateCustom(chunk, this.custom);
      chunk.generated = true;
      return;
    }

    if (this.flat) {
      // Superflat: 2 bedrock, 2 dirt, 1 grass — no caves, ores or trees
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          chunk.set(x, 0, z, BLOCK_BEDROCK);
          chunk.set(x, 1, z, BLOCK_BEDROCK);
          chunk.set(x, 2, z, BLOCK_DIRT);
          chunk.set(x, 3, z, BLOCK_DIRT);
          chunk.set(x, 4, z, BLOCK_GRASS);
        }
      }
      chunk.generated = true;
      return;
    }

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        let height = this.terrainHeight(wx, wz);
        const biome = this.getBiome(wx, wz);
        const lake = biome === 'ocean' ? null : this.lakeAt(wx, wz);
        if (lake) height = Math.min(height, lake.bottom);

        let top: number, filler: number;
        if (lake) { top = BLOCK_SAND; filler = BLOCK_DIRT; } // lake bed
        else if (height <= WATER_LEVEL + 1) { top = BLOCK_SAND; filler = BLOCK_SAND; } // beaches and sea floor
        else if (biome === 'desert') { top = BLOCK_SAND; filler = BLOCK_SAND; }
        else if (biome === 'snowy') { top = BLOCK_SNOW; filler = BLOCK_DIRT; }
        else if (biome === 'mountains' && height >= 50) { top = BLOCK_SNOW; filler = BLOCK_STONE; }
        else if (biome === 'mountains' && height >= 45) { top = BLOCK_STONE; filler = BLOCK_STONE; }
        else { top = BLOCK_GRASS; filler = BLOCK_DIRT; }

        for (let y = 0; y <= height; y++) {
          let b: number;
          if (y <= 1) {
            b = BLOCK_BEDROCK; // two solid unbreakable layers at the bottom
          } else if (y === height) {
            b = top;
          } else if (y >= height - 3) {
            b = filler;
          } else {
            const caveNoise = this.noise.noise3d(wx * 0.05, y * 0.08, wz * 0.05);
            if (caveNoise > 0.45 && y > 3) {
              if (y <= LAVA_LEVEL) chunk.set(x, y, z, BLOCK_LAVA); // deep caves hold lava lakes
              continue; // otherwise leave as air
            }
            b = this.oreAt(wx, y, wz, biome);
          }
          chunk.set(x, y, z, b);
        }
        // Oceans and lakes: still water up to sea level
        for (let y = height + 1; y <= WATER_LEVEL; y++) chunk.set(x, y, z, BLOCK_WATER);
        if (lake) for (let y = height + 1; y <= lake.surface; y++) chunk.set(x, y, z, BLOCK_WATER);
      }
    }

    // Decoration pass: trees. Whether a column gets a tree is decided purely
    // from the seed (never from blocks already placed), so every player
    // gets identical forests no matter which chunks load first.
    // The scan reaches 2 blocks past each edge (a canopy is 5 wide) so trees
    // standing in the next chunk still drop their leaves in here.
    for (let x = -2; x < CHUNK_SIZE + 2; x++) {
      for (let z = -2; z < CHUNK_SIZE + 2; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const c = this.treeCandidate(wx, wz);
        if (!c || !this.treeWins(wx, wz, c)) continue;
        this.placeTree(wx, c.h, wz, chunk);
      }
    }

    // Tall grass on open grass blocks (after trees, so trunks always win)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const h = this.terrainHeight(wx, wz);
        if (h + 1 >= CHUNK_HEIGHT || chunk.get(x, h, z) !== BLOCK_GRASS || chunk.get(x, h + 1, z) !== BLOCK_AIR) continue;
        const biome = this.getBiome(wx, wz);
        const density = biome === 'plains' ? 0.2 : biome === 'forest' ? 0.12 : biome === 'mountains' ? 0.08 : 0;
        if (this.hash3(wx, 7, wz, 31) < density) chunk.set(x, h + 1, z, BLOCK_TALL_GRASS);
      }
    }

    // Villages go last, so they level the ground and clear any trees in their way
    this.placeVillage(chunk);

    chunk.generated = true;
  }

  // ---------------- Villages ----------------
  // Everything about a village is worked out from the seed alone (never from
  // blocks that happen to be placed already), so every player sees the exact
  // same villages whichever chunks load first, just like the trees.
  private villageCache = new Map<string, Village | null>();

  villageInRegion(rx: number, rz: number): Village | null {
    if (this.flat || this.kind !== 'overworld') return null;
    const key = `${rx},${rz}`;
    const cached = this.villageCache.get(key);
    if (cached !== undefined) return cached;
    let v: Village | null = null;
    if (this.hash3(rx, 5, rz, 91) < VILLAGE_CHANCE) {
      // keep the whole village (it reaches about 33 blocks out) inside its own area
      const cx = rx * VILLAGE_REGION + 44 + Math.floor(this.hash3(rx, 6, rz, 92) * (VILLAGE_REGION - 88));
      const cz = rz * VILLAGE_REGION + 44 + Math.floor(this.hash3(rx, 7, rz, 93) * (VILLAGE_REGION - 88));
      v = this.planVillage(cx, cz, key);
    }
    this.villageCache.set(key, v);
    return v;
  }

  /** The closest village to a spot, searching outward ring by ring. */
  findVillage(wx: number, wz: number, maxRings = 14): { village: Village; distance: number } | null {
    const rx0 = Math.floor(wx / VILLAGE_REGION), rz0 = Math.floor(wz / VILLAGE_REGION);
    let best = null as { village: Village; distance: number } | null;
    for (let r = 0; r <= maxRings; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const village = this.villageInRegion(rx0 + dx, rz0 + dz);
          if (!village) continue;
          const distance = Math.hypot(village.cx - wx, village.cz - wz);
          if (!best || distance < best.distance) best = { village, distance };
        }
      }
      if (best && best.distance <= r * VILLAGE_REGION) break; // nothing in a farther ring can beat it
    }
    return best;
  }

  private planVillage(cx: number, cz: number, id: string): Village | null {
    const friendly = (b: Biome) => b === 'plains' || b === 'desert' || b === 'snowy';
    const biome = this.getBiome(cx, cz);
    if (!friendly(biome)) return null;
    // The whole site must be one friendly biome, dry land with no lake, and fairly flat
    const heights: number[] = [];
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -2; gz <= 2; gz++) {
        const x = cx + gx * 12, z = cz + gz * 12;
        if (!friendly(this.getBiome(x, z)) || this.lakeAt(x, z)) return null;
        const h = this.terrainHeight(x, z);
        if (h <= WATER_LEVEL + 1) return null;
        heights.push(h);
      }
    }
    heights.sort((a, b) => a - b);
    if (heights[heights.length - 1] - heights[0] > 8) return null;
    const baseY = heights[12]; // the median
    const th = (x: number, z: number) => this.terrainHeight(x, z);
    const pal = biome === 'desert'
      ? { wall: BLOCK_CONCRETE_WHITE, corner: BLOCK_WOOD, roof: ITEM_PLANKS, roofTop: ITEM_PLANKS }
      : biome === 'snowy'
        ? { wall: ITEM_PLANKS, corner: BLOCK_WOOD, roof: ITEM_PLANKS, roofTop: BLOCK_SNOW }
        : { wall: ITEM_PLANKS, corner: BLOCK_WOOD, roof: ITEM_PLANKS, roofTop: ITEM_PLANKS };
    const pieces: VillagePiece[] = [];
    const homes: Array<[number, number, number]> = [];
    const houses: Array<{ x: number; z: number; y0: number; w: number; d: number; face: number }> = [];

    // Dirt paths: clears trees and grass above them too
    const path = (x0: number, z0: number, x1: number, z1: number): VillagePiece => ({
      kind: 'road', x0, z0, x1, z1,
      build: (set) => {
        for (let x = x0; x <= x1; x++) {
          for (let z = z0; z <= z1; z++) {
            if (this.lakeAt(x, z)) continue;
            const h = th(x, z);
            set(x, h, z, BLOCK_DIRT);
            for (let y = h + 1; y <= h + 6; y++) set(x, y, z, BLOCK_AIR);
          }
        }
      },
    });
    pieces.push(path(cx - 32, cz - 1, cx + 32, cz + 1));
    pieces.push(path(cx - 1, cz - 32, cx + 1, cz + 32));
    pieces.push(path(cx - 4, cz - 4, cx + 4, cz + 4)); // the square around the well

    // House sites: along both roads, a few blocks off, each door facing the road
    const FACE = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // south, west, north, east
    type Site = { x: number; z: number; face: number };
    const sites: Site[] = [];
    for (const t of [-24, -16, -8, 8, 16, 24]) for (const sd of [-1, 1]) sites.push({ x: cx + t, z: cz + sd * 8, face: sd === 1 ? 2 : 0 });
    for (const t of [-24, -16, 16, 24]) for (const sd of [-1, 1]) sites.push({ x: cx + sd * 8, z: cz + t, face: sd === 1 ? 1 : 3 });
    const order = sites.map((site, i) => ({ site, k: this.hash3(cx, i, cz, 94) })).sort((a, b) => a.k - b.k);
    const want = 5 + Math.floor(this.hash3(cx, 0, cz, 95) * 4); // 5 to 8 houses
    let built = 0;
    for (const { site } of order) {
      if (built >= want) break;
      const roll = this.hash3(site.x, 2, site.z, 97); // size: 45% small (5x5), 35% wide (7x5), 20% big (7x7)
      const w = roll < 0.45 ? 5 : 7;
      const d = roll < 0.8 ? 5 : 7;
      const D = FACE[site.face];
      const alongX = D[0] === 0; // the door faces north/south, so the width runs east-west
      const hx = alongX ? (w - 1) / 2 : (d - 1) / 2, hz = alongX ? (d - 1) / 2 : (w - 1) / 2;
      // the ground under it must be dry and close to the village's level
      const samples = [[0, 0], [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].map(([ox, oz]) => [site.x + ox, site.z + oz]);
      if (samples.some(([x, z]) => this.lakeAt(x, z) || th(x, z) <= WATER_LEVEL + 1)) continue;
      const hs = samples.map(([x, z]) => th(x, z)).sort((a, b) => a - b);
      const y0 = hs[2];
      if (Math.abs(y0 - baseY) > 4) continue;
      built++;
      const hu = (w - 1) / 2, hv = (d - 1) / 2;
      const S = [D[1], -D[0]];
      const pos = (u: number, v: number): [number, number] => [site.x + S[0] * (u - hu) - D[0] * (v - hv), site.z + S[1] * (u - hu) - D[1] * (v - hv)];
      const stub = 6 - hv; // path from the door to the road
      const reach = Math.max(hx, hz) + 1;
      const ex = D[0] * (stub + hv + 1), ez = D[1] * (stub + hv + 1);
      const table = this.hash3(site.x, 3, site.z, 96) < 0.5;
      // The path from the door to the road is a ramp: never more than 1 block up or down per step,
      // and never higher than the doorstep, so you can always walk in and out
      const stepY: number[] = [];
      let prevY = y0;
      for (let k2 = 1; k2 <= stub; k2++) {
        const [x, z] = pos(hu, -k2);
        const lo = k2 === 1 ? y0 - 1 : prevY - 1, hi = k2 === 1 ? y0 : prevY + 1;
        prevY = Math.max(lo, Math.min(hi, th(x, z)));
        stepY.push(prevY);
      }
      pieces.push({
        kind: 'house',
        x0: Math.min(site.x - reach, site.x + ex), x1: Math.max(site.x + reach, site.x + ex),
        z0: Math.min(site.z - reach, site.z + ez), z1: Math.max(site.z + reach, site.z + ez),
        build: (set) => {
          for (let u = -1; u <= w; u++) {
            for (let v = -1; v <= d; v++) {
              const [x, z] = pos(u, v);
              for (let y = y0 + 1; y <= y0 + 9; y++) set(x, y, z, BLOCK_AIR); // clear trees, grass and leaves
              if (u < 0 || u >= w || v < 0 || v >= d) continue;
              for (let y = th(x, z) + 1; y < y0; y++) set(x, y, z, BLOCK_STONE); // foundation
              set(x, y0, z, ITEM_PLANKS); // floor
            }
          }
          for (let u = 0; u < w; u++) {
            for (let v = 0; v < d; v++) {
              if (!(u === 0 || u === w - 1 || v === 0 || v === d - 1)) continue;
              const corner = (u === 0 || u === w - 1) && (v === 0 || v === d - 1);
              const [x, z] = pos(u, v);
              for (let h = 1; h <= 3; h++) {
                let b = corner ? pal.corner : pal.wall;
                if (!corner) {
                  const door = v === 0 && u === hu && h <= 2;
                  const frontWindow = v === 0 && (u === 1 || u === w - 2) && u !== hu && h === 2;
                  const sideWindow = (u === 0 || u === w - 1) && v === hv && h === 2;
                  const backWindow = v === d - 1 && u === hu && h === 2;
                  if (door || frontWindow || sideWindow || backWindow) b = BLOCK_AIR;
                }
                set(x, y0 + h, z, b);
              }
            }
          }
          // a stepped roof that overhangs the walls
          for (let u = -1; u <= w; u++) for (let v = -1; v <= d; v++) { const [x, z] = pos(u, v); set(x, y0 + 4, z, pal.roof); }
          for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) { const [x, z] = pos(u, v); set(x, y0 + 5, z, pal.roof); }
          for (let u = 1; u < w - 1; u++) for (let v = 1; v < d - 1; v++) { const [x, z] = pos(u, v); set(x, y0 + 6, z, pal.roofTop); }
          const [lx, lz] = pos(hu, hv);
          set(lx, y0 + 4, lz, BLOCK_GLOWSTONE); // a lamp in the ceiling
          if (table) { const [tx, tz] = pos(1, d - 2); set(tx, y0 + 1, tz, BLOCK_CRAFTING_TABLE); }
          for (let k2 = 1; k2 <= stub; k2++) { // the path to the road
            const [x, z] = pos(hu, -k2);
            const h = stepY[k2 - 1], ground = th(x, z);
            for (let y = ground + 1; y <= h; y++) set(x, y, z, BLOCK_DIRT); // raise low ground
            set(x, h, z, BLOCK_DIRT);
            for (let y = h + 1; y <= Math.max(h, ground) + 6; y++) set(x, y, z, BLOCK_AIR); // dig out high ground, clear above
          }
        },
      });
      const [dx, dz] = pos(hu, -1);
      homes.push([dx + 0.5, stepY[0] + 1, dz + 0.5]);
      houses.push({ x: site.x, z: site.z, y0, w, d, face: site.face });
    }
    if (built < 4) return null; // too cramped or too hilly to be a village

    // The well in the middle: a stone rim, water, four posts and a little roof
    const wellY = th(cx, cz);
    pieces.push({
      kind: 'well', x0: cx - 2, z0: cz - 2, x1: cx + 2, z1: cz + 2,
      build: (set) => {
        for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) for (let y = wellY + 1; y <= wellY + 6; y++) set(x, y, z, BLOCK_AIR);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const x = cx + dx, z = cz + dz;
            set(x, wellY - 4, z, BLOCK_STONE);
            if (dx === 0 && dz === 0) { for (let y = wellY - 3; y <= wellY; y++) set(x, y, z, BLOCK_WATER); continue; }
            for (let y = wellY - 3; y <= wellY + 1; y++) set(x, y, z, BLOCK_STONE);
            if (dx !== 0 && dz !== 0) { set(x, wellY + 2, z, BLOCK_WOOD); set(x, wellY + 3, z, BLOCK_WOOD); }
          }
        }
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(cx + dx, wellY + 4, cz + dz, ITEM_PLANKS);
      },
    });
    // Lamp posts: a log post with glowstone on top
    for (const [lx, lz] of [[cx - 4, cz - 4], [cx + 4, cz - 4], [cx - 4, cz + 4], [cx + 4, cz + 4], [cx - 14, cz + 2], [cx + 14, cz - 2], [cx + 2, cz - 14], [cx - 2, cz + 14]]) {
      pieces.push({
        kind: 'lamp', x0: lx, z0: lz, x1: lx, z1: lz,
        build: (set) => {
          const h = th(lx, lz);
          for (let y = h + 1; y <= h + 3; y++) set(lx, y, lz, BLOCK_WOOD);
          set(lx, h + 4, lz, BLOCK_GLOWSTONE);
        },
      });
    }
    return { id, cx, cz, biome, baseY, wellY, pieces, homes, houses, golemSpawn: [cx + 0.5, th(cx, cz + 3) + 1, cz + 3.5], radius: 40 };
  }

  /** Writes the part of this chunk's village (if it has one) after the terrain and trees are done. */
  private placeVillage(chunk: Chunk) {
    const v = this.villageInRegion(Math.floor(chunk.cx / (VILLAGE_REGION / CHUNK_SIZE)), Math.floor(chunk.cz / (VILLAGE_REGION / CHUNK_SIZE)));
    if (!v) return;
    const bx = chunk.cx * CHUNK_SIZE, bz = chunk.cz * CHUNK_SIZE;
    const set = (x: number, y: number, z: number, b: number) => {
      if (x < bx || x >= bx + CHUNK_SIZE || z < bz || z >= bz + CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      chunk.set(x - bx, y, z - bz, b);
    };
    for (const piece of v.pieces) {
      if (piece.x1 < bx || piece.x0 >= bx + CHUNK_SIZE || piece.z1 < bz || piece.z0 >= bz + CHUNK_SIZE) continue;
      piece.build(set);
    }
  }

  // Nether-style caverns: 3D noise, more solid near the floor and the roof,
  // a sea of liquid at the bottom, bedrock above and below.
  generateCaverns(chunk: Chunk, wall: number, filler: number, liquid: number, nether: boolean) {
    const baseX = chunk.cx * CHUNK_SIZE, baseZ = chunk.cz * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x, wz = baseZ + z;
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let b = BLOCK_AIR;
          if (y <= 1 || y >= CHUNK_HEIGHT - 2) b = BLOCK_BEDROCK;
          else {
            const n = this.noise.noise3d(wx * 0.045, y * 0.07, wz * 0.045) + this.noise.noise3d(wx * 0.11, y * 0.15, wz * 0.11) * 0.35;
            const edge = Math.pow(Math.abs(y - 31) / 31, 2) * 0.9;
            if (n + edge > 0.02) b = wall;
            else if (y <= NETHER_LAVA_LEVEL && liquid) b = liquid;
          }
          if (b !== BLOCK_AIR) chunk.set(x, y, z, b);
        }
        // Decorate: ores, soul sand floors, glowstone hanging from the roof
        for (let y = 2; y < CHUNK_HEIGHT - 2; y++) {
          const b = chunk.get(x, y, z);
          if (b === wall) {
            if (nether && this.hash3(wx, y, wz, 61) < 0.012) chunk.set(x, y, z, BLOCK_QUARTZ_ORE);
            else if (nether && y < 30 && this.hash3(wx, y, wz, 67) < 0.0022) chunk.set(x, y, z, BLOCK_INFERNIUM_ORE); // rare, deep
            else if (nether && chunk.get(x, y + 1, z) === BLOCK_AIR && y < 34 && this.noise.noise3d(wx * 0.06, 7.7, wz * 0.06) > 0.18) chunk.set(x, y, z, BLOCK_SOUL_SAND);
            else if (filler !== wall && chunk.get(x, y + 1, z) === BLOCK_AIR) chunk.set(x, y, z, filler);
          } else if (nether && b === BLOCK_AIR && chunk.get(x, y + 1, z) === wall && y > 30 && this.hash3(wx, y, wz, 67) < 0.03) {
            chunk.set(x, y, z, BLOCK_GLOWSTONE);
            if (chunk.get(x, y - 1, z) === BLOCK_AIR && this.hash3(wx, y, wz, 71) < 0.6) chunk.set(x, y - 1, z, BLOCK_GLOWSTONE);
          }
        }
      }
    }
  }

  generateCustom(chunk: Chunk, sp: DimensionSpec) {
    const baseX = chunk.cx * CHUNK_SIZE, baseZ = chunk.cz * CHUNK_SIZE;
    if (sp.type === 'caves') { this.generateCaverns(chunk, sp.base, sp.top, sp.liquid, false); return; }
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x, wz = baseZ + z;
        if (sp.type === 'flat') {
          chunk.set(x, 0, z, BLOCK_BEDROCK);
          chunk.set(x, 1, z, sp.base);
          chunk.set(x, 2, z, sp.filler);
          chunk.set(x, 3, z, sp.filler);
          chunk.set(x, 4, z, sp.top);
        } else if (sp.type === 'void') {
          if (Math.abs(wx - 8) <= 2 && Math.abs(wz - 8) <= 2) chunk.set(x, 32, z, sp.top); // a small platform to stand on
        } else {
          // Floating islands
          let depth = -1;
          for (let y = CHUNK_HEIGHT - 4; y >= 4; y--) {
            const d = this.noise.noise3d(wx * 0.03, y * 0.05, wz * 0.03) - Math.abs(y - 34) / 26;
            if (d > 0.04) {
              depth++;
              chunk.set(x, y, z, depth === 0 ? sp.top : depth < 4 ? sp.filler : sp.base);
            } else {
              depth = -1;
            }
          }
        }
      }
    }
  }

  // Get surface height from a specific chunk's local coordinates
  getSurfaceHeightLocal(chunk: Chunk, lx: number, lz: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = chunk.get(lx, y, lz);
      if (b !== BLOCK_AIR) return y;
    }
    return -1;
  }

  // Is there a tree trunk within `spacing` blocks? This includes the chunk
  // currently being generated — skipping it (the old behaviour) is what let
  // trees in the same chunk bunch up in tight rows.
  hasNearbyTree(wx: number, wz: number, spacing: number): boolean {
    for (let dx = -spacing; dx <= spacing; dx++) {
      for (let dz = -spacing; dz <= spacing; dz++) {
        if (dx === 0 && dz === 0) continue;
        const bx = wx + dx;
        const bz = wz + dz;
        const cx = Math.floor(bx / CHUNK_SIZE);
        const cz = Math.floor(bz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) continue;
        const lx = bx - cx * CHUNK_SIZE;
        const lz = bz - cz * CHUNK_SIZE;
        for (let y = SEA_LEVEL - 4; y < CHUNK_HEIGHT; y++) {
          if (chunk.get(lx, y, lz) === BLOCK_WOOD) return true;
        }
      }
    }
    return false;
  }

  // ---------------- Fluid mesh ----------------
  // Water and lava get their own mesh so flowing fluid only rebuilds this
  // cheap mesh, never the full terrain. Surface corners are averaged with
  // neighbors, so flowing water slopes smoothly like Minecraft's.
  buildFluidGeometry(chunk: Chunk): THREE.BufferGeometry | null {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], top: number[] = [];
    const buckets: number[][] = [[], []]; // 0 = water, 1 = lava
    const get = (lx: number, ly: number, lz: number): number =>
      lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE ? chunk.get(lx, ly, lz) : this.getWorldBlock(baseX + lx, ly, baseZ + lz);
    const kindOf = (b: number) => (isWater(b) ? 1 : isLava(b) ? 2 : 0);
    const heightOf = (b: number, lx: number, ly: number, lz: number): number => {
      if (kindOf(get(lx, ly + 1, lz)) === kindOf(b)) return 1;
      if (isSourceFluid(b) || isFallFluid(b)) return 0.875;
      const max = isWater(b) ? WATER_MAX : LAVA_MAX;
      return 0.875 * (1 - flowLevel(b) / (max + 1));
    };
    const cornerH = (lx: number, ly: number, lz: number, kind: number, cx: number, cz: number): number => {
      let sum = 0, n = 0;
      for (const ox of [cx - 1, cx]) {
        for (const oz of [cz - 1, cz]) {
          const b = get(lx + ox, ly, lz + oz);
          if (kindOf(b) !== kind) continue;
          const h = heightOf(b, lx + ox, ly, lz + oz);
          if (h >= 1) return 1;
          sum += h;
          n++;
        }
      }
      return n ? sum / n : 0.875;
    };
    const FACES: Array<{ dir: number[]; corners: number[][] }> = [
      { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
      { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
      { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
      { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
      { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
      { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
    ];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const b = chunk.get(x, y, z);
          const k = kindOf(b);
          if (!k) continue;
          const hgt = [
            [cornerH(x, y, z, k, 0, 0), cornerH(x, y, z, k, 0, 1)],
            [cornerH(x, y, z, k, 1, 0), cornerH(x, y, z, k, 1, 1)],
          ];
          const bucket = buckets[k - 1];
          for (let f = 0; f < 6; f++) {
            const { dir, corners } = FACES[f];
            const nb = get(x + dir[0], y + dir[1], z + dir[2]);
            if (kindOf(nb) === k || isOpaque(nb)) continue;
            const v0 = pos.length / 3;
            for (const c of corners) {
              const cy = c[1] === 1 ? hgt[c[0]][c[2]] : 0;
              pos.push(baseX + x + c[0], y + cy, baseZ + z + c[2]);
              nor.push(dir[0], dir[1], dir[2]);
              if (dir[1] !== 0) uv.push((baseX + x + c[0]) / 2, (baseZ + z + c[2]) / 2);
              else uv.push(dir[0] !== 0 ? c[2] : c[0], y + cy);
              top.push(f === 2 ? 1 : 0);
            }
            bucket.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
          }
        }
      }
    }
    if (pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
    const idx: number[] = [];
    buckets.forEach((bk, m) => {
      if (!bk.length) return;
      geo.addGroup(idx.length, bk.length, m);
      for (const i of bk) idx.push(i);
    });
    geo.setIndex(idx);
    return geo;
  }

  // ---------------- Fluid simulation ----------------
  // Only spots that changed are queued, so a calm ocean costs nothing.
  private fluidQueues: [Set<string>, Set<string>] = [new Set(), new Set()]; // water, lava

  // Fluids treat chunks that aren't generated as solid, so they never flow into the unknown
  private fget(x: number, y: number, z: number): number {
    if (y < 0) return BLOCK_BEDROCK;
    if (y >= CHUNK_HEIGHT) return BLOCK_AIR;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const c = this.getChunk(cx, cz);
    if (!c || !c.generated) return BLOCK_STONE;
    return c.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  /** Call after any block changes: wakes up fluids at and around that spot. */
  scheduleAround(x: number, y: number, z: number) {
    const N7 = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of N7) {
      const b = this.fget(x + dx, y + dy, z + dz);
      if (isWater(b)) this.fluidQueues[0].add(`${x + dx},${y + dy},${z + dz}`);
      else if (isLava(b)) this.fluidQueues[1].add(`${x + dx},${y + dy},${z + dz}`);
    }
  }

  pendingFluidUpdates(kind: 0 | 1): number {
    return this.fluidQueues[kind].size;
  }

  /** One fluid "tick". Returns every change as [x, y, z, oldBlock, newBlock]. */
  tickFluids(kind: 0 | 1, budget: number): Array<[number, number, number, number, number]> {
    const q = this.fluidQueues[kind];
    if (q.size === 0) return [];
    const batch: string[] = [];
    for (const k of q) { batch.push(k); if (batch.length >= budget) break; }
    for (const k of batch) q.delete(k);

    const changes: Array<[number, number, number, number, number]> = [];
    const set = (x: number, y: number, z: number, b: number) => {
      const old = this.fget(x, y, z);
      if (old === b) return;
      this.setWorldBlock(x, y, z, b);
      changes.push([x, y, z, old, b]);
      this.scheduleAround(x, y, z);
    };
    const same = kind === 0 ? isWater : isLava;
    const other = kind === 0 ? isLava : isWater;
    const src = kind === 0 ? BLOCK_WATER : BLOCK_LAVA;
    const fall = kind === 0 ? BLOCK_WATER_FALL : BLOCK_LAVA_FALL;
    const max = kind === 0 ? WATER_MAX : LAVA_MAX;
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

    for (const key of batch) {
      const [x, y, z] = key.split(',').map(Number);
      let b = this.fget(x, y, z);
      if (!same(b)) continue;

      // Lava touching water hardens: still lava -> obsidian, flowing lava -> stone
      if (kind === 1 && N6.some(([dx, dy, dz]) => isWater(this.fget(x + dx, y + dy, z + dz)))) {
        set(x, y, z, b === BLOCK_LAVA ? BLOCK_OBSIDIAN : BLOCK_STONE);
        continue;
      }

      // Flowing fluid recomputes its strength from its neighbors (sources never change)
      if (b !== src) {
        let next: number;
        if (same(this.fget(x, y + 1, z))) {
          next = fall;
        } else {
          let best = 99, sources = 0;
          for (const [dx, dz] of N4) {
            const nb = this.fget(x + dx, y, z + dz);
            if (!same(nb)) continue;
            if (nb === src) sources++;
            best = Math.min(best, flowLevel(nb));
          }
          const below = this.fget(x, y - 1, z);
          if (kind === 0 && sources >= 2 && (isSolid(below) || below === src)) next = src; // infinite water, like Minecraft
          else if (best + 1 > max) next = BLOCK_AIR;
          else next = src + best + 1;
        }
        if (next !== b) {
          set(x, y, z, next);
          if (next === BLOCK_AIR) continue;
          b = next;
        }
      }

      // Spread: pour straight down when possible, otherwise sideways
      const below = this.fget(x, y - 1, z);
      if (y > 0 && (below === BLOCK_AIR || below === BLOCK_TALL_GRASS || (same(below) && below !== src && below !== fall))) {
        set(x, y - 1, z, fall);
        continue;
      }
      if (other(below)) { this.scheduleAround(x, y - 1, z); continue; }
      if (!(isSolid(below) || below === src)) continue;
      const myL = flowLevel(b);
      if (myL >= max) continue;
      for (const [dx, dz] of N4) {
        const nx = x + dx, nz = z + dz;
        const nb = this.fget(nx, y, nz);
        if (nb === BLOCK_AIR || nb === BLOCK_TALL_GRASS || (same(nb) && nb !== src && nb !== fall && flowLevel(nb) > myL + 1)) {
          set(nx, y, nz, src + myL + 1);
        } else if (other(nb)) {
          this.scheduleAround(nx, y, nz); // let the lava harden
        }
      }
    }
    return changes;
  }

  // Sample a block from world coordinates (may query neighboring chunks)
  getWorldBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BLOCK_AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK_STONE; // no chunk at all → treat as solid
    // Even if not fully generated, the chunk may have tree blocks injected
    // by a neighbor's decoration pass. Check the actual block data.
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return chunk.get(lx, wy, lz);
  }

  // Get the surface height at world coords (for player spawn / collision)
  getSurfaceHeight(wx: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return SEA_LEVEL + 12;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = chunk.get(lx, y, lz);
      if (isSolid(b)) return y; // top solid block (ignores water, lava and plants)
    }
    return 0;
  }

  // Build a merged BufferGeometry for a chunk, culling hidden faces.
  // Boundary faces (local x/z = 0 or 15) are always rendered to prevent
  // see-through gaps between adjacent chunks that haven't been built yet.
  buildChunkGeometry(
    chunk: Chunk,
    grassTex: THREE.Texture,
    dirtTex: THREE.Texture,
    stoneTex: THREE.Texture,
  ): THREE.BufferGeometry | null {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    const FACES = [
      // +X (right) — boundary when local x === CHUNK_SIZE - 1
      { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], texIndex: 0, isBoundary: (lx: number, lz: number) => lx === CHUNK_SIZE - 1 },
      // -X (left) — boundary when local x === 0
      { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], texIndex: 0, isBoundary: (lx: number, lz: number) => lx === 0 },
      // +Y (top)
      { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], texIndex: 1, isBoundary: () => false },
      // -Y (bottom)
      { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], texIndex: 2, isBoundary: () => false },
      // +Z (front) — boundary when local z === CHUNK_SIZE - 1
      { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], texIndex: 0, isBoundary: (lx: number, lz: number) => lz === CHUNK_SIZE - 1 },
      // -Z (back) — boundary when local z === 0
      { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], texIndex: 0, isBoundary: (lx: number, lz: number) => lz === 0 },
    ];

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    // One index list per material, so a chunk is ~17 draw calls instead of
    // one per run of same-material faces (often thousands before).
    const buckets: number[][] = [];

    // Fast lookup: inside this chunk read directly, otherwise ask the world
    const get = (lx: number, ly: number, lz: number): number =>
      lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE
        ? chunk.get(lx, ly, lz)
        : this.getWorldBlock(baseX + lx, ly, baseZ + lz);

    const FACE_SHADE = [0.82, 0.82, 1.0, 0.6, 0.9, 0.9]; // +X,-X,+Y,-Y,+Z,-Z
    const AO_CURVE = [0.5, 0.68, 0.84, 1.0];
    const p = [0, 0, 0], q1 = [0, 0, 0], q2 = [0, 0, 0], q3 = [0, 0, 0];
    const ao = [0, 0, 0, 0];

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const block = chunk.get(x, y, z);
          if (block === BLOCK_AIR || isFluid(block)) continue; // fluids get their own mesh
          if (CROSS_MAT[block] >= 0) {
            // Plants are two crossed quads, like Minecraft's grass
            const cm = CROSS_MAT[block];
            const bucket = buckets[cm] ?? (buckets[cm] = []);
            const px0 = baseX + x, pz0 = baseZ + z;
            const quads = [[0.15, 0.15, 0.85, 0.85], [0.85, 0.15, 0.15, 0.85]];
            for (const [ax, az, ex, ez] of quads) {
              const v0 = positions.length / 3;
              positions.push(px0 + ax, y, pz0 + az, px0 + ex, y, pz0 + ez, px0 + ex, y + 0.9, pz0 + ez, px0 + ax, y + 0.9, pz0 + az);
              for (let k = 0; k < 4; k++) normals.push(0, 1, 0);
              uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
              colors.push(0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 1, 1, 1, 1, 1, 1);
              bucket.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
            }
            continue;
          }

          // Doors and glass panes are thin boxes rather than whole cubes
          const shape = block === BLOCK_GLASS_PANE || isDoor(block) ? shapeBoxes(block, (ddx, ddy, ddz) => get(x + ddx, y + ddy, z + ddz)) : null;
          if (shape) {
            const mi = matIndexFor(block, 0);
            const bucket = buckets[mi] ?? (buckets[mi] = []);
            const ox = baseX + x, oz = baseZ + z;
            for (const [x0, y0, z0, x1, y1, z1] of shape) {
              const X0 = ox + x0, X1 = ox + x1, Y0 = y + y0, Y1 = y + y1, Z0 = oz + z0, Z1 = oz + z1;
              const quads: Array<[number[], number[][], number[]]> = [
                [[1, 0, 0], [[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1]], [1 - z1, y0, 1 - z0, y1]],
                [[-1, 0, 0], [[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0]], [z0, y0, z1, y1]],
                [[0, 1, 0], [[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0]], [x0, 1 - z1, x1, 1 - z0]],
                [[0, -1, 0], [[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], [x0, z0, x1, z1]],
                [[0, 0, 1], [[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], [x0, y0, x1, y1]],
                [[0, 0, -1], [[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0]], [1 - x1, y0, 1 - x0, y1]],
              ];
              quads.forEach(([n, cs, [u0, v0, u1, v1]], fi) => {
                const v = positions.length / 3;
                for (const c of cs) positions.push(c[0], c[1], c[2]);
                for (let k = 0; k < 4; k++) normals.push(n[0], n[1], n[2]);
                uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
                const sh = FACE_SHADE[fi];
                for (let k = 0; k < 4; k++) colors.push(sh, sh, sh);
                bucket.push(v, v + 1, v + 2, v, v + 2, v + 3);
              });
            }
            continue;
          }

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
            const neighbor = get(x + dx, y + dy, z + dz);
            // Leaves have holes, so faces behind them must still be drawn
            // Hide a face only behind opaque blocks (leaves, fluids and plants are see-through)
            if (isOpaque(neighbor) || (neighbor === block && (block === BLOCK_LEAVES || block === BLOCK_NETHER_PORTAL || block === BLOCK_GLASS))) continue;

            const mat = matIndexFor(block, f);
            const bucket = buckets[mat] ?? (buckets[mat] = []);
            const vStart = positions.length / 3;
            const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
            const ua = axis === 0 ? 1 : 0; // first tangent axis
            const va = axis === 2 ? 1 : 2; // second tangent axis

            for (let k = 0; k < 4; k++) {
              const c = face.corners[k];
              positions.push(baseX + x + c[0], y + c[1], baseZ + z + c[2]);
              normals.push(dx, dy, dz);

              // UVs from the corner position keep side textures upright
              // (that's what puts the grass fringe at the top of the block)
              if (axis === 1) uvs.push(c[0], c[2]);
              else if (axis === 0) uvs.push(dx > 0 ? 1 - c[2] : c[2], c[1]);
              else uvs.push(dz > 0 ? c[0] : 1 - c[0], c[1]);

              // Ambient occlusion: check the 3 blocks touching this corner in
              // the layer just in front of the face, like Minecraft's smooth lighting
              p[0] = x + dx; p[1] = y + dy; p[2] = z + dz;
              const su = c[ua] === 1 ? 1 : -1;
              const sv = c[va] === 1 ? 1 : -1;
              q1[0] = p[0]; q1[1] = p[1]; q1[2] = p[2]; q1[ua] += su;
              q2[0] = p[0]; q2[1] = p[1]; q2[2] = p[2]; q2[va] += sv;
              q3[0] = q1[0]; q3[1] = q1[1]; q3[2] = q1[2]; q3[va] += sv;
              const s1 = isOpaque(get(q1[0], q1[1], q1[2])) ? 1 : 0;
              const s2 = isOpaque(get(q2[0], q2[1], q2[2])) ? 1 : 0;
              const cn = isOpaque(get(q3[0], q3[1], q3[2])) ? 1 : 0;
              const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cn);
              ao[k] = level;
              const b = FACE_SHADE[f] * AO_CURVE[level];
              colors.push(b, b, b);
            }

            // Split the quad along the darker diagonal so AO gradients don't streak
            if (ao[0] + ao[2] > ao[1] + ao[3]) {
              bucket.push(vStart + 1, vStart + 2, vStart + 3, vStart + 1, vStart + 3, vStart);
            } else {
              bucket.push(vStart, vStart + 1, vStart + 2, vStart, vStart + 2, vStart + 3);
            }
          }
        }
      }
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const indices: number[] = [];
    buckets.forEach((b, mat) => {
      if (!b || b.length === 0) return;
      geo.addGroup(indices.length, b.length, mat);
      for (let i = 0; i < b.length; i++) indices.push(b[i]);
    });
    geo.setIndex(indices);
    return geo;
  }
}

// ===================================================================
//  Game engine — chunk loading, rendering, player physics
// ===================================================================

export type GameWorldMode = 'survival' | 'creative' | 'adventure';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'max';
/** The mode you're playing in right now (switchable with /gamemode). */
export type PlayMode = GameWorldMode | 'spectator';
export type WorldType = 'default' | 'superflat';

/** Everything needed to put a player back exactly where they left off. */
export type SaveData = {
  v: 1;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; health: number; hunger: number; mode: PlayMode; selected: number; offhand?: ItemStack | null; armor?: Slots };
  dimension?: string;
  editsByDim?: Record<string, Array<[number, number, number, number]>>;
  portals?: Record<string, Array<[number, number, number]>>;
  slots: Slots;
  time: number;
  day: number;
  edits: Array<[number, number, number, number]>;
  chests: Record<string, Slots>;
  furnaces?: Record<string, { slots: Slots; burn: number; burnMax: number; cook: number }>;
};

export type DebugInfo = {
  x: number; y: number; z: number;
  blockX: number; blockY: number; blockZ: number;
  chunkX: number; chunkZ: number;
  facing: string; yaw: number; pitch: number;
  biome: string; dimension: string; mode: PlayMode; flying: boolean;
  loadedChunks: number; renderDistance: number; graphics: GraphicsQuality; fps: number;
  target: { name: string; x: number; y: number; z: number } | null;
  mobs: number;
  camera: string;
  seed: number;
  clock: string;
  night: boolean;
};

export type ProjectileSpec = {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  gravity?: number; damage?: number; color?: string; size?: number; lifetime?: number; explosion?: number; knockback?: number;
  // used by the game itself (ghast fireballs); scripts can't set these
  ownerId?: number; ownerKind?: MobKind; hitsPlayer?: boolean; cause?: string; maxDamage?: number;
};
export type RayHit = {
  type: 'block' | 'entity'; point: { x: number; y: number; z: number }; distance: number;
  block?: { x: number; y: number; z: number; id: number }; entity?: { id: number; type: string };
};
export type EntityInfo = { id: number; type: string; x: number; y: number; z: number; health: number; maxHealth: number };

/** What scripts and mods can reach inside the engine (App checks every argument first). */
export type ScriptEngineApi = {
  raycast(o: [number, number, number] | null, d: [number, number, number] | null, maxDist: number, entities: boolean, blocks: boolean): RayHit | null;
  listEntities(): EntityInfo[];
  spawnEntity(type: string, x: number, y: number, z: number): number;
  removeEntity(id: number): boolean;
  damageEntity(id: number, amount: number, knockback: number): boolean;
  knockEntity(id: number, vx: number, vy: number, vz: number): boolean;
  spawnProjectile(o: ProjectileSpec): number;
  removeProjectile(id: number): boolean;
  particles(x: number, y: number, z: number, color: string, count: number, speed: number, size: number, life: number): void;
  particleLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: string): void;
  playSound(name: string, x?: number, y?: number, z?: number): boolean;
  explode(x: number, y: number, z: number, power: number): void;
  dropItem(x: number, y: number, z: number, id: number, count: number): void;
  recoil(amount: number): void;
  launch(vx: number, vy: number, vz: number): void;
  damagePlayer(amount: number, cause: string): void;
  heal(amount: number): void;
  applyEffect(name: string, seconds: number, level: number): void;
  removeEffect(name: string): void;
  getEffects(): Array<{ name: string; level: number; seconds: number }>;
  getLook(): { x: number; y: number; z: number };
  getEye(): { x: number; y: number; z: number };
  isOnGround(): boolean;
  getDimension(): string;
  createDimension(spec: DimensionSpec): void;
  travel(dim: string, x?: number, z?: number): boolean;
  listDimensions(): string[];
  refreshCustomBlocks(): void;
  getTime(): number;
  setPlayerStats(health: number | null, hunger: number | null): void;
  /** Zoom: 1 = normal, 0.25 = 4x scope. Below 0.5 the gun and arms hide (look through the scope). */
  setZoom(factor: number): void;
  /** Aiming down sights: guns move to the middle of the screen. */
  setAiming(on: boolean): void;
};

export type GameHandle = {
  dispose: () => void;
  exit: () => void;
  onExit: (cb: () => void) => void;
  setRenderDistance: (rd: number) => void;
  getRenderDistance: () => number;
  getWorldMode: () => GameWorldMode;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  /** Call after setTextureResolution(): re-skins blocks, items and mobs in the running world. */
  reloadTextures: () => void;
  /** The closest village to the player, or null (also null outside the Overworld). */
  locateVillage: () => { x: number; z: number; distance: number } | null;
  /** Your skin and cape (seen in third person, and by other players). */
  setPlayerLook: (look: PlayerLook) => void;
  setRemoteLook: (id: number, look: PlayerLook) => void;
  getGraphicsQuality: () => GraphicsQuality;
  setFov: (fov: number) => void;
  getFov: () => number;
  getInventory: () => Slots;
  getHealth: () => number;
  getHunger: () => number;
  onInventoryChange: (cb: (slots: Slots, offhand: ItemStack | null, armor: Slots) => void) => void;
  getArmor: () => Slots;
  setArmor: (armor: Slots) => void;
  onEngineEvent: (cb: (name: string, data: Record<string, unknown>) => void) => void;
  script: ScriptEngineApi;
  getOffhand: () => ItemStack | null;
  setOffhand: (st: ItemStack | null) => void;
  setBlocks: (list: Array<[number, number, number, number]>) => number;
  getBlock: (x: number, y: number, z: number) => number;
  onBlockEvent: (cb: (type: 'break' | 'place', x: number, y: number, z: number, block: number) => void) => void;
  onStatsChange: (cb: (health: number, hunger: number) => void) => void;
  onInventoryToggle: (cb: (open: boolean, atTable: boolean, chestKey: string | null, furnaceKey?: string | null) => void) => void;
  craftFromGrid: (grid: (number | null)[], size: number, hasTable: boolean) => number | null;
  addItem: (id: number, count: number) => number;
  removeItem: (id: number, count: number) => number;
  setSelectedSlot: (i: number) => void;
  setSlots: (slots: Slots) => void;
  getChest: (key: string) => Slots;
  /** A furnace's 3 slots (input, fuel, output) plus cooking and fuel progress (0..1). */
  getFurnace: (key: string) => { slots: Slots; cook: number; burn: number };
  setFurnace: (key: string, slots: Slots) => void;
  setChest: (key: string, slots: Slots) => void;
  onHint: (cb: (text: string) => void) => void;
  getSaveData: () => SaveData;
  loadSaveData: (data: SaveData) => void;
  isCreative: () => boolean;
  dropItems: (items: Array<{ id: number; count: number }>) => void;
  quickCraft: (recipeId: string, hasTable: boolean) => boolean;
  setChatOpen: (open: boolean) => void;
  relock: () => void;
  setGameMode: (m: PlayMode) => void;
  getGameMode: () => PlayMode;
  teleport: (x: number, y: number, z: number) => void;
  clearInventory: () => void;
  kill: () => void;
  getDebugInfo: () => DebugInfo;
  getFps: () => number;
  closeInventory: () => void;
  onPlayerHurt: (cb: (amount: number) => void) => void;
  setSfxVolume: (v: number) => void;
  summonMob: (kind: string) => boolean;
  onPlayerDeath: (cb: (reason: string) => void) => void;
  respawn: () => void;
  setTime: (t: number) => void;
  setNetEnabled: (on: boolean) => void;
  takeBlockChanges: () => Array<[number, number, number, number]>;
  applyRemoteBlocks: (list: Array<[number, number, number, number]>) => void;
  getNetState: () => { x: number; y: number; z: number; yaw: number; pitch: number; mode: PlayMode; held: number; act: number };
  setRemotePlayer: (id: number, name: string, x: number, y: number, z: number, yaw: number, pitch: number, mode: string, held?: number, act?: number) => void;
  removeRemotePlayer: (id: number) => void;
};

export function createVoxelGame(
  canvas: HTMLCanvasElement,
  initialRenderDistance: number = 6,
  worldMode: GameWorldMode = 'survival',
  initialGraphicsQuality: GraphicsQuality = 'medium',
  initialFov: number = 75,
  worldType: WorldType = 'default',
  initialSfxVolume: number = 0.6,
  worldSeed?: number,
): GameHandle {
  let renderDistance = initialRenderDistance;
  let graphicsQuality: GraphicsQuality = initialGraphicsQuality;
  // worldMode only picks the world seed; `mode` is what you're playing in now
  let mode: PlayMode = worldMode;
  let chatOpen = false; // true while chat or the /help panel has focus
  let fps = 0, fpsFrames = 0, fpsTime = 0;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  const fogColor = new THREE.Color(0x87ceeb);

  function updateFog() {
    const far = renderDistance * CHUNK_SIZE * 0.9;
    const near = renderDistance * CHUNK_SIZE * 0.4;
    scene.fog = new THREE.Fog(fogColor, near, far);
  }
  updateFog();

  // Camera
  const camera = new THREE.PerspectiveCamera(initialFov, window.innerWidth / window.innerHeight, 0.1, 1000);
  const PLAYER_HEIGHT = 1.7;
  const PLAYER_EYE = 1.5;
  camera.rotation.order = 'YXZ';

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  // Sky: a gradient dome (vertex colors, so it matches fog color exactly),
  // a blocky Minecraft-style sun, and a drifting cloud layer.
  const skyGeo = new THREE.SphereGeometry(450, 24, 12);
  {
    const topCol = new THREE.Color(0x3a78d6);
    const horizonCol = new THREE.Color(0x87ceeb);
    const posAttr = skyGeo.getAttribute('position');
    const skyColors: number[] = [];
    const tmp = new THREE.Color();
    for (let i = 0; i < posAttr.count; i++) {
      const t = Math.min(1, Math.max(0, (posAttr.getY(i) / 450) * 1.6));
      tmp.copy(horizonCol).lerp(topCol, t);
      skyColors.push(tmp.r, tmp.g, tmp.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  }
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff4c2, fog: false, depthWrite: false });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), sunMat);
  sun.renderOrder = -1;
  sun.frustumCulled = false;
  scene.add(sun);
  const sunDir = new THREE.Vector3(40, 80, 30).normalize();

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 32; cloudCanvas.height = 32;
  {
    const cctx = cloudCanvas.getContext('2d')!;
    cctx.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) {
      cctx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32),
        2 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 4));
    }
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  cloudTex.magFilter = THREE.NearestFilter;
  cloudTex.minFilter = THREE.NearestFilter;
  cloudTex.wrapS = THREE.RepeatWrapping;
  cloudTex.wrapT = THREE.RepeatWrapping;
  cloudTex.repeat.set(6, 6);
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), cloudMat);
  clouds.rotation.x = -Math.PI / 2;
  clouds.frustumCulled = false;
  scene.add(clouds);
  let cloudDrift = 0;

  // ---- Day / night cycle ----
  // timeOfDay: 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight.
  // A full day is 10 minutes: about 5 of daylight and 5 of night.
  const DAY_LENGTH = 600;
  let timeOfDay = 0.02;
  let dayCount = 1;
  let currentDayAmt = 1;
  const DAY_TOP = new THREE.Color(0x3a78d6), DAY_HORIZON = new THREE.Color(0x87ceeb);
  const NIGHT_TOP = new THREE.Color(0x02040c), NIGHT_HORIZON = new THREE.Color(0x0b1026);
  const SUNSET = new THREE.Color(0xffa65c);
  const skyTop = new THREE.Color(), skyHorizon = new THREE.Color(), skyTmp = new THREE.Color();
  const moonDir = new THREE.Vector3();

  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ee, fog: false, depthWrite: false });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), moonMat);
  moon.renderOrder = -1;
  moon.frustumCulled = false;
  scene.add(moon);

  const starGeo = new THREE.BufferGeometry();
  {
    const pts: number[] = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(420);
      pts.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1.5;
  stars.frustumCulled = false;
  scene.add(stars);

  function isNight() {
    return timeOfDay > 0.53 && timeOfDay < 0.97;
  }

  function paintSky() {
    const posAttr = skyGeo.getAttribute('position');
    const colAttr = skyGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const t = Math.min(1, Math.max(0, (posAttr.getY(i) / 450) * 1.6));
      skyTmp.copy(skyHorizon).lerp(skyTop, t);
      colAttr.setXYZ(i, skyTmp.r, skyTmp.g, skyTmp.b);
    }
    colAttr.needsUpdate = true;
  }

  function updateDayNight(dt: number) {
    timeOfDay += dt / DAY_LENGTH;
    if (timeOfDay >= 1) { timeOfDay -= 1; dayCount++; }
    if (dimension !== 'overworld') { applyDimensionLook(); return; }
    const a = timeOfDay * Math.PI * 2;
    const h = Math.sin(a); // sun height: 1 at noon, -1 at midnight
    sunDir.set(Math.cos(a), h, 0.3).normalize();
    moonDir.copy(sunDir).negate();
    const d = Math.min(1, Math.max(0, (h + 0.15) / 0.35));
    const dayAmt = d * d * (3 - 2 * d);
    currentDayAmt = dayAmt;
    const glow = Math.max(0, 1 - Math.abs(h) * 5); // orange near sunrise / sunset
    skyHorizon.copy(NIGHT_HORIZON).lerp(DAY_HORIZON, dayAmt).lerp(SUNSET, glow * 0.55);
    skyTop.copy(NIGHT_TOP).lerp(DAY_TOP, dayAmt);
    paintSky();
    fogColor.copy(skyHorizon);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(skyHorizon);
    if (scene.background instanceof THREE.Color) scene.background.copy(skyHorizon);
    ambientLight.intensity = 0.24 + 0.46 * dayAmt;
    dirLight.intensity = 0.12 + 0.68 * dayAmt;
    starMat.opacity = 1 - dayAmt;
    stars.position.copy(camera.position);
    stars.rotation.z = a;
    moon.position.copy(camera.position).addScaledVector(moonDir, 400);
    moon.lookAt(camera.position);
    sun.visible = h > -0.25;
    moon.visible = h < 0.25;
    cloudMat.color.setScalar(0.3 + 0.7 * dayAmt);
    clouds.visible = true;
    stars.visible = true;
    if (effectLevel('night_vision')) ambientLight.intensity = Math.max(ambientLight.intensity, 0.85);
  }

  function setTime(t: number) {
    timeOfDay = ((t % 1) + 1) % 1;
  }
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(40, 80, 30);
  dirLight.castShadow = false; // toggled by applyGraphicsQuality
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 250;
  dirLight.shadow.bias = -0.0015;
  scene.add(dirLight);
  scene.add(dirLight.target);

  // A small procedural cube map, used only to give "High"/"Max" graphics
  // settings a subtle reflective sheen on blocks — cheap, static, and pure
  // core three.js (no external image assets or postprocessing needed).

  // Textures
  const grassTex = makeGrassTexture();
  const dirtTex = makeDirtTexture();
  const stoneTex = makeStoneTexture();
  const woodTex = makeWoodTexture();
  const leafTex = makeLeafTexture();

  // Crafting table texture — planks base with a darker grid/tool pattern
  const craftingTableTex = (() => {
    const t = new THREE.CanvasTexture(drawCraftingTableCanvas());
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return t;
  })();

  // Shared materials — indexed to match texIdx in geometry builder
  // 0=side(dirt), 1=top(grass), 2=bottom(dirt), 3=stone, 4=sand, 5=wood, 6=leaves
  // Index order must match matIndexFor(): 0 dirt, 1 grass top, 2 dirt,
  // 3 stone, 4 sand, 5 log side, 6 leaves, 7 crafting table, 8 grass side,
  // 9 bedrock, 10-14 ores, 15 log top, 16 snow
  const fc = faceCanvases();
  const worldTextures: THREE.Texture[] = [];
  const worldTex = (c: HTMLCanvasElement): THREE.Texture => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
    worldTextures.push(t);
    return t;
  };
  const baseMaterialCanvases = (fc: Record<string, HTMLCanvasElement>) => [
    fc.dirt, fc.grass, fc.dirt, fc.stone, fc.sand, fc.wood, fc.leaves, fc.table, fc.grassSide,
    fc.bedrock, fc.coalOre, fc.ironOre, fc.goldOre, fc.diamondOre, fc.emeraldOre, fc.logTop, fc.snow,
    fc.tallGrass, fc.obsidian, fc.chestTop, fc.chestSide,
    fc.planks, ...CONCRETE.map((cc) => fc[`concrete${cc.id}`]),
    fc.netherrack, fc.soulSand, fc.glowstone, fc.quartzOre, fc.portal, // 30-34
    fc.farmland, fc.wheat0, fc.wheat1, fc.wheat2, fc.furnaceFront, fc.furnaceTop, fc.glass, fc.doorBottom, fc.doorTop, fc.infernium, // 35-44
  ];
  const materialCanvases = baseMaterialCanvases(fc);
  const materials = materialCanvases.map((c, i) =>
    i === 6 || i === 17 || (i >= 36 && i <= 38) || (i >= 41 && i <= 43) // see-through: leaves, plants, glass, doors
      ? new THREE.MeshLambertMaterial({ map: worldTex(c), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ map: worldTex(c), vertexColors: true }),
  );

  // ---- Shader effects for High/Max graphics ----
  // Leaves and tall grass sway in the wind (a small vertex-shader tweak).
  // The phase comes from world position, so touching leaf blocks move
  // together and never open cracks.
  const foliageUniforms = { uTime: { value: 0 }, uWave: { value: 0 } };
  function addSway(m: THREE.Material, amp: number, grass: boolean) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = foliageUniforms.uTime;
      shader.uniforms.uWave = foliageUniforms.uWave;
      shader.vertexShader = 'uniform float uTime;\nuniform float uWave;\n' + shader.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float vbSway = sin(uTime * 1.8 + position.x * 0.6 + position.z * 0.5) * 0.6 + sin(uTime * 3.1 + position.x * 1.3 + position.z * 0.9) * 0.3;',
        `float vbAmt = uWave * ${amp.toFixed(3)}${grass ? ' * uv.y' : ''};`,
        'transformed.x += vbSway * vbAmt;',
        'transformed.z += vbSway * vbAmt * 0.7;',
      ].join('\n'));
    };
  }
  // Glowstone glows (ignores lighting); portals are see-through purple swirls
  materials[32].dispose();
  materials[32] = new THREE.MeshBasicMaterial({ map: worldTex(fc.glowstone), vertexColors: true }) as unknown as THREE.MeshLambertMaterial;
  let portalTex = worldTex(fc.portal);
  portalTex.wrapS = THREE.RepeatWrapping;
  portalTex.wrapT = THREE.RepeatWrapping;
  materials[34].dispose();
  materials[34] = new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }) as unknown as THREE.MeshLambertMaterial;

  // Blocks added by mods get material slots after the built-in ones
  const customMatDef = new Map<number, CustomBlockDef>();
  let customRebuildTimer: ReturnType<typeof setTimeout> | null = null;
  function refreshCustomBlocks() {
    let changed = false;
    for (const def of CUSTOM_BLOCKS.values()) {
      if (customMatDef.get(def.id) === def) continue;
      const tex = worldTex(def.canvas);
      const mat = def.shape === 'cross'
        ? new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
      if (def.shape === 'cross') addSway(mat, 0.1, true);
      const existing = CUSTOM_MAT_INDEX[def.id];
      if (existing >= 0) { materials[existing].dispose(); materials[existing] = mat; }
      else { CUSTOM_MAT_INDEX[def.id] = materials.length; materials.push(mat); }
      CROSS_MAT[def.id] = def.shape === 'cross' ? CUSTOM_MAT_INDEX[def.id] : -1;
      customMatDef.set(def.id, def);
      changed = true;
    }
    // Chunks drawn before the mod loaded need redrawing with the new blocks
    if (changed && !customRebuildTimer) {
      customRebuildTimer = setTimeout(() => {
        customRebuildTimer = null;
        for (const k of loadedChunks) {
          const [cx, cz] = k.split(',').map(Number);
          const c = world.getChunk(cx, cz);
          if (c) rebuildChunkMesh(c);
        }
      }, 150);
    }
  }

  addSway(materials[6], 0.04, false);
  addSway(materials[17], 0.12, true);

  // Water: a custom shader. On High/Max the surface moves in waves; its color
  // blends deep blue with a reflection of the real sky (stronger at grazing
  // angles, like real water) plus a sharp sun or moon glint.
  const waterUniforms = {
    uTime: { value: 0 }, uWaves: { value: 0 }, uDetail: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSkyTop: { value: new THREE.Vector3(0.23, 0.47, 0.84) }, uSkyHorizon: { value: new THREE.Vector3(0.53, 0.81, 0.92) },
    uFogColor: { value: new THREE.Vector3(0.53, 0.81, 0.92) }, uFogNear: { value: 40 }, uFogFar: { value: 90 }, uDay: { value: 1 },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform float uWaves;
      attribute float aTop;
      varying vec3 vWorld;
      varying vec3 vNormal2;
      varying float vTop;
      void main() {
        vec3 p = position;
        if (aTop > 0.5) {
          p.y += (sin(p.x * 1.3 + uTime * 1.6) * 0.03 + sin(p.z * 1.7 + uTime * 1.3) * 0.025 + sin((p.x + p.z) * 0.8 - uTime * 1.1) * 0.02 - 0.05) * uWaves;
        }
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vNormal2 = normal;
        vTop = aTop;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uDetail;
      uniform float uWaves;
      uniform vec3 uSunDir;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uDay;
      varying vec3 vWorld;
      varying vec3 vNormal2;
      varying float vTop;
      float waveH(vec2 p) {
        return sin(p.x * 1.3 + uTime * 1.6) * 0.5 + sin(p.y * 1.7 + uTime * 1.3) * 0.5
          + sin((p.x + p.y) * 0.8 - uTime * 1.1) * 0.4
          + (sin(p.x * 3.1 - p.y * 2.3 + uTime * 2.4) * 0.25 + sin(p.x * 5.7 + p.y * 4.9 - uTime * 3.1) * 0.12
             + sin(p.x * 9.3 - p.y * 7.7 + uTime * 4.2) * 0.06) * uDetail;
      }
      void main() {
        vec3 n = normalize(vNormal2);
        if (vTop > 0.5) {
          float e = 0.12;
          float hx = waveH(vWorld.xz + vec2(e, 0.0)) - waveH(vWorld.xz - vec2(e, 0.0));
          float hz = waveH(vWorld.xz + vec2(0.0, e)) - waveH(vWorld.xz - vec2(0.0, e));
          float strength = 0.1 + 0.25 * max(uWaves, 0.25);
          n = normalize(vec3(-hx * strength, 1.0, -hz * strength));
        }
        vec3 v = normalize(cameraPosition - vWorld);
        if (dot(n, v) < 0.0) n = -n; // looking up at the surface from underwater
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(r.y * 1.6, 0.0, 1.0));
        vec3 deep = mix(vec3(0.02, 0.05, 0.10), vec3(0.06, 0.30, 0.46), uDay);
        vec3 col = mix(deep, sky, fres * 0.9);
        vec3 sd = normalize(uSunDir);
        float spec = pow(max(dot(r, sd), 0.0), 240.0) * (0.25 + 0.75 * uDay);
        col += vec3(1.0, 0.95, 0.82) * spec * 1.6;
        float alpha = clamp(0.62 + fres * 0.35 + spec, 0.0, 0.96);
        float fog = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
        gl_FragColor = vec4(mix(col, uFogColor, fog), alpha);
      }`,
  });
  const lavaCanvas = (() => {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e8590c';
    ctx.fillRect(0, 0, 16, 16);
    const tones = ['#ff8f1f', '#ffb347', '#c2410c', '#ffd166'];
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
      ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 2, 1);
    }
    return c;
  })();
  const lavaTex = new THREE.CanvasTexture(lavaCanvas);
  lavaTex.magFilter = THREE.NearestFilter;
  lavaTex.minFilter = THREE.NearestFilter;
  lavaTex.wrapS = THREE.RepeatWrapping;
  lavaTex.wrapT = THREE.RepeatWrapping;
  const lavaMat = new THREE.MeshBasicMaterial({ map: lavaTex }); // glows: unaffected by night
  const fluidMaterials = [waterMat, lavaMat];
  const setRGB = (v: THREE.Vector3, c: THREE.Color) => {
    const h = c.getHex(); // sRGB, so the shader output matches everything else on screen
    v.set(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
  };

  // World — seed varies by game mode so each mode generates different terrain
  const modeSeeds: Record<GameWorldMode, number> = {
    survival: 42,
    creative: 777,
    adventure: 1337,
  };
  // Each planet gets its own seed; fall back to the old per-mode seed
  const effectiveSeed = worldSeed ?? modeSeeds[worldMode];
  // Every dimension is its own World; `world` always points at the one you're in
  let world = new World(effectiveSeed, worldType === 'superflat');
  const worlds = new Map<string, World>([['overworld', world]]);
  const dimensionSpecs = new Map<string, DimensionSpec>();
  let dimension = 'overworld';
  const lastPosByDim = new Map<string, [number, number, number]>();
  const portals: Record<string, Array<[number, number, number]>> = { overworld: [], nether: [] };
  let pendingDimRestore: { dim: string; x: number; y: number; z: number } | null = null;
  const loadedChunks = new Set<string>();

  // Player state
  let yaw = 0;
  let pitch = 0;
  let velocityY = 0;
  let wasGrounded = true;
  let fallPeakY = 0;
  const GRAVITY = -25;
  const JUMP_FORCE = 8;
  const WALK_SPEED = 5;
  const SPRINT_SPEED = 7.5;
  const keys: Record<string, boolean> = {};
  let isLocked = false;
  let exitRequested = false;
  let exitCallback: (() => void) | null = null;
  let currentChunkX = Infinity;
  let currentChunkZ = Infinity;

  // --- Player arm model (Minecraft-style first-person arm) ---
  // A single 3D cuboid, roughly a 4x4x12 ratio (width:height:length), not a
  // flat plank or a generic cube. Positioned tight in the bottom-right,
  // pitched up toward the crosshair, yawed slightly inward, and rolled so
  // the top face slopes down-left — matching the real Minecraft viewmodel
  // angle, where you mostly see the top face of the forearm and the square
  // fist-end face pointed away from the camera.
  //
  // Materials are MeshBasicMaterial (unlit) rather than MeshLambertMaterial:
  // this arm renders in its own isolated pass (see the render loop below)
  // that only contains camera-attached objects, not the scene's lights —
  // a lit material there receives zero light and renders solid black,
  // which is exactly why the fist looked black before.
  const FIST_REST_Z = -0.75;   // rest distance from camera
  const FIST_REST_Y = -0.68;
  const FIST_REST_X = 0.7;
  const FIST_PUNCH_Z = -1.2;  // extended distance on punch
  let punchPhase = 0;
  const PUNCH_DURATION = 0.28;

  function makeSolidTex(top: string, bottom: string): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 16);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  const armSideTex = makeSolidTex('#3f86dd', '#2c5fa8'); // sleeve, left/right faces
  const armTopTex = makeSolidTex('#5a9bea', '#3f86dd');  // lighter — this is the face we mostly see
  const armBottomTex = makeSolidTex('#2c5fa8', '#1e4278');
  const armBackTex = makeSolidTex('#a8734f', '#8a5a3c'); // near end (rarely visible), flat skin tone

  // Fist/hand texture (far end cap) — Minecraft-style: a flat base tone
  // with a scatter of irregular rectangular shading patches, not smooth
  // gradients/bands, which is what actually reads as "blocky/pixelated".
  const fistCanvas = document.createElement('canvas');
  fistCanvas.width = 16; fistCanvas.height = 16;
  const fistCtx = fistCanvas.getContext('2d')!;
  fistCtx.fillStyle = '#a8734f';
  fistCtx.fillRect(0, 0, 16, 16);
  const patchDark = '#8a5a3c';
  fistCtx.fillStyle = patchDark;
  fistCtx.fillRect(6, 1, 4, 4);
  fistCtx.fillRect(10, 3, 4, 3);
  fistCtx.fillRect(2, 6, 4, 5);
  fistCtx.fillRect(9, 8, 4, 3);
  fistCtx.fillRect(3, 13, 4, 3);
  fistCtx.fillStyle = '#c08a63';
  fistCtx.fillRect(0, 0, 3, 3);
  fistCtx.fillRect(12, 12, 4, 4);
  fistCtx.fillStyle = '#6e4429';
  fistCtx.fillRect(7, 2, 2, 2);
  fistCtx.fillRect(3, 8, 2, 2);
  const fistTex = new THREE.CanvasTexture(fistCanvas);
  fistTex.magFilter = THREE.NearestFilter;
  fistTex.minFilter = THREE.NearestFilter;

  // Roughly 4:4:12 (width:height:length) as requested — a proper elongated
  // cuboid, not a cube or a flat plank.
  const armGeo = new THREE.BoxGeometry(0.36, 0.36, 1.08);
  // BoxGeometry material slot order: [+X, -X, +Y(top), -Y(bottom), +Z(near/back), -Z(far/fist)]
  const armMaterials = [
    new THREE.MeshBasicMaterial({ map: armSideTex }),   // +X right side
    new THREE.MeshBasicMaterial({ map: armSideTex }),   // -X left side
    new THREE.MeshBasicMaterial({ map: armTopTex }),    // +Y top — mostly what we see
    new THREE.MeshBasicMaterial({ map: armBottomTex }), // -Y bottom
    new THREE.MeshBasicMaterial({ map: armBackTex }),   // +Z near end (toward camera, rarely seen)
    new THREE.MeshBasicMaterial({ map: fistTex }),      // -Z far end — the fist, facing away from camera
  ];

  const fistMesh = new THREE.Mesh(armGeo, armMaterials);
  // The left arm only shows when holding a two-handed gun (it grips the front)
  const leftArm = new THREE.Mesh(armGeo, armMaterials);
  leftArm.renderOrder = 999;
  leftArm.frustumCulled = false;
  leftArm.visible = false;
  camera.add(leftArm);
  fistMesh.renderOrder = 999;
  fistMesh.frustumCulled = false;
  fistMesh.position.set(FIST_REST_X, FIST_REST_Y, FIST_REST_Z);
  // Pitch (X) is POSITIVE here to angle the fist end upward toward the
  // crosshair — a negative value here pitches it downward instead, which
  // was the actual bug: the arm was tilting away from the crosshair, not
  // toward it. Yaw (Y) positive sweeps the fist end from the right side
  // in toward center/left. Roll (Z) tilts the top face down-left.
  const FIST_REST_ROT_X = 0.5;
  const FIST_REST_ROT_Y = 0.55;
  const FIST_REST_ROT_Z = -0.25;
  fistMesh.rotation.set(FIST_REST_ROT_X, FIST_REST_ROT_Y, FIST_REST_ROT_Z);
  camera.add(fistMesh);
  scene.add(camera); // ensure camera (and its child) are in the scene

  // --- Block breaking (mining) ---
  const REACH_DISTANCE = 6;
  const RAY_STEP = 0.05;
  const BREAK_TIME = 0.6; // default seconds to fully break a block
  const BLOCK_HARDNESS: Record<number, number> = {
    [BLOCK_LEAVES]: 0.2,
    [BLOCK_GRASS]: 0.5,
    [BLOCK_DIRT]: 0.5,
    [BLOCK_SAND]: 0.4,
    [BLOCK_WOOD]: 0.75,
    [BLOCK_CRAFTING_TABLE]: 0.75,
    [BLOCK_STONE]: 1.4,
    [BLOCK_SNOW]: 0.3,
    [BLOCK_COAL_ORE]: 1.8,
    [BLOCK_IRON_ORE]: 2.2,
    [BLOCK_GOLD_ORE]: 2.2,
    [BLOCK_DIAMOND_ORE]: 2.8,
    [BLOCK_EMERALD_ORE]: 2.8,
    [BLOCK_OBSIDIAN]: 10,
    [BLOCK_TALL_GRASS]: 0,
    [BLOCK_CHEST]: 1.0,
    [ITEM_PLANKS]: 0.75,
    [BLOCK_NETHERRACK]: 0.4,
    [BLOCK_SOUL_SAND]: 0.5,
    [BLOCK_GLOWSTONE]: 0.3,
    [BLOCK_QUARTZ_ORE]: 1.5,
    [BLOCK_NETHER_PORTAL]: 0,
    [BLOCK_FARMLAND]: 0.5, [BLOCK_WHEAT_0]: 0, [BLOCK_WHEAT_1]: 0, [BLOCK_WHEAT_2]: 0,
    [BLOCK_FURNACE]: 1.75, [BLOCK_GLASS]: 0.3, [BLOCK_GLASS_PANE]: 0.3, [BLOCK_INFERNIUM_ORE]: 6,
    ...Object.fromEntries([54, 55, 56, 57, 58, 59].map((d) => [d, 1.0])), // doors
    ...Object.fromEntries(CONCRETE.map((cc) => [cc.id, 1.8])),
  };

  // Pickaxes speed up stone/ores, axes speed up wood. Wood tools 2x, stone 4x.
  function heldTool(): ToolInfo | null {
    return heldItem !== null ? TOOLS[heldItem] ?? null : null;
  }

  function pickTier(): number {
    const t = heldTool();
    return t && t.kind === 'pickaxe' ? t.tier : 0;
  }

  // Pickaxes speed up stone-type blocks, axes wood-type, swords cut leaves and grass
  function toolSpeed(block: number): number {
    const t = heldTool();
    if (!t) return 1;
    if (t.kind === 'pickaxe' && requiredTier(block) > 0) return t.speed;
    if (t.kind === 'axe' && (block === BLOCK_WOOD || block === ITEM_PLANKS || block === BLOCK_CRAFTING_TABLE || block === BLOCK_CHEST || isDoor(block))) return t.speed;
    if (t.kind === 'sword' && block === BLOCK_LEAVES) return 1.5;
    return 1;
  }

  // What a broken block drops. Ores need the right pickaxe tier, like Minecraft.
  function dropFor(block: number): number | null {
    if (block === BLOCK_AIR || block === BLOCK_BEDROCK || block === BLOCK_TALL_GRASS || block === BLOCK_NETHER_PORTAL || isFluid(block)) return null;
    const custom = CUSTOM_BLOCKS.get(block);
    if (custom) return custom.drops;
    // (Blocks your pickaxe is too weak for can't be broken at all, so no tier check needed here)
    if (isWheat(block)) return ITEM_SEEDS;
    if (isDoor(block)) return ITEM_DOOR;
    switch (block) {
      case BLOCK_GRASS: return BLOCK_DIRT;
      case BLOCK_FARMLAND: return BLOCK_DIRT;
      case BLOCK_COAL_ORE: return ITEM_COAL;
      case BLOCK_QUARTZ_ORE: return ITEM_QUARTZ;
      case BLOCK_DIAMOND_ORE: return ITEM_DIAMOND;
      case BLOCK_EMERALD_ORE: return ITEM_EMERALD;
      default: return block;
    }
  }
  /**
   * Everything a block drops when you break it. Too weak a tool (or bare hands
   * on stone and ores) drops nothing, like Minecraft. Leaves sometimes give a
   * stick or an apple; grass sometimes gives seeds.
   */
  function dropsFor(block: number, tooWeak: boolean): Array<[number, number]> {
    if (tooWeak) return [];
    if (block === BLOCK_LEAVES) {
      const out: Array<[number, number]> = [];
      if (Math.random() < 0.06) out.push([ITEM_STICK, Math.random() < 0.3 ? 2 : 1]);
      if (Math.random() < 0.025) out.push([ITEM_APPLE, 1]);
      return out;
    }
    if (block === BLOCK_TALL_GRASS) return Math.random() < 0.125 ? [[ITEM_SEEDS, 1]] : [];
    if (block === BLOCK_WHEAT_2) return [[ITEM_WHEAT, 1], [ITEM_SEEDS, 1 + Math.floor(Math.random() * 3)]];
    const d = dropFor(block);
    return d === null ? [] : [[d, 1]];
  }
  const CRACK_STAGES = 10;

  let isMining = false;
  let heldItem: number | null = null;
  // Guns from mods: zoom/aim set by scripts, kick from recoil, and press state for full-auto
  let scriptZoom = 1;
  let gunAiming = false;
  let aimLerp = 0;
  let viewKick = 0;
  let leftUseDown = false;
  let rightUseDown = false;
  let bowDrawing = false;
  let bowDrawStart = 0;
  let isFlying = false;
  let lastSpaceTapTime = 0;
  let miningTarget: { x: number; y: number; z: number } | null = null;
  let miningProgress = 0;
  const rayDir = new THREE.Vector3();

  // --- Inventory, health, hunger & crafting ---
  // Item ids: real block ids double as inventory item ids for the raw
  // blocks you mine; PLANKS/STICK are crafted-only items with ids outside
  // the block-id range so they never collide with a placeable block.
  // Slot inventory: 0-8 hotbar, 9-35 main
  const slots: Slots = emptySlots(INVENTORY_SIZE);
  let selectedSlot = 0;
  let offhand: ItemStack | null = null; // F swaps it with the selected hotbar slot
  const armor: Slots = emptySlots(4); // helmet, chestplate, leggings, boots
  let armorShown = '';
  const chests = new Map<string, Slots>(); // "x,y,z" -> 27 slots
  let health = 20;
  let hunger = 20;
  let hungerTimer = 0;
  let starveTimer = 0;
  let sprintingNow = false;
  let sprintFov = 0;
  let inventoryOpen = false;

  let inventoryCallback: ((s: Slots, off: ItemStack | null, armor: Slots) => void) | null = null;
  let statsCallback: ((health: number, hunger: number) => void) | null = null;
  let inventoryOpenCallback: ((open: boolean, atTable: boolean, chestKey: string | null, furnaceKey?: string | null) => void) | null = null;
  let atCraftingTable = false;
  let openChestKey: string | null = null;

  function notifyInventory() {
    inventoryCallback?.(slots.map((st) => (st ? { ...st } : null)), offhand ? { ...offhand } : null, armor.map((st) => (st ? { ...st } : null)));
    const ids = armor.map((a) => (a ? a.id : null));
    if (ids.join() !== armorShown) { armorShown = ids.join(); applyArmorOverlay(playerModel, ids); } // third-person view
    syncHeld();
  }

  /** Puts items into the inventory; returns how many actually fit. */
  function addItem(id: number, count: number): number {
    const left = addToSlots(slots, id, count);
    if (left !== count) notifyInventory();
    return count - left;
  }

  function canFit(id: number): boolean {
    const max = maxStack(id);
    return slots.some((st) => !st || (st.id === id && st.count < max));
  }

  function setStats(h: number, hu: number) {
    health = Math.max(0, Math.min(20, h));
    hunger = Math.max(0, Math.min(20, hu));
    statsCallback?.(health, hunger);
  }

  /**
   * Craft from a grid layout. Consumes one of each non-empty cell and
   * awards the output. Returns the crafted item id, or null on no match.
   */
  function craftFromGrid(grid: (number | null)[], size: number, hasTable: boolean): number | null {
    const recipe = matchRecipe(grid, size, hasTable);
    if (!recipe) return null;
    addItem(recipe.output.id, recipe.output.count);
    return recipe.output.id;
  }

  function removeItem(id: number, count: number): number {
    const taken = removeFromSlots(slots, id, count);
    if (taken > 0) notifyInventory();
    return taken;
  }

  /** Use up items from the selected hotbar slot (creative mode never runs out). */
  function consumeHeld(n = 1) {
    if (mode === 'creative') return;
    const st = slots[selectedSlot];
    if (!st) return;
    slots[selectedSlot] = st.count - n > 0 ? { id: st.id, count: st.count - n } : null;
    notifyInventory();
  }

  /** Swap the item in the selected slot (an empty bucket becoming a water bucket, etc). */
  function replaceHeld(id: number | null) {
    slots[selectedSlot] = id === null ? null : { id, count: 1 };
    notifyInventory();
  }

  function setSlots(next: Slots) {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const st = next[i];
      slots[i] = st ? { id: st.id, count: st.count } : null;
    }
    notifyInventory();
  }

  function getChest(key: string): Slots {
    let c = chests.get(key);
    if (!c) { c = emptySlots(CHEST_SIZE); chests.set(key, c); }
    return c.map((st) => (st ? { ...st } : null));
  }

  function setChest(key: string, next: Slots) {
    chests.set(key, next.map((st) => (st ? { ...st } : null)));
  }

  function setSelectedSlot(i: number) {
    selectedSlot = Math.max(0, Math.min(8, i));
    syncHeld();
  }

  function syncHeld() {
    const id = slots[selectedSlot]?.id ?? null;
    if (id !== heldItem) {
      if (leftUseDown && heldItem !== null) engineEvent('itemAttack', { item: heldItem, pressed: false });
      if (rightUseDown && heldItem !== null) engineEvent('itemUseEnd', { item: heldItem });
      leftUseDown = false;
      rightUseDown = false;
      heldItem = id;
      bowDrawing = false; // switching items cancels a bow draw
      if (scriptZoom !== 1) engineEvent('zoomChange', { zoom: 1 });
      scriptZoom = 1;
      gunAiming = false;
    }
    updateHeldMesh();
  }

  // --- Held item shown in the hand ---
  let heldMesh: THREE.Mesh | null = null;
  let heldMeshId: number | null = null;
  // The held item is attached to the camera (not the arm) so it can be posed
  // like Minecraft: tools tilted up toward the crosshair, blocks turned 45°,
  // bows held upright.
  const heldBase = new THREE.Vector3();
  // First-person pose for swords and tools, and for blocking with a sword (right-click and hold)
  const TOOL_FP = { scale: 1.15, x: 0.5, y: -0.15, z: -0.95, rx: -0.2, ry: -0.2, rz: 0.32 };
  const BLOCK_FP = { x: 0.22, y: -0.28, z: -0.85, rx: 0.1, ry: -0.9, rz: 1.2 };
  let swordBlocking = false;
  let blockLerp = 0;

  // The off-hand item, shown in your left hand (first person)
  let offMesh: THREE.Mesh | null = null;
  let offMeshId: number | null = null;
  function updateOffhandMesh() {
    const id = offhand?.id ?? null;
    if (offMeshId === id) return;
    if (offMesh) { camera.remove(offMesh); disposeObject(offMesh); offMesh = null; }
    offMeshId = id;
    if (id === null) return;
    const m = makeItemMesh(id, true);
    if (!m) return;
    if (blockFaces(id)) { m.scale.setScalar(0.36); m.rotation.set(0.1, -Math.PI / 4, 0); m.position.set(-0.5, -0.46, -0.82); }
    else { m.scale.setScalar(0.7); m.rotation.set(-0.1, 0.45, -0.06); m.position.set(-0.5, -0.4, -0.78); m.scale.x *= -1; } // mirrored for the left hand
    m.renderOrder = 999;
    m.frustumCulled = false;
    camera.add(m);
    offMesh = m;
  }

  function updateHeldMesh() {
    if (heldMeshId === heldItem) return;
    if (heldMesh) { camera.remove(heldMesh); disposeObject(heldMesh); heldMesh = null; }
    heldMeshId = heldItem;
    if (heldItem === null) return;
    const m = makeItemMesh(heldItem, true);
    if (!m) return;
    const hold = CUSTOM_ITEMS.get(heldItem)?.hold ?? 'item';
    if (hold !== 'item') {
      // Guns point straight at the crosshair; the pose itself is animated every frame
      m.scale.setScalar(0.95);
      heldBase.set(hold === 'two_hands' ? 0.26 : 0.4, -0.34, -0.72);
      m.rotation.set(0, Math.PI / 2, 0);
    } else if (blockFaces(heldItem)) {
      m.scale.setScalar(0.4);
      heldBase.set(0.52, -0.46, -0.82);
      m.rotation.set(0.1, Math.PI / 4, 0);
    } else if (heldItem === ITEM_BOW) {
      m.scale.setScalar(0.8);
      heldBase.set(0.42, -0.3, -0.85);
      m.rotation.set(0, -0.35, Math.PI / 4);
    } else if (TOOLS[heldItem]) {
      // Swords and tools: big and almost facing you, handle at the bottom, blade toward the top right
      m.scale.setScalar(TOOL_FP.scale);
      heldBase.set(TOOL_FP.x, TOOL_FP.y, TOOL_FP.z);
      m.rotation.set(TOOL_FP.rx, TOOL_FP.ry, TOOL_FP.rz);
    } else {
      m.scale.setScalar(0.8);
      heldBase.set(0.48, -0.32, -0.85);
      m.rotation.set(-0.25, -0.6, 1.0);
    }
    m.position.copy(heldBase);
    m.renderOrder = 999;
    m.frustumCulled = false;
    camera.add(m);
    heldMesh = m;
  }

  // --- Dropped item entities (float, spin, get picked up) ---
  type DroppedItem = {
    id: number; count: number; mesh: THREE.Mesh;
    pos: THREE.Vector3; vel: THREE.Vector3; age: number; pickupDelay: number;
  };
  const droppedItems: DroppedItem[] = [];

  function spawnDroppedItem(id: number, count: number, pos: THREE.Vector3, vel: THREE.Vector3, pickupDelay: number) {
    const mesh = makeItemMesh(id, false);
    if (!mesh) return;
    mesh.scale.setScalar(blockFaces(id) ? 0.25 : 0.45);
    mesh.castShadow = graphicsQuality !== 'low';
    scene.add(mesh);
    droppedItems.push({ id, count, mesh, pos: pos.clone(), vel: vel.clone(), age: 0, pickupDelay });
  }

  /** Throw items out in front of the player (Q, closing a crafting grid, etc). */
  function dropFromPlayer(id: number, count: number) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 0.8);
    pos.y -= 0.3;
    const vel = dir.clone().multiplyScalar(5);
    vel.y += 2;
    spawnDroppedItem(id, count, pos, vel, 1.5);
  }

  function dropItems(items: Array<{ id: number; count: number }>) {
    for (const it of items) if (it.count > 0) dropFromPlayer(it.id, it.count);
  }

  function removeDropped(i: number) {
    const d = droppedItems[i];
    scene.remove(d.mesh);
    disposeObject(d.mesh);
    droppedItems.splice(i, 1);
  }

  function updateDroppedItems(delta: number) {
    const bodyY = camera.position.y - PLAYER_EYE + 0.9;
    for (let i = droppedItems.length - 1; i >= 0; i--) {
      const d = droppedItems[i];
      d.age += delta;
      const dx = camera.position.x - d.pos.x;
      const dy = bodyY - d.pos.y;
      const dz = camera.position.z - d.pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const hasRoom = canFit(d.id);

      if (mode !== 'spectator' && !dead && d.age > d.pickupDelay && hasRoom && dist < 2.2) {
        if (dist < 0.9) {
          const take = addItem(d.id, d.count);
          d.count -= take;
          playSfx('pickup', null);
          if (d.count <= 0) { removeDropped(i); continue; }
        } else {
          // Magnet: drift toward the player once close, like Minecraft
          const pull = Math.min(1, (8 * delta) / dist);
          d.pos.x += dx * pull; d.pos.y += dy * pull; d.pos.z += dz * pull;
          d.vel.set(0, 0, 0);
        }
      } else {
        // Simple physics: gravity, wall stops, ground friction
        d.vel.y -= 20 * delta;
        const nx = d.pos.x + d.vel.x * delta;
        const nz = d.pos.z + d.vel.z * delta;
        if (!isSolid(world.getWorldBlock(Math.floor(nx), Math.floor(d.pos.y), Math.floor(d.pos.z)))) d.pos.x = nx; else d.vel.x = 0;
        if (!isSolid(world.getWorldBlock(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(nz)))) d.pos.z = nz; else d.vel.z = 0;
        const ny = d.pos.y + d.vel.y * delta;
        const below = Math.floor(ny - 0.15);
        if (d.vel.y <= 0 && isSolid(world.getWorldBlock(Math.floor(d.pos.x), below, Math.floor(d.pos.z)))) {
          d.pos.y = below + 1.15;
          d.vel.y = 0;
          d.vel.x *= 0.85;
          d.vel.z *= 0.85;
        } else {
          d.pos.y = ny;
        }
      }

      if (d.pos.y < -20 || d.age > 300) { removeDropped(i); continue; }
      // Bob and spin while waiting to be picked up
      d.mesh.position.set(d.pos.x, d.pos.y + 0.12 + Math.sin(d.age * 2.5) * 0.06, d.pos.z);
      d.mesh.rotation.y = d.age * 1.6;
    }
  }

  // =================================================================
  //  Sound effects — synthesized with Web Audio, no audio files needed
  // =================================================================
  let audioCtx: AudioContext | null = null;
  let sfxGain: GainNode | null = null;
  let sfxVolume = initialSfxVolume;
  let noiseBuffer: AudioBuffer | null = null;

  function ac(): AudioContext | null {
    if (!audioCtx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new Ctor();
        sfxGain = audioCtx.createGain();
        sfxGain.gain.value = sfxVolume;
        sfxGain.connect(audioCtx.destination);
        const len = audioCtx.sampleRate;
        noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // A per-sound output with distance falloff and left/right panning
  function outNode(pos: THREE.Vector3 | null, vol: number): AudioNode | null {
    const ctx = ac();
    if (!ctx || !sfxGain || sfxVolume <= 0) return null;
    let v = vol;
    let pan = 0;
    if (pos) {
      const d = pos.distanceTo(camera.position);
      if (d > 28) return null;
      v *= Math.max(0, 1 - d / 28);
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const right = fwd.cross(camera.up).normalize();
      const rel = pos.clone().sub(camera.position).normalize();
      pan = Math.max(-1, Math.min(1, rel.dot(right))) * 0.8;
    }
    const g = ctx.createGain();
    g.gain.value = v;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    g.connect(panner);
    panner.connect(sfxGain);
    return g;
  }

  function tone(pos: THREE.Vector3 | null, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, vibrato = 0) {
    const ctx = ac();
    const out = outNode(pos, vol);
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vibrato > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 18;
      const lg = ctx.createGain();
      lg.gain.value = vibrato;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + Math.min(0.02, dur / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noiseHit(pos: THREE.Vector3 | null, type: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, delay = 0, q = 1, attack = 0.005) {
    const ctx = ac();
    const out = outNode(pos, vol);
    if (!ctx || !out || !noiseBuffer) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(env).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  function playBlockSound(block: number, pos: THREE.Vector3 | null, action: 'break' | 'place' | 'step' | 'dig') {
    const kind = block === BLOCK_STONE || block === BLOCK_BEDROCK || block === BLOCK_OBSIDIAN || isConcrete(block) || (block >= BLOCK_COAL_ORE && block <= BLOCK_EMERALD_ORE) ? 'stone'
      : block === BLOCK_WOOD || block === BLOCK_CRAFTING_TABLE || block === ITEM_PLANKS ? 'wood'
      : block === BLOCK_SAND ? 'sand'
      : block === BLOCK_SNOW ? 'snow'
      : 'grass';
    const vol = action === 'break' ? 0.9 : action === 'place' ? 0.75 : action === 'dig' ? 0.35 : 0.22;
    const dur = action === 'break' ? 0.22 : action === 'place' ? 0.14 : action === 'dig' ? 0.07 : 0.09;
    if (kind === 'stone') noiseHit(pos, 'bandpass', 2200, 900, dur, vol, 0, 1.2);
    else if (kind === 'wood') { noiseHit(pos, 'bandpass', 700, 400, dur, vol, 0, 2.5); tone(pos, 'triangle', 220, 140, dur * 0.8, vol * 0.35); }
    else if (kind === 'sand') noiseHit(pos, 'highpass', 3000, 2000, dur * 1.2, vol * 0.8);
    else if (kind === 'snow') noiseHit(pos, 'lowpass', 2500, 1200, dur * 1.2, vol * 0.7);
    else noiseHit(pos, 'lowpass', 1400, 500, dur, vol);
  }

  function playMobSound(kind: MobKind, pos: THREE.Vector3, hurt: boolean) {
    switch (kind) {
      case 'pig':
        if (hurt) tone(pos, 'square', 420, 300, 0.2, 0.25, 0, 25);
        else { tone(pos, 'square', 320, 240, 0.12, 0.22, 0, 30); tone(pos, 'square', 300, 220, 0.12, 0.18, 0.15, 30); }
        break;
      case 'cow':
        tone(pos, 'sawtooth', hurt ? 190 : 150, hurt ? 130 : 110, hurt ? 0.4 : 0.9, 0.2, 0, 6);
        break;
      case 'chicken':
        if (hurt) tone(pos, 'sine', 1800, 900, 0.15, 0.2);
        else for (let i = 0; i < 3; i++) tone(pos, 'sine', 1500, 1100, 0.06, 0.16, i * 0.09);
        break;
      case 'zombie':
        tone(pos, 'sawtooth', hurt ? 130 : 95, hurt ? 80 : 70, hurt ? 0.3 : 0.9, 0.28, 0, 8);
        break;
      case 'skeleton':
        for (let i = 0; i < 4; i++) noiseHit(pos, 'bandpass', 2600, 2200, 0.04, 0.4, i * 0.06, 4);
        if (hurt) tone(pos, 'square', 400, 300, 0.1, 0.15);
        break;
      case 'spider':
        for (let i = 0; i < 2; i++) noiseHit(pos, 'bandpass', 3200, 2600, 0.05, 0.35, i * 0.08, 5);
        if (hurt) tone(pos, 'square', 520, 380, 0.1, 0.15);
        break;
      case 'ghast': // an eerie, wavering wail
        tone(pos, 'sine', hurt ? 900 : 420, hurt ? 500 : 720, hurt ? 0.3 : 1.4, 0.3, 0, 6);
        tone(pos, 'sine', hurt ? 700 : 330, hurt ? 400 : 560, hurt ? 0.3 : 1.2, 0.18, 0.05, 5);
        break;
      case 'piglin':
        tone(pos, 'sawtooth', hurt ? 260 : 170, hurt ? 160 : 110, hurt ? 0.25 : 0.5, 0.25, 0, 18);
        noiseHit(pos, 'bandpass', 700, 400, 0.12, 0.4, 0.05, 2);
        break;
      case 'villager': // the famous "hmm"
        tone(pos, 'sawtooth', hurt ? 330 : 250, hurt ? 220 : 190, hurt ? 0.25 : 0.32, 0.22, 0, 10);
        tone(pos, 'square', hurt ? 300 : 230, hurt ? 200 : 180, hurt ? 0.2 : 0.28, 0.1, 0.02, 12);
        break;
      case 'iron_golem':
        noiseHit(pos, 'lowpass', 600, 150, hurt ? 0.3 : 0.5, 0.7, 0, 2);
        tone(pos, 'triangle', hurt ? 800 : 95, hurt ? 420 : 65, hurt ? 0.3 : 0.55, 0.3);
        break;
      default: // creepers are silent until they hiss
        if (hurt) noiseHit(pos, 'bandpass', 1500, 900, 0.15, 0.4, 0, 2);
    }
  }

  function playSfx(name: 'hurt' | 'pickup' | 'eat' | 'bow' | 'arrowHit' | 'hiss' | 'explode' | 'land' | 'splash' | 'teleport' | 'throw' | 'gunshot' | 'reload' | 'click' | 'ding' | 'pop' | 'fireball', pos: THREE.Vector3 | null) {
    switch (name) {
      case 'hurt': tone(pos, 'square', 280, 160, 0.18, 0.3); noiseHit(pos, 'lowpass', 900, 400, 0.12, 0.3); break;
      case 'pickup': tone(pos, 'sine', 700, 1300, 0.09, 0.22); break;
      case 'eat': for (let i = 0; i < 3; i++) noiseHit(pos, 'bandpass', 1800, 1200, 0.07, 0.5, i * 0.14, 2); break;
      case 'bow': noiseHit(pos, 'bandpass', 1400, 600, 0.18, 0.5); tone(pos, 'triangle', 520, 180, 0.14, 0.3); break;
      case 'arrowHit': noiseHit(pos, 'bandpass', 900, 500, 0.07, 0.6, 0, 3); break;
      case 'hiss': noiseHit(pos, 'highpass', 3500, 2500, 1.5, 0.7, 0, 1, 1.2); break;
      case 'explode': noiseHit(pos, 'lowpass', 3000, 60, 1.6, 1.6); tone(pos, 'sine', 80, 30, 0.9, 0.9); break;
      case 'splash': noiseHit(pos, 'lowpass', 1400, 300, 0.4, 0.6); break;
      case 'teleport': tone(pos, 'sine', 300, 900, 0.25, 0.3); noiseHit(pos, 'bandpass', 2400, 1200, 0.2, 0.3, 0, 2); break;
      case 'throw': noiseHit(pos, 'bandpass', 900, 400, 0.15, 0.4); break;
      case 'gunshot': noiseHit(pos, 'lowpass', 5000, 300, 0.2, 0.9); tone(pos, 'square', 160, 50, 0.09, 0.35); break;
      case 'reload': noiseHit(pos, 'bandpass', 2600, 1800, 0.05, 0.4); noiseHit(pos, 'bandpass', 2000, 1400, 0.06, 0.4, 0.18); break;
      case 'click': noiseHit(pos, 'bandpass', 3200, 2400, 0.03, 0.3); break;
      case 'ding': tone(pos, 'sine', 1320, 1320, 0.35, 0.25); tone(pos, 'sine', 1980, 1980, 0.3, 0.12); break;
      case 'pop': tone(pos, 'sine', 650, 220, 0.09, 0.35); break;
      case 'fireball': noiseHit(pos, 'bandpass', 1200, 300, 0.45, 0.6); tone(pos, 'sawtooth', 220, 90, 0.4, 0.3); break;
      default: noiseHit(pos, 'lowpass', 500, 200, 0.12, 0.4);
    }
  }

  function setSfxVolume(v: number) {
    sfxVolume = v;
    if (sfxGain) sfxGain.gain.value = v;
  }

  // =================================================================
  //  Particles (block debris, explosions, mob death puffs)
  // =================================================================
  type Particle = { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; size: number };
  const particles: Particle[] = [];
  const particleGeo = new THREE.BoxGeometry(1, 1, 1);
  const particleMats = new Map<string, THREE.MeshLambertMaterial>();

  function spawnParticles(pos: THREE.Vector3, colors: string[], count: number, speed: number, size: number, life: number) {
    for (let i = 0; i < count && particles.length < 400; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      let m = particleMats.get(color);
      if (!m) { m = new THREE.MeshLambertMaterial({ color }); particleMats.set(color, m); }
      const mesh = new THREE.Mesh(particleGeo, m);
      const sz = size * (0.6 + Math.random() * 0.6);
      mesh.scale.setScalar(sz);
      mesh.position.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y + (Math.random() - 0.5) * 0.6, pos.z + (Math.random() - 0.5) * 0.6);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      scene.add(mesh);
      particles.push({ mesh, vel, life: 0, maxLife: life * (0.6 + Math.random() * 0.6), size: sz });
    }
  }

  function spawnBlockParticles(block: number, bx: number, by: number, bz: number) {
    const base = ITEM_INFO[block]?.color ?? '#888888';
    spawnParticles(new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5), [base, shadeColor(base, -0.15), shadeColor(base, 0.12)], 14, 2.5, 0.12, 0.7);
  }

  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
      p.vel.y -= 18 * dt;
      const nx = p.mesh.position.x + p.vel.x * dt;
      const ny = p.mesh.position.y + p.vel.y * dt;
      const nz = p.mesh.position.z + p.vel.z * dt;
      if (isSolid(world.getWorldBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) p.vel.set(0, 0, 0);
      else p.mesh.position.set(nx, ny, nz);
      p.mesh.scale.setScalar(p.size * (1 - (p.life / p.maxLife) * 0.7));
    }
  }

  // Rebuild only the chunks a block change actually touches: its own chunk,
  // plus a neighbor only when the block sits on that edge. Before, every
  // break or place rebuilt 5 chunks.
  function markDirty(bx: number, bz: number, dirty: Set<string>) {
    const cx = Math.floor(bx / CHUNK_SIZE), cz = Math.floor(bz / CHUNK_SIZE);
    const lx = bx - cx * CHUNK_SIZE, lz = bz - cz * CHUNK_SIZE;
    const xs = [cx], zs = [cz];
    if (lx === 0) xs.push(cx - 1);
    if (lx === CHUNK_SIZE - 1) xs.push(cx + 1);
    if (lz === 0) zs.push(cz - 1);
    if (lz === CHUNK_SIZE - 1) zs.push(cz + 1);
    for (const x of xs) for (const z of zs) dirty.add(world.key(x, z));
  }

  function rebuildDirty(dirty: Set<string>) {
    for (const k of dirty) {
      if (!loadedChunks.has(k)) continue;
      const [x, z] = k.split(',').map(Number);
      const c = world.getChunk(x, z);
      if (c) rebuildChunkMesh(c);
    }
  }

  function rebuildAround(bx: number, bz: number) {
    const dirty = new Set<string>();
    markDirty(bx, bz, dirty);
    rebuildDirty(dirty);
  }

  // =================================================================
  //  Player damage, eating, knockback
  // =================================================================
  const playerKnock = new THREE.Vector3();
  let playerHurtCooldown = 0;
  let regenTimer = 0;
  let digSoundTimer = 0;
  let hurtCallback: ((amount: number) => void) | null = null;

  function footprintSolid(x: number, row: number, z: number): boolean {
    const r = 0.29; // just inside the 0.3 wall-collision radius
    return (
      isSolid(world.getWorldBlock(Math.floor(x - r), row, Math.floor(z - r))) ||
      isSolid(world.getWorldBlock(Math.floor(x + r), row, Math.floor(z - r))) ||
      isSolid(world.getWorldBlock(Math.floor(x - r), row, Math.floor(z + r))) ||
      isSolid(world.getWorldBlock(Math.floor(x + r), row, Math.floor(z + r)))
    );
  }

  function playerFeet(): THREE.Vector3 {
    return new THREE.Vector3(camera.position.x, camera.position.y - PLAYER_EYE, camera.position.z);
  }

  let dead = false;
  let lastDamageCause = 'Unknown';
  let deathCallback: ((reason: string) => void) | null = null;

  function canBeAttacked() {
    return (mode === 'survival' || mode === 'adventure') && !dead;
  }

  function die(reason: string) {
    dead = true;
    isMining = false;
    miningTarget = null;
    miningProgress = 0;
    crackMesh.visible = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    playerKnock.set(0, 0, 0);
    deathCallback?.(reason);
    engineEvent('playerDeath', { cause: reason });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function respawn() {
    if (!dead) return;
    dead = false;
    if (dimension !== 'overworld') switchDimension('overworld', spawnX + 0.5, 40, spawnZ + 0.5);
    engineEvent('playerRespawn', {});
    const rs = world.getSurfaceHeight(spawnX, spawnZ);
    camera.position.set(spawnX + 0.5, rs + 1 + PLAYER_EYE + 0.5, spawnZ + 0.5);
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
    playerKnock.set(0, 0, 0);
    hungerTimer = 0;
    starveTimer = 0;
    setStats(20, 20);
    safeLock();
  }

  function hurtPlayer(amount: number, from: THREE.Vector3 | null, knock = 6, cause = 'Unknown') {
    if (!canBeAttacked() || amount <= 0 || playerHurtCooldown > 0) return;
    playerHurtCooldown = 0.5; // brief invulnerability, like Minecraft
    lastDamageCause = cause;
    if (blockLerp > 0.5 && from) { amount *= 0.5; knock *= 0.4; } // blocking with a sword
    // Armor soaks up damage (Minecraft's formula): 20 points = 80% less. Resistance adds 20% per level.
    if (cause !== 'Starvation' && cause !== '/kill command' && cause !== 'Falling out of the world') {
      amount *= 1 - Math.min(20, armorPoints()) / 25;
      amount *= Math.max(0, 1 - 0.2 * effectLevel('resistance'));
      amount = Math.max(1, Math.round(amount));
    }
    setStats(health - amount, hunger);
    engineEvent('playerDamage', { amount, cause });
    if (from) {
      const dir = playerFeet().sub(from);
      dir.y = 0;
      if (dir.lengthSq() > 0) dir.normalize();
      playerKnock.set(dir.x * knock, 0, dir.z * knock);
      velocityY = Math.max(velocityY, 5);
    }
    playSfx('hurt', null);
    hurtCallback?.(amount);
  }

  function tryEat(): boolean {
    if (heldItem === null || !FOOD_VALUES[heldItem] || !canBeAttacked()) return false;
    if (hunger >= 20 || !slots[selectedSlot]) return false;
    const food = FOOD_VALUES[heldItem];
    consumeHeld(1);
    setStats(health, hunger + food);
    playSfx('eat', null);
    punchPhase = PUNCH_DURATION;
    return true;
  }

  // =================================================================
  //  Mobs
  // =================================================================
  type Mob = {
    kind: MobKind; model: MobModel; pos: THREE.Vector3; velY: number; knock: THREE.Vector3;
    yaw: number; targetYaw: number; health: number; hurtTime: number; deathTime: number;
    onGround: boolean; wanderTimer: number; moving: boolean; walkPhase: number;
    attackCooldown: number; attackAnim: number; fuse: number; panicTime: number;
    idleSoundTimer: number; shootCooldown: number; strafeDir: number; strafeTimer: number; burnTimer: number;
    angry: boolean; // spiders only attack in daylight after being hit
    id: number;
    grudge: number; // iron golems: seconds left that they're out to get the player
    home?: { x: number; z: number; r: number }; // village inhabitants stay near here
  };
  const mobs: Mob[] = [];
  let nextMobId = 0;
  let mobSpawnTimer = 0;
  // Village inhabitants: which slot (a house, a golem) has been filled this visit, and who was killed
  const villageMobIds = new Map<string, Map<string, number>>();
  const villageKilled = new Set<number>();
  let villageTimer = 0;
  const MAX_PASSIVE = 10;
  const MAX_HOSTILE = 6;

  const yawToward = (dx: number, dz: number) => Math.atan2(-dx, -dz);
  const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function spawnMob(kind: MobKind, pos: THREE.Vector3, home?: { x: number; z: number; r: number }) {
    const model = buildMobModel(kind, Math.floor(Math.random() * 5));
    model.root.position.copy(pos);
    scene.add(model.root);
    const yaw0 = Math.random() * Math.PI * 2;
    mobs.push({
      kind, model, pos: pos.clone(), velY: 0, knock: new THREE.Vector3(),
      yaw: yaw0, targetYaw: yaw0, health: MOB_INFO[kind].hp, hurtTime: 0, deathTime: -1,
      onGround: false, wanderTimer: Math.random() * 3, moving: false, walkPhase: 0,
      attackCooldown: 0, attackAnim: 0, fuse: 0, panicTime: 0,
      idleSoundTimer: 5 + Math.random() * 10, shootCooldown: 2, strafeDir: Math.random() < 0.5 ? 1 : -1, strafeTimer: 2, burnTimer: 1, angry: false, id: ++nextMobId, grudge: 0, home,
    });
  }

  function removeMob(i: number) {
    const m = mobs[i];
    scene.remove(m.model.root);
    disposeObject(m.model.root);
    for (const t of m.model.textures) t.dispose();
    mobs.splice(i, 1);
  }

  function summonMob(kind: string): boolean {
    if (!(MOB_KINDS as string[]).includes(kind)) return false;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() === 0) dir.set(0, 0, -1);
    dir.normalize();
    const x = camera.position.x + dir.x * 3, z = camera.position.z + dir.z * 3;
    let y = Math.floor(camera.position.y - PLAYER_EYE);
    for (let i = 0; i < 12 && isSolid(world.getWorldBlock(Math.floor(x), y, Math.floor(z))); i++) y++;
    for (let i = 0; i < 12 && !isSolid(world.getWorldBlock(Math.floor(x), y - 1, Math.floor(z))); i++) y--;
    spawnMob(kind as MobKind, new THREE.Vector3(x, y, z));
    return true;
  }

  /** The closest living mob of the given kinds within range (sideways) and about the same height. */
  function nearestMob(from: Mob, kinds: MobKind[], range: number): Mob | null {
    let best: Mob | null = null;
    let bestD = range;
    for (const o of mobs) {
      if (o === from || o.deathTime >= 0 || !kinds.includes(o.kind)) continue;
      const d = Math.hypot(o.pos.x - from.pos.x, o.pos.z - from.pos.z);
      if (d < bestD && Math.abs(o.pos.y - from.pos.y) < 4) { bestD = d; best = o; }
    }
    return best;
  }

  /** Piglins mind their own business when you wear any gold armor, like Minecraft. */
  function wearsGold(): boolean {
    return armor.some((a) => a !== null && ARMOR[a.id]?.material === 'gold');
  }

  // ---- Ghast: floats, keeps its distance, and spits explosive fireballs ----
  function ghastShoot(m: Mob, from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from).normalize();
    const o = from.clone().addScaledVector(dir, 2.0); // start just outside its face
    spawnProjectile({
      x: o.x, y: o.y, z: o.z, vx: dir.x * 11, vy: dir.y * 11, vz: dir.z * 11,
      gravity: 0, damage: 0, color: '#ff7a1a', size: 0.75, lifetime: 8, explosion: 2, knockback: 0,
      ownerId: m.id, ownerKind: 'ghast', hitsPlayer: true, cause: 'Ghast fireball', maxDamage: 8,
    });
    playSfx('fireball', m.pos);
  }

  function updateGhast(m: Mob, dt: number) {
    const info = MOB_INFO.ghast;
    const half = info.width / 2;
    const root = m.model.root;
    const center = new THREE.Vector3(m.pos.x, m.pos.y + 1.75, m.pos.z);
    const aim = playerFeet();
    aim.y += 1.0;
    const dx = aim.x - center.x, dy = aim.y - center.y, dz = aim.z - center.z;
    const dh = Math.hypot(dx, dz) || 0.001, dist = Math.hypot(dh, dy) || 0.001;
    const seen = canBeAttacked() && dist < 48 && lineOfSight(center, aim);
    let vx = 0, vy = 0, vz = 0;
    if (seen) {
      m.targetYaw = yawToward(dx, dz);
      if (dist > 24) { vx = (dx / dist) * info.speed; vz = (dz / dist) * info.speed; } // close in
      else if (dist < 13) { vx = (-dx / dist) * info.speed; vz = (-dz / dist) * info.speed; } // back off
      else {
        m.strafeTimer -= dt; // circle slowly
        if (m.strafeTimer <= 0) { m.strafeDir *= -1; m.strafeTimer = 2 + Math.random() * 3; }
        vx = (dz / dh) * m.strafeDir * info.speed * 0.4;
        vz = (-dx / dh) * m.strafeDir * info.speed * 0.4;
      }
      vy = Math.max(-1.5, Math.min(1.5, aim.y + 5 - center.y)) * 0.8; // hover a little above you
      m.shootCooldown -= dt;
      if (m.shootCooldown <= 0) {
        m.fuse += dt; // charging: the face turns angry
        if (m.fuse >= 1.1) {
          ghastShoot(m, center, aim);
          m.fuse = 0;
          m.shootCooldown = 3 + Math.random() * 1.5;
        }
      }
    } else {
      m.fuse = 0;
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.moving = Math.random() < 0.75;
        m.targetYaw = Math.random() * Math.PI * 2;
        m.strafeDir = Math.random() < 0.5 ? 1 : -1;
        m.wanderTimer = 3 + Math.random() * 4;
      }
      if (m.moving) { vx = -Math.sin(m.yaw) * info.speed * 0.45; vz = -Math.cos(m.yaw) * info.speed * 0.45; vy = m.strafeDir * 0.35; }
    }
    if (m.pos.y < 18) vy = Math.max(vy, 1.2); else if (m.pos.y > 50) vy = Math.min(vy, -1.2); // stay in the cavern band
    m.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, angleDiff(m.targetYaw, m.yaw)));
    const kx = m.knock.x, kz = m.knock.z, ky = m.velY; // hits shove it around
    const decay = Math.max(0, 1 - 5 * dt);
    m.knock.multiplyScalar(decay);
    m.velY *= decay;
    const nx = m.pos.x + (vx + kx) * dt;
    if (!mobBlocked(nx, m.pos.y, m.pos.z, half, info.height)) m.pos.x = nx;
    else if (!seen) { m.targetYaw += Math.PI; m.wanderTimer = 2; } // bumped a wall: turn around
    const nz = m.pos.z + (vz + kz) * dt;
    if (!mobBlocked(m.pos.x, m.pos.y, nz, half, info.height)) m.pos.z = nz;
    else if (!seen) { m.targetYaw += Math.PI; m.wanderTimer = 2; }
    const ny = m.pos.y + (vy + ky) * dt;
    if (!mobBlocked(m.pos.x, ny, m.pos.z, half, info.height)) m.pos.y = ny;
    else m.velY = 0;

    // Tentacles sway, and the face shows when it's about to fire
    const t = performance.now() / 1000;
    m.model.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 2.2 + i * 0.9) * 0.22; l.rotation.z = Math.cos(t * 1.8 + i * 1.3) * 0.22; });
    const face = root.userData.ghastFace as { mesh: THREE.Mesh; calm: THREE.Material; angry: THREE.Material } | undefined;
    if (face) (face.mesh.material as THREE.Material[])[5] = m.fuse > 0.05 || m.shootCooldown > 2.4 ? face.angry : face.calm;
    for (const mt of m.model.materials) { if (m.hurtTime > 0.3) mt.emissive.setRGB(0.6, 0, 0); else mt.emissive.setRGB(0, 0, 0); }
    root.scale.setScalar(1);
    root.position.copy(m.pos);
    root.rotation.y = m.yaw;
    m.idleSoundTimer -= dt;
    if (m.idleSoundTimer <= 0) { playMobSound('ghast', m.pos, false); m.idleSoundTimer = 7 + Math.random() * 8; }
  }

  // ---- The Nether has its own wildlife ----
  function trySpawnNetherMob() {
    let ghasts = 0, piglins = 0;
    for (const m of mobs) { if (m.kind === 'ghast') ghasts++; else if (m.kind === 'piglin') piglins++; }
    const wantGhast = Math.random() < 0.35;
    if (wantGhast ? ghasts >= 2 : piglins >= 6) return;
    // A few random spots around you per attempt (most spots are solid rock or too tight)
    for (let tries = 0; tries < 12; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 26;
      const x = Math.floor(camera.position.x + Math.cos(ang) * dist);
      const z = Math.floor(camera.position.z + Math.sin(ang) * dist);
      if (!loadedChunks.has(world.key(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))) continue;
      if (wantGhast) {
        // Needs room for its whole body plus a margin, and no lava underneath its middle
        const y = 20 + Math.floor(Math.random() * 28);
        if (mobBlocked(x + 0.5, y, z + 0.5, 2.3, 3.6) || isFluid(world.getWorldBlock(x, y + 1, z))) continue;
        spawnMob('ghast', new THREE.Vector3(x + 0.5, y, z + 0.5));
        return;
      }
      // Piglins: a cavern floor (solid ground with two blocks of air above)
      for (let y = 56; y > 14; y--) {
        const g = world.getWorldBlock(x, y, z);
        if (!isSolid(g) || g === BLOCK_BEDROCK) continue;
        if (world.getWorldBlock(x, y + 1, z) !== BLOCK_AIR || world.getWorldBlock(x, y + 2, z) !== BLOCK_AIR) continue;
        if (g !== BLOCK_NETHERRACK && g !== BLOCK_SOUL_SAND) break; // glowstone, ore...: look elsewhere
        const pack = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < pack && piglins + i < 6; i++) {
          spawnMob('piglin', new THREE.Vector3(x + 0.5 + (Math.random() - 0.5) * 2, y + 1, z + 0.5 + (Math.random() - 0.5) * 2));
        }
        return;
      }
    }
  }

  // ---- Villages: villagers and an iron golem appear as you approach, once per visit ----
  function updateVillages(dt: number) {
    villageTimer += dt;
    if (villageTimer < 2) return;
    villageTimer = 0;
    if (dimension !== 'overworld') return;
    const px = camera.position.x, pz = camera.position.z;
    const rx0 = Math.floor(px / VILLAGE_REGION), rz0 = Math.floor(pz / VILLAGE_REGION);
    const reach = Math.max(32, Math.min(72, renderDistance * CHUNK_SIZE - 16)); // never spawn them where chunks aren't loaded
    for (let ax = -1; ax <= 1; ax++) {
      for (let az = -1; az <= 1; az++) {
        const v = world.villageInRegion(rx0 + ax, rz0 + az);
        if (!v) continue;
        const dist = Math.hypot(px - v.cx, pz - v.cz);
        if (dist > 220) { // you've left: next time you come back, everyone is home again
          const slots = villageMobIds.get(v.id);
          if (slots) for (const id of slots.values()) villageKilled.delete(id);
          villageMobIds.delete(v.id);
          continue;
        }
        if (dist > reach) continue;
        let slots = villageMobIds.get(v.id);
        if (!slots) { slots = new Map(); villageMobIds.set(v.id, slots); }
        const fill = (slot: string, kind: MobKind, x: number, y: number, z: number, home: { x: number; z: number; r: number }) => {
          const prev = slots!.get(slot);
          if (prev !== undefined && (villageKilled.has(prev) || mobs.some((mm) => mm.id === prev))) return; // alive, or killed this visit
          if (!loadedChunks.has(world.key(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))) return; // try again once it loads
          spawnMob(kind, new THREE.Vector3(x, y, z), home);
          slots!.set(slot, mobs[mobs.length - 1].id);
        };
        v.homes.forEach(([x, y, z], i) => fill('v' + i, 'villager', x, y, z, { x, z, r: 12 }));
        fill('g0', 'iron_golem', v.golemSpawn[0], v.golemSpawn[1], v.golemSpawn[2], { x: v.cx, z: v.cz, r: 28 });
        if (v.homes.length >= 7) fill('g1', 'iron_golem', v.cx - 3.5, v.golemSpawn[1], v.cz - 3.5, { x: v.cx, z: v.cz, r: 28 });
      }
    }
  }

  function trySpawnMob() {
    if (dimension === 'nether') { trySpawnNetherMob(); return; }
    if (dimension !== 'overworld') return;
    let passive = 0, hostile = 0;
    for (const m of mobs) { if (m.home) continue; if (MOB_INFO[m.kind].hostile) hostile++; else passive++; } // village folk don't count
    // Monsters only spawn at night; animals spawn any time
    const wantHostile = isNight() && Math.random() < 0.6;
    if (wantHostile ? hostile >= MAX_HOSTILE : passive >= MAX_PASSIVE) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 20;
    const x = Math.floor(camera.position.x + Math.cos(ang) * dist);
    const z = Math.floor(camera.position.z + Math.sin(ang) * dist);
    if (!loadedChunks.has(world.key(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))) return;
    const y = world.getSurfaceHeight(x, z);
    const ground = world.getWorldBlock(x, y, z);
    if (!isSolid(ground) || ground === BLOCK_LEAVES || y < 2 || y >= CHUNK_HEIGHT - 3) return;
    const aboveGround = world.getWorldBlock(x, y + 1, z);
    if (aboveGround !== BLOCK_AIR && aboveGround !== BLOCK_TALL_GRASS) return; // nothing spawns underwater
    if (wantHostile) {
      const kinds: MobKind[] = ['zombie', 'skeleton', 'creeper', 'spider'];
      spawnMob(kinds[Math.floor(Math.random() * kinds.length)], new THREE.Vector3(x + 0.5, y + 1, z + 0.5));
    } else {
      if (ground !== BLOCK_GRASS) return; // animals only spawn on grass
      const kinds: MobKind[] = ['pig', 'cow', 'chicken'];
      const kind = kinds[Math.floor(Math.random() * 3)];
      const herd = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < herd; i++) {
        const hx = x + Math.floor(Math.random() * 3) - 1, hz = z + Math.floor(Math.random() * 3) - 1;
        const hy = world.getSurfaceHeight(hx, hz);
        if (world.getWorldBlock(hx, hy, hz) === BLOCK_GRASS) spawnMob(kind, new THREE.Vector3(hx + 0.5, hy + 1, hz + 0.5));
      }
    }
  }

  function mobFootprintSolid(x: number, row: number, z: number, half: number): boolean {
    return (
      isSolid(world.getWorldBlock(Math.floor(x - half), row, Math.floor(z - half))) ||
      isSolid(world.getWorldBlock(Math.floor(x + half), row, Math.floor(z - half))) ||
      isSolid(world.getWorldBlock(Math.floor(x - half), row, Math.floor(z + half))) ||
      isSolid(world.getWorldBlock(Math.floor(x + half), row, Math.floor(z + half)))
    );
  }

  function mobBlocked(x: number, y: number, z: number, half: number, height: number): boolean {
    for (let row = Math.floor(y + 0.01); row <= Math.floor(y + height - 0.01); row++) {
      if (mobFootprintSolid(x, row, z, half)) return true;
    }
    return false;
  }

  function skyAbove(pos: THREE.Vector3, height: number): boolean {
    const x = Math.floor(pos.x), z = Math.floor(pos.z);
    for (let y = Math.floor(pos.y + height); y < CHUNK_HEIGHT; y++) {
      if (world.getWorldBlock(x, y, z) !== BLOCK_AIR) return false;
    }
    return true;
  }

  function lineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = b.clone().sub(a);
    const len = d.length();
    if (len === 0) return true;
    d.divideScalar(len);
    for (let t = 0.3; t < len; t += 0.3) {
      const p = a.clone().addScaledVector(d, t);
      if (isSolid(world.getWorldBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) return false;
    }
    return true;
  }

  function hurtMob(m: Mob, amount: number, from: THREE.Vector3, knock = 7, ignoreInvulnerable = false, byPlayer = false): boolean {
    if (m.deathTime >= 0 || (m.hurtTime > 0 && !ignoreInvulnerable)) return false;
    if (m.kind === 'iron_golem') knock *= 0.2; // it barely budges
    m.health -= amount;
    m.hurtTime = 0.5;
    const dir = m.pos.clone().sub(from);
    dir.y = 0;
    if (dir.lengthSq() > 0) dir.normalize();
    m.knock.set(dir.x * knock, 0, dir.z * knock);
    m.velY = 5;
    m.onGround = false;
    if (!MOB_INFO[m.kind].hostile && m.kind !== 'iron_golem') m.panicTime = 4;
    m.angry = true;
    if (byPlayer) {
      if (m.kind === 'iron_golem') m.grudge = 25;
      // Golems protect villagers: hurt one and every golem nearby comes for you
      if (m.kind === 'villager') for (const g of mobs) if (g.kind === 'iron_golem' && g.pos.distanceTo(m.pos) < 32) g.grudge = 25;
      // Piglins stick together
      if (m.kind === 'piglin') for (const o of mobs) if (o.kind === 'piglin' && o.pos.distanceTo(m.pos) < 20) o.angry = true;
    }
    playMobSound(m.kind, m.pos, true);
    if (m.health <= 0) {
      m.deathTime = 0;
      m.fuse = 0;
      engineEvent('entityDeath', { id: m.id, type: m.kind, x: m.pos.x, y: m.pos.y, z: m.pos.z });
      if (m.home) villageKilled.add(m.id); // killed villagers stay dead until you leave the area
      for (const [id, count] of mobDrops(m.kind)) {
        spawnDroppedItem(id, count, m.pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
          new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.4);
      }
    }
    return true;
  }

  function weaponDamage(): number {
    return heldTool()?.damage ?? 1; // bare hands do 1
  }

  // The closest living mob under the crosshair (ray vs. each mob's box), unless a block is in the way
  function mobInSight(maxDist: number): Mob | null {
    const o = camera.position;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let best: Mob | null = null;
    let bestT = maxDist;
    for (const m of mobs) {
      if (m.deathTime >= 0) continue;
      const info = MOB_INFO[m.kind];
      const h = info.width / 2;
      const mins = [m.pos.x - h, m.pos.y, m.pos.z - h];
      const maxs = [m.pos.x + h, m.pos.y + info.height, m.pos.z + h];
      const os = [o.x, o.y, o.z], ds = [dir.x, dir.y, dir.z];
      let tmin = 0, tmax = bestT, hit = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(ds[a]) < 1e-8) {
          if (os[a] < mins[a] || os[a] > maxs[a]) { hit = false; break; }
        } else {
          let t1 = (mins[a] - os[a]) / ds[a], t2 = (maxs[a] - os[a]) / ds[a];
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) { hit = false; break; }
        }
      }
      if (hit && tmin < bestT) { best = m; bestT = tmin; }
    }
    if (best) {
      const b = raycastBlock();
      if (b) {
        const bd = Math.hypot(b.x + 0.5 - o.x, b.y + 0.5 - o.y, b.z + 0.5 - o.z) - 0.5;
        if (bd < bestT) return null;
      }
    }
    return best;
  }

  function attackMobInSight(): boolean {
    const m = mobInSight(3.5);
    if (!m) return false;
    hurtMob(m, weaponDamage(), camera.position, 7, false, true);
    engineEvent('playerHit', { target: { id: m.id, type: m.kind }, damage: weaponDamage() });
    return true;
  }

  // ---- Arrows ----
  const arrowShaftGeo = new THREE.BoxGeometry(0.04, 0.04, 0.6);
  const arrowTipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
  const arrowShaftMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3c });
  const arrowTipMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const arrows: Array<{ mesh: THREE.Group; pos: THREE.Vector3; vel: THREE.Vector3; life: number; stuck: boolean; owner: 'mob' | 'player'; damage: number }> = [];

  function shootArrow(m: Mob) {
    const from = m.pos.clone();
    from.y += 1.45;
    const target = playerFeet();
    target.y += 1.0;
    const d = target.clone().sub(from);
    const dh = Math.hypot(d.x, d.z);
    if (dh < 0.5) return;
    const speed = 20;
    const t = dh / speed;
    // Aim a little high to make up for gravity, plus some spread
    const vel = new THREE.Vector3((d.x / dh) * speed, (d.y + 0.5 * 20 * t * t) / t, (d.z / dh) * speed);
    vel.x += (Math.random() - 0.5) * 1.2;
    vel.y += (Math.random() - 0.5) * 0.8;
    vel.z += (Math.random() - 0.5) * 1.2;
    from.x += (d.x / dh) * 0.6;
    from.z += (d.z / dh) * 0.6;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(arrowShaftGeo, arrowShaftMat));
    const tip = new THREE.Mesh(arrowTipGeo, arrowTipMat);
    tip.position.z = 0.32;
    mesh.add(tip);
    mesh.position.copy(from);
    scene.add(mesh);
    arrows.push({ mesh, pos: from, vel, life: 0, stuck: false, owner: 'mob', damage: 3 });
    playSfx('bow', m.pos);
  }

  function updateArrows(dt: number) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.life += dt;
      if (a.stuck) {
        // Your own arrows can be picked back up, like Minecraft
        const body = playerFeet().add(new THREE.Vector3(0, 0.9, 0));
        if (a.owner === 'player' && a.life > 0.3 && mode !== 'spectator' && !dead && a.pos.distanceTo(body) < 1.4 && canFit(ITEM_ARROW)) {
          if (mode !== 'creative') addItem(ITEM_ARROW, 1);
          playSfx('pickup', null);
          scene.remove(a.mesh);
          arrows.splice(i, 1);
          continue;
        }
        if (a.life > (a.owner === 'player' ? 60 : 4)) { scene.remove(a.mesh); arrows.splice(i, 1); }
        continue;
      }
      a.vel.y -= 20 * dt;
      // Sub-steps so a fast arrow can't skip past the player at low FPS
      const steps = Math.max(1, Math.ceil((a.vel.length() * dt) / 0.25));
      let removed = false;
      for (let s = 0; s < steps; s++) {
        const next = a.pos.clone().addScaledVector(a.vel, dt / steps);
        if (a.owner === 'player') {
          const victim = mobs.find((mm) => {
            if (mm.deathTime >= 0) return false;
            const inf = MOB_INFO[mm.kind];
            return Math.abs(next.x - mm.pos.x) < inf.width / 2 + 0.1 && Math.abs(next.z - mm.pos.z) < inf.width / 2 + 0.1 && next.y > mm.pos.y && next.y < mm.pos.y + inf.height;
          });
          if (victim) {
            hurtMob(victim, a.damage, a.pos.clone().sub(a.vel.clone().normalize()), 7, false, true);
            scene.remove(a.mesh);
            arrows.splice(i, 1);
            removed = true;
            break;
          }
        } else if (mode !== 'spectator') {
          const f = playerFeet();
          if (Math.hypot(next.x - f.x, next.z - f.z) < 0.45 && next.y > f.y && next.y < f.y + PLAYER_HEIGHT + 0.1) {
            hurtPlayer(3, a.pos.clone().sub(a.vel.clone().normalize()), 4, 'Skeleton (arrow)');
            scene.remove(a.mesh);
            arrows.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (isSolid(world.getWorldBlock(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z)))) {
          a.stuck = true;
          a.life = 0;
          playSfx('arrowHit', a.pos);
          break;
        }
        a.pos.copy(next);
      }
      if (removed) continue;
      a.mesh.position.copy(a.pos);
      if (!a.stuck) a.mesh.lookAt(a.pos.clone().add(a.vel));
      if (a.life > 8) { scene.remove(a.mesh); arrows.splice(i, 1); }
    }
  }

  // ---- Explosions (creepers) ----
  function dropFromExplosion(b: number): number | null {
    if (b === BLOCK_LEAVES) return null;
    if (b === BLOCK_GRASS) return BLOCK_DIRT;
    if (b === BLOCK_COAL_ORE) return ITEM_COAL;
    if (b === BLOCK_DIAMOND_ORE) return ITEM_DIAMOND;
    if (b === BLOCK_EMERALD_ORE) return ITEM_EMERALD;
    return b;
  }

  function explode(center: THREE.Vector3, power: number, cause = 'Explosion', spare?: (m: Mob) => boolean, maxDamage = 18) {
    const dirty = new Set<string>();
    const cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
    for (let dx = -power; dx <= power; dx++) {
      for (let dy = -power; dy <= power; dy++) {
        for (let dz = -power; dz <= power; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > power - 0.3 + Math.random() * 0.6) continue; // ragged crater edge
          const bx = cx + dx, by = cy + dy, bz = cz + dz;
          const b = world.getWorldBlock(bx, by, bz);
          if (b === BLOCK_AIR || b === BLOCK_BEDROCK || isFluid(b)) continue;
          if (b === BLOCK_CHEST) spillChest(bx, by, bz);
          if (b === BLOCK_FURNACE) spillFurnace(bx, by, bz);
          setBlockAndNotify(bx, by, bz, BLOCK_AIR);
          markDirty(bx, bz, dirty);
          if (Math.random() < 0.3) {
            const drop = dropFromExplosion(b);
            if (drop !== null) {
              spawnDroppedItem(drop, 1, new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5),
                new THREE.Vector3((Math.random() - 0.5) * 4, 4 + Math.random() * 3, (Math.random() - 0.5) * 4), 0.5);
            }
          }
        }
      }
    }
    rebuildDirty(dirty);
    spawnParticles(center, ['#f5f5f5', '#bdbdbd', '#7a7a7a', '#ffb347', '#ff7a1a'], 70, 9, 0.22, 1.2);
    playSfx('explode', center);

    const reach = power * 2;
    const body = playerFeet();
    body.y += 0.9;
    const pd = body.distanceTo(center);
    if (pd < reach) {
      playerHurtCooldown = 0; // explosions always land
      hurtPlayer(Math.max(1, Math.round((1 - pd / reach) * maxDamage)), center, 4 + 12 * (1 - pd / reach), cause);
    }
    for (const m of mobs) {
      const md = m.pos.distanceTo(center);
      if (md < reach && !spare?.(m)) hurtMob(m, Math.round((1 - md / reach) * 15), center, 10);
    }
  }

  function updateMob(m: Mob, dt: number): 'remove' | void {
    const info = MOB_INFO[m.kind];
    const half = info.width / 2;
    const root = m.model.root;

    if (m.deathTime >= 0) {
      // Tip over, then vanish in a puff
      m.deathTime += dt;
      root.rotation.z = Math.min(Math.PI / 2, m.deathTime * 4);
      for (const mt of m.model.materials) mt.emissive.setRGB(0.5, 0, 0);
      if (m.deathTime > 0.7) {
        spawnParticles(m.pos.clone().add(new THREE.Vector3(0, info.height / 2, 0)), ['#ffffff', '#dddddd', '#bbbbbb'], 12, 2, 0.15, 0.6);
        return 'remove';
      }
      return;
    }

    m.hurtTime = Math.max(0, m.hurtTime - dt);
    m.attackCooldown = Math.max(0, m.attackCooldown - dt);
    m.grudge = Math.max(0, m.grudge - dt);

    // Zombies and skeletons catch fire in daylight when nothing shades them
    if ((m.kind === 'zombie' || m.kind === 'skeleton') && sunDir.y > 0.1 && skyAbove(m.pos, info.height)) {
      if (Math.random() < dt * 12) {
        spawnParticles(m.pos.clone().add(new THREE.Vector3(0, info.height * 0.7, 0)), ['#ff9b1a', '#ffcf33', '#ff5a1a'], 1, 1.2, 0.12, 0.4);
      }
      m.burnTimer -= dt;
      if (m.burnTimer <= 0) {
        m.burnTimer = 1;
        if (hurtMob(m, 1, m.pos, 0) && m.deathTime >= 0) return;
      }
    }
    m.attackAnim = Math.max(0, m.attackAnim - dt);
    if (m.kind === 'ghast') { updateGhast(m, dt); return; } // it flies, so it has its own movement

    const feet = playerFeet();
    const dx = feet.x - m.pos.x, dz = feet.z - m.pos.z, dy = feet.y - m.pos.y;
    const dh = Math.hypot(dx, dz);
    // Spiders are calm in daylight unless you hit them, like Minecraft
    const hunting = info.hostile && canBeAttacked() && dh < 20 && Math.abs(dy) < 12 && (m.kind !== 'spider' || isNight() || m.angry) && (m.kind !== 'piglin' || m.angry || !wearsGold());
    let wantX = 0, wantZ = 0;
    const toward = (s: number) => { if (dh > 0.01) { wantX = (dx / dh) * s; wantZ = (dz / dh) * s; } };
    const wander = (s: number) => {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.moving = Math.random() < 0.55;
        m.targetYaw = Math.random() * Math.PI * 2;
        m.wanderTimer = 2 + Math.random() * 4;
      }
      if (m.moving) { wantX = -Math.sin(m.yaw) * s; wantZ = -Math.cos(m.yaw) * s; }
    };

    // Village folk wander, but drift back toward home when they stray too far
    const homeSteer = (speed: number) => {
      const h = m.home;
      if (h) {
        const hx = h.x - m.pos.x, hz = h.z - m.pos.z;
        if (Math.hypot(hx, hz) > h.r) { m.targetYaw = yawToward(hx, hz); m.moving = true; m.wanderTimer = 1.5; }
      }
      wander(speed);
    };

    if (!info.hostile) {
      if (m.panicTime > 0) {
        m.panicTime -= dt;
        if (Math.random() < dt * 2) m.targetYaw = Math.random() * Math.PI * 2;
        wantX = -Math.sin(m.yaw) * info.speed * 2;
        wantZ = -Math.cos(m.yaw) * info.speed * 2;
      } else if (m.kind === 'iron_golem') {
        // Guards the village: smashes monsters, and goes after you if you hurt a villager or it
        let chase: THREE.Vector3 | null = null;
        let victim: Mob | null = null;
        let targetIsPlayer = false;
        if (m.grudge > 0 && canBeAttacked() && dh < 26) { chase = feet; targetIsPlayer = true; }
        else { victim = nearestMob(m, ['zombie', 'skeleton', 'creeper', 'spider'], 15); if (victim) chase = victim.pos; }
        if (chase) {
          const cdx = chase.x - m.pos.x, cdz = chase.z - m.pos.z, cd = Math.hypot(cdx, cdz) || 0.001;
          m.targetYaw = yawToward(cdx, cdz);
          m.moving = true;
          if (cd > 2.2) { wantX = (cdx / cd) * info.speed * 1.5; wantZ = (cdz / cd) * info.speed * 1.5; }
          if (cd < 2.8 && m.attackCooldown <= 0 && Math.abs(chase.y - m.pos.y) < 3) {
            m.attackCooldown = 1.3;
            m.attackAnim = 0.4;
            if (targetIsPlayer) hurtPlayer(14, m.pos, 14, 'Iron Golem');
            else if (victim) { hurtMob(victim, 15, m.pos, 12, true); victim.velY = 9; victim.onGround = false; } // tosses it into the air
          }
        } else {
          homeSteer(info.speed * 0.6);
        }
      } else if (m.kind === 'villager') {
        // Runs from monsters, otherwise potters about near home
        const threat = nearestMob(m, ['zombie', 'skeleton', 'creeper', 'spider'], 9);
        if (threat) {
          const ax = m.pos.x - threat.pos.x, az = m.pos.z - threat.pos.z, ad = Math.hypot(ax, az) || 1;
          m.targetYaw = yawToward(ax, az);
          m.moving = true;
          wantX = (ax / ad) * info.speed * 1.9;
          wantZ = (az / ad) * info.speed * 1.9;
        } else {
          homeSteer(info.speed);
        }
      } else {
        wander(info.speed);
      }
    } else if (!hunting) {
      m.fuse = 0;
      // Zombies go after villagers when there's no player around
      const prey = m.kind === 'zombie' ? nearestMob(m, ['villager'], 14) : null;
      if (prey) {
        const pdx = prey.pos.x - m.pos.x, pdz = prey.pos.z - m.pos.z, pd = Math.hypot(pdx, pdz) || 0.001;
        m.targetYaw = yawToward(pdx, pdz);
        m.moving = true;
        if (pd > 1.0) { wantX = (pdx / pd) * info.speed; wantZ = (pdz / pd) * info.speed; }
        if (pd < 1.4 && m.attackCooldown <= 0) { hurtMob(prey, 3, m.pos, 5, true); m.attackCooldown = 1; m.attackAnim = 0.3; }
      } else {
        wander(info.speed * 0.5);
      }
    } else {
      m.targetYaw = yawToward(dx, dz);
      if (m.kind === 'zombie' || m.kind === 'spider' || m.kind === 'piglin') {
        if (dh > 1.0) toward(info.speed);
        // Spiders pounce from a few blocks away
        if (m.kind === 'spider' && m.onGround && dh > 1.5 && dh < 4 && Math.random() < dt * 1.5) {
          m.velY = 6;
          m.knock.set((dx / dh) * 5, 0, (dz / dh) * 5);
        }
        if (dh < 1.3 + (m.kind === 'spider' ? 0.4 : 0) && Math.abs(dy) < 1.6 && m.attackCooldown <= 0) {
          hurtPlayer(m.kind === 'spider' ? 2 : m.kind === 'piglin' ? 5 : 3, m.pos, 6, m.kind === 'spider' ? 'Spider' : m.kind === 'piglin' ? 'Piglin' : 'Zombie');
          m.attackCooldown = 1;
          m.attackAnim = 0.3;
        }
      } else if (m.kind === 'skeleton') {
        const eye = m.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
        const chest = feet.clone().add(new THREE.Vector3(0, 1.0, 0));
        const los = lineOfSight(eye, chest);
        if (dh > 12 || !los) toward(info.speed);
        else if (dh < 6) toward(-info.speed * 0.8); // back away to keep shooting range
        else {
          m.strafeTimer -= dt;
          if (m.strafeTimer <= 0) { m.strafeDir *= -1; m.strafeTimer = 2 + Math.random() * 2; }
          wantX = (dz / dh) * m.strafeDir * info.speed * 0.6;
          wantZ = (-dx / dh) * m.strafeDir * info.speed * 0.6;
        }
        m.shootCooldown -= dt;
        if (los && dh < 16 && m.shootCooldown <= 0) {
          shootArrow(m);
          m.shootCooldown = 1.8 + Math.random() * 0.8;
        }
      } else {
        // Creeper: walk up, hiss, explode. Get more than 7 blocks away to defuse.
        if (m.fuse > 0) {
          if (dh > 7) m.fuse = 0;
          else {
            m.fuse += dt;
            if (m.fuse >= 1.5) {
              explode(m.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 3, 'Creeper explosion');
              return 'remove'; // exploding creepers drop nothing, like Minecraft
            }
          }
        } else if (dh < 3 && Math.abs(dy) < 3) {
          m.fuse = 0.001;
          playSfx('hiss', m.pos);
        } else {
          toward(info.speed);
        }
      }
    }

    // Turn smoothly toward where we want to face
    if (hunting || m.panicTime > 0 || m.moving) {
      const diff = angleDiff(m.targetYaw, m.yaw);
      m.yaw += Math.max(-6 * dt, Math.min(6 * dt, diff));
    }

    // Move with wall collision; hop up 1-block steps
    const vx = wantX + m.knock.x, vz = wantZ + m.knock.z;
    m.knock.multiplyScalar(Math.max(0, 1 - 8 * dt));
    const wantsMove = Math.abs(wantX) + Math.abs(wantZ) > 0.01;
    const nx = m.pos.x + vx * dt;
    if (!mobBlocked(nx, m.pos.y, m.pos.z, half, info.height)) m.pos.x = nx;
    else if (m.kind === 'spider' && wantsMove) m.velY = 3.5; // spiders climb walls
    else if (m.onGround && wantsMove && !mobBlocked(nx, m.pos.y + 1.05, m.pos.z, half, info.height)) m.velY = 7.5;
    const nz = m.pos.z + vz * dt;
    if (!mobBlocked(m.pos.x, m.pos.y, nz, half, info.height)) m.pos.z = nz;
    else if (m.kind === 'spider' && wantsMove) m.velY = 3.5;
    else if (m.onGround && wantsMove && !mobBlocked(m.pos.x, m.pos.y + 1.05, nz, half, info.height)) m.velY = 7.5;

    // Gravity, ground, ceiling. Mobs float up in water and burn in lava.
    const mobFluid = world.getWorldBlock(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.4), Math.floor(m.pos.z));
    if (isWater(mobFluid)) m.velY = Math.min(m.velY + 30 * dt, 2);
    else m.velY = Math.max(-40, m.velY + GRAVITY * dt);
    if (isLava(mobFluid)) hurtMob(m, 4, m.pos, 0);
    const ny = m.pos.y + m.velY * dt;
    let landRow = -1;
    if (m.velY <= 0) {
      for (let r = Math.floor(m.pos.y - 0.001); r >= Math.floor(ny); r--) {
        if (mobFootprintSolid(m.pos.x, r, m.pos.z, half - 0.02)) { landRow = r; break; }
      }
    }
    if (landRow >= 0) {
      m.pos.y = landRow + 1;
      m.velY = 0;
      m.onGround = true;
    } else if (m.velY > 0 && mobFootprintSolid(m.pos.x, Math.floor(ny + info.height), m.pos.z, half - 0.02)) {
      m.velY = 0;
    } else {
      m.pos.y = ny;
      m.onGround = false;
    }
    if (m.pos.y < -10) return 'remove';

    // Animate: legs swing with speed, zombies reach forward, skeletons aim
    const speedNow = Math.hypot(vx, vz);
    m.walkPhase += speedNow * dt * 4;
    const swing = Math.sin(m.walkPhase) * Math.min(1, speedNow / 2) * 0.8;
    const legs = m.model.legs;
    if (legs.length === 8) {
      legs.forEach((l, i) => { l.rotation.y = (l.userData.baseY as number) + swing * (i % 2 ? 0.5 : -0.5); });
    } else if (legs.length === 4) {
      legs[0].rotation.x = swing; legs[3].rotation.x = swing;
      legs[1].rotation.x = -swing; legs[2].rotation.x = -swing;
    } else if (legs.length === 2) {
      legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
    }
    const arms = m.model.arms;
    if (m.kind === 'zombie' && arms.length === 2) {
      const reach = Math.PI / 2 - Math.sin((m.attackAnim / 0.3) * Math.PI) * 0.6;
      arms[0].rotation.x = reach + Math.sin(m.walkPhase * 0.5) * 0.05;
      arms[1].rotation.x = reach - Math.sin(m.walkPhase * 0.5) * 0.05;
    } else if (m.kind === 'skeleton' && arms.length === 2) {
      const aim = hunting ? Math.PI / 2 : 0;
      arms[0].rotation.x = aim - (hunting ? 0 : swing);
      arms[1].rotation.x = aim + (hunting ? 0 : swing);
    } else if (m.kind === 'piglin' && arms.length === 2) {
      const stab = Math.sin((m.attackAnim / 0.3) * Math.PI) * 0.9;
      arms[0].rotation.x = hunting ? 0.4 : -swing;
      arms[1].rotation.x = (hunting ? 1.2 : swing) + stab; // sword arm comes up and jabs
    } else if (m.kind === 'iron_golem' && arms.length === 2) {
      const smash = Math.sin((m.attackAnim / 0.4) * Math.PI) * 2.4; // both arms swing up and over
      arms[0].rotation.x = smash - swing * 0.4;
      arms[1].rotation.x = smash + swing * 0.4;
    } else if (m.kind === 'chicken' && arms.length === 2) {
      const flap = m.onGround ? 0 : Math.sin(performance.now() / 40) * 0.6;
      arms[0].rotation.z = flap;
      arms[1].rotation.z = -flap;
    }
    // Animals turn their heads to watch you when you're close
    if (!info.hostile) {
      const look = dh < 6 ? Math.max(-0.8, Math.min(0.8, angleDiff(yawToward(dx, dz), m.yaw))) : 0;
      m.model.head.rotation.y += (look - m.model.head.rotation.y) * Math.min(1, dt * 5);
    }

    // Red flash when hurt, white flashing + swelling while a creeper's fuse burns
    const fuseFlash = m.fuse > 0 && Math.floor(m.fuse * 8) % 2 === 0;
    for (const mt of m.model.materials) {
      if (m.hurtTime > 0.3) mt.emissive.setRGB(0.6, 0, 0);
      else if (fuseFlash) mt.emissive.setRGB(0.6, 0.6, 0.6);
      else mt.emissive.setRGB(0, 0, 0);
    }
    root.scale.setScalar(1 + (m.fuse > 0 ? m.fuse * 0.12 : 0));
    root.position.copy(m.pos);
    root.rotation.y = m.yaw;

    m.idleSoundTimer -= dt;
    if (m.idleSoundTimer <= 0) {
      playMobSound(m.kind, m.pos, false);
      m.idleSoundTimer = 6 + Math.random() * 8;
    }
  }

  function updateMobs(dt: number) {
    playerHurtCooldown = Math.max(0, playerHurtCooldown - dt);
    mobSpawnTimer += dt;
    if (mobSpawnTimer >= 1.5) { mobSpawnTimer = 0; trySpawnMob(); }
    updateVillages(dt);
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      const far = m.pos.distanceTo(camera.position);
      const chunkLoaded = loadedChunks.has(world.key(Math.floor(m.pos.x / CHUNK_SIZE), Math.floor(m.pos.z / CHUNK_SIZE)));
      if (!chunkLoaded || far > (MOB_INFO[m.kind].hostile ? 64 : 96)) { removeMob(i); continue; }
      if (updateMob(m, dt) === 'remove') removeMob(i);
    }
  }

  // ---- Footsteps ----
  const lastStepPos = new THREE.Vector3();
  let stepAccum = 0;
  function updateFootsteps() {
    const dx = camera.position.x - lastStepPos.x, dz = camera.position.z - lastStepPos.z;
    lastStepPos.copy(camera.position);
    if (!wasGrounded || isFlying || mode === 'spectator') return;
    const moved = Math.hypot(dx, dz);
    if (moved > 2) return; // teleported
    stepAccum += moved;
    if (stepAccum > 1.6) {
      stepAccum = 0;
      const f = playerFeet();
      const b = world.getWorldBlock(Math.floor(f.x), Math.floor(f.y - 0.1), Math.floor(f.z));
      if (isSolid(b)) playBlockSound(b, null, 'step');
    }
  }

  // =================================================================
  //  Camera views (F5): first person, behind you, in front of you
  // =================================================================
  let perspective = 0;
  let baseFov = initialFov;
  // View bobbing
  let bobPhase = 0;
  let bobAmount = 0;
  const lastBobPos = new THREE.Vector3();
  const bobRight = new THREE.Vector3();
  const bobSaved = new THREE.Vector3();
  const viewCamera = new THREE.PerspectiveCamera(initialFov, window.innerWidth / window.innerHeight, 0.1, 1000);
  const playerModel = buildMobModel('player');
  playerModel.root.visible = false;
  scene.add(playerModel.root);
  let playerWalkPhase = 0;
  const lastModelPos = new THREE.Vector3();

  function updateViewCamera(dt: number): THREE.PerspectiveCamera {
    fistMesh.visible = perspective === 0 && mode !== 'spectator' && !dead;
    const third = perspective !== 0;
    playerModel.root.visible = third && mode !== 'spectator';
    if (!third) return camera;

    const feet = playerFeet();
    const moved = Math.hypot(feet.x - lastModelPos.x, feet.z - lastModelPos.z);
    swayCape(playerModel, moved / Math.max(dt, 0.001), performance.now() / 1000);
    lastModelPos.copy(feet);
    playerWalkPhase += Math.min(moved, 1) * 4;
    const swing = Math.sin(playerWalkPhase) * Math.min(1, moved / (dt * 3 + 1e-6)) * 0.7;
    playerModel.root.position.copy(feet);
    playerModel.root.rotation.y = yaw;
    playerModel.head.rotation.x = pitch;
    playerModel.legs[0].rotation.x = swing;
    playerModel.legs[1].rotation.x = -swing;
    holdOnModel(playerModel, heldItem);
    holdOffhandOnModel(playerModel, offhand?.id ?? null);
    poseArms(playerModel, {
      swing, pitch, aiming: gunAiming, drawing: bowDrawing, kick: viewKick, blocking: swordBlocking,
      punch: punchPhase > 0 ? Math.sin((punchPhase / PUNCH_DURATION) * Math.PI) : 0,
      slash: punchPhase > 0 ? 1 - punchPhase / PUNCH_DURATION : -1,
    });

    // Pull the camera in if a wall is in the way
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const sign = perspective === 1 ? -1 : 1;
    let d = 4;
    for (let t = 0.3; t <= 4; t += 0.1) {
      const p = camera.position.clone().addScaledVector(dir, sign * t);
      if (isOpaque(world.getWorldBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) { d = Math.max(0.3, t - 0.3); break; }
    }
    viewCamera.position.copy(camera.position).addScaledVector(dir, sign * d);
    viewCamera.lookAt(camera.position);
    return viewCamera;
  }

  function closeInventory() {
    if (!inventoryOpen) return;
    inventoryOpen = false;
    atCraftingTable = false;
    openChestKey = null;
    openFurnaceKey = null;
    inventoryOpenCallback?.(false, false, null, null);
    safeLock();
  }

  // =================================================================
  //  Multiplayer hooks. The engine never talks to the network itself:
  //  App.tsx reads local block changes from an outbox and feeds in edits
  //  and positions from other players.
  // =================================================================
  let netEnabled = false;
  const blockOutbox: Array<[number, number, number, number]> = [];
  // Edits for chunks this browser hasn't generated yet; applied right after generation
  const pendingEdits = new Map<string, Array<[number, number, number, number]>>();

  // Every block the player (or a creeper) changes, per dimension. This is what gets saved.
  const savedEditsByDim = new Map<string, Map<string, number>>();
  const editsFor = (dim: string) => {
    let m = savedEditsByDim.get(dim);
    if (!m) { m = new Map(); savedEditsByDim.set(dim, m); }
    return m;
  };

  function setBlockAndNotify(x: number, y: number, z: number, b: number) {
    world.setWorldBlock(x, y, z, b);
    world.scheduleAround(x, y, z); // let nearby water and lava react
    editsFor(dimension).set(`${x},${y},${z}`, b);
    if (netEnabled && dimension === 'overworld') blockOutbox.push([x, y, z, b]); // multiplayer is overworld-only for now
  }

  function takeBlockChanges(): Array<[number, number, number, number]> {
    return blockOutbox.splice(0, blockOutbox.length);
  }

  function applyRemoteBlocks(list: Array<[number, number, number, number]>) {
    const dirty = new Set<string>();
    for (const [x, y, z, b] of list) {
      const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
      const c = world.getChunk(cx, cz);
      if (c && c.generated) {
        world.setWorldBlock(x, y, z, b);
        world.scheduleAround(x, y, z);
        markDirty(x, z, dirty);
      } else {
        const k = `${dimension}|${world.key(cx, cz)}`;
        let arr = pendingEdits.get(k);
        if (!arr) { arr = []; pendingEdits.set(k, arr); }
        arr.push([x, y, z, b]);
      }
    }
    rebuildDirty(dirty);
  }

  function getNetState() {
    // act: 1 = swinging or mining, 2 = aiming, 4 = drawing a bow
    return { x: camera.position.x, y: camera.position.y - PLAYER_EYE, z: camera.position.z, yaw, pitch, mode, held: heldItem ?? 0, act: (punchPhase > 0 || isMining ? 1 : 0) | (gunAiming ? 2 : 0) | (bowDrawing ? 4 : 0) | (swordBlocking ? 8 : 0) };
  }

  type RemotePlayer = {
    model: MobModel; tag: THREE.Sprite; tagTex: THREE.Texture;
    pos: THREE.Vector3; target: THREE.Vector3; yaw: number; targetYaw: number; pitch: number;
    mode: string; walkPhase: number; held: number; act: number; punchClock: number;
  };
  const remotePlayers = new Map<number, RemotePlayer>();

  function makeNameTag(name: string): { sprite: THREE.Sprite; tex: THREE.Texture } {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 30px sans-serif';
    const w = Math.min(248, ctx.measureText(name).width + 24);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect((256 - w) / 2, 10, w, 44);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 33);
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(1.6, 0.4, 1);
    sprite.position.y = 2.15;
    sprite.renderOrder = 10;
    return { sprite, tex };
  }

  const pendingRemoteLooks = new Map<number, PlayerLook>();
  function setRemotePlayer(id: number, name: string, x: number, y: number, z: number, ryaw: number, rpitch: number, rmode: string, held = 0, act = 0) {
    let rp = remotePlayers.get(id);
    if (!rp) {
      const model = buildMobModel('player');
      const { sprite, tex } = makeNameTag(name);
      model.root.add(sprite);
      scene.add(model.root);
      rp = {
        model, tag: sprite, tagTex: tex,
        pos: new THREE.Vector3(x, y, z), target: new THREE.Vector3(x, y, z),
        yaw: ryaw, targetYaw: ryaw, pitch: rpitch, mode: rmode, walkPhase: 0, held: 0, act: 0, punchClock: 0,
      };
      remotePlayers.set(id, rp);
      const look = pendingRemoteLooks.get(id);
      if (look) { applyPlayerLook(model, look); pendingRemoteLooks.delete(id); }
    }
    rp.target.set(x, y, z);
    rp.targetYaw = ryaw;
    rp.pitch = rpitch;
    rp.mode = rmode;
    rp.held = held;
    rp.act = act;
  }

  function removeRemotePlayer(id: number) {
    const rp = remotePlayers.get(id);
    if (!rp) return;
    scene.remove(rp.model.root);
    disposeObject(rp.model.root);
    for (const t of rp.model.textures) t.dispose();
    rp.tagTex.dispose();
    (rp.tag.material as THREE.SpriteMaterial).dispose();
    remotePlayers.delete(id);
  }

  // Positions arrive ~10 times a second; glide between them so movement looks smooth
  function updateRemotePlayers(dt: number) {
    for (const rp of remotePlayers.values()) {
      const before = rp.pos.clone();
      if (rp.pos.distanceTo(rp.target) > 8) rp.pos.copy(rp.target);
      else rp.pos.lerp(rp.target, Math.min(1, dt * 12));
      swayCape(rp.model, Math.hypot(rp.pos.x - before.x, rp.pos.z - before.z) / Math.max(dt, 0.001), performance.now() / 1000);
      rp.yaw += angleDiff(rp.targetYaw, rp.yaw) * Math.min(1, dt * 12);
      const moved = Math.hypot(rp.pos.x - before.x, rp.pos.z - before.z);
      rp.walkPhase += moved * 4;
      const swing = Math.sin(rp.walkPhase) * Math.min(1, moved / (dt * 3 + 1e-6)) * 0.7;
      const m = rp.model;
      m.root.visible = rp.mode !== 'spectator'; // spectators are invisible to everyone else
      m.root.position.copy(rp.pos);
      m.root.rotation.y = rp.yaw;
      m.head.rotation.x = rp.pitch;
      m.legs[0].rotation.x = swing;
      m.legs[1].rotation.x = -swing;
      holdOnModel(m, rp.held > 0 ? rp.held : null);
      rp.punchClock = (rp.act & 1) ? (rp.punchClock + dt) % PUNCH_DURATION : 0; // keeps swinging while they do
      poseArms(m, {
        swing, pitch: rp.pitch, aiming: (rp.act & 2) !== 0, drawing: (rp.act & 4) !== 0, kick: 0, blocking: (rp.act & 8) !== 0,
        punch: (rp.act & 1) ? Math.sin((rp.punchClock / PUNCH_DURATION) * Math.PI) : 0,
        slash: (rp.act & 1) ? rp.punchClock / PUNCH_DURATION : -1,
      });
    }
  }

  // =================================================================
  //  Hints, buckets, bows, ender pearls, chests, fluids, saving
  // =================================================================
  let hintCallback: ((text: string) => void) | null = null;
  let lastHint = 0;
  function showHint(text: string) {
    const now = performance.now();
    if (now - lastHint < 1500) return;
    lastHint = now;
    hintCallback?.(text);
  }

  // ---- Doors ----
  function removeDoorPartner(x: number, y: number, z: number, broken: number) {
    const otherY = isDoorBottom(broken) ? y + 1 : y - 1;
    if (isDoor(world.getWorldBlock(x, otherY, z))) { setBlockAndNotify(x, otherY, z, BLOCK_AIR); rebuildAround(x, z); }
  }
  function toggleDoor(x: number, y: number, z: number) {
    const by = isDoorBottom(world.getWorldBlock(x, y, z)) ? y : y - 1;
    const bottom = world.getWorldBlock(x, by, z), top = world.getWorldBlock(x, by + 1, z);
    if (!isDoorBottom(bottom)) return;
    const open = top === BLOCK_DOOR_TOP_OPEN;
    const edge = bottom - BLOCK_DOOR_N;
    setBlockAndNotify(x, by, z, BLOCK_DOOR_N + (open ? (edge + 3) % 4 : (edge + 1) % 4)); // swings on its hinge
    setBlockAndNotify(x, by + 1, z, open ? BLOCK_DOOR_TOP : BLOCK_DOOR_TOP_OPEN);
    rebuildAround(x, z);
    playBlockSound(ITEM_PLANKS, new THREE.Vector3(x + 0.5, by + 1, z + 0.5), 'place');
  }
  /** Something above a broken block that can't float (grass, crops, a door) breaks too. */
  function popAbove(x: number, y: number, z: number) {
    const b = world.getWorldBlock(x, y, z);
    if (b !== BLOCK_TALL_GRASS && !isWheat(b) && !isDoorBottom(b)) return;
    setBlockAndNotify(x, y, z, BLOCK_AIR);
    if (isDoorBottom(b) && isDoor(world.getWorldBlock(x, y + 1, z))) setBlockAndNotify(x, y + 1, z, BLOCK_AIR);
    rebuildAround(x, z);
    if (mode === 'creative' || b === BLOCK_TALL_GRASS) return;
    for (const [id, n] of dropsFor(b, false)) spawnDroppedItem(id, n, new THREE.Vector3(x + 0.5, y + 0.3, z + 0.5), new THREE.Vector3((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2), 0.3);
  }

  // ---- Farming: wheat grows on farmland, faster near water ----
  let cropTimer = 0;
  function farmlandWet(x: number, y: number, z: number): boolean {
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (isWater(world.getWorldBlock(x + dx, y, z + dz))) return true;
    return false;
  }
  function updateCrops(dt: number) {
    cropTimer += dt;
    if (cropTimer < 1) return;
    cropTimer = 0;
    // Crops only exist where someone planted them, so the edit list is the crop list
    for (const [k, b] of editsFor(dimension)) {
      if (b !== BLOCK_WHEAT_0 && b !== BLOCK_WHEAT_1) continue;
      const [x, y, z] = k.split(',').map(Number);
      if (!loadedChunks.has(world.key(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))) continue;
      if (world.getWorldBlock(x, y, z) !== b) continue;
      if (world.getWorldBlock(x, y - 1, z) !== BLOCK_FARMLAND) { popAbove(x, y, z); continue; }
      if (Math.random() < (farmlandWet(x, y - 1, z) ? 1 / 45 : 1 / 90)) { // ripe in ~1.5 min watered, ~3 min dry
        setBlockAndNotify(x, y, z, b + 1);
        rebuildAround(x, z);
      }
    }
  }

  // ---- Furnaces: input, fuel and output slots; they keep cooking while you do other things ----
  type Furnace = { slots: Slots; burn: number; burnMax: number; cook: number };
  const furnaces = new Map<string, Furnace>();
  let openFurnaceKey: string | null = null;
  function furnaceAt(key: string): Furnace {
    let f = furnaces.get(key);
    if (!f) { f = { slots: emptySlots(3), burn: 0, burnMax: 0, cook: 0 }; furnaces.set(key, f); }
    return f;
  }
  function updateFurnaces(dt: number) {
    for (const f of furnaces.values()) {
      const input = f.slots[0], fuel = f.slots[1], out = f.slots[2];
      const result = input ? SMELTING[input.id] : undefined;
      const canCook = result !== undefined && (!out || (out.id === result && out.count < maxStack(result)));
      if (f.burn > 0) f.burn = Math.max(0, f.burn - dt);
      if (f.burn <= 0 && canCook && fuel && FUEL_SECONDS[fuel.id]) {
        f.burn = f.burnMax = FUEL_SECONDS[fuel.id];
        f.slots[1] = fuel.id === ITEM_LAVA_BUCKET ? { id: ITEM_BUCKET, count: 1 } : fuel.count > 1 ? { id: fuel.id, count: fuel.count - 1 } : null;
      }
      if (f.burn > 0 && canCook && input && result !== undefined) {
        f.cook += dt;
        if (f.cook >= COOK_SECONDS) {
          f.cook = 0;
          f.slots[0] = input.count > 1 ? { id: input.id, count: input.count - 1 } : null;
          f.slots[2] = out ? { id: out.id, count: out.count + 1 } : { id: result, count: 1 };
        }
      } else {
        f.cook = Math.max(0, f.cook - dt * 2); // cools down when it runs out
      }
    }
  }
  function getFurnace(key: string): { slots: Slots; cook: number; burn: number } {
    const f = furnaceAt(key);
    return { slots: f.slots.map((st) => (st ? { ...st } : null)), cook: f.cook / COOK_SECONDS, burn: f.burnMax > 0 ? f.burn / f.burnMax : 0 };
  }
  function setFurnace(key: string, next: Slots) {
    const f = furnaceAt(key);
    f.slots = [0, 1, 2].map((i) => (next[i] ? { ...next[i]! } : null));
  }
  function spillFurnace(bx: number, by: number, bz: number) {
    const key = `${bx},${by},${bz}`;
    const f = furnaces.get(key);
    if (f) for (const st of f.slots) if (st) spawnDroppedItem(st.id, st.count, new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5), new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.4);
    furnaces.delete(key);
  }

  function spillChest(bx: number, by: number, bz: number) {
    const key = `${bx},${by},${bz}`;
    const contents = chests.get(key);
    if (contents) {
      for (const st of contents) {
        if (st) spawnDroppedItem(st.id, st.count, new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5),
          new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.4);
      }
    }
    chests.delete(key);
  }

  function playerInFluid(): 'water' | 'lava' | null {
    let water = false;
    for (const dy of [0.2, 0.9]) {
      const b = world.getWorldBlock(Math.floor(camera.position.x), Math.floor(camera.position.y - PLAYER_EYE + dy), Math.floor(camera.position.z));
      if (isLava(b)) return 'lava';
      if (isWater(b)) water = true;
    }
    return water ? 'water' : null;
  }

  function useBucket() {
    if (mode === 'adventure') return;
    const st = slots[selectedSlot];
    if (!st) return;
    if (st.id === ITEM_BUCKET) {
      const hit = raycastBlock(true);
      if (!hit) return;
      const b = world.getWorldBlock(hit.x, hit.y, hit.z);
      if (b !== BLOCK_WATER && b !== BLOCK_LAVA) return; // only still (source) fluid can be scooped
      setBlockAndNotify(hit.x, hit.y, hit.z, BLOCK_AIR);
      rebuildAround(hit.x, hit.z);
      if (mode !== 'creative') replaceHeld(b === BLOCK_WATER ? ITEM_WATER_BUCKET : ITEM_LAVA_BUCKET);
      playSfx('splash', new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5));
    } else {
      const hit = raycastBlock();
      if (!hit) return;
      const target = world.getWorldBlock(hit.x, hit.y, hit.z);
      const [px, py, pz] = target === BLOCK_TALL_GRASS ? [hit.x, hit.y, hit.z] : [hit.placeX, hit.placeY, hit.placeZ];
      const existing = world.getWorldBlock(px, py, pz);
      if (!(isReplaceable(existing) || isFluid(existing))) return;
      if (st.id === ITEM_WATER_BUCKET && dimension === 'nether') {
        // Like Minecraft: water boils away in the Nether
        spawnParticles(new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5), ['#e8e8e8', '#cfcfcf'], 14, 1.5, 0.12, 0.8);
        playSfx('splash', new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5));
        showHint('Water evaporates in the Nether');
        if (mode !== 'creative') replaceHeld(ITEM_BUCKET);
        return;
      }
      setBlockAndNotify(px, py, pz, st.id === ITEM_WATER_BUCKET ? BLOCK_WATER : BLOCK_LAVA);
      rebuildAround(px, pz);
      if (mode !== 'creative') replaceHeld(ITEM_BUCKET);
      playSfx('splash', new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5));
    }
    punchPhase = PUNCH_DURATION;
  }

  // ---- Bow: hold right-click to draw, release to shoot ----
  function bowCharge(): number {
    return Math.min(1, (performance.now() - bowDrawStart) / 1000);
  }

  function startDrawingBow() {
    if (mode !== 'creative' && countInSlots(slots, ITEM_ARROW) === 0) {
      showHint('You need arrows to shoot');
      return;
    }
    bowDrawing = true;
    bowDrawStart = performance.now();
  }

  function releaseBow() {
    const charge = bowCharge();
    bowDrawing = false;
    if (charge < 0.15) return; // a tap doesn't fire
    if (mode !== 'creative' && removeItem(ITEM_ARROW, 1) === 0) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const from = camera.position.clone().addScaledVector(dir, 0.6);
    from.y -= 0.1;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(arrowShaftGeo, arrowShaftMat));
    const tip = new THREE.Mesh(arrowTipGeo, arrowTipMat);
    tip.position.z = 0.32;
    mesh.add(tip);
    mesh.position.copy(from);
    scene.add(mesh);
    // Full draw = fast and hard-hitting (up to 9 damage), like Minecraft
    arrows.push({ mesh, pos: from, vel: dir.multiplyScalar(12 + 28 * charge), life: 0, stuck: false, owner: 'player', damage: Math.round(2 + 7 * charge) });
    playSfx('bow', null);
  }

  // ---- Ender pearls: throw, land, teleport ----
  const pearls: Array<{ mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; life: number }> = [];
  const pearlGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const pearlMat = new THREE.MeshLambertMaterial({ color: 0x1f8a7a, emissive: 0x0a3a33 });
  let pearlCooldown = 0;

  function throwPearl() {
    if (pearlCooldown > 0 || mode === 'spectator') return;
    pearlCooldown = 1;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 0.6);
    const vel = dir.multiplyScalar(22);
    vel.y += 1.5;
    const mesh = new THREE.Mesh(pearlGeo, pearlMat);
    mesh.position.copy(pos);
    scene.add(mesh);
    pearls.push({ mesh, pos, vel, life: 0 });
    consumeHeld(1);
    playSfx('throw', null);
    punchPhase = PUNCH_DURATION;
  }

  function bodyFitsAt(x: number, feetY: number, z: number): boolean {
    for (let row = Math.floor(feetY); row <= Math.floor(feetY + PLAYER_HEIGHT - 0.1); row++) {
      if (footprintSolid(x, row, z)) return false;
    }
    return true;
  }

  function teleportTo(pos: THREE.Vector3) {
    if (dead) return;
    const purple = ['#7b2fbe', '#b26cf0', '#3d0f6b'];
    spawnParticles(playerFeet().add(new THREE.Vector3(0, 0.9, 0)), purple, 20, 2.5, 0.12, 0.8);
    let feetY = pos.y;
    for (let i = 0; i < 4 && !bodyFitsAt(pos.x, feetY, pos.z); i++) feetY = Math.floor(feetY) + 1;
    camera.position.set(pos.x, feetY + PLAYER_EYE, pos.z);
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
    playerKnock.set(0, 0, 0);
    spawnParticles(new THREE.Vector3(pos.x, feetY + 0.9, pos.z), purple, 24, 2.5, 0.12, 0.8);
    playSfx('teleport', null);
    if (canBeAttacked()) { playerHurtCooldown = 0; hurtPlayer(5, null, 0, 'Ender pearl'); } // 5 damage, like Minecraft
  }

  function updatePearls(dt: number) {
    pearlCooldown = Math.max(0, pearlCooldown - dt);
    for (let i = pearls.length - 1; i >= 0; i--) {
      const p = pearls[i];
      p.life += dt;
      p.vel.y -= 20 * dt;
      const steps = Math.max(1, Math.ceil((p.vel.length() * dt) / 0.25));
      let landed = false;
      for (let st = 0; st < steps; st++) {
        const next = p.pos.clone().addScaledVector(p.vel, dt / steps);
        const hitBlock = isSolid(world.getWorldBlock(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z)));
        const hitMob = mobs.some((mm) => mm.deathTime < 0 && Math.abs(next.x - mm.pos.x) < MOB_INFO[mm.kind].width / 2 + 0.1
          && Math.abs(next.z - mm.pos.z) < MOB_INFO[mm.kind].width / 2 + 0.1 && next.y > mm.pos.y && next.y < mm.pos.y + MOB_INFO[mm.kind].height);
        if (hitBlock || hitMob) { landed = true; break; }
        p.pos.copy(next);
      }
      if (landed) teleportTo(p.pos);
      if (landed || p.pos.y < -20 || p.life > 10) {
        scene.remove(p.mesh);
        pearls.splice(i, 1);
        continue;
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
    }
  }

  // ---- Fluids: water ticks 4x a second, lava every 1.5 s ----
  let waterTimer = 0;
  let lavaTimer = 0;
  function updateFluids(dt: number) {
    waterTimer += dt;
    lavaTimer += dt;
    const changes: Array<[number, number, number, number, number]> = [];
    if (waterTimer >= 0.25) { waterTimer = 0; for (const c of world.tickFluids(0, 3000)) changes.push(c); }
    if (lavaTimer >= 1.5) { lavaTimer = 0; for (const c of world.tickFluids(1, 3000)) changes.push(c); }
    if (!changes.length) return;
    // Fluid-only changes just rebuild the cheap fluid mesh; anything solid
    // appearing or vanishing (obsidian, washed-away grass) rebuilds the terrain too
    const solidDirty = new Set<string>(), fluidDirty = new Set<string>();
    for (const [x, , z, oldB, newB] of changes) {
      markDirty(x, z, fluidDirty);
      if (isSolid(oldB) || isSolid(newB) || oldB === BLOCK_TALL_GRASS || newB === BLOCK_TALL_GRASS) markDirty(x, z, solidDirty);
    }
    rebuildDirty(solidDirty);
    for (const k of fluidDirty) {
      if (solidDirty.has(k) || !loadedChunks.has(k)) continue;
      const [x, z] = k.split(',').map(Number);
      const c = world.getChunk(x, z);
      if (c) rebuildFluidMesh(c);
    }
  }

  // Underwater / in-lava view, and keeping the water shader in sync with the sky
  function applyFluidFog(dt: number) {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const head = world.getWorldBlock(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
    if (dimension !== 'overworld' && !isWater(head) && !isLava(head)) {
      fog.near = Math.min(renderDistance * CHUNK_SIZE * 0.25, 18);
      fog.far = Math.min(renderDistance * CHUNK_SIZE * 0.9, dimension === 'nether' ? 70 : 140);
    } else if (isWater(head)) {
      fog.color.setRGB(0.01 + 0.04 * currentDayAmt, 0.03 + 0.14 * currentDayAmt, 0.06 + 0.26 * currentDayAmt);
      fog.near = 0.5;
      fog.far = 18;
    } else if (isLava(head)) {
      fog.color.setRGB(0.8, 0.3, 0.05);
      fog.near = 0.1;
      fog.far = 2.5;
    } else {
      fog.near = renderDistance * CHUNK_SIZE * 0.4;
      fog.far = renderDistance * CHUNK_SIZE * 0.9;
    }
    waterUniforms.uTime.value += dt;
    waterUniforms.uSunDir.value.copy(sunDir.y > 0 ? sunDir : moonDir);
    setRGB(waterUniforms.uSkyTop.value, skyTop);
    setRGB(waterUniforms.uSkyHorizon.value, skyHorizon);
    setRGB(waterUniforms.uFogColor.value, fog.color);
    waterUniforms.uFogNear.value = fog.near;
    waterUniforms.uFogFar.value = fog.far;
    waterUniforms.uDay.value = currentDayAmt;
    foliageUniforms.uTime.value += dt;
    lavaTex.offset.x = (lavaTex.offset.x + dt * 0.03) % 1;
    portalTex.offset.y = (portalTex.offset.y + dt * 0.25) % 1;
    portalTex.offset.x = Math.sin(waterUniforms.uTime.value * 0.7) * 0.1;
  }

  // ---- Saving & loading ----
  function getSaveData(): SaveData {
    const editsByDim: Record<string, Array<[number, number, number, number]>> = {};
    for (const [dim, m] of savedEditsByDim) {
      const list: Array<[number, number, number, number]> = [];
      for (const [k, b] of m) {
        const [x, y, z] = k.split(',').map(Number);
        list.push([x, y, z, b]);
      }
      editsByDim[dim] = list;
    }
    const edits = editsByDim.overworld ?? [];
    const chestData: Record<string, Slots> = {};
    for (const [k, c] of chests) if (c.some(Boolean)) chestData[k] = c.map((st) => (st ? { ...st } : null));
    return {
      v: 1,
      player: { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw, pitch, health, hunger, mode, selected: selectedSlot, offhand, armor },
      slots: slots.map((st) => (st ? { ...st } : null)),
      time: timeOfDay,
      day: dayCount,
      edits,
      chests: chestData,
      furnaces: Object.fromEntries([...furnaces].filter(([, f]) => f.slots.some(Boolean) || f.burn > 0).map(([k, f]) => [k, { slots: f.slots.map((st) => (st ? { ...st } : null)), burn: f.burn, burnMax: f.burnMax, cook: f.cook }])),
      dimension,
      editsByDim,
      portals,
    };
  }

  function loadSaveData(d: SaveData) {
    if (!d || d.v !== 1) return;
    for (const [x, y, z, b] of d.edits) editsFor('overworld').set(`${x},${y},${z}`, b);
    applyRemoteBlocks(d.edits);
    // Other dimensions get their edits applied when you first go there
    for (const [dim, list] of Object.entries(d.editsByDim ?? {})) {
      if (dim === 'overworld') continue;
      for (const [x, y, z, b] of list) editsFor(dim).set(`${x},${y},${z}`, b);
    }
    for (const [dim, list] of Object.entries(d.portals ?? {})) portals[dim] = list.slice();
    // Planks used to be item 100; saves from before keep working
    const fix = (st: ItemStack | null): ItemStack | null => (st && st.id === 100 ? { id: ITEM_PLANKS, count: st.count } : st);
    for (const [k, c] of Object.entries(d.chests || {})) chests.set(k, c.map(fix));
    furnaces.clear();
    for (const [k, f] of Object.entries(d.furnaces || {})) {
      const sl = (f.slots ?? []).slice(0, 3).map(fix);
      while (sl.length < 3) sl.push(null);
      furnaces.set(k, { slots: sl, burn: Number(f.burn) || 0, burnMax: Number(f.burnMax) || 0, cook: Number(f.cook) || 0 });
    }
    for (let i = 0; i < INVENTORY_SIZE; i++) slots[i] = fix(d.slots?.[i] ?? null);
    offhand = fix(d.player.offhand ?? null);
    for (let i = 0; i < 4; i++) armor[i] = fix(d.player.armor?.[i] ?? null);
    selectedSlot = d.player.selected ?? 0;
    setGameMode(d.player.mode);
    camera.position.set(d.player.x, d.player.y, d.player.z);
    yaw = d.player.yaw;
    pitch = d.player.pitch;
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
    setStats(d.player.health > 0 ? d.player.health : 20, d.player.hunger);
    setTime(d.time);
    dayCount = d.day || 1;
    notifyInventory();
    currentChunkX = Infinity; // load the chunks around where they left off
    if (d.dimension && d.dimension !== 'overworld') {
      const pos = { dim: d.dimension, x: d.player.x, y: d.player.y - PLAYER_EYE, z: d.player.z };
      if (d.dimension === 'nether') switchDimension('nether', pos.x, pos.y, pos.z);
      else pendingDimRestore = pos; // a mod's dimension: go back once the mod creates it again
    }
  }

  // =================================================================
  //  Dimensions, portals, armor, effects and the scripting hooks
  // =================================================================
  let engineEventCallback: ((name: string, data: Record<string, unknown>) => void) | null = null;
  function engineEvent(name: string, data: Record<string, unknown>) {
    engineEventCallback?.(name, data);
  }

  function hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
  }

  function getOrCreateWorld(dimId: string): World | null {
    const have = worlds.get(dimId);
    if (have) return have;
    let w: World | null = null;
    if (dimId === 'nether') w = new World(effectiveSeed + 1013, false, 'nether');
    else {
      const spec = dimensionSpecs.get(dimId);
      if (spec) w = new World(effectiveSeed + hashString(dimId), false, 'custom', spec);
    }
    if (!w) return null;
    worlds.set(dimId, w);
    // Saved edits for this dimension go in as chunks get generated
    for (const [k, b] of editsFor(dimId)) {
      const [x, y, z] = k.split(',').map(Number);
      const key = `${dimId}|${w.key(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE))}`;
      let arr = pendingEdits.get(key);
      if (!arr) { arr = []; pendingEdits.set(key, arr); }
      arr.push([x, y, z, b]);
    }
    return w;
  }

  function unloadAllChunks() {
    for (const k of loadedChunks) {
      const [cx, cz] = k.split(',').map(Number);
      const c = world.getChunk(cx, cz);
      if (!c) continue;
      for (const mesh of [c.mesh, c.fluidMesh]) {
        if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      }
      c.mesh = null;
      c.fluidMesh = null;
    }
    loadedChunks.clear();
  }

  function switchDimension(dimId: string, x: number, feetY: number, z: number): boolean {
    const target = getOrCreateWorld(dimId);
    if (!target) return false;
    if (dimId !== dimension) {
      lastPosByDim.set(dimension, [camera.position.x, camera.position.y - PLAYER_EYE, camera.position.z]);
      unloadAllChunks();
      for (let i = mobs.length - 1; i >= 0; i--) removeMob(i);
      for (let i = droppedItems.length - 1; i >= 0; i--) removeDropped(i);
      for (const a of arrows) scene.remove(a.mesh);
      arrows.length = 0;
      for (const pp of pearls) scene.remove(pp.mesh);
      pearls.length = 0;
      for (let i = projectiles.length - 1; i >= 0; i--) removeProjectileAt(i);
      world = target;
      dimension = dimId;
      if (!portals[dimId]) portals[dimId] = [];
    }
    camera.position.set(x, feetY + PLAYER_EYE, z);
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
    playerKnock.set(0, 0, 0);
    const ccx = Math.floor(x / CHUNK_SIZE), ccz = Math.floor(z / CHUNK_SIZE);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) loadChunk(ccx + dx, ccz + dz);
    currentChunkX = Infinity;
    clouds.visible = dimension === 'overworld';
    stars.visible = dimension === 'overworld';
    sun.visible = dimension === 'overworld';
    moon.visible = dimension === 'overworld';
    engineEvent('dimensionChange', { dimension });
    return true;
  }

  // The Nether (and mod dimensions) have a fixed sky, fog and light
  function applyDimensionLook() {
    const spec = dimensionSpecs.get(dimension);
    skyTop.set(spec ? spec.sky : '#2a0606');
    skyHorizon.set(spec ? spec.fog : '#4a1010');
    paintSky();
    fogColor.copy(skyHorizon);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(skyHorizon);
    if (scene.background instanceof THREE.Color) scene.background.copy(skyHorizon);
    const light = spec ? spec.light : 0.6;
    ambientLight.intensity = 0.2 + 0.5 * light;
    dirLight.intensity = 0.1 + 0.5 * light;
    if (effectLevel('night_vision')) ambientLight.intensity = Math.max(ambientLight.intensity, 0.85);
    currentDayAmt = light;
    sun.visible = false;
    moon.visible = false;
    clouds.visible = false;
    stars.visible = false;
  }

  /** Find somewhere to stand near x,z in the current dimension (builds a platform if there's nowhere). */
  function safeSpot(x: number, z: number): [number, number, number] {
    for (let r = 0; r <= 12; r += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        for (let dz = -r; dz <= r; dz += 2) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const bx = Math.floor(x) + dx, bz = Math.floor(z) + dz;
          for (let y = CHUNK_HEIGHT - 4; y >= 2; y--) {
            const b = world.getWorldBlock(bx, y, bz);
            // solid ground with two blocks of air above it
            if (isSolid(b) && world.getWorldBlock(bx, y + 1, bz) === BLOCK_AIR && world.getWorldBlock(bx, y + 2, bz) === BLOCK_AIR) {
              return [bx + 0.5, y + 1, bz + 0.5];
            }
          }
        }
      }
    }
    const bx = Math.floor(x), bz = Math.floor(z);
    const list: Array<[number, number, number, number]> = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      list.push([bx + dx, 32, bz + dz, BLOCK_STONE]);
      list.push([bx + dx, 33, bz + dz, BLOCK_AIR]);
      list.push([bx + dx, 34, bz + dz, BLOCK_AIR]);
    }
    setBlocks(list);
    return [bx + 0.5, 33, bz + 0.5];
  }

  function travelTo(dimId: string, x?: number, z?: number): boolean {
    const last = lastPosByDim.get(dimId);
    if (x === undefined && last && dimId !== dimension) return switchDimension(dimId, last[0], last[1], last[2]);
    const tx = x ?? (dimId === 'overworld' ? spawnX + 0.5 : 8.5);
    const tz = z ?? (dimId === 'overworld' ? spawnZ + 0.5 : 8.5);
    if (!switchDimension(dimId, tx, 40, tz)) return false;
    const [sx, sy, sz] = safeSpot(tx, tz);
    camera.position.set(sx, sy + PLAYER_EYE, sz);
    fallPeakY = camera.position.y;
    return true;
  }

  function createDimension(spec: DimensionSpec) {
    const old = dimensionSpecs.get(spec.id);
    dimensionSpecs.set(spec.id, spec);
    if (old && JSON.stringify(old) !== JSON.stringify(spec) && dimension !== spec.id) worlds.delete(spec.id); // regenerate with the new settings
    if (pendingDimRestore && pendingDimRestore.dim === spec.id) {
      const r = pendingDimRestore;
      pendingDimRestore = null;
      switchDimension(r.dim, r.x, r.y, r.z);
    }
  }

  // ---- Nether portals ----
  let portalTime = 0;
  let mustLeavePortal = false;
  function updatePortal(dt: number) {
    if (dead || mode === 'spectator') { portalTime = 0; return; }
    const fx = Math.floor(camera.position.x), fz = Math.floor(camera.position.z);
    const feet = camera.position.y - PLAYER_EYE;
    const inPortal = world.getWorldBlock(fx, Math.floor(feet + 0.2), fz) === BLOCK_NETHER_PORTAL
      || world.getWorldBlock(fx, Math.floor(feet + 1.2), fz) === BLOCK_NETHER_PORTAL;
    if (!inPortal) { portalTime = 0; mustLeavePortal = false; return; }
    if (mustLeavePortal) return; // you just arrived: step out before it works again
    portalTime += dt;
    if (Math.random() < dt * 25) {
      spawnParticles(playerFeet().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8)),
        ['#8a3ae0', '#b070ff', '#5a1a9a'], 2, 0.6, 0.08, 0.6);
    }
    if (portalTime >= (mode === 'creative' ? 0.5 : 2.5)) {
      portalTime = 0;
      mustLeavePortal = true;
      travelThroughPortal();
    }
  }

  function travelThroughPortal() {
    const to = dimension === 'nether' ? 'overworld' : 'nether';
    const scale = to === 'nether' ? 1 / 8 : 8; // 1 block in the Nether = 8 in the Overworld
    const tx = Math.floor(camera.position.x * scale), tz = Math.floor(camera.position.z * scale);
    const reach = to === 'nether' ? 16 : 128;
    const near = (portals[to] ?? [])
      .filter((p) => Math.abs(p[0] - tx) <= reach && Math.abs(p[2] - tz) <= reach)
      .sort((a, b) => Math.hypot(a[0] - tx, a[2] - tz) - Math.hypot(b[0] - tx, b[2] - tz))[0];
    switchDimension(to, near ? near[0] : tx + 0.5, near ? near[1] : 40, near ? near[2] : tz + 0.5);
    if (near && world.getWorldBlock(Math.floor(near[0]), Math.floor(near[1]), Math.floor(near[2])) === BLOCK_NETHER_PORTAL) {
      // reuse the linked portal
    } else {
      if (near) portals[to] = portals[to].filter((p) => p !== near); // it was broken
      const [ax, ay, az] = buildPortalNear(tx, tz);
      camera.position.set(ax, ay + PLAYER_EYE, az);
    }
    fallPeakY = camera.position.y;
    velocityY = 0;
    mustLeavePortal = true;
    playSfx('teleport', null);
  }

  // Build an obsidian frame with a lit portal where there's room, Minecraft-style
  function buildPortalNear(tx: number, tz: number): [number, number, number] {
    const fits = (x: number, y: number, z: number) => {
      for (let i = -1; i <= 4; i++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!isSolid(world.getWorldBlock(x + i, y - 1, z + dz))) return false;
          for (let h = 0; h <= 4; h++) if (world.getWorldBlock(x + i, y + h, z + dz) !== BLOCK_AIR) return false;
        }
      }
      return true;
    };
    let site: [number, number, number] | null = null;
    search: for (let r = 0; r <= 8; r += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        for (let dz = -r; dz <= r; dz += 2) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          for (let y = 54; y >= NETHER_LAVA_LEVEL + 3; y--) {
            if (fits(tx + dx, y, tz + dz)) { site = [tx + dx, y, tz + dz]; break search; }
          }
        }
      }
    }
    const list: Array<[number, number, number, number]> = [];
    if (!site) {
      // Nowhere flat: carve a room with an obsidian floor
      const y = dimension === 'nether' ? 32 : Math.max(world.getSurfaceHeight(tx, tz) + 1, 8);
      site = [tx, y, tz];
      for (let i = -1; i <= 4; i++) for (let dz = -1; dz <= 1; dz++) {
        list.push([tx + i, y - 1, tz + dz, BLOCK_OBSIDIAN]);
        for (let h = 0; h <= 4; h++) list.push([tx + i, y + h, tz + dz, BLOCK_AIR]);
      }
    }
    const [x, y, z] = site;
    for (let h = 0; h <= 4; h++) { list.push([x, y + h, z, BLOCK_OBSIDIAN]); list.push([x + 3, y + h, z, BLOCK_OBSIDIAN]); }
    for (const i of [1, 2]) {
      list.push([x + i, y, z, BLOCK_OBSIDIAN]);
      list.push([x + i, y + 4, z, BLOCK_OBSIDIAN]);
      for (let h = 1; h <= 3; h++) list.push([x + i, y + h, z, BLOCK_NETHER_PORTAL]);
    }
    setBlocks(list);
    const arrival: [number, number, number] = [x + 2, y + 1, z + 0.5];
    portals[dimension].push(arrival);
    return arrival;
  }

  /** Flint and steel on the inside of an obsidian frame lights it. */
  function tryLightPortal(sx: number, sy: number, sz: number): boolean {
    for (const axis of ['x', 'z'] as const) {
      const cells: Array<[number, number, number]> = [];
      const seen = new Set<string>();
      const stack: Array<[number, number, number]> = [[sx, sy, sz]];
      let ok = true;
      while (stack.length) {
        const [x, y, z] = stack.pop()!;
        const k = `${x},${y},${z}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const b = world.getWorldBlock(x, y, z);
        if (b === BLOCK_OBSIDIAN) continue;
        if (b !== BLOCK_AIR && b !== BLOCK_TALL_GRASS) { ok = false; break; }
        cells.push([x, y, z]);
        if (cells.length > 441) { ok = false; break; } // bigger than 21x21: not a closed frame
        stack.push([x, y + 1, z], [x, y - 1, z]);
        if (axis === 'x') stack.push([x + 1, y, z], [x - 1, y, z]);
        else stack.push([x, y, z + 1], [x, y, z - 1]);
      }
      if (!ok || cells.length < 6) continue;
      const as = cells.map((c) => (axis === 'x' ? c[0] : c[2]));
      const ys = cells.map((c) => c[1]);
      const minA = Math.min(...as), maxA = Math.max(...as), minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = maxA - minA + 1, h = maxY - minY + 1;
      if (w < 2 || h < 3 || w * h !== cells.length) continue; // must be a filled rectangle, at least 2x3 inside
      setBlocks(cells.map(([x, y, z]) => [x, y, z, BLOCK_NETHER_PORTAL]));
      portals[dimension].push(axis === 'x' ? [minA + w / 2, minY, sz + 0.5] : [sx + 0.5, minY, minA + w / 2]);
      playSfx('teleport', new THREE.Vector3(sx + 0.5, sy + 0.5, sz + 0.5));
      return true;
    }
    return false;
  }

  /** Breaking the frame (or the portal) puts the portal out. */
  function breakPortalsAround(x: number, y: number, z: number) {
    const stack: Array<[number, number, number]> = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
    const seen = new Set<string>();
    const list: Array<[number, number, number, number]> = [];
    while (stack.length && list.length < 1000) {
      const [bx, by, bz] = stack.pop()!;
      const k = `${bx},${by},${bz}`;
      if (seen.has(k) || world.getWorldBlock(bx, by, bz) !== BLOCK_NETHER_PORTAL) continue;
      seen.add(k);
      list.push([bx, by, bz, BLOCK_AIR]);
      stack.push([bx + 1, by, bz], [bx - 1, by, bz], [bx, by + 1, bz], [bx, by - 1, bz], [bx, by, bz + 1], [bx, by, bz - 1]);
    }
    if (list.length) setBlocks(list);
  }

  // ---- Armor ----
  function armorPoints(): number {
    let p = 0;
    for (const a of armor) if (a && ARMOR[a.id]) p += ARMOR[a.id].points;
    return p;
  }

  function setArmor(next: Slots) {
    for (let i = 0; i < 4; i++) {
      const st = next[i];
      armor[i] = st && ARMOR[st.id]?.slot === i ? { id: st.id, count: 1 } : null;
    }
    notifyInventory();
  }

  // ---- Effects (potions without the potions, for now: mods apply them) ----
  const EFFECT_NAMES = ['speed', 'slowness', 'jump_boost', 'regeneration', 'resistance', 'slow_falling', 'night_vision'];
  const effects = new Map<string, { until: number; level: number }>();
  function effectLevel(name: string): number {
    const e = effects.get(name);
    if (!e) return 0;
    if (performance.now() > e.until) { effects.delete(name); return 0; }
    return e.level;
  }
  let effectRegenTimer = 0;
  function updateEffects(dt: number) {
    const regen = effectLevel('regeneration');
    if (!regen || dead) { effectRegenTimer = 0; return; }
    effectRegenTimer += dt;
    if (effectRegenTimer >= 2.5 / regen) {
      effectRegenTimer = 0;
      if (health < 20) setStats(health + 1, hunger);
    }
  }

  // ---- Projectiles from mods ----
  type Projectile = {
    id: number; mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; gravity: number; damage: number;
    life: number; lifetime: number; explosion: number; knockback: number;
    ownerId?: number; ownerKind?: MobKind; hitsPlayer: boolean; cause: string; maxDamage: number;
  };
  const projectiles: Projectile[] = [];
  let nextProjectileId = 0;
  const projectileGeo = new THREE.BoxGeometry(1, 1, 1);

  function spawnProjectile(o: ProjectileSpec): number {
    if (projectiles.length >= 200) throw new Error('Too many projectiles at once (200)');
    const mat = new THREE.MeshBasicMaterial({ color: o.color && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#ffe08a' });
    const mesh = new THREE.Mesh(projectileGeo, mat);
    mesh.scale.setScalar(Math.max(0.04, Math.min(1, o.size ?? 0.15)));
    mesh.position.set(o.x, o.y, o.z);
    scene.add(mesh);
    const p: Projectile = {
      id: ++nextProjectileId, mesh, pos: new THREE.Vector3(o.x, o.y, o.z), vel: new THREE.Vector3(o.vx, o.vy, o.vz),
      gravity: Math.max(-40, Math.min(40, o.gravity ?? 0)), damage: Math.max(0, Math.min(100, o.damage ?? 4)),
      life: 0, lifetime: Math.max(0.1, Math.min(30, o.lifetime ?? 5)), explosion: Math.max(0, Math.min(6, o.explosion ?? 0)),
      knockback: Math.max(0, Math.min(20, o.knockback ?? 2)),
      ownerId: o.ownerId, ownerKind: o.ownerKind, hitsPlayer: !!o.hitsPlayer, cause: o.cause ?? 'Explosion', maxDamage: o.maxDamage ?? 18,
    };
    projectiles.push(p);
    return p.id;
  }

  function removeProjectileAt(i: number) {
    const p = projectiles[i];
    scene.remove(p.mesh);
    (p.mesh.material as THREE.Material).dispose();
    projectiles.splice(i, 1);
  }

  function updateProjectiles(dt: number) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life += dt;
      p.vel.y -= p.gravity * dt;
      const steps = Math.max(1, Math.ceil((p.vel.length() * dt) / 0.25));
      let done = false;
      for (let st = 0; st < steps && !done; st++) {
        const next = p.pos.clone().addScaledVector(p.vel, dt / steps);
        const victim = mobs.find((mm) => {
          if (mm.deathTime >= 0 || mm.id === p.ownerId || (p.ownerKind !== undefined && mm.kind === p.ownerKind)) return false;
          const inf = MOB_INFO[mm.kind];
          return Math.abs(next.x - mm.pos.x) < inf.width / 2 + 0.1 && Math.abs(next.z - mm.pos.z) < inf.width / 2 + 0.1 && next.y > mm.pos.y && next.y < mm.pos.y + inf.height;
        });
        const blockHit = isSolid(world.getWorldBlock(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z)));
        let playerHit = false;
        if (p.hitsPlayer && canBeAttacked()) {
          const bodyCenter = playerFeet();
          bodyCenter.y += 0.9;
          playerHit = bodyCenter.distanceTo(next) < 0.9 + p.mesh.scale.x / 2;
        }
        if (victim || blockHit || playerHit) {
          if (victim && p.damage > 0) hurtMob(victim, p.damage, p.pos.clone().sub(p.vel.clone().normalize()), p.knockback, true, p.ownerId === undefined);
          engineEvent('projectileHit', {
            id: p.id, x: next.x, y: next.y, z: next.z,
            entity: victim ? { id: victim.id, type: victim.kind } : null,
            block: blockHit ? { x: Math.floor(next.x), y: Math.floor(next.y), z: Math.floor(next.z) } : null,
          });
          if (p.explosion > 0) explode(p.pos.clone(), p.explosion, p.cause, p.ownerKind ? (mm) => mm.kind === p.ownerKind : undefined, p.maxDamage);
          done = true;
        } else {
          p.pos.copy(next);
        }
      }
      if (done || p.life > p.lifetime) { removeProjectileAt(i); continue; }
      if (p.ownerKind && Math.random() < dt * 40) spawnParticles(p.pos.clone(), ['#ff9b1a', '#ffcf33', '#ff5a1a'], 1, 0.6, 0.15, 0.35); // fiery trail
      p.mesh.position.copy(p.pos);
    }
  }

  // ---- Raycast (hits blocks and/or mobs) ----
  function rayBox(o: THREE.Vector3, d: THREE.Vector3, min: number[], max: number[]): number {
    let t0 = 0, t1 = Infinity;
    const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(da[i]) < 1e-9) { if (oa[i] < min[i] || oa[i] > max[i]) return -1; continue; }
      let a = (min[i] - oa[i]) / da[i], b = (max[i] - oa[i]) / da[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return -1;
    }
    return t0;
  }

  function raycastWorld(origin: [number, number, number] | null, direction: [number, number, number] | null, maxDist: number, hitEntities: boolean, hitBlocks: boolean): RayHit | null {
    const o = origin ? new THREE.Vector3(...origin) : camera.position.clone();
    const d = direction ? new THREE.Vector3(...direction) : (() => { const v = new THREE.Vector3(); camera.getWorldDirection(v); return v; })();
    if (d.lengthSq() < 1e-9) return null;
    d.normalize();
    const range = Math.max(0, Math.min(256, maxDist));
    let best: RayHit | null = null;
    if (hitBlocks) {
      for (let t = 0; t <= range; t += 0.05) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        const b = world.getWorldBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if (isSolid(b)) {
          best = { type: 'block', point: { x, y, z }, distance: t, block: { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), id: b } };
          break;
        }
      }
    }
    if (hitEntities) {
      for (const m of mobs) {
        if (m.deathTime >= 0) continue;
        const inf = MOB_INFO[m.kind];
        const half = inf.width / 2 + 0.05;
        const t = rayBox(o, d, [m.pos.x - half, m.pos.y, m.pos.z - half], [m.pos.x + half, m.pos.y + inf.height, m.pos.z + half]);
        if (t >= 0 && t <= range && (!best || t < best.distance)) {
          best = { type: 'entity', point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }, distance: t, entity: { id: m.id, type: m.kind } };
        }
      }
    }
    return best;
  }

  const scriptApi: ScriptEngineApi = {
    raycast: raycastWorld,
    listEntities: () => mobs.filter((m) => m.deathTime < 0).map((m) => ({ id: m.id, type: m.kind, x: m.pos.x, y: m.pos.y, z: m.pos.z, health: m.health, maxHealth: MOB_INFO[m.kind].hp })),
    spawnEntity(type, x, y, z) {
      if (!(MOB_KINDS as string[]).includes(type)) throw new Error(`Unknown mob "${type}"`);
      if (mobs.length >= 80) throw new Error('Too many mobs already (80)');
      spawnMob(type as MobKind, new THREE.Vector3(x, y, z));
      return mobs[mobs.length - 1].id;
    },
    removeEntity(id) {
      const i = mobs.findIndex((m) => m.id === id);
      if (i < 0) return false;
      removeMob(i);
      return true;
    },
    damageEntity(id, amount, knockback) {
      const m = mobs.find((mm) => mm.id === id && mm.deathTime < 0);
      if (!m) return false;
      const from = camera.position.clone();
      return hurtMob(m, Math.max(0, Math.min(1000, amount)), from, Math.max(0, Math.min(20, knockback * 7)), true, true);
    },
    knockEntity(id, vx, vy, vz) {
      const m = mobs.find((mm) => mm.id === id);
      if (!m) return false;
      m.knock.set(Math.max(-30, Math.min(30, vx)), 0, Math.max(-30, Math.min(30, vz)));
      m.velY = Math.max(-30, Math.min(30, vy));
      m.onGround = false;
      return true;
    },
    spawnProjectile,
    removeProjectile(id) {
      const i = projectiles.findIndex((p) => p.id === id);
      if (i < 0) return false;
      removeProjectileAt(i);
      return true;
    },
    particles(x, y, z, color, count, speed, size, life) {
      spawnParticles(new THREE.Vector3(x, y, z), [color], Math.max(1, Math.min(60, count)), Math.max(0, Math.min(20, speed)), Math.max(0.02, Math.min(1, size)), Math.max(0.05, Math.min(5, life)));
    },
    particleLine(x1, y1, z1, x2, y2, z2, color) {
      const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
      const n = Math.min(60, Math.max(2, Math.ceil(a.distanceTo(b) * 3)));
      for (let i = 0; i <= n; i++) spawnParticles(a.clone().lerp(b, i / n), [color], 1, 0, 0.05, 0.25);
    },
    playSound(name, x, y, z) {
      const pos = x !== undefined && y !== undefined && z !== undefined ? new THREE.Vector3(x, y, z) : null;
      const sfx = ['hurt', 'pickup', 'eat', 'bow', 'arrowHit', 'hiss', 'explode', 'land', 'splash', 'teleport', 'throw', 'gunshot', 'reload', 'click', 'ding', 'pop'];
      if (!sfx.includes(name)) return false;
      playSfx(name as Parameters<typeof playSfx>[0], pos);
      return true;
    },
    explode(x, y, z, power) {
      explode(new THREE.Vector3(x, y, z), Math.max(0.5, Math.min(6, power)));
    },
    dropItem(x, y, z, id, count) {
      spawnDroppedItem(id, Math.max(1, Math.min(64, Math.floor(count))), new THREE.Vector3(x, y, z), new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.3);
    },
    recoil(amount) {
      const maxPitch = Math.PI / 2 - 0.01;
      pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch + Math.max(-0.5, Math.min(0.5, amount))));
      viewKick = Math.min(1, viewKick + Math.abs(amount) * 12); // the gun kicks back too
    },
    launch(vx, vy, vz) {
      playerKnock.set(Math.max(-40, Math.min(40, vx)), 0, Math.max(-40, Math.min(40, vz)));
      velocityY = Math.max(-40, Math.min(40, vy));
      wasGrounded = false;
    },
    damagePlayer(amount, cause) {
      playerHurtCooldown = 0;
      hurtPlayer(Math.max(0, Math.min(1000, amount)), null, 0, String(cause).slice(0, 40) || 'Magic');
    },
    heal(amount) {
      if (!dead) setStats(Math.min(20, health + Math.max(0, amount)), hunger);
    },
    applyEffect(name, seconds, level) {
      if (!EFFECT_NAMES.includes(name)) throw new Error(`Unknown effect "${name}". Try: ${EFFECT_NAMES.join(', ')}`);
      effects.set(name, { until: performance.now() + Math.max(0.1, Math.min(3600, seconds)) * 1000, level: Math.max(1, Math.min(5, Math.floor(level))) });
    },
    removeEffect(name) {
      effects.delete(name);
    },
    getEffects() {
      const now = performance.now();
      return [...effects.entries()].filter(([, e]) => e.until > now).map(([name, e]) => ({ name, level: e.level, seconds: Math.round((e.until - now) / 100) / 10 }));
    },
    getLook() {
      const v = new THREE.Vector3();
      camera.getWorldDirection(v);
      return { x: v.x, y: v.y, z: v.z };
    },
    getEye: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
    isOnGround: () => wasGrounded,
    getDimension: () => dimension,
    createDimension,
    travel: travelTo,
    listDimensions: () => ['overworld', 'nether', ...dimensionSpecs.keys()],
    refreshCustomBlocks,
    getTime: () => timeOfDay,
    setZoom(f) {
      scriptZoom = Math.max(0.1, Math.min(1, f));
      engineEvent('zoomChange', { zoom: scriptZoom });
    },
    setAiming(on) {
      gunAiming = !!on;
    },
    setPlayerStats(h, hu) {
      if (dead) return;
      setStats(h === null ? health : Math.max(1, Math.min(20, Math.round(h))), hu === null ? hunger : Math.max(0, Math.min(20, Math.round(hu))));
    },
  };

  // ---- Off-hand Time Core: a rolling 5-second memory of where you were ----
  const timeHistory: Array<{ t: number; x: number; y: number; z: number; health: number }> = [];
  let historyTimer = 0;
  function updateTimeHistory(dt: number) {
    historyTimer += dt;
    if (historyTimer < 0.25 || dead) return;
    historyTimer = 0;
    const now = performance.now();
    timeHistory.push({ t: now, x: camera.position.x, y: camera.position.y, z: camera.position.z, health });
    while (timeHistory.length && now - timeHistory[0].t > 6000) timeHistory.shift();
  }

  /** Called on fatal damage. Returns true if a Time Core saved you. */
  function tryTimeCore(): boolean {
    if (offhand?.id !== ITEM_TIME_CORE || lastDamageCause === '/kill command' || mode === 'spectator') return false;
    const now = performance.now();
    let past = timeHistory[0];
    for (let i = timeHistory.length - 1; i >= 0; i--) {
      if (now - timeHistory[i].t >= 5000) { past = timeHistory[i]; break; }
    }
    if (!past) return false;
    offhand = null; // the core shatters
    notifyInventory();
    spawnParticles(playerFeet().add(new THREE.Vector3(0, 1, 0)), ['#3fd0ff', '#e0fbff', '#f5c542'], 40, 4, 0.12, 1);
    camera.position.set(past.x, past.y, past.z);
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
    playerKnock.set(0, 0, 0);
    setStats(Math.max(past.health, 6), hunger);
    timeHistory.length = 0;
    playSfx('teleport', null);
    showHint('Your Time Core shattered and rewound time!');
    return true;
  }

  function getOffhand(): ItemStack | null {
    return offhand ? { ...offhand } : null;
  }

  function setOffhand(st: ItemStack | null) {
    offhand = st ? { id: st.id, count: st.count } : null;
    notifyInventory();
  }

  // ---- Script / mod hooks ----
  let blockEventCallback: ((type: 'break' | 'place', x: number, y: number, z: number, block: number) => void) | null = null;

  /** Place many blocks at once (scripts). Only in chunks that have been generated. */
  function setBlocks(list: Array<[number, number, number, number]>): number {
    const dirty = new Set<string>();
    let n = 0;
    for (const [x, y, z, b] of list) {
      if (y < 0 || y >= CHUNK_HEIGHT) continue;
      const c = world.getChunk(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      if (!c || !c.generated) continue;
      setBlockAndNotify(x, y, z, b);
      markDirty(x, z, dirty);
      n++;
    }
    rebuildDirty(dirty);
    return n;
  }

  function getBlock(x: number, y: number, z: number): number {
    return world.getWorldBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  /** Quick Craft: craft a recipe straight from inventory counts, no grid. */
  function quickCraft(recipeId: string, hasTable: boolean): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return false;
    if (r.needsTable && !hasTable) return false;
    const need: Record<number, number> = {};
    for (const p of r.pattern) if (p !== null) need[p] = (need[p] || 0) + 1;
    for (const k of Object.keys(need)) {
      if (countInSlots(slots, Number(k)) < need[Number(k)]) return false;
    }
    for (const k of Object.keys(need)) removeFromSlots(slots, Number(k), need[Number(k)]);
    const left = addToSlots(slots, r.output.id, r.output.count);
    if (left > 0) dropFromPlayer(r.output.id, left); // inventory full: drop the rest
    notifyInventory();
    return true;
  }

  function isCreative() {
    return mode === 'creative';
  }

  // Generate a set of crack-overlay textures, from lightly cracked to
  // shattered, drawn as random hairline fractures radiating from center.
  // Cracks are crisp 1px pixel-art fractures that start tight around the
  // center and creep outward stage by stage. Each stage builds on the
  // previous one, so the damage visibly spreads instead of re-randomizing.
  const crackTextures: THREE.CanvasTexture[] = [];
  const crackCanvas = document.createElement('canvas');
  crackCanvas.width = 16; crackCanvas.height = 16;
  const crackCtx = crackCanvas.getContext('2d')!;
  const crackTips: Array<[number, number, number]> = [];
  for (let i = 0; i < 5; i++) crackTips.push([8, 8, (i / 5) * Math.PI * 2 + Math.random() * 0.6]);
  for (let stage = 0; stage < CRACK_STAGES; stage++) {
    crackCtx.fillStyle = 'rgba(15,15,15,0.8)';
    if (stage % 3 === 2) crackTips.push([8, 8, Math.random() * Math.PI * 2]); // new branch from center
    for (const tip of crackTips) {
      for (let step = 0; step < 2; step++) {
        tip[2] += (Math.random() - 0.5) * 0.9;
        tip[0] = Math.max(0, Math.min(15, tip[0] + Math.round(Math.cos(tip[2]))));
        tip[1] = Math.max(0, Math.min(15, tip[1] + Math.round(Math.sin(tip[2]))));
        crackCtx.fillRect(tip[0], tip[1], 1, 1);
      }
    }
    // Fork occasionally for a web-like pattern
    if (stage >= 4 && crackTips.length < 14) {
      const src = crackTips[Math.floor(Math.random() * crackTips.length)];
      crackTips.push([src[0], src[1], src[2] + (Math.random() < 0.5 ? 1 : -1) * 0.9]);
    }
    const snapshot = document.createElement('canvas');
    snapshot.width = 16; snapshot.height = 16;
    snapshot.getContext('2d')!.drawImage(crackCanvas, 0, 0);
    const tex = new THREE.CanvasTexture(snapshot);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    crackTextures.push(tex);
  }

  const crackMat = new THREE.MeshBasicMaterial({
    map: crackTextures[0],
    transparent: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), crackMat);
  crackMesh.visible = false;
  crackMesh.frustumCulled = false;
  scene.add(crackMesh);

  // --- Graphics quality (Low/Medium/High/Max) ---
  // Motion blur is done as a cheap frame-persistence trick — a translucent
  // black quad drawn over the previous frame before the new one, done with
  // plain core three.js (no postprocessing add-ons needed).
  let motionBlurEnabled = false;
  const blurScene = new THREE.Scene();
  const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }),
  );
  blurScene.add(blurQuad);

  /**
   * Re-skins the running world after setTextureResolution(): swaps every
   * block material's texture, then rebuilds the held item, dropped items and
   * mob skins. Chunk meshes keep their shape (UVs don't change), so the
   * whole world updates in one frame.
   */
  function reloadTextures() {
    const fresh = baseMaterialCanvases(faceCanvases());
    fresh.forEach((c, i) => {
      const m = materials[i] as THREE.MeshLambertMaterial;
      const old = m.map;
      const t = worldTex(c);
      if (i === 34) { // the portal's texture scrolls, so it must repeat
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        portalTex = t;
      }
      m.map = t;
      m.needsUpdate = true;
      if (old) {
        old.dispose();
        const at = worldTextures.indexOf(old);
        if (at >= 0) worldTextures.splice(at, 1);
      }
    });
    applyGraphicsQuality(graphicsQuality); // sets sharpness on the new textures

    if (heldMesh) { camera.remove(heldMesh); disposeObject(heldMesh); heldMesh = null; }
    heldMeshId = null;
    updateHeldMesh();

    for (const d of droppedItems) {
      const old = d.mesh;
      const next = makeItemMesh(d.id, false);
      if (!next) continue;
      next.scale.copy(old.scale);
      next.position.copy(old.position);
      next.rotation.copy(old.rotation);
      next.castShadow = old.castShadow;
      scene.remove(old);
      disposeObject(old);
      scene.add(next);
      d.mesh = next;
    }

    for (const m of mobs) retextureModel(m.model);
    retextureModel(playerModel);
    (playerModel.root.userData as { heldId?: number | null }).heldId = undefined; // rebuilt with the new art next frame
    for (const rp of remotePlayers.values()) { retextureModel(rp.model); (rp.model.root.userData as { heldId?: number | null }).heldId = undefined; }
  }

  function applyGraphicsQuality(q: GraphicsQuality) {
    graphicsQuality = q;

    // Anisotropic filtering keeps ground textures crisp at grazing angles
    const aniso = q === 'high' || q === 'max' ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    for (const t of worldTextures) {
      if (t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; }
    }

    // Pixel ratio (rendering resolution)
    const dpr = window.devicePixelRatio || 1;
    const pixelRatioByTier: Record<GraphicsQuality, number> = {
      low: 1,
      medium: Math.min(1.5, dpr),
      high: Math.min(2, dpr),
      max: dpr,
    };
    renderer.setPixelRatio(pixelRatioByTier[q]);

    // Shadows — off at Low, progressively higher-res & softer above that
    const shadowsOn = q !== 'low';
    renderer.shadowMap.enabled = shadowsOn;
    renderer.shadowMap.type = q === 'medium' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    dirLight.castShadow = shadowsOn;
    const shadowMapSizeByTier: Record<GraphicsQuality, number> = { low: 512, medium: 1024, high: 2048, max: 4096 };
    const size = shadowMapSizeByTier[q];
    dirLight.shadow.mapSize.set(size, size);
    const frustumByTier: Record<GraphicsQuality, number> = { low: 30, medium: 40, high: 55, max: 70 };
    const f = frustumByTier[q];
    dirLight.shadow.camera.left = -f;
    dirLight.shadow.camera.right = f;
    dirLight.shadow.camera.top = f;
    dirLight.shadow.camera.bottom = -f;
    dirLight.shadow.camera.updateProjectionMatrix();

    // Apply shadow flags to every chunk mesh already in the world
    for (const k of loadedChunks) {
      const [cxs, czs] = k.split(',');
      const chunk = world.getChunk(parseInt(cxs, 10), parseInt(czs, 10));
      if (chunk?.mesh) {
        chunk.mesh.castShadow = shadowsOn;
        chunk.mesh.receiveShadow = shadowsOn;
      }
    }

    // (High/Max used to mix a pale-blue sky reflection into every block. It washed the whole world out
    // into a milky white haze, so it's gone. High/Max keep soft shadows, sharper textures, wind and shader water.)
    // Motion blur — Max only
    // Max used to turn on a dark full-screen "motion blur" overlay that just
    // looked like fog. It's gone: High/Max now get waving leaves and grass
    // plus animated shader water instead.
    motionBlurEnabled = false;
    foliageUniforms.uWave.value = q === 'max' ? 1 : q === 'high' ? 0.6 : 0;
    waterUniforms.uWaves.value = q === 'max' ? 1 : q === 'high' ? 0.7 : 0;
    waterUniforms.uDetail.value = q === 'max' ? 1 : 0;
  }

  // Simple voxel-stepping raycast (marches along the look direction and
  // samples world blocks directly — no need to raycast against the merged
  // chunk meshes, so it works regardless of how chunk geometry is batched).
  // Hits solid blocks and plants; fluids only when asked (buckets), so you can mine and build through water
  function raycastBlock(includeFluids = false): { x: number; y: number; z: number; placeX: number; placeY: number; placeZ: number } | null {
    camera.getWorldDirection(rayDir);
    let x = camera.position.x;
    let y = camera.position.y;
    let z = camera.position.z;
    let prevBx = Math.floor(x), prevBy = Math.floor(y), prevBz = Math.floor(z);
    const steps = Math.ceil(REACH_DISTANCE / RAY_STEP);
    for (let i = 0; i < steps; i++) {
      x += rayDir.x * RAY_STEP;
      y += rayDir.y * RAY_STEP;
      z += rayDir.z * RAY_STEP;
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      const rb = world.getWorldBlock(bx, by, bz);
      if (isSolid(rb) || CROSS_MAT[rb] >= 0 || (includeFluids && isFluid(rb))) {
        return { x: bx, y: by, z: bz, placeX: prevBx, placeY: prevBy, placeZ: prevBz };
      }
      if (bx !== prevBx || by !== prevBy || bz !== prevBz) {
        prevBx = bx; prevBy = by; prevBz = bz;
      }
    }
    return null;
  }

  // --- Chunk loading / unloading ---

  function rebuildChunkMesh(chunk: Chunk): THREE.Mesh | null {
    // Dispose old mesh
    if (chunk.mesh) {
      scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    rebuildFluidMesh(chunk);
    // Rebuild geometry
    const geo = world.buildChunkGeometry(chunk, grassTex, dirtTex, stoneTex);
    if (geo) {
      const mesh = new THREE.Mesh(geo, materials);
      const shadowsOn = graphicsQuality !== 'low';
      mesh.castShadow = shadowsOn;
      mesh.receiveShadow = shadowsOn;
      chunk.mesh = mesh;
      scene.add(mesh);
      return mesh;
    }
    return null;
  }

  function rebuildFluidMesh(chunk: Chunk) {
    if (chunk.fluidMesh) {
      scene.remove(chunk.fluidMesh);
      chunk.fluidMesh.geometry.dispose();
      chunk.fluidMesh = null;
    }
    const geo = world.buildFluidGeometry(chunk);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, fluidMaterials);
    mesh.renderOrder = 1; // after solid terrain, so it blends over it
    chunk.fluidMesh = mesh;
    scene.add(mesh);
  }

  function loadChunk(cx: number, cz: number) {
    const k = world.key(cx, cz);
    if (loadedChunks.has(k)) return;

    let chunk = world.getChunk(cx, cz);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      world.chunks.set(k, chunk);
    }
    if (!chunk.generated) {
      world.generateChunk(chunk);
      // Apply other players' edits that arrived before this chunk existed here
      const pend = pendingEdits.get(`${dimension}|${k}`);
      if (pend) {
        for (const [x, y, z, b] of pend) { world.setWorldBlock(x, y, z, b); world.scheduleAround(x, y, z); }
        pendingEdits.delete(`${dimension}|${k}`);
      }
    }

    // Build mesh
    rebuildChunkMesh(chunk);
    loadedChunks.add(k);

    // Rebuild already-loaded neighbors so their boundary faces stitch
    // correctly with this newly generated chunk's data
    const neighbors = [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]];
    for (const [nx, nz] of neighbors) {
      const nChunk = world.getChunk(nx, nz);
      if (nChunk && loadedChunks.has(world.key(nx, nz))) {
        rebuildChunkMesh(nChunk);
      }
    }
  }

  function unloadChunk(cx: number, cz: number) {
    const k = world.key(cx, cz);
    const chunk = world.getChunk(cx, cz);
    if (!chunk) return;
    if (chunk.mesh) {
      scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.fluidMesh) {
      scene.remove(chunk.fluidMesh);
      chunk.fluidMesh.geometry.dispose();
      chunk.fluidMesh = null;
    }
    loadedChunks.delete(k);

    // Rebuild remaining neighbors so their boundary faces become visible
    // now that this chunk's data is treated as solid-ungenerated again
    const neighbors = [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]];
    for (const [nx, nz] of neighbors) {
      const nChunk = world.getChunk(nx, nz);
      if (nChunk && loadedChunks.has(world.key(nx, nz))) {
        rebuildChunkMesh(nChunk);
      }
    }
  }

  // Rebuild one chunk plus any already-loaded orthogonal neighbors — used
  // after a block is broken so a change right at a chunk boundary stitches
  // correctly, the same way loadChunk/unloadChunk already do.
  function rebuildChunkAndBoundaryNeighbors(cx: number, cz: number) {
    const chunk = world.getChunk(cx, cz);
    if (chunk) rebuildChunkMesh(chunk);
    const neighbors = [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]];
    for (const [nx, nz] of neighbors) {
      const nChunk = world.getChunk(nx, nz);
      if (nChunk && loadedChunks.has(world.key(nx, nz))) {
        rebuildChunkMesh(nChunk);
      }
    }
  }

  // Chunks still waiting to load, nearest first. Draining this a couple per frame (instead of
  // only when you cross into a new chunk) means a teleport fills in the whole view, not just 4 chunks.
  let pendingLoads: Array<[number, number]> = [];

  function updateChunks() {
    const px = camera.position.x;
    const pz = camera.position.z;
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const rd = renderDistance;

    if (pcx !== currentChunkX || pcz !== currentChunkZ) {
      currentChunkX = pcx;
      currentChunkZ = pcz;

      // Everything within render distance that isn't loaded yet, nearest first
      pendingLoads = [];
      for (let dx = -rd; dx <= rd; dx++) {
        for (let dz = -rd; dz <= rd; dz++) {
          if (Math.sqrt(dx * dx + dz * dz) > rd + 0.5) continue;
          if (!loadedChunks.has(world.key(pcx + dx, pcz + dz))) pendingLoads.push([pcx + dx, pcz + dz]);
        }
      }
      pendingLoads.sort((a, b) => ((a[0] - pcx) ** 2 + (a[1] - pcz) ** 2) - ((b[0] - pcx) ** 2 + (b[1] - pcz) ** 2));

      // Unload chunks outside render distance
      const unloadMargin = 2;
      const toUnload: Array<[number, number]> = [];
      for (const k of loadedChunks) {
        const [cx, cz] = k.split(',').map(Number);
        if (Math.sqrt((cx - pcx) ** 2 + (cz - pcz) ** 2) > rd + unloadMargin) toUnload.push([cx, cz]);
      }
      for (const [cx, cz] of toUnload) unloadChunk(cx, cz);
    }

    // Load a few per frame to avoid stutter
    const MAX_LOADS_PER_FRAME = 3;
    let loaded = 0;
    while (pendingLoads.length && loaded < MAX_LOADS_PER_FRAME) {
      const [cx, cz] = pendingLoads.shift()!;
      if (loadedChunks.has(world.key(cx, cz))) continue;
      if (Math.sqrt((cx - pcx) ** 2 + (cz - pcz) ** 2) > rd + 0.5) continue; // you've moved on
      loadChunk(cx, cz);
      loaded++;
    }
  }

  // --- Initial spawn ---
  // Spawn on dry land: spiral out from the origin until we're out of the ocean
  let spawnX = 8, spawnZ = 8;
  spawnSearch: for (let r = 0; r <= 1024; r += 8) {
    for (let a = 0; a < 8; a++) {
      const x = 8 + Math.round(Math.cos((a * Math.PI) / 4) * r);
      const z = 8 + Math.round(Math.sin((a * Math.PI) / 4) * r);
      if (world.isDryLand(x, z)) { spawnX = x; spawnZ = z; break spawnSearch; }
      if (r === 0) break;
    }
  }
  // Generate the 9 chunks around spawn right away so there's ground to stand on
  const spawnCX = Math.floor(spawnX / CHUNK_SIZE), spawnCZ = Math.floor(spawnZ / CHUNK_SIZE);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) loadChunk(spawnCX + dx, spawnCZ + dz);
  }

  // Apply the initial graphics-quality tier now that chunk meshes exist
  applyGraphicsQuality(graphicsQuality);

  const spawnSurface = world.getSurfaceHeight(spawnX, spawnZ);
  camera.position.set(spawnX + 0.5, spawnSurface + 1 + PLAYER_EYE + 0.5, spawnZ + 0.5);

  // Reset so updateChunks fires on the first frame and loads the remaining
  // chunks within render distance (the 9 initial chunks are already loaded)
  currentChunkX = Infinity;
  currentChunkZ = Infinity;

  // --- Input handlers ---

  function onKeyDown(e: KeyboardEvent) {
    if (chatOpen || dead) return; // typing in chat, reading /help, or dead: ignore game keys
    keys[e.code] = true;
    if (e.code === 'F5') {
      e.preventDefault(); // F5 would reload the page
      perspective = (perspective + 1) % 3;
    }
    // Creative flight: double-tap Space to toggle (Minecraft-style)
    if (e.code === 'Space' && mode === 'creative' && !e.repeat) {
      const now = performance.now();
      if (now - lastSpaceTapTime < 300) {
        isFlying = !isFlying;
        velocityY = 0;
      }
      lastSpaceTapTime = now;
    }
    if (e.code === 'KeyF' && mode !== 'spectator' && !inventoryOpen) {
      const held = slots[selectedSlot];
      slots[selectedSlot] = offhand;
      offhand = held;
      notifyInventory();
    }
    if (e.code === 'KeyQ' && mode !== 'spectator' && !inventoryOpen && slots[selectedSlot]) {
      const st = slots[selectedSlot]!;
      slots[selectedSlot] = st.count > 1 ? { id: st.id, count: st.count - 1 } : null;
      notifyInventory();
      dropFromPlayer(st.id, 1);
    }
    if (e.code === 'KeyE' && mode !== 'spectator') {
      inventoryOpen = !inventoryOpen;
      if (!inventoryOpen) { atCraftingTable = false; openChestKey = null; openFurnaceKey = null; }
      inventoryOpenCallback?.(inventoryOpen, atCraftingTable, openChestKey, openFurnaceKey);
      if (inventoryOpen) {
        if (document.pointerLockElement) document.exitPointerLock();
      } else {
        safeLock();
      }
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isLocked) return;
    const sensitivity = 0.002;
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    const maxPitch = Math.PI / 2 - 0.01;
    pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
  }

  function onPointerLockChange() {
    isLocked = document.pointerLockElement === canvas;
  }

  function onMouseDown(e: MouseEvent) {
    if (chatOpen || dead) return;
    if (!isLocked) {
      safeLock();
      return;
    }
    if (e.button === 0) {
      // Mod items like guns use left-click to fire, so they never mine or punch
      if (heldItem !== null && CUSTOM_ITEMS.get(heldItem)?.leftClickUse && mode !== 'spectator') {
        leftUseDown = true;
        engineEvent('itemAttack', { item: heldItem, pressed: true });
        return;
      }
      punchPhase = PUNCH_DURATION; // swing animation
      if (mode !== 'spectator' && attackMobInSight()) return; // hitting a mob doesn't mine
      isMining = true;
    } else if (e.button === 2) {
      e.preventDefault();
      if (heldItem === ITEM_BOW && mode !== 'spectator') { startDrawingBow(); return; }
      if (heldItem !== null && TOOLS[heldItem]?.kind === 'sword' && mode !== 'spectator') {
        const h = raycastBlock();
        const b = h ? world.getWorldBlock(h.x, h.y, h.z) : BLOCK_AIR;
        const usable = b === BLOCK_CHEST || b === BLOCK_CRAFTING_TABLE || b === BLOCK_FURNACE || isDoor(b);
        if (!usable) { swordBlocking = true; return; } // hold right-click to block
      }
      placeBlock();
    }
  }

  // Right-click placement. Places the currently held block into the empty
  // cell adjacent to whatever face the player is looking at, refusing to
  // place inside the player's own body (which would trap them) and
  // consuming one item from the inventory (except in creative).
  function placeBlock() {
    if (mode === 'spectator') return; // spectators can't touch the world
    // Right-clicking armor puts it on (swapping with what you were wearing)
    if (heldItem !== null && ARMOR[heldItem] && slots[selectedSlot]) {
      const slot = ARMOR[heldItem].slot;
      const worn = armor[slot];
      armor[slot] = { id: heldItem, count: 1 };
      const st = slots[selectedSlot]!;
      slots[selectedSlot] = worn ? worn : st.count > 1 ? { id: st.id, count: st.count - 1 } : null;
      if (worn && st.count > 1) addItem(st.id, st.count - 1); // a stack of armor: keep the rest
      playSfx('pop', null);
      syncHeld();
      notifyInventory();
      return;
    }
    // Items you use rather than place
    // Items added by mods: their scripts decide what right-click does
    if (heldItem !== null && CUSTOM_ITEMS.has(heldItem) && FOOD_VALUES[heldItem] === undefined) {
      const h = raycastBlock();
      rightUseDown = true;
      engineEvent('itemUse', {
        item: heldItem,
        hit: h ? { x: h.x, y: h.y, z: h.z, block: world.getWorldBlock(h.x, h.y, h.z), placeX: h.placeX, placeY: h.placeY, placeZ: h.placeZ } : null,
      });
      punchPhase = PUNCH_DURATION;
      return;
    }
    if (heldItem === ITEM_FLINT_AND_STEEL) {
      const h = raycastBlock();
      if (h && tryLightPortal(h.placeX, h.placeY, h.placeZ)) punchPhase = PUNCH_DURATION;
      else if (h) showHint('Light the inside of an obsidian frame (at least 4 wide and 5 tall)');
      return;
    }
    if (heldItem === ITEM_ENDER_PEARL) { throwPearl(); return; }
    if (heldItem === ITEM_BUCKET || heldItem === ITEM_WATER_BUCKET || heldItem === ITEM_LAVA_BUCKET) { useBucket(); return; }

    const hit = raycastBlock();
    const target = hit ? world.getWorldBlock(hit.x, hit.y, hit.z) : BLOCK_AIR;
    // Doors open and close (adventure players can use them too)
    if (hit && isDoor(target)) { toggleDoor(hit.x, hit.y, hit.z); punchPhase = PUNCH_DURATION; return; }
    const interactive = target === BLOCK_CRAFTING_TABLE || target === BLOCK_CHEST || target === BLOCK_FURNACE;
    if (!interactive && tryEat()) return;
    if (!hit) return;

    // Right-clicking a crafting table, chest or furnace opens it instead of placing
    if (interactive) {
      inventoryOpen = true;
      atCraftingTable = target === BLOCK_CRAFTING_TABLE;
      openChestKey = target === BLOCK_CHEST ? `${hit.x},${hit.y},${hit.z}` : null;
      openFurnaceKey = target === BLOCK_FURNACE ? `${hit.x},${hit.y},${hit.z}` : null;
      inventoryOpenCallback?.(true, atCraftingTable, openChestKey, openFurnaceKey);
      if (document.pointerLockElement) document.exitPointerLock();
      if (target === BLOCK_CHEST) playBlockSound(BLOCK_CHEST, new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), 'place');
      return;
    }

    if (mode === 'adventure') return; // adventure mode can't build
    // Hoes turn grass and dirt into farmland
    const tool = heldTool();
    if (tool?.kind === 'hoe' && (target === BLOCK_GRASS || target === BLOCK_DIRT)) {
      const above = world.getWorldBlock(hit.x, hit.y + 1, hit.z);
      if (above !== BLOCK_AIR && above !== BLOCK_TALL_GRASS) return;
      if (above === BLOCK_TALL_GRASS) setBlockAndNotify(hit.x, hit.y + 1, hit.z, BLOCK_AIR);
      setBlockAndNotify(hit.x, hit.y, hit.z, BLOCK_FARMLAND);
      rebuildAround(hit.x, hit.z);
      playBlockSound(BLOCK_DIRT, new THREE.Vector3(hit.x + 0.5, hit.y + 1, hit.z + 0.5), 'place');
      blockEventCallback?.('place', hit.x, hit.y, hit.z, BLOCK_FARMLAND);
      punchPhase = PUNCH_DURATION;
      return;
    }
    // Seeds go on top of farmland
    if (heldItem === ITEM_SEEDS) {
      if (target !== BLOCK_FARMLAND || world.getWorldBlock(hit.x, hit.y + 1, hit.z) !== BLOCK_AIR) { showHint('Plant seeds on farmland: right-click grass or dirt with a hoe first'); return; }
      setBlockAndNotify(hit.x, hit.y + 1, hit.z, BLOCK_WHEAT_0);
      rebuildAround(hit.x, hit.z);
      playBlockSound(BLOCK_TALL_GRASS, new THREE.Vector3(hit.x + 0.5, hit.y + 1, hit.z + 0.5), 'place');
      blockEventCallback?.('place', hit.x, hit.y + 1, hit.z, BLOCK_WHEAT_0);
      consumeHeld(1);
      punchPhase = PUNCH_DURATION;
      return;
    }
    // Doors: two blocks tall, on the edge of the cell nearest you
    if (heldItem === ITEM_DOOR) {
      const [dx, dy, dz] = target === BLOCK_TALL_GRASS ? [hit.x, hit.y, hit.z] : [hit.placeX, hit.placeY, hit.placeZ];
      if (!isReplaceable(world.getWorldBlock(dx, dy, dz)) || !isReplaceable(world.getWorldBlock(dx, dy + 1, dz))) return;
      if (!isSolid(world.getWorldBlock(dx, dy - 1, dz))) { showHint('A door needs solid ground under it'); return; }
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // where you're looking
      const edge = Math.abs(fz) >= Math.abs(fx) ? (fz < 0 ? 2 : 0) : (fx < 0 ? 1 : 3);
      setBlockAndNotify(dx, dy, dz, BLOCK_DOOR_N + edge);
      setBlockAndNotify(dx, dy + 1, dz, BLOCK_DOOR_TOP);
      rebuildAround(dx, dz);
      playBlockSound(ITEM_PLANKS, new THREE.Vector3(dx + 0.5, dy + 0.5, dz + 0.5), 'place');
      blockEventCallback?.('place', dx, dy, dz, BLOCK_DOOR_N + edge);
      consumeHeld(1);
      punchPhase = PUNCH_DURATION;
      return;
    }
    if (heldItem === null || heldItem >= 100) return; // ids 100+ are items, not placeable blocks
    // Placing onto tall grass replaces it, like Minecraft
    const [px, py, pz] = target === BLOCK_TALL_GRASS ? [hit.x, hit.y, hit.z] : [hit.placeX, hit.placeY, hit.placeZ];
    const existing = world.getWorldBlock(px, py, pz);
    if (!(isReplaceable(existing) || isFluid(existing))) return;
    if (isSolid(heldItem) && playerOverlapsBlock(px, py, pz)) return; // don't build inside yourself
    if (heldItem === BLOCK_TALL_GRASS) {
      const below = world.getWorldBlock(px, py - 1, pz);
      if (below !== BLOCK_GRASS && below !== BLOCK_DIRT) return;
    }

    setBlockAndNotify(px, py, pz, heldItem);
    rebuildAround(px, pz);
    playBlockSound(heldItem, new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5), 'place');
    blockEventCallback?.('place', px, py, pz, heldItem);
    consumeHeld(1);
    punchPhase = PUNCH_DURATION;
  }

  function playerOverlapsBlock(bx: number, by: number, bz: number): boolean {
    const r = 0.3;
    const feet = camera.position.y - PLAYER_EYE;
    return bx + 1 > camera.position.x - r && bx < camera.position.x + r &&
      bz + 1 > camera.position.z - r && bz < camera.position.z + r &&
      by + 1 > feet && by < feet + PLAYER_HEIGHT;
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault(); // right-click places blocks, never opens a browser menu
  }

  function onMouseUp(e: MouseEvent) {
    if (e.button === 2 && bowDrawing) releaseBow();
    if (e.button === 2) swordBlocking = false;
    if (e.button === 0 && leftUseDown) {
      leftUseDown = false;
      if (heldItem !== null) engineEvent('itemAttack', { item: heldItem, pressed: false });
    }
    if (e.button === 2 && rightUseDown) {
      rightUseDown = false;
      if (heldItem !== null) engineEvent('itemUseEnd', { item: heldItem });
    }
    if (e.button === 0) {
      isMining = false;
      miningTarget = null;
      miningProgress = 0;
      crackMesh.visible = false;
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    viewCamera.aspect = camera.aspect;
    viewCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  window.addEventListener('resize', onResize);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  safeLock();

  // --- Animation loop ---

  const clock = new THREE.Clock();
  let rafId: number;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const rawDelta = clock.getDelta();
    const delta = Math.min(rawDelta, 0.1);
    fpsFrames++;
    fpsTime += rawDelta;
    if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }

    // Look
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // Movement
    const noclip = mode === 'spectator';
    const inFluidNow = noclip ? null : playerInFluid();
    // No sprinting at 3 hunger bars (6 points) or less, like Minecraft
    // No sprinting backwards, and none at 3 hunger bars (6 points) or less
    const sprintHeld = (keys['ShiftLeft'] || keys['ShiftRight']) && !!keys['KeyW'] && !keys['KeyS'] && !(canBeAttacked() && hunger <= 6) && !inFluidNow;
    const walkSpeed = (sprintHeld ? SPRINT_SPEED : WALK_SPEED) * (1 + 0.2 * effectLevel('speed')) * Math.max(0.2, 1 - 0.15 * effectLevel('slowness'));
    // While flying, Shift means "descend", so flight gets its own steady speed
    const onSoulSand = world.getWorldBlock(Math.floor(camera.position.x), Math.floor(camera.position.y - PLAYER_EYE - 0.1), Math.floor(camera.position.z)) === BLOCK_SOUL_SAND;
    const fluidSlow = (inFluidNow === 'water' ? 0.6 : inFluidNow === 'lava' ? 0.45 : 1) * (onSoulSand ? 0.55 : 1);
    const speed = isFlying ? WALK_SPEED * (noclip ? 2.6 : 2.2) : walkSpeed * fluidSlow;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    const moveVec = new THREE.Vector3();
    if (!inventoryOpen) {
      if (keys['KeyW']) moveVec.add(forward);
      if (keys['KeyS']) moveVec.sub(forward);
      if (keys['KeyD']) moveVec.add(right);
      if (keys['KeyA']) moveVec.sub(right);
    }

    // Horizontal collision — check a small square footprint at feet and
    // head height so the player can't walk through block sides. Axes are
    // resolved separately so sliding along a wall still works.
    const PLAYER_RADIUS = 0.3;
    // Does the block at (bx,by,bz) overlap this footprint? Doors and panes only block their thin part.
    function cellBlocks(bx: number, by: number, bz: number, x0: number, x1: number, z0: number, z1: number): boolean {
      const b = world.getWorldBlock(bx, by, bz);
      if (!isSolid(b)) return false;
      const boxes = b === BLOCK_GLASS_PANE || isDoor(b) ? shapeBoxes(b, (dx, dy, dz) => world.getWorldBlock(bx + dx, by + dy, bz + dz)) : null;
      if (!boxes) return true;
      return boxes.some(([a0, , c0, a1, , c1]) => x1 > bx + a0 && x0 < bx + a1 && z1 > bz + c0 && z0 < bz + c1);
    }
    function footprintBlocked(x: number, z: number, rows: number[]): boolean {
      const r = PLAYER_RADIUS;
      for (const by of rows) {
        for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++) {
          for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++) {
            if (cellBlocks(bx, by, bz, x - r, x + r, z - r, z + r)) return true;
          }
        }
      }
      return false;
    }
    function canMoveTo(x: number, z: number): boolean {
      const feetY = Math.floor(camera.position.y - PLAYER_EYE);
      const headY = Math.floor(camera.position.y - PLAYER_EYE + PLAYER_HEIGHT - 0.1);
      return !footprintBlocked(x, z, feetY === headY ? [feetY] : [feetY, headY]);
    }
    // Would the player's whole body overlap a block if their eyes were at eyeY?
    function bodyBlockedAt(x: number, eyeY: number, z: number): boolean {
      const feet = Math.floor(eyeY - PLAYER_EYE);
      const head = Math.floor(eyeY - PLAYER_EYE + PLAYER_HEIGHT - 0.1);
      const rows: number[] = [];
      for (let y = feet; y <= head; y++) rows.push(y);
      return footprintBlocked(x, z, rows);
    }

    sprintingNow = sprintHeld && !isFlying && moveVec.lengthSq() > 0;
    // If something ever wedges the player inside blocks, let them walk out
    const stuckInside = !noclip && bodyBlockedAt(camera.position.x, camera.position.y, camera.position.z);
    if (moveVec.lengthSq() > 0) {
      moveVec.normalize().multiplyScalar(speed * delta);
      const newX = camera.position.x + moveVec.x;
      const newZ = camera.position.z + moveVec.z;
      if (noclip || stuckInside || canMoveTo(newX, camera.position.z)) camera.position.x = newX;
      if (noclip || stuckInside || canMoveTo(camera.position.x, newZ)) camera.position.z = newZ;
    }
    // Knockback from mobs and explosions
    if (playerKnock.lengthSq() > 0.01) {
      const kx = camera.position.x + playerKnock.x * delta;
      const kz = camera.position.z + playerKnock.z * delta;
      if (noclip || canMoveTo(kx, camera.position.z)) camera.position.x = kx;
      if (noclip || canMoveTo(camera.position.x, kz)) camera.position.z = kz;
      playerKnock.multiplyScalar(Math.max(0, 1 - 6 * delta));
    }

    if (isFlying) {
      // Creative flight: no gravity, Space ascends, Shift descends.
      const FLY_SPEED = 10;
      velocityY = 0;
      let dyFly = 0;
      if (keys['Space']) dyFly += FLY_SPEED * delta;
      if (keys['ShiftLeft'] || keys['ShiftRight']) dyFly -= FLY_SPEED * delta;
      if (dyFly !== 0) {
        const newY = camera.position.y + dyFly;
        // Creative flight still collides with blocks; only spectator passes through
        if (noclip || !bodyBlockedAt(camera.position.x, newY, camera.position.z)) camera.position.y = newY;
      }
      // Reset fall tracking so disabling flight mid-air doesn't instantly
      // apply damage for the whole flight's height.
      wasGrounded = true;
      fallPeakY = camera.position.y;
    } else {
    // Gravity & jumping with real per-block collision. This checks the
    // actual block directly beneath the player's feet instead of the
    // tallest block anywhere in that whole column — the old column-max
    // approach caused a teleport-up glitch: moving even slightly toward a
    // taller neighboring column mid-fall would suddenly report a much
    // higher "floor" and snap the player up into it.
    if (inFluidNow) {
      // Swimming: gentle sinking, hold Space to swim up, and water breaks your fall
      velocityY += GRAVITY * 0.2 * delta;
      if (keys['Space']) velocityY = Math.min(velocityY + 24 * delta, 3.2);
      velocityY = Math.max(velocityY, -3);
      fallPeakY = camera.position.y;
      if (inFluidNow === 'lava' && canBeAttacked()) hurtPlayer(4, null, 0, 'Lava');
    } else {
      const slowFall = effectLevel('slow_falling') > 0 && velocityY < 0;
      velocityY += GRAVITY * delta * (slowFall ? 0.12 : 1);
      if (slowFall) { velocityY = Math.max(velocityY, -2.5); fallPeakY = camera.position.y; }
    }
    if (velocityY < -45) velocityY = -45; // terminal velocity
    let nextY = camera.position.y + velocityY * delta;
    // Ceiling: stop rising when the head would enter a block (jumping into a
    // low gap used to wedge the player inside blocks)
    if (velocityY > 0 && footprintSolid(camera.position.x, Math.floor(nextY - PLAYER_EYE + PLAYER_HEIGHT), camera.position.z)) {
      nextY = camera.position.y;
      velocityY = 0;
    }
    // Ground: check the player's whole footprint, not just the block under
    // their center. Checking only the center made you fall into the gap when
    // standing on an edge. Every row passed this frame is checked so a fast
    // fall can't skip through a 1-block floor.
    let landRow = -1;
    if (velocityY <= 0) {
      const curFeet = camera.position.y - PLAYER_EYE;
      for (let r = Math.floor(curFeet - 0.001); r >= Math.floor(nextY - PLAYER_EYE); r--) {
        if (footprintSolid(camera.position.x, r, camera.position.z)) { landRow = r; break; }
      }
    }
    const isGrounded = landRow >= 0;

    // Fall damage: track the highest point reached during the current
    // airborne phase, and on landing, apply damage for how far below that
    // peak we fell — jumping doesn't hurt since the apex is only ~1 block
    // up, but falling off a cliff does.
    if (!isGrounded && wasGrounded) {
      fallPeakY = camera.position.y; // just left the ground
    } else if (!isGrounded) {
      fallPeakY = Math.max(fallPeakY, camera.position.y);
    } else if (isGrounded && !wasGrounded) {
      const fallDistance = fallPeakY - nextY;
      if (fallDistance > 1.2) playSfx('land', null);
      if (fallDistance > 3.5) {
        if (mode === 'survival' || mode === 'adventure') hurtPlayer(Math.floor(fallDistance - 3.5), null, 0, 'Fall damage');
      }
    }
    wasGrounded = isGrounded;

    if (isGrounded) {
      camera.position.y = landRow + 1 + PLAYER_EYE;
      velocityY = 0;
      if (keys['Space']) velocityY = JUMP_FORCE + effectLevel('jump_boost') * 1.8;
    } else {
      camera.position.y = nextY;
    }
    }

    // --- Hunger & health (survival/adventure only; creative & spectator are immortal) ---
    if ((mode === 'survival' || mode === 'adventure') && !dead) {
    // Sprinting burns hunger 3x faster
    hungerTimer += delta * (sprintingNow ? 3 : 1);
    if (hunger >= 18 && health > 0 && health < 20) {
      regenTimer += delta;
      if (regenTimer >= 4) { regenTimer = 0; setStats(health + 1, hunger); }
    } else {
      regenTimer = 0;
    }
    if (hungerTimer >= 20) {
      hungerTimer = 0;
      if (hunger > 0) setStats(health, hunger - 1);
    }
    if (hunger <= 0) {
      starveTimer += delta;
      if (starveTimer >= 6) {
        starveTimer = 0;
        playerHurtCooldown = 0;
        hurtPlayer(1, null, 0, 'Starvation');
      }
    } else {
      starveTimer = 0;
    }
    }
    // Falling out of the world
    if (camera.position.y < -30 && canBeAttacked()) {
      lastDamageCause = 'Falling out of the world';
      setStats(0, hunger);
    }
    // Death: no automatic respawn any more; the death screen has a Respawn button
    if (health <= 0 && !dead && !tryTimeCore()) die(lastDamageCause);

    // --- Punch animation spring ---
    if (punchPhase > 0) {
      punchPhase -= delta;
      if (punchPhase < 0) punchPhase = 0;
      // Normalize 0..1 through the animation (1 = just started, 0 = done)
      const t = punchPhase / PUNCH_DURATION;
      // Ease: fast thrust out (first half), smooth pull back (second half)
      // Use a sine curve so it's smooth in both directions
      const punchProgress = Math.sin(t * Math.PI); // 0→1→0
      fistMesh.position.z = FIST_REST_Z + (FIST_PUNCH_Z - FIST_REST_Z) * punchProgress;
      // Slight downward dip and rotation during punch
      fistMesh.position.y = FIST_REST_Y - 0.15 * punchProgress;
      fistMesh.rotation.x = FIST_REST_ROT_X + 0.4 * punchProgress;
    } else {
      fistMesh.position.set(FIST_REST_X, FIST_REST_Y, FIST_REST_Z);
      fistMesh.rotation.set(FIST_REST_ROT_X, FIST_REST_ROT_Y, FIST_REST_ROT_Z);
    }
    // Guns: held in one or two hands, aim down sights, kick on recoil, hide when scoped
    const hold = heldItem !== null ? CUSTOM_ITEMS.get(heldItem)?.hold ?? 'item' : 'item';
    const scoped = scriptZoom < 0.5;
    aimLerp += ((gunAiming ? 1 : 0) - aimLerp) * Math.min(1, delta * 12);
    viewKick = Math.max(0, viewKick - delta * 7);
    const L = (a: number, b: number) => a + (b - a) * aimLerp;
    if (hold !== 'item' && heldMesh) {
      const two = hold === 'two_hands';
      heldMesh.visible = !scoped;
      heldMesh.position.set(L(heldBase.x, 0), L(heldBase.y, -0.2), heldBase.z + 0.08 * viewKick);
      heldMesh.rotation.set(0.18 * viewKick, Math.PI / 2 + (two ? 0.12 : 0.07) * (1 - aimLerp), 0);
      fistMesh.visible = !scoped;
      fistMesh.position.set(L(two ? 0.36 : 0.5, 0.12), L(-0.64, -0.55), -0.22 + 0.06 * viewKick);
      fistMesh.rotation.set(0.14, 0.06, 0);
      leftArm.visible = two && !scoped;
      leftArm.position.set(L(-0.06, -0.16), L(-0.6, -0.52), -0.5 + 0.05 * viewKick);
      leftArm.rotation.set(0.32, -0.55, 0);
    } else {
      fistMesh.visible = true;
      leftArm.visible = false;
      if (heldMesh) heldMesh.visible = true;
    }
    // The held item swings with the punch, and a bow pulls back while drawn
    const isSword = heldItem !== null && TOOLS[heldItem]?.kind === 'sword';
    if (!isSword || !isLocked) swordBlocking = false;
    blockLerp += ((swordBlocking ? 1 : 0) - blockLerp) * Math.min(1, delta * 14);
    // Hand bob: the hand sways a little against the camera's own bob while you walk
    const hbx = perspective === 0 ? Math.sin(bobPhase) * 0.022 * bobAmount : 0;
    const hby = perspective === 0 ? -Math.abs(Math.cos(bobPhase)) * 0.026 * bobAmount : 0;
    if (heldMesh && hold === 'item') {
      const sw = punchPhase > 0 ? Math.sin((punchPhase / PUNCH_DURATION) * Math.PI) : 0;
      const draw = bowDrawing ? bowCharge() : 0;
      if (heldItem !== null && TOOLS[heldItem]) {
        // Swing: the blade arcs down toward the crosshair, then back
        const b = blockLerp, B = (a: number, c: number) => a + (c - a) * b;
        heldMesh.position.set(B(TOOL_FP.x, BLOCK_FP.x) - 0.16 * sw + hbx, B(TOOL_FP.y, BLOCK_FP.y) + 0.06 * sw + hby, B(TOOL_FP.z, BLOCK_FP.z) - 0.18 * sw);
        heldMesh.rotation.set(B(TOOL_FP.rx, BLOCK_FP.rx) - 0.55 * sw, B(TOOL_FP.ry, BLOCK_FP.ry) + 0.25 * sw, B(TOOL_FP.rz, BLOCK_FP.rz) + 0.5 * sw);
      } else {
        heldMesh.position.set(heldBase.x - 0.12 * sw - 0.12 * draw + hbx, heldBase.y + 0.05 * sw + hby, heldBase.z - 0.25 * sw + 0.12 * draw);
      }
    }
    if (hold === 'item') { fistMesh.position.x += hbx; fistMesh.position.y += hby; }
    updateOffhandMesh();
    if (offMesh) {
      offMesh.visible = perspective === 0 && hold !== 'two_hands' && !scoped && !bowDrawing;
      offMesh.position.x = (blockFaces(offMeshId!) ? -0.5 : -0.5) - hbx;
      offMesh.position.y = (blockFaces(offMeshId!) ? -0.46 : -0.4) + hby;
    }
    // Bow zoom
    sprintFov += ((sprintingNow ? 1 : 0) - sprintFov) * Math.min(1, delta * 6); // running widens the view a little
    const targetFov = baseFov * (1 + 0.12 * sprintFov) * (bowDrawing ? 1 - 0.15 * bowCharge() : 1) * scriptZoom * (1 - 0.12 * aimLerp);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 12);
      camera.updateProjectionMatrix();
    }

    updateDroppedItems(delta);
    updatePearls(delta);
    updateTimeHistory(delta);
    updatePortal(delta);
    updateProjectiles(delta);
    updateEffects(delta);
    updateFluids(delta);
    updateMobs(delta);
    updateArrows(delta);
    updateParticles(delta);
    updateFootsteps();
    updateFurnaces(delta);
    updateCrops(delta);
    updateRemotePlayers(delta);

    // --- Block breaking (mining) ---
    if (isLocked && isMining && (mode === 'survival' || mode === 'creative')) {
      const hit = raycastBlock();
      if (hit) {
        if (!miningTarget || hit.x !== miningTarget.x || hit.y !== miningTarget.y || hit.z !== miningTarget.z) {
          miningTarget = hit;
          miningProgress = 0;
        }

        const blockType = world.getWorldBlock(hit.x, hit.y, hit.z);
        // Tough blocks need a strong enough pickaxe (stone needs at least wood,
        // ores need stone, obsidian needs diamond). Too weak = can't break it.
        const need = requiredTier(blockType);
        const tooWeak = need > 0 && pickTier() < need;
        const unbreakable = mode !== 'creative' && blockType === BLOCK_BEDROCK;
        // Bare hands or too weak a pickaxe still break it, but slowly, and it drops nothing
        const bare = heldTool() === null;
        // Creative mode breaks instantly, like real Minecraft
        const breakTime = mode === 'creative' ? 0 : ((BLOCK_HARDNESS[blockType] ?? CUSTOM_BLOCKS.get(blockType)?.hardness ?? BREAK_TIME) / toolSpeed(blockType)) * (tooWeak ? 5 : bare ? 1.5 : 1);
        if (!unbreakable) miningProgress += delta;
        digSoundTimer -= delta;
        if (digSoundTimer <= 0 && breakTime > 0) {
          playBlockSound(blockType, new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), 'dig');
          digSoundTimer = 0.25;
        }

        // Keep swinging while mining
        if (punchPhase <= 0) punchPhase = PUNCH_DURATION;

        if (breakTime > 0 && !unbreakable) {
          const stage = Math.min(CRACK_STAGES - 1, Math.floor((miningProgress / breakTime) * CRACK_STAGES));
          if (crackMat.map !== crackTextures[stage]) {
            crackMat.map = crackTextures[stage];
            crackMat.needsUpdate = true;
          }
          crackMesh.position.set(miningTarget.x + 0.5, miningTarget.y + 0.5, miningTarget.z + 0.5);
          crackMesh.visible = true;
        }

        if (!unbreakable && miningProgress >= breakTime) {
          const { x: bx, y: by, z: bz } = miningTarget;
          const brokenType = world.getWorldBlock(bx, by, bz);
          const weakAtBreak = requiredTier(brokenType) > 0 && pickTier() < requiredTier(brokenType);
          setBlockAndNotify(bx, by, bz, BLOCK_AIR);
          rebuildAround(bx, bz);
          if (brokenType === BLOCK_CHEST) spillChest(bx, by, bz);
          if (brokenType === BLOCK_FURNACE) spillFurnace(bx, by, bz);
          if (isDoor(brokenType)) removeDoorPartner(bx, by, bz, brokenType);
          blockEventCallback?.('break', bx, by, bz, brokenType);
          if (brokenType === BLOCK_OBSIDIAN || brokenType === BLOCK_NETHER_PORTAL) breakPortalsAround(bx, by, bz);
          // Plants and doors can't float: they go when the block under them does
          popAbove(bx, by + 1, bz);
          playBlockSound(brokenType, new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5), 'break');
          spawnBlockParticles(brokenType, bx, by, bz);
          if (mode !== 'creative') {
            for (const [dropId, n] of dropsFor(brokenType, weakAtBreak)) {
              spawnDroppedItem(
                dropId, n,
                new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5),
                new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2),
                0.3,
              );
            }
          }
          miningTarget = null;
          miningProgress = 0;
          crackMesh.visible = false;
        }
      } else {
        miningTarget = null;
        miningProgress = 0;
        crackMesh.visible = false;
      }
    } else if (crackMesh.visible) {
      miningTarget = null;
      miningProgress = 0;
      crackMesh.visible = false;
    }

    // Dynamic chunk loading
    updateChunks();

    // Keep the shadow-casting light (and its frustum) centered on the
    // player, so shadows stay correct no matter how far from spawn they
    // roam, instead of only ever covering the area around world origin.
    // Light (and shadows) come from the sun by day and the moon by night
    {
      const lightDir = sunDir.y > 0 ? sunDir : moonDir;
      dirLight.position.copy(camera.position).addScaledVector(lightDir, 100);
      dirLight.target.position.copy(camera.position);
      dirLight.target.updateMatrixWorld();
    }

    updateDayNight(delta);
    applyFluidFog(delta);

    // Sky follows the player; clouds stay world-locked while drifting slowly
    sky.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 400);
    sun.lookAt(camera.position);
    cloudDrift += delta * 0.6;
    clouds.position.set(camera.position.x, CHUNK_HEIGHT + 14, camera.position.z);
    cloudTex.offset.set((camera.position.x + cloudDrift) / 150, -camera.position.z / 150);

    // View bobbing: a gentle sway while walking on the ground (visual only)
    {
      const moved = wasGrounded && !isFlying && mode !== 'spectator' && !dead
        ? Math.hypot(camera.position.x - lastBobPos.x, camera.position.z - lastBobPos.z) : 0;
      bobPhase += Math.min(moved, 0.5) * 2.2;
      bobAmount += ((moved > 0.002 ? 1 : 0) - bobAmount) * Math.min(1, delta * 8);
      lastBobPos.copy(camera.position);
    }
    const renderCam = updateViewCamera(delta);
    bobSaved.copy(camera.position);
    if (perspective === 0 && bobAmount > 0.01) {
      camera.getWorldDirection(bobRight);
      bobRight.cross(camera.up).normalize();
      camera.position.addScaledVector(bobRight, Math.sin(bobPhase) * 0.035 * bobAmount);
      camera.position.y += Math.abs(Math.cos(bobPhase)) * 0.05 * bobAmount;
      camera.updateMatrixWorld();
    }

    if (motionBlurEnabled) {
      // Cheap frame-persistence motion blur: fade the previous frame with a
      // translucent black quad, then draw the new frame on top without
      // clearing — camera movement leaves a soft trailing ghost.
      renderer.autoClear = false;
      renderer.render(blurScene, blurCamera);
      renderer.render(scene, renderCam);
    } else {
      renderer.autoClear = true;
      renderer.render(scene, renderCam);
    }

    // Render the arm in its own pass with a freshly cleared depth buffer.
    // This is the standard first-person-viewmodel trick: the arm keeps
    // normal depth testing against itself (so the fist correctly occludes
    // the sleeve), but since the depth buffer was just wiped, nothing in
    // the actual world can ever occlude or visually poke through it.
    if (perspective === 0) renderer.clearDepth();
    renderer.autoClear = false; // only depth was cleared above — keep the
    // already-drawn world in the color buffer instead of wiping it black
    if (perspective === 0) renderer.render(camera, camera);
    camera.position.copy(bobSaved); // undo the bob so gameplay never sees it
  }

  animate();

  // --- Render distance control ---

  function setRenderDistance(rd: number) {
    renderDistance = Math.max(2, Math.min(12, rd));
    updateFog();
    // Force chunk update on next frame
    currentChunkX = Infinity;
    currentChunkZ = Infinity;
  }

  function getRenderDistance() {
    return renderDistance;
  }

  // --- Cleanup ---

  function dispose() {
    cancelAnimationFrame(rafId);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mouseup', onMouseUp);
    if (document.pointerLockElement === canvas) document.exitPointerLock();

    // Dispose fluid meshes, water/lava materials
    for (const k of loadedChunks) {
      const [fx, fz] = k.split(',').map(Number);
      const c = world.getChunk(fx, fz);
      if (c?.fluidMesh) { scene.remove(c.fluidMesh); c.fluidMesh.geometry.dispose(); c.fluidMesh = null; }
    }
    waterMat.dispose(); lavaMat.dispose(); lavaTex.dispose();

    // Dispose all chunk geometries
    for (const k of loadedChunks) {
      const chunk = world.getChunk(
        parseInt(k.split(',')[0]),
        parseInt(k.split(',')[1]),
      );
      if (chunk?.mesh) {
        scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh = null;
      }
    }
    loadedChunks.clear();

    // Dispose dropped items and the held item
    for (let i = droppedItems.length - 1; i >= 0; i--) removeDropped(i);
    if (heldMesh) { camera.remove(heldMesh); disposeObject(heldMesh); heldMesh = null; }

    // Dispose mobs, arrows, particles, the player model, and audio
    for (let i = mobs.length - 1; i >= 0; i--) removeMob(i);
    for (const pp of pearls) scene.remove(pp.mesh);
    pearls.length = 0;
    for (let i = projectiles.length - 1; i >= 0; i--) removeProjectileAt(i);
    projectileGeo.dispose();
    pearlGeo.dispose();
    pearlMat.dispose();
    for (const a of arrows) scene.remove(a.mesh);
    arrows.length = 0;
    arrowShaftGeo.dispose(); arrowTipGeo.dispose(); arrowShaftMat.dispose(); arrowTipMat.dispose();
    for (const p of particles) scene.remove(p.mesh);
    particles.length = 0;
    particleGeo.dispose();
    for (const m of particleMats.values()) m.dispose();
    scene.remove(playerModel.root);
    disposeObject(playerModel.root);
    for (const t of playerModel.textures) t.dispose();
    if (audioCtx) { audioCtx.close(); audioCtx = null; }

    for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
    scene.remove(moon); moon.geometry.dispose(); moonMat.dispose();
    scene.remove(stars); starGeo.dispose(); starMat.dispose();

    // Dispose world textures and sky
    for (const t of worldTextures) t.dispose();
    scene.remove(sky); skyGeo.dispose(); skyMat.dispose();
    scene.remove(sun); sun.geometry.dispose(); sunMat.dispose();
    scene.remove(clouds); clouds.geometry.dispose(); cloudMat.dispose(); cloudTex.dispose();

    // Dispose arm model
    scene.remove(camera);
    camera.remove(fistMesh);
    armGeo.dispose();
    for (const m of armMaterials) m.dispose();
    armSideTex.dispose();
    armTopTex.dispose();
    armBottomTex.dispose();
    armBackTex.dispose();
    fistTex.dispose();

    // Dispose crack overlay
    scene.remove(crackMesh);
    crackMesh.geometry.dispose();
    crackMat.dispose();
    for (const t of crackTextures) t.dispose();

    // Dispose motion-blur quad and env map
    blurQuad.geometry.dispose();
    (blurQuad.material as THREE.Material).dispose();
    scene.remove(dirLight.target);

    // Dispose textures & materials
    for (const m of materials) m.dispose();
    grassTex.dispose();
    dirtTex.dispose();
    stoneTex.dispose();
    woodTex.dispose();
    leafTex.dispose();
    craftingTableTex.dispose();
    renderer.dispose();
  }

  function exit() {
    exitRequested = true;
    dispose();
  }

  function onExit(cb: () => void) {
    exitCallback = cb;
  }

  function getWorldMode() {
    return worldMode;
  }

  function setGraphicsQuality(q: GraphicsQuality) {
    applyGraphicsQuality(q);
  }

  function getGraphicsQuality() {
    return graphicsQuality;
  }

  function setFov(fov: number) {
    baseFov = fov;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    viewCamera.fov = fov;
    viewCamera.updateProjectionMatrix();
  }

  function setChatOpen(open: boolean) {
    chatOpen = open;
    if (open) {
      for (const k of Object.keys(keys)) keys[k] = false; // stop walking
      isMining = false;
      miningTarget = null;
      miningProgress = 0;
      crackMesh.visible = false;
    }
  }

  function relock() {
    safeLock();
  }

  function safeLock() {
    try {
      const r = canvas.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => { /* e.g. re-lock too soon after Esc; a click will lock */ });
    } catch { /* ignore */ }
  }

  function setGameMode(m: PlayMode) {
    mode = m;
    if (m === 'spectator') isFlying = true;
    else if (m !== 'creative') isFlying = false;
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
    fistMesh.visible = m !== 'spectator'; // spectators have no visible body
    isMining = false;
    crackMesh.visible = false;
    if (m === 'creative' || m === 'spectator') setStats(20, 20);
  }

  function getGameMode() {
    return mode;
  }

  function teleport(x: number, y: number, z: number) {
    camera.position.set(x, y + PLAYER_EYE, z);
    velocityY = 0;
    wasGrounded = true;
    fallPeakY = camera.position.y;
  }

  function clearInventory() {
    for (let i = 0; i < INVENTORY_SIZE; i++) slots[i] = null;
    notifyInventory();
  }

  function kill() {
    lastDamageCause = '/kill command';
    setStats(0, hunger); // the death check in the game loop takes it from here
  }

  function getDebugInfo(): DebugInfo {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const facing = Math.abs(dir.x) > Math.abs(dir.z)
      ? (dir.x > 0 ? 'east (+X)' : 'west (-X)')
      : (dir.z > 0 ? 'south (+Z)' : 'north (-Z)');
    const feetY = camera.position.y - PLAYER_EYE;
    const bx = Math.floor(camera.position.x);
    const bz = Math.floor(camera.position.z);
    const hit = raycastBlock();
    const target = hit
      ? { name: ITEM_INFO[world.getWorldBlock(hit.x, hit.y, hit.z)]?.name ?? 'Unknown', x: hit.x, y: hit.y, z: hit.z }
      : null;
    return {
      x: camera.position.x, y: feetY, z: camera.position.z,
      blockX: bx, blockY: Math.floor(feetY), blockZ: bz,
      chunkX: Math.floor(bx / CHUNK_SIZE), chunkZ: Math.floor(bz / CHUNK_SIZE),
      facing,
      yaw: (((-yaw * 180) / Math.PI) % 360 + 360) % 360,
      pitch: (-pitch * 180) / Math.PI,
      biome: world.getBiome(bx, bz), dimension, mode, flying: isFlying,
      loadedChunks: loadedChunks.size, renderDistance, graphics: graphicsQuality, fps,
      target,
      mobs: mobs.length,
      seed: effectiveSeed,
      clock: (() => {
        const hours = (timeOfDay * 24 + 6) % 24;
        const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
        return `Day ${dayCount}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      })(),
      night: isNight(),
      camera: ['first person', 'third person (back)', 'third person (front)'][perspective],
    };
  }

  function getFps() {
    return fps;
  }

  function getFov() {
    return camera.fov;
  }

  function getInventory(): Slots {
    return slots.map((st) => (st ? { ...st } : null));
  }

  function getHealth() {
    return health;
  }

  function getHunger() {
    return hunger;
  }

  function onInventoryChange(cb: (s: Slots, off: ItemStack | null, armor: Slots) => void) {
    inventoryCallback = cb;
  }

  function onStatsChange(cb: (health: number, hunger: number) => void) {
    statsCallback = cb;
  }

  function onInventoryToggle(cb: (open: boolean, atTable: boolean, chestKey: string | null) => void) {
    inventoryOpenCallback = cb;
  }

  return {
    dispose,
    exit,
    onExit,
    setRenderDistance,
    getRenderDistance,
    getWorldMode,
    setGraphicsQuality,
    reloadTextures,
    setPlayerLook: (look: PlayerLook) => applyPlayerLook(playerModel, look),
    setRemoteLook: (id: number, look: PlayerLook) => {
      const rp = remotePlayers.get(id);
      if (rp) applyPlayerLook(rp.model, look);
      else pendingRemoteLooks.set(id, look); // their position hasn't arrived yet
    },
    locateVillage: () => {
      if (dimension !== 'overworld') return null;
      const r = world.findVillage(camera.position.x, camera.position.z);
      return r ? { x: r.village.cx, z: r.village.cz, distance: Math.round(r.distance) } : null;
    },
    getGraphicsQuality,
    setFov,
    getFov,
    getInventory,
    getHealth,
    getHunger,
    onInventoryChange,
    onStatsChange,
    onInventoryToggle,
    craftFromGrid,
    addItem,
    removeItem,
    setSelectedSlot,
    getArmor: () => armor.map((st) => (st ? { ...st } : null)),
    setArmor,
    onEngineEvent: (cb: (name: string, data: Record<string, unknown>) => void) => { engineEventCallback = cb; },
    script: scriptApi,
    getOffhand,
    setOffhand,
    setBlocks,
    getBlock,
    onBlockEvent: (cb: (type: 'break' | 'place', x: number, y: number, z: number, block: number) => void) => { blockEventCallback = cb; },
    setSlots,
    getChest,
    getFurnace,
    setFurnace,
    setChest,
    onHint: (cb: (text: string) => void) => { hintCallback = cb; },
    getSaveData,
    loadSaveData,
    isCreative,
    dropItems,
    quickCraft,
    setChatOpen,
    relock,
    setGameMode,
    getGameMode,
    teleport,
    clearInventory,
    kill,
    getDebugInfo,
    getFps,
    closeInventory,
    onPlayerHurt: (cb: (amount: number) => void) => { hurtCallback = cb; },
    setSfxVolume,
    summonMob,
    onPlayerDeath: (cb: (reason: string) => void) => { deathCallback = cb; },
    respawn,
    setTime,
    setNetEnabled: (on: boolean) => { netEnabled = on; if (!on) blockOutbox.length = 0; },
    takeBlockChanges,
    applyRemoteBlocks,
    getNetState,
    setRemotePlayer,
    removeRemotePlayer,
  };
}
