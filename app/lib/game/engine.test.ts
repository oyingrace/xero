import { describe, expect, it } from "vitest";
import {
  COMPUTER,
  EMPTY_BOARD,
  PLAYER,
  applyPlayerMove,
  computeComputerMove,
  emptyCells,
  getStatus,
  type Board,
  type Difficulty,
} from "./engine";

/** Always returns 0, so a difficulty's random fallback always picks emptyCells()[0]. */
const pickFirstCandidate = () => 0;

function play(moves: number[]): { board: Board; status: ReturnType<typeof getStatus> } {
  let board: Board = EMPTY_BOARD;
  let status: ReturnType<typeof getStatus> = "active";
  for (const move of moves) {
    ({ board, status } = applyPlayerMove(board, move));
    if (status !== "active") break;
  }
  return { board, status };
}

describe("basic rules", () => {
  it("takes the center after the player's opening corner", () => {
    const { board } = applyPlayerMove(EMPTY_BOARD, 0);
    expect(board[4]).toBe(COMPUTER);
  });

  it("takes a corner after the player opens with the center", () => {
    // The only non-losing reply to a center opening is a corner, not a side.
    const { board } = applyPlayerMove(EMPTY_BOARD, 4);
    expect([0, 2, 6, 8]).toContain(board.indexOf(COMPUTER));
  });

  it("wins immediately when a winning cell is available", () => {
    const board: Board = [COMPUTER, COMPUTER, 0, 0, PLAYER, 0, 0, 0, PLAYER];
    const cell = computeComputerMove(board);
    expect(cell).toBe(2);
  });

  it("blocks the player's immediate win", () => {
    // X has two in the left column; O must block at 6.
    const board: Board = [PLAYER, COMPUTER, 0, PLAYER, 0, 0, 0, 0, 0];
    const cell = computeComputerMove(board);
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
      while (status === "active") {
        const options = emptyCells(board);
        const cell = options[Math.floor(Math.random() * options.length)];
        ({ board, status } = applyPlayerMove(board, cell, "hard"));
      }
      expect(status).not.toBe("player_won");
    }
  });
});

describe("difficulty: medium", () => {
  it("still takes an immediate win when available", () => {
    const board: Board = [0, 0, 0, 0, 0, COMPUTER, 0, 0, COMPUTER]; // win at 2 (col 2,5,8)
    const cell = computeComputerMove(board, "medium", pickFirstCandidate);
    expect(cell).toBe(2);
  });

  it("still blocks the player's immediate win", () => {
    const board: Board = [PLAYER, 0, 0, PLAYER, 0, 0, 0, 0, 0]; // must block at 6
    const cell = computeComputerMove(board, "medium", pickFirstCandidate);
    expect(cell).toBe(6);
  });

  it("falls back to the injected random source when no win/block exists", () => {
    const board: Board = EMPTY_BOARD;
    // No win or block possible on an empty board, so this is pure random fallback.
    expect(computeComputerMove(board, "medium", pickFirstCandidate)).toBe(0);
  });

  it("can be forked and beaten (no lookahead), unlike hard", () => {
    // Same "X takes center, then an opposite corner" line that beat the old
    // heuristic and that hard's minimax survives (see engine.ts history).
    // Medium has no fork detection at all, so it loses outright here.
    let board: Board = EMPTY_BOARD;
    let status: ReturnType<typeof getStatus> = "active";
    for (const move of [4, 8, 2, 6]) {
      ({ board, status } = applyPlayerMove(board, move, "medium", pickFirstCandidate));
      if (status !== "active") break;
    }
    expect(status).toBe("player_won");
  });
});

describe("difficulty: easy", () => {
  it("ignores an available win and just plays the random candidate", () => {
    // Win is at cell 2, but it isn't the first empty cell — easy has no
    // strategy at all, so a random source that always picks "first empty
    // cell" should land on 0, not the win.
    const board: Board = [0, 0, 0, 0, 0, COMPUTER, 0, 0, COMPUTER];
    const cell = computeComputerMove(board, "easy", pickFirstCandidate);
    expect(cell).toBe(0);
  });

  it("ignores an immediate threat and doesn't necessarily block it", () => {
    const board: Board = [PLAYER, 0, 0, PLAYER, 0, 0, 0, 0, 0]; // threat at 6
    const cell = computeComputerMove(board, "easy", pickFirstCandidate);
    expect(cell).toBe(1); // first empty cell, not the block at 6
  });
});

describe("difficulty: legality across many games", () => {
  it.each<Difficulty>(["easy", "medium", "hard"])("%s always plays a legal move to completion", (difficulty) => {
    for (let trial = 0; trial < 100; trial++) {
      let board: Board = EMPTY_BOARD;
      let status: ReturnType<typeof getStatus> = "active";
      let guard = 0;
      while (status === "active") {
        if (++guard > 9) throw new Error("game did not terminate");
        const options = emptyCells(board);
        const cell = options[Math.floor(Math.random() * options.length)];
        ({ board, status } = applyPlayerMove(board, cell, difficulty));
      }
      expect(["player_won", "computer_won", "draw"]).toContain(status);
    }
  });
});
