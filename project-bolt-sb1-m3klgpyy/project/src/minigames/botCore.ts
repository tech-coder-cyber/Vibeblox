// Shared by the chess and checkers bots: tiers, who may play which bot, and what bots say in their chat.

export type Tier = 'beginner' | 'intermediate' | 'advanced' | 'master';
export const TIERS: Tier[] = ['beginner', 'intermediate', 'advanced', 'master'];
export const TIER_NAMES: Record<Tier, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', master: 'Master' };

export type BotInfo = {
  id: string; name: string; rating: number; tier: Tier;
  /** shown as the bot's picture */ emoji: string; color: string;
  voice: VoiceId; bio: string;
};

/** Bots you can play for each rank. A tier lists its bots from easiest to hardest; this many of them are open to you. Elite and Champion play them all. */
export const BOTS_OPEN: Record<string, number> = { none: 3, vanguard: 5, elite: 99, champion: 99 };
export const botsOpen = (rank: string | null | undefined): number => BOTS_OPEN[rank ?? 'none'] ?? BOTS_OPEN.none;
/** Is bot number `index` (0 = the easiest in its tier) open to this rank? */
export const botUnlocked = (index: number, rank: string | null | undefined): boolean => index < botsOpen(rank);
export const botsByTier = <T extends BotInfo>(all: T[], tier: Tier): T[] => all.filter((b) => b.tier === tier).sort((a, b) => a.rating - b.rating);
export function botIndexInTier<T extends BotInfo>(all: T[], bot: T): number { return botsByTier(all, bot.tier).findIndex((b) => b.id === bot.id); }

// ---------- bot chat ----------
export type ChatEvent = 'start' | 'capture' | 'lostPiece' | 'check' | 'winning' | 'trouble' | 'win' | 'lose' | 'draw' | 'hint' | 'takeback' | 'drawDeclined' | 'drawAccepted';
export type VoiceId = 'cheerful' | 'sleepy' | 'grumpy' | 'formal' | 'cocky' | 'shy' | 'nerdy' | 'pirate' | 'coach' | 'robot';

