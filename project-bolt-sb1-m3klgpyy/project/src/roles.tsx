// Server roles: what a world's owner can hand out to players, for that world only (not VibeBlox staff).
//   Admin    (helmet): ban and kick players in this world, and use cheats (commands).
//   Co-owner (crown):  everything an admin can, plus change the rules, use schematics, set up anti-cheat,
//                      and promote players to admin.
//   Owner    (king's crown): the world's owner. Only the owner makes co-owners.
// The icons show in the player list (Tab, or LIST on a phone), nowhere else.

export type ServerRole = 'owner' | 'coowner' | 'admin';
/** Who may run scripts in a world: nobody, everyone, admins and up, or only the owner and co-owners. */
export type ScriptPerm = 'off' | 'all' | 'admin' | 'owner';
export const ROLE_LABELS: Record<ServerRole, string> = { owner: 'Owner', coowner: 'Co-owner', admin: 'Admin' };
export const SCRIPT_PERM_LABELS: Record<ScriptPerm, string> = { off: 'Off', all: 'Everyone', admin: 'Admins', owner: 'Owner only' };

export function roleLevel(r: ServerRole | null | undefined): number {
  return r === 'owner' ? 3 : r === 'coowner' ? 2 : r === 'admin' ? 1 : 0;
}
export const isRole = (v: unknown): v is 'admin' | 'coowner' => v === 'admin' || v === 'coowner';

/** May `by` give `target` (who now has `current`) the role `to` ('none' takes it away)? */
export function canSetRole(by: ServerRole | null | undefined, current: ServerRole | null | undefined, to: 'admin' | 'coowner' | 'none'): boolean {
  if (current === 'owner') return false;
  if (by === 'owner') return true;
  if (by === 'coowner') return to !== 'coowner' && current !== 'coowner'; // co-owners promote to admin (and take admin away), never make co-owners
  return false;
}
/** May `by` kick or ban someone with `target`'s role? (Only people below you.) */
export const canModerate = (by: ServerRole | null | undefined, target: ServerRole | null | undefined) => roleLevel(by) >= 1 && roleLevel(by) > roleLevel(target);
/** Rules, schematics and anti-cheat */
export const canManage = (r: ServerRole | null | undefined) => roleLevel(r) >= 2;
/** Cheats: commands like /give, /gamemode and /tp */
export const canCheat = (r: ServerRole | null | undefined) => roleLevel(r) >= 1;
export function canRunScripts(perm: ScriptPerm | undefined, scriptsOn: boolean, r: ServerRole | null | undefined): boolean {
  if (!scriptsOn || perm === 'off') return false;
  if (perm === 'all') return true;
  if (perm === 'admin') return roleLevel(r) >= 1;
  return roleLevel(r) >= 2; // 'owner' (and the default for worlds from before Indev 27, where only the owner used scripts)
}

/** A small picture: a knight's helmet (admin), a crown (co-owner) or a king's crown with jewels (owner). */
export function RoleIcon({ role, size = 14 }: { role: ServerRole | null | undefined; size?: number }) {
  if (!role) return null;
  const common = { width: size, height: size, viewBox: '0 0 16 16', className: 'inline-block align-[-2px] mr-1 shrink-0', 'data-testid': `role-${role}`, 'aria-label': ROLE_LABELS[role] } as const;
  if (role === 'admin') {
    return (
      <svg {...common}><title>{ROLE_LABELS[role]}</title>
        <path d="M3 9V7a5 5 0 0 1 10 0v2l-1 4H4z" fill="#b8c4d2" stroke="#2a3340" strokeWidth="1" />
        <rect x="4" y="8" width="8" height="1.6" fill="#2a3340" />
        <rect x="7.3" y="2" width="1.4" height="6" fill="#8a96a5" />
      </svg>
    );
  }
  if (role === 'coowner') {
    return (
      <svg {...common}><title>{ROLE_LABELS[role]}</title>
        <path d="M2 12L3 5l3 3 2-4 2 4 3-3 1 7z" fill="#d6dde6" stroke="#4a5462" strokeWidth="1" strokeLinejoin="round" />
        <rect x="2.5" y="11.5" width="11" height="2" fill="#aeb8c4" stroke="#4a5462" strokeWidth="0.8" />
      </svg>
    );
  }
  return (
    <svg {...common}><title>{ROLE_LABELS[role]}</title>
      <path d="M1.5 12L2.5 4l3.2 3.4L8 2.5l2.3 4.9L13.5 4l1 8z" fill="#ffd23a" stroke="#8a5a00" strokeWidth="1" strokeLinejoin="round" />
      <rect x="2" y="11.5" width="12" height="2.3" fill="#f2b300" stroke="#8a5a00" strokeWidth="0.8" />
      <circle cx="8" cy="8.6" r="1.2" fill="#ff3b5c" />
      <circle cx="4.6" cy="9.4" r="0.8" fill="#3b8bff" />
      <circle cx="11.4" cy="9.4" r="0.8" fill="#3bdc7a" />
    </svg>
  );
}
