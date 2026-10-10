// Keeps track of who is signed in. The sign-in library loads in the background; if it can't (offline, blocked),
// the game simply behaves as if nobody is signed in.
import { useEffect, useRef, useState } from 'react';
import { configureSocial, loadAccount, checkAdmin, type Account } from './social';

type Session = { access_token: string; user: { id: string; email?: string; user_metadata?: { username?: string } } };

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  /** true once we know whether someone is signed in (so the sign-in window isn't shown by mistake) */
  const [checked, setChecked] = useState(false);
  const [admin, setAdmin] = useState(false);
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
          const isAdmin = await checkAdmin().catch(() => false);
          if (!dead) setAdmin(isAdmin);
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

  return { account, admin, checked, signOut, tokenRef };
}
