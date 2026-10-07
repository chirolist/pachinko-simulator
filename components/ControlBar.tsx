"use client";

export const SPEEDS = [
  { id: "slow", label: "ゆっくり", spinsPerSecond: 100 },
  { id: "normal", label: "普通", spinsPerSecond: 200 },
  { id: "fast", label: "高速", spinsPerSecond: 350 },
  { id: "ultra", label: "超高速", spinsPerSecond: 500 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]["id"];

interface ControlBarProps {
  running: boolean;
  busy: boolean;
  speed: SpeedId;
  onStart: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeed: (speed: SpeedId) => void;
}

export function ControlBar({ running, busy, speed, onStart, onStep, onReset, onSpeed }: ControlBarProps) {
  const current = SPEEDS.find((item) => item.id === speed) ?? SPEEDS[1];

  return (
    <section className="panel p-4 sm:p-5">
      <button
        type="button"
        data-testid={running ? "stop" : "start"}
        disabled={busy}
        onClick={onStart}
        className={`flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          running ? "bg-bad text-white" : "bg-gold text-black hover:bg-[#f0c36e]"
        }`}
      >
        {running ? "停止" : "シミュレーション開始"}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="step"
          disabled={running || busy}
          onClick={onStep}
          className="h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          1回転進める
        </button>
        <button
          type="button"
          data-testid="reset"
          onClick={onReset}
          className="h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-100"
        >
          リセット
        </button>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>速度</span>
          <span className="font-mono">約{current.spinsPerSecond}回転/秒</span>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1">
          {SPEEDS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === speed}
              onClick={() => onSpeed(item.id)}
              className={`h-9 rounded-lg text-[11px] sm:text-xs ${
                item.id === speed ? "bg-zinc-100 text-black" : "text-zinc-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
