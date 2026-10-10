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
  const c = makeCanvas(16, 16);
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

function drawBedrockCanvas(): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, 64, 64);
  const tones = ['#2e2e2e', '#6e6e6e', '#1c1c1c', '#454545'];
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      if (Math.random() < 0.55) {
        ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
        ctx.fillRect(x, y, 8, 8);
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

export type MobKind = 'pig' | 'cow' | 'chicken' | 'zombie' | 'skeleton' | 'creeper';
export const MOB_KINDS: MobKind[] = ['pig', 'cow', 'chicken', 'zombie', 'skeleton', 'creeper'];

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
  return c;
}

/**
 * Blocky Minecraft-style models built from boxes, 1 unit = 1/16 block.
 * Every model faces -Z (the same way the camera looks), so rotation.y = yaw
 * points it where it's walking. Limbs hang from pivot groups so they swing.
 */
function buildMobModel(kind: MobKind | 'player'): MobModel {
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
  const headMats = (side: HTMLCanvasElement, face: HTMLCanvasElement, top?: HTMLCanvasElement) => {
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
    head = box(root, [8, 8, 8], [0, 24, 0], [0, 4, 0], headMats(side, face, top));
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
  } else {
    const feathers = () => mobTex('#f4f4f4', ['#dedede'], 0.2);
    const legM = mat(mobTex('#e8a33a', ['#c98a2a'], 0.2));
    legs.push(box(root, [1, 5, 1], [-1.5, 5, 0], [0, -2.5, 0], legM));
    legs.push(box(root, [1, 5, 1], [1.5, 5, 0], [0, -2.5, 0], legM));
    body = box(root, [6, 6, 8], [0, 5, 0], [0, 3, 0], mat(feathers()));
    const wingM = mat(feathers());
    arms.push(box(root, [1, 4, 6], [-3.5, 10, 0], [0, -2, 0], wingM));
    arms.push(box(root, [1, 4, 6], [3.5, 10, 0], [0, -2, 0], wingM));
    const face = mobTex('#f4f4f4', ['#dedede'], 0.1, (ctx) => {
      ctx.fillStyle = '#111111'; ctx.fillRect(1, 2, 1, 1); ctx.fillRect(6, 2, 1, 1);
    });
    head = box(root, [4, 6, 3], [0, 9, -4], [0, 3, -1.5], headMats(feathers(), face));
    box(head, [4, 2, 2], [0, 0, 0], [0, 3.5, -4], mat(mobTex('#e8a33a', ['#c98a2a'], 0.1)));
    box(head, [2, 2, 1], [0, 0, 0], [0, 1.5, -3.5], mat(mobTex('#d32f2f', ['#b71c1c'], 0.2)));
  }
  return { root, head, body, legs, arms, materials, textures };
}

const MOB_INFO: Record<MobKind, { hp: number; speed: number; hostile: boolean; width: number; height: number }> = {
  pig: { hp: 10, speed: 1.6, hostile: false, width: 0.9, height: 0.9 },
  cow: { hp: 10, speed: 1.5, hostile: false, width: 0.9, height: 1.4 },
  chicken: { hp: 4, speed: 1.6, hostile: false, width: 0.4, height: 0.7 },
  zombie: { hp: 20, speed: 2.6, hostile: true, width: 0.6, height: 1.9 },
  skeleton: { hp: 20, speed: 2.4, hostile: true, width: 0.6, height: 1.9 },
  creeper: { hp: 20, speed: 2.3, hostile: true, width: 0.6, height: 1.7 },
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
    : [[ITEM_GUNPOWDER, r(1, 2)]];
  return list.filter(([, n]) => n > 0);
}

function shadeColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type FaceSet = { top: HTMLCanvasElement; side: HTMLCanvasElement; bottom: HTMLCanvasElement };
let faceCanvasCache: Record<string, HTMLCanvasElement> | null = null;

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
  };
  const st = faceCanvasCache.stone;
  faceCanvasCache.coalOre = oreCanvas(st, '#3a3a3a', '#141414');
  faceCanvasCache.ironOre = oreCanvas(st, '#d8af93', '#9c7458');
  faceCanvasCache.goldOre = oreCanvas(st, '#f5d33d', '#b8901c');
  faceCanvasCache.diamondOre = oreCanvas(st, '#7ff3fa', '#1fa9b5');
  faceCanvasCache.emeraldOre = oreCanvas(st, '#3df07f', '#0e8a3c');
  return faceCanvasCache;
}

/** Face textures for anything that should look like a cube; null for flat items. */
function blockFaces(id: number): FaceSet | null {
  const f = faceCanvases();
  const all = (c: HTMLCanvasElement): FaceSet => ({ top: c, side: c, bottom: c });
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
    default: return null;
  }
}

/** Flat pixel art for non-block items (sticks, tools). */
function itemCanvas(id: number): HTMLCanvasElement | null {
  const wood = { h: '#c9995b', H: '#8a5f30', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' };
  const stone = { h: '#a3a3a3', H: '#5f5f5f', s: STICK_LIGHT, S: STICK_DARK, g: '#4a3418' };
  switch (id) {
    case ITEM_STICK: return drawStickCanvas();
    case ITEM_WOOD_PICKAXE: return drawPixelMap(PICKAXE_MAP, wood);
    case ITEM_STONE_PICKAXE: return drawPixelMap(PICKAXE_MAP, stone);
    case ITEM_WOOD_SWORD: return drawPixelMap(SWORD_MAP, wood);
    case ITEM_STONE_SWORD: return drawPixelMap(SWORD_MAP, stone);
    case ITEM_WOOD_AXE: return drawPixelMap(AXE_MAP, wood);
    case ITEM_STONE_AXE: return drawPixelMap(AXE_MAP, stone);
    case ITEM_COAL: return drawLumpCanvas();
    case ITEM_DIAMOND: return drawGemCanvas('#c8fbff', '#4fd8e6', '#1d8a96');
    case ITEM_EMERALD: return drawGemCanvas('#b8ffcf', '#2ad46a', '#0e7a37');
    case ITEM_PORKCHOP: case ITEM_BEEF: case ITEM_CHICKEN: case ITEM_ROTTEN_FLESH: return drawFoodCanvas(id);
    case ITEM_BONE: case ITEM_ARROW: case ITEM_FEATHER: case ITEM_GUNPOWDER: case ITEM_LEATHER: case ITEM_BOW: return drawMiscItemCanvas(id);
    default: return null;
  }
}

const iconCache: Record<number, string> = {};

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
export const ITEM_PLANKS = 100;
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

export const ITEM_INFO: Record<number, { name: string; color: string }> = {
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
};

/** Hunger points restored by eating (right-click while holding). */
export const FOOD_VALUES: Record<number, number> = {
  [ITEM_PORKCHOP]: 3,
  [ITEM_BEEF]: 3,
  [ITEM_CHICKEN]: 2,
  [ITEM_ROTTEN_FLESH]: 4,
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
    id: 'stone_axe', name: 'Stone Axe',
    pattern: [
      BLOCK_STONE, BLOCK_STONE, null,
      BLOCK_STONE, ITEM_STICK, null,
      null, ITEM_STICK, null,
    ], width: 3, height: 3,
    output: { id: ITEM_STONE_AXE, count: 1 }, needsTable: true,
  },
];

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

