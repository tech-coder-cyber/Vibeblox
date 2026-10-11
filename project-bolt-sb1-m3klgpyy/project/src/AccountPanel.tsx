// Your account: see who you are signed in as, change your email and your password, and (for admins) open the Admin panel.
import { useContext, useEffect, useState, type FormEvent } from 'react';

type Info = { email: string | null; pendingEmail?: string | null; providers: string[]; error: string | null };
type Auth = typeof import('./auth/supabaseAuth');

const card = 'bg-[#121822] rounded-2xl border border-[#243044] p-6';
const input = 'w-full bg-[#05080c] border border-[#243044] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00e676]';
const btn = 'px-4 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold hover:brightness-110 active:scale-95 disabled:opacity-40';

export type AccountSummary = { username: string; signedIn: boolean; isOwner: boolean; isAdmin: boolean; openAdmin: () => void; /** already inside the Admin panel: no button to open it */ inPanel?: boolean };

export default function AccountPanel({ summary }: { summary: AccountSummary }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!summary.signedIn) return;
    let dead = false;
    import('./auth/supabaseAuth').then(async (A) => {
      if (dead) return;
      setAuth(A);
      const i = await A.getAccountInfo();
      if (!dead) setInfo(i as Info);
    }).catch(() => { if (!dead) setInfo({ email: null, providers: [], error: "Couldn't reach the sign-in service." }); });
    return () => { dead = true; };
  }, [summary.signedIn]);

  if (!summary.signedIn) {
    return (
      <section className={card} data-testid="account-signed-out">
        <h2 className="text-white text-sm font-medium mb-1">Account</h2>
        <p className="text-[#8ea0b8] text-xs">You are playing as a guest. Sign in from the Social tab on the home screen to use friends, ranks and your own account settings.</p>
      </section>
    );
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!auth || busy) return;
    setBusy(true); setEmailMsg(null);
    const r = await auth.changeEmail(newEmail);
    setBusy(false);
    if (r.error) { setEmailMsg({ ok: false, text: r.error }); return; }
    setEmailMsg({ ok: true, text: 'Check your inbox: we sent a confirmation link to the new address. Your email changes once you open it.' });
    setNewEmail('');
  }
  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (!auth || busy) return;
    if (pw1 !== pw2) { setPwMsg({ ok: false, text: 'The two passwords do not match.' }); return; }
    setBusy(true); setPwMsg(null);
    const r = await auth.changePassword(pw1);
    setBusy(false);
    if (r.error) { setPwMsg({ ok: false, text: r.error }); return; }
    setPwMsg({ ok: true, text: 'Password changed. Use the new one next time you sign in.' });
    setPw1(''); setPw2('');
  }
  const note = (m: { ok: boolean; text: string } | null) => m && (
    <p className={`text-xs mt-2 ${m.ok ? 'text-[#9ff0c4]' : 'text-red-300'}`} data-testid="account-msg">{m.text}</p>
  );
  const google = info?.providers.includes('google');

  return (
    <div className="flex flex-col gap-6" data-testid="account-panel">
      <section className={card}>
        <h2 className="text-white text-sm font-medium mb-3">Signed in</h2>
        <div className="text-xs text-[#8ea0b8] leading-6">
          <div>Username: <span className="text-white font-medium" data-testid="account-username">{summary.username}</span>
            {summary.isOwner && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#ffd700] text-[#0a0e14] text-[10px] font-bold">OWNER</span>}
            {!summary.isOwner && summary.isAdmin && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#ffd700]/20 text-[#ffd700] text-[10px] font-bold">ADMIN</span>}
          </div>
          <div>Email: <span className="text-white" data-testid="account-email">{info ? (info.email ?? 'unknown') : 'loading…'}</span>
            {info?.pendingEmail && <span className="text-[#ffb347]"> (waiting for you to confirm {info.pendingEmail})</span>}
          </div>
          {!!info?.providers.length && <div>Sign-in method: {info.providers.join(', ')}</div>}
        </div>
        {summary.isAdmin && summary.inPanel ? null : summary.isAdmin
          ? <button className={`${btn} mt-3`} onClick={summary.openAdmin} data-testid="open-admin">Open the Admin panel</button>
          : <p className="text-[#5a6b80] text-[11px] mt-3">The Admin panel is for the owner and admins. The owner signs in as Master_at_Pvp.</p>}
      </section>

      <section className={card}>
        <h2 className="text-white text-sm font-medium mb-1">Change email</h2>
        <p className="text-[#5a6b80] text-xs mb-3">We send a confirmation link to the new address. {google ? 'This account signs in with Google; the new email is used for notices only.' : ''}</p>
        <form noValidate onSubmit={submitEmail} className="flex gap-2">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" data-testid="new-email" onKeyDown={(e) => e.stopPropagation()} className={input} />
          <button className={btn} disabled={busy || !newEmail.trim()} data-testid="change-email">Change</button>
        </form>
        {note(emailMsg)}
      </section>

      <section className={card}>
        <h2 className="text-white text-sm font-medium mb-1">Change password</h2>
        <p className="text-[#5a6b80] text-xs mb-3">At least 6 characters. {google ? 'Setting a password lets you sign in with your email too.' : ''}</p>
        <form noValidate onSubmit={submitPassword} className="flex flex-col gap-2">
          <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="New password" data-testid="new-password" autoComplete="new-password" onKeyDown={(e) => e.stopPropagation()} className={input} />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" data-testid="new-password2" autoComplete="new-password" onKeyDown={(e) => e.stopPropagation()} className={input} />
          <div><button className={btn} disabled={busy || !pw1} data-testid="change-password">Change password</button></div>
        </form>
        {note(pwMsg)}
      </section>
    </div>
  );
}

/** Settings → Account needs to know who you are; App provides it through this. */
import { createContext } from 'react';
export const AccountSummaryContext = createContext<AccountSummary>({ username: '', signedIn: false, isOwner: false, isAdmin: false, openAdmin: () => undefined });
export function AccountTab() {
  const s = useContext(AccountSummaryContext);
  return <AccountPanel summary={s} />;
}
