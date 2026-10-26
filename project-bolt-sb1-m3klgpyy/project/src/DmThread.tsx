import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Send, MoreHorizontal, Pencil, Trash2, Flag, X, Check } from 'lucide-react';
import { sendDM, editDM, deleteDM, reportDM, DM_MAX, REPORT_REASONS, type Account, type DM } from './social';
import { splitMentions, mentionQuery, suggestNames, applyMention } from './mentions';

const clock = (iso: string): string => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
};

/** The words of a message, with @pings of friends (and you) in blue. */
export function MessageText({ text, known, mine }: { text: string; known: string[]; mine: boolean }) {
  return (
    <>
      {splitMentions(text, known).map((p, i) => p.mention
        ? <span key={i} data-testid="mention" className={`rounded px-1 font-semibold ${mine ? 'bg-[#1f6feb] text-white' : 'bg-[#2f81f7]/25 text-[#6cb0ff]'}`}>{p.text}</span>
        : <span key={i}>{p.text}</span>)}
    </>
  );
}

type Props = {
  account: Account;
  friendId: string;
  friendName: string;
  /** names you can ping (your friends) */
  pingable: string[];
  messages: DM[];
  setMessages: (f: (prev: DM[]) => DM[]) => void;
  setError: (e: string) => void;
  setNote: (e: string) => void;
};