type Biome = 'plains' | 'forest' | 'desert' | 'snowy' | 'mountains';

// Which entry of the chunk materials array each block face uses.
// Face order: 0 +X, 1 -X, 2 +Y (top), 3 -Y (bottom), 4 +Z, 5 -Z.
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
    default: return 3;
  }
}

class World {
  noise: PerlinNoise;
  biomeNoise: PerlinNoise;
  treeNoise: PerlinNoise;
  mountainNoise: PerlinNoise;
  flat: boolean;
  chunks: Map<string, Chunk> = new Map();

  constructor(seed: number = 42, flat = false) {
    this.flat = flat;
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
    if (this.flat) return 'plains';
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
    const h = SEA_LEVEL + 12 + n * (12 + m * 16) + m * (10 + Math.abs(ridge) * 14);
    return Math.max(4, Math.min(CHUNK_HEIGHT - 10, Math.floor(h)));
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

  // Place a tree at world coordinates (wx, surfaceY, wz) using the
  // TREE_BLUEPRINT. Blocks that cross chunk boundaries are injected
  // into neighboring chunks via setWorldBlock.
  placeTree(wx: number, surfaceY: number, wz: number) {
    for (const [dx, dy, dz, blockType] of TREE_BLUEPRINT) {
      const bx = wx + dx;
      const by = surfaceY + 1 + dy;
      const bz = wz + dz;
      if (by < 0 || by >= CHUNK_HEIGHT) continue;
      if (blockType === BLOCK_LEAVES) {
        const existing = this.getWorldBlock(bx, by, bz);
        if (existing !== BLOCK_AIR && existing !== BLOCK_LEAVES) continue;
      }
      this.setWorldBlock(bx, by, bz, blockType);
    }
  }

  generateChunk(chunk: Chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

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
        const height = this.terrainHeight(wx, wz);
        const biome = this.getBiome(wx, wz);

        let top: number, filler: number;
        if (height <= SEA_LEVEL + 1) { top = BLOCK_SAND; filler = BLOCK_SAND; } // beaches
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
            if (caveNoise > 0.45 && y > 3) continue; // leave as air
            b = this.oreAt(wx, y, wz, biome);
          }
          chunk.set(x, y, z, b);
        }
      }
    }

    // Decoration pass: trees, with spacing and density set by biome
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const surfaceY = this.getSurfaceHeightLocal(chunk, x, z);
        if (surfaceY < 0 || surfaceY + 8 >= CHUNK_HEIGHT) continue;
        const topBlock = chunk.get(x, surfaceY, z);
        if (topBlock !== BLOCK_GRASS && topBlock !== BLOCK_SNOW) continue;
        const { chance, spacing } = this.treeSettings(this.getBiome(wx, wz));
        if (chance <= 0 || this.hashCoord(wx, wz) >= chance) continue;
        if (this.hasNearbyTree(wx, wz, spacing)) continue;
        this.placeTree(wx, surfaceY, wz);
      }
    }

    chunk.generated = true;
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
      if (b !== BLOCK_AIR) return y;
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
          if (block === BLOCK_AIR) continue;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
            const neighbor = get(x + dx, y + dy, z + dz);
            // Leaves have holes, so faces behind them must still be drawn
            if (neighbor !== BLOCK_AIR && !(neighbor === BLOCK_LEAVES && block !== BLOCK_LEAVES)) continue;

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
              const s1 = get(q1[0], q1[1], q1[2]) !== BLOCK_AIR ? 1 : 0;
              const s2 = get(q2[0], q2[1], q2[2]) !== BLOCK_AIR ? 1 : 0;
              const cn = get(q3[0], q3[1], q3[2]) !== BLOCK_AIR ? 1 : 0;
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

export type DebugInfo = {
  x: number; y: number; z: number;
  blockX: number; blockY: number; blockZ: number;
  chunkX: number; chunkZ: number;
  facing: string; yaw: number; pitch: number;
  biome: string; mode: PlayMode; flying: boolean;
  loadedChunks: number; renderDistance: number; graphics: GraphicsQuality; fps: number;
  target: { name: string; x: number; y: number; z: number } | null;
  mobs: number;
  camera: string;
};

export type GameHandle = {
  dispose: () => void;
  exit: () => void;
  onExit: (cb: () => void) => void;
  setRenderDistance: (rd: number) => void;
  getRenderDistance: () => number;
  getWorldMode: () => GameWorldMode;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  getGraphicsQuality: () => GraphicsQuality;
  setFov: (fov: number) => void;
  getFov: () => number;
  getInventory: () => Record<number, number>;
  getHealth: () => number;
  getHunger: () => number;
  onInventoryChange: (cb: (inv: Record<number, number>) => void) => void;
  onStatsChange: (cb: (health: number, hunger: number) => void) => void;
  onInventoryToggle: (cb: (open: boolean, atTable: boolean) => void) => void;
  craftFromGrid: (grid: (number | null)[], size: number, hasTable: boolean) => number | null;
  addItem: (id: number, count: number) => void;
  removeItem: (id: number, count: number) => number;
  setHeldItem: (id: number | null) => void;
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
};

