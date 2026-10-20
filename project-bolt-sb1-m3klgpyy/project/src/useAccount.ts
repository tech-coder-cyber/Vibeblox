// Keeps track of who is signed in. The sign-in library loads in the background; if it can't (offline, blocked),
// the game simply behaves as if nobody is signed in.
import { useEffect, useRef, useState } from 'react';
import { configureSocial, loadAccount, checkAdmin, fetchAdminPerms, isOwnerName, changeUsername, setUndercover, ADMIN_PERMS, type Account, type AdminPerm, type Result } from './social';

type Session = { access_token: string; user: { id: string; email?: string; user_metadata?: { username?: string } } };

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  /** true once we know whether someone is signed in (so the sign-in window isn't shown by mistake) */
  const [checked, setChecked] = useState(false);
  const [admin, setAdmin] = useState(false);
  /** What this admin may do (everything for the owner and for a full-access admin) */
  const [adminPerms, setAdminPerms] = useState<readonly AdminPerm[]>(ADMIN_PERMS);
  const tokenRef = useRef<string | null>(null);
  const accountRef = useRef<Account | null>(null);

  useEffect(() => {
    configureSocial({ getToken: async () => tokenRef.current });
    let dead = false;
    let stop = () => {};
    import('./auth/supabaseAuth')
      .then((A) => {
        if (dead) return;
        stop = A.watchSession(async (session: Session | null, failed?: boolean) => {
          if (dead) return;
          if (!session) {
            tokenRef.current = null;
            accountRef.current = null;
            setAccount(null);
            setAdmin(false);
            setAdminPerms(ADMIN_PERMS);
            setChecked(true);
            if (failed) return;
            return;
          }
          tokenRef.current = session.access_token;
          const prev = accountRef.current;
          if (prev && prev.userId === session.user.id) { // just a refreshed token
            const next = { ...prev, token: session.access_token };
            accountRef.current = next;
            setAccount(next);
            return;
          }
          const wanted = session.user.user_metadata?.username ?? session.user.email?.split('@')[0] ?? 'Player';
          const acc = await loadAccount(session.user.id, session.access_token, wanted);
          if (dead) return;
          accountRef.current = acc;
          setAccount(acc);
          setChecked(true);
          // the owner ("Master") can always open /panel; the database checks every action it takes
          const isAdmin = isOwnerName(acc.username) || await checkAdmin().catch(() => false);
          const perms = isAdmin && !isOwnerName(acc.username) ? await fetchAdminPerms().catch(() => null) : null;
          if (!dead) { setAdmin(isAdmin); setAdminPerms(perms ?? ADMIN_PERMS); } // an older database can't say: full access, like before
        });
      })
      .catch(() => { if (!dead) setChecked(true); });
    return () => { dead = true; stop(); };
  }, []);

  async function signOut() {
    const A = await import('./auth/supabaseAuth');
    await A.signOutAccount();
    tokenRef.current = null;
    accountRef.current = null;
    setAccount(null);
    setAdmin(false);
  }

  /** Changes the username (once a week). On success the signed-in account (and the name shown everywhere) updates. */
  async function rename(name: string) {
    const r = await changeUsername(name);
    if (r.ok && accountRef.current) {
      const next = { ...accountRef.current, username: r.username, nameChangedAt: new Date().toISOString() };
      accountRef.current = next;
      setAccount(next);
      setAdmin(isOwnerName(r.username) || await checkAdmin().catch(() => false));
    }
    return r;
  }

  /** [YOUTUBE] only: /undercover. Hides (or shows) your rank tags from everyone. */
  async function undercover(on: boolean): Promise<Result<{ on: boolean }>> {
    const r = await setUndercover(on);
    if (r.ok && accountRef.current) {
      const next = { ...accountRef.current, undercover: r.on };
      accountRef.current = next;
      setAccount(next);
    }
    return r;
  }

  return { account, admin, adminPerms, checked, signOut, rename, undercover, tokenRef };
}
