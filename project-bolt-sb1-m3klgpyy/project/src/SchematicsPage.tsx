// The schematic maker and the upload box, both in Esc > Manage Server > Schematics.
// Pick a box with the Selection Wand, copy it, save it, turn it, and paste it anywhere. Files (.vbschem) can be shared.
import { useState, type ReactNode } from 'react';
import { runSchem, clipboardInfo, undoDepth, type SchemEnv } from './schemCommands';
import { loadLibrary, saveLibrary, parseSchematicFile, schematicToFile, describe, nameKey, libraryBytes, SCHEM_LIMITS, type Schematic } from './schematics';
import { pickTextFile, downloadFile, fileSafe } from './fileTools';

type Sel = { p1: [number, number, number] | null; p2: [number, number, number] | null };
export type SchematicsPageProps = {
  makeEnv: (out: (t: string) => void, fail: (t: string) => void) => SchemEnv;
  selection: { get: () => Sel; set: (p1: Sel['p1'], p2: Sel['p2']) => void; here: () => [number, number, number]; chunk: () => void };
  onGetWand: () => void;
};

const card = 'bg-[#121822] rounded-2xl border border-[#243044] p-5';
const btn = 'px-3 py-2 rounded-lg bg-[#0a0e14] border border-[#243044] text-white text-xs font-medium transition-colors hover:border-[#00e676] disabled:opacity-40 disabled:hover:border-[#243044]';
const btnGreen = 'px-4 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold hover:brightness-110 active:scale-95 disabled:opacity-40';

function useMessages() {
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const run = async (fn: (out: (t: string) => void, fail: (t: string) => void) => Promise<void> | void) => {
    const lines: string[] = [];
    let ok = true;
    await fn((t) => lines.push(t), (t) => { ok = false; lines.push(t); });
    setMsg({ ok, lines });
  };
  return { msg, run, set: setMsg };
}

function Message({ msg }: { msg: { ok: boolean; lines: string[] } | null }) {
  if (!msg || !msg.lines.length) return null;
  return (
    <div className={`rounded-lg px-3 py-2 text-xs border ${msg.ok ? 'bg-[#00e676]/10 border-[#00e676]/30 text-[#9ff0c4]' : 'bg-red-500/10 border-red-500/30 text-red-300'}`} data-testid="schem-msg">
      {msg.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

export default function SchematicsPage({ makeEnv, selection, onGetWand }: SchematicsPageProps) {
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const { msg, run } = useMessages();
  const [name, setName] = useState('');
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const lib = loadLibrary();
  const items = (Object.values(lib) as Schematic[]).sort((a, b) => a.name.localeCompare(b.name));
  const clip = clipboardInfo();
  const sel = selection.get();
  const selSize = sel.p1 && sel.p2
    ? `${Math.abs(sel.p1[0] - sel.p2[0]) + 1} x ${Math.abs(sel.p1[1] - sel.p2[1]) + 1} x ${Math.abs(sel.p1[2] - sel.p2[2]) + 1}`
    : null;

  const act = (args: string[]) => run(async (out, fail) => {
    setBusy(true);
    try { await runSchem(args, makeEnv(out, fail)); } finally { setBusy(false); bump(); }
  });
  const fmt = (p: Sel['p1']) => (p ? p.join(', ') : 'not set');

  return (
    <div className="flex flex-col gap-4 vb-fade-in" data-testid="schematics-page">
      <p className="text-[#8ea0b8] text-xs leading-relaxed">
        Copy a build, save it, and paste it anywhere (even in another world). Pick the box with the Selection Wand: left-click a block for corner 1, right-click for corner 2.
        Doors, stairs and other blocks that face a way turn with the build. Chest contents are not saved.
      </p>

      <section className={card} data-testid="schem-selection">
        <h3 className="text-white text-sm font-medium mb-2">1. Pick a box</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => { onGetWand(); }} data-testid="schem-wand">Get the Selection Wand</button>
          <button className={btn} onClick={() => { selection.set(selection.here(), sel.p2); bump(); }} data-testid="schem-corner1">Corner 1 = where I stand</button>
          <button className={btn} onClick={() => { selection.set(sel.p1, selection.here()); bump(); }} data-testid="schem-corner2">Corner 2 = where I stand</button>
          <button className={btn} onClick={() => { selection.chunk(); bump(); }}>This chunk</button>
          <button className={btn} onClick={() => { selection.set(null, null); bump(); }}>Clear</button>
        </div>
        <p className="text-[#5a6b80] text-[11px] mt-2" data-testid="schem-sel-info">Corner 1: {fmt(sel.p1)} · Corner 2: {fmt(sel.p2)}{selSize ? ` · ${selSize} blocks` : ''}</p>
      </section>

      <section className={card}>
        <h3 className="text-white text-sm font-medium mb-2">2. Copy it</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btnGreen} disabled={busy} onClick={() => void act(['copy'])} data-testid="schem-copy">Copy selection</button>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, SCHEM_LIMITS.nameMax))} placeholder="Name to save it as" data-testid="schem-name"
            onKeyDown={(e) => e.stopPropagation()}
            className="flex-1 min-w-[140px] bg-[#05080c] border border-[#243044] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00e676]" />
          <button className={btn} disabled={busy || !name.trim()} onClick={() => void act(['save', name.trim()]).then(() => setName(''))} data-testid="schem-save">Save to my library</button>
        </div>
      </section>

      <section className={card} data-testid="schem-clipboard">
        <h3 className="text-white text-sm font-medium mb-2">3. Turn it and paste it</h3>
        <p className="text-[#8ea0b8] text-xs mb-3" data-testid="schem-clip-info">
          {clip ? `Ready: "${clip.name}", ${clip.w} x ${clip.h} x ${clip.d} blocks.` : 'Nothing is copied yet. Copy your selection, or load a schematic from the list below.'}
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {['90', '180', '270'].map((d) => <button key={d} className={btn} disabled={!clip || busy} onClick={() => void act(['rotate', d])} data-testid={`schem-rot-${d}`}>Turn {d}°</button>)}
          {(['x', 'y', 'z'] as const).map((a) => <button key={a} className={btn} disabled={!clip || busy} onClick={() => void act(['flip', a])} data-testid={`schem-flip-${a}`}>Flip {a.toUpperCase()}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={btnGreen} disabled={!clip || busy} onClick={() => void act(keep ? ['paste', '-a'] : ['paste'])} data-testid="schem-paste">Paste where I stand</button>
          <label className="flex items-center gap-1.5 text-[#8ea0b8] text-xs cursor-pointer">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} data-testid="schem-keep" /> Keep what is already there where the build has air
          </label>
          <button className={btn} disabled={busy || undoDepth() === 0} onClick={() => void act(['undo'])} data-testid="schem-undo">Undo paste ({undoDepth()})</button>
        </div>
      </section>

      <Message msg={msg} />

      <section className={card}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white text-sm font-medium">My library</h3>
          <span className="text-[#5a6b80] text-[10px]">{items.length} of {SCHEM_LIMITS.maxCount} · {(libraryBytes(lib) / 1024).toFixed(0)} KB</span>
        </div>
        <SchematicList lib={lib} onChange={bump} extra={(sc) => (
          <>
            <button className="text-[11px] text-[#00e676] hover:text-white" onClick={() => void act(['load', sc.name])} data-testid="schem-load">Load</button>
          </>
        )} />
        <div className="mt-3"><button className={btn} onClick={() => void act(['import'])} data-testid="schem-import">Import a .vbschem file…</button></div>
      </section>
    </div>
  );
}

