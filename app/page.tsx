"use client";

import { useState } from "react";
import { Board } from "@/components/Board";
import { ConnectGate } from "@/components/ConnectGate";
import { DifficultyPicker } from "@/components/DifficultyPicker";
import type { Difficulty } from "@/lib/game/engine";
import { useTicTacToeGame } from "@/lib/game/useTicTacToeGame";

const STATUS_COPY: Record<string, string> = {
  active: "Your move",
  player_won: "You win",
  computer_won: "Computer wins",
  draw: "Draw",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function Home() {
  const {
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
  } = useTicTacToeGame();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const started = difficulty !== null;
  const gameOver = status !== "active";

  return (
    <ConnectGate requireWallet={mode === "onchain"}>
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center gap-6 px-6 py-10">
        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-white">xero</h1>
          <p className="text-sm text-white/50">
            {mode === "onchain" ? "Playing on Celo" : "Demo mode — no contract deployed yet"}
          </p>
        </header>

        {!started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="max-w-xs text-white/70">
              You&apos;re X, the computer is O. Play the whole game free — you only sign a
              transaction once, to save the result. Only Hard is truly unbeatable; Easy and Medium
              can be beaten.
            </p>
            <DifficultyPicker value={selectedDifficulty} onChange={setSelectedDifficulty} />
            <button onClick={() => startGame(selectedDifficulty)} className="btn-primary max-w-xs">
              Start game
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  "font-mono text-lg font-medium",
                  status === "player_won" ? "text-x" : "",
                  status === "computer_won" ? "text-o" : "",
                  status === "draw" ? "text-white/70" : "",
                  status === "active" ? "text-white" : "",
                ].join(" ")}
              >
                {STATUS_COPY[status]}
              </div>
              {difficulty && (
                <span className="text-xs uppercase tracking-wide text-white/40">
                  {DIFFICULTY_LABEL[difficulty]}
                </span>
              )}
            </div>

            <Board board={board} status={status} onPlay={playCell} />

            {error && <p className="text-sm text-red-400">{error}</p>}

            {gameOver && (
              <div className="flex w-full flex-col items-center gap-4">
                {mode === "onchain" && !isSubmitted && (
                  <button onClick={submitResult} disabled={isBusy} className="btn-primary max-w-xs">
                    {isBusy ? "Saving on-chain…" : "Save result on-chain"}
                  </button>
                )}

                {isSubmitted && gameId !== null && (
                  <p className="text-sm text-x">Saved on-chain — game #{gameId.toString()}</p>
                )}

                <DifficultyPicker value={selectedDifficulty} onChange={setSelectedDifficulty} />
                <button
                  onClick={() => startGame(selectedDifficulty)}
                  disabled={isBusy}
                  className="btn-secondary max-w-xs"
                >
                  Play again
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </ConnectGate>
  );
}
