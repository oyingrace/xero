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
} from "./engine";

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
  it("the computer never loses across many random-legal-move games", () => {
    for (let trial = 0; trial < 500; trial++) {
      let board: Board = EMPTY_BOARD;
      let status: ReturnType<typeof getStatus> = "active";
      while (status === "active") {
        const options = emptyCells(board);
        const cell = options[Math.floor(Math.random() * options.length)];
        ({ board, status } = applyPlayerMove(board, cell));
      }
      expect(status).not.toBe("player_won");
    }
  });
});
