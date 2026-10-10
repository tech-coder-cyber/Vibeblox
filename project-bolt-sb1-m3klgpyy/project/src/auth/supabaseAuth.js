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
    return { error: error ? error.message : null };
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
