// The extra video settings: clouds, stars, fast render, frame cap, bobbing and dynamic FOV.
import { useState, useSyncExternalStore } from 'react';
import { getVideo, updateVideo, subscribeVideo, CLOUD_HEIGHT_RANGE, FPS_RANGE, type CloudMode } from './videoPrefs';
import { useTheme, setTheme, THEMES, type Theme } from './layout';

const card = 'bg-[#121822] rounded-2xl border border-[#243044] p-6';

function Toggle({ label, desc, on, onClick, id }: { label: string; desc: string; on: boolean; onClick: () => void; id: string }) {
  return (
    <button onClick={onClick} data-testid={id} aria-pressed={on}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044] text-left transition-all duration-200 hover:border-[#364860]">
      <div>
        <div className="text-white text-sm font-medium">{label}</div>
        <div className="text-[#5a6b80] text-xs">{desc}</div>
      </div>
      <div className={`w-10 h-6 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${on ? 'bg-[#00e676]' : 'bg-[#243044]'}`}>
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : ''}`} />
      </div>
    </button>
  );
}

export default function VideoOptions() {
  const v = useSyncExternalStore(subscribeVideo, getVideo, getVideo);
  const [fpsText, setFpsText] = useState(v.maxFps ? String(v.maxFps) : '');
  const commitFps = () => {
    const n = parseInt(fpsText, 10);
    if (!fpsText.trim() || !Number.isFinite(n) || n <= 0) { updateVideo({ maxFps: 0 }); setFpsText(''); return; } // empty or 0 = no limit
    const c = Math.max(FPS_RANGE.min, Math.min(FPS_RANGE.max, n));
    updateVideo({ maxFps: c }); setFpsText(String(c));
  };
  const cloudModes: Array<{ id: CloudMode; label: string; desc: string }> = [
    { id: 'fancy', label: 'Fancy', desc: 'Thick, two-layer clouds' },
    { id: 'fast', label: 'Fast', desc: 'One thin layer' },
    { id: 'none', label: 'None', desc: 'No clouds' },
  ];
  const theme = useTheme();
  return (
    <>
      <section className={card} data-testid="video-theme">
        <div className="mb-3">
          <label className="text-white text-sm font-medium">Theme</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">Dark, Super Dark (black), Gray or Light menus (the game itself doesn't change). It's remembered.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEMES.map((t: Theme) => (
            <button key={t} onClick={() => setTheme(t)} data-testid={`theme-${t}`} aria-pressed={theme === t}
              className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${theme === t ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:text-white'}`}>
              {t === 'dark' ? '🌙 Dark' : t === 'superdark' ? '⚫ Super Dark' : t === 'gray' ? '🩶 Gray' : '☀️ Light'}
            </button>
          ))}
        </div>
      </section>
      <section className={card} data-testid="video-clouds">
        <div className="mb-3">
          <label className="text-white text-sm font-medium">Clouds</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">Fancy looks best, Fast is lighter, None turns them off.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {cloudModes.map((m) => (
            <button key={m.id} onClick={() => updateVideo({ clouds: m.id })} data-testid={`clouds-${m.id}`} aria-pressed={v.clouds === m.id}
              className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-center transition-all hover:scale-[1.03] active:scale-95 ${v.clouds === m.id ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:border-[#364860] hover:text-white'}`}>
              <span className="text-sm font-bold">{m.label}</span>
              <span className="text-[10px] opacity-80">{m.desc}</span>
            </button>
          ))}
        </div>
        <div className={v.clouds === 'none' ? 'opacity-40' : ''}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-medium">Cloud height</label>
            <span className="text-[#00e676] text-sm font-bold" data-testid="cloud-height-value">+{v.cloudHeight}</span>
          </div>
          <input type="range" min={CLOUD_HEIGHT_RANGE.min} max={CLOUD_HEIGHT_RANGE.max} step={1} value={v.cloudHeight} disabled={v.clouds === 'none'} data-testid="cloud-height"
            onChange={(e) => updateVideo({ cloudHeight: parseInt(e.target.value, 10) })}
            className="w-full h-2 bg-[#0a0e14] rounded-full appearance-none cursor-pointer" />
          <p className="text-[#5a6b80] text-[11px] mt-1">Blocks above the top of the world.</p>
        </div>
      </section>

      <section className={`${card} flex flex-col gap-2`} data-testid="video-more">
        <Toggle id="toggle-stars" label="Stars" desc="Show the stars in the night sky" on={v.stars} onClick={() => updateVideo({ stars: !v.stars })} />
        <Toggle id="toggle-fast" label="Fast render" desc="Lower resolution, no shadows, no waving leaves or water effects. Good for slow computers." on={v.fastRender} onClick={() => updateVideo({ fastRender: !v.fastRender })} />
        <Toggle id="toggle-bobbing" label="View bobbing" desc="Your view sways a little while you walk" on={v.viewBobbing} onClick={() => updateVideo({ viewBobbing: !v.viewBobbing })} />
        <Toggle id="toggle-dynfov" label="Dynamic FOV" desc="Your view widens a little while you sprint" on={v.dynamicFov} onClick={() => updateVideo({ dynamicFov: !v.dynamicFov })} />
        <div className="px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-white text-sm font-medium">Max framerate</div>
              <div className="text-[#5a6b80] text-xs">Type a number from {FPS_RANGE.min} to {FPS_RANGE.max}, or leave it empty for no limit. Your screen may cap it lower.</div>
            </div>
            <input value={fpsText} inputMode="numeric" placeholder="Unlimited" data-testid="max-fps"
              onChange={(e) => setFpsText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              onBlur={commitFps}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { commitFps(); (e.target as HTMLInputElement).blur(); } }}
              className="w-24 shrink-0 bg-[#05080c] border border-[#243044] rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[#00e676]" />
          </div>
        </div>
      </section>
    </>
  );
}
