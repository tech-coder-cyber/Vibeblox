// Loyalty rewards: a free rank to choose from after your account is 1 month old, then every 2 months (months 1, 3, 5,
// 7, 9, 11), and a bigger one at 1 year (and every year after). The server (vibeblox_round18.sql) keeps count; this
// file works out what is due so the game can show it. Keep the maths the same as the SQL.
export type LoyaltyRank = 'vanguard' | 'elite' | 'champion';
export const LOYALTY_RANKS: LoyaltyRank[] = ['vanguard', 'elite', 'champion'];
/** Months 1, 3, 5, 7 ... and every 12th. */
export function isLoyaltyMilestone(m: number): boolean { return Number.isInteger(m) && m >= 1 && (m % 12 === 0 || m % 2 === 1); }
/** The 1 year rewards can't be skipped. */
export function isYearMilestone(m: number): boolean { return m % 12 === 0; }
/** How old the account has to be, in days (a month is 365/12 days, so month 12 is one year). */
export function loyaltyDays(m: number): number { return Math.round((m * 365) / 12); }
/** What each choice gives: hours (null: for good). */
export function loyaltyHours(m: number, rank: LoyaltyRank): number | null {
  const year = isYearMilestone(m);
  if (rank === 'vanguard') return year ? null : 7 * 24;
  if (rank === 'elite') return year ? 90 * 24 : 5 * 24;
  return year ? 30 * 24 : 3 * 24;
}
export function loyaltyLabel(m: number, rank: LoyaltyRank): string {
  const h = loyaltyHours(m, rank);
  const name = rank[0].toUpperCase() + rank.slice(1);
  if (h === null) return `${name} for good`;
  const days = h / 24;
  return days >= 60 && days % 30 === 0 ? `${name} for ${days / 30} months` : days === 30 ? `${name} for 1 month` : `${name} for ${days} days`;
}
/** The reward months that are due (account old enough) and not yet claimed, oldest first. */
export function pendingMilestones(createdAtMs: number, nowMs: number, claimed: number[]): number[] {
  const ageDays = (nowMs - createdAtMs) / 86_400_000;
  const out: number[] = [];
  for (let m = 1; m <= 600; m++) {
    if (loyaltyDays(m) > ageDays) break;
    if (isLoyaltyMilestone(m) && !claimed.includes(m)) out.push(m);
  }
  return out;
}
/** The next reward month still to come, and how many days away it is. */
export function nextMilestone(createdAtMs: number, nowMs: number, claimed: number[]): { month: number; inDays: number } {
  const ageDays = (nowMs - createdAtMs) / 86_400_000;
  for (let m = 1; m <= 600; m++) if (isLoyaltyMilestone(m) && loyaltyDays(m) > ageDays) return { month: m, inDays: Math.ceil(loyaltyDays(m) - ageDays) };
  void claimed;
  return { month: 600, inDays: 0 };
}
