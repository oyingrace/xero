/**
 * Tic-tac-toe rules + the computer opponent's move selection.
 *
 * The computer plays perfect minimax (depth-adjusted so it prefers a
 * faster win and a slower loss). The board is tiny — at most 8 empty
 * cells when the computer is ever asked to move — so an exhaustive
 * search is instant and, unlike heuristic shortcuts (win/block/fork/
 * block-fork rules), is mathematically guaranteed to never lose. An
 * earlier heuristic version of this file was proven beatable by a fuzz
 * test (random move sequence `[4, 8, 2, 6]`) before minimax replaced it —
 * see engine.test.ts for the regression coverage that caught it.
 *
 * `TicTacToe.sol` implements the same minimax on-chain; keep the two in
 * sync if either changes.
 */

export const EMPTY = 0;
export const PLAYER = 1; // X, moves first
export const COMPUTER = 2; // O, moves second

export type Mark = typeof EMPTY | typeof PLAYER | typeof COMPUTER;
export type Board = readonly Mark[]; // length 9

export type GameStatus = "active" | "player_won" | "computer_won" | "draw";

export const EMPTY_BOARD: Board = Array(9).fill(EMPTY);

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyCells(board: Board): number[] {
  const cells: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === EMPTY) cells.push(i);
  return cells;
}

export function isBoardFull(board: Board): boolean {
  return emptyCells(board).length === 0;
}

export function checkWinner(board: Board, mark: Mark): boolean {
  return LINES.some((line) => line.every((cell) => board[cell] === mark));
}

/** The three cells of `mark`'s winning line, for highlighting; null if no winner. */
export function findWinningLine(board: Board, mark: Mark): readonly [number, number, number] | null {
  return LINES.find((line) => line.every((cell) => board[cell] === mark)) ?? null;
}

export function getStatus(board: Board): GameStatus {
  if (checkWinner(board, PLAYER)) return "player_won";
  if (checkWinner(board, COMPUTER)) return "computer_won";
  if (isBoardFull(board)) return "draw";
  return "active";
}

/**
 * Depth-adjusted minimax score from the computer's perspective: a faster
 * computer win scores higher, a slower player win scores less negative,
 * so the computer both plays to win when it can and stalls losses that
 * are already forced (which never happens here, but keeps ties sane).
 * Alpha-beta pruning keeps this instant in a browser (and cheap if ever
 * ported to a gas-metered environment) without changing the result.
 */
function minimax(
  board: Board,
  isComputerTurn: boolean,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const status = getStatus(board);
  if (status === "computer_won") return 10 - depth;
  if (status === "player_won") return depth - 10;
  if (status === "draw") return 0;

  const mark = isComputerTurn ? COMPUTER : PLAYER;
  if (isComputerTurn) {
    let best = -Infinity;
    for (const cell of emptyCells(board)) {
      const next = board.slice() as Mark[];
      next[cell] = mark;
      best = Math.max(best, minimax(next, false, depth + 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const cell of emptyCells(board)) {
    const next = board.slice() as Mark[];
    next[cell] = mark;
    best = Math.min(best, minimax(next, true, depth + 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Picks the computer's (O's) next move against the current board.
 * Assumes it is the computer's turn and the game is still active.
 */
export function computeComputerMove(board: Board): number {
  const candidates = emptyCells(board);
  if (candidates.length === 0) throw new Error("computeComputerMove: board is full");

  let bestCell = candidates[0];
  let bestScore = -Infinity;
  for (const cell of candidates) {
    const next = board.slice() as Mark[];
    next[cell] = COMPUTER;
    const score = minimax(next, false, 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }
  return bestCell;
}

/** Applies a player move, then (if the game continues) the computer's reply. */
export function applyPlayerMove(
  board: Board,
  cell: number,
): { board: Board; status: GameStatus } {
  if (board[cell] !== EMPTY) throw new Error("applyPlayerMove: cell is occupied");

  const afterPlayer = board.slice() as Mark[];
  afterPlayer[cell] = PLAYER;

  let status = getStatus(afterPlayer);
  if (status !== "active") return { board: afterPlayer, status };

  const computerCell = computeComputerMove(afterPlayer);
  const afterComputer = afterPlayer.slice() as Mark[];
  afterComputer[computerCell] = COMPUTER;

  status = getStatus(afterComputer);
  return { board: afterComputer, status };
}
