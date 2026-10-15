// The Admin panel: for the owner (Master) and every admin the owner picks.
//
// HOW TO ADD A SECTION: add an entry to SECTIONS below (id, label, who can see it, and what it shows). That's all:
// the sidebar, the light/dark colours and the layout come for free. Use the `ui` classes so it follows the theme.
// Everything an admin does is checked again by the database (Row Level Security), so a modified game can't fake it.
import { useEffect, useState, type ReactNode } from 'react';
import SideNav from './SideNav';
import AccountPanel from './AccountPanel';
import { ShieldCheck, Megaphone, Gavel, UserX, Ban, X, Loader2, Undo2, Crown, Sun, Moon, ShieldAlert, Tv, UserPlus } from 'lucide-react';
import {
  postAnnouncement, banEverywhere, unbanEverywhere, listBans, getLastAnnouncement, setLastAnnouncement, isOwnerName, giveRank, rankInfo, RANKS, RANK_LABELS, ANNOUNCE_MAX, USERNAME_RE,
  listAdmins, setAdmin, listCheatReports, type Account, type Ban as BanRow, type RankName, type CheatReport,
} from './social';
import { adStatus } from './adEconomy';
import { useTheme, setTheme } from './layout';

export type PanelPlayer = { id: number; name: string; mode: string };
type Props = {
  account: Account;
  /** Connected to a multiplayer world? (Kick, ban and other players' game modes only exist there.) */
  online: boolean;
  players: PanelPlayer[];
  /** null = yourself */
  onSetMode: (name: string | null, mode: string) => void;
  onKick: (name: string) => void;
  /** Removes the player from this world (the panel itself adds the global ban). */
  onBan: (name: string) => void;
  onAnnounced: (text: string) => void;
  onRefreshPlayers: () => void;
  onClose: () => void;
};

const MODES = ['survival', 'creative', 'adventure', 'spectator'] as const;
const CHEATS: Record<string, string> = { fly: 'Flying', speed: 'Speed', reach: 'Reach', killaura: 'Kill aura', autoclicker: 'Auto clicker', nuker: 'Nuker', spam: 'Chat spam' };

/** Shared class names (they follow light/dark mode through index.css). */
const ui = {
  section: 'bg-[#0d131b] border border-[#243044] rounded-2xl p-5',
  h2: 'text-white font-bold flex items-center gap-2 mb-3',
  btn: 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
  input: 'bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-[#5a6b80] focus:outline-none focus:border-[#00e676]/50',
  row: 'flex items-center gap-3 bg-[#121822] rounded-xl px-3 py-2',
  muted: 'text-[#5a6b80] text-sm',
};

type Ctx = Props & { owner: boolean; say: (ok: boolean, text: string) => void };
type Section = { id: string; label: string; ownerOnly?: boolean; render: (c: Ctx) => ReactNode };

// ---------------- The sections ----------------
const SECTIONS: Section[] = [
  { id: 'announce', label: 'Announce', render: (c) => <AnnounceSection {...c} /> },
  { id: 'players', label: 'Players', render: (c) => <PlayersSection {...c} /> },
  { id: 'bans', label: 'Bans', render: (c) => <BansSection {...c} /> },
  { id: 'anticheat', label: 'Anti-cheat', render: (c) => <AntiCheatSection {...c} /> },
  { id: 'ranks', label: 'Ranks', render: (c) => <RanksSection {...c} /> },
  { id: 'admins', label: 'Admins', ownerOnly: true, render: (c) => <AdminsSection {...c} /> },
  { id: 'ads', label: 'Ads', render: () => <AdsSection /> },
  { id: 'account', label: 'My account', render: (c) => <AccountPanel summary={{ username: c.account.username, signedIn: true, isOwner: c.owner, isAdmin: true, openAdmin: () => undefined, inPanel: true }} /> },
];

