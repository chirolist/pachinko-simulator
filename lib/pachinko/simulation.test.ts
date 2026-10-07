import assert from "node:assert/strict";
import { test } from "node:test";
import { diffBallsOf, profitOf } from "./format.ts";
import { DEFAULT_SPEC, applyPreset, ballsPerSpin, detectPreset } from "./presets.ts";
import { createRng } from "./random.ts";
import { PachinkoEngine, buildHistory, buildStIntervals } from "./simulation.ts";
import { aggregateRuns, summarizeRun } from "./statistics.ts";
import { parseSettings, serializeSettings } from "./url.ts";
import type { Rng, Spec } from "./types.ts";

const never: Rng = { next: () => 0.999999 };
const always: Rng = { next: () => 0 };

function scripted(values: number[]): Rng {
  let index = 0;
  return {
    next() {
      if (index >= values.length) throw new Error(`乱数を使い切りました (${index})`);
      const value = values[index]!;
      index += 1;
      return value;
    },
  };
}

test("デフォルトは1回転15.625玉", () => {
  assert.equal(ballsPerSpin(DEFAULT_SPEC), 15.625);
});

test("ハズレの1回転は1000円を投資して玉を消費する", () => {
  const engine = new PachinkoEngine(DEFAULT_SPEC, never);
  engine.step();
  assert.equal(engine.state.investment, 1000);
  assert.equal(engine.state.loanedBalls, 250);
  assert.equal(engine.state.balance, 234.375);
  assert.equal(diffBallsOf(engine.state.balance, engine.state.loanedBalls), -15.625);
  assert.equal(engine.state.totalSpins, 1);
  assert.equal(engine.state.normalSpins, 1);
  assert.equal(engine.state.mode, "NORMAL");
  assert.equal(engine.points.length, 2);
});

test("16回転ちょうどで貸玉を使い切り、17回転目で追加投資する", () => {
  const engine = new PachinkoEngine(DEFAULT_SPEC, never);
  engine.run(16);
  assert.equal(engine.state.balance, 0);
  assert.equal(engine.state.investment, 1000);
  assert.equal(engine.state.finished, false);

  engine.step();
  assert.equal(engine.state.investment, 2000);
  assert.equal(engine.state.loanedBalls, 500);
  assert.equal(engine.state.totalSpins, 17);
});

test("投資上限に達して持ち玉が尽きると終了する", () => {
  const spec: Spec = { ...DEFAULT_SPEC, investmentLimit: 1000 };
  const engine = new PachinkoEngine(spec, never);
  engine.run();
  assert.equal(engine.state.finished, true);
  assert.equal(engine.state.finishReason, "LIMIT");
  assert.equal(engine.state.investment, 1000);
  assert.equal(engine.state.balance, 0);
  assert.equal(engine.state.totalSpins, 16);
});

test("投資上限後も持ち玉があれば継続する", () => {
  const spec: Spec = { ...DEFAULT_SPEC, investmentLimit: 1000 };
  const engine = new PachinkoEngine(spec, scripted([0, 0.9]));
  engine.step();
  const rest = { next: () => 0.999999 };
  const continued = new PachinkoEngine(spec, rest);
  continued.state.balance = engine.state.balance;
  continued.state.investment = engine.state.investment;
  continued.state.loanedBalls = engine.state.loanedBalls;
  continued.state.totalSpins = engine.state.totalSpins;
  continued.state.normalSpins = engine.state.normalSpins;
  continued.state.jackpots = engine.state.jackpots;
  continued.state.initialJackpots = engine.state.initialJackpots;
  continued.run();

  assert.equal(continued.state.investment, 1000);
  assert.equal(continued.state.balance, 0);
  assert.equal(continued.state.finishReason, "LIMIT");
  assert.equal(continued.state.totalSpins, 112);
});

