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
  postAnnouncement, banEverywhere, unbanEverywhere, listBans, getLastAnnouncement, setLastAnnouncement, isOwnerName, giveRank, rankInfo, rankPending, RANKS, RANK_LABELS, ANNOUNCE_MAX, USERNAME_RE,
  listAdmins, setAdmin, listMessageReports, dismissMessageReport, type MessageReport, listCheatReports, dismissCheatReports, clearCheatReports, listStaff, setStaffRank, STAFF_RANKS, STAFF_LABELS, listSpecial, setSpecialRank, setOgRank,
  ADMIN_PERMS, ADMIN_PERM_LABELS, ADMIN_PERM_HELP, type AdminPerm, type AdminRow, type SpecialRow, type StaffRank, type StaffRow, type Account, type Ban as BanRow, type RankName, type CheatReport,
} from './social';
import { adStatus } from './adEconomy';
import { adminFairplay, adminResolveFairplay, type FairplayRow } from './minigames/api';
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
  /** Staff (HELPER / MOD) get a smaller panel: players only. Their ban covers this world, not all of VibeBlox. */
  staffOnly?: boolean;
  /** What this admin may do (the owner and full-access admins: everything). Left out = everything, like before Indev 32. */
  perms?: readonly AdminPerm[];
  /** Stops (on = true) or allows a player to chat in this world. */
  onMute?: (name: string, on: boolean) => void;
  onRefreshPlayers: () => void;
  onClose: () => void;
};

const MODES = ['survival', 'creative', 'adventure', 'spectator'] as const;
const CHEATS: Record<string, string> = { fly: 'Flying', speed: 'Speed', reach: 'Reach', killaura: 'Kill aura', autoclicker: 'Auto clicker', nuker: 'Nuker', spam: 'Chat spam', script: 'Outside script' };

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
type Section = { id: string; label: string; ownerOnly?: boolean; /** an admin needs this permission to see it (the owner always has them all) */ perm?: AdminPerm; /** staff (HELPER / MOD) can see it too */ staffOk?: boolean; render: (c: Ctx) => ReactNode };

// ---------------- The sections ----------------
const SECTIONS: Section[] = [
  { id: 'announce', label: 'Announce', perm: 'announce', render: (c) => <AnnounceSection {...c} /> },
  { id: 'players', label: 'Players', staffOk: true, render: (c) => <PlayersSection {...c} /> },
  { id: 'bans', label: 'Bans', perm: 'bans', render: (c) => <BansSection {...c} /> },
  { id: 'anticheat', label: 'Anti-cheat', perm: 'anticheat', render: (c) => <AntiCheatSection {...c} /> },
  { id: 'fairplay', label: 'Fair play', perm: 'anticheat', render: (c) => <FairplaySection {...c} /> },
  { id: 'reports', label: 'Reports', perm: 'bans', render: (c) => <MessageReportsSection {...c} /> },
  { id: 'ranks', label: 'Ranks', perm: 'ranks', render: (c) => <RanksSection {...c} /> },
  { id: 'admins', label: 'Admins', ownerOnly: true, render: (c) => <AdminsSection {...c} /> },
  { id: 'ads', label: 'Ads', render: () => <AdsSection /> },
  { id: 'account', label: 'My account', render: (c) => <AccountPanel summary={{ username: c.account.username, signedIn: true, isOwner: c.owner, isAdmin: true, openAdmin: () => undefined, inPanel: true }} /> },
];

