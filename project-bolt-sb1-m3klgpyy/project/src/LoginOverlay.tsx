import { useState, useEffect, type FormEvent } from 'react';
import { Mail, Lock, User, Gamepad2, Chrome, Loader2 } from 'lucide-react';
import { signInWithGoogle, registerWithEmail, initializeGuestAccount, supabase } from './auth/supabaseAuth';

type LoginOverlayProps = {
  onAuthed: (username: string) => void;
};

export default function LoginOverlay({ onAuthed }: LoginOverlayProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name = (session.user.user_metadata as { username?: string })?.username
          ?? session.user.email?.split('@')[0]
          ?? 'Player';
        onAuthed(name);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [onAuthed]);

  async function handleGoogle() {
    setError('');
    setLoading(true);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err);
      setLoading(false);
    }
    // On success the browser redirects — no need to setLoading(false)
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    const { error: err } = await registerWithEmail(email.trim(), password, username.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo('Account created! Check your email for a verification link, then sign in.');
  }

  function handleGuest() {
    const { guestId } = initializeGuestAccount();
    onAuthed(guestId.replace('guest-', 'Guest_'));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md mx-4 bg-[#121822] rounded-2xl border border-[#243044] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-8 pb-2 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00e676]/15 mb-3">
            <Gamepad2 className="w-7 h-7 text-[#00e676]" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to VibeBlox</h2>
          <p className="text-[#8ea0b8] text-sm mt-1.5">Sign in to save your progress, or play as a guest.</p>
        </div>

        {/* Body */}
        <div className="px-6 pb-8 pt-4 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-red-400 text-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg bg-[#00e676]/10 border border-[#00e676]/30 px-4 py-2.5 text-[#00e676] text-sm">
              {info}
            </div>
          )}

          {!showEmailForm ? (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white text-[#0a0e14] font-semibold text-sm transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5" />}
                Sign in with Google
              </button>

              <button
                onClick={() => { setShowEmailForm(true); setError(''); setInfo(''); }}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[#1a2230] border border-[#243044] text-white font-semibold text-sm transition-all hover:bg-[#243044] active:scale-[0.98]"
              >
                <Mail className="w-5 h-5 text-[#00e676]" />
                Create Email Account
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#243044]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-[#121822] text-[#5a6b80] text-xs">or</span>
                </div>
              </div>

              <button
                onClick={handleGuest}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-transparent border border-[#243044] text-[#8ea0b8] font-medium text-sm transition-all hover:text-white hover:border-[#3a4a60] active:scale-[0.98]"
              >
                <Gamepad2 className="w-5 h-5" />
                Play as Guest
              </button>
            </>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6b80]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl pl-10 pr-3 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none transition-colors"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6b80]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl pl-10 pr-3 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none transition-colors"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6b80]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 characters)"
                  className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl pl-10 pr-3 py-3 text-white text-sm placeholder:text-[#5a6b80] focus:border-[#00e676]/50 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm transition-all hover:bg-[#00e676]/90 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CREATE ACCOUNT'}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmailForm(false); setError(''); setInfo(''); }}
                className="w-full text-center text-[#5a6b80] text-xs hover:text-[#8ea0b8] transition-colors"
              >
                Back to sign-in options
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
