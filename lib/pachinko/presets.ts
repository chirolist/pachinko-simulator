import type { Spec } from "./types";

export type PresetId = "default" | "fast" | "tight" | "custom";

export const DEFAULT_SPEC: Spec = {
  investmentLimit: 50_000,
  ballsPerThousand: 250,
  spinsPerThousand: 16,
  initialHitDenominator: 319,
  initialPayout: 1500,
  stEntryRate: 0.55,
  stSpins: 144,
  stHitDenominator: 99,
  stPayout: 1500,
  exchangeRate: 4,
};

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
}

export const PRESETS: Preset[] = [
  { id: "default", name: "デフォルト", description: "1,000円あたり16回転" },
  { id: "fast", name: "回る台", description: "1,000円あたり18回転" },
  { id: "tight", name: "渋い台", description: "1,000円あたり12回転" },
  { id: "custom", name: "ユーザー設定", description: "入力中の値" },
];

export const INVESTMENT_CHIPS = [10_000, 30_000, 50_000, 100_000, 200_000];
export const SPIN_CHIPS = [12, 14, 16, 18, 20];

export function ballsPerSpin(spec: Spec): number {
  return spec.ballsPerThousand / spec.spinsPerThousand;
}

export function sanitizeSpec(input: Partial<Spec> | null | undefined): Spec {
  const source = input ?? {};
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return {
    investmentLimit: Math.max(1, num(source.investmentLimit, DEFAULT_SPEC.investmentLimit)),
    ballsPerThousand: Math.max(1, num(source.ballsPerThousand, DEFAULT_SPEC.ballsPerThousand)),
    spinsPerThousand: Math.max(1, num(source.spinsPerThousand, DEFAULT_SPEC.spinsPerThousand)),
    initialHitDenominator: Math.max(
      1,
      num(source.initialHitDenominator, DEFAULT_SPEC.initialHitDenominator),
    ),
    initialPayout: Math.max(0, num(source.initialPayout, DEFAULT_SPEC.initialPayout)),
    stEntryRate: clamp01(num(source.stEntryRate, DEFAULT_SPEC.stEntryRate)),
    stSpins: Math.max(1, Math.round(num(source.stSpins, DEFAULT_SPEC.stSpins))),
    stHitDenominator: Math.max(1, num(source.stHitDenominator, DEFAULT_SPEC.stHitDenominator)),
    stPayout: Math.max(0, num(source.stPayout, DEFAULT_SPEC.stPayout)),
    exchangeRate: Math.max(0.01, num(source.exchangeRate, DEFAULT_SPEC.exchangeRate)),
  };
}

export function applyPreset(id: PresetId): Spec {
  if (id === "fast") return { ...DEFAULT_SPEC, spinsPerThousand: 18 };
  if (id === "tight") return { ...DEFAULT_SPEC, spinsPerThousand: 12 };
  return { ...DEFAULT_SPEC };
}

export function detectPreset(spec: Spec): PresetId {
  const keys = Object.keys(DEFAULT_SPEC) as (keyof Spec)[];
  const sameExceptSpins = keys.every(
    (key) => key === "spinsPerThousand" || spec[key] === DEFAULT_SPEC[key],
  );
  if (!sameExceptSpins) return "custom";
  if (spec.spinsPerThousand === 18) return "fast";
  if (spec.spinsPerThousand === 12) return "tight";
  if (spec.spinsPerThousand === 16) return "default";
  return "custom";
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
