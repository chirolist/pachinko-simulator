"use client";

import { diffBallsOf, diffMoneyOf, formatBalls, formatCount, formatYen, profitOf } from "@/lib/pachinko/format";
import type { GameState, Spec } from "@/lib/pachinko/types";

interface StatusBoardProps {
  state: GameState;
  spec: Spec;
  running: boolean;
}

export function StatusBoard({ state, spec, running }: StatusBoardProps) {
  const diff = diffBallsOf(state.balance, state.loanedBalls);
  const money = diffMoneyOf(diff, spec.exchangeRate);
  const profit = profitOf(state.balance, state.investment, spec.exchangeRate);
  const inSt = state.mode === "ST";

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">現在の状況</h2>
        {running ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-gold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            シミュレーション中
          </span>
        ) : null}
      </div>

      <div
        className={`mb-3 rounded-xl px-3 py-2 ${inSt ? "bg-cyan/10 text-cyan" : "bg-white/5 text-zinc-200"}`}
        data-testid="mode"
      >
        <p className="text-[11px] tracking-wide text-zinc-400">現在の状態</p>
        <p className="font-mono text-lg">
          {inSt ? `ST中　残り ${formatCount(state.stRemaining)}回転` : "通常時"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="投資額" value={formatYen(state.investment)} testId="investment" />
        <Metric label="現在の持ち玉" value={formatBalls(state.balance)} testId="balance" />
        <Metric label="差玉" value={formatBalls(diff, true)} tone={toneOf(diff)} testId="diff" />
        <Metric
          label={`差額（${spec.exchangeRate}円換算）`}
          value={formatYen(money, true)}
          tone={toneOf(money)}
          testId="diff-money"
        />
        <Metric label="総回転数" value={formatCount(state.totalSpins, "回転")} testId="spins" />
        <Metric label="理論収支" value={formatYen(profit, true)} tone={toneOf(profit)} testId="profit" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Small label="初当たり" value={formatCount(state.initialJackpots, "回")} testId="initial-hits" />
        <Small label="大当たり" value={formatCount(state.jackpots, "回")} testId="jackpots" />
        <Small label="ST突入" value={formatCount(state.stEntries, "回")} testId="st-entries" />
        <Small label="ST継続" value={formatCount(state.stJackpots, "回")} testId="st-hits" />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "text-white",
  testId,
}: {
  label: string;
  value: string;
  tone?: string;
  testId: string;
}) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums sm:text-xl ${tone}`} data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

function Small({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg border border-white/6 px-2 py-1.5">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="font-mono text-sm tabular-nums" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

function toneOf(value: number): string {
  if (value > 0) return "text-good";
  if (value < 0) return "text-bad";
  return "text-white";
}
