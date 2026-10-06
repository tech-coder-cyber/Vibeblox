// The Mod Builder: draw pixel art (16x16, 32x32 or 64x64) or upload a picture (up to 64x64),
// turn it into items, blocks and plants with a few settings and a crafting recipe, and save it
// as a mod. Everything it makes is plain mod code you can still edit by hand.
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as RPointerEvent } from 'react';
import {
  type BuilderProject, type BuilderThing, type ThingKind, MAX_TEXTURE, MAX_COLORS, BUILDER_MARK,
  newThing, parseModCode, buildModCode, validateProject, resample, padToSquare, slug,
} from './modBuilderLogic';

type SavedMod = { id: string; name: string; author: string; description: string; official: false; code: string };
type Tool = 'pencil' | 'eraser' | 'fill' | 'pick';

const SWATCHES = [
  '#000000', '#3a3a3a', '#7a7a7a', '#b8b8b8', '#ffffff', '#5e3a17', '#8a5a2b', '#c8893a',
  '#e8c45a', '#f2c230', '#ff8a1a', '#d8322a', '#ff6b9a', '#a02a8a', '#6a3ac8', '#3a6ad8',
  '#4fb8e6', '#2ad4c8', '#2ad46a', '#4f9a2e', '#1f5a22', '#8a1e12', '#d9a08a', '#f4e4d4',
];
const TIERS = ['Any (even bare hands)', 'Wooden pickaxe', 'Stone pickaxe', 'Iron pickaxe', 'Diamond pickaxe', 'Emerald pickaxe'];
const CANVAS_PX = 448;

const rgbHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function uniqueColors(rgba: ArrayLike<number>): number {
  const s = new Set<number>();
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] >= 128) s.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
  return s.size;
}

function Picture({ rgba, size, px, tiles = 1 }: { rgba: number[]; size: number; px: number; tiles?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = size * tiles; c.height = size * tiles;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    img.data.set(rgba.length === size * size * 4 ? rgba : new Array(size * size * 4).fill(0));
    const tmp = document.createElement('canvas');
    tmp.width = size; tmp.height = size;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    for (let ty = 0; ty < tiles; ty++) for (let tx = 0; tx < tiles; tx++) ctx.drawImage(tmp, tx * size, ty * size);
  }, [rgba, size, tiles]);
  return <canvas ref={ref} style={{ width: px, height: px, imageRendering: 'pixelated' }} className="bg-[repeating-conic-gradient(#2a3444_0%_25%,#232c3a_0%_50%)] bg-[length:12px_12px] rounded" />;
}

const field = 'bg-[#0a0e14] border border-[#243044] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#00e676]';
const label = 'text-[#8ea0b8] text-[10px] uppercase tracking-wide mb-1 block';