export default function DmThread({ account, friendId, friendName, pingable, messages, setMessages, setError, setNote }: Props) {
  const me = account.userId;
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [menu, setMenu] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const known = useMemo(() => [account.username, ...pingable], [account.username, pingable]);

  useEffect(() => { listEnd.current?.scrollIntoView({ block: 'end' }); }, [messages.length, friendId]);
  useEffect(() => { setDraft(''); setMenu(null); setEditing(null); setReporting(null); }, [friendId]);

  const q = mentionQuery(draft, caret);
  const options = q ? suggestNames(known.filter((n) => n.toLowerCase() !== account.username.toLowerCase() || true), q.query) : [];
  const showOptions = options.length > 0 && !(options.length === 1 && options[0].toLowerCase() === q?.query.toLowerCase());
  useEffect(() => { setPick(0); }, [q?.query, showOptions]);

  function choose(name: string) {
    const r = applyMention(draft, caret, name);
    setDraft(r.text);
    setCaret(r.caret);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(r.caret, r.caret); });
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    const r = await sendDM(account, friendId, text);
    if (r.ok) setMessages((m) => [...m, r.dm]);
    else { setError(r.error); setDraft(text); }
  }

  async function saveEdit() {
    if (!editing || busy) return;
    const clean = editing.text.trim();
    const original = messages.find((m) => m.id === editing.id);
    if (!clean || !original) { setEditing(null); return; }
    if (clean === original.text) { setEditing(null); return; }
    setBusy(true);
    const r = await editDM(editing.id, clean);
    setBusy(false);
    if (r.ok) { setMessages((all) => all.map((m) => (m.id === editing.id ? { ...m, text: r.text, edited: true } : m))); setEditing(null); setError(''); }
    else setError(r.error);
  }
  async function remove(id: number) {
    setMenu(null);
    const r = await deleteDM(id);
    if (r.ok) setMessages((all) => all.filter((m) => m.id !== id));
    else setError(r.error);
  }
  async function report(id: number, reason: string) {
    setReporting(null); setMenu(null);
    const r = await reportDM(id, reason);
    if (r.ok) setNote('Thanks. The moderators will look at that message.');
    else setError(r.error);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-1.5 min-h-0" onClick={() => setMenu(null)}>
        {!messages.length && <div className="text-center text-[#5a6b80] text-sm py-10">Nothing here yet. Say hi to {friendName}.</div>}
        {messages.map((m) => {
          const mine = m.from === me;
          const isEditing = editing?.id === m.id;
          return (
            <div key={m.id} className={`group flex items-end gap-1 ${mine ? 'justify-end' : 'justify-start'}`} data-testid="dm-row">
              {mine && !isEditing && (
                <MsgMenu open={menu === m.id} onToggle={() => setMenu(menu === m.id ? null : m.id)}>
                  <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Edit" testid="dm-edit" onClick={() => { setEditing({ id: m.id, text: m.text }); setMenu(null); }} />
                  <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" testid="dm-delete" danger onClick={() => void remove(m.id)} />
                </MsgMenu>
              )}
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3.5 py-2 text-sm break-words ${mine ? 'bg-[#00e676] text-[#0a0e14] rounded-br-md' : 'bg-[#1a2230] text-white rounded-bl-md'}`}>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 min-w-[200px]">
                    <input
                      autoFocus data-testid="dm-edit-input" value={editing.text} maxLength={DM_MAX}
                      onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveEdit(); } else if (e.key === 'Escape') setEditing(null); }}
                      className="flex-1 min-w-0 bg-[#0a0e14]/15 rounded-lg px-2 py-1 text-[#0a0e14] outline-none"
                    />
                    <button onClick={() => void saveEdit()} data-testid="dm-edit-save" className="p-1 rounded-md hover:bg-black/10" title="Save"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(null)} className="p-1 rounded-md hover:bg-black/10" title="Cancel"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <span data-testid="dm-text"><MessageText text={m.text} known={known} mine={mine} /></span>
                )}
                <div className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${mine ? 'text-[#0a0e14]/60' : 'text-[#5a6b80]'}`}>
                  <span>{clock(m.at)}</span>
                  {m.edited && <span data-testid="dm-edited" className="italic">(edited)</span>}
                </div>
              </div>
              {!mine && (
                <MsgMenu open={menu === m.id} onToggle={() => setMenu(menu === m.id ? null : m.id)}>
                  <MenuItem icon={<Flag className="w-3.5 h-3.5" />} label="Report" testid="dm-report" danger onClick={() => { setReporting(m.id); setMenu(null); }} />
                </MsgMenu>
              )}
              {reporting === m.id && (
                <div className="absolute z-20 mt-0" />
              )}
            </div>
          );
        })}
        <div ref={listEnd} />
      </div>

      {reporting !== null && (
        <div className="mx-3 mb-2 rounded-xl border border-[#243044] bg-[#0a0e14] p-3" data-testid="dm-report-box">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">Why are you reporting this message?</span>
            <button onClick={() => setReporting(null)} className="text-[#8ea0b8] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button key={r} data-testid="dm-report-reason" onClick={() => void report(reporting, r)} className="px-2.5 py-1 rounded-full text-xs border border-[#243044] text-[#c9d6e6] hover:border-[#ff5252]/60 hover:text-white transition-colors">{r}</button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={send} className="relative flex gap-2 p-3 border-t border-[#243044]">
        {showOptions && (
          <div className="absolute left-3 bottom-[calc(100%-4px)] z-30 w-60 rounded-xl border border-[#243044] bg-[#0d131b] shadow-xl py-1" data-testid="mention-list">
            {options.map((n, i) => (
              <button type="button" key={n} data-testid="mention-option" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(n)}
                className={`w-full text-left px-3 py-1.5 text-sm ${i === pick ? 'bg-[#2f81f7]/20 text-white' : 'text-[#c9d6e6] hover:bg-[#1a2230]'}`}>
                <span className="text-[#6cb0ff]">@</span>{n}
              </button>
            ))}
          </div>
        )}
        <input
          ref={input}
          value={draft}
          data-testid="dm-input"
          onChange={(e) => { setDraft(e.target.value.slice(0, DM_MAX)); setCaret(e.target.selectionStart ?? e.target.value.length); }}
          onSelect={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (!showOptions) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setPick((p) => (p + 1) % options.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((p) => (p - 1 + options.length) % options.length); }
            else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); choose(options[Math.min(pick, options.length - 1)]); }
            else if (e.key === 'Escape') { e.preventDefault(); setCaret(0); }
          }}
          placeholder={`Message ${friendName}  (type @ to ping someone)`}
          className="flex-1 bg-[#0a0e14] border border-[#243044] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none"
        />
        <button type="submit" disabled={!draft.trim()} className="w-12 rounded-xl bg-[#00e676] text-[#0a0e14] flex items-center justify-center disabled:opacity-40 hover:bg-[#00e676]/90 active:scale-95 transition-all" title="Send">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </>
  );
}

function MsgMenu({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="relative shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggle} data-testid="dm-menu" className={`p-1 rounded-md text-[#5a6b80] hover:text-white hover:bg-[#1a2230] transition-opacity ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`} title="More"><MoreHorizontal className="w-4 h-4" /></button>
      {open && <div className="absolute bottom-full mb-1 z-20 min-w-[110px] rounded-lg border border-[#243044] bg-[#0d131b] shadow-xl py-1 right-0">{children}</div>}
    </div>
  );
}
function MenuItem({ icon, label, onClick, danger, testid }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; testid: string }) {
  return (
    <button onClick={onClick} data-testid={testid} className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[#1a2230] ${danger ? 'text-[#ff7a7a]' : 'text-[#c9d6e6]'}`}>{icon}{label}</button>
  );
}
