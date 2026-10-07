import type { Rng } from "./types";

/** mulberry32。同じシードなら同じ乱数列を返す。 */
export function createRng(seed?: number | null): { rng: Rng; seed: number } {
  const actual = seed == null ? randomSeed() : seed >>> 0;
  let state = actual;

  const rng: Rng = {
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };

  return { rng, seed: actual };
}

export function randomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0]!;
  }
  return Math.floor(Math.random() * 0x1_0000_0000);
}

export function parseSeed(raw: string): { ok: true; seed: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, seed: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > 0xffffffff) return { ok: false };
  return { ok: true, seed: value };
}
