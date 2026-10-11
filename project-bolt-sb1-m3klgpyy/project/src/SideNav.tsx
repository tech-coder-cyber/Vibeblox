// A column of section buttons on the left; the section itself goes on the right.
// Used by Settings, Manage Server and the Admin panel.

export default function SideNav<T extends string>({ tabs, active, onSelect, testid }: { tabs: Array<{ id: T; label: string }>; active: T; onSelect: (id: T) => void; testid?: string }) {
  return (
    <div role="tablist" aria-orientation="vertical" className="w-36 shrink-0 flex flex-col gap-1 sticky top-0 self-start" data-testid={testid ?? 'sidenav'}>
      {tabs.map((tb) => (
        <button key={tb.id} onClick={() => onSelect(tb.id)} data-testid={`side-${tb.id}`}
          className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${active === tb.id ? 'bg-[#00e676] text-[#0a0e14] font-bold' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white hover:border-[#364860]'}`}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}