export default function AdminPanel(props: Props) {
  const { account, onClose } = props;
  const owner = isOwnerName(account.username);
  const perms: readonly AdminPerm[] = owner || !props.perms ? ADMIN_PERMS : props.perms;
  const limited = !owner && !props.staffOnly && perms.length < ADMIN_PERMS.length;
  const sections = SECTIONS.filter((s) => props.staffOnly ? !!s.staffOk || s.id === 'account' : (!s.ownerOnly || owner) && (!s.perm || perms.includes(s.perm)));
  const [tab, setTab] = useState(sections[0].id);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const theme = useTheme();
  const say = (ok: boolean, text: string) => setMsg({ ok, text });
  useEffect(() => { setMsg(null); }, [tab]);
  const current = sections.find((s) => s.id === tab) ?? sections[0];
  return (
    <div className="vb-themed fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" data-testid="admin-panel">
      <div className="w-[860px] max-w-full max-h-[92vh] overflow-y-auto overflow-x-hidden bg-[#121822] border border-[#243044] rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-[#121822] border-b border-[#243044]">
          <ShieldCheck className="w-6 h-6 text-[#ffd700]" />
          <div className="flex-1">
            <div className="text-white font-bold text-lg leading-tight flex items-center gap-2">
              {props.staffOnly ? 'Staff Panel' : 'Admin Panel'}
              {props.staffOnly ? <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#22e6e6] text-[#0a0e14]" data-testid="staff-badge">Staff</span> : owner ? <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#ffd700] text-[#0a0e14]" data-testid="owner-badge">Owner</span>
                : <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#00e676] text-[#0a0e14]" data-testid="admin-badge">{limited ? 'Admin · limited' : 'Admin'}</span>}
            </div>
            <div className="text-[#5a6b80] text-xs">Signed in as {account.username}{owner ? ' · the owner of VibeBlox' : ''}</div>
          </div>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} data-testid="admin-theme" title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            className="w-9 h-9 rounded-lg text-[#8ea0b8] hover:text-white hover:bg-[#1a2230] flex items-center justify-center" aria-label="Switch light or dark mode">
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-lg text-[#8ea0b8] hover:text-white hover:bg-[#1a2230] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 sm:p-6 flex flex-col sm:flex-row gap-3 sm:gap-5" data-testid="admin-layout">
          <SideNav testid="admin-sidenav" active={current.id} onSelect={setTab} tabs={sections.map((s) => ({ id: s.id, label: s.label }))} />
          <div className="flex-1 min-w-0 space-y-4">
            {msg && <div className={`rounded-lg px-4 py-2.5 text-sm border ${msg.ok ? 'bg-[#00e676]/10 border-[#00e676]/30 text-[#00e676]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`} data-testid="admin-msg">{msg.text}</div>}
            {current.render({ ...props, perms, owner, say })}
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
function PlayersSection({ account, online, players, onSetMode, onKick, onBan, onMute, staffOnly, onRefreshPlayers, say }: Ctx) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  function toggleMute(name: string) {
    const on = !muted.has(name.toLowerCase());
    onMute?.(name, on);
    setMuted((prev) => { const n = new Set(prev); if (on) n.add(name.toLowerCase()); else n.delete(name.toLowerCase()); return n; });
  }
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
                  {!me && !isOwnerName(p.name) && onMute && (
                    <button onClick={() => toggleMute(p.name)} data-testid="mute-btn" className={`${ui.btn} ${muted.has(p.name.toLowerCase()) ? 'bg-[#22e6e6]/25 text-[#22e6e6]' : 'bg-[#22e6e6]/10 text-[#22e6e6] hover:bg-[#22e6e6]/25'}`}>{muted.has(p.name.toLowerCase()) ? 'Unmute' : 'Mute'}</button>
                  )}
                  {!me && !isOwnerName(p.name) && staffOnly && (
                    <>
                      <button onClick={() => onKick(p.name)} className={`${ui.btn} bg-[#ff9800]/15 text-[#ff9800] hover:bg-[#ff9800]/30`}>Kick</button>
                      <button onClick={() => { onBan(p.name); say(true, `${p.name} is banned from this world.`); }} className={`${ui.btn} bg-[#ff5252]/15 text-[#ff5252] hover:bg-[#ff5252]/30`}>Ban</button>
                    </>
                  )}
                  {!me && !isOwnerName(p.name) && !staffOnly && (confirm === p.name ? (
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

// ---------------- Fair play in online chess and checkers ----------------
function FairplaySection({ say }: Ctx) {
  const [rows, setRows] = useState<FairplayRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const load = async () => {
    const r = await adminFairplay('open');
    if (r.ok) { setRows(r.value); setError(null); } else { setRows([]); setError(r.error); }
  };
  useEffect(() => { void load(); }, []);
  const resolve = async (row: FairplayRow, action: 'clear' | 'confirm') => {
    setRows((prev) => (prev ?? []).filter((x) => x.id !== row.id));
    const r = await adminResolveFairplay(row.id, action, days);
    if (!r.ok) { say(false, r.error); void load(); } else say(true, action === 'clear' ? `Cleared ${row.target}.` : `${row.target} can't play rated games for ${days} days.`);
  };
  return (
    <div className={ui.section} data-testid="admin-fairplay">
      <div className={ui.h2}><ShieldCheck className="w-5 h-5 text-[#00e676]" />Fair play: online chess and checkers</div>
      <p className="text-[#5a6b80] text-xs mb-3">Games where the opponent's computer thought a player's play looked unusual. A flag is a reason to look, not proof. Look at the signals and the game before you confirm. Nothing happens to a player unless a person confirms it here.</p>
      <div className="flex items-center gap-2 mb-3 text-xs text-[#8ea0b8]">If confirmed, pause rated games for
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={ui.input + ' !py-1 !px-2 w-auto'} data-testid="fp-days">{[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}</select></div>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {rows === null ? <p className={ui.muted}>Loading…</p> : !rows.length ? <p className={ui.muted} data-testid="fp-empty">Nothing to look at.</p> : (
        <div className="space-y-2 max-h-[460px] overflow-y-auto vb-scroll">
          {rows.map((r) => (
            <div key={r.id} className="bg-[#121822] rounded-xl px-3 py-2.5" data-testid="fp-row">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">{r.target}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#243044] text-[#8ea0b8]">{r.game}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.level === 'review' ? 'bg-[#ff5252]/20 text-[#ff8a8a]' : 'bg-[#ffb02e]/20 text-[#ffc65c]'}`}>{r.level} · {r.score}/100</span>
                {r.previous > 0 && <span className="text-[10px] text-[#ff9a3c]">{r.previous} earlier flag{r.previous === 1 ? '' : 's'}</span>}
                <span className="flex-1" />
                <button onClick={() => resolve(r, 'clear')} data-testid="fp-clear" className={`${ui.btn} bg-[#243044] text-[#8ea0b8] hover:text-white`}>Looks fine</button>
                <button onClick={() => resolve(r, 'confirm')} data-testid="fp-confirm" className={`${ui.btn} bg-[#ff5252]/15 text-[#ff7a7a] hover:bg-[#ff5252]/25`}>Confirm</button>
              </div>
              <ul className="mt-1.5 text-xs text-[#8ea0b8] list-disc pl-5 space-y-0.5">{r.signals.map((s, i) => <li key={i}>{s.text}</li>)}</ul>
              <div className="text-[10px] text-[#5a6b80] mt-1">Reported by {r.reporter} · {new Date(r.at).toLocaleString()} · game {r.gameId.slice(0, 8)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Reported private messages ----------------
function MessageReportsSection({ account, say }: Ctx) {
  const [reports, setReports] = useState<MessageReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    const r = await listMessageReports();
    if (r.ok) { setReports(r.reports); setError(null); } else { setReports([]); setError(r.error); }
  }
  useEffect(() => { void refresh(); }, []);
  async function dismiss(id: number) {
    setReports((prev) => (prev ?? []).filter((x) => x.id !== id));
    const r = await dismissMessageReport(id);
    if (!r.ok) { say(false, r.error); void refresh(); }
  }
  async function ban(name: string) {
    const r = await banEverywhere(account, name, 'Reported message');
    say(r.ok, r.ok ? `${name} is banned from every world.` : r.error);
  }
  return (
    <div className={ui.section} data-testid="admin-reports">
      <div className={ui.h2}><ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />Reported messages</div>
      <p className="text-[#5a6b80] text-xs mb-3">Private messages that players reported. A copy is kept even if the sender deletes the message.</p>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {reports === null ? <p className={ui.muted}>Loading…</p> : !reports.length ? <p className={ui.muted} data-testid="mr-empty">No reports.</p> : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto vb-scroll">
          {reports.map((r) => (
            <div key={r.id} className={ui.row} data-testid="mr-report">
              <div className="flex-1 min-w-0 text-xs">
                <div><span className="text-white font-semibold">{r.reported}</span> <span className="text-[#8ea0b8]">said:</span> <span className="text-[#ffd0d0] break-words">"{r.body}"</span></div>
                <div className="text-[10px] text-[#5a6b80]">{r.reason || 'No reason'} · reported by {r.reporter} · {new Date(r.at).toLocaleString()}</div>
              </div>
              {!isOwnerName(r.reported) && <button onClick={() => ban(r.reported)} className={`${ui.btn} bg-[#ff5252]/15 text-[#ff7a7a] hover:bg-[#ff5252]/25`}>Ban</button>}
              <button onClick={() => dismiss(r.id)} data-testid="mr-dismiss" className={`${ui.btn} bg-[#243044] text-[#8ea0b8] hover:text-white`}>Dismiss</button>
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
  async function dismiss(ids: number[], what: string) {
    setReports((prev) => (prev ?? []).filter((x) => !ids.includes(x.id))); // gone at once; the list comes back if the database says no
    const r = await dismissCheatReports(ids);
    if (!r.ok) { say(false, r.error); void refresh(); return; }
    say(true, `${what} dismissed.`);
  }
  async function dismissPlayer(name: string) {
    setReports((prev) => (prev ?? []).filter((x) => x.player !== name));
    const r = await clearCheatReports(name);
    if (!r.ok) { say(false, r.error); void refresh(); return; }
    say(true, `Every report about ${name} is dismissed.`);
  }
  async function ban(name: string) {
    const r = await banEverywhere(account, name, 'Cheating (anti-cheat)');
    say(r.ok, r.ok ? `${name} is banned from every world.` : r.error);
  }
  return (
    <div className={ui.section} data-testid="admin-anticheat">
      <div className={ui.h2}><ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />Anti-cheat reports</div>
      <p className="text-[#5a6b80] text-xs mb-3">Every world players host watches for flying, speed, reach, kill aura, auto clickers, nukers, chat spam and outside scripts (Tampermonkey and the like). Creative mode, elytra and the game's own commands are never counted. What it catches lands here (the last two weeks). One report can be lag: look for players who show up again and again.</p>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {top.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" data-testid="ac-top">
          {top.map(([name, n]) => (
            <span key={name} className="inline-flex items-center gap-2 rounded-lg bg-[#ff5252]/10 border border-[#ff5252]/30 px-2.5 py-1 text-xs">
              <b className="text-white">{name}</b><span className="text-[#ff8a8a]">{n} reports</span>
              <button onClick={() => dismissPlayer(name)} data-testid="ac-dismiss-player" className="text-[#8ea0b8] font-bold hover:text-white hover:underline">Dismiss</button>
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
      {shown.length > 0 && <div className="flex justify-end mb-2"><button onClick={() => dismiss(shown.map((r) => r.id), shown.length === 1 ? 'The report' : `${shown.length} reports`)} data-testid="ac-dismiss-all" className={`${ui.btn} bg-[#243044] text-[#8ea0b8] hover:text-white`}>Dismiss {filter === 'all' ? 'all' : 'these'} ({shown.length})</button></div>}
      {reports === null ? <p className={ui.muted}>Loading…</p> : !shown.length ? <p className={ui.muted} data-testid="ac-empty">No reports.</p> : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto vb-scroll">
          {shown.map((r) => (
            <div key={r.id} className={ui.row} data-testid="ac-report">
              <span className="text-[#ff6b6b] text-[11px] font-bold w-24 shrink-0">{CHEATS[r.kind] ?? r.kind}</span>
              <div className="flex-1 min-w-0 text-xs">
                <span className="text-white font-semibold">{r.player}</span> <span className="text-[#8ea0b8]">{r.detail}</span>
                <div className="text-[10px] text-[#5a6b80]">in {r.world || 'a world'} (host {r.host}) · {new Date(r.at).toLocaleString()}</div>
              </div>
              <button onClick={() => dismiss([r.id], 'The report')} data-testid="ac-report-dismiss" className={`${ui.btn} bg-[#243044] text-[#8ea0b8] hover:text-white`}>Dismiss</button>
              {!isOwnerName(r.player) && <button onClick={() => ban(r.player)} className={`${ui.btn} bg-[#ff5252]/15 text-[#ff5252] hover:bg-[#ff5252]/30`}>Ban</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Ranks: paid ranks, staff, [YOUTUBE] and [OG] (the owner, or an admin with the Give ranks permission) ----------------
function RanksSection(c: Ctx) {
  return (
    <>
      <GiveRankCard say={c.say} />
      <StaffSection say={c.say} />
      <SpecialSection say={c.say} />
    </>
  );
}

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
function GiveRankCard({ say }: Pick<Ctx, 'say'>) {
  const [rankName, setRankName] = useState('');
  const [rankPick, setRankPick] = useState<RankName>('vanguard');
  const [duration, setDuration] = useState('perm');
  const [customAmount, setCustomAmount] = useState('12');
  const [customUnit, setCustomUnit] = useState<'hours' | 'days'>('hours');
  const [rankNow, setRankNow] = useState<{ rank: string; until: string | null } | '?' | 'waiting' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRankNow(null);
    if (!USERNAME_RE.test(rankName)) return;
    let live = true;
    const t = setTimeout(() => { void rankInfo(rankName).then(async (r) => { if (r === null) { const w = await rankPending(rankName); if (live) setRankNow(w ? 'waiting' : '?'); } else if (live) setRankNow(r); }); }, 350);
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
    say(true, rankPick === 'none' ? `${r.username} no longer has a rank.` : `${r.username} is now ${RANK_LABELS[rankPick]} ${hours === null ? 'for good' : `for ${hours >= 48 && hours % 24 === 0 ? `${hours / 24} days` : `${hours} hour${hours === 1 ? '' : 's'}`}`}. ${r.pending ? 'They have no account yet: they get it the moment they sign up.' : 'They do not have to be online: they have it now (or see it when they sign in).'}`);
    setRankNow(r.pending ? 'waiting' : { rank: rankPick, until });
  }
  const sel = 'bg-[#0a0e14] border border-[#243044] rounded-xl text-sm text-white px-3 py-2.5';
  return (
    <div className={ui.section} data-testid="admin-ranks">
      <div className={ui.h2}><Crown className="w-5 h-5 text-[#ffd700]" />Give a rank</div>
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
        <button onClick={apply} disabled={!USERNAME_RE.test(rankName) || busy || Number.isNaN(hours)} data-testid="rank-give"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffd700] text-[#0a0e14] font-bold text-sm disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}{rankPick === 'none' ? 'Remove rank' : hours === null ? 'Give rank for good' : 'Give temporary rank'}
        </button>
      </div>
      <p className="text-[11px] text-[#5a6b80] mt-2" data-testid="rank-now">
        {rankNow === null ? 'Type a username to see their rank.' : rankNow === '?' ? 'Nobody has that name yet. You can still give them a rank: they get it when they sign up.' : rankNow === 'waiting' ? 'No account with that name yet. A rank is waiting for them and they get it when they sign up.'
          : `Current rank: ${RANK_LABELS[(RANKS as readonly string[]).includes(rankNow.rank) ? rankNow.rank as RankName : 'none']}${rankNow.rank !== 'none' ? ` (${untilText(rankNow.until)})` : ''}`}
      </p>
    </div>
  );
}

// ---------------- Admins (owner only) ----------------
function permsText(perms: AdminPerm[] | null): string {
  return perms === null ? 'Full access' : perms.length ? perms.map((p) => ADMIN_PERM_LABELS[p]).join(' · ') : 'Players only';
}
function AdminsSection({ say }: Pick<Ctx, 'say'>) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [full, setFull] = useState(true);
  const [picked, setPicked] = useState<AdminPerm[]>(['announce']);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await listAdmins();
    if (r.ok) { setAdmins(r.rows); setError(null); } else { setAdmins([]); setError(r.error); }
  }
  useEffect(() => { void refresh(); }, []);
  const toggle = (p: AdminPerm) => setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  async function change(n: string, on: boolean, perms: AdminPerm[] | null = null) {
    if (busy) return;
    setBusy(true);
    const r = await setAdmin(n, on, perms);
    setBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    say(true, !on ? `${r.username} is no longer an admin.` : perms === null ? `${r.username} is an admin with full access. They can open this panel the next time they sign in.` : `${r.username} is an admin with limited access (${permsText(perms)}). They get it the next time they sign in.`);
    if (on) setName('');
    void refresh();
  }
  function edit(row: AdminRow) {
    setName(row.username);
    setFull(row.perms === null);
    setPicked(row.perms ?? ['announce']);
  }
  const chip = 'inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer select-none';
  return (
    <div className={ui.section} data-testid="admin-admins">
      <div className={ui.h2}><UserPlus className="w-5 h-5 text-[#00e676]" />Admins</div>
      <p className="text-[#5a6b80] text-xs mb-3">Everyone you pick can open this panel and use the Players tab (kick, ban in a world, game modes). Choose <b className="text-[#8ea0b8]">full access</b> (everything except choosing admins, which only you can do) or <b className="text-[#8ea0b8]">limited access</b> and tick what they may do. Typing the name of someone who is already an admin changes their access.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="admin-name" className={`${ui.input} flex-1 min-w-[140px]`} />
        <div className="inline-flex rounded-xl border border-[#243044] overflow-hidden text-xs font-bold" role="radiogroup" aria-label="Access level">
          <button type="button" role="radio" aria-checked={full} onClick={() => setFull(true)} data-testid="admin-level-full" className={`px-3 py-2.5 ${full ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#0a0e14] text-[#8ea0b8] hover:text-white'}`}>Full access</button>
          <button type="button" role="radio" aria-checked={!full} onClick={() => setFull(false)} data-testid="admin-level-limited" className={`px-3 py-2.5 ${!full ? 'bg-[#ffd23a] text-[#0a0e14]' : 'bg-[#0a0e14] text-[#8ea0b8] hover:text-white'}`}>Limited access</button>
        </div>
        <button onClick={() => change(name, true, full ? null : picked)} disabled={!USERNAME_RE.test(name) || busy} data-testid="admin-add"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm disabled:opacity-40 active:scale-95">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Make admin</button>
      </div>
      {!full && (
        <div className="grid sm:grid-cols-2 gap-2 mb-3" data-testid="admin-perms">
          {ADMIN_PERMS.map((p) => (
            <label key={p} className={`${chip} ${picked.includes(p) ? 'border-[#ffd23a]/60 bg-[#ffd23a]/10 text-white' : 'border-[#243044] bg-[#0a0e14] text-[#8ea0b8]'}`}>
              <input type="checkbox" checked={picked.includes(p)} onChange={() => toggle(p)} data-testid={`perm-${p}`} className="accent-[#ffd23a]" />
              <span><b className="text-white">{ADMIN_PERM_LABELS[p]}</b><span className="block text-[11px] opacity-80">{ADMIN_PERM_HELP[p]}</span></span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {admins === null ? <p className={ui.muted}>Loading…</p> : (
        <div className="space-y-1.5" data-testid="admin-list">
          {admins.map((a) => (
            <div key={a.username} className={`${ui.row} flex-wrap`} data-testid="admin-row">
              <span className="flex-1 min-w-[110px] text-white text-sm font-semibold">{a.username}</span>
              {isOwnerName(a.username) ? <span className="text-[10px] uppercase font-bold text-[#ffd700]">Owner</span> : (
                <>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${a.perms === null ? 'bg-[#00e676]/15 text-[#00e676]' : 'bg-[#ffd23a]/15 text-[#ffd23a]'}`} data-testid="admin-access">{permsText(a.perms)}</span>
                  <button onClick={() => edit(a)} data-testid="admin-edit" className={`${ui.btn} border border-[#243044] text-[#8ea0b8] hover:text-white`}>Change access</button>
                  <button onClick={() => change(a.username, false)} disabled={busy} className={`${ui.btn} border border-[#243044] text-[#8ea0b8] hover:text-white`}>Remove</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Staff ranks ([HELPER], [MOD]) ----------------
function StaffSection({ say }: Pick<Ctx, 'say'>) {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRank>('helper');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await listStaff();
    if (r.ok) { setRows(r.staff); setError(null); } else { setRows([]); setError(r.error); }
  }
  useEffect(() => { void refresh(); }, []);
  async function change(n: string, to: StaffRank | 'none') {
    if (busy) return;
    setBusy(true);
    const r = await setStaffRank(n, to);
    setBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    say(true, to === 'none' ? `${r.username} is no longer on the staff.` : `${r.username} is [${STAFF_LABELS[to]}] now. They get it the next time they sign in.`);
    if (to !== 'none') setName('');
    void refresh();
  }
  return (
    <div className={ui.section} data-testid="admin-staff">
      <div className={ui.h2}><ShieldCheck className="w-5 h-5 text-[#22e6e6]" />Staff ranks</div>
      <p className="text-[#5a6b80] text-xs mb-3">[HELPER] and [MOD] get Elite's perks. In every world they can kick, ban (that world only), mute and use commands and cheats. They cannot announce, ban everywhere or give ranks.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="staff-name" className={`${ui.input} flex-1 min-w-[140px]`} />
        <select value={role} onChange={(e) => setRole(e.target.value as StaffRank)} data-testid="staff-role" className={`${ui.input} w-auto`}>
          {STAFF_RANKS.map((x) => <option key={x} value={x}>[{STAFF_LABELS[x]}]</option>)}
        </select>
        <button onClick={() => change(name, role)} disabled={!USERNAME_RE.test(name) || busy} data-testid="staff-add"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22e6e6] text-[#0a0e14] font-bold text-sm disabled:opacity-40 active:scale-95">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Give rank</button>
      </div>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {rows === null ? <p className={ui.muted}>Loading…</p> : (
        <div className="space-y-1.5" data-testid="staff-list">
          {!rows.length && !error && <p className={ui.muted}>Nobody is on the staff yet.</p>}
          {rows.map((x) => (
            <div key={x.username} className={ui.row} data-testid="staff-row">
              <span className="flex-1 text-white text-sm font-semibold">{x.username}</span>
              <span className="text-[10px] uppercase font-bold text-[#22e6e6]">{STAFF_LABELS[x.role]}</span>
              <button onClick={() => change(x.username, 'none')} disabled={busy} className={`${ui.btn} border border-[#243044] text-[#8ea0b8] hover:text-white`}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Special ranks ([YOUTUBE]) and OG fixes ----------------
function SpecialSection({ say }: Pick<Ctx, 'say'>) {
  const [rows, setRows] = useState<SpecialRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ogName, setOgName] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await listSpecial();
    if (r.ok) { setRows(r.special); setError(null); } else { setRows([]); setError(r.error); }
  }
  useEffect(() => { void refresh(); }, []);
  async function change(n: string, to: 'youtube' | 'none') {
    if (busy) return;
    setBusy(true);
    const r = await setSpecialRank(n, to);
    setBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    say(true, to === 'none' ? `${r.username} is no longer [YOUTUBE].` : `${r.username} is [YOUTUBE] now. They get it the next time they sign in.`);
    if (to !== 'none') setName('');
    void refresh();
  }
  async function og(n: string, on: boolean) {
    if (busy) return;
    setBusy(true);
    const r = await setOgRank(n, on);
    setBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    say(true, on ? `${r.username} has [OG] now.` : `${r.username} no longer has [OG].`);
    setOgName('');
  }
  const btn = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95';
  return (
    <div className={ui.section} data-testid="admin-special">
      <div className={ui.h2}><Tv className="w-5 h-5 text-[#ff4d4d]" />[YOUTUBE] rank</div>
      <p className="text-[#5a6b80] text-xs mb-3">For video makers. [YOUTUBE] gets everything Champion gets (15 planets, the biggest script budget, no ads, your own skin and cape) and a red tag. Only [YOUTUBE] can use <code className="text-[#ff6b6b]">/undercover</code> to hide their tags. It has no moderation powers.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="special-name" className={`${ui.input} flex-1 min-w-[140px]`} />
        <button onClick={() => change(name, 'youtube')} disabled={!USERNAME_RE.test(name) || busy} data-testid="special-add" className={`${btn} bg-[#ff4d4d] text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Give [YOUTUBE]</button>
      </div>
      {error && <p className="text-[#ff9a3c] text-xs mb-2">{error}</p>}
      {rows === null ? <p className={ui.muted}>Loading…</p> : (
        <div className="space-y-1.5" data-testid="special-list">
          {!rows.length && !error && <p className={ui.muted}>Nobody has [YOUTUBE] yet.</p>}
          {rows.map((x) => (
            <div key={x.username} className={ui.row} data-testid="special-row">
              <span className="flex-1 text-white text-sm font-semibold">{x.username}</span>
              <span className="text-[10px] uppercase font-bold text-[#ff4d4d]">YOUTUBE</span>
              <button onClick={() => change(x.username, 'none')} disabled={busy} className={`${ui.btn} border border-[#243044] text-[#8ea0b8] hover:text-white`}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <div className={`${ui.h2} mt-6`}><ShieldCheck className="w-5 h-5 text-[#22e6e6]" />[OG] rank</div>
      <p className="text-[#5a6b80] text-xs mb-3">Everyone who had [OG] keeps it. Nobody can earn it any more. If an account was left out by mistake, give it back here.</p>
      <div className="flex flex-wrap gap-2">
        <input value={ogName} onChange={(e) => setOgName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="og-name" className={`${ui.input} flex-1 min-w-[140px]`} />
        <button onClick={() => og(ogName, true)} disabled={!USERNAME_RE.test(ogName) || busy} data-testid="og-give" className={`${btn} bg-[#22e6e6] text-[#0a0e14]`}>Give [OG]</button>
        <button onClick={() => og(ogName, false)} disabled={!USERNAME_RE.test(ogName) || busy} data-testid="og-take" className={`${btn} border border-[#243044] text-[#8ea0b8] hover:text-white`}>Take away</button>
      </div>
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