export function ModBuilder({ author, itemNames, initial, onSave, onClose }: {
  author: string;
  itemNames: string[];
  initial: { id: string; name: string; description: string; code: string } | null;
  onSave: (m: SavedMod) => void;
  onClose: () => void;
}) {
  const [project, setProject] = useState<BuilderProject>(() => {
    const parsed = initial ? parseModCode(initial.code, initial.name) : null;
    if (parsed && parsed.things.length) return parsed;
    return { name: initial?.name ?? 'My Mod', description: initial?.description ?? '', things: [newThing('item', 1)] };
  });
  const [sel, setSel] = useState(0);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#d8322a');
  const [recent, setRecent] = useState<string[]>([]);
  const [mirror, setMirror] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [tooBig, setTooBig] = useState<{ w: number; h: number; img: HTMLImageElement } | null>(null);
  const [tick, setTick] = useState(0);

  const idx = Math.min(sel, project.things.length - 1);
  const thing = project.things[idx];
  const pix = useRef(new Uint8ClampedArray(thing.rgba));
  const undo = useRef<Array<{ size: number; rgba: number[] }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const cell = Math.max(4, Math.floor(CANVAS_PX / thing.size));
  const px = cell * thing.size;

  const patch = (p: Partial<BuilderThing>) => setProject((pr) => ({ ...pr, things: pr.things.map((t, i) => (i === idx ? { ...t, ...p } : t)) }));
  const commit = () => { patch({ rgba: Array.from(pix.current) }); setTick((t) => t + 1); };
  const remember = () => { undo.current.push({ size: thing.size, rgba: Array.from(pix.current) }); if (undo.current.length > 40) undo.current.shift(); };

  // load the picture when you pick another thing
  useEffect(() => { pix.current = new Uint8ClampedArray(thing.rgba); undo.current = []; setTick((t) => t + 1); /* eslint-disable-next-line */ }, [idx]);

  // draw the editor
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const n = thing.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#2a3444' : '#232c3a';
        ctx.fillRect(x * cell, y * cell, cell, cell);
        const i = (y * n + x) * 4;
        if (pix.current[i + 3] > 0) { ctx.fillStyle = `rgb(${pix.current[i]},${pix.current[i + 1]},${pix.current[i + 2]})`; ctx.fillRect(x * cell, y * cell, cell, cell); }
      }
    }
    if (cell >= 10) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k <= n; k++) { ctx.moveTo(k * cell + 0.5, 0); ctx.lineTo(k * cell + 0.5, px); ctx.moveTo(0, k * cell + 0.5); ctx.lineTo(px, k * cell + 0.5); }
      ctx.stroke();
    }
  }, [tick, thing.size, cell, px, idx]);

  function setPixel(x: number, y: number, rgb: [number, number, number] | null) {
    const n = thing.size;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = (y * n + x) * 4;
    if (rgb) { pix.current[i] = rgb[0]; pix.current[i + 1] = rgb[1]; pix.current[i + 2] = rgb[2]; pix.current[i + 3] = 255; }
    else { pix.current[i] = pix.current[i + 1] = pix.current[i + 2] = pix.current[i + 3] = 0; }
  }
  function floodFill(x: number, y: number) {
    const n = thing.size, d = pix.current;
    const at = (a: number, b: number) => (b * n + a) * 4;
    const t = [d[at(x, y)], d[at(x, y) + 1], d[at(x, y) + 2], d[at(x, y) + 3]];
    const rep: number[] = tool === 'eraser' ? [0, 0, 0, 0] : [...hexRgb(color), 255];
    if (t.every((v, k) => v === rep[k])) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const i = at(a, b);
      if (d[i] !== t[0] || d[i + 1] !== t[1] || d[i + 2] !== t[2] || d[i + 3] !== t[3]) continue;
      for (let k = 0; k < 4; k++) d[i + k] = rep[k];
      stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  }
  function apply(e: RPointerEvent<HTMLCanvasElement>, first: boolean) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * thing.size), y = Math.floor(((e.clientY - r.top) / r.height) * thing.size);
    if (x < 0 || y < 0 || x >= thing.size || y >= thing.size) return;
    if (tool === 'pick') {
      const i = (y * thing.size + x) * 4;
      if (pix.current[i + 3] > 0) setColor(rgbHex(pix.current[i], pix.current[i + 1], pix.current[i + 2]));
      return;
    }
    if (tool === 'fill') { if (first) { floodFill(x, y); setTick((t) => t + 1); } return; }
    const rgb = tool === 'eraser' ? null : hexRgb(color);
    setPixel(x, y, rgb);
    if (mirror) setPixel(thing.size - 1 - x, y, rgb);
    setTick((t) => t + 1);
  }
  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    painting.current = true;
    if (tool !== 'pick') remember();
    apply(e, true);
  };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => { if (painting.current && tool !== 'fill') apply(e, false); };
  const up = () => {
    if (!painting.current) return;
    painting.current = false;
    if (tool !== 'pick') {
      commit();
      if (tool !== 'eraser') setRecent((r) => [color, ...r.filter((c) => c !== color)].slice(0, 10));
    }
  };

  function undoLast() {
    const u = undo.current.pop();
    if (!u) return;
    pix.current = new Uint8ClampedArray(u.rgba);
    patch({ size: u.size, rgba: u.rgba });
    setTick((t) => t + 1);
  }
  function transform(fn: (x: number, y: number, n: number) => [number, number]) {
    const n = thing.size, src = Array.from(pix.current), out = new Uint8ClampedArray(src.length);
    remember();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const [a, b] = fn(x, y, n); for (let k = 0; k < 4; k++) out[(b * n + a) * 4 + k] = src[(y * n + x) * 4 + k]; }
    pix.current = out;
    commit();
  }
  function setSize(n: number) {
    if (n === thing.size) return;
    remember();
    const next = resample(pix.current, thing.size, n);
    pix.current = new Uint8ClampedArray(next);
    patch({ size: n, rgba: next });
    setTick((t) => t + 1);
  }
  function clearAll() { remember(); pix.current = new Uint8ClampedArray(thing.size * thing.size * 4); commit(); }

  // ---- uploading ----
  function useImage(img: HTMLImageElement, w: number, h: number, smooth: boolean) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(img, 0, 0, w, h);
    const sq = padToSquare(ctx.getImageData(0, 0, w, h).data, w, h);
    remember();
    pix.current = new Uint8ClampedArray(sq.rgba);
    patch({ size: sq.size, rgba: sq.rgba });
    setTick((t) => t + 1);
    setTooBig(null);
    setMsg({ kind: 'ok', text: `Loaded ${w}x${h} picture${sq.size !== w || sq.size !== h ? ` (centred on a ${sq.size}x${sq.size} square)` : ''}. You can keep editing it.` });
  }
  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { setMsg({ kind: 'err', text: 'That file is not a picture. Use PNG, JPG, GIF or WEBP.' }); return; }
    if (f.size > 6 * 1024 * 1024) { setMsg({ kind: 'err', text: 'That file is over 6 MB. Pick a smaller picture.' }); return; }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX_TEXTURE || h > MAX_TEXTURE) { setTooBig({ w, h, img }); setMsg({ kind: 'err', text: `That picture is ${w}x${h}. The biggest allowed is ${MAX_TEXTURE}x${MAX_TEXTURE}.` }); return; }
      useImage(img, w, h, false);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setMsg({ kind: 'err', text: "Couldn't read that picture." }); };
    img.src = url;
  }
  function shrink() {
    if (!tooBig) return;
    const k = Math.min(MAX_TEXTURE / tooBig.w, MAX_TEXTURE / tooBig.h);
    useImage(tooBig.img, Math.max(1, Math.round(tooBig.w * k)), Math.max(1, Math.round(tooBig.h * k)), true);
  }

  // The id follows the name until you type your own id
  function renameThing(name: string) {
    const auto = /^(item|block|plant)_\d+$/.test(thing.key) || thing.key === slug(thing.name, '');
    if (!auto) { patch({ name }); return; }
    const base = slug(name, `${thing.kind}_${idx + 1}`);
    let key = base, k = 2;
    while (project.things.some((t, i) => i !== idx && t.key === key)) key = `${base}_${k++}`;
    patch({ name, key });
  }

  // ---- things ----
  function add(kind: ThingKind) {
    const n = project.things.length + 1;
    const t = newThing(kind, n);
    let key = t.key; let k = n; while (project.things.some((x) => x.key === key)) key = `${kind}_${++k}`;
    t.key = key; t.name = kind === 'item' ? `Item ${k}` : kind === 'block' ? `Block ${k}` : `Plant ${k}`;
    if (kind === 'plant') { t.solid = false; t.hardness = 0; }
    setProject((p) => ({ ...p, things: [...p.things, t] }));
    setSel(project.things.length);
  }
  function remove(i: number) {
    if (project.things.length < 2) return;
    setProject((p) => ({ ...p, things: p.things.filter((_, k) => k !== i) }));
    setSel(Math.max(0, i - 1));
  }
  function duplicate(i: number) {
    const t = project.things[i];
    let key = `${t.key}_copy`; let k = 2; while (project.things.some((x) => x.key === key)) key = `${t.key}_copy${k++}`;
    setProject((p) => ({ ...p, things: [...p.things, { ...t, key, name: `${t.name} copy`, rgba: t.rgba.slice(), recipe: null }] }));
    setSel(project.things.length);
  }

  const ns = slug(project.name, 'mymod');
  const allNames = useMemo(() => [...project.things.map((t) => `${ns}:${t.key}`), ...itemNames], [project.things, itemNames, ns]);
  const colors = useMemo(() => uniqueColors(thing.rgba), [thing.rgba]);

  function save() {
    const errs = validateProject(project);
    setErrors(errs);
    if (errs.length) { setMsg({ kind: 'err', text: `${errs.length} thing${errs.length > 1 ? 's' : ''} to fix before saving.` }); return; }
    const code = buildModCode(project);
    onSave({ id: initial?.id ?? '', name: project.name.trim(), author, description: project.description.trim() || `Made with the Mod Builder: ${project.things.map((t) => t.name).join(', ').slice(0, 80)}`, official: false, code });
    setMsg({ kind: 'ok', text: 'Saved and switched on! Find it under Mods → Community. If you are in a world, it is running now.' });
  }

  return (
    <div className="flex flex-col gap-3 vb-fade-in text-white" data-testid="mod-builder">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]"><span className={label}>Mod name</span><input value={project.name} maxLength={40} onChange={(e) => setProject({ ...project, name: e.target.value })} className={`${field} w-full`} data-testid="mod-name" /></div>
        <div className="flex-1 min-w-[200px]"><span className={label}>What does it do?</span><input value={project.description} maxLength={120} onChange={(e) => setProject({ ...project, description: e.target.value })} placeholder="Optional" className={`${field} w-full`} /></div>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#121822] border border-[#243044] text-[#8ea0b8] text-xs hover:text-white">Close</button>
        <button onClick={save} data-testid="save-mod" className="px-5 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold active:scale-95">Save mod</button>
      </div>
      {msg && <div data-testid="builder-msg" className={`rounded-lg px-3 py-2 text-xs ${msg.kind === 'ok' ? 'bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/40' : 'bg-[#ff5555]/10 text-[#ff8a8a] border border-[#ff5555]/40'}`}>
        {msg.text}
        {tooBig && <button onClick={shrink} data-testid="shrink" className="ml-3 underline text-white">Shrink it to fit</button>}
      </div>}
      {errors.length > 0 && <ul className="text-[#ff8a8a] text-xs list-disc pl-5" data-testid="builder-errors">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}

      <div className="grid grid-cols-[170px_minmax(0,1fr)_300px] gap-4">
        {/* the things in this mod */}
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-3 gap-1">
            {(['item', 'block', 'plant'] as const).map((k) => <button key={k} onClick={() => add(k)} data-testid={`add-${k}`} className="px-1 py-1.5 rounded-md bg-[#121822] border border-[#243044] text-[10px] text-[#8ea0b8] hover:text-white hover:border-[#00e676]">+ {k}</button>)}
          </div>
          <div className="flex flex-col gap-1 max-h-[430px] overflow-y-auto vb-scroll">
            {project.things.map((t, i) => (
              <div key={t.key} className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer border ${i === idx ? 'bg-[#1c2634] border-[#00e676]/60' : 'border-transparent hover:bg-[#121822]'}`} onClick={() => setSel(i)} data-testid={`thing-${i}`}>
                <Picture rgba={i === idx ? thing.rgba : t.rgba} size={t.size} px={28} />
                <div className="min-w-0 flex-1"><div className="text-xs truncate">{t.name || t.key}</div><div className="text-[9px] text-[#5a6b80]">{t.kind} · {t.size}x{t.size}</div></div>
                <button title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(i); }} className="text-[#5a6b80] hover:text-white text-xs opacity-0 group-hover:opacity-100">⧉</button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); remove(i); }} className="text-[#5a6b80] hover:text-[#ff5555] text-xs opacity-0 group-hover:opacity-100">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* the picture editor */}
        <div className="flex flex-col gap-2 items-start min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['pencil', 'eraser', 'fill', 'pick'] as const).map((t) => (
              <button key={t} onClick={() => setTool(t)} data-testid={`tool-${t}`} className={`px-2.5 py-1.5 rounded-md text-[11px] ${tool === t ? 'bg-[#00e676] text-[#0a0e14] font-bold' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>
                {{ pencil: 'Pencil', eraser: 'Eraser', fill: 'Fill', pick: 'Pick colour' }[t]}
              </button>
            ))}
            <label className="flex items-center gap-1 text-[11px] text-[#8ea0b8] ml-1"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror</label>
            <button onClick={undoLast} data-testid="undo" className="px-2 py-1.5 rounded-md bg-[#121822] border border-[#243044] text-[11px] text-[#8ea0b8] hover:text-white">Undo</button>
            <button onClick={() => transform((x, y, n) => [n - 1 - x, y])} className="px-2 py-1.5 rounded-md bg-[#121822] border border-[#243044] text-[11px] text-[#8ea0b8] hover:text-white">Flip ↔</button>
            <button onClick={() => transform((x, y, n) => [x, n - 1 - y])} className="px-2 py-1.5 rounded-md bg-[#121822] border border-[#243044] text-[11px] text-[#8ea0b8] hover:text-white">Flip ↕</button>
            <button onClick={clearAll} className="px-2 py-1.5 rounded-md bg-[#121822] border border-[#243044] text-[11px] text-[#8ea0b8] hover:text-[#ff8a8a]">Clear</button>
          </div>
          <canvas
            ref={canvasRef} width={px} height={px} data-testid="pixel-canvas"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ width: px, height: px, imageRendering: 'pixelated', touchAction: 'none', cursor: tool === 'pick' ? 'crosshair' : 'cell' }}
            className="rounded-lg border border-[#243044] max-w-full"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8ea0b8]">Size</span>
              {[16, 32, 64].map((n) => <button key={n} onClick={() => setSize(n)} data-testid={`size-${n}`} className={`px-2.5 py-1 rounded-md text-[11px] ${thing.size === n ? 'bg-[#00e676] text-[#0a0e14] font-bold' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{n}x{n}</button>)}
              {![16, 32, 64].includes(thing.size) && <span className="px-2.5 py-1 rounded-md text-[11px] bg-[#00e676] text-[#0a0e14] font-bold">{thing.size}x{thing.size}</span>}
            </div>
            <label className="px-3 py-1.5 rounded-md bg-[#3a6ad8] text-white text-[11px] font-bold cursor-pointer hover:brightness-110 active:scale-95">
              Upload picture (max {MAX_TEXTURE}x{MAX_TEXTURE})
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onFile} className="hidden" data-testid="upload" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} data-testid="color" className="w-9 h-9 rounded cursor-pointer bg-transparent border border-[#243044]" />
            {SWATCHES.map((c) => <button key={c} title={c} onClick={() => { setColor(c); if (tool === 'eraser' || tool === 'pick') setTool('pencil'); }} style={{ background: c }} className={`w-5 h-5 rounded-sm border ${color === c ? 'border-white' : 'border-[#243044]'}`} />)}
          </div>
          {recent.length > 0 && <div className="flex items-center gap-1"><span className="text-[10px] text-[#5a6b80]">Recent</span>{recent.map((c) => <button key={c} onClick={() => setColor(c)} style={{ background: c }} className="w-4 h-4 rounded-sm border border-[#243044]" />)}</div>}
        </div>

        {/* settings, preview and recipe */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-start gap-3 rounded-xl bg-[#0a0e14] border border-[#243044] p-3">
            <div className="flex flex-col items-center gap-1"><Picture rgba={thing.rgba} size={thing.size} px={72} /><span className="text-[9px] text-[#5a6b80]">{thing.kind === 'item' ? 'in your hand' : 'icon'}</span></div>
            {thing.kind !== 'item' && <div className="flex flex-col items-center gap-1"><Picture rgba={thing.rgba} size={thing.size} px={72} tiles={3} /><span className="text-[9px] text-[#5a6b80]">3 x 3 tiled</span></div>}
          </div>
          <div className={`text-[10px] ${colors > MAX_COLORS ? 'text-[#ffd23a]' : 'text-[#5a6b80]'}`} data-testid="color-count">
            {colors} colour{colors === 1 ? '' : 's'}{colors > MAX_COLORS ? ` · will be reduced to ${MAX_COLORS} when saved (fine for most pictures)` : ` of ${MAX_COLORS} allowed`}
          </div>
          <div><span className={label}>Name</span><input value={thing.name} maxLength={40} onChange={(e) => renameThing(e.target.value)} className={`${field} w-full`} data-testid="thing-name" /></div>
          <div><span className={label}>ID (used in recipes and scripts)</span><div className="flex items-center gap-1"><span className="text-[10px] text-[#5a6b80]">{ns}:</span><input value={thing.key} maxLength={24} onChange={(e) => patch({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} className={`${field} flex-1 min-w-0`} /></div></div>
          {thing.kind === 'item' && (<>
            <div className="grid grid-cols-2 gap-2">
              <div><span className={label}>Stack size</span><input type="number" min={1} max={64} value={thing.maxStack} onChange={(e) => patch({ maxStack: Math.max(1, Math.min(64, Number(e.target.value) || 1)) })} className={`${field} w-full`} /></div>
              <div><span className={label}>Food (hunger)</span><input type="number" min={0} max={20} value={thing.food} onChange={(e) => patch({ food: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} className={`${field} w-full`} /></div>
            </div>
            <div><span className={label}>How it is held</span>
              <select value={thing.hold} onChange={(e) => patch({ hold: e.target.value as BuilderThing['hold'] })} className={`${field} w-full`}>
                <option value="item">Normal item / tool</option><option value="one_hand">Pistol (one hand, aimed)</option><option value="two_hands">Rifle (two hands, aimed)</option>
              </select></div>
            <div><span className={label}>Tooltip line</span><input value={thing.lore} maxLength={80} onChange={(e) => patch({ lore: e.target.value })} className={`${field} w-full`} /></div>
          </>)}
          {thing.kind !== 'item' && (<>
            <div className="grid grid-cols-2 gap-2">
              <div><span className={label}>Hardness</span><input type="number" min={0} max={30} step={0.5} value={thing.hardness} onChange={(e) => patch({ hardness: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} className={`${field} w-full`} /></div>
              {thing.kind === 'block' && <div><span className={label}>Needs</span><select value={thing.tier} onChange={(e) => patch({ tier: Number(e.target.value) })} className={`${field} w-full`}>{TIERS.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></div>}
            </div>
            {thing.kind === 'block' && <label className="flex items-center gap-2 text-[11px] text-[#8ea0b8]"><input type="checkbox" checked={thing.solid} onChange={(e) => patch({ solid: e.target.checked })} /> Solid (you can't walk through it)</label>}
            <label className="flex items-center gap-2 text-[11px] text-[#8ea0b8]"><input type="checkbox" checked={thing.dropsSelf} onChange={(e) => patch({ dropsSelf: e.target.checked })} /> Drops itself when broken</label>
          </>)}
          <div className="rounded-xl bg-[#0a0e14] border border-[#243044] p-3">
            <label className="flex items-center gap-2 text-[11px] text-white mb-2"><input type="checkbox" data-testid="has-recipe" checked={!!thing.recipe} onChange={(e) => patch({ recipe: e.target.checked ? { cells: new Array(9).fill(''), count: 1 } : null })} /> Crafting recipe</label>
            {thing.recipe && (<>
              <div className="grid grid-cols-3 gap-1">
                {thing.recipe.cells.map((c, i) => (
                  <input key={i} list="vb-builder-items" value={c} placeholder="empty" data-testid={`cell-${i}`}
                    onChange={(e) => patch({ recipe: { ...thing.recipe!, cells: thing.recipe!.cells.map((x, k) => (k === i ? e.target.value : x)) } })}
                    className={`${field} w-full text-[10px] px-1.5`} />
                ))}
              </div>
              <datalist id="vb-builder-items">{allNames.map((n) => <option key={n} value={n} />)}</datalist>
              <div className="flex items-center gap-2 mt-2"><span className="text-[10px] text-[#8ea0b8]">Makes</span><input type="number" min={1} max={64} value={thing.recipe.count} onChange={(e) => patch({ recipe: { ...thing.recipe!, count: Math.max(1, Math.min(64, Number(e.target.value) || 1)) } })} className={`${field} w-16`} /></div>
              <p className="text-[9px] text-[#5a6b80] mt-1.5">Type item names like planks, stick, iron_ingot, diamond, or one of your own. It works in a crafting table.</p>
            </>)}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#5a6b80]">{BUILDER_MARK}. Mods made here are normal mod code: open them under Mods → Community to read or change the code.</p>
    </div>
  );
}
