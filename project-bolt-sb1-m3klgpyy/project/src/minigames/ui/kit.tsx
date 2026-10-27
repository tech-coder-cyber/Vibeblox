// Small shared pieces for the game screens.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BotInfo, Tier } from '../botCore';
import { TIERS, TIER_NAMES, botUnlocked, botsByTier, botIndexInTier, botsOpen } from '../botCore';
import { crownText } from '../ratings';
import { RankBadges, useSelfBadge, type BadgeInfo } from './Badge';

export function Seg<T extends string>({ value, options, onChange, testid }: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; testid?: string }) {
  return (
    <div className="mg-seg" role="group" data-testid={testid}>
      {options.map((o) => <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)} data-testid={testid ? `${testid}-${o.id}` : undefined}>{o.label}</button>)}
    </div>
  );
}

export function Toggle({ on, onChange, label, testid }: { on: boolean; onChange: (v: boolean) => void; label: string; testid?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm cursor-pointer py-1">
      <span>{label}</span>
      <button role="switch" aria-checked={on} data-testid={testid} onClick={() => onChange(!on)} className="relative w-10 h-6 rounded-full border" style={{ background: on ? 'var(--mg-accent)' : 'var(--mg-bg)', borderColor: 'var(--mg-line)' }}>
        <span className="absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all" style={{ width: 18, height: 18, left: on ? 19 : 2, background: on ? 'var(--mg-accent-ink)' : 'var(--mg-mute)' }} />
      </button>
    </label>
  );
}

export function Confirm({ title, body, yes, no = 'Cancel', danger, onYes, onNo }: { title: string; body?: string; yes: string; no?: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(8,10,14,.65)' }} role="dialog" aria-modal="true" data-testid="confirm">
      <div className="mg-card p-5 w-full max-w-sm">
        <div className="mg-h2 mb-1">{title}</div>
        {body && <p className="text-sm mg-mute mb-4">{body}</p>}
        <div className="flex gap-2 justify-end mt-3">
          <button className="mg-btn" onClick={onNo} data-testid="confirm-no">{no}</button>
          <button className={`mg-btn ${danger ? 'mg-btn-danger' : 'mg-btn-primary'}`} onClick={onYes} data-testid="confirm-yes">{yes}</button>
        </div>
      </div>
    </div>
  );
}

export function Crowns({ n, size = 14 }: { n: number; size?: number }) {
  return <span aria-label={`${n} of 3 crowns`} data-testid="crowns" title={`${n} of 3 crowns`} style={{ fontSize: size, letterSpacing: 1, color: n ? '#f2b84b' : '#59627a' }}>{crownText(n)}</span>;
}

export function PlayerBar({ name, sub, rating, clock, active, low, emoji, color, right, badge, self }: { badge?: BadgeInfo | null; self?: boolean; name: string; sub?: string; rating?: string; clock?: string; active?: boolean; low?: boolean; emoji?: string; color?: string; right?: ReactNode }) {
  const mine = useSelfBadge();
  const bg = badge ?? (self ? mine : null);
  return (
    <div className="flex items-center gap-3 py-1.5" data-testid="player-bar">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: color ?? 'var(--mg-panel2)' }}>{emoji ?? name.slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{name} {rating && <span className="mg-mute font-normal">({rating})</span>} <RankBadges badge={bg} /></div>
        {sub && <div className="text-xs mg-mute truncate">{sub}</div>}
      </div>
      {right}
      {clock !== undefined && <div className="mg-clock" data-active={active ? 'true' : 'false'} data-low={low ? 'true' : 'false'} data-testid="clock">{clock}</div>}
    </div>
  );
}

