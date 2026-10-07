import type { PresetId } from "./presets";
import { sanitizeSpec } from "./presets";
import type { GameEvent, GameState, GraphPoint, Spec } from "./types";

const SETTINGS_KEY = "pachinko-simulator:settings:v1";
const RESULT_KEY = "pachinko-simulator:last-result:v1";

export interface StoredSettings {
  spec: Spec;
  seed: string;
  presetId: PresetId;
}

export interface StoredResult {
  savedAt: number;
  spec: Spec;
  seed: number | null;
  state: GameState;
  points: GraphPoint[];
  events: GameEvent[];
}

export function loadSettings(): StoredSettings | null {
  const raw = read(SETTINGS_KEY);
  if (!raw) return null;
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Partial<StoredSettings>;
  if (!record.spec) return null;
  const presetId = isPreset(record.presetId) ? record.presetId : "custom";
  return {
    spec: sanitizeSpec(record.spec),
    seed: typeof record.seed === "string" ? record.seed : "",
    presetId,
  };
}

export function saveSettings(settings: StoredSettings): void {
  write(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadLastResult(): StoredResult | null {
  const raw = read(RESULT_KEY);
  if (!raw) return null;
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Partial<StoredResult>;
  if (!record.state || !record.spec || !Array.isArray(record.points)) return null;
  return {
    savedAt: typeof record.savedAt === "number" ? record.savedAt : Date.now(),
    spec: sanitizeSpec(record.spec),
    seed: typeof record.seed === "number" ? record.seed : null,
    state: record.state,
    points: record.points,
    events: Array.isArray(record.events) ? record.events : [],
  };
}

export function saveLastResult(result: StoredResult): void {
  write(RESULT_KEY, JSON.stringify(result));
}

export function clearLastResult(): void {
  remove(RESULT_KEY);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* プライベートモードなどでは保存できない */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isPreset(value: unknown): value is PresetId {
  return value === "default" || value === "fast" || value === "tight" || value === "custom";
}
