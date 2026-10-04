// src/auth/supabaseAuth.js
// VibeBlox authentication helper — connects to Supabase using the project keys.
// Uses an ESM CDN import so it runs natively in the browser without npm bundling.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = 'https://okhtosecqytklgwouwxv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kyklbTdQk64bRSdGSrEX0w_1lKAD4X0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Sign in with Google using Supabase OAuth.
 * Redirects the browser to Google's account picker screen.
 * @returns {Promise<{ error: string | null }>}
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Force Supabase to drop players off back at your live custom domain!
      redirectTo: 'https://vibeblox-jnb.pages.dev/',
    },
  });
  if (error) {
    return { error: error.message };
  }
  return { error: null };
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
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }
  if (!email.includes('@')) {
    return { error: 'Please enter a valid email address.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
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

  guestId = 'guest-' + crypto.randomUUID();
  try {
    localStorage.setItem(GUEST_KEY, guestId);
  } catch {
    // localStorage might be unavailable (private mode, etc.) — the in-memory ID still works
  }

  return { guestId };
}
