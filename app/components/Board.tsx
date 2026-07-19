"use client";

import { findWinningLine, type Board as BoardState, type GameStatus } from "@/lib/game/engine";

interface BoardProps {
  board: BoardState;
  status: GameStatus;
  onPlay: (cell: number) => void;
  disabled?: boolean;
}

const MARK_LABEL = ["", "X", "O"] as const;

export function Board({ board, status, onPlay, disabled }: BoardProps) {
  const winningLine =
    status === "player_won"
      ? findWinningLine(board, 1)
      : status === "computer_won"
        ? findWinningLine(board, 2)
        : null;

  return (
    <div
      role="grid"
      aria-label="Tic-tac-toe board"
      className="grid w-full grid-cols-3 gap-2 rounded-2xl border border-board-line bg-board-bg p-2"
    >
      {board.map((mark, cell) => {
        const isEmpty = mark === 0;
        const isWinningCell = winningLine?.includes(cell) ?? false;
        const canPlay = status === "active" && isEmpty && !disabled;

        return (
          <button
            key={cell}
            type="button"
            role="gridcell"
            aria-label={isEmpty ? `Play cell ${cell + 1}` : `${MARK_LABEL[mark]}`}
            disabled={!canPlay}
            onClick={() => onPlay(cell)}
            className={[
              "flex aspect-square items-center justify-center rounded-xl font-mono text-4xl font-semibold transition-colors",
              "bg-board-cell",
              canPlay ? "hover:bg-board-cell/70 cursor-pointer" : "cursor-default",
              mark === 1 ? "text-x" : "",
              mark === 2 ? "text-o" : "",
              isWinningCell ? (mark === 1 ? "ring-2 ring-x" : "ring-2 ring-o") : "",
            ].join(" ")}
          >
            {MARK_LABEL[mark]}
          </button>
        );
      })}
    </div>
  );
}