test("初当たりで1500玉を加え、45%なら通常時のまま", () => {
  const engine = new PachinkoEngine(DEFAULT_SPEC, scripted([0, 0.9]));
  engine.step();
  assert.equal(engine.state.initialJackpots, 1);
  assert.equal(engine.state.jackpots, 1);
  assert.equal(engine.state.stEntries, 0);
  assert.equal(engine.state.mode, "NORMAL");
  assert.equal(engine.state.balance, 1734.375);
  assert.equal(engine.events[0]?.type, "INITIAL_HIT");
  assert.equal(engine.events[0]?.payout, 1500);
  assert.equal(buildHistory(engine.events)[0]?.note, "通常時継続");
});

test("55%でSTに突入し残数は144", () => {
  const engine = new PachinkoEngine(DEFAULT_SPEC, scripted([0, 0]));
  engine.step();
  assert.equal(engine.state.mode, "ST");
  assert.equal(engine.state.stRemaining, 144);
  assert.equal(engine.state.stEntries, 1);
  assert.equal(engine.state.normalSpins, 1);
  assert.equal(engine.state.stSpins, 0);
  const history = buildHistory(engine.events);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.title, "初当たり");
  assert.equal(history[0]?.note, "ST突入");
});

test("STを144回転ハズレで終了して通常時へ戻る", () => {
  const values = [0, 0, ...Array.from({ length: 144 }, () => 0.999999)];
  const engine = new PachinkoEngine(DEFAULT_SPEC, scripted(values));
  engine.run(145);
  assert.equal(engine.state.mode, "NORMAL");
  assert.equal(engine.state.stRemaining, 0);
  assert.equal(engine.state.stSpins, 144);
  assert.equal(engine.state.stJackpots, 0);
  assert.equal(engine.events.at(-1)?.type, "ST_END");
  assert.deepEqual(buildStIntervals(engine.events, engine.state.totalSpins), [
    { start: 1, end: 145 },
  ]);
});

test("ST中の当たりは1500玉を加え残数を144にリセットする", () => {
  const engine = new PachinkoEngine(
    DEFAULT_SPEC,
    scripted([0, 0, 0.999999, 0.999999, 0.999999, 0]),
  );
  engine.run(4);
  assert.equal(engine.state.mode, "ST");
  assert.equal(engine.state.stRemaining, 141);
  engine.step();
  assert.equal(engine.state.stJackpots, 1);
  assert.equal(engine.state.jackpots, 2);
  assert.equal(engine.state.stRemaining, 144);
  assert.equal(engine.state.mode, "ST");
  assert.equal(engine.events.at(-1)?.type, "ST_HIT");
  assert.equal(engine.events.at(-1)?.payout, 1500);
});

test("回転数設定が玉の消費量を変える", () => {
  const spec: Spec = { ...DEFAULT_SPEC, spinsPerThousand: 10 };
  const engine = new PachinkoEngine(spec, never);
  engine.step();
  assert.equal(ballsPerSpin(spec), 25);
  assert.equal(engine.state.balance, 225);
});

test("同じシードは同じ結果になる", () => {
  const left = new PachinkoEngine(DEFAULT_SPEC, createRng(123456).rng, { recordHistory: false });
  const right = new PachinkoEngine(DEFAULT_SPEC, createRng(123456).rng, { recordHistory: false });
  left.run(2500);
  right.run(2500);
  assert.deepEqual(left.state, right.state);
});

test("別シードは通常、途中結果が一致しない", () => {
  const spec: Spec = { ...DEFAULT_SPEC, investmentLimit: Number.POSITIVE_INFINITY };
  const left = new PachinkoEngine(spec, createRng(1).rng, {
    recordHistory: false,
    maxSpins: 4000,
  });
  const right = new PachinkoEngine(spec, createRng(2).rng, {
    recordHistory: false,
    maxSpins: 4000,
  });
  left.run();
  right.run();
  assert.notEqual(left.state.initialJackpots, right.state.initialJackpots);
});

