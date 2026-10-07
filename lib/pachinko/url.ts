import { detectPreset, sanitizeSpec, type PresetId } from "./presets";
import { DEFAULT_SPEC } from "./presets";
import type { Spec } from "./types";

const SPEC_PARAMS: { key: string; field: keyof Spec; percent?: boolean }[] = [
  { key: "investment", field: "investmentLimit" },
  { key: "balls", field: "ballsPerThousand" },
  { key: "spins", field: "spinsPerThousand" },
  { key: "probability", field: "initialHitDenominator" },
  { key: "payout", field: "initialPayout" },
  { key: "stRate", field: "stEntryRate", percent: true },
  { key: "st", field: "stSpins" },
  { key: "stProb", field: "stHitDenominator" },
  { key: "stPayout", field: "stPayout" },
  { key: "exchange", field: "exchangeRate" },
];

export interface SharedSettings {
  spec: Spec;
  seed: string;
  presetId: PresetId;
}

export function serializeSettings(spec: Spec, seed: string): string {
  const params = new URLSearchParams();
  params.set("investment", String(spec.investmentLimit));
  params.set("balls", String(spec.ballsPerThousand));
  params.set("spins", String(spec.spinsPerThousand));
  params.set("probability", String(spec.initialHitDenominator));
  params.set("payout", String(spec.initialPayout));
  params.set("stRate", String(Math.round(spec.stEntryRate * 1000) / 10));
  params.set("st", String(spec.stSpins));
  params.set("stProb", String(spec.stHitDenominator));
  params.set("stPayout", String(spec.stPayout));
  params.set("exchange", String(spec.exchangeRate));
  if (seed.trim()) params.set("seed", seed.trim());
  return params.toString();
}

export function parseSettings(search: string): SharedSettings | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  let found = false;
  const draft: Partial<Spec> = { ...DEFAULT_SPEC };

  for (const item of SPEC_PARAMS) {
    const raw = params.get(item.key);
    if (raw == null || raw.trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    found = true;
    draft[item.field] = item.percent ? normalizePercent(value) : value;
  }

  const seed = params.get("seed") ?? "";
  if (seed.trim()) found = true;
  if (!found) return null;

  const spec = sanitizeSpec(draft);
  return { spec, seed: seed.trim(), presetId: detectPreset(spec) };
}

function normalizePercent(value: number): number {
  if (value > 1) return value / 100;
  return value;
}
