// Rank badges shown next to a name in the games: one small pill per rank, in the colour of that rank.
import { createContext, useContext } from 'react';

export type BadgeInfo = { owner?: boolean; rank?: string | null; staff?: string | null; special?: string | null; og?: boolean };
type Look = { label: string; color: string; fill?: string; ink?: string };

/** The colours match the name tags used in chat and on the leaderboards. */
const LOOKS: Record<string, Look> = {
  owner: { label: 'OWNER', color: '#dc143c' },
  helper: { label: 'HELPER', color: '#3ddc97' },
  mod: { label: 'MOD', color: '#ffd23a' },
  og: { label: 'OG', color: '#22d3ee' },
  youtube: { label: 'YOUTUBE', color: '#ff2d2d', fill: '#ff2d2d', ink: '#ffffff' },
  vanguard: { label: 'Vanguard', color: '#b9824f' },
  elite: { label: 'Elite', color: '#22d3ee' },
  champion: { label: 'Champion', color: '#ffd23a' },
};
/** The badges for a player, most important first. */
export function badgesOf(b: BadgeInfo | null | undefined): Array<Look & { id: string }> {
  if (!b) return [];
  const ids: string[] = [];
  if (b.owner) ids.push('owner');
  if (b.staff === 'helper' || b.staff === 'mod') ids.push(b.staff);
  if (b.special === 'youtube') ids.push('youtube');
  if (b.og) ids.push('og');
  if (b.rank === 'vanguard' || b.rank === 'elite' || b.rank === 'champion') ids.push(b.rank);
  return ids.map((id) => ({ id, ...LOOKS[id] }));
}
export function RankBadges({ badge, size = 10 }: { badge: BadgeInfo | null | undefined; size?: number }) {
  const list = badgesOf(badge);
  if (!list.length) return null;
  return (
    <span className="inline-flex gap-1 items-center align-middle" data-testid="rank-badges">
      {list.map((x) => (
        <span key={x.id} data-testid={`badge-${x.id}`} data-color={x.color} title={x.label} className="inline-flex items-center rounded font-bold leading-none"
          style={{ fontSize: size, padding: '2px 5px', border: `1px solid ${x.color}`, color: x.ink ?? x.color, background: x.fill ?? `${x.color}22`, letterSpacing: '.03em' }}>
          <span aria-hidden style={{ marginRight: 3 }}>◆</span>{x.label}
        </span>
      ))}
    </span>
  );
}
/** The signed-in player's own badges, so a "You" bar can show them. */
export const SelfBadgeContext = createContext<BadgeInfo | null>(null);
export const useSelfBadge = () => useContext(SelfBadgeContext);
