"use client";

import { Board } from "@/components/Board";
import { ConnectGate } from "@/components/ConnectGate";
import { useTicTacToeGame } from "@/lib/game/useTicTacToeGame";

const STATUS_COPY: Record<string, string> = {
  active: "Your move",
  player_won: "You win",
  computer_won: "Computer wins",
  draw: "Draw",
};

export default function Home() {
  const { mode, board, status, gameId, isBusy, error, startGame, playCell } = useTicTacToeGame();
  const started = gameId !== null;

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
              You&apos;re X, the computer is O. The computer plays perfectly — the best you can do
              is a draw, but see if you can catch it out.
            </p>
            <button onClick={startGame} disabled={isBusy} className="btn-primary max-w-xs">
              {isBusy ? "Starting…" : "Start game"}
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-6">
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

            <Board board={board} status={status} onPlay={playCell} disabled={isBusy} />

            {error && <p className="text-sm text-red-400">{error}</p>}

            {status !== "active" && (
              <button onClick={startGame} disabled={isBusy} className="btn-secondary max-w-xs">
                Play again
              </button>
            )}
          </div>
        )}
      </main>
    </ConnectGate>
  );
}
