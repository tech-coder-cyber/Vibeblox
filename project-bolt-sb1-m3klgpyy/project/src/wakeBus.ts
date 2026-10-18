// A tiny hook-up so the Servers page can wake a sleeping world (a world whose host left) without importing the App.
// The App registers the waker once; it gives back an error message, or null when the world is starting.
let waker: ((id: string) => Promise<string | null>) | null = null;
export function setWorldWaker(fn: ((id: string) => Promise<string | null>) | null) { waker = fn; }
export async function wakeWorld(id: string): Promise<string | null> { return waker ? waker(id) : 'This copy of the game cannot wake worlds.'; }
