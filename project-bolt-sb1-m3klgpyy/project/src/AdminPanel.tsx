import { useEffect, useState } from 'react';
import SideNav from './SideNav';
import AccountPanel from './AccountPanel';
import { ShieldCheck, Megaphone, Gavel, UserX, Ban, X, Loader2, Undo2, Crown } from 'lucide-react';
import { postAnnouncement, banEverywhere, unbanEverywhere, listBans, getLastAnnouncement, setLastAnnouncement, isOwnerName, giveRank, rankOf, RANKS, RANK_LABELS, ANNOUNCE_MAX, USERNAME_RE, type Account, type Ban as BanRow, type RankName } from './social';

export type PanelPlayer = { id: number; name: string; mode: string };
type Props = {
  account: Account;
  /** Connected to a multiplayer server? (Kick, ban and other players' game modes only exist there.) */
  online: boolean;
  players: PanelPlayer[];
  /** null = yourself */
  onSetMode: (name: string | null, mode: string) => void;
  onKick: (name: string) => void;
  /** Removes the player from this server (the panel itself adds the global ban). */
  onBan: (name: string) => void;
  onAnnounced: (text: string) => void;
  onRefreshPlayers: () => void;
  onClose: () => void;
};

const MODES = ['survival', 'creative', 'adventure', 'spectator'] as const;

