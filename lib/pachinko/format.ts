export function roundBalls(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 1000)) / 1000;
}

export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100)) / 100;
}

export function formatBalls(value: number, signed = false): string {
  const rounded = Math.round(value);
  const text = Math.abs(rounded).toLocaleString("ja-JP");
  if (!signed) return `${rounded.toLocaleString("ja-JP")}玉`;
  if (rounded > 0) return `+${text}玉`;
  if (rounded < 0) return `-${text}玉`;
  return "0玉";
}

export function formatYen(value: number, signed = false): string {
  const rounded = Math.round(value);
  const text = Math.abs(rounded).toLocaleString("ja-JP");
  if (!signed) return `¥${text}`;
  if (rounded > 0) return `+¥${text}`;
  if (rounded < 0) return `-¥${text}`;
  return "¥0";
}

export function formatCount(value: number, unit = ""): string {
  return `${Math.round(value).toLocaleString("ja-JP")}${unit}`;
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatOdds(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return "—";
  const denominator = 1 / rate;
  return `1/${denominator.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`;
}

export function formatAxisBalls(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  if (abs >= 10_000) {
    const man = abs / 10_000;
    const digits = abs >= 100_000 ? 0 : 1;
    return `${sign}${man.toFixed(digits)}万`;
  }
  return `${sign}${abs.toLocaleString("ja-JP")}`;
}

export function diffBallsOf(balance: number, loanedBalls: number): number {
  return roundBalls(balance - loanedBalls);
}

export function diffMoneyOf(diffBalls: number, exchangeRate: number): number {
  return roundMoney(diffBalls * exchangeRate);
}

/** 持ち玉を換金率で円にし、現金投資を引いた理論収支。 */
export function profitOf(balance: number, investment: number, exchangeRate: number): number {
  return roundMoney(balance * exchangeRate - investment);
}
