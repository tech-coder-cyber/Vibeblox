// The big greeting on the Home page. It used to say "Welcome back! <name>!" every time; now it rotates.
// {name} is where the player's name goes. Only used for English; other languages keep their translated greeting.

export const WELCOME_MESSAGES: string[] = [
  'Welcome back, {name}!',
  'Hey {name}, ready to build?',
  "Good to see you, {name}!",
  "Look who's here: {name}!",
  'Time to craft, {name}!',
  'The blocks missed you, {name}!',
  "Let's go, {name}!",
  'Another day, another build, {name}!',
  'Creepers beware, {name} is here!',
  'Back for more, {name}?',
  'Hello there, {name}!',
  'What are we building today, {name}?',
  'Your world is waiting, {name}!',
  'Pickaxe ready, {name}?',
  'Great to have you back, {name}!',
  'Gear up, {name}!',
  'Ready to explore, {name}?',
  'The server felt empty without you, {name}!',
  'Welcome to the blocks, {name}!',
  'Adventure awaits, {name}!',
];

/** Messages that depend on the time of day (hour 0-23). */
export function timeGreetings(hour: number): string[] {
  if (hour >= 5 && hour < 12) return ['Good morning, {name}!', 'Rise and mine, {name}!'];
  if (hour >= 12 && hour < 18) return ['Good afternoon, {name}!'];
  if (hour >= 18 && hour < 23) return ['Good evening, {name}!', 'Night is falling, watch for zombies, {name}!'];
  return ["Up late, {name}?", 'Midnight mining, {name}?'];
}

/** Picks one greeting. `rand` is 0..1 (injectable so it can be tested). */
export function pickWelcome(rand: number = Math.random(), hour: number = new Date().getHours()): string {
  const all = [...WELCOME_MESSAGES, ...timeGreetings(hour)];
  return all[Math.min(all.length - 1, Math.floor(rand * all.length))];
}

/** Splits a greeting into the text around the name: ['Hey ', ', ready to build?']. */
export function splitWelcome(msg: string): [string, string] {
  const i = msg.indexOf('{name}');
  if (i < 0) return [msg + ' ', ''];
  return [msg.slice(0, i), msg.slice(i + 6)];
}