export default function AdminPanel(props: Props) {
  const { account, onClose } = props;
  const owner = isOwnerName(account.username);
  const sections = SECTIONS.filter((s) => !s.ownerOnly || owner);
  const [tab, setTab] = useState(sections[0].id);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const theme = useTheme();
  const say = (ok: boolean, text: string) => setMsg({ ok, text });
  useEffect(() => { setMsg(null); }, [tab]);
  const current = sections.find((s) => s.id === tab) ?? sections[0];
  return (
    <div className="vb-themed fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" data-testid="admin-panel">
      <div className="w-[860px] max-w-full max-h-[92vh] overflow-y-auto bg-[#121822] border border-[#243044] rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-[#121822] border-b border-[#243044]">
          <ShieldCheck className="w-6 h-6 text-[#ffd700]" />
          <div className="flex-1">
            <div className="text-white font-bold text-lg leading-tight flex items-center gap-2">
              Admin Panel
              {owner ? <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#ffd700] text-[#0a0e14]" data-testid="owner-badge">Owner</span>
                : <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#00e676] text-[#0a0e14]" data-testid="admin-badge">Admin</span>}
            </div>
            <div className="text-[#5a6b80] text-xs">Signed in as {account.username}{owner ? ' · the owner of VibeBlox' : ''}</div>
          </div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} data-testid="admin-theme" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-9 h-9 rounded-lg text-[#8ea0b8] hover:text-white hover:bg-[#1a2230] flex items-center justify-center" aria-label="Switch light or dark mode">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-lg text-[#8ea0b8] hover:text-white hover:bg-[#1a2230] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex gap-5">
          <SideNav testid="admin-sidenav" active={current.id} onSelect={setTab} tabs={sections.map((s) => ({ id: s.id, label: s.label }))} />
          <div className="flex-1 min-w-0 space-y-4">
            {msg && <div className={`rounded-lg px-4 py-2.5 text-sm border ${msg.ok ? 'bg-[#00e676]/10 border-[#00e676]/30 text-[#00e676]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`} data-testid="admin-msg">{msg.text}</div>}
            {current.render({ ...props, owner, say })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Announce ----------------
function AnnounceSection({ account, onAnnounced, say }: Ctx) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  async function announce() {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = await postAnnouncement(account, text);
    setSending(false);
    if (r.ok) {
      say(true, 'Announcement sent to every world. Players see it within a few seconds.');
      if (r.item.id > getLastAnnouncement()) setLastAnnouncement(r.item.id); // so this screen doesn't show it a second time
      onAnnounced(r.item.text);
      setText('');
    } else say(false, r.error);
  }
  return (
    <div className={ui.section}>
      <div className={ui.h2}><Megaphone className="w-5 h-5 text-[#00e676]" />Announce to ALL worlds</div>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, ANNOUNCE_MAX))} rows={3} placeholder="Type the announcement. Everyone playing, anywhere, will see it."
        className={`${ui.input} w-full py-3 resize-none`} />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-[#5a6b80]">{text.length}/{ANNOUNCE_MAX}</span>
        <button onClick={announce} disabled={!text.trim() || sending} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm disabled:opacity-50 hover:bg-[#00e676]/90 active:scale-95 transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}Announce
        </button>
      </div>
    </div>
  );
}

// ---------------- Players in the world you're in ----------------
function PlayersSection({ account, online, players, onSetMode, onKick, onBan, onRefreshPlayers, say }: Ctx) {
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!online) return;
    onRefreshPlayers();
    const t = setInterval(onRefreshPlayers, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
  async function banGlobal(name: string) {
    const r = await banEverywhere(account, name, '');
    if (!r.ok) { say(false, r.error); return; }
    onBan(name);
    say(true, `${name} is banned from every world.`);
    setConfirm(null);
  }
  return (
    <>
      <div className={ui.section}>
        <div className={ui.h2}><Gavel className="w-5 h-5 text-[#00e676]" />Your game mode</div>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => <button key={m} onClick={() => onSetMode(null, m)} className={`${ui.btn} bg-[#1a2230] text-white hover:bg-[#243044] capitalize px-4 py-2`}>{m}</button>)}
        </div>
      </div>
      <div className={ui.section}>
        <div className={ui.h2}><UserX className="w-5 h-5 text-[#00e676]" />Players in this world</div>
        {!online ? <p className={ui.muted}>You're not in a multiplayer world. Join one to kick, ban or change other players' game modes.</p> : (
          <div className="space-y-2">
            {players.map((p) => {
              const me = p.name.toLowerCase() === account.username.toLowerCase();
              return (
                <div key={p.id} className={`${ui.row} flex-wrap`}>
                  <div className="w-8 h-8 rounded-full bg-[#1a2230] text-white font-bold flex items-center justify-center">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-[100px]">
                    <div className="text-white text-sm font-semibold">{p.name}{me && <span className="text-[#5a6b80] font-normal"> (you)</span>}</div>
                    <div className="text-[11px] text-[#5a6b80] capitalize">{p.mode}</div>
                  </div>
                  <select value="" onChange={(e) => { if (e.target.value) onSetMode(me ? null : p.name, e.target.value); }} className="bg-[#0a0e14] border border-[#243044] rounded-lg text-xs text-white px-2 py-1.5 capitalize" aria-label={`Game mode for ${p.name}`}>
                    <option value="">Game mode…</option>
                    {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {!me && isOwnerName(p.name) && <span className="text-[10px] uppercase font-bold text-[#ffd700]">Owner</span>}
                  {!me && !isOwnerName(p.name) && (confirm === p.name ? (
                    <>
                      <span className="text-xs text-[#8ea0b8]">Ban everywhere?</span>
                      <button onClick={() => banGlobal(p.name)} className={`${ui.btn} bg-[#ff5252] text-white`}>Yes, ban</button>
                      <button onClick={() => setConfirm(null)} className={`${ui.btn} border border-[#243044] text-[#8ea0b8]`}>No</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onKick(p.name)} className={`${ui.btn} bg-[#ff9800]/15 text-[#ff9800] hover:bg-[#ff9800]/30`}>Kick</button>
                      <button onClick={() => setConfirm(p.name)} className={`${ui.btn} bg-[#ff5252]/15 text-[#ff5252] hover:bg-[#ff5252]/30`}>Ban</button>
                    </>
                  ))}
                </div>
              );
            })}
            {!players.length && <p className={ui.muted}>Loading players…</p>}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------- Global bans ----------------
function BansSection({ account, online, players, onBan, say }: Ctx) {
  const [bans, setBans] = useState<BanRow[]>([]);
  const [banName, setBanName] = useState('');
  const [banReason, setBanReason] = useState('');
  async function refresh() { const r = await listBans(); if (r.ok) setBans(r.bans); }
  useEffect(() => { void refresh(); }, []);
  async function ban() {
    const r = await banEverywhere(account, banName, banReason);
    if (!r.ok) { say(false, r.error); return; }
    if (online && players.some((p) => p.name.toLowerCase() === banName.toLowerCase())) onBan(banName);
    say(true, `${banName} is banned from every world.`);
    setBanName(''); setBanReason('');
    void refresh();
  }
  async function unban(name: string) {
    const r = await unbanEverywhere(name);
    if (r.ok) { say(true, `${name} can play again.`); void refresh(); } else say(false, r.error);
  }
  return (
    <div className={ui.section}>
      <div className={ui.h2}><Ban className="w-5 h-5 text-[#00e676]" />Banned from every world</div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={banName} onChange={(e) => setBanName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" className={`${ui.input} flex-1 min-w-[140px]`} />
        <input value={banReason} onChange={(e) => setBanReason(e.target.value.slice(0, 120))} placeholder="Reason (optional)" className={`${ui.input} flex-[2] min-w-[160px]`} />
        <button onClick={ban} disabled={!USERNAME_RE.test(banName)} className="px-4 py-2.5 rounded-xl bg-[#ff5252] text-white font-bold text-sm disabled:opacity-40 hover:bg-[#ff5252]/90 active:scale-95 transition-all">Ban</button>
      </div>
      {!bans.length ? <p className={ui.muted}>Nobody is banned.</p> : (
        <div className="space-y-1.5">
          {bans.map((b) => (
            <div key={b.username} className={ui.row}>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold">{b.username}</div>
                {(b.reason || b.by) && <div className="text-[11px] text-[#5a6b80] truncate">{b.reason}{b.reason && b.by ? ' · ' : ''}{b.by && `by ${b.by}`}</div>}
              </div>
              <button onClick={() => unban(b.username)} className={`${ui.btn} inline-flex items-center gap-1 border border-[#243044] text-[#8ea0b8] hover:text-white`}><Undo2 className="w-3 h-3" />Unban</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Anti-cheat reports from every world ----------------
function AntiCheatSection({ account, say }: Ctx) {
  const [reports, setReports] = useState<CheatReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  async function refresh() {
    const r = await listCheatReports(200);
    if (r.ok) { setReports(r.reports); setError(null); } else { setReports([]); setError(r.error); }
  }
  useEffect(() => { void refresh(); const t = setInterval(refresh, 15_000); return () => clearInterval(t); }, []);
  const shown = (reports ?? []).filter((r) => filter === 'all' || r.kind === filter);
  // the most reported players first
  const counts = new Map<string, number>();
  for (const r of reports ?? []) counts.set(r.player, (counts.get(r.player) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  async function ban(name: string) {
    const r = await banEverywhere(account, name, 'Cheating (anti-cheat)');
    say(r.ok, r.ok ? `${name} is banned from every world.` : r.error);
  }
  return (
    <div className={ui.section} data-testid="admin-anticheat">
      <div className={ui.h2}><ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />Anti-cheat reports</div>
      <p className="text-[#5a6b80] text-xs mb-3">Every world players host watches for flying, speed, reach, kill aura, auto clickers, nukers and chat spam. What it catches lands here (the last two weeks). One report can be lag: look for players who show up again and again.</p>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {top.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" data-testid="ac-top">
          {top.map(([name, n]) => (
            <span key={name} className="inline-flex items-center gap-2 rounded-lg bg-[#ff5252]/10 border border-[#ff5252]/30 px-2.5 py-1 text-xs">
              <b className="text-white">{name}</b><span className="text-[#ff8a8a]">{n} reports</span>
              {!isOwnerName(name) && <button onClick={() => ban(name)} className="text-[#ff5252] font-bold hover:underline">Ban</button>}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['all', ...Object.keys(CHEATS)].map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`${ui.btn} ${filter === k ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{k === 'all' ? 'All' : CHEATS[k]}</button>
        ))}
      </div>
      {reports === null ? <p className={ui.muted}>Loading…</p> : !shown.length ? <p className={ui.muted} data-testid="ac-empty">No reports.</p> : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto vb-scroll">
          {shown.map((r) => (
            <div key={r.id} className={ui.row} data-testid="ac-report">
              <span className="text-[#ff6b6b] text-[11px] font-bold w-24 shrink-0">{CHEATS[r.kind] ?? r.kind}</span>
              <div className="flex-1 min-w-0 text-xs">
                <span className="text-white font-semibold">{r.player}</span> <span className="text-[#8ea0b8]">{r.detail}</span>
                <div className="text-[10px] text-[#5a6b80]">in {r.world || 'a world'} (host {r.host}) · {new Date(r.at).toLocaleString()}</div>
              </div>
              {!isOwnerName(r.player) && <button onClick={() => ban(r.player)} className={`${ui.btn} bg-[#ff5252]/15 text-[#ff5252] hover:bg-[#ff5252]/30`}>Ban</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Ranks (owner) ----------------
/** How long a rank lasts: hours (null = for good). */
const RANK_DURATIONS: Array<{ id: string; label: string; hours: number | null }> = [
  { id: 'perm', label: 'Permanent', hours: null },
  { id: '1h', label: '1 hour', hours: 1 },
  { id: '1d', label: '1 day', hours: 24 },
  { id: '3d', label: '3 days', hours: 72 },
  { id: '7d', label: '7 days', hours: 168 },
  { id: '30d', label: '30 days', hours: 720 },
  { id: 'custom', label: 'Custom…', hours: null },
];
function untilText(until: string | null): string {
  if (!until) return 'for good';
  const ms = Date.parse(until) - Date.now();
  if (!(ms > 0)) return 'ran out';
  const h = Math.floor(ms / 3_600_000), d = Math.floor(h / 24);
  return `for ${d >= 1 ? `${d} day${d === 1 ? '' : 's'} ${h % 24} h` : h >= 1 ? `${h} h ${Math.floor((ms % 3_600_000) / 60_000)} min` : `${Math.max(1, Math.ceil(ms / 60_000))} min`} more`;
}
function RanksSection({ owner, say }: Ctx) {
  const [rankName, setRankName] = useState('');
  const [rankPick, setRankPick] = useState<RankName>('vanguard');
  const [duration, setDuration] = useState('perm');
  const [customAmount, setCustomAmount] = useState('12');
  const [customUnit, setCustomUnit] = useState<'hours' | 'days'>('hours');
  const [rankNow, setRankNow] = useState<{ rank: string; until: string | null } | '?' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRankNow(null);
    if (!USERNAME_RE.test(rankName)) return;
    let live = true;
    const t = setTimeout(() => { void rankInfo(rankName).then((r) => { if (live) setRankNow(r === null ? '?' : r); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [rankName]);
  const temp = rankPick !== 'none';
  /** The hours for the chosen duration (null = permanent); NaN if the custom number is no good. */
  const hours: number | null = !temp ? null : duration === 'custom'
    ? (() => { const n = Math.floor(Number(customAmount)); const h = customUnit === 'days' ? n * 24 : n; return Number.isFinite(h) && h >= 1 && h <= 87600 ? h : NaN; })()
    : RANK_DURATIONS.find((d) => d.id === duration)?.hours ?? null;
  async function apply() {
    if (busy || Number.isNaN(hours)) return;
    setBusy(true);
    const r = await giveRank(rankName, rankPick, hours);
    setBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    const until = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
    say(true, rankPick === 'none' ? `${r.username} no longer has a rank.` : `${r.username} is now ${RANK_LABELS[rankPick]} ${hours === null ? 'for good' : `for ${hours >= 48 && hours % 24 === 0 ? `${hours / 24} days` : `${hours} hour${hours === 1 ? '' : 's'}`}`}. They see it the next time they sign in.`);
    setRankNow({ rank: rankPick, until });
  }
  const sel = 'bg-[#0a0e14] border border-[#243044] rounded-xl text-sm text-white px-3 py-2.5';
  return (
    <div className={ui.section} data-testid="admin-ranks">
      <div className={ui.h2}><Crown className="w-5 h-5 text-[#ffd700]" />Give a rank</div>
      {!owner && <p className="text-[#ff9800] text-xs mb-3">Only the owner can give ranks.</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={rankName} onChange={(e) => setRankName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="rank-name" className={`${ui.input} flex-1 min-w-[140px]`} />
        <select value={rankPick} onChange={(e) => setRankPick(e.target.value as RankName)} data-testid="rank-pick" aria-label="Rank" className={sel}>
          {RANKS.map((r) => <option key={r} value={r}>{RANK_LABELS[r]}</option>)}
        </select>
        {temp && (
          <select value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="rank-duration" aria-label="How long" className={sel}>
            {RANK_DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        )}
        {temp && duration === 'custom' && (
          <>
            <input value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} inputMode="numeric" data-testid="rank-custom" aria-label="How many" className={`${ui.input} w-20`} />
            <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as 'hours' | 'days')} data-testid="rank-custom-unit" aria-label="Unit" className={sel}>
              <option value="hours">hours</option><option value="days">days</option>
            </select>
          </>
        )}
        <button onClick={apply} disabled={!owner || !USERNAME_RE.test(rankName) || busy || Number.isNaN(hours)} data-testid="rank-give"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffd700] text-[#0a0e14] font-bold text-sm disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}{rankPick === 'none' ? 'Remove rank' : hours === null ? 'Give rank for good' : 'Give temporary rank'}
        </button>
      </div>
      <p className="text-[11px] text-[#5a6b80] mt-2" data-testid="rank-now">
        {rankNow === null ? 'Type a username to see their rank.' : rankNow === '?' ? 'Nobody has that name.'
          : `Current rank: ${RANK_LABELS[(RANKS as readonly string[]).includes(rankNow.rank) ? rankNow.rank as RankName : 'none']}${rankNow.rank !== 'none' ? ` (${untilText(rankNow.until)})` : ''}`}
      </p>
    </div>
  );
}

// ---------------- Admins (owner only) ----------------
function AdminsSection({ say }: Ctx) {
  const [admins, setAdmins] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await listAdmins();
    if (r.ok) { setAdmins(r.admins); setError(null); } else { setAdmins([]); setError(r.error); }
  }
  useEffect(() => { void refresh(); }, []);
  async function change(n: string, on: boolean) {
    if (busy) return;
    setBusy(true);
    const r = await setAdmin(n, on);
    setBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    say(true, on ? `${r.username} is an admin now. They can open this panel the next time they sign in.` : `${r.username} is no longer an admin.`);
    if (on) setName('');
    void refresh();
  }
  return (
    <div className={ui.section} data-testid="admin-admins">
      <div className={ui.h2}><UserPlus className="w-5 h-5 text-[#00e676]" />Admins</div>
      <p className="text-[#5a6b80] text-xs mb-3">Admins can open this panel: announce, kick and ban, change game modes and read anti-cheat reports. Only you (the owner) can give ranks and choose admins.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="admin-name" className={`${ui.input} flex-1 min-w-[140px]`} />
        <button onClick={() => change(name, true)} disabled={!USERNAME_RE.test(name) || busy} data-testid="admin-add"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm disabled:opacity-40 active:scale-95">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Make admin</button>
      </div>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {admins === null ? <p className={ui.muted}>Loading…</p> : (
        <div className="space-y-1.5" data-testid="admin-list">
          {admins.map((a) => (
            <div key={a} className={ui.row} data-testid="admin-row">
              <span className="flex-1 text-white text-sm font-semibold">{a}</span>
              {isOwnerName(a) ? <span className="text-[10px] uppercase font-bold text-[#ffd700]">Owner</span>
                : <button onClick={() => change(a, false)} disabled={busy} className={`${ui.btn} border border-[#243044] text-[#8ea0b8] hover:text-white`}>Remove</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Why ads do or don't show ----------------
function AdsSection() {
  const st = adStatus();
  const item = (label: string, value: string, good: boolean) => (
    <div className={ui.row}><span className="flex-1 text-[#8ea0b8] text-sm">{label}</span><span className={`text-sm font-bold ${good ? 'text-[#00e676]' : 'text-[#ff9a3c]'}`}>{value}</span></div>
  );
  return (
    <div className={ui.section} data-testid="admin-ads">
      <div className={ui.h2}><Tv className="w-5 h-5 text-[#00e676]" />Ads</div>
      <div className="space-y-1.5 mb-3">
        {item('Where the game runs', st.platform === 'web' ? 'Your own website (AdSense)' : st.platform === 'crazygames' ? 'CrazyGames' : 'Poki', true)}
        {item('Set up', st.configured ? 'Yes' : 'No', st.configured)}
        {st.platform === 'web' && item('AdSense script', st.script, st.script === 'loaded')}
        {st.platform === 'web' && item('Test ads', st.testMode ? 'On (no money)' : 'Off', !st.testMode)}
        {item('Last ad', st.lastResult || 'none yet', st.lastResult === 'viewed')}
        {item('Ads for you', st.blockedForYou ? 'Off (rank or owner)' : 'On', true)}
      </div>
      {st.problems.length ? (
        <ul className="list-disc pl-5 space-y-1 text-xs text-[#ffb347]" data-testid="ads-problems">{st.problems.map((p) => <li key={p}>{p}</li>)}</ul>
      ) : <p className="text-[#00e676] text-xs">Everything looks right.</p>}
      <p className="text-[#5a6b80] text-[11px] mt-3">See ADS_SETUP.md for the full steps. Ads always stay off for the owner and players with a rank.</p>
    </div>
  );
}
