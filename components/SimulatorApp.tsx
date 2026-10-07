"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ControlBar, SPEEDS, type SpeedId } from "@/components/ControlBar";
import { HistoryPanel } from "@/components/HistoryPanel";
import { PayoutChart } from "@/components/PayoutChart";
import { ResultPanel, StatsGrid } from "@/components/ResultPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StatusBoard } from "@/components/StatusBoard";
import { diffBallsOf } from "@/lib/pachinko/format";
import { parseSeed } from "@/lib/pachinko/random";
import { createRng } from "@/lib/pachinko/random";
import {
  applyPreset,
  DEFAULT_SPEC,
  detectPreset,
  sanitizeSpec,
  type PresetId,
} from "@/lib/pachinko/presets";
import {
  PachinkoEngine,
  buildHistory,
  buildMarkers,
  buildStIntervals,
  createInitialState,
  downsamplePoints,
  sampleMarkers,
} from "@/lib/pachinko/simulation";
import {
  clearLastResult,
  loadLastResult,
  loadSettings,
  saveLastResult,
  saveSettings,
  type StoredResult,
} from "@/lib/pachinko/storage";
import type { ChartMarker, GameState, GraphPoint, HistoryRow, Spec, StInterval } from "@/lib/pachinko/types";
import { parseSettings, serializeSettings } from "@/lib/pachinko/url";

const MAX_SPINS = 100_000;

type Phase = "idle" | "running" | "manual" | "finished";

interface ViewState {
  state: GameState;
  points: GraphPoint[];
  history: HistoryRow[];
  markers: ChartMarker[];
  intervals: StInterval[];
}

const EMPTY_VIEW: ViewState = {
  state: createInitialState(),
  points: [],
  history: [],
  markers: [],
  intervals: [],
};

