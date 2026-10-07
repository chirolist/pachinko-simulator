"use client";

import {
  diffBallsOf,
  diffMoneyOf,
  formatBalls,
  formatCount,
  formatPercent,
  formatYen,
  profitOf,
} from "@/lib/pachinko/format";
import type { FinishReason, GameState, Spec } from "@/lib/pachinko/types";

interface ResultPanelProps {
  state: GameState;
  spec: Spec;
}

export function ResultPanel({ state, spec }: ResultPanelProps) {
  const diff = diffBallsOf(state.balance, state.loanedBalls);
  const profit = profitOf(state.balance, state.investment, spec.exchangeRate);
  const money = diffMoneyOf(diff, spec.exchangeRate);
  const stRate = state.initialJackpots > 0 ? state.stEntries / state.initialJackpots : null;

  return (
    <section className="panel p-4 sm:p-5" data-testid="result">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-300">シミュレーション結果</h2>
          <p className="mt-1 text-xs text-zinc-500">{finishText(state.finishReason)}</p>
        </div>
        <p className={`font-mono text-3xl tabular-nums ${toneOf(profit)}`}>{formatYen(profit, true)}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Item label="総投資" value={formatYen(state.investment)} />
        <Item label="最終持ち玉" value={formatBalls(state.balance)} />
        <Item label="最終差玉" value={formatBalls(diff, true)} tone={toneOf(diff)} />
        <Item label="最終収支" value={formatYen(profit, true)} tone={toneOf(profit)} />
        <Item label={`差額（${spec.exchangeRate}円換算）`} value={formatYen(money, true)} tone={toneOf(money)} />
        <Item label="総回転数" value={formatCount(state.totalSpins, "回転")} />
        <Item label="初当たり" value={formatCount(state.initialJackpots, "回")} />
        <Item label="大当たり" value={formatCount(state.jackpots, "回")} />
        <Item label="ST突入" value={formatCount(state.stEntries, "回")} />
        <Item label="ST継続大当たり" value={formatCount(state.stJackpots, "回")} />
        <Item label="ST突入率" value={formatPercent(stRate)} />
        <Item label="最大差玉" value={formatBalls(state.maxDiffBalls, true)} tone={toneOf(state.maxDiffBalls)} />
        <Item label="最低差玉" value={formatBalls(state.minDiffBalls, true)} tone={toneOf(state.minDiffBalls)} />
        <Item label="最大投資" value={formatYen(state.maxInvestment)} />
        <Item label="最大持ち玉" value={formatBalls(state.maxBalance)} />
      </dl>
    </section>
  );
}

export function StatsGrid({ state, spec }: { state: GameState; spec: Spec }) {
  const diff = diffBallsOf(state.balance, state.loanedBalls);
  const profit = profitOf(state.balance, state.investment, spec.exchangeRate);
  const stRate = state.initialJackpots > 0 ? state.stEntries / state.initialJackpots : null;
  const rows: [string, string][] = [
    ["総回転数", formatCount(state.totalSpins, "回転")],
    ["通常時回転数", formatCount(state.normalSpins, "回転")],
    ["ST回転数", formatCount(state.stSpins, "回転")],
    ["初当たり回数", formatCount(state.initialJackpots, "回")],
    ["ST突入回数", formatCount(state.stEntries, "回")],
    ["ST突入率", formatPercent(stRate)],
    ["ST中大当たり回数", formatCount(state.stJackpots, "回")],
    ["総大当たり回数", formatCount(state.jackpots, "回")],
    ["最大持ち玉", formatBalls(state.maxBalance)],
    ["最大差玉", formatBalls(state.maxDiffBalls, true)],
    ["最低差玉", formatBalls(state.minDiffBalls, true)],
    ["総投資", formatYen(state.investment)],
    ["最終持ち玉", formatBalls(state.balance)],
    ["最終差玉", formatBalls(diff, true)],
    ["理論収支", formatYen(profit, true)],
  ];

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-300">統計</h2>
      <p className="mt-1 text-xs text-zinc-500">
        理論収支は持ち玉 × {spec.exchangeRate}円 − 投資額です。差玉は持ち玉から貸玉累計を引いた値です。
      </p>
      <dl className="mt-3 divide-y divide-white/6">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <dt className="text-zinc-400">{label}</dt>
            <dd className="font-mono tabular-nums text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Item({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2">
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className={`mt-1 font-mono text-base tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

function finishText(reason: FinishReason | null): string {
  if (reason === "LIMIT") return "投資上限に達し、持ち玉がなくなったため終了しました";
  if (reason === "STOPPED") return "停止した時点の結果です";
  if (reason === "SPIN_LIMIT") return "表示負荷を避けるため、10万回転で停止しました";
  return "終了";
}

function toneOf(value: number): string {
  if (value > 0) return "text-good";
  if (value < 0) return "text-bad";
  return "text-white";
}
