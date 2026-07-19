/**
 * Tic-tac-toe rules + the computer opponent's move selection.
 *
 * Three difficulties:
 * - "hard": perfect minimax (depth-adjusted so it prefers a faster win and
 *   a slower loss). The board is tiny — at most 8 empty cells when the
 *   computer is ever asked to move — so an exhaustive search is instant
 *   and, unlike heuristic shortcuts (win/block/fork/block-fork rules), is
 *   mathematically guaranteed to never lose. An earlier heuristic version
 *   of this file was proven beatable by a fuzz test (random move sequence
 *   `[4, 8, 2, 6]`) before minimax replaced it — see engine.test.ts for the
 *   regression coverage that caught it. On hard, the best a player can do
 *   is draw. Never uses `seed`.
 * - "medium": takes an immediate win or blocks an immediate loss when one
 *   is available, otherwise plays a seeded-random empty cell. No deeper
 *   lookahead, so it can be forked and beaten.
 * - "easy": always a seeded-random empty cell. No strategy at all.
 *
 * The whole game is played locally, then submitted to `TicTacToe.sol` in
 * one transaction as a move list plus the `seed` used here — the contract
 * replays the game itself and only that replay is authoritative. For that
 * to work, Easy/Medium's "random" fallback has to be exactly reproducible:
 * `seededEmptyCellIndex` computes `keccak256(seed, moveIndex) % emptyCount`
 * the same way `_randomEmptyCell`/`_bestMove` do on-chain, so what the
 * player sees while playing always matches what gets recorded. Keep the
 * two in sync if either changes.
 */
import { encodePacked, keccak256 } from "viem";

export const EMPTY = 0;
export const PLAYER = 1; // X, moves first
export const COMPUTER = 2; // O, moves second

export type Mark = typeof EMPTY | typeof PLAYER | typeof COMPUTER;
export type Board = readonly Mark[]; // length 9

export type GameStatus = "active" | "player_won" | "computer_won" | "draw";
export type Difficulty = "easy" | "medium" | "hard";

export const EMPTY_BOARD: Board = Array(9).fill(EMPTY);

/** A fresh 256-bit random seed for a new game (see the module comment). */
export function generateSeed(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes.reduce((acc, byte) => (acc << BigInt(8)) | BigInt(byte), BigInt(0));
}

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

/** First empty cell that would complete a line for `mark`, or -1 if none. */
function findWinningMove(board: Board, mark: Mark): number {
  for (const line of LINES) {
    const marks = line.map((cell) => board[cell]);
    if (marks.filter((m) => m === mark).length === 2 && marks.filter((m) => m === EMPTY).length === 1) {
      return line[marks.indexOf(EMPTY)];
    }
  }
  return -1;
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

/** Perfect play: exhaustive minimax. Never loses — see the module comment. */
function computeHardMove(board: Board): number {
  const candidates = emptyCells(board);
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

/**
 * The `seed`-th empty cell, in board order — the exact formula
 * `_randomEmptyCell` uses on-chain, so a client that knows `seed` ahead of
 * time can always reproduce the contract's choice.
 */
function seededEmptyCellIndex(board: Board, seed: bigint, moveIndex: number): number {
  const hash = keccak256(encodePacked(["uint256", "uint8"], [seed, moveIndex]));
  const randomValue = BigInt(hash);
  const candidates = emptyCells(board);
  const target = randomValue % BigInt(candidates.length);
  return candidates[Number(target)];
}

/** Takes an immediate win or block if available, otherwise a seeded-random cell. */
function computeMediumMove(board: Board, seed: bigint, moveIndex: number): number {
  const winMove = findWinningMove(board, COMPUTER);
  if (winMove !== -1) return winMove;

  const blockMove = findWinningMove(board, PLAYER);
  if (blockMove !== -1) return blockMove;

  return seededEmptyCellIndex(board, seed, moveIndex);
}

/**
 * Picks the computer's (O's) next move against the current board.
 * Assumes it is the computer's turn and the game is still active.
 *
 * `seed` and `moveIndex` drive Easy/Medium's random fallback (unused on
 * "hard", which is fully deterministic) — see the module comment on why
 * they need to be reproducible rather than plain `Math.random()`.
 */
export function computeComputerMove(
  board: Board,
  difficulty: Difficulty,
  seed: bigint,
  moveIndex: number,
): number {
  if (emptyCells(board).length === 0) throw new Error("computeComputerMove: board is full");

  switch (difficulty) {
    case "easy":
      return seededEmptyCellIndex(board, seed, moveIndex);
    case "medium":
      return computeMediumMove(board, seed, moveIndex);
    case "hard":
      return computeHardMove(board);
  }
}

/**
 * Applies a player move, then (if the game continues) the computer's
 * reply. `moveIndex` is this move's 0-based position in the game (the
 * same index the eventual `playGame(difficulty, seed, moves)` call will
 * use for `moves[moveIndex]`).
 */
export function applyPlayerMove(
  board: Board,
  cell: number,
  difficulty: Difficulty,
  seed: bigint,
  moveIndex: number,
): { board: Board; status: GameStatus } {
  if (board[cell] !== EMPTY) throw new Error("applyPlayerMove: cell is occupied");

  const afterPlayer = board.slice() as Mark[];
  afterPlayer[cell] = PLAYER;

  let status = getStatus(afterPlayer);
  if (status !== "active") return { board: afterPlayer, status };

  const computerCell = computeComputerMove(afterPlayer, difficulty, seed, moveIndex);
  const afterComputer = afterPlayer.slice() as Mark[];
  afterComputer[computerCell] = COMPUTER;

  status = getStatus(afterComputer);
  return { board: afterComputer, status };
}
