"use client";

import type { Difficulty } from "@/lib/game/engine";

const OPTIONS: { value: Difficulty; label: string; description: string }[] = [
  { value: "easy", label: "Easy", description: "Random moves — no strategy." },
  { value: "medium", label: "Medium", description: "Takes obvious wins/blocks, nothing deeper." },
  { value: "hard", label: "Hard", description: "Perfect play — the best you can do is draw." },
];

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
}) {
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1];

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full rounded-lg border border-board-line bg-board-bg p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={[
              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              option.value === value ? "bg-x text-board-bg" : "text-white/60 hover:text-white",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="min-h-[2.5em] text-center text-xs text-white/50">{active.description}</p>
    </div>
  );
}
