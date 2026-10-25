// src/auth/supabaseAuth.js
// VibeBlox authentication helper — connects to Supabase using the project keys.
// The Supabase library is loaded from an ESM CDN the first time it is needed (never at start-up), so the game
// still opens if the CDN is slow or blocked; only signing in is unavailable then.

const SUPABASE_URL = 'https://okhtosecqytklgwouwxv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kyklbTdQk64bRSdGSrEX0w_1lKAD4X0';
const SUPABASE_CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4';

let clientPromise = null;

/** The Supabase client (created once). Rejects if the library could not be loaded. */
export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ SUPABASE_CDN)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }))
      .catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

const OFFLINE = "Couldn't reach the sign-in service. Check your connection and try again.";

/** The page the player should come back to after Google sign-in: wherever the game is running now. */
function returnUrl() {
  try { return window.location.origin + '/'; } catch { return undefined; }
}

/**
 * Sign in with Google using Supabase OAuth.
 * Redirects the browser to Google's account picker screen.
 * @returns {Promise<{ error: string | null }>}
 */
export async function signInWithGoogle() {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Come back to the site that's open right now (the live domain, a preview, or localhost)
      options: { redirectTo: returnUrl() },
    });
    return { error: error ? error.message : null };
  } catch {
    return { error: OFFLINE };
  }
}

/**
 * Register a new user with email + password.
 * Supabase automatically sends a verification email.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} username
 * @returns {Promise<{ error: string | null }>}
 */
export async function registerWithEmail(email, password, username) {
  if (!email || !password || !username) {
    return { error: 'All fields are required.' };
  }
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    return { error: 'Usernames are 3-16 letters, numbers or underscores.' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }
  if (!email.includes('@')) {
    return { error: 'Please enter a valid email address.' };
  }
  try {
    const supabase = await getSupabase();
    const { data: taken } = await supabase.from('profiles').select('id').ilike('username', username).limit(1);
    // Only accounts that verified their email hold a username, so this only finds real owners of the name
    if (taken && taken.length) return { error: 'That username is already taken.' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: returnUrl() },
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: OFFLINE };
  }
}

/**
 * Sign in with an email and password.
 * @returns {Promise<{ error: string | null }>}
 */
export async function signInWithEmail(email, password) {
  if (!email || !password) return { error: 'Type your email and password.' };
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && /not confirmed|confirm/i.test(error.message)) {
      return { error: 'Verify your email first: open the link we sent you, then sign in. You can\'t play with this account until it is verified.' };
    }
    return { error: error ? error.message : null };
  } catch {
    return { error: OFFLINE };
  }
}

/**
 * Start a session from tokens that our own server made (CrazyGames players are logged in this way, see src/crazygames.ts).
 * @returns {Promise<{ error: string | null }>}
 */
export async function signInWithTokens(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) return { error: 'No session.' };
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { error: error ? error.message : null };
  } catch {
    return { error: OFFLINE };
  }
}

/** Who is signed in: their email and how they signed in. */
export async function getAccountInfo() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data || !data.user) return { error: error ? error.message : 'Not signed in.', email: null, providers: [] };
    const u = data.user;
    const providers = (u.app_metadata && u.app_metadata.providers) || (u.app_metadata && u.app_metadata.provider ? [u.app_metadata.provider] : []);
    return { error: null, email: u.email || null, pendingEmail: u.new_email || null, providers };
  } catch {
    return { error: OFFLINE, email: null, providers: [] };
  }
}

/** Change the email address. Supabase emails a link to confirm the new address. */
export async function changeEmail(newEmail) {
  const email = String(newEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address.' };
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: returnUrl() });
    return { error: error ? error.message : null };
  } catch {
    return { error: OFFLINE };
  }
}

/** Change the password of the signed-in account. */
export async function changePassword(newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < 6) return { error: 'Password must be at least 6 characters.' };
  if (newPassword.length > 72) return { error: 'That password is too long (72 characters at most).' };
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  } catch {
    return { error: OFFLINE };
  }
}

/** Email a password reset link (for when you forgot it). */
export async function sendPasswordReset(email) {
  const e = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'Type the email address of your account.' };
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: returnUrl() });
    return { error: error ? error.message : null };
  } catch {
    return { error: OFFLINE };
  }
}

/** Delete the signed-in account for good (profile, friends, messages and so on go with it). Needs server/vibeblox_indev27_1.sql. */
export async function deleteAccount() {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      if (/delete_my_account|schema cache|does not exist/i.test(error.message)) return { error: 'Deleting accounts is not set up on the server yet (run vibeblox_indev27_1.sql in Supabase).' };
      return { error: error.message };
    }
    try { await supabase.auth.signOut(); } catch { /* the account is gone anyway */ }
    return { error: null };
  } catch {
    return { error: OFFLINE };
  }
}

export async function signOutAccount() {
  try {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  } catch { /* already signed out, or offline */ }
}

/** Calls back with the current session now and whenever it changes. Returns a function that stops listening. */
export function watchSession(callback) {
  let stop = () => {};
  let dead = false;
  getSupabase().then(async (supabase) => {
    if (dead) return;
    const { data } = await supabase.auth.getSession();
    if (!dead) callback(data.session ?? null);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { if (!dead) callback(session ?? null); });
    stop = () => sub.subscription.unsubscribe();
    if (dead) stop();
  }).catch(() => { if (!dead) callback(null, true); });
  return () => { dead = true; stop(); };
}

/**
 * Generate a temporary guest ID and save it to localStorage.
 * Used when a player chooses to play without creating an account.
 *
 * @returns {{ guestId: string }}
 */
export function initializeGuestAccount() {
  const GUEST_KEY = 'vibeblox_guest_id';

  let guestId;
  try {
    guestId = localStorage.getItem(GUEST_KEY);
  } catch {
    guestId = null;
  }

  if (guestId) {
    return { guestId };
  }

  guestId = 'guest-' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 8) : Math.random().toString(36).slice(2, 10));
  try {
    localStorage.setItem(GUEST_KEY, guestId);
  } catch {
    // localStorage might be unavailable (private mode, etc.) — the in-memory ID still works
  }

  return { guestId };
}
