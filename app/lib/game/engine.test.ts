import { describe, expect, it } from "vitest";
import {
  COMPUTER,
  EMPTY_BOARD,
  PLAYER,
  applyPlayerMove,
  computeComputerMove,
  emptyCells,
  generateSeed,
  getStatus,
  type Board,
  type Difficulty,
} from "./engine";

function play(
  moves: number[],
  difficulty: Difficulty = "hard",
  seed: bigint = BigInt(0),
): { board: Board; status: ReturnType<typeof getStatus> } {
  let board: Board = EMPTY_BOARD;
  let status: ReturnType<typeof getStatus> = "active";
  for (let i = 0; i < moves.length; i++) {
    ({ board, status } = applyPlayerMove(board, moves[i], difficulty, seed, i));
    if (status !== "active") break;
  }
  return { board, status };
}

describe("basic rules", () => {
  it("takes the center after the player's opening corner", () => {
    const { board } = applyPlayerMove(EMPTY_BOARD, 0, "hard", BigInt(0), 0);
    expect(board[4]).toBe(COMPUTER);
  });

  it("takes a corner after the player opens with the center", () => {
    // The only non-losing reply to a center opening is a corner, not a side.
    const { board } = applyPlayerMove(EMPTY_BOARD, 4, "hard", BigInt(0), 0);
    expect([0, 2, 6, 8]).toContain(board.indexOf(COMPUTER));
  });

  it("wins immediately when a winning cell is available", () => {
    const board: Board = [COMPUTER, COMPUTER, 0, 0, PLAYER, 0, 0, 0, PLAYER];
    const cell = computeComputerMove(board, "hard", BigInt(0), 0);
    expect(cell).toBe(2);
  });

  it("blocks the player's immediate win", () => {
    // X has two in the left column; O must block at 6.
    const board: Board = [PLAYER, COMPUTER, 0, PLAYER, 0, 0, 0, 0, 0];
    const cell = computeComputerMove(board, "hard", BigInt(0), 0);
    expect(cell).toBe(6);
  });
});

describe("known attack sequences that beat a naive win/block/center/corner/side heuristic", () => {
  it("never loses to the classic opposite-corners opening", () => {
    const { status, board } = play([0, 8, 7, 2, 3]);
    expect(status).toBe("draw");
    expect(emptyCells(board)).toHaveLength(0);
  });

  it("never loses to the mirrored opposite-corners opening", () => {
    // Left-right mirror of the sequence above (0↔2, 3↔5, 6↔8; 1,4,7 fixed).
    const { status } = play([2, 6, 7, 0, 5]);
    expect(status).toBe("draw");
  });
});

describe("robustness against arbitrary play", () => {
  it("the computer never loses across many random-legal-move games on hard", () => {
    for (let trial = 0; trial < 500; trial++) {
      let board: Board = EMPTY_BOARD;
      let status: ReturnType<typeof getStatus> = "active";
      let moveIndex = 0;
      while (status === "active") {
        const options = emptyCells(board);
        const cell = options[Math.floor(Math.random() * options.length)];
        ({ board, status } = applyPlayerMove(board, cell, "hard", BigInt(trial), moveIndex));
        moveIndex++;
      }
      expect(status).not.toBe("player_won");
    }
  });

  it("hard ignores the seed entirely — different seeds give the same result", () => {
    const { status: statusA } = play([0, 8, 7, 2, 3], "hard", BigInt(1));
    const { status: statusB } = play([0, 8, 7, 2, 3], "hard", BigInt(999999));
    expect(statusA).toBe("draw");
    expect(statusB).toBe("draw");
  });
});

