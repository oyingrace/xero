"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { decodeEventLog } from "viem";
import { DIFFICULTY_CODE, ticTacToeAbi } from "@/lib/web3/ticTacToeAbi";
import { TIC_TAC_TOE_CONTRACT_ADDRESS } from "@/lib/web3/constants";
import {
  EMPTY_BOARD,
  applyPlayerMove,
  type Board,
  type Difficulty,
  type GameStatus,
} from "./engine";

export type GameMode = "onchain" | "demo";

export interface TicTacToeGame {
  /** "onchain" once a contract address is configured, otherwise "demo". */
  mode: GameMode;
  board: Board;
  status: GameStatus;
  gameId: bigint | null;
  difficulty: Difficulty | null;
  /** True while a move (or game start) is being submitted/confirmed. */
  isBusy: boolean;
  error: string | null;
  startGame: (difficulty: Difficulty) => Promise<void>;
  playCell: (cell: number) => Promise<void>;
}

const STATUS_BY_CODE: GameStatus[] = ["active", "active", "player_won", "computer_won", "draw"];

/**
 * Drives a game of tic-tac-toe.
 *
 * When `NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS` is set, every move is a
 * real transaction against `TicTacToe.sol` — the contract places X, runs
 * its on-chain minimax for O, and returns the updated board. Without a
 * deployed contract this falls back to the identical game engine running
 * locally ("demo mode"), so the game is fully playable before deployment.
 */
export function useTicTacToeGame(): TicTacToeGame {
  const mode: GameMode = TIC_TAC_TOE_CONTRACT_ADDRESS ? "onchain" : "demo";
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [status, setStatus] = useState<GameStatus>("active");
  const [gameId, setGameId] = useState<bigint | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(
    async (chosenDifficulty: Difficulty) => {
      setError(null);
      setBoard(EMPTY_BOARD);
      setStatus("active");
      setDifficulty(chosenDifficulty);

      if (mode === "demo") {
        setGameId(BigInt(0));
        return;
      }

      if (!TIC_TAC_TOE_CONTRACT_ADDRESS || !publicClient) return;
      setIsBusy(true);
      try {
        const hash = await writeContractAsync({
          address: TIC_TAC_TOE_CONTRACT_ADDRESS,
          abi: ticTacToeAbi,
          functionName: "startGame",
          args: [DIFFICULTY_CODE[chosenDifficulty]],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: ticTacToeAbi, ...log });
            if (decoded.eventName === "GameStarted") {
              setGameId(decoded.args.gameId);
              return;
            }
          } catch {
            // Not a GameStarted log from this contract — skip.
          }
        }
        setError("Game started, but the game id couldn't be read back.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start the game.");
      } finally {
        setIsBusy(false);
      }
    },
    [mode, publicClient, writeContractAsync],
  );

  const playCell = useCallback(
    async (cell: number) => {
      if (status !== "active" || board[cell] !== 0) return;
      setError(null);

      if (mode === "demo") {
        const result = applyPlayerMove(board, cell, difficulty ?? "hard");
        setBoard(result.board);
        setStatus(result.status);
        return;
      }

      if (!TIC_TAC_TOE_CONTRACT_ADDRESS || !publicClient || gameId === null || !address) return;
      setIsBusy(true);
      try {
        const hash = await writeContractAsync({
          address: TIC_TAC_TOE_CONTRACT_ADDRESS,
          abi: ticTacToeAbi,
          functionName: "makeMove",
          args: [gameId, cell],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: ticTacToeAbi, ...log });
            if (decoded.eventName === "MoveMade") {
              setBoard(decoded.args.board as unknown as Board);
              setStatus(STATUS_BY_CODE[Number(decoded.args.status)] ?? "active");
              return;
            }
          } catch {
            // Not a MoveMade log from this contract — skip.
          }
        }
        setError("Move confirmed, but the board update couldn't be read back.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit the move.");
      } finally {
        setIsBusy(false);
      }
    },
    [address, board, difficulty, gameId, mode, publicClient, status, writeContractAsync],
  );

  return { mode, board, status, gameId, difficulty, isBusy, error, startGame, playCell };
}