function readBoot(): {
  spec: Spec;
  seed: string;
  presetId: PresetId;
  previous: StoredResult | null;
} {
  const previous = loadLastResult();
  const fromUrl = parseSettings(window.location.search);
  if (fromUrl) {
    return { spec: fromUrl.spec, seed: fromUrl.seed, presetId: fromUrl.presetId, previous };
  }
  const stored = loadSettings();
  return {
    spec: stored?.spec ?? DEFAULT_SPEC,
    seed: stored?.seed ?? "",
    presetId: stored?.presetId ?? "default",
    previous,
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("timeout")), 800);
        }),
      ]);
      return true;
    }
  } catch {
    /* クリップボードが使えない環境では従来の選択コピーに落とす */
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function snapshotResult(engine: PachinkoEngine, spec: Spec, seed: number | null): StoredResult {
  return {
    savedAt: Date.now(),
    spec,
    seed,
    state: { ...engine.state },
    points: downsamplePoints(engine.points, 800),
    events: engine.events.slice(-400),
  };
}

export function SimulatorApp() {
  const [boot] = useState(readBoot);
  const [spec, setSpec] = useState(boot.spec);
  const [presetId, setPresetId] = useState(boot.presetId);
  const [seed, setSeed] = useState(boot.seed);
  const [activeSeed, setActiveSeed] = useState<number | null>(null);
  const [speed, setSpeed] = useState<SpeedId>("normal");
  const [phase, setPhase] = useState<Phase>("idle");
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [previous, setPrevious] = useState<StoredResult | null>(boot.previous);

  const engineRef = useRef<PachinkoEngine | null>(null);
  const runningRef = useRef(false);
  const frameRef = useRef(0);
  const specRef = useRef(spec);
  const seedRef = useRef(seed);
  const speedRef = useRef(speed);
  const activeSeedRef = useRef<number | null>(null);

  useEffect(() => {
    specRef.current = spec;
  }, [spec]);
  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const parsedSeed = parseSeed(seed);
  const seedError = !parsedSeed.ok;

  const publish = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) {
      setView(EMPTY_VIEW);
      return;
    }
    setView({
      state: { ...engine.state },
      points: engine.getDisplayPoints(),
      history: buildHistory(engine.events),
      markers: sampleMarkers(buildMarkers(engine.events)),
      intervals: buildStIntervals(engine.events, engine.state.totalSpins),
    });
  }, []);

  const freshEngine = useCallback(() => {
    const parsed = parseSeed(seedRef.current);
    const { rng, seed: used } = createRng(parsed.ok ? parsed.seed : null);
    const engine = new PachinkoEngine(specRef.current, rng, {
      recordHistory: true,
      maxSpins: MAX_SPINS,
    });
    engineRef.current = engine;
    activeSeedRef.current = used;
    setActiveSeed(used);
    return engine;
  }, []);

  useEffect(() => {
    saveSettings({ spec, seed, presetId });
  }, [spec, seed, presetId]);

  useEffect(() => {
    engineRef.current?.setSpec(spec);
  }, [spec]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function remember(engine: PachinkoEngine) {
    if (engine.state.totalSpins === 0) return;
    const result = snapshotResult(engine, specRef.current, activeSeedRef.current);
    saveLastResult(result);
    setPrevious(result);
  }

  function stopLoop() {
    runningRef.current = false;
    cancelAnimationFrame(frameRef.current);
  }

  function beginLoop() {
    let accumulator = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const engine = engineRef.current;
      if (!engine || !runningRef.current) return;
      const elapsed = Math.min(80, now - last);
      last = now;
      const rate = SPEEDS.find((item) => item.id === speedRef.current)?.spinsPerSecond ?? 200;
      accumulator += (rate * elapsed) / 1000;
      let steps = Math.floor(accumulator);
      accumulator -= steps;
      if (steps > 800) steps = 800;

      if (steps > 0) {
        for (let index = 0; index < steps; index += 1) {
          engine.step();
          if (engine.state.finished) break;
        }
        publish();
      }

      if (!runningRef.current) return;
      if (engine.state.finished) {
        stopLoop();
        publish();
        remember(engine);
        setPhase("finished");
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function updateSpec(patch: Partial<Spec>) {
    setSpec((current) => {
      const next = sanitizeSpec({ ...current, ...patch });
      specRef.current = next;
      setPresetId(detectPreset(next));
      return next;
    });
  }

  function selectPreset(id: PresetId) {
    if (id === "custom") return;
    const next = applyPreset(id);
    setSpec(next);
    setPresetId(id);
  }

  function start() {
    if (busy || seedError) return;
    if (runningRef.current) {
      stopLoop();
      engineRef.current?.stop();
      publish();
      if (engineRef.current) remember(engineRef.current);
      setPhase("finished");
      return;
    }
    let engine = engineRef.current;
    if (!engine || engine.state.finished) engine = freshEngine();
    engine.setSpec(specRef.current);
    runningRef.current = true;
    setPhase("running");
    beginLoop();
  }

  function step() {
    if (busy || runningRef.current || seedError) return;
    let engine = engineRef.current;
    if (!engine || engine.state.finished) engine = freshEngine();
    engine.setSpec(specRef.current);
    engine.step();
    publish();
    if (engine.state.finished) {
      remember(engine);
      setPhase("finished");
      return;
    }
    setPhase("manual");
  }

  function reset() {
    stopLoop();
    engineRef.current = null;
    activeSeedRef.current = null;
    setActiveSeed(null);
    setPhase("idle");
    setView(EMPTY_VIEW);
  }

  async function share() {
    const url = `${window.location.origin}/simulator?${serializeSettings(spec, seed)}`;
    const copied = await copyText(url);
    showToast(copied ? "設定URLをコピーしました" : "コピーに失敗しました");
  }

  async function copyActiveSeed() {
    if (activeSeed == null) return;
    try {
      await navigator.clipboard.writeText(String(activeSeed));
      setSeed(String(activeSeed));
      showToast("シードをコピーし、入力欄にも入れました");
    } catch {
      showToast("コピーに失敗しました");
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  const diff = diffBallsOf(view.state.balance, view.state.loanedBalls);
  const running = phase === "running";

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.22em] text-gold/80">PACHINKO ANALYTICS</p>
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight sm:text-2xl">
                パチンコシミュレーター
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void share()}
            className="h-10 shrink-0 rounded-xl border border-white/10 px-3 text-xs text-zinc-200 sm:text-sm"
          >
            設定を共有
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <SettingsPanel
            spec={spec}
            presetId={presetId}
            seed={seed}
            seedError={seedError}
            activeSeed={activeSeed}
            disabled={running || busy}
            onSpecChange={updateSpec}
            onPreset={selectPreset}
            onSeedChange={setSeed}
            onCopySeed={() => void copyActiveSeed()}
          />
          <ControlBar
            running={running}
            busy={busy || seedError}
            speed={speed}
            onStart={start}
            onStep={step}
            onReset={reset}
            onSpeed={setSpeed}
          />
          <StatusBoard state={view.state} spec={spec} running={running} />
        </div>

        <div className="min-w-0">
          <PayoutChart
            points={view.points}
            markers={view.markers}
            intervals={view.intervals}
            exchangeRate={spec.exchangeRate}
            currentDiff={diff}
            maxDiff={view.state.maxDiffBalls}
            minDiff={view.state.minDiffBalls}
            maxInvestment={view.state.maxInvestment}
          />
        </div>

        {phase === "finished" ? (
          <div className="lg:col-span-2">
            <ResultPanel state={view.state} spec={spec} />
          </div>
        ) : null}

        <div className="lg:col-span-2 grid gap-4 xl:grid-cols-2">
          <StatsGrid state={view.state} spec={spec} />
          <HistoryPanel history={view.history} />
        </div>

        <div className="lg:col-span-2">
          <AnalysisPanel spec={spec} seed={seed} disabled={running} onBusyChange={setBusy} />
        </div>

        {phase === "idle" && previous ? (
          <div className="lg:col-span-2">
            <PreviousResult
              result={previous}
              onDismiss={() => {
                clearLastResult();
                setPrevious(null);
              }}
            />
          </div>
        ) : null}
      </main>

      <footer className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6">
        <p className="text-[11px] leading-5 text-zinc-500">
          ※本シミュレーターは確率に基づく簡易シミュレーションです。実際の遊技結果を保証するものではありません。
        </p>
      </footer>

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-[#12171f] px-4 py-2 text-sm text-zinc-100 shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function PreviousResult({ result, onDismiss }: { result: StoredResult; onDismiss: () => void }) {
  const saved = new Date(result.savedAt).toLocaleString("ja-JP");
  return (
    <details className="panel p-4 sm:p-5">
      <summary className="cursor-pointer text-sm text-zinc-300">
        前回の結果を表示
        <span className="ml-2 text-xs text-zinc-500">{saved}</span>
      </summary>
      <div className="mt-4 space-y-4">
        <ResultPanel state={result.state} spec={result.spec} />
        <PayoutChart
          points={result.points}
          markers={sampleMarkers(buildMarkers(result.events))}
          intervals={buildStIntervals(result.events, result.state.totalSpins)}
          exchangeRate={result.spec.exchangeRate}
          currentDiff={diffBallsOf(result.state.balance, result.state.loanedBalls)}
          maxDiff={result.state.maxDiffBalls}
          minDiff={result.state.minDiffBalls}
          maxInvestment={result.state.maxInvestment}
        />
        <button type="button" className="text-xs text-zinc-400 underline" onClick={onDismiss}>
          保存した前回の結果を消す
        </button>
      </div>
    </details>
  );
}
