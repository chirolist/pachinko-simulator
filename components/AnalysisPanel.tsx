"use client";

import { useRef, useState } from "react";
import {
  formatBalls,
  formatDecimal,
  formatOdds,
  formatPercent,
  formatYen,
} from "@/lib/pachinko/format";
import { createRng, parseSeed } from "@/lib/pachinko/random";
import { PachinkoEngine } from "@/lib/pachinko/simulation";
import { aggregateRuns, measureProbability, summarizeRun, type BatchReport, type ProbabilityReport } from "@/lib/pachinko/statistics";
import type { Spec } from "@/lib/pachinko/types";

const PROBABILITY_RUNS = [
  { label: "1万回転", spins: 10_000 },
  { label: "10万回転", spins: 100_000 },
  { label: "100万回転", spins: 1_000_000 },
];

const BATCH_RUNS = [
  { label: "100回", runs: 100 },
  { label: "1,000回", runs: 1_000 },
  { label: "10,000回", runs: 10_000 },
];

const GAME_SPIN_CAP = 500_000;

interface AnalysisPanelProps {
  spec: Spec;
  seed: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}

export function AnalysisPanel({ spec, seed, disabled, onBusyChange }: AnalysisPanelProps) {
  const [progress, setProgress] = useState(0);
  const [runningLabel, setRunningLabel] = useState<string | null>(null);
  const [probability, setProbability] = useState<ProbabilityReport | null>(null);
  const [batch, setBatch] = useState<BatchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedSeed, setUsedSeed] = useState<number | null>(null);
  const cancelRef = useRef(false);

  async function runProbability(spins: number, label: string) {
    const parsed = parseSeed(seed);
    if (!parsed.ok) {
      setError("シードが不正なため実行できません");
      return;
    }
    cancelRef.current = false;
    setError(null);
    setRunningLabel(label);
    setProgress(0);
    onBusyChange(true);
    const { rng, seed: actual } = createRng(parsed.seed);
    setUsedSeed(actual);
    const engine = new PachinkoEngine(
      { ...spec, investmentLimit: Number.POSITIVE_INFINITY },
      rng,
      { recordHistory: false, maxSpins: spins },
    );

    while (!engine.state.finished) {
      if (cancelRef.current) break;
      engine.run(20_000);
      setProgress(Math.min(1, engine.state.totalSpins / spins));
      await wait();
    }

    if (!cancelRef.current) setProbability(measureProbability(engine.state, spec));
    setRunningLabel(null);
    onBusyChange(false);
  }

  async function runBatch(runs: number, label: string) {
    const parsed = parseSeed(seed);
    if (!parsed.ok) {
      setError("シードが不正なため実行できません");
      return;
    }
    cancelRef.current = false;
    setError(null);
    setRunningLabel(label);
    setProgress(0);
    onBusyChange(true);
    const { seed: base } = createRng(parsed.seed);
    setUsedSeed(base);
    const summaries = [];

    for (let index = 0; index < runs; index += 1) {
      if (cancelRef.current) break;
      const { rng } = createRng((base + index) >>> 0);
      const engine = new PachinkoEngine(spec, rng, {
        recordHistory: false,
        maxSpins: GAME_SPIN_CAP,
      });
      engine.run();
      summaries.push(summarizeRun(engine.state, spec));
      if (index % 8 === 0 || index === runs - 1) {
        setProgress((index + 1) / runs);
        await wait();
      }
    }

    if (!cancelRef.current) setBatch(aggregateRuns(summaries));
    setRunningLabel(null);
    onBusyChange(false);
  }

  function cancel() {
    cancelRef.current = true;
  }

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-300">統計モード</h2>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        確率検証は投資上限を外して指定回転数まで回し、理論値と実測を比べます。複数回は現在の投資上限で1回ずつ最後まで打ちます。
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-2 text-xs text-zinc-400">確率検証</p>
          <div className="grid grid-cols-3 gap-2">
            {PROBABILITY_RUNS.map((item) => (
              <button
                key={item.spins}
                type="button"
                disabled={disabled || runningLabel != null}
                onClick={() => void runProbability(item.spins, item.label)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 text-xs disabled:opacity-40 sm:text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-zinc-400">複数回シミュレーション</p>
          <div className="grid grid-cols-3 gap-2">
            {BATCH_RUNS.map((item) => (
              <button
                key={item.runs}
                type="button"
                disabled={disabled || runningLabel != null}
                onClick={() => void runBatch(item.runs, item.label)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 text-xs disabled:opacity-40 sm:text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {runningLabel ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
            <span>{runningLabel}を実行中</span>
            <span className="font-mono">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gold" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <button type="button" className="mt-2 text-xs text-zinc-400 underline" onClick={cancel}>
            中断
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs text-bad">{error}</p> : null}
      {usedSeed != null ? (
        <p className="mt-3 text-[11px] text-zinc-500">
          基準シード <span className="font-mono text-zinc-300">{usedSeed}</span>
        </p>
      ) : null}

      {probability ? <ProbabilityTable report={probability} /> : null}
      {batch ? <BatchTable report={batch} /> : null}
    </section>
  );
}

function ProbabilityTable({ report }: { report: ProbabilityReport }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <h3 className="text-xs font-medium tracking-wide text-zinc-400">確率検証の結果</h3>
      <table className="mt-2 w-full min-w-[280px] text-left text-sm">
        <thead className="text-[11px] text-zinc-500">
          <tr>
            <th className="py-1 font-medium">項目</th>
            <th className="py-1 font-medium">理論</th>
            <th className="py-1 font-medium">実測</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs sm:text-sm">
          <tr>
            <td className="py-1.5 text-zinc-300">初当たり確率</td>
            <td>{formatOdds(report.theoreticalInitialRate)}</td>
            <td>{formatOdds(report.measuredInitialRate)}</td>
          </tr>
          <tr>
            <td className="py-1.5 text-zinc-300">ST突入率</td>
            <td>{formatPercent(report.theoreticalStEntryRate)}</td>
            <td>{formatPercent(report.measuredStEntryRate)}</td>
          </tr>
          <tr>
            <td className="py-1.5 text-zinc-300">ST中当選確率</td>
            <td>{formatOdds(report.theoreticalStHitRate)}</td>
            <td>{formatOdds(report.measuredStHitRate)}</td>
          </tr>
        </tbody>
      </table>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Mini label="総回転数" value={`${formatDecimal(report.spins, 0)}回転`} />
        <Mini label="通常 / ST" value={`${formatDecimal(report.normalSpins, 0)} / ${formatDecimal(report.stSpins, 0)}`} />
        <Mini label="大当たり回数" value={`${formatDecimal(report.jackpots, 0)}回`} />
        <Mini label="1万回転あたり" value={`${formatDecimal(report.jackpotsPer10k, 2)}回`} />
        <Mini label="差玉" value={formatBalls(report.diffBalls, true)} />
        <Mini label="投資額" value={formatYen(report.investment)} />
        <Mini label="理論収支" value={formatYen(report.profit, true)} />
        <Mini label="最大 / 最低差玉" value={`${formatBalls(report.maxDiffBalls, true)} / ${formatBalls(report.minDiffBalls, true)}`} />
      </dl>
    </div>
  );
}

function BatchTable({ report }: { report: BatchReport }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-medium tracking-wide text-zinc-400">複数回シミュレーションの結果</h3>
      <p className={`mt-2 font-mono text-3xl tabular-nums ${report.winRate > 0 ? "text-gold" : "text-white"}`}>
        勝率 {formatPercent(report.winRate)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        勝ち {formatDecimal(report.wins, 0)}回　負け {formatDecimal(report.losses, 0)}回
        {report.draws > 0 ? `　引き分け ${formatDecimal(report.draws, 0)}回` : ""}
        {"　"}/ {formatDecimal(report.runs, 0)}回
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Mini label="平均最終差玉" value={formatBalls(report.meanDiff, true)} />
        <Mini label="最終差玉の中央値" value={formatBalls(report.medianDiff, true)} />
        <Mini label="最終差玉の最大" value={formatBalls(report.maxDiff, true)} />
        <Mini label="最終差玉の最小" value={formatBalls(report.minDiff, true)} />
        <Mini label="最高到達差玉" value={formatBalls(report.bestPeak, true)} />
        <Mini label="最低到達差玉" value={formatBalls(report.worstTrough, true)} />
        <Mini label="平均投資" value={formatYen(report.meanInvestment)} />
        <Mini label="平均収支" value={formatYen(report.meanProfit, true)} />
        <Mini label="平均大当たり" value={`${formatDecimal(report.meanJackpots, 2)}回`} />
        <Mini label="平均初当たり" value={`${formatDecimal(report.meanInitialJackpots, 2)}回`} />
        <Mini label="平均ST突入" value={`${formatDecimal(report.meanStEntries, 2)}回`} />
        <Mini label="平均ST継続" value={`${formatDecimal(report.meanStJackpots, 2)}回`} />
        <Mini label="平均回転数" value={`${formatDecimal(report.meanSpins, 0)}回転`} />
      </dl>
      {report.cappedRuns > 0 ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          {formatDecimal(report.cappedRuns, 0)}回は安全上限（{GAME_SPIN_CAP.toLocaleString("ja-JP")}回転）で打ち切っています。
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        勝率は最終収支が0円より大きい試行の割合です。最終差玉は終了時点の値で、上限まで打って持ち玉が尽きると貸玉分のマイナスで揃います。最高到達と最低到達は、各回の途中の山と谷です。
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2">
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
