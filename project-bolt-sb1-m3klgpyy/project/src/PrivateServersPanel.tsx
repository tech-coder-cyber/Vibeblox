// The Servers page extras: your saved private servers, and a download that lets you host one yourself.
import { useState } from 'react';
import { loadServers, saveServers, checkAddress, cleanPackOptions, buildServerZip, DEFAULT_PACK, MAX_PRIVATE_SERVERS, type PrivateServer, type ServerPackOptions } from './privateServers';
import { downloadFile, fileSafe } from './fileTools';

const card = 'bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6';
const input = 'bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-2 text-white text-sm placeholder-[#364860] focus:border-[#00e676] focus:outline-none transition-colors';
const btnGreen = 'px-4 py-2 rounded-xl bg-[#00e676] text-[#0a0e14] text-xs font-bold hover:brightness-110 active:scale-95 disabled:opacity-40';
const btn = 'px-3 py-2 rounded-xl bg-[#0a0e14] border border-[#243044] text-white text-xs font-medium hover:border-[#00e676] transition-colors';

export default function PrivateServers({ onJoin, connecting, available }: { onJoin: (address: string) => void; connecting: boolean; available: boolean }) {
  const [list, setList] = useState<PrivateServer[]>(() => loadServers());
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<ServerPackOptions>({ ...DEFAULT_PACK });
  const [packMsg, setPackMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (next: PrivateServer[]) => { setList(next); saveServers(next); };
  function add(n: string, a: string) {
    const bad = checkAddress(a);
    if (bad) { setError(bad); return false; }
    if (!n.trim()) { setError('Give the server a name'); return false; }
    if (list.length >= MAX_PRIVATE_SERVERS) { setError(`You can keep ${MAX_PRIVATE_SERVERS} servers`); return false; }
    if (list.some((s) => s.address.toLowerCase() === a.trim().toLowerCase())) { setError('That address is already in your list'); return false; }
    update([...list, { name: n.trim(), address: a.trim() }]);
    setError(null);
    return true;
  }
  async function download() {
    setBusy(true);
    setPackMsg(null);
    try {
      const o = cleanPackOptions(pack);
      const { SERVER_JS } = await import('./serverPack'); // big, so only loaded now
      const zip = buildServerZip(o, SERVER_JS);
      downloadFile(`${fileSafe(o.name) || 'vibeblox-server'}.zip`, zip, 'application/zip');
      setPackMsg(`Downloaded. Unpack it, start it (start.bat on Windows, start.sh on Mac / Linux), then join localhost:${o.port}. The README inside tells you how to invite friends.`);
    } catch {
      setPackMsg('Could not make the server pack. Try again.');
    } finally { setBusy(false); }
  }
  const set = <K extends keyof ServerPackOptions>(k: K, v: ServerPackOptions[K]) => setPack((p) => ({ ...p, [k]: v }));

  return (
    <>
      <section className={card} data-testid="private-servers">
        <h2 className="text-white text-sm font-medium mb-1">My private servers</h2>
        <p className="text-[#5a6b80] text-xs mb-3">Save the servers you play on, then join with one click.</p>
        {list.length === 0 && <p className="text-[#5a6b80] text-xs py-2" data-testid="ps-empty">No servers saved yet.</p>}
        <div className="flex flex-col gap-2">
          {list.map((s) => (
            <div key={s.address} className="px-3 py-2 rounded-xl bg-[#0a0e14] border border-[#243044] flex items-center gap-3" data-testid="ps-row">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{s.name}</div>
                <div className="text-[#5a6b80] text-[11px] font-mono truncate">{s.address}</div>
              </div>
              <button className={btnGreen} disabled={connecting || !available} onClick={() => onJoin(s.address)} data-testid="ps-join">{connecting ? '…' : 'Join'}</button>
              <button className="text-[11px] text-red-400/80 hover:text-red-300" onClick={() => update(list.filter((x) => x.address !== s.address))} data-testid="ps-remove">Remove</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <input className={`${input} w-40`} placeholder="Name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="ps-name" />
          <input className={`${input} flex-1 min-w-[160px]`} placeholder="Address, e.g. localhost:8080" value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && add(name, address)) { setName(''); setAddress(''); } }} data-testid="ps-address" />
          <button className={btn} onClick={() => { if (add(name, address)) { setName(''); setAddress(''); } }} data-testid="ps-add">Add</button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2" data-testid="ps-error">{error}</p>}
      </section>

      <section className={card} data-testid="host-your-own">
        <h2 className="text-white text-sm font-medium mb-1">Host your own server</h2>
        <p className="text-[#8ea0b8] text-xs leading-relaxed mb-4">
          Download a server pack, unpack it, and run it on your own computer or a rented one. Your world, your rules, and nobody else needs to be online for you to play.
          You need <b className="text-white">Node.js</b> (free, nodejs.org). Nothing else.
        </p>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="text-[11px] text-[#8ea0b8] flex flex-col gap-1">Server name
            <input className={input} value={pack.name} maxLength={40} onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="pack-name" />
          </label>
          <label className="text-[11px] text-[#8ea0b8] flex flex-col gap-1">Port
            <input className={input} type="number" min={1} max={65535} value={pack.port} onChange={(e) => set('port', Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} data-testid="pack-port" />
          </label>
          <label className="text-[11px] text-[#8ea0b8] flex flex-col gap-1">Players at most
            <input className={input} type="number" min={1} max={100} value={pack.maxPlayers} onChange={(e) => set('maxPlayers', Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} data-testid="pack-max" />
          </label>
          <label className="text-[11px] text-[#8ea0b8] flex flex-col gap-1">World seed (optional)
            <input className={input} placeholder="random" value={pack.seed} onChange={(e) => set('seed', e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="pack-seed" />
          </label>
          <label className="text-[11px] text-[#8ea0b8] flex flex-col gap-1">World
            <select className={input} value={pack.worldType} onChange={(e) => set('worldType', e.target.value as ServerPackOptions['worldType'])} data-testid="pack-type">
              <option value="default">Normal</option><option value="superflat">Superflat</option>
            </select>
          </label>
          <label className="text-[11px] text-[#8ea0b8] flex flex-col gap-1">Game mode
            <select className={input} value={pack.mode} onChange={(e) => set('mode', e.target.value as ServerPackOptions['mode'])} data-testid="pack-mode">
              <option value="survival">Survival</option><option value="creative">Creative</option><option value="adventure">Adventure</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#8ea0b8] mt-3 cursor-pointer">
          <input type="checkbox" checked={pack.experimental} onChange={(e) => set('experimental', e.target.checked)} data-testid="pack-exp" /> Turn on experimental features in the new world
        </label>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button className={btnGreen} disabled={busy} onClick={() => void download()} data-testid="pack-download">{busy ? 'Making it…' : 'Download server pack (.zip)'}</button>
          <button className={btn} onClick={() => { if (add(pack.name || 'My server', `localhost:${cleanPackOptions(pack).port}`)) setPackMsg('Added to My private servers.'); }} data-testid="pack-add-local">Add it to my servers</button>
        </div>
        {packMsg && <p className="text-[#9ff0c4] text-xs mt-3" data-testid="pack-msg">{packMsg}</p>}
        <ol className="text-[#5a6b80] text-[11px] mt-4 list-decimal pl-4 leading-relaxed">
          <li>Unpack the zip anywhere and start it: <span className="font-mono">start.bat</span> (Windows) or <span className="font-mono">sh start.sh</span> (Mac / Linux).</li>
          <li>Come back here and join <span className="font-mono">localhost:{cleanPackOptions(pack).port}</span> (pick it from My private servers).</li>
          <li>For friends, give the server a secure address with a free tunnel (Cloudflare Tunnel, playit.gg). The README explains it.</li>
        </ol>
      </section>
    </>
  );
}
