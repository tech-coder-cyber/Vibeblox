import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Users, UserPlus, Send, UserMinus, Check, X, MessageCircle, LogOut, LogIn, Loader2, ShieldCheck } from 'lucide-react';
import {
  loadFriends, addFriend, acceptFriend, removeFriend, sendDM, loadConversation, DM_MAX,
  type Account, type Friend, type FriendState, type DM,
} from './social';

type Props = {
  account: Account | null;
  /** True while we don't know yet whether someone is signed in. */
  checking: boolean;
  isAdmin: boolean;
  /** Unread private messages per friend (by user id). */
  unread: Record<string, number>;
  onOpenChat: (friendId: string | null) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  /** Called with the number of incoming friend requests after every refresh. */
  onFriendsChanged: (incoming: number) => void;
};

const EMPTY: FriendState = { friends: [], incoming: [], outgoing: [] };

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

function Dot({ online }: { online: boolean }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-[#00e676] shadow-[0_0_6px_#00e676]' : 'bg-[#3a4a60]'}`} title={online ? 'Online' : 'Offline'} />;
}

export default function SocialView({ account, checking, isAdmin, unread, onOpenChat, onSignIn, onSignOut, onFriendsChanged }: Props) {
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [state, setState] = useState<FriendState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [addName, setAddName] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState('');
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const me = account?.userId ?? '';

  async function refreshFriends(quiet = false) {
    if (!account) return;
    if (!quiet) setLoading(true);
    const r = await loadFriends(account.userId);
    if (!quiet) setLoading(false);
    if (r.ok) { setState({ friends: r.friends, incoming: r.incoming, outgoing: r.outgoing }); setError(''); onFriendsChanged(r.incoming.length); }
    else setError(r.error);
  }

  // Friends: now, and every 10 seconds while this page is open
  useEffect(() => {
    if (!account) { setState(EMPTY); setSelected(null); return; }
    void refreshFriends();
    const t = setInterval(() => { void refreshFriends(true); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.userId]);

  // The open conversation: now, and every 4 seconds
  useEffect(() => {
    onOpenChat(selected?.id ?? null);
    if (!account || !selected) { setMessages([]); return; }
    let dead = false;
    const load = async () => {
      const r = await loadConversation(account.userId, selected.id);
      if (!dead && r.ok) setMessages((prev) => (prev.length === r.messages.length && prev[prev.length - 1]?.id === r.messages[r.messages.length - 1]?.id ? prev : r.messages));
    };
    void load();
    const t = setInterval(load, 4000);
    return () => { dead = true; clearInterval(t); onOpenChat(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.userId, selected?.id]);

  useEffect(() => { listEnd.current?.scrollIntoView({ block: 'end' }); }, [messages.length, selected?.id]);
  useEffect(() => { setConfirmUnfriend(false); }, [selected?.id]);

  // keep the selected friend's online dot fresh
  const live = selected ? state.friends.find((f) => f.id === selected.id) ?? selected : null;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!account || !addName.trim() || busy) return;
    setBusy(true); setNote(''); setError('');
    const r = await addFriend(account, addName);
    setBusy(false);
    if (r.ok) { setNote(r.message); setAddName(''); void refreshFriends(true); } else setError(r.error);
  }
  async function handleAccept(f: Friend) {
    if (!account) return;
    const r = await acceptFriend(account, f.id);
    if (!r.ok) setError(r.error); else setNote(`You and ${f.username} are now friends!`);
    void refreshFriends(true);
  }
  async function handleRemove(f: Friend, what: 'decline' | 'cancel' | 'unfriend') {
    if (!account) return;
    const r = await removeFriend(account, f.id);
    if (!r.ok) { setError(r.error); return; }
    setNote(what === 'unfriend' ? `You are no longer friends with ${f.username}` : what === 'decline' ? 'Request declined' : 'Request cancelled');
    if (selected?.id === f.id) setSelected(null);
    setConfirmUnfriend(false);
    void refreshFriends(true);
  }
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!account || !live || !draft.trim()) return;
    const text = draft;
    setDraft('');
    const r = await sendDM(account, live.id, text);
    if (r.ok) setMessages((m) => [...m, r.dm]);
    else { setError(r.error); setDraft(text); }
  }

  const card = 'bg-[#0d131b] border border-[#243044] rounded-2xl';

  if (checking) {
    return <div className="flex-1 flex items-center justify-center text-[#5a6b80]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!account) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="font-[var(--font-display)] text-3xl text-white mb-1 flex items-center gap-3"><Users className="w-7 h-7 text-[#00e676]" />Social</h1>
        <p className="text-[#8ea0b8] mb-6">Add friends, see who is online and send private messages.</p>
        <div className={`${card} p-8 max-w-xl text-center`}>
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-[#00e676]/15 flex items-center justify-center"><Users className="w-8 h-8 text-[#00e676]" /></div>
          <h2 className="text-white font-bold text-lg mb-1">Sign in to use Social</h2>
          <p className="text-[#8ea0b8] text-sm mb-5">Guests can play and join servers, but friends and private messages need an account.</p>
          <button onClick={onSignIn} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm hover:bg-[#00e676]/90 active:scale-95 transition-all">
            <LogIn className="w-4 h-4" />Sign in or create an account
          </button>
        </div>
      </div>
    );
  }

  const unreadTotal = (Object.values(unread) as number[]).reduce((a, b) => a + b, 0);
  const tabBtn = (id: typeof tab, label: string, badge = 0) => (
    <button
      key={id}
      onClick={() => { setTab(id); setNote(''); setError(''); }}
      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors relative ${tab === id ? 'bg-[#00e676]/15 text-[#00e676]' : 'text-[#8ea0b8] hover:text-white hover:bg-[#1a2230]'}`}
    >
      {label}
      {badge > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff5252] text-white text-[10px]">{badge}</span>}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-8 pb-6 min-w-0">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl text-white flex items-center gap-3"><Users className="w-7 h-7 text-[#00e676]" />Social</h1>
          <p className="text-[#8ea0b8] text-sm mt-1">
            Signed in as <b className="text-white">{account.username}</b>
            {isAdmin && <span className="ml-2 inline-flex items-center gap-1 text-[#ffd700] text-xs"><ShieldCheck className="w-3.5 h-3.5" />Admin · type /panel in a world</span>}
            {unreadTotal > 0 && <span className="ml-2 text-[#ff8a80]">· {unreadTotal} unread</span>}
          </p>
        </div>
        <button onClick={onSignOut} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#243044] text-[#8ea0b8] text-sm hover:text-white hover:border-[#3a4a60] transition-colors">
          <LogOut className="w-4 h-4" />Sign out
        </button>
      </div>

      {(error || note) && (
        <div className={`mb-3 rounded-lg px-4 py-2.5 text-sm border ${error ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#00e676]/10 border-[#00e676]/30 text-[#00e676]'}`}>{error || note}</div>
      )}

      <div className="flex-1 min-h-0 flex gap-4">
        {/* ---- left: lists ---- */}
        <div className={`${card} w-80 shrink-0 flex flex-col p-3 min-h-0`}>
          <div className="flex gap-1 mb-3 p-1 bg-[#0a0e14] rounded-xl">
            {tabBtn('friends', `Friends${state.friends.length ? ` (${state.friends.length})` : ''}`, unreadTotal)}
            {tabBtn('requests', 'Requests', state.incoming.length)}
            {tabBtn('add', 'Add')}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {tab === 'friends' && (
              <>
                {loading && !state.friends.length && <div className="text-center text-[#5a6b80] py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}
                {!loading && !state.friends.length && (
                  <div className="text-center text-[#5a6b80] text-sm py-8 px-4">
                    No friends yet.<br />Use the <b className="text-[#8ea0b8]">Add</b> tab, or type <code className="text-[#00e676]">/friend name</code> in a world.
                  </div>
                )}
                {state.friends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selected?.id === f.id ? 'bg-[#00e676]/15' : 'hover:bg-[#1a2230]'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#1a2230] flex items-center justify-center text-white font-bold shrink-0">{f.username.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-semibold truncate">{f.username}</div>
                      <div className="text-[11px] text-[#5a6b80] flex items-center gap-1.5"><Dot online={f.online} />{f.online ? 'Online' : 'Offline'}</div>
                    </div>
                    {(unread[f.id] ?? 0) > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#ff5252] text-white text-[11px] font-bold flex items-center justify-center">{unread[f.id]}</span>}
                  </button>
                ))}
              </>
            )}

            {tab === 'requests' && (
              <>
                {!state.incoming.length && !state.outgoing.length && <div className="text-center text-[#5a6b80] text-sm py-8">No pending requests.</div>}
                {state.incoming.length > 0 && <div className="text-[10px] uppercase tracking-wider text-[#5a6b80] px-2 pt-1">Wants to be your friend</div>}
                {state.incoming.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#121822]">
                    <div className="w-9 h-9 rounded-full bg-[#1a2230] flex items-center justify-center text-white font-bold shrink-0">{f.username.charAt(0).toUpperCase()}</div>
                    <div className="text-white text-sm font-semibold truncate flex-1">{f.username}</div>
                    <button onClick={() => handleAccept(f)} title="Accept" className="w-8 h-8 rounded-lg bg-[#00e676]/15 text-[#00e676] flex items-center justify-center hover:bg-[#00e676]/30"><Check className="w-4 h-4" /></button>
                    <button onClick={() => handleRemove(f, 'decline')} title="Decline" className="w-8 h-8 rounded-lg bg-[#ff5252]/15 text-[#ff5252] flex items-center justify-center hover:bg-[#ff5252]/30"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {state.outgoing.length > 0 && <div className="text-[10px] uppercase tracking-wider text-[#5a6b80] px-2 pt-3">Waiting for an answer</div>}
                {state.outgoing.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#121822]">
                    <div className="w-9 h-9 rounded-full bg-[#1a2230] flex items-center justify-center text-white font-bold shrink-0">{f.username.charAt(0).toUpperCase()}</div>
                    <div className="text-[#8ea0b8] text-sm truncate flex-1">{f.username}</div>
                    <button onClick={() => handleRemove(f, 'cancel')} title="Cancel request" className="px-2.5 h-8 rounded-lg text-[#8ea0b8] text-xs hover:text-white hover:bg-[#1a2230]">Cancel</button>
                  </div>
                ))}
              </>
            )}

            {tab === 'add' && (
              <form onSubmit={handleAdd} className="p-2 space-y-3">
                <p className="text-[#8ea0b8] text-sm">Type a player's exact username to send a friend request.</p>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))}
                  placeholder="Username"
                  className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl px-3 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none"
                />
                <button type="submit" disabled={busy || !addName.trim()} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm disabled:opacity-50 hover:bg-[#00e676]/90 active:scale-[0.98] transition-all">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Send request
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ---- right: conversation ---- */}
        <div className={`${card} flex-1 flex flex-col min-w-0 min-h-0`}>
          {!live ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#5a6b80] text-center px-8">
              <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
              <div className="text-sm">Pick a friend to send a private message.</div>
              <div className="text-xs mt-2">In a world, <code className="text-[#00e676]">/w name message</code> does the same.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[#243044]">
                <div className="w-9 h-9 rounded-full bg-[#1a2230] flex items-center justify-center text-white font-bold">{live.username.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold truncate">{live.username}</div>
                  <div className="text-[11px] text-[#5a6b80] flex items-center gap-1.5"><Dot online={live.online} />{live.online ? 'Online' : 'Offline'}</div>
                </div>
                {confirmUnfriend ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#8ea0b8]">Unfriend {live.username}?</span>
                    <button onClick={() => handleRemove(live, 'unfriend')} className="px-3 py-1.5 rounded-lg bg-[#ff5252] text-white font-bold">Yes</button>
                    <button onClick={() => setConfirmUnfriend(false)} className="px-3 py-1.5 rounded-lg border border-[#243044] text-[#8ea0b8]">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmUnfriend(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#243044] text-[#8ea0b8] text-xs hover:text-[#ff5252] hover:border-[#ff5252]/50 transition-colors">
                    <UserMinus className="w-3.5 h-3.5" />Unfriend
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
                {!messages.length && <div className="text-center text-[#5a6b80] text-sm py-10">No messages yet. Say hi!</div>}
                {messages.map((m) => {
                  const mine = m.from === me;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words ${mine ? 'bg-[#00e676] text-[#0a0e14] rounded-br-md' : 'bg-[#1a2230] text-white rounded-bl-md'}`}>
                        {m.text}
                        <div className={`text-[10px] mt-0.5 ${mine ? 'text-[#0a0e14]/60' : 'text-[#5a6b80]'}`}>{clock(m.at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={listEnd} />
              </div>
              <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-[#243044]">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, DM_MAX))}
                  placeholder={`Message ${live.username}`}
                  className="flex-1 bg-[#0a0e14] border border-[#243044] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none"
                />
                <button type="submit" disabled={!draft.trim()} className="w-12 rounded-xl bg-[#00e676] text-[#0a0e14] flex items-center justify-center disabled:opacity-40 hover:bg-[#00e676]/90 active:scale-95 transition-all" title="Send">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
