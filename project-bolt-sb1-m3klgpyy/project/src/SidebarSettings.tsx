// Settings > Sidebar: choose which buttons the left sidebar shows, in what order, and how big it is.
import { SIDEBAR_DEFAULT, SIDEBAR_LOCKED, arrangeSidebar, saveSidebar, useSidebarPrefs, type SidebarSize } from './sidebarPrefs';

const NAMES: Record<string, string> = { home: 'Home', servers: 'Servers', settings: 'Settings', social: 'Social', games: 'Games', leaderboard: 'Top', planets: 'Planets', shop: 'Shop' };

export default function SidebarSettings({ views }: { views: string[] }) {
  const p = useSidebarPrefs();
  const items = arrangeSidebar(views.map((v) => ({ view: v })), { ...p, hidden: [] }).map((x) => x.view);
  const set = (patch: Partial<typeof p>) => saveSidebar({ ...p, ...patch });
  const move = (v: string, d: -1 | 1) => {
    const o = items.slice(); const i = o.indexOf(v); const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    set({ order: o });
  };
  const toggle = (v: string) => set({ hidden: p.hidden.includes(v) ? p.hidden.filter((x) => x !== v) : [...p.hidden, v] });
  const sw = (on: boolean, onClick: () => void, label: string, testid: string) => (
    <label className="flex items-center justify-between gap-3 text-sm text-white py-1.5 cursor-pointer">
      <span>{label}</span>
      <button role="switch" aria-checked={on} data-testid={testid} onClick={onClick} className="relative w-10 h-6 rounded-full border border-[#243044]" style={{ background: on ? '#00e676' : '#0a0e14' }}>
        <span className="absolute top-0.5 rounded-full transition-all" style={{ width: 18, height: 18, left: on ? 19 : 2, background: on ? '#06210f' : '#5a6b80' }} />
      </button>
    </label>
  );
  return (
    <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6" data-testid="sidebar-settings">
      <h2 className="text-white text-sm font-medium mb-1">Sidebar</h2>
      <p className="text-[#5a6b80] text-xs mb-4">Choose which buttons show in the sidebar, and in what order. Home and Settings always stay.</p>
      <div className="space-y-1 mb-4">
        {items.map((v, i) => {
          const locked = SIDEBAR_LOCKED.includes(v), hidden = p.hidden.includes(v);
          return (
            <div key={v} className="flex items-center gap-2 rounded-lg bg-[#0a0e14] border border-[#243044] px-3 py-2" data-testid={`sb-row-${v}`}>
              <span className="flex-1 text-sm" style={{ color: hidden ? '#5a6b80' : '#fff' }}>{NAMES[v] ?? v}</span>
              <button className="px-2 text-[#8ea0b8] disabled:opacity-30" disabled={i === 0} onClick={() => move(v, -1)} aria-label={`Move ${NAMES[v] ?? v} up`} data-testid={`sb-up-${v}`}>▲</button>
              <button className="px-2 text-[#8ea0b8] disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(v, 1)} aria-label={`Move ${NAMES[v] ?? v} down`} data-testid={`sb-down-${v}`}>▼</button>
              <button className="text-xs px-2 py-1 rounded-md border border-[#243044] disabled:opacity-30" disabled={locked} onClick={() => toggle(v)} data-testid={`sb-toggle-${v}`} style={{ color: hidden ? '#8ea0b8' : '#00e676' }}>{hidden ? 'Hidden' : 'Shown'}</button>
            </div>
          );
        })}
      </div>
      {sw(p.news, () => set({ news: !p.news }), 'Show the News button', 'sb-news')}
      {sw(p.discord, () => set({ discord: !p.discord }), 'Show the Discord button', 'sb-discord')}
      {sw(p.labels, () => set({ labels: !p.labels }), 'Show names under the icons', 'sb-labels')}
      {sw(p.version, () => set({ version: !p.version }), 'Show the game version', 'sb-version')}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-white mr-2">Button size</span>
        {(['small', 'normal', 'large'] as SidebarSize[]).map((s) => (
          <button key={s} onClick={() => set({ size: s })} aria-pressed={p.size === s} data-testid={`sb-size-${s}`} className="px-3 py-1.5 rounded-lg border text-xs capitalize"
            style={{ borderColor: p.size === s ? '#00e676' : '#243044', color: p.size === s ? '#00e676' : '#8ea0b8', background: '#0a0e14' }}>{s}</button>
        ))}
        <button className="ml-auto px-3 py-1.5 rounded-lg border border-[#243044] text-xs text-[#8ea0b8]" onClick={() => saveSidebar(SIDEBAR_DEFAULT)} data-testid="sb-reset">Reset sidebar</button>
      </div>
    </section>
  );
}