/** The saved schematics, with download and delete. Shared by the Schematics page and Manage Server. */
function SchematicList({ lib, onChange, extra }: { lib: Record<string, Schematic>; onChange: () => void; extra?: (s: Schematic) => ReactNode }) {
  const items = (Object.values(lib) as Schematic[]).sort((a, b) => a.name.localeCompare(b.name));
  if (!items.length) return <p className="text-[#5a6b80] text-xs py-3 text-center">No schematics yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      {items.map((sc) => (
        <div key={nameKey(sc.name)} className="px-3 py-2 rounded-xl bg-[#0a0e14] border border-[#243044] flex items-center gap-3" data-testid="schem-row">
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{sc.name}</div>
            <div className="text-[#5a6b80] text-[11px]">{describe(sc)} blocks</div>
          </div>
          {extra?.(sc)}
          <button className="text-[11px] text-[#8ea0b8] hover:text-white" data-testid="schem-export" onClick={() => downloadFile(`${fileSafe(sc.name)}.vbschem`, schematicToFile(sc))}>⇩ File</button>
          <button className="text-[11px] text-red-400/80 hover:text-red-300" data-testid="schem-delete" onClick={() => { const next = { ...loadLibrary() }; delete next[nameKey(sc.name)]; saveLibrary(next); onChange(); }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

/** Manage Server: upload schematic files for this world's builders (they show up on the Schematics page). */
export function SchematicUpload() {
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const { msg, run } = useMessages();
  const lib = loadLibrary();
  async function upload() {
    await run(async (out, fail) => {
      const text = await pickTextFile('.vbschem,.json');
      if (text === null) return;
      const sc = parseSchematicFile(text);
      if (typeof sc === 'string') { fail(sc); return; }
      const err = saveLibrary({ ...loadLibrary(), [nameKey(sc.name)]: sc });
      if (err) { fail(err); return; }
      out(`Uploaded "${sc.name}" (${describe(sc)}). Paste it from the list above (Manage Server > Schematics).`);
    });
    bump();
  }
  return (
    <div className="flex flex-col gap-3" data-testid="schem-upload">
      <div className="flex items-center gap-3">
        <button className={btnGreen} onClick={() => void upload()} data-testid="schem-upload-btn">Upload a schematic file…</button>
        <span className="text-[#5a6b80] text-[11px]">.vbschem files from the Schematics page or from friends</span>
      </div>
      <Message msg={msg} />
      <SchematicList lib={lib} onChange={bump} />
    </div>
  );
}
