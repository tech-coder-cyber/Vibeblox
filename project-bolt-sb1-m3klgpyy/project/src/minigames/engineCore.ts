// What the engine worker does for the screens. The same code runs on the main thread if workers are not available.
import { Game, Position } from './chess/rules';
import { Searcher } from './chess/engine';
import { chessBot, chooseBotMove } from './chess/bots';
import { CheckersSearcher } from './checkers/engine';
import { Checkers, CheckersGame, type Move as CkMove } from './checkers/rules';
import { checkersBot, chooseCheckersMove } from './checkers/bots';

export type EngineRequest =
  | { type: 'chessBot'; botId: string; startFen: string; moves: string[] }
  | { type: 'lines'; fen: string; n: number; depth: number; timeMs: number }
  | { type: 'checkersBot'; botId: string; moves: string[] }
  | { type: 'checkersHint'; moves: string[]; depth: number; timeMs: number }
  | { type: 'newGame' };
export type EngineReply =
  | { type: 'chessBot'; uci: string; score: number; book: boolean }
  | { type: 'lines'; lines: Array<{ move: number; score: number; pv: number[] }> }
  | { type: 'checkersBot'; text: string | null }
  | { type: 'checkersHint'; text: string | null; score: number }
  | { type: 'ok' };

const chess = new Searcher(), analysis = new Searcher(), checkers = new CheckersSearcher();

export function handle(req: EngineRequest): EngineReply {
  switch (req.type) {
    case 'newGame': chess.newGame(); checkers.newGame(); return { type: 'ok' };
    case 'chessBot': {
      const g = Game.fromMoves(req.moves, req.startFen).game;
      const r = chooseBotMove(chessBot(req.botId), g, chess);
      return { type: 'chessBot', uci: r.move ? g.pos.uci(r.move) : '', score: r.score, book: r.book };
    }
    case 'lines': return { type: 'lines', lines: analysis.analyze(Position.fromFen(req.fen), req.n, { depth: req.depth, timeMs: req.timeMs }) };
    case 'checkersBot': {
      const g = new CheckersGame();
      for (const m of req.moves) g.play(m);
      const mv = chooseCheckersMove(checkersBot(req.botId), g, checkers);
      return { type: 'checkersBot', text: mv ? g.pos.notation(mv) : null };
    }
    case 'checkersHint': {
      const g = new CheckersGame();
      for (const m of req.moves) g.play(m);
      const list = checkers.scoreMoves(g.pos, req.depth, req.timeMs);
      return { type: 'checkersHint', text: list[0] ? g.pos.notation(list[0].move) : null, score: list[0]?.score ?? 0 };
    }
  }
}
void Checkers; export type { CkMove };
