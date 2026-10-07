import { diffBallsOf, profitOf, roundMoney } from "./format";
import type { GameState, Spec } from "./types";

export interface RunSummary {
  totalSpins: number;
  normalSpins: number;
  stSpins: number;
  initialJackpots: number;
  stEntries: number;
  stJackpots: number;
  jackpots: number;
  investment: number;
  balance: number;
  loanedBalls: number;
  diffBalls: number;
  profit: number;
  maxBalance: number;
  maxDiffBalls: number;
  minDiffBalls: number;
  capped: boolean;
}

export interface ProbabilityReport {
  spins: number;
  normalSpins: number;
  stSpins: number;
  initialJackpots: number;
  stEntries: number;
  stJackpots: number;
  jackpots: number;
  diffBalls: number;
  investment: number;
  balance: number;
  profit: number;
  maxDiffBalls: number;
  minDiffBalls: number;
  measuredInitialRate: number | null;
  theoreticalInitialRate: number;
  measuredStEntryRate: number | null;
  theoreticalStEntryRate: number;
  measuredStHitRate: number | null;
  theoreticalStHitRate: number;
  jackpotsPer10k: number;
}

export interface BatchReport {
  runs: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  meanDiff: number;
  medianDiff: number;
  maxDiff: number;
  minDiff: number;
  meanInvestment: number;
  meanProfit: number;
  meanJackpots: number;
  meanInitialJackpots: number;
  meanStJackpots: number;
  meanStEntries: number;
  meanSpins: number;
  cappedRuns: number;
  /** 各試行の途中で記録した最大差玉のうち、いちばん高いもの */
  bestPeak: number;
  /** 各試行の途中で記録した最低差玉のうち、いちばん低いもの */
  worstTrough: number;
  meanPeak: number;
}

export function summarizeRun(state: GameState, spec: Spec): RunSummary {
  const diffBalls = diffBallsOf(state.balance, state.loanedBalls);
  return {
    totalSpins: state.totalSpins,
    normalSpins: state.normalSpins,
    stSpins: state.stSpins,
    initialJackpots: state.initialJackpots,
    stEntries: state.stEntries,
    stJackpots: state.stJackpots,
    jackpots: state.jackpots,
    investment: state.investment,
    balance: state.balance,
    loanedBalls: state.loanedBalls,
    diffBalls,
    profit: profitOf(state.balance, state.investment, spec.exchangeRate),
    maxBalance: state.maxBalance,
    maxDiffBalls: state.maxDiffBalls,
    minDiffBalls: state.minDiffBalls,
    capped: state.finishReason === "SPIN_LIMIT",
  };
}

export function measureProbability(state: GameState, spec: Spec): ProbabilityReport {
  const summary = summarizeRun(state, spec);
  return {
    spins: summary.totalSpins,
    normalSpins: summary.normalSpins,
    stSpins: summary.stSpins,
    initialJackpots: summary.initialJackpots,
    stEntries: summary.stEntries,
    stJackpots: summary.stJackpots,
    jackpots: summary.jackpots,
    diffBalls: summary.diffBalls,
    investment: summary.investment,
    balance: summary.balance,
    profit: summary.profit,
    maxDiffBalls: summary.maxDiffBalls,
    minDiffBalls: summary.minDiffBalls,
    measuredInitialRate: ratio(summary.initialJackpots, summary.normalSpins),
    theoreticalInitialRate: 1 / spec.initialHitDenominator,
    measuredStEntryRate: ratio(summary.stEntries, summary.initialJackpots),
    theoreticalStEntryRate: spec.stEntryRate,
    measuredStHitRate: ratio(summary.stJackpots, summary.stSpins),
    theoreticalStHitRate: 1 / spec.stHitDenominator,
    jackpotsPer10k:
      summary.totalSpins > 0 ? (summary.jackpots / summary.totalSpins) * 10_000 : 0,
  };
}

export function aggregateRuns(runs: RunSummary[]): BatchReport {
  if (runs.length === 0) {
    return {
      runs: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      meanDiff: 0,
      medianDiff: 0,
      maxDiff: 0,
      minDiff: 0,
      meanInvestment: 0,
      meanProfit: 0,
      meanJackpots: 0,
      meanInitialJackpots: 0,
      meanStJackpots: 0,
      meanStEntries: 0,
      meanSpins: 0,
      cappedRuns: 0,
      bestPeak: 0,
      worstTrough: 0,
      meanPeak: 0,
    };
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let diffSum = 0;
  let investmentSum = 0;
  let profitSum = 0;
  let jackpotSum = 0;
  let initialSum = 0;
  let stJackpotSum = 0;
  let stEntrySum = 0;
  let spinSum = 0;
  let cappedRuns = 0;
  let maxDiff = -Infinity;
  let minDiff = Infinity;
  let bestPeak = -Infinity;
  let worstTrough = Infinity;
  let peakSum = 0;
  const diffs: number[] = [];

  for (const run of runs) {
    if (run.profit > 0) wins += 1;
    else if (run.profit < 0) losses += 1;
    else draws += 1;
    diffSum += run.diffBalls;
    investmentSum += run.investment;
    profitSum += run.profit;
    jackpotSum += run.jackpots;
    initialSum += run.initialJackpots;
    stJackpotSum += run.stJackpots;
    stEntrySum += run.stEntries;
    spinSum += run.totalSpins;
    if (run.capped) cappedRuns += 1;
    if (run.diffBalls > maxDiff) maxDiff = run.diffBalls;
    if (run.diffBalls < minDiff) minDiff = run.diffBalls;
    if (run.maxDiffBalls > bestPeak) bestPeak = run.maxDiffBalls;
    if (run.minDiffBalls < worstTrough) worstTrough = run.minDiffBalls;
    peakSum += run.maxDiffBalls;
    diffs.push(run.diffBalls);
  }

  const count = runs.length;
  return {
    runs: count,
    wins,
    losses,
    draws,
    winRate: wins / count,
    meanDiff: roundMoney(diffSum / count),
    medianDiff: median(diffs),
    maxDiff,
    minDiff,
    meanInvestment: roundMoney(investmentSum / count),
    meanProfit: roundMoney(profitSum / count),
    meanJackpots: jackpotSum / count,
    meanInitialJackpots: initialSum / count,
    meanStJackpots: stJackpotSum / count,
    meanStEntries: stEntrySum / count,
    meanSpins: spinSum / count,
    cappedRuns,
    bestPeak,
    worstTrough,
    meanPeak: roundMoney(peakSum / count),
  };
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