export default function AdminPanel({ account, online, players, onSetMode, onKick, onBan, onAnnounced, onRefreshPlayers, onClose }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [banName, setBanName] = useState('');
  const [banReason, setBanReason] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [tab, setTab] = useState<'announce' | 'players' | 'bans' | 'ranks' | 'account'>('announce');
  const [rankName, setRankName] = useState('');
  const [rankPick, setRankPick] = useState<RankName>('vanguard');
  const [rankNow, setRankNow] = useState<string | null>(null);
  const [rankBusy, setRankBusy] = useState(false);
  const owner = isOwnerName(account.username);
  // Show the player's current rank once a full name is typed
  useEffect(() => {
    setRankNow(null);
    if (!USERNAME_RE.test(rankName)) return;
    let live = true;
    const t = setTimeout(() => { void rankOf(rankName).then((r) => { if (live) setRankNow(r === null ? '?' : r); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [rankName]);
  async function applyRank() {
    if (rankBusy) return;
    setRankBusy(true);
    const r = await giveRank(rankName, rankPick);
    setRankBusy(false);
    if (!r.ok) { say(false, r.error); return; }
    say(true, rankPick === 'none' ? `${r.username} no longer has a rank.` : `${r.username} is now ${RANK_LABELS[rankPick]}. They see it the next time they sign in.`);
    setRankNow(rankPick);
  }

  const say = (ok: boolean, t: string) => setMsg({ ok, text: t });
  async function refreshBans() {
    const r = await listBans();
    if (r.ok) setBans(r.bans);
  }
  useEffect(() => { void refreshBans(); }, []);
  useEffect(() => {
    if (!online) return;
    onRefreshPlayers();
    const t = setInterval(onRefreshPlayers, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  async function announce() {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = await postAnnouncement(account, text);
    setSending(false);
    if (r.ok) {
      say(true, 'Announcement sent to every server. Players see it within a few seconds.');
      if (r.item.id > getLastAnnouncement()) setLastAnnouncement(r.item.id); // so this screen doesn't show it a second time
      onAnnounced(r.item.text);
      setText('');
    }
    else say(false, r.error);
  }
  async function banGlobal(name: string, alsoRemove: boolean) {
    const r = await banEverywhere(account, name, banReason);
    if (!r.ok) { say(false, r.error); return; }
    if (alsoRemove) onBan(name);
    say(true, `${name} is banned from every server.`);
    setBanName(''); setBanReason(''); setConfirm(null);
    void refreshBans();
  }
  async function unban(name: string) {
    const r = await unbanEverywhere(name);
    if (r.ok) { say(true, `${name} can play again.`); void refreshBans(); } else say(false, r.error);
  }

  const section = 'bg-[#0d131b] border border-[#243044] rounded-2xl p-5';
  const h2 = 'text-white font-bold flex items-center gap-2 mb-3';
  const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" data-testid="admin-panel">
      <div className="w-[760px] max-w-full max-h-[92vh] overflow-y-auto bg-[#121822] border border-[#243044] rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-[#121822] border-b border-[#243044]">
          <ShieldCheck className="w-6 h-6 text-[#ffd700]" />
          <div className="flex-1">
            <div className="text-white font-bold text-lg leading-tight flex items-center gap-2">
              Admin Panel
              {isOwnerName(account.username) && <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#ffd700] text-[#0a0e14]" data-testid="owner-badge">Owner</span>}
            </div>
            <div className="text-[#5a6b80] text-xs">Signed in as {account.username}{isOwnerName(account.username) ? ' · the owner of VibeBlox' : ''}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg text-[#8ea0b8] hover:text-white hover:bg-[#1a2230] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex gap-5">
         <SideNav testid="admin-sidenav" active={tab} onSelect={setTab} tabs={[{ id: 'announce', label: 'Announce' }, { id: 'players', label: 'Players' }, { id: 'bans', label: 'Bans' }, { id: 'ranks', label: 'Ranks' }, { id: 'account', label: 'My account' }]} />
         <div className="flex-1 min-w-0 space-y-4">
          {msg && <div className={`rounded-lg px-4 py-2.5 text-sm border ${msg.ok ? 'bg-[#00e676]/10 border-[#00e676]/30 text-[#00e676]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>{msg.text}</div>}

          {/* Announcement */}
          {tab === 'announce' && <div className={section}>
            <div className={h2}><Megaphone className="w-5 h-5 text-[#00e676]" />Announce to ALL servers</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, ANNOUNCE_MAX))}
              rows={3}
              placeholder="Type the announcement. Everyone playing, on any server, will see it."
              className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-[#5a6b80]">{text.length}/{ANNOUNCE_MAX}</span>
              <button onClick={announce} disabled={!text.trim() || sending} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm disabled:opacity-50 hover:bg-[#00e676]/90 active:scale-95 transition-all">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}Announce
              </button>
            </div>
          </div>}

          {/* My game mode */}
          {tab === 'players' && <div className={section}>
            <div className={h2}><Gavel className="w-5 h-5 text-[#00e676]" />Your game mode</div>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button key={m} onClick={() => onSetMode(null, m)} className={`${btn} bg-[#1a2230] text-white hover:bg-[#243044] capitalize px-4 py-2`}>{m}</button>
              ))}
            </div>
          </div>}

          {/* Players */}
          {tab === 'players' && <div className={section}>
            <div className={h2}><UserX className="w-5 h-5 text-[#00e676]" />Players on this server</div>
            {!online ? (
              <p className="text-[#5a6b80] text-sm">You're not on a multiplayer server. Join one to kick, ban or change other players' game modes.</p>
            ) : (
              <div className="space-y-2">
                {players.map((p) => {
                  const me = p.name.toLowerCase() === account.username.toLowerCase();
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 bg-[#121822] rounded-xl px-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-[#1a2230] text-white font-bold flex items-center justify-center">{p.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-[100px]">
                        <div className="text-white text-sm font-semibold">{p.name}{me && <span className="text-[#5a6b80] font-normal"> (you)</span>}</div>
                        <div className="text-[11px] text-[#5a6b80] capitalize">{p.mode}</div>
                      </div>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) onSetMode(me ? null : p.name, e.target.value); }}
                        className="bg-[#0a0e14] border border-[#243044] rounded-lg text-xs text-white px-2 py-1.5 capitalize"
                        aria-label={`Game mode for ${p.name}`}
                      >
                        <option value="">Game mode…</option>
                        {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {!me && isOwnerName(p.name) && <span className="text-[10px] uppercase font-bold text-[#ffd700]">Owner</span>}
                      {!me && !isOwnerName(p.name) && (confirm === p.name ? (
                        <>
                          <span className="text-xs text-[#8ea0b8]">Ban everywhere?</span>
                          <button onClick={() => banGlobal(p.name, true)} className={`${btn} bg-[#ff5252] text-white`}>Yes, ban</button>
                          <button onClick={() => setConfirm(null)} className={`${btn} border border-[#243044] text-[#8ea0b8]`}>No</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onKick(p.name)} className={`${btn} bg-[#ff9800]/15 text-[#ff9800] hover:bg-[#ff9800]/30`}>Kick</button>
                          <button onClick={() => setConfirm(p.name)} className={`${btn} bg-[#ff5252]/15 text-[#ff5252] hover:bg-[#ff5252]/30`}>Ban</button>
                        </>
                      ))}
                    </div>
                  );
                })}
                {!players.length && <p className="text-[#5a6b80] text-sm">Loading players…</p>}
              </div>
            )}
          </div>}

          {/* Global bans */}
          {tab === 'bans' && <div className={section}>
            <div className={h2}><Ban className="w-5 h-5 text-[#00e676]" />Banned from every server</div>
            <div className="flex flex-wrap gap-2 mb-3">
              <input value={banName} onChange={(e) => setBanName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" className="flex-1 min-w-[140px] bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-[#5a6b80] focus:outline-none focus:border-[#00e676]/50" />
              <input value={banReason} onChange={(e) => setBanReason(e.target.value.slice(0, 120))} placeholder="Reason (optional)" className="flex-[2] min-w-[160px] bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-[#5a6b80] focus:outline-none focus:border-[#00e676]/50" />
              <button onClick={() => banGlobal(banName, online && players.some((p) => p.name.toLowerCase() === banName.toLowerCase()))} disabled={!USERNAME_RE.test(banName)} className="px-4 py-2.5 rounded-xl bg-[#ff5252] text-white font-bold text-sm disabled:opacity-40 hover:bg-[#ff5252]/90 active:scale-95 transition-all">Ban</button>
            </div>
            {!bans.length ? <p className="text-[#5a6b80] text-sm">Nobody is banned.</p> : (
              <div className="space-y-1.5">
                {bans.map((b) => (
                  <div key={b.username} className="flex items-center gap-3 bg-[#121822] rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold">{b.username}</div>
                      {(b.reason || b.by) && <div className="text-[11px] text-[#5a6b80] truncate">{b.reason}{b.reason && b.by ? ' · ' : ''}{b.by && `by ${b.by}`}</div>}
                    </div>
                    <button onClick={() => unban(b.username)} className={`${btn} inline-flex items-center gap-1 border border-[#243044] text-[#8ea0b8] hover:text-white`}><Undo2 className="w-3 h-3" />Unban</button>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* Give ranks */}
          {tab === 'ranks' && <div className={section} data-testid="admin-ranks">
            <div className={h2}><Crown className="w-5 h-5 text-[#ffd700]" />Give a rank</div>
            {!owner && <p className="text-[#ff9800] text-xs mb-3">Only the owner can give ranks.</p>}
            <div className="flex flex-wrap gap-2 items-center">
              <input value={rankName} onChange={(e) => setRankName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} placeholder="Username" data-testid="rank-name"
                className="flex-1 min-w-[140px] bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-[#5a6b80] focus:outline-none focus:border-[#00e676]/50" />
              <select value={rankPick} onChange={(e) => setRankPick(e.target.value as RankName)} data-testid="rank-pick" aria-label="Rank"
                className="bg-[#0a0e14] border border-[#243044] rounded-xl text-sm text-white px-3 py-2.5">
                {RANKS.map((r) => <option key={r} value={r}>{RANK_LABELS[r]}</option>)}
              </select>
              <button onClick={applyRank} disabled={!owner || !USERNAME_RE.test(rankName) || rankBusy} data-testid="rank-give"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffd700] text-[#0a0e14] font-bold text-sm disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all">
                {rankBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}{rankPick === 'none' ? 'Remove rank' : 'Give rank'}
              </button>
            </div>
            <p className="text-[11px] text-[#5a6b80] mt-2" data-testid="rank-now">
              {rankNow === null ? 'Type a username to see their rank.' : rankNow === '?' ? 'Nobody has that name.' : `Current rank: ${RANK_LABELS[(RANKS as readonly string[]).includes(rankNow) ? rankNow as RankName : 'none']}`}
            </p>
          </div>}

          {tab === 'account' && (
            <AccountPanel summary={{ username: account.username, signedIn: true, isOwner: isOwnerName(account.username), isAdmin: true, openAdmin: () => undefined, inPanel: true }} />
          )}
         </div>
        </div>
      </div>
    </div>
  );
}