export function createVoxelGame(
  canvas: HTMLCanvasElement,
  initialRenderDistance: number = 6,
  worldMode: GameWorldMode = 'survival',
  initialGraphicsQuality: GraphicsQuality = 'medium',
  initialFov: number = 75,
  worldType: WorldType = 'default',
  initialSfxVolume: number = 0.6,
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
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

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
  function makeEnvCubeTexture(): THREE.CubeTexture {
    const faceGradients: [string, string][] = [
      ['#bcdfff', '#8fc6f5'], ['#bcdfff', '#8fc6f5'], // +x, -x
      ['#e8f6ff', '#a9d8f7'], ['#274060', '#152238'], // +y (sky), -y (ground)
      ['#bcdfff', '#8fc6f5'], ['#bcdfff', '#8fc6f5'], // +z, -z
    ];
    const images = faceGradients.map(([top, bottom]) => {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 16);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      return c;
    });
    const tex = new THREE.CubeTexture(images);
    tex.needsUpdate = true;
    return tex;
  }
  const envMap = makeEnvCubeTexture();

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
  // envMap/combine/reflectivity are wired up on every solid block material;
  // reflectivity itself starts at 0 and is only raised by applyGraphicsQuality
  // on High/Max, so Low/Medium look exactly as before.
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
  const materialCanvases = [
    fc.dirt, fc.grass, fc.dirt, fc.stone, fc.sand, fc.wood, fc.leaves, fc.table, fc.grassSide,
    fc.bedrock, fc.coalOre, fc.ironOre, fc.goldOre, fc.diamondOre, fc.emeraldOre, fc.logTop, fc.snow,
  ];
  const materials = materialCanvases.map((c, i) =>
    i === 6
      ? new THREE.MeshLambertMaterial({ map: worldTex(c), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ map: worldTex(c), vertexColors: true, envMap, combine: THREE.MixOperation, reflectivity: 0 }),
  );

  // World — seed varies by game mode so each mode generates different terrain
  const modeSeeds: Record<GameWorldMode, number> = {
    survival: 42,
    creative: 777,
    adventure: 1337,
  };
  const world = new World(modeSeeds[worldMode], worldType === 'superflat');
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
  };

  // Pickaxes speed up stone/ores, axes speed up wood. Wood tools 2x, stone 4x.
  function toolSpeed(block: number): number {
    const pick = heldItem === ITEM_STONE_PICKAXE ? 4 : heldItem === ITEM_WOOD_PICKAXE ? 2 : 1;
    const axe = heldItem === ITEM_STONE_AXE ? 4 : heldItem === ITEM_WOOD_AXE ? 2 : 1;
    if (block === BLOCK_STONE || (block >= BLOCK_COAL_ORE && block <= BLOCK_EMERALD_ORE)) return pick;
    if (block === BLOCK_WOOD || block === BLOCK_CRAFTING_TABLE) return axe;
    return 1;
  }

  // What a broken block drops. Ores need the right pickaxe tier, like Minecraft.
  function dropFor(block: number): number | null {
    if (block === BLOCK_AIR || block === BLOCK_BEDROCK) return null;
    const pickTier = heldItem === ITEM_STONE_PICKAXE ? 2 : heldItem === ITEM_WOOD_PICKAXE ? 1 : 0;
    switch (block) {
      case BLOCK_GRASS: return BLOCK_DIRT;
      case BLOCK_COAL_ORE: return pickTier >= 1 ? ITEM_COAL : null;
      case BLOCK_IRON_ORE: return pickTier >= 2 ? BLOCK_IRON_ORE : null;
      case BLOCK_GOLD_ORE: return pickTier >= 2 ? BLOCK_GOLD_ORE : null;
      case BLOCK_DIAMOND_ORE: return pickTier >= 2 ? ITEM_DIAMOND : null;
      case BLOCK_EMERALD_ORE: return pickTier >= 2 ? ITEM_EMERALD : null;
      default: return block;
    }
  }
  const CRACK_STAGES = 10;

  let isMining = false;
  let heldItem: number | null = null;
  let isFlying = false;
  let lastSpaceTapTime = 0;
  let miningTarget: { x: number; y: number; z: number } | null = null;
  let miningProgress = 0;
  const rayDir = new THREE.Vector3();

  // --- Inventory, health, hunger & crafting ---
  // Item ids: real block ids double as inventory item ids for the raw
  // blocks you mine; PLANKS/STICK are crafted-only items with ids outside
  // the block-id range so they never collide with a placeable block.
  const inventory: Record<number, number> = {};
  let health = 20;
  let hunger = 20;
  let hungerTimer = 0;
  let starveTimer = 0;
  let inventoryOpen = false;

  let inventoryCallback: ((inv: Record<number, number>) => void) | null = null;
  let statsCallback: ((health: number, hunger: number) => void) | null = null;
  let inventoryOpenCallback: ((open: boolean, atTable: boolean) => void) | null = null;
  let atCraftingTable = false;

  function addItem(id: number, count: number) {
    // Stacks cap at 64, matching Minecraft
    inventory[id] = Math.min(64, (inventory[id] || 0) + count);
    inventoryCallback?.({ ...inventory });
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

  /** Remove `count` of an item; returns how many were actually removed. */
  function removeItem(id: number, count: number): number {
    const have = inventory[id] || 0;
    const taken = Math.min(have, count);
    if (taken <= 0) return 0;
    inventory[id] = have - taken;
    if (inventory[id] <= 0) delete inventory[id];
    inventoryCallback?.({ ...inventory });
    return taken;
  }

  function setHeldItem(id: number | null) {
    heldItem = id;
    updateHeldMesh();
  }

  // --- Held item shown in the hand ---
  let heldMesh: THREE.Mesh | null = null;
  let heldMeshId: number | null = null;
  function updateHeldMesh() {
    if (heldMeshId === heldItem) return;
    if (heldMesh) { fistMesh.remove(heldMesh); disposeObject(heldMesh); heldMesh = null; }
    heldMeshId = heldItem;
    if (heldItem === null) return;
    const m = makeItemMesh(heldItem, true);
    if (!m) return;
    if (blockFaces(heldItem)) {
      // Blocks sit on top of the fist
      m.scale.setScalar(0.34);
      m.position.set(0, 0.24, -0.6);
      m.rotation.set(0, 0.6, 0);
    } else {
      // Tools/sticks stick up out of the fist, angled like Minecraft
      m.scale.setScalar(0.75);
      m.position.set(0.04, 0.34, -0.58);
      m.rotation.set(-0.35, -0.55, 0.4);
    }
    m.renderOrder = 999;
    m.frustumCulled = false;
    fistMesh.add(m);
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
      const hasRoom = (inventory[d.id] || 0) < 64;

      if (mode !== 'spectator' && d.age > d.pickupDelay && hasRoom && dist < 2.2) {
        if (dist < 0.9) {
          const take = Math.min(64 - (inventory[d.id] || 0), d.count);
          addItem(d.id, take);
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
        if (world.getWorldBlock(Math.floor(nx), Math.floor(d.pos.y), Math.floor(d.pos.z)) === BLOCK_AIR) d.pos.x = nx; else d.vel.x = 0;
        if (world.getWorldBlock(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(nz)) === BLOCK_AIR) d.pos.z = nz; else d.vel.z = 0;
        const ny = d.pos.y + d.vel.y * delta;
        const below = Math.floor(ny - 0.15);
        if (d.vel.y <= 0 && world.getWorldBlock(Math.floor(d.pos.x), below, Math.floor(d.pos.z)) !== BLOCK_AIR) {
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
    const kind = block === BLOCK_STONE || block === BLOCK_BEDROCK || (block >= BLOCK_COAL_ORE && block <= BLOCK_EMERALD_ORE) ? 'stone'
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
      default: // creepers are silent until they hiss
        if (hurt) noiseHit(pos, 'bandpass', 1500, 900, 0.15, 0.4, 0, 2);
    }
  }

  function playSfx(name: 'hurt' | 'pickup' | 'eat' | 'bow' | 'arrowHit' | 'hiss' | 'explode' | 'land', pos: THREE.Vector3 | null) {
    switch (name) {
      case 'hurt': tone(pos, 'square', 280, 160, 0.18, 0.3); noiseHit(pos, 'lowpass', 900, 400, 0.12, 0.3); break;
      case 'pickup': tone(pos, 'sine', 700, 1300, 0.09, 0.22); break;
      case 'eat': for (let i = 0; i < 3; i++) noiseHit(pos, 'bandpass', 1800, 1200, 0.07, 0.5, i * 0.14, 2); break;
      case 'bow': noiseHit(pos, 'bandpass', 1400, 600, 0.18, 0.5); tone(pos, 'triangle', 520, 180, 0.14, 0.3); break;
      case 'arrowHit': noiseHit(pos, 'bandpass', 900, 500, 0.07, 0.6, 0, 3); break;
      case 'hiss': noiseHit(pos, 'highpass', 3500, 2500, 1.5, 0.7, 0, 1, 1.2); break;
      case 'explode': noiseHit(pos, 'lowpass', 3000, 60, 1.6, 1.6); tone(pos, 'sine', 80, 30, 0.9, 0.9); break;
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
      if (world.getWorldBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)) !== BLOCK_AIR) p.vel.set(0, 0, 0);
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
      world.getWorldBlock(Math.floor(x - r), row, Math.floor(z - r)) !== BLOCK_AIR ||
      world.getWorldBlock(Math.floor(x + r), row, Math.floor(z - r)) !== BLOCK_AIR ||
      world.getWorldBlock(Math.floor(x - r), row, Math.floor(z + r)) !== BLOCK_AIR ||
      world.getWorldBlock(Math.floor(x + r), row, Math.floor(z + r)) !== BLOCK_AIR
    );
  }

  function playerFeet(): THREE.Vector3 {
    return new THREE.Vector3(camera.position.x, camera.position.y - PLAYER_EYE, camera.position.z);
  }

  function canBeAttacked() {
    return mode === 'survival' || mode === 'adventure';
  }

  function hurtPlayer(amount: number, from: THREE.Vector3 | null, knock = 6) {
    if (!canBeAttacked() || amount <= 0 || playerHurtCooldown > 0) return;
    playerHurtCooldown = 0.5; // brief invulnerability, like Minecraft
    setStats(health - amount, hunger);
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
    if (hunger >= 20 || (inventory[heldItem] || 0) <= 0) return false;
    const food = FOOD_VALUES[heldItem];
    removeItem(heldItem, 1);
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
    idleSoundTimer: number; shootCooldown: number; strafeDir: number; strafeTimer: number;
  };
  const mobs: Mob[] = [];
  let mobSpawnTimer = 0;
  const MAX_PASSIVE = 10;
  const MAX_HOSTILE = 6;

  const yawToward = (dx: number, dz: number) => Math.atan2(-dx, -dz);
  const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function spawnMob(kind: MobKind, pos: THREE.Vector3) {
    const model = buildMobModel(kind);
    model.root.position.copy(pos);
    scene.add(model.root);
    const yaw0 = Math.random() * Math.PI * 2;
    mobs.push({
      kind, model, pos: pos.clone(), velY: 0, knock: new THREE.Vector3(),
      yaw: yaw0, targetYaw: yaw0, health: MOB_INFO[kind].hp, hurtTime: 0, deathTime: -1,
      onGround: false, wanderTimer: Math.random() * 3, moving: false, walkPhase: 0,
      attackCooldown: 0, attackAnim: 0, fuse: 0, panicTime: 0,
      idleSoundTimer: 5 + Math.random() * 10, shootCooldown: 2, strafeDir: Math.random() < 0.5 ? 1 : -1, strafeTimer: 2,
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
    for (let i = 0; i < 12 && world.getWorldBlock(Math.floor(x), y, Math.floor(z)) !== BLOCK_AIR; i++) y++;
    for (let i = 0; i < 12 && world.getWorldBlock(Math.floor(x), y - 1, Math.floor(z)) === BLOCK_AIR; i++) y--;
    spawnMob(kind as MobKind, new THREE.Vector3(x, y, z));
    return true;
  }

  function trySpawnMob() {
    let passive = 0, hostile = 0;
    for (const m of mobs) { if (MOB_INFO[m.kind].hostile) hostile++; else passive++; }
    const wantHostile = Math.random() < 0.45;
    if (wantHostile ? hostile >= MAX_HOSTILE : passive >= MAX_PASSIVE) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 20;
    const x = Math.floor(camera.position.x + Math.cos(ang) * dist);
    const z = Math.floor(camera.position.z + Math.sin(ang) * dist);
    if (!loadedChunks.has(world.key(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))) return;
    const y = world.getSurfaceHeight(x, z);
    const ground = world.getWorldBlock(x, y, z);
    if (ground === BLOCK_AIR || ground === BLOCK_LEAVES || y < 2 || y >= CHUNK_HEIGHT - 3) return;
    if (wantHostile) {
      const kinds: MobKind[] = ['zombie', 'skeleton', 'creeper'];
      spawnMob(kinds[Math.floor(Math.random() * 3)], new THREE.Vector3(x + 0.5, y + 1, z + 0.5));
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
      world.getWorldBlock(Math.floor(x - half), row, Math.floor(z - half)) !== BLOCK_AIR ||
      world.getWorldBlock(Math.floor(x + half), row, Math.floor(z - half)) !== BLOCK_AIR ||
      world.getWorldBlock(Math.floor(x - half), row, Math.floor(z + half)) !== BLOCK_AIR ||
      world.getWorldBlock(Math.floor(x + half), row, Math.floor(z + half)) !== BLOCK_AIR
    );
  }

  function mobBlocked(x: number, y: number, z: number, half: number, height: number): boolean {
    for (let row = Math.floor(y + 0.01); row <= Math.floor(y + height - 0.01); row++) {
      if (mobFootprintSolid(x, row, z, half)) return true;
    }
    return false;
  }

  function lineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = b.clone().sub(a);
    const len = d.length();
    if (len === 0) return true;
    d.divideScalar(len);
    for (let t = 0.3; t < len; t += 0.3) {
      const p = a.clone().addScaledVector(d, t);
      if (world.getWorldBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== BLOCK_AIR) return false;
    }
    return true;
  }

  function hurtMob(m: Mob, amount: number, from: THREE.Vector3, knock = 7): boolean {
    if (m.deathTime >= 0 || m.hurtTime > 0) return false;
    m.health -= amount;
    m.hurtTime = 0.5;
    const dir = m.pos.clone().sub(from);
    dir.y = 0;
    if (dir.lengthSq() > 0) dir.normalize();
    m.knock.set(dir.x * knock, 0, dir.z * knock);
    m.velY = 5;
    m.onGround = false;
    if (!MOB_INFO[m.kind].hostile) m.panicTime = 4;
    playMobSound(m.kind, m.pos, true);
    if (m.health <= 0) {
      m.deathTime = 0;
      m.fuse = 0;
      for (const [id, count] of mobDrops(m.kind)) {
        spawnDroppedItem(id, count, m.pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
          new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.4);
      }
    }
    return true;
  }

  function weaponDamage(): number {
    switch (heldItem) {
      case ITEM_STONE_SWORD: return 5;
      case ITEM_WOOD_SWORD: return 4;
      case ITEM_STONE_AXE: return 4;
      case ITEM_WOOD_AXE: return 3;
      case ITEM_STONE_PICKAXE: return 3;
      case ITEM_WOOD_PICKAXE: return 2;
      default: return 1;
    }
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
    hurtMob(m, weaponDamage(), camera.position);
    return true;
  }

  // ---- Arrows ----
  const arrowShaftGeo = new THREE.BoxGeometry(0.04, 0.04, 0.6);
  const arrowTipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
  const arrowShaftMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3c });
  const arrowTipMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const arrows: Array<{ mesh: THREE.Group; pos: THREE.Vector3; vel: THREE.Vector3; life: number; stuck: boolean }> = [];

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
    arrows.push({ mesh, pos: from, vel, life: 0, stuck: false });
    playSfx('bow', m.pos);
  }

  function updateArrows(dt: number) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.life += dt;
      if (a.stuck) {
        if (a.life > 4) { scene.remove(a.mesh); arrows.splice(i, 1); }
        continue;
      }
      a.vel.y -= 20 * dt;
      // Sub-steps so a fast arrow can't skip past the player at low FPS
      const steps = Math.max(1, Math.ceil((a.vel.length() * dt) / 0.25));
      let removed = false;
      for (let s = 0; s < steps; s++) {
        const next = a.pos.clone().addScaledVector(a.vel, dt / steps);
        if (mode !== 'spectator') {
          const f = playerFeet();
          if (Math.hypot(next.x - f.x, next.z - f.z) < 0.45 && next.y > f.y && next.y < f.y + PLAYER_HEIGHT + 0.1) {
            hurtPlayer(3, a.pos.clone().sub(a.vel.clone().normalize()), 4);
            scene.remove(a.mesh);
            arrows.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (world.getWorldBlock(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z)) !== BLOCK_AIR) {
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

  function explode(center: THREE.Vector3, power: number) {
    const dirty = new Set<string>();
    const cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
    for (let dx = -power; dx <= power; dx++) {
      for (let dy = -power; dy <= power; dy++) {
        for (let dz = -power; dz <= power; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > power - 0.3 + Math.random() * 0.6) continue; // ragged crater edge
          const bx = cx + dx, by = cy + dy, bz = cz + dz;
          const b = world.getWorldBlock(bx, by, bz);
          if (b === BLOCK_AIR || b === BLOCK_BEDROCK) continue;
          world.setWorldBlock(bx, by, bz, BLOCK_AIR);
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
      hurtPlayer(Math.max(1, Math.round((1 - pd / reach) * 18)), center, 4 + 12 * (1 - pd / reach));
    }
    for (const m of mobs) {
      const md = m.pos.distanceTo(center);
      if (md < reach) hurtMob(m, Math.round((1 - md / reach) * 15), center, 10);
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
    m.attackAnim = Math.max(0, m.attackAnim - dt);

    const feet = playerFeet();
    const dx = feet.x - m.pos.x, dz = feet.z - m.pos.z, dy = feet.y - m.pos.y;
    const dh = Math.hypot(dx, dz);
    const hunting = info.hostile && canBeAttacked() && dh < 20 && Math.abs(dy) < 12;
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

    if (!info.hostile) {
      if (m.panicTime > 0) {
        m.panicTime -= dt;
        if (Math.random() < dt * 2) m.targetYaw = Math.random() * Math.PI * 2;
        wantX = -Math.sin(m.yaw) * info.speed * 2;
        wantZ = -Math.cos(m.yaw) * info.speed * 2;
      } else {
        wander(info.speed);
      }
    } else if (!hunting) {
      m.fuse = 0;
      wander(info.speed * 0.5);
    } else {
      m.targetYaw = yawToward(dx, dz);
      if (m.kind === 'zombie') {
        if (dh > 1.0) toward(info.speed);
        if (dh < 1.3 && Math.abs(dy) < 1.6 && m.attackCooldown <= 0) {
          hurtPlayer(3, m.pos);
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
              explode(m.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 3);
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
    else if (m.onGround && wantsMove && !mobBlocked(nx, m.pos.y + 1.05, m.pos.z, half, info.height)) m.velY = 7.5;
    const nz = m.pos.z + vz * dt;
    if (!mobBlocked(m.pos.x, m.pos.y, nz, half, info.height)) m.pos.z = nz;
    else if (m.onGround && wantsMove && !mobBlocked(m.pos.x, m.pos.y + 1.05, nz, half, info.height)) m.velY = 7.5;

    // Gravity, ground, ceiling
    m.velY = Math.max(-40, m.velY + GRAVITY * dt);
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
    if (legs.length === 4) {
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
      if (b !== BLOCK_AIR) playBlockSound(b, null, 'step');
    }
  }

  // =================================================================
  //  Camera views (F5): first person, behind you, in front of you
  // =================================================================
  let perspective = 0;
  const viewCamera = new THREE.PerspectiveCamera(initialFov, window.innerWidth / window.innerHeight, 0.1, 1000);
  const playerModel = buildMobModel('player');
  playerModel.root.visible = false;
  scene.add(playerModel.root);
  let playerWalkPhase = 0;
  const lastModelPos = new THREE.Vector3();

  function updateViewCamera(dt: number): THREE.PerspectiveCamera {
    fistMesh.visible = perspective === 0 && mode !== 'spectator';
    const third = perspective !== 0;
    playerModel.root.visible = third && mode !== 'spectator';
    if (!third) return camera;

    const feet = playerFeet();
    const moved = Math.hypot(feet.x - lastModelPos.x, feet.z - lastModelPos.z);
    lastModelPos.copy(feet);
    playerWalkPhase += Math.min(moved, 1) * 4;
    const swing = Math.sin(playerWalkPhase) * Math.min(1, moved / (dt * 3 + 1e-6)) * 0.7;
    playerModel.root.position.copy(feet);
    playerModel.root.rotation.y = yaw;
    playerModel.head.rotation.x = pitch;
    playerModel.legs[0].rotation.x = swing;
    playerModel.legs[1].rotation.x = -swing;
    playerModel.arms[0].rotation.x = -swing;
    playerModel.arms[1].rotation.x = swing + (punchPhase > 0 ? Math.sin((punchPhase / PUNCH_DURATION) * Math.PI) * 1.2 : 0);

    // Pull the camera in if a wall is in the way
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const sign = perspective === 1 ? -1 : 1;
    let d = 4;
    for (let t = 0.3; t <= 4; t += 0.1) {
      const p = camera.position.clone().addScaledVector(dir, sign * t);
      if (world.getWorldBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== BLOCK_AIR) { d = Math.max(0.3, t - 0.3); break; }
    }
    viewCamera.position.copy(camera.position).addScaledVector(dir, sign * d);
    viewCamera.lookAt(camera.position);
    return viewCamera;
  }

  function closeInventory() {
    if (!inventoryOpen) return;
    inventoryOpen = false;
    atCraftingTable = false;
    inventoryOpenCallback?.(false, false);
    safeLock();
  }

  /** Quick Craft: craft a recipe straight from inventory counts, no grid. */
  function quickCraft(recipeId: string, hasTable: boolean): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return false;
    if (r.needsTable && !hasTable) return false;
    const need: Record<number, number> = {};
    for (const p of r.pattern) if (p !== null) need[p] = (need[p] || 0) + 1;
    for (const k of Object.keys(need)) {
      if ((inventory[Number(k)] || 0) < need[Number(k)]) return false;
    }
    for (const k of Object.keys(need)) {
      const id = Number(k);
      inventory[id] -= need[id];
      if (inventory[id] <= 0) delete inventory[id];
    }
    addItem(r.output.id, r.output.count);
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

    // Reflective surfaces — subtle env-map sheen, High & Max only
    const reflectivityByTier: Record<GraphicsQuality, number> = { low: 0, medium: 0, high: 0.12, max: 0.22 };
    const refl = reflectivityByTier[q];
    for (const m of materials) {
      if ('reflectivity' in m) {
        (m as THREE.MeshLambertMaterial).reflectivity = refl;
        m.needsUpdate = true;
      }
    }

    // Motion blur — Max only
    motionBlurEnabled = q === 'max';
  }

  // Simple voxel-stepping raycast (marches along the look direction and
  // samples world blocks directly — no need to raycast against the merged
  // chunk meshes, so it works regardless of how chunk geometry is batched).
  function raycastBlock(): { x: number; y: number; z: number; placeX: number; placeY: number; placeZ: number } | null {
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
      if (world.getWorldBlock(bx, by, bz) !== BLOCK_AIR) {
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

  function updateChunks() {
    const px = camera.position.x;
    const pz = camera.position.z;
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);

    if (pcx === currentChunkX && pcz === currentChunkZ) return;
    currentChunkX = pcx;
    currentChunkZ = pcz;

    const rd = renderDistance;

    // Load chunks within render distance
    const toLoad: Array<[number, number]> = [];
    for (let dx = -rd; dx <= rd; dx++) {
      for (let dz = -rd; dz <= rd; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > rd + 0.5) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!loadedChunks.has(world.key(cx, cz))) {
          toLoad.push([cx, cz]);
        }
      }
    }

    // Sort by distance to player for priority loading
    toLoad.sort((a, b) => {
      const da = (a[0] - pcx) ** 2 + (a[1] - pcz) ** 2;
      const db = (b[0] - pcx) ** 2 + (b[1] - pcz) ** 2;
      return da - db;
    });

    // Load up to N chunks per frame to avoid stutter
    const MAX_LOADS_PER_FRAME = 4;
    for (let i = 0; i < Math.min(toLoad.length, MAX_LOADS_PER_FRAME); i++) {
      loadChunk(toLoad[i][0], toLoad[i][1]);
    }

    // Unload chunks outside render distance
    const unloadMargin = 2;
    const toUnload: Array<[number, number]> = [];
    for (const k of loadedChunks) {
      const [cx, cz] = k.split(',').map(Number);
      const dist = Math.sqrt((cx - pcx) ** 2 + (cz - pcz) ** 2);
      if (dist > rd + unloadMargin) {
        toUnload.push([cx, cz]);
      }
    }
    for (const [cx, cz] of toUnload) {
      unloadChunk(cx, cz);
    }
  }

  // --- Initial spawn ---
  // Force an immediate synchronous generation pass of the 9 closest chunks
  // (coordinates -1 to +1 on X and Z) before the game loop begins, so the
  // floor is fully visible right away and the player has terrain to stand on.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      loadChunk(dx, dz);
    }
  }

  // Apply the initial graphics-quality tier now that chunk meshes exist
  applyGraphicsQuality(graphicsQuality);

  // Place the player on the highest surface block at the center of chunk (0,0)
  const spawnX = 8;
  const spawnZ = 8;
  const spawnSurface = world.getSurfaceHeight(spawnX, spawnZ);
  camera.position.set(spawnX + 0.5, spawnSurface + 1 + PLAYER_EYE + 0.5, spawnZ + 0.5);

  // Reset so updateChunks fires on the first frame and loads the remaining
  // chunks within render distance (the 9 initial chunks are already loaded)
  currentChunkX = Infinity;
  currentChunkZ = Infinity;

  // --- Input handlers ---

  function onKeyDown(e: KeyboardEvent) {
    if (chatOpen) return; // typing in chat or reading /help: ignore game keys
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
    if (e.code === 'KeyQ' && mode !== 'spectator' && !inventoryOpen && heldItem !== null && (inventory[heldItem] || 0) > 0) {
      const id = heldItem;
      removeItem(id, 1);
      dropFromPlayer(id, 1);
    }
    if (e.code === 'KeyE' && mode !== 'spectator') {
      inventoryOpen = !inventoryOpen;
      if (!inventoryOpen) atCraftingTable = false;
      inventoryOpenCallback?.(inventoryOpen, atCraftingTable);
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
    if (chatOpen) return;
    if (!isLocked) {
      safeLock();
      return;
    }
    if (e.button === 0) {
      punchPhase = PUNCH_DURATION; // swing animation
      if (mode !== 'spectator' && attackMobInSight()) return; // hitting a mob doesn't mine
      isMining = true;
    } else if (e.button === 2) {
      e.preventDefault();
      placeBlock();
    }
  }

  // Right-click placement. Places the currently held block into the empty
  // cell adjacent to whatever face the player is looking at, refusing to
  // place inside the player's own body (which would trap them) and
  // consuming one item from the inventory (except in creative).
  function placeBlock() {
    if (mode === 'spectator') return; // spectators can't touch the world
    const hit = raycastBlock();
    const lookingAtTable = !!hit && world.getWorldBlock(hit.x, hit.y, hit.z) === BLOCK_CRAFTING_TABLE;
    if (!lookingAtTable && tryEat()) return;
    if (!hit) return;

    // Right-clicking an existing crafting table opens its 3x3 grid
    // instead of placing whatever you're holding.
    if (world.getWorldBlock(hit.x, hit.y, hit.z) === BLOCK_CRAFTING_TABLE) {
      inventoryOpen = true;
      atCraftingTable = true;
      inventoryOpenCallback?.(true, true);
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }

    if (mode === 'adventure') return; // adventure mode can't build
    if (heldItem === null) return;
    // Crafted-only items (planks/sticks/tools) aren't placeable blocks
    if (heldItem >= 100) return; // ids 100+ are items, not placeable blocks
    if (mode !== 'creative' && (inventory[heldItem] || 0) <= 0) return;

    const { placeX, placeY, placeZ } = hit;
    if (world.getWorldBlock(placeX, placeY, placeZ) !== BLOCK_AIR) return;

    // Don't place inside the player's own occupied cells
    const px = Math.floor(camera.position.x);
    const pz = Math.floor(camera.position.z);
    const feetY = Math.floor(camera.position.y - PLAYER_EYE);
    const headY = Math.floor(camera.position.y - PLAYER_EYE + PLAYER_HEIGHT);
    if (placeX === px && placeZ === pz && (placeY === feetY || placeY === headY)) return;

    world.setWorldBlock(placeX, placeY, placeZ, heldItem);
    rebuildAround(placeX, placeZ);
    playBlockSound(heldItem, new THREE.Vector3(placeX + 0.5, placeY + 0.5, placeZ + 0.5), 'place');
    if (mode !== 'creative') {
      inventory[heldItem] -= 1;
      if (inventory[heldItem] <= 0) delete inventory[heldItem];
      inventoryCallback?.({ ...inventory });
    }
    punchPhase = PUNCH_DURATION;
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault(); // right-click places blocks, never opens a browser menu
  }

  function onMouseUp(e: MouseEvent) {
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
    const walkSpeed = keys['ShiftLeft'] || keys['ShiftRight'] ? SPRINT_SPEED : WALK_SPEED;
    // While flying, Shift means "descend", so flight gets its own steady speed
    const speed = isFlying ? WALK_SPEED * (noclip ? 2.6 : 2.2) : walkSpeed;
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
    function isSolidAtFeetOrHead(x: number, z: number): boolean {
      const feetY = Math.floor(camera.position.y - PLAYER_EYE);
      const headY = Math.floor(camera.position.y - PLAYER_EYE + PLAYER_HEIGHT - 0.1);
      const bx = Math.floor(x), bz = Math.floor(z);
      return world.getWorldBlock(bx, feetY, bz) !== BLOCK_AIR || world.getWorldBlock(bx, headY, bz) !== BLOCK_AIR;
    }
    function canMoveTo(x: number, z: number): boolean {
      const r = PLAYER_RADIUS;
      return (
        !isSolidAtFeetOrHead(x - r, z - r) &&
        !isSolidAtFeetOrHead(x + r, z - r) &&
        !isSolidAtFeetOrHead(x - r, z + r) &&
        !isSolidAtFeetOrHead(x + r, z + r)
      );
    }
    // Would the player's whole body overlap a block if their eyes were at eyeY?
    function bodyBlockedAt(x: number, eyeY: number, z: number): boolean {
      const r = PLAYER_RADIUS;
      const feet = Math.floor(eyeY - PLAYER_EYE);
      const head = Math.floor(eyeY - PLAYER_EYE + PLAYER_HEIGHT - 0.1);
      const corners: Array<[number, number]> = [[-r, -r], [r, -r], [-r, r], [r, r]];
      for (const [ox, oz] of corners) {
        const bx = Math.floor(x + ox), bz = Math.floor(z + oz);
        for (let y = feet; y <= head; y++) {
          if (world.getWorldBlock(bx, y, bz) !== BLOCK_AIR) return true;
        }
      }
      return false;
    }

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
    velocityY += GRAVITY * delta;
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
        if (mode === 'survival' || mode === 'adventure') setStats(health - Math.floor(fallDistance - 3.5), hunger);
      }
    }
    wasGrounded = isGrounded;

    if (isGrounded) {
      camera.position.y = landRow + 1 + PLAYER_EYE;
      velocityY = 0;
      if (keys['Space']) velocityY = JUMP_FORCE;
    } else {
      camera.position.y = nextY;
    }
    }

    // --- Hunger & health (survival/adventure only; creative & spectator are immortal) ---
    if (mode === 'survival' || mode === 'adventure') {
    hungerTimer += delta;
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
        setStats(health - 1, hunger);
      }
    } else {
      starveTimer = 0;
    }
    }
    if (health <= 0) {
      // Simple respawn: back to spawn with health/hunger restored
      const rsHeight = world.getSurfaceHeight(spawnX, spawnZ);
      camera.position.set(spawnX + 0.5, rsHeight + 1 + PLAYER_EYE + 0.5, spawnZ + 0.5);
      velocityY = 0;
      setStats(20, 10);
    }

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

    updateDroppedItems(delta);
    updateMobs(delta);
    updateArrows(delta);
    updateParticles(delta);
    updateFootsteps();

    // --- Block breaking (mining) ---
    if (isLocked && isMining && (mode === 'survival' || mode === 'creative')) {
      const hit = raycastBlock();
      if (hit) {
        if (!miningTarget || hit.x !== miningTarget.x || hit.y !== miningTarget.y || hit.z !== miningTarget.z) {
          miningTarget = hit;
          miningProgress = 0;
        }

        const blockType = world.getWorldBlock(hit.x, hit.y, hit.z);
        const unbreakable = blockType === BLOCK_BEDROCK && mode !== 'creative';
        // Creative mode breaks instantly, like real Minecraft
        const breakTime = mode === 'creative' ? 0 : (BLOCK_HARDNESS[blockType] ?? BREAK_TIME) / toolSpeed(blockType);
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
          world.setWorldBlock(bx, by, bz, BLOCK_AIR);
          rebuildAround(bx, bz);
          playBlockSound(brokenType, new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5), 'break');
          spawnBlockParticles(brokenType, bx, by, bz);
          const dropId = mode === 'creative' ? null : dropFor(brokenType);
          if (dropId !== null) {
            spawnDroppedItem(
              dropId, 1,
              new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5),
              new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2),
              0.3,
            );
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
    if (dirLight.castShadow) {
      dirLight.position.set(camera.position.x + 40, camera.position.y + 80, camera.position.z + 30);
      dirLight.target.position.set(camera.position.x, camera.position.y, camera.position.z);
      dirLight.target.updateMatrixWorld();
    }

    // Sky follows the player; clouds stay world-locked while drifting slowly
    sky.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 400);
    sun.lookAt(camera.position);
    cloudDrift += delta * 0.6;
    clouds.position.set(camera.position.x, CHUNK_HEIGHT + 14, camera.position.z);
    cloudTex.offset.set((camera.position.x + cloudDrift) / 150, -camera.position.z / 150);

    const renderCam = updateViewCamera(delta);

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
    if (heldMesh) { fistMesh.remove(heldMesh); disposeObject(heldMesh); heldMesh = null; }

    // Dispose mobs, arrows, particles, the player model, and audio
    for (let i = mobs.length - 1; i >= 0; i--) removeMob(i);
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
    envMap.dispose();
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

    if (exitCallback) exitCallback();
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
    for (const k of Object.keys(inventory)) delete inventory[Number(k)];
    inventoryCallback?.({ ...inventory });
  }

  function kill() {
    setStats(0, hunger); // the respawn check in the game loop takes it from here
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
      biome: world.getBiome(bx, bz), mode, flying: isFlying,
      loadedChunks: loadedChunks.size, renderDistance, graphics: graphicsQuality, fps,
      target,
      mobs: mobs.length,
      camera: ['first person', 'third person (back)', 'third person (front)'][perspective],
    };
  }

  function getFps() {
    return fps;
  }

  function getFov() {
    return camera.fov;
  }

  function getInventory() {
    return { ...inventory };
  }

  function getHealth() {
    return health;
  }

  function getHunger() {
    return hunger;
  }

  function onInventoryChange(cb: (inv: Record<number, number>) => void) {
    inventoryCallback = cb;
  }

  function onStatsChange(cb: (health: number, hunger: number) => void) {
    statsCallback = cb;
  }

  function onInventoryToggle(cb: (open: boolean, atTable: boolean) => void) {
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
    setHeldItem,
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
  };
}