describe("seeded randomness (Easy/Medium)", () => {
  it("is deterministic: the same seed and move index always pick the same cell", () => {
    const board: Board = [PLAYER, 0, 0, PLAYER, 0, 0, 0, 0, 0];
    const first = computeComputerMove(board, "easy", BigInt(123), 0);
    const second = computeComputerMove(board, "easy", BigInt(123), 0);
    expect(first).toBe(second);
  });

  it("different seeds can produce different cells (not accidentally constant)", () => {
    const board: Board = [PLAYER, 0, 0, PLAYER, 0, 0, 0, 0, 0];
    const cellForSeed1 = computeComputerMove(board, "easy", BigInt(1), 0);
    const cellForSeed2 = computeComputerMove(board, "easy", BigInt(2), 0);
    expect(cellForSeed1).toBe(6);
    expect(cellForSeed2).toBe(5);
  });

  it("always lands on an empty cell, across many seeds", () => {
    const board: Board = [PLAYER, COMPUTER, 0, PLAYER, 0, 0, 0, 0, COMPUTER];
    for (let s = 0; s < 200; s++) {
      const cell = computeComputerMove(board, "easy", BigInt(s), 0);
      expect(board[cell]).toBe(0);
    }
  });

  it("generateSeed() produces large, distinct values", () => {
    const a = generateSeed();
    const b = generateSeed();
    expect(a).not.toBe(b);
    expect(a).toBeGreaterThan(BigInt(0));
  });
});

describe("difficulty: medium", () => {
  it("still takes an immediate win regardless of seed", () => {
    const board: Board = [0, 0, 0, 0, 0, COMPUTER, 0, 0, COMPUTER]; // win at 2 (col 2,5,8)
    expect(computeComputerMove(board, "medium", BigInt(1), 0)).toBe(2);
    expect(computeComputerMove(board, "medium", BigInt(999), 0)).toBe(2);
  });

  it("still blocks the player's immediate win regardless of seed", () => {
    const board: Board = [PLAYER, 0, 0, PLAYER, 0, 0, 0, 0, 0]; // must block at 6
    expect(computeComputerMove(board, "medium", BigInt(1), 0)).toBe(6);
    expect(computeComputerMove(board, "medium", BigInt(999), 0)).toBe(6);
  });

  it("falls back to the seeded random cell when no win/block exists", () => {
    // No win or block is possible this early, so this exercises pure fallback.
    const board: Board = [PLAYER, 0, 0, 0, 0, 0, 0, 0, 0];
    const cell = computeComputerMove(board, "medium", BigInt(123), 0);
    expect(board[cell]).toBe(0);
  });

  it("can be forked and beaten (no lookahead), unlike hard", () => {
    // Same "X takes center, then an opposite corner" line that beat an
    // earlier heuristic version of this engine and that hard's minimax
    // survives (see engine.ts's module comment). Medium has no fork
    // detection at all; seed 1 is a concrete case where it loses outright.
    const { status } = play([4, 8, 2, 6], "medium", BigInt(1));
    expect(status).toBe("player_won");
  });
});

describe("difficulty: easy", () => {
  it("ignores an available win and can land elsewhere", () => {
    // Win is at cell 2; seed 123 happens to land on cell 1 instead —
    // proof easy never even looks for the win.
    const board: Board = [0, 0, 0, 0, 0, COMPUTER, 0, 0, COMPUTER];
    const cell = computeComputerMove(board, "easy", BigInt(123), 0);
    expect(cell).toBe(1);
  });

  it("ignores an immediate threat and doesn't necessarily block it", () => {
    const board: Board = [PLAYER, 0, 0, PLAYER, 0, 0, 0, 0, 0]; // threat at 6
    const cell = computeComputerMove(board, "easy", BigInt(123), 0);
    expect(cell).toBe(2); // not the block at 6
  });
});

describe("difficulty: legality across many games", () => {
  it.each<Difficulty>(["easy", "medium", "hard"])("%s always plays a legal move to completion", (difficulty) => {
    for (let trial = 0; trial < 100; trial++) {
      let board: Board = EMPTY_BOARD;
      let status: ReturnType<typeof getStatus> = "active";
      let guard = 0;
      let moveIndex = 0;
      while (status === "active") {
        if (++guard > 9) throw new Error("game did not terminate");
        const options = emptyCells(board);
        const cell = options[Math.floor(Math.random() * options.length)];
        ({ board, status } = applyPlayerMove(board, cell, difficulty, BigInt(trial), moveIndex));
        moveIndex++;
      }
      expect(["player_won", "computer_won", "draw"]).toContain(status);
    }
  });
});
