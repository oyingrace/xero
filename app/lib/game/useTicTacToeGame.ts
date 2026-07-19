"use client";

import { useCallback, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { decodeEventLog } from "viem";
import { DIFFICULTY_CODE, ticTacToeAbi } from "@/lib/web3/ticTacToeAbi";
import { TIC_TAC_TOE_CONTRACT_ADDRESS } from "@/lib/web3/constants";
import {
  EMPTY_BOARD,
  applyPlayerMove,
  generateSeed,
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
  difficulty: Difficulty | null;
  /** Set once `submitResult` has confirmed on-chain. */
  gameId: bigint | null;
  /** True once this game's result has been recorded on-chain. */
  isSubmitted: boolean;
  /** True only while the final `playGame` transaction is pending. */
  isBusy: boolean;
  error: string | null;
  /** Starts a fresh game locally — no wallet or transaction involved. */
  startGame: (difficulty: Difficulty) => void;
  /** Plays a cell locally — no wallet or transaction involved. */
  playCell: (cell: number) => void;
  /** The one on-chain transaction: submits the finished game to be recorded. */
  submitResult: () => Promise<void>;
}

const STATUS_BY_CODE: GameStatus[] = ["active", "active", "player_won", "computer_won", "draw"];

/**
 * Drives a game of tic-tac-toe.
 *
 * The whole game is played locally (`startGame`/`playCell` never touch the
 * network) using the same engine `TicTacToe.sol` implements, seeded with a
 * fresh random value each game so Easy/Medium's random fallback is exactly
 * reproducible on-chain later. Once the game ends, `submitResult` — the
 * only network call in this hook — submits the full move list plus that
 * seed in a single `playGame` transaction; the contract independently
 * replays the game to determine the recorded outcome. Without a deployed
 * contract (`NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS` unset), this runs in
 * "demo mode": still fully playable, just nothing to submit.
 */
export function useTicTacToeGame(): TicTacToeGame {
  const mode: GameMode = TIC_TAC_TOE_CONTRACT_ADDRESS ? "onchain" : "demo";
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [status, setStatus] = useState<GameStatus>("active");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [seed, setSeed] = useState<bigint | null>(null);
  const [moves, setMoves] = useState<number[]>([]);
  const [gameId, setGameId] = useState<bigint | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback((chosenDifficulty: Difficulty) => {
    setError(null);
    setBoard(EMPTY_BOARD);
    setStatus("active");
    setDifficulty(chosenDifficulty);
    setSeed(generateSeed());
    setMoves([]);
    setGameId(null);
    setIsSubmitted(false);
  }, []);

  const playCell = useCallback(
    (cell: number) => {
      if (status !== "active" || board[cell] !== 0 || difficulty === null || seed === null) return;

      const moveIndex = moves.length;
      const result = applyPlayerMove(board, cell, difficulty, seed, moveIndex);
      setBoard(result.board);
      setStatus(result.status);
      setMoves((prev) => [...prev, cell]);
    },
    [board, difficulty, moves.length, seed, status],
  );

  const submitResult = useCallback(async () => {
    if (mode !== "onchain") return;
    if (status === "active" || difficulty === null || seed === null || moves.length === 0) return;
    if (!TIC_TAC_TOE_CONTRACT_ADDRESS || !publicClient || isSubmitted) return;

    setError(null);
    setIsBusy(true);
    try {
      const hash = await writeContractAsync({
        address: TIC_TAC_TOE_CONTRACT_ADDRESS,
        abi: ticTacToeAbi,
        functionName: "playGame",
        args: [DIFFICULTY_CODE[difficulty], seed, moves],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: ticTacToeAbi, ...log });
          if (decoded.eventName === "GamePlayed") {
            setGameId(decoded.args.gameId);
            setBoard(decoded.args.board as unknown as Board);
            setStatus(STATUS_BY_CODE[Number(decoded.args.status)] ?? status);
            setIsSubmitted(true);
            return;
          }
        } catch {
          // Not a GamePlayed log from this contract — skip.
        }
      }
      setError("Transaction confirmed, but the result couldn't be read back.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit the result.");
    } finally {
      setIsBusy(false);
    }
  }, [difficulty, isSubmitted, mode, moves, publicClient, seed, status, writeContractAsync]);

  return {
    mode,
    board,
    status,
    difficulty,
    gameId,
    isSubmitted,
    isBusy,
    error,
    startGame,
    playCell,
    submitResult,
  };
}