test("停止は投資上限前でも終了になる", () => {
  const engine = new PachinkoEngine(DEFAULT_SPEC, never);
  engine.step();
  engine.stop();
  assert.equal(engine.state.finishReason, "STOPPED");
  assert.equal(engine.step(), true);
  assert.equal(engine.state.totalSpins, 1);
});

test("差玉と理論収支", () => {
  assert.equal(diffBallsOf(6000, 5000), 1000);
  assert.equal(profitOf(0, 50_000, 4), -50_000);
  assert.equal(profitOf(2000, 0, 4), 8000);
});

test("勝率は最終収支がプラスの割合", () => {
  const spec = DEFAULT_SPEC;
  const base = summarizeRun(new PachinkoEngine(spec, never).state, spec);
  const report = aggregateRuns([
    { ...base, profit: 100, diffBalls: 10 },
    { ...base, profit: -50, diffBalls: -20 },
    { ...base, profit: -10, diffBalls: 5 },
    { ...base, profit: 0, diffBalls: 0 },
  ]);
  assert.equal(report.wins, 1);
  assert.equal(report.losses, 2);
  assert.equal(report.draws, 1);
  assert.equal(report.winRate, 0.25);
  assert.equal(report.medianDiff, 2.5);
});

test("URLパラメータを往復できる", () => {
  const spec: Spec = { ...DEFAULT_SPEC, spinsPerThousand: 18, investmentLimit: 30000 };
  const query = serializeSettings(spec, "99");
  const parsed = parseSettings(query);
  assert.equal(parsed?.spec.spinsPerThousand, 18);
  assert.equal(parsed?.spec.investmentLimit, 30000);
  assert.equal(parsed?.spec.initialHitDenominator, 319);
  assert.equal(parsed?.spec.stEntryRate, 0.55);
  assert.equal(parsed?.seed, "99");
  assert.equal(detectPreset({ ...DEFAULT_SPEC, spinsPerThousand: 18 }), "fast");
});

test("指定例のURLを読める", () => {
  const parsed = parseSettings("?investment=50000&spins=16&probability=319&st=144");
  assert.equal(parsed?.spec.investmentLimit, 50000);
  assert.equal(parsed?.spec.spinsPerThousand, 16);
  assert.equal(parsed?.spec.initialHitDenominator, 319);
  assert.equal(parsed?.spec.stSpins, 144);
  assert.equal(parsed?.presetId, "default");
});

test("プリセットは回転数だけを変えて他は初期値に戻す", () => {
  assert.equal(applyPreset("tight").spinsPerThousand, 12);
  assert.equal(applyPreset("fast").spinsPerThousand, 18);
  assert.equal(applyPreset("fast").initialHitDenominator, 319);
  assert.equal(detectPreset(applyPreset("tight")), "tight");
  assert.equal(detectPreset({ ...DEFAULT_SPEC, initialPayout: 2000 }), "custom");
});

test("実測の初当たり確率が理論値から大きく外れない", () => {
  const engine = new PachinkoEngine(
    { ...DEFAULT_SPEC, investmentLimit: Number.POSITIVE_INFINITY },
    createRng(42).rng,
    { recordHistory: false, maxSpins: 150_000 },
  );
  engine.run();
  const measured = engine.state.initialJackpots / engine.state.normalSpins;
  const theoretical = 1 / 319;
  assert.ok(engine.state.normalSpins > 10_000);
  assert.ok(Math.abs(measured - theoretical) / theoretical < 0.15);
});

test("ST中は常に当たる乱数でも残数が減らない", () => {
  const engine = new PachinkoEngine(DEFAULT_SPEC, always);
  engine.step();
  assert.equal(engine.state.mode, "ST");
  engine.step();
  assert.equal(engine.state.stRemaining, 144);
  assert.equal(engine.state.stJackpots, 1);
  assert.ok(engine.state.balance > 3000);
});