const V = (o: Record<ChatEvent, string[]>) => o;
export const VOICES: Record<VoiceId, Record<ChatEvent, string[]>> = {
  cheerful: V({
    start: ["Hi! Let's have a fun game!", "Ooh, a new game! Good luck!", "Ready when you are!"],
    capture: ["Got one!", "Yum, a piece!", "Thank you!"], lostPiece: ["Oops!", "Hey, I needed that one!", "Nice grab!"],
    check: ["Check!", "Peekaboo, your king!", "Watch out!"], winning: ["I think I'm doing great!", "This is going well!", "Wow, look at me go!"],
    trouble: ["Uh oh...", "That looks scary.", "I'm in trouble, aren't I?"], win: ["I won! Good game!", "Yay! Want to play again?", "That was fun, thanks!"],
    lose: ["You got me! Well played!", "Wow, you're good!", "Congrats! I'll practice more!"], draw: ["A draw! Not bad!", "Nobody wins, everybody smiles."],
    hint: ["Is somebody peeking at hints?", "A little help, huh?"], takeback: ["Taking a move back? Sure!", "No problem, try again."],
    drawDeclined: ["Let's keep playing!", "Not yet, I'm having fun!"], drawAccepted: ["Okay, a draw it is!", "Deal! Good game."],
  }),
  sleepy: V({
    start: ["*yawn* Oh, hello...", "Is it my move already?", "Let's play... slowly."],
    capture: ["Oh... I took something.", "Mmm, a piece.", "Was that allowed? Yes."], lostPiece: ["Hm, where did it go?", "Zzz... oh, you took it.", "Fine, fine."],
    check: ["Check... I think.", "Your king looks sleepy too."], winning: ["Hm, this is nice.", "I might be winning? Oh well."],
    trouble: ["Wait, I'm awake now.", "Hmm, that's not good."], win: ["I won? Great, now a nap.", "Good game... zzz."],
    lose: ["You win. Time for a nap.", "Well played... *yawn*"], draw: ["A draw. Sleepy enough for me."],
    hint: ["Shh, I won't tell."], takeback: ["Go ahead, take your time."], drawDeclined: ["Mmm, nope.", "Maybe after a nap."], drawAccepted: ["Draw. Good. Naptime."],
  }),
  grumpy: V({
    start: ["Let's get this over with.", "Don't make it boring.", "Fine. Play."],
    capture: ["Mine.", "That's what you get.", "Ha."], lostPiece: ["Lucky.", "Hmph.", "Don't get used to it."],
    check: ["Check. Deal with it.", "Your king, again."], winning: ["Told you.", "This is easy."],
    trouble: ["Hm. Not bad. Annoying.", "I did not plan that."], win: ["Obviously.", "Better luck next time. Or not."],
    lose: ["Hmph. You got lucky.", "Fine. One win.", "Rematch. Now."], draw: ["A draw? Boring.", "Meh."],
    hint: ["Cheating isn't pretty.", "Hints? Tsk."], takeback: ["Taking it back? Weak.", "Whatever."], drawDeclined: ["No.", "I'm not done with you."], drawAccepted: ["Fine, a draw."],
  }),
  formal: V({
    start: ["Good day. I wish you a fine game.", "Shall we begin?", "A pleasure to play with you."],
    capture: ["I shall take that, if I may.", "An exchange is in order."], lostPiece: ["A well-judged capture.", "Most astute."],
    check: ["Your king is in check.", "Check, with respect."], winning: ["My position is rather pleasant.", "Things proceed as planned."],
    trouble: ["A difficult position indeed.", "You press me hard."], win: ["A fine game. Thank you.", "Good game. You played with dignity."],
    lose: ["Congratulations. Excellent play.", "I yield. Well done."], draw: ["A fair result.", "We are well matched."],
    hint: ["A little guidance is no disgrace."], takeback: ["Of course. Reconsider as you wish."], drawDeclined: ["I must decline with thanks.", "Let us play on."], drawAccepted: ["I accept the draw gladly."],
  }),
  cocky: V({
    start: ["Ready to lose?", "This'll be quick.", "Try to keep up."],
    capture: ["Too easy.", "Thanks for the gift!", "Boom."], lostPiece: ["Lucky shot.", "Enjoy it while it lasts.", "I let you."],
    check: ["Check! Scared yet?", "Your king is in trouble."], winning: ["Did you think you'd win?", "I'm just getting started."],
    trouble: ["Okay, that was a good one.", "I'm just letting you feel good."], win: ["GG. Not even close.", "Another victim."],
    lose: ["What? How?!", "Lucky. Run it back!"], draw: ["A draw? I was being nice.", "Fine, you got a draw."],
    hint: ["Need help already?", "Hints? Cute."], takeback: ["Take it back, it won't help.", "Sure, go ahead."], drawDeclined: ["No way, I'm winning.", "Nah."], drawAccepted: ["Okay, you can have the draw."],
  }),
  shy: V({
    start: ["H-hi... good luck.", "I'll try my best...", "Um, hello."],
    capture: ["Oh! Sorry!", "I... took it. Sorry."], lostPiece: ["Oh no.", "That's okay, I guess.", "You're good at this."],
    check: ["Um... check. Sorry.", "Check... sorry!"], winning: ["I think I'm... doing okay?", "Is this going well?"],
    trouble: ["Eep.", "I don't like this."], win: ["I won? Wow, thank you!", "Um, good game."],
    lose: ["You won. Congratulations!", "That was great."], draw: ["A draw. Good enough!"],
    hint: ["It's okay to ask for help."], takeback: ["Sure, take it back."], drawDeclined: ["Um... let's keep going?", "I'd like to keep playing."], drawAccepted: ["Okay! A draw."],
  }),
  nerdy: V({
    start: ["According to my calculations, this will be fun.", "Hello! Fun fact: there are more chess games than atoms.", "Let's explore the board."],
    capture: ["Material gained.", "That's a +3.", "Per theory, I should capture."], lostPiece: ["Hm, unexpected.", "Interesting. I'll note that.", "A fine tactic."],
    check: ["Check! Technically.", "Your king has few options."], winning: ["The evaluation is in my favor.", "Statistically I'm better."],
    trouble: ["Hmm, the evaluation dropped.", "Time to recalculate."], win: ["As predicted.", "Good game! Let's review it."],
    lose: ["Fascinating. You win.", "I'll add this to my notes."], draw: ["Balanced, as all things should be."],
    hint: ["Using the engine, I see."], takeback: ["Undo accepted."], drawDeclined: ["The numbers say play on.", "Declined, based on the eval."], drawAccepted: ["The evaluation is equal. Agreed."],
  }),
  pirate: V({
    start: ["Ahoy! Prepare for battle!", "Yarr, let the game begin!", "Aye, a worthy opponent!"],
    capture: ["Plunder!", "Yarr, mine now!", "Avast, another prize!"], lostPiece: ["Ye scurvy dog!", "Arr, ye got me!"],
    check: ["Check, matey!", "Your king walks the plank!"], winning: ["The treasure be mine!", "Smooth sailing!"],
    trouble: ["Rough seas ahead...", "Shiver me timbers!"], win: ["Yo ho ho, victory!", "Hoist the flag, I win!"],
    lose: ["Ye win, ye sea-dog!", "Davy Jones takes me..."], draw: ["Neither sinks. Fair winds."],
    hint: ["A map to the treasure, eh?"], takeback: ["Back ye go, then!"], drawDeclined: ["Nay, we fight on!"], drawAccepted: ["A truce, then!"],
  }),
  coach: V({
    start: ["Good luck! Think about your center.", "Let's play. Develop your pieces!", "Remember: knights before bishops, castle early."],
    capture: ["A trade is fine if it helps development.", "I took that, check your pieces."], lostPiece: ["Good capture!", "Nicely spotted."],
    check: ["Check! Can you spot the safe squares?", "Check. Block, capture or move."], winning: ["Keep your pieces protected.", "Stay focused, it's a long game."],
    trouble: ["Good pressure!", "You're making good progress."], win: ["Good effort! Review the game and learn.", "Good game. Let's look at where the turning point was."],
    lose: ["Excellent, you earned it!", "Well played. You're improving."], draw: ["A draw is a fine result."],
    hint: ["It's fine to ask for hints, it helps you learn."], takeback: ["Learning from mistakes is how you improve."], drawDeclined: ["Let's try to find a win!"], drawAccepted: ["Sure. Good job."],
  }),
  robot: V({
    start: ["INITIALIZING GAME. BEEP.", "HELLO, HUMAN.", "SYSTEM READY. PLAY."],
    capture: ["CAPTURE COMPLETE.", "MATERIAL ACQUIRED.", "BEEP BOOP."], lostPiece: ["ERROR: PIECE LOST.", "UNEXPECTED. RECALCULATING."],
    check: ["CHECK DETECTED.", "KING THREAT. BEEP."], winning: ["PROBABILITY OF VICTORY: HIGH.", "ALL SYSTEMS NOMINAL."],
    trouble: ["WARNING. POSITION UNSTABLE.", "RECALCULATING..."], win: ["VICTORY ACHIEVED. BEEP.", "GAME OVER. I WIN."],
    lose: ["DEFEAT ACKNOWLEDGED.", "ERROR: YOU WIN. WELL DONE."], draw: ["DRAW. NO WINNER DETECTED."],
    hint: ["HINT REQUEST DETECTED."], takeback: ["UNDO EXECUTED."], drawDeclined: ["DRAW REQUEST DENIED.", "NEGATIVE."], drawAccepted: ["DRAW ACCEPTED. BEEP."],
  }),
};

/** A line from a voice for an event (random). */
export function botSays(voice: VoiceId, event: ChatEvent, rand: () => number = Math.random): string {
  const list = VOICES[voice]?.[event] ?? [];
  return list.length ? list[Math.floor(rand() * list.length)] : '';
}
