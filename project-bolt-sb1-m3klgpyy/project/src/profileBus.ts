// A tiny hook-up so any list of names (leaderboards, friends...) can open a player's profile card
// without importing the App. The App registers the opener once.
let opener: ((name: string) => void) | null = null;
export function setProfileOpener(fn: ((name: string) => void) | null) { opener = fn; }
export function openProfile(name: string) { if (name && opener) opener(name); }
