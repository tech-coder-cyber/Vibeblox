// Settings > Shaders (lighting, shadows, atmosphere, shader packs) and Settings > Crosshair, plus the crosshair itself.
import { useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import {
  getShaders, updateShaders, resetShaders, applyPack, parsePack, exportPack, subscribeShaders, BUILTIN_PACKS,
  getCrosshair, updateCrosshair, resetCrosshair, subscribeCrosshair,
  type ShaderPrefs, type LightingMode, type Level, type ShadowMode, type Crosshair, type CrosshairStyle,
} from './shaderPrefs';

const card = 'bg-[#121822] rounded-2xl border border-[#243044] p-5';
const row = 'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#0a0e14] border border-[#243044]';

function Info({ text }: { text: string }) {
  return <span title={text} aria-label={text} className="inline-flex items-center justify-center w-4 h-4 ml-1.5 rounded-sm border border-[#5a6b80] text-[#8ea0b8] text-[9px] font-bold cursor-help align-middle">i</span>;
}
function Label({ name, info }: { name: string; info: string }) {
  return <span className="text-white text-sm font-medium flex items-center">{name}<Info text={info} /></span>;
}
/** ‹ VALUE › like the image: steps through a short list. */
function Stepper<T extends string>({ value, list, labels, onChange, id }: { value: T; list: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void; id: string }) {
  const i = list.indexOf(value);
  const arrow = 'w-8 h-8 rounded-md border border-[#364860] bg-[#121822] text-white flex items-center justify-center disabled:opacity-30 active:scale-95';
  return (
    <div className="flex items-center gap-2" data-testid={id}>
      <button className={arrow} disabled={i <= 0} onClick={() => onChange(list[i - 1])} aria-label="Previous" data-testid={`${id}-prev`}>‹</button>
      <span className="w-28 text-center text-white text-sm font-bold tracking-wider" data-testid={`${id}-value`}>{labels[value].toUpperCase()}</span>
      <button className={arrow} disabled={i >= list.length - 1} onClick={() => onChange(list[i + 1])} aria-label="Next" data-testid={`${id}-next`}>›</button>
    </div>
  );
}
function OnOff({ on, onChange, id }: { on: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button onClick={() => onChange(!on)} data-testid={id} aria-pressed={on}
      className={`w-[70px] h-8 rounded-md border px-1 flex items-center gap-1.5 text-[10px] font-bold ${on ? 'bg-[#1e5a2e] border-[#3ec46d] text-white justify-end' : 'bg-[#5a1a1e] border-[#c4454f] text-white justify-start'}`}>
      {on ? <>ON<span className="w-5 h-5 rounded-sm bg-white" /></> : <><span className="w-5 h-5 rounded-sm bg-white" />OFF</>}
    </button>
  );
}
function Percent({ value, onChange, id }: { value: number; onChange: (v: number) => void; id: string }) {
  return (
    <div className="flex items-center gap-3 w-[260px] max-w-[50vw]">
      <span className="w-10 text-right text-white text-sm font-bold" data-testid={`${id}-value`}>{value}%</span>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={id} className="flex-1 accent-[#00e676]" />
    </div>
  );
}

const LIGHTING_LABELS: Record<LightingMode, string> = { fast: 'Fast', fancy: 'Fancy', realistic: 'Realistic' };
const LEVEL_LABELS: Record<Level, string> = { off: 'Off', low: 'Low', high: 'High' };
const SHADOW_LABELS: Record<ShadowMode, string> = { none: 'None', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

export function ShadersPanel() {
  const s = useSyncExternalStore(subscribeShaders, getShaders, getShaders);
  const set = (patch: Partial<ShaderPrefs>) => updateShaders(patch);
  const [packText, setPackText] = useState('');
  const [packMsg, setPackMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const insert = (text: string) => {
    const r = parsePack(text);
    if ('error' in r) { setPackMsg({ ok: false, text: r.error }); return; }
    applyPack(r.pack);
    setPackMsg({ ok: true, text: `Using "${r.pack.name}"${r.pack.glsl ? ' (with its own GLSL)' : ''}.` });
    setPackText('');
  };
  return (
    <div className="flex flex-col gap-5" data-testid="shaders-panel">
      <section className={card}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-[var(--font-retro)] text-white text-xs tracking-wider">SHADERS</h2>
            <p className="text-[#8ea0b8] text-xs mt-1">Lighting, shadows and atmosphere. These are the heaviest settings on your GPU.</p>
            <p className="text-[11px] mt-1" data-testid="shaders-mode">{s.custom
              ? <span className="text-[#7cfc7c]">Your settings are on{s.pack ? `, with the "${s.pack.name}" pack` : ''}. Bloom, god rays, eye adaptation, fog and motion blur run on every graphics level.</span>
              : <span className="text-[#5a6b80]">Following your graphics quality. Change anything to use your own settings.</span>}</p>
          </div>
          <button onClick={() => { resetShaders(); setPackMsg(null); }} data-testid="shaders-reset"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1a2230] border border-[#364860] text-white text-xs font-bold hover:bg-[#243044]">Reset to default</button>
        </div>
        <div className="flex flex-col gap-2">
          <div className={row}><Label name="Lighting" info="Fast: flat daylight. Fancy: warm sunsets and cool moonlight. Realistic: deeper shade and a stronger sun." /><Stepper id="sh-lighting" value={s.lighting} list={['fast', 'fancy', 'realistic'] as const} labels={LIGHTING_LABELS} onChange={(v) => set({ lighting: v })} /></div>
          <div className={row}><Label name="Dynamic Lighting" info="A torch, glowstone or lava bucket in your hand lights up what's around you." /><OnOff id="sh-dynamic" on={s.dynamicLighting} onChange={(v) => set({ dynamicLighting: v })} /></div>
          <div className={row}><Label name="Global Illumination" info="Soft shading where blocks meet, and light that bounces off the ground." /><Stepper id="sh-gi" value={s.globalIllumination} list={['off', 'low', 'high'] as const} labels={LEVEL_LABELS} onChange={(v) => set({ globalIllumination: v })} /></div>
          <div className={row}><Label name="Volumetric Fog" info="Thick air in the distance that glows when you look towards the sun." /><OnOff id="sh-fog" on={s.volumetricFog} onChange={(v) => set({ volumetricFog: v })} /></div>
          <div className={row}><Label name="God Rays" info="Beams of sunlight through trees, clouds and hills." /><Stepper id="sh-rays" value={s.godRays} list={['off', 'low', 'high'] as const} labels={LEVEL_LABELS} onChange={(v) => set({ godRays: v })} /></div>
          <div className={row}><Label name="Bloom" info="Bright things (the sun, lava, glowstone) glow softly." /><Percent id="sh-bloom" value={s.bloom} onChange={(v) => set({ bloom: v })} /></div>
          <div className={row}><Label name="Eye Adaptation" info="Your eyes get used to the dark in caves, and to bright daylight when you come out." /><Percent id="sh-eye" value={s.eyeAdaptation} onChange={(v) => set({ eyeAdaptation: v })} /></div>
          <div className={row}><Label name="Motion Blur" info="The picture smears a little when you turn quickly." /><OnOff id="sh-blur" on={s.motionBlur} onChange={(v) => set({ motionBlur: v })} /></div>
          <div className={row}><Label name="Water Shaders" info="Waves, reflections and sparkles on water." /><OnOff id="sh-water" on={s.waterShaders} onChange={(v) => set({ waterShaders: v })} /></div>
          <div className={row}><Label name="Shadows" info="How sharp and how far shadows reach. None is fastest." /><Stepper id="sh-shadows" value={s.shadows} list={['none', 'low', 'medium', 'high', 'ultra'] as const} labels={SHADOW_LABELS} onChange={(v) => set({ shadows: v })} /></div>
          <div className={row}><Label name="Grass Wave" info="Grass, flowers and leaves sway in the wind." /><OnOff id="sh-grass" on={s.grassWave} onChange={(v) => set({ grassWave: v })} /></div>
        </div>
      </section>

      <section className={card} data-testid="shader-packs">
        <h2 className="font-[var(--font-retro)] text-white text-xs tracking-wider mb-1">SHADER PACKS</h2>
        <p className="text-[#8ea0b8] text-xs mb-3">A pack sets everything above and adds its own colour grade. Insert one someone shared (a .vbshader file or its text), or try one of these.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {BUILTIN_PACKS.map((p) => (
            <button key={p.name} onClick={() => { applyPack(p); setPackMsg({ ok: true, text: `Using "${p.name}".` }); }} data-testid={`pack-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
              className={`py-2 rounded-xl text-xs font-bold border ${s.pack?.name === p.name ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{p.name}</button>
          ))}
        </div>
        <textarea value={packText} onChange={(e) => setPackText(e.target.value)} rows={4} spellCheck={false} data-testid="pack-text"
          placeholder={'{ "name": "My pack", "settings": { "bloom": 80 }, "grade": { "saturation": 1.2 },\n  "glsl": "vec3 customGrade(vec3 c, vec2 uv, float t) { return c; }" }'}
          className="w-full rounded-xl bg-[#0a0e14] border border-[#243044] px-3 py-2 text-[#d6e2f0] text-xs font-mono placeholder:text-[#364860]" />
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={() => insert(packText)} disabled={!packText.trim()} data-testid="pack-insert" className="px-3 py-1.5 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold disabled:opacity-40">Insert shader</button>
          <button onClick={() => fileRef.current?.click()} data-testid="pack-file" className="px-3 py-1.5 rounded-lg bg-[#1a2230] border border-[#364860] text-white text-xs font-bold">Open file…</button>
          <button onClick={() => {
            const text = exportPack(s, s.pack?.name ?? 'My shaders');
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = `${(s.pack?.name ?? 'my-shaders').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.vbshader`; a.click();
          }} data-testid="pack-export" className="px-3 py-1.5 rounded-lg bg-[#1a2230] border border-[#364860] text-white text-xs font-bold">Export mine</button>
          {s.pack && <button onClick={() => updateShaders({ pack: null })} data-testid="pack-remove" className="px-3 py-1.5 rounded-lg bg-[#1a2230] border border-[#364860] text-[#ff8a8a] text-xs font-bold">Remove pack</button>}
          <input ref={fileRef} type="file" accept=".vbshader,.json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(insert); e.target.value = ''; }} />
        </div>
        {packMsg && <p className={`text-xs mt-2 ${packMsg.ok ? 'text-[#7cfc7c]' : 'text-[#ff8a8a]'}`} data-testid="pack-msg">{packMsg.text}</p>}
      </section>
    </div>
  );
}

// ---------------- Crosshair ----------------
const STYLE_LABELS: Record<CrosshairStyle, string> = { cross: 'Cross', dot: 'Dot', circle: 'Circle', crossdot: 'Cross + dot', tshape: 'T shape', none: 'None' };
const COLORS = ['#ffffff', '#00e676', '#00e5ff', '#ffd23a', '#ff4d6d', '#c084fc', '#000000'];

/** The crosshair in the middle of the screen, drawn the way Settings > Crosshair says. */
export function CrosshairView({ preview = false }: { preview?: boolean }) {
  const c = useSyncExternalStore(subscribeCrosshair, getCrosshair, getCrosshair);
  if (c.style === 'none') return preview ? <span className="text-[#5a6b80] text-xs">No crosshair</span> : null;
  const size = c.size, th = c.thickness, gap = c.gap, half = size / 2;
  const stroke = { background: c.color, opacity: c.opacity / 100, boxShadow: c.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : undefined } as const;
  const bar = (style: Record<string, string | number>) => <div className="absolute" style={{ ...stroke, ...style }} />;
  const parts: ReactElement[] = [];
  if (c.style === 'cross' || c.style === 'crossdot' || c.style === 'tshape') {
    const arm = Math.max(1, half - gap);
    parts.push(<div key="l">{bar({ left: 0, top: half - th / 2, width: arm, height: th })}</div>);
    parts.push(<div key="r">{bar({ left: half + gap, top: half - th / 2, width: arm, height: th })}</div>);
    parts.push(<div key="b">{bar({ left: half - th / 2, top: half + gap, width: th, height: arm })}</div>);
    if (c.style !== 'tshape') parts.push(<div key="t">{bar({ left: half - th / 2, top: 0, width: th, height: arm })}</div>);
  }
  if (c.style === 'dot' || c.style === 'crossdot') { const d = Math.max(2, th + 2); parts.push(<div key="d">{bar({ left: half - d / 2, top: half - d / 2, width: d, height: d, borderRadius: '50%' })}</div>); }
  if (c.style === 'circle') parts.push(<div key="c" className="absolute rounded-full" style={{ inset: 0, border: `${th}px solid ${c.color}`, opacity: c.opacity / 100, boxShadow: c.outline ? '0 0 0 1px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(0,0,0,0.85)' : undefined }} />);
  return (
    <div className={preview ? 'relative' : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none'} data-testid={preview ? 'crosshair-preview' : 'crosshair'} data-style={c.style}>
      <div className="relative" style={{ width: size, height: size }}>{parts}</div>
    </div>
  );
}

export function CrosshairPanel() {
  const c = useSyncExternalStore(subscribeCrosshair, getCrosshair, getCrosshair);
  const set = (p: Partial<Crosshair>) => updateCrosshair(p);
  const slider = (label: string, key: 'size' | 'thickness' | 'gap' | 'opacity', min: number, max: number, unit = 'px') => (
    <div className={row}>
      <span className="text-white text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3 w-[240px] max-w-[50vw]">
        <span className="w-12 text-right text-white text-sm font-bold">{c[key]}{unit}</span>
        <input type="range" min={min} max={max} value={c[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} data-testid={`ch-${key}`} className="flex-1 accent-[#00e676]" />
      </div>
    </div>
  );
  return (
    <section className={card} data-testid="crosshair-panel">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-[var(--font-retro)] text-white text-xs tracking-wider">CROSSHAIR</h2>
          <p className="text-[#8ea0b8] text-xs mt-1">The mark in the middle of the screen.</p>
        </div>
        <button onClick={resetCrosshair} data-testid="ch-reset" className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1a2230] border border-[#364860] text-white text-xs font-bold hover:bg-[#243044]">Reset to default</button>
      </div>
      <div className="flex items-center justify-center h-28 rounded-xl mb-3 border border-[#243044]" style={{ background: 'linear-gradient(180deg,#7ab8f5 0%,#a7d3ff 55%,#5c9a3c 56%,#3f7a2a 100%)' }}>
        <CrosshairView preview />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
        {(Object.keys(STYLE_LABELS) as CrosshairStyle[]).map((st) => (
          <button key={st} onClick={() => set({ style: st })} data-testid={`ch-style-${st}`}
            className={`py-2 rounded-xl text-[11px] font-bold border ${c.style === st ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{STYLE_LABELS[st]}</button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {slider('Size', 'size', 8, 64)}
        {slider('Thickness', 'thickness', 1, 8)}
        {slider('Gap', 'gap', 0, 16)}
        {slider('Opacity', 'opacity', 10, 100, '%')}
        <div className={row}>
          <span className="text-white text-sm font-medium">Color</span>
          <div className="flex items-center gap-1.5">
            {COLORS.map((col) => <button key={col} onClick={() => set({ color: col })} aria-label={col} data-testid={`ch-color-${col.slice(1)}`} className={`w-6 h-6 rounded-md border-2 ${c.color === col ? 'border-[#00e676]' : 'border-[#364860]'}`} style={{ background: col }} />)}
            <input type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} className="w-7 h-7 rounded bg-transparent" aria-label="Pick a colour" />
          </div>
        </div>
        <div className={row}><span className="text-white text-sm font-medium">Black outline</span><OnOff id="ch-outline" on={c.outline} onChange={(v) => set({ outline: v })} /></div>
      </div>
    </section>
  );
}
