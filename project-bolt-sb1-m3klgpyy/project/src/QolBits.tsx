// Quality-of-life pieces: the "Now Playing" pop-up, the name of the block you are aiming at, the Settings switches
// and the F2 screenshot saver.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { playlist, getPlaylistStatus, subscribePlaylistStatus } from './playlist';
import { getNowPlaying, subscribeNowPlaying } from './music';
import { getQol, setQol, useQol, subscribeQol, type QolPrefs } from './qol';

/** "♪ Now Playing: <song>" slides in for a few seconds whenever a new song starts. */
export function NowPlayingToast() {
  const now = useSyncExternalStore(subscribeNowPlaying, getNowPlaying, getNowPlaying);
  const on = useSyncExternalStore(subscribeQol, () => getQol().nowPlaying, () => true);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!now || !on) { setShown(null); return; }
    setShown(now);
    const t = window.setTimeout(() => setShown(null), 5000);
    return () => window.clearTimeout(t);
  }, [now, on]);
  if (!shown) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[45] pointer-events-none vb-fade-in" data-testid="now-playing-toast">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d131b]/90 border border-[#243044] shadow-xl backdrop-blur-sm max-w-[88vw]">
        <span className="text-[#00e676]">♪</span>
        <span className="text-[#8ea0b8] text-xs font-bold tracking-wide">Now Playing:</span>
        <span className="text-white text-sm font-bold truncate">{shown}</span>
      </div>
    </div>
  );
}

/** The name of the block you are looking at, just under the crosshair. */
export function LookingAtLabel({ getName, paused }: { getName: () => string; paused: boolean }) {
  const on = useSyncExternalStore(subscribeQol, () => getQol().lookingAt && getQol().outline, () => true);
  const [name, setName] = useState('');
  const getRef = useRef(getName);
  getRef.current = getName;
  useEffect(() => {
    if (!on || paused) { setName(''); return; }
    const t = window.setInterval(() => { const n = getRef.current(); setName((p) => (p === n ? p : n)); }, 120);
    return () => window.clearInterval(t);
  }, [on, paused]);
  if (!on || paused || !name) return null;
  return (
    <div className="absolute left-1/2 top-[calc(50%+26px)] -translate-x-1/2 z-[19] pointer-events-none" data-testid="looking-at">
      <span className="px-2.5 py-0.5 rounded-md bg-black/45 text-white text-xs font-bold drop-shadow">{name}</span>
    </div>
  );
}

const OPTIONS: Array<[keyof QolPrefs, string, string]> = [
  ['outline', 'Block outline', 'A dark outline and a soft glow on the block you are aiming at (the cracks show while you mine it)'],
  ['lookingAt', 'Block name', 'Shows the name of the block you are aiming at under the crosshair (needs the outline)'],
  ['uiSounds', 'Menu sounds', 'A soft tick when you press a button in the menus'],
  ['nowPlaying', 'Now Playing pop-up', 'Shows the name of the song when a new one starts'],
];

