import type { Difficulty } from "@/lib/game/engine";

/**
 * ABI for TicTacToe.sol (see contracts/src/TicTacToe.sol).
 *
 * Status encoding: 0 = None, 1 = Active, 2 = PlayerWon, 3 = ComputerWon, 4 = Draw.
 * Board cells: 0 = empty, 1 = player (X), 2 = computer (O).
 * Difficulty encoding: 0 = Easy, 1 = Medium, 2 = Hard.
 */
export const DIFFICULTY_CODE: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export const ticTacToeAbi = [
  {
    type: "function",
    name: "startGame",
    stateMutability: "nonpayable",
    inputs: [{ name: "difficulty", type: "uint8" }],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    type: "function",
    name: "makeMove",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "cell", type: "uint8" },
    ],
    outputs: [
      { name: "board", type: "uint8[9]" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "getGame",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "board", type: "uint8[9]" },
      { name: "status", type: "uint8" },
      { name: "difficulty", type: "uint8" },
    ],
  },
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "difficulty", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MoveMade",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "board", type: "uint8[9]", indexed: false },
      { name: "status", type: "uint8", indexed: false },
    ],
  },
] as const;