export function MoveList({ moves, view, onView, extra }: { moves: string[]; view: number; onView: (ply: number) => void; extra?: (ply: number) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = box.current?.querySelector('[data-current="true"]') as HTMLElement | null; el?.scrollIntoView({ block: 'nearest' }); }, [view, moves.length]);
  const rows: Array<[string, string | undefined, number]> = [];
  for (let i = 0; i < moves.length; i += 2) rows.push([moves[i], moves[i + 1], i / 2 + 1]);
  const cell = (san: string | undefined, ply: number) => san === undefined ? <span /> : (
    <button className="text-left px-1.5 py-0.5 rounded hover:bg-[var(--mg-panel2)] font-medium" data-current={view === ply} data-testid={`move-${ply}`} onClick={() => onView(ply)}
      style={view === ply ? { background: 'var(--mg-panel2)', boxShadow: 'inset 0 -2px 0 var(--mg-accent)' } : undefined}>{san}{extra?.(ply)}</button>
  );
  return (
    <div ref={box} className="mg-scroll overflow-y-auto max-h-48 text-sm" data-testid="move-list">
      {!moves.length && <div className="mg-mute text-xs py-2">Moves will show up here.</div>}
      {rows.map(([a, b, n]) => (
        <div key={n} className="grid items-center" style={{ gridTemplateColumns: '2rem 1fr 1fr' }}>
          <span className="mg-mute text-xs pl-1">{n}.</span>{cell(a, n * 2 - 1)}{cell(b, n * 2)}
        </div>
      ))}
    </div>
  );
}

export type ChatLine = { id: number; who: 'bot' | 'me' | 'them' | 'sys'; name?: string; text: string };
export function BotChat({ lines, emoji }: { lines: ChatLine[]; emoji?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: 1e6 }); }, [lines.length]);
  return (
    <div ref={box} className="mg-scroll overflow-y-auto max-h-32 text-sm space-y-1" data-testid="bot-chat">
      {!lines.length && <div className="mg-mute text-xs">Nothing said yet.</div>}
      {lines.map((l) => (
        <div key={l.id} className={l.who === 'sys' ? 'mg-mute text-xs italic' : ''}>
          {l.who !== 'sys' && <span className="mr-1">{l.who === 'bot' ? emoji : ''}<b style={{ color: l.who === 'me' ? 'var(--mg-accent)' : 'var(--mg-text)' }}>{l.name ?? ''}</b></span>}
          <span data-testid="chat-line">{l.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Picks a bot. Four tiers; a tier's easier bots are open to everyone, the rest need a rank (Elite and Champion play them all). */
export function BotPicker<T extends BotInfo>({ bots, rank, crowns, picked, onPick, testid = 'bot-picker' }: { bots: T[]; rank: string; crowns: Record<string, number>; picked: string | null; onPick: (b: T) => void; testid?: string }) {
  const [tier, setTier] = useState<Tier>('beginner');
  const list = botsByTier(bots, tier);
  const open = botsOpen(rank);
  return (
    <div data-testid={testid}>
      <div className="mg-seg mb-3 flex-wrap" role="tablist">
        {TIERS.map((t) => <button key={t} aria-pressed={tier === t} onClick={() => setTier(t)} data-testid={`tier-${t}`}>{TIER_NAMES[t]}</button>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((b) => {
          const unlocked = botUnlocked(botIndexInTier(bots, b), rank);
          return (
            <button key={b.id} disabled={!unlocked} onClick={() => onPick(b)} data-testid={`bot-${b.id}`} data-locked={!unlocked}
              className="mg-card text-left p-3 flex gap-3 items-start transition-colors disabled:opacity-60"
              style={picked === b.id ? { borderColor: 'var(--mg-accent)', boxShadow: '0 0 0 1px var(--mg-accent) inset' } : undefined}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: b.color + '33' }}>{b.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-semibold">{b.name}</span><span className="mg-chip">{b.rating}</span></div>
                <div className="text-xs mg-mute mt-0.5 line-clamp-2">{b.bio}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {unlocked ? <Crowns n={crowns[b.id] ?? 0} /> : <span className="mg-mute">Locked: needs {botIndexInTier(bots, b) < 5 ? 'Vanguard' : 'Elite'}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs mg-mute mt-2">{open >= 99 ? 'Your rank plays every bot.' : `Your rank opens the first ${open} bots in each level. Vanguard opens 5, Elite and Champion open them all.`}</p>
    </div>
  );
}