/** The switches, shown in Settings > HUD. */
export function QolSettings() {
  const prefs = useQol();
  return (
    <div className="flex flex-col gap-2 mt-6" data-testid="qol-options">
      <div className="text-[#8ea0b8] text-xs font-bold tracking-wider">QUALITY OF LIFE</div>
      {OPTIONS.map(([k, label, desc]) => {
        const on = prefs[k];
        return (
          <button key={k} onClick={() => setQol({ [k]: !on } as Partial<QolPrefs>)} data-testid={`qol-${k}`} aria-pressed={on}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044] text-left transition-all duration-200 hover:border-[#364860] hover:scale-[1.01] active:scale-[0.99]">
            <div>
              <div className="text-white text-sm font-medium">{label}</div>
              <div className="text-[#5a6b80] text-xs">{desc}</div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 shrink-0 ml-3 transition-colors ${on ? 'bg-[#00e676]' : 'bg-[#243044]'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        );
      })}
      <p className="text-[#5a6b80] text-xs">Press F2 in the game, or type /screenshot, to save a screenshot.</p>
    </div>
  );
}

/** Saves a picture (a PNG data URL) as a file. */
export function saveScreenshot(url: string) {
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `vibeblox-${stamp}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Under the soundtrack buttons while a soundtrack with song files is chosen: skip to the next song, or say that the built-in music plays until the files are added. */
export function PlaylistNote({ style }: { style: string }) {
  const status = useSyncExternalStore(subscribePlaylistStatus, getPlaylistStatus, getPlaylistStatus);
  return (
    <div className="mb-4 flex items-center gap-3" data-testid="playlist-note">
      <button onClick={() => playlist.next()} disabled={status !== 'playing'} data-testid="playlist-next"
        className="px-4 py-2 rounded-xl bg-[#0a0e14] border border-[#243044] text-white text-sm font-medium transition-all hover:border-[#00e676] hover:text-[#00e676] disabled:opacity-40">Next song ⏭</button>
      <span className="text-xs text-[#5a6b80]" data-testid="playlist-status">
        {status === 'empty' ? `No song files in public/music/${style} yet, so the built-in music plays.` : status === 'loading' ? 'Loading…' : 'Playing the songs one after another, on repeat.'}
      </span>
    </div>
  );
}

const BLOCK_SOUND_OPTIONS: Array<[keyof QolPrefs, string, string]> = [
  ['blockBreak', 'Breaking sounds', 'The crunch of stone, the thunk of wood and the crumble of sand when you mine and break blocks'],
  ['blockPlace', 'Placing sounds', 'The sound a block makes when you set it down'],
  ['footsteps', 'Footsteps', 'Your steps change with the ground: stone, wood, sand, grass and snow'],
];

/** Settings > Audio: the sounds blocks make, one switch each plus their own volume (on top of Sound Effects). */
export function BlockSoundSettings() {
  const prefs = useQol();
  const all = prefs.blockBreak || prefs.blockPlace || prefs.footsteps;
  return (
    <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6" data-testid="block-sounds">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white text-sm font-medium">Block Sounds</h2>
        <button onClick={() => setQol({ blockBreak: !all, blockPlace: !all, footsteps: !all })} data-testid="block-sounds-all"
          className="px-3 py-1 rounded-lg bg-[#0a0e14] border border-[#243044] text-xs text-[#8ea0b8] hover:border-[#00e676] hover:text-[#00e676] transition-colors">{all ? 'Turn all off' : 'Turn all on'}</button>
      </div>
      <p className="text-[#5a6b80] text-xs mb-4">Different blocks sound different. Pick which of these you want to hear.</p>
      <div className="flex flex-col gap-2">
        {BLOCK_SOUND_OPTIONS.map(([k, label, desc]) => {
          const on = prefs[k] as boolean;
          return (
            <button key={k} onClick={() => setQol({ [k]: !on } as Partial<QolPrefs>)} data-testid={`qol-${k}`} aria-pressed={on}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044] text-left transition-all duration-200 hover:border-[#364860] hover:scale-[1.01] active:scale-[0.99]">
              <div>
                <div className="text-white text-sm font-medium">{label}</div>
                <div className="text-[#5a6b80] text-xs">{desc}</div>
              </div>
              <div className={`w-10 h-6 rounded-full p-0.5 shrink-0 ml-3 transition-colors ${on ? 'bg-[#00e676]' : 'bg-[#243044]'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : ''}`} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-4 mb-2">
        <span className="text-white text-sm font-medium">Block sound volume</span>
        <span className="font-[var(--font-display)] text-[#00e676] text-lg" data-testid="block-volume-value">{Math.round(prefs.blockVolume * 100)}<span className="text-[#5a6b80] text-xs ml-1">%</span></span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={prefs.blockVolume} data-testid="block-volume"
        onChange={(e) => setQol({ blockVolume: parseFloat(e.target.value) })}
        className="w-full h-2 bg-[#0a0e14] rounded-full appearance-none cursor-pointer" />
    </section>
  );
}
