import { diffMoneyOf, roundBalls, roundMoney } from "./format";
import { ballsPerSpin } from "./presets";
import type {
  ChartMarker,
  GameEvent,
  GameEventType,
  GameState,
  GraphPoint,
  HistoryRow,
  Rng,
  Spec,
  StInterval,
} from "./types";

export interface EngineOptions {
  /** false のときはグラフと履歴を残さない。大量試行用。 */
  recordHistory?: boolean;
  /** この回転数に達したら SPIN_LIMIT で止める。 */
  maxSpins?: number;
}

const EPS = 1e-6;

export function createInitialState(): GameState {
  return {
    mode: "NORMAL",
    balance: 0,
    investment: 0,
    loanedBalls: 0,
    totalSpins: 0,
    normalSpins: 0,
    stSpins: 0,
    stRemaining: 0,
    jackpots: 0,
    initialJackpots: 0,
    stJackpots: 0,
    stEntries: 0,
    maxBalance: 0,
    maxDiffBalls: 0,
    minDiffBalls: 0,
    maxInvestment: 0,
    finished: false,
    finishReason: null,
  };
}

export class PachinkoEngine {
  readonly state: GameState;
  readonly points: GraphPoint[];
  readonly events: GameEvent[];
  private spec: Spec;
  private readonly rng: Rng;
  private nextEventId = 1;
  private readonly recordHistory: boolean;
  private readonly maxSpins: number;
  private displayCache: GraphPoint[] = [];
  private displayCacheSpin = -1;

  constructor(spec: Spec, rng: Rng, options?: EngineOptions) {
    this.spec = spec;
    this.rng = rng;
    this.recordHistory = options?.recordHistory !== false;
    this.maxSpins = options?.maxSpins ?? Number.POSITIVE_INFINITY;
    this.state = createInitialState();
    this.points = [];
    this.events = [];
    if (this.recordHistory) this.points.push(this.capturePoint());
  }

  setSpec(spec: Spec): void {
    this.spec = spec;
  }

  /** 1回転進める。終了していれば true。 */
  step(): boolean {
    if (this.state.finished) return true;
    if (this.state.totalSpins >= this.maxSpins) {
      this.finish("SPIN_LIMIT");
      return true;
    }
    if (!this.topUp()) {
      this.finish("LIMIT");
      return true;
    }

    const cost = ballsPerSpin(this.spec);
    this.state.balance = roundBalls(this.state.balance - cost);
    this.state.totalSpins += 1;
    const labels: string[] = [];

    if (this.state.mode === "NORMAL") {
      this.spinNormal(labels);
    } else {
      this.spinSt(labels);
    }

    this.updateExtremes();
    if (this.recordHistory) {
      const point = this.capturePoint();
      if (labels.length > 0) point.label = labels.join(" / ");
      this.points.push(point);
    }
    return false;
  }

  /** 終了するか、maxSteps 回進むまで回す。 */
  run(maxSteps = Number.POSITIVE_INFINITY): void {
    let count = 0;
    while (!this.state.finished && count < maxSteps) {
      this.step();
      count += 1;
    }
  }

  stop(): void {
    if (!this.state.finished) this.finish("STOPPED");
  }

  getDisplayPoints(): GraphPoint[] {
    const points = this.points;
    if (points.length === 0) return [];
    if (points.length <= 1200) return points.slice();

    const spin = this.state.totalSpins;
    if (
      this.displayCache.length === 0 ||
      spin - this.displayCacheSpin >= 30 ||
      this.state.finished
    ) {
      this.displayCache = downsamplePoints(points, 900);
      this.displayCacheSpin = spin;
    }

    const last = points[points.length - 1]!;
    const cached = this.displayCache;
    if (cached[cached.length - 1]?.spin === last.spin) {
      const copy = cached.slice();
      copy[copy.length - 1] = last;
      return copy;
    }
    return cached.concat(last);
  }

  private spinNormal(labels: string[]): void {
    this.state.normalSpins += 1;
    if (this.rng.next() >= 1 / this.spec.initialHitDenominator) return;

    this.state.balance = roundBalls(this.state.balance + this.spec.initialPayout);
    this.state.initialJackpots += 1;
    this.state.jackpots += 1;
    this.pushEvent("INITIAL_HIT", this.spec.initialPayout);
    labels.push("初当たり");

    if (this.rng.next() >= this.spec.stEntryRate) return;

    this.state.mode = "ST";
    this.state.stRemaining = this.spec.stSpins;
    this.state.stEntries += 1;
    this.pushEvent("ST_ENTRY", 0);
    labels.push("ST突入");
  }

  private spinSt(labels: string[]): void {
    this.state.stSpins += 1;
    if (this.rng.next() < 1 / this.spec.stHitDenominator) {
      this.state.balance = roundBalls(this.state.balance + this.spec.stPayout);
      this.state.stJackpots += 1;
      this.state.jackpots += 1;
      // 当たり回転では残数を減らさず、規定回転数へ戻す。
      this.state.stRemaining = this.spec.stSpins;
      this.pushEvent("ST_HIT", this.spec.stPayout);
      labels.push("ST中大当たり");
      return;
    }

    this.state.stRemaining -= 1;
    if (this.state.stRemaining > 0) return;
    this.state.stRemaining = 0;
    this.state.mode = "NORMAL";
    this.pushEvent("ST_END", 0);
    labels.push("ST終了");
  }

  /** 持ち玉が1回転分に満たないときだけ、1,000円単位で現金投資する。 */
  private topUp(): boolean {
    const cost = ballsPerSpin(this.spec);
    while (this.state.balance + EPS < cost) {
      const room = this.spec.investmentLimit - this.state.investment;
      if (room <= EPS) return false;
      const yen = Math.min(1000, room);
      this.state.investment = roundMoney(this.state.investment + yen);
      const balls = roundBalls(this.spec.ballsPerThousand * (yen / 1000));
      this.state.balance = roundBalls(this.state.balance + balls);
      this.state.loanedBalls = roundBalls(this.state.loanedBalls + balls);
    }
    return true;
  }

  private updateExtremes(): void {
    const diff = roundBalls(this.state.balance - this.state.loanedBalls);
    if (this.state.balance > this.state.maxBalance) this.state.maxBalance = this.state.balance;
    if (diff > this.state.maxDiffBalls) this.state.maxDiffBalls = diff;
    if (diff < this.state.minDiffBalls) this.state.minDiffBalls = diff;
    if (this.state.investment > this.state.maxInvestment) {
      this.state.maxInvestment = this.state.investment;
    }
  }

  private capturePoint(): GraphPoint {
    const diffBalls = roundBalls(this.state.balance - this.state.loanedBalls);
    return {
      spin: this.state.totalSpins,
      balance: this.state.balance,
      investment: this.state.investment,
      diffBalls,
      diffMoney: diffMoneyOf(diffBalls, this.spec.exchangeRate),
      mode: this.state.mode,
    };
  }

  private pushEvent(type: GameEventType, payout: number): void {
    if (!this.recordHistory) return;
    this.events.push({
      id: this.nextEventId,
      spin: this.state.totalSpins,
      type,
      payout,
      mode: this.state.mode,
      diffBalls: roundBalls(this.state.balance - this.state.loanedBalls),
      balance: this.state.balance,
      investment: this.state.investment,
    });
    this.nextEventId += 1;
  }

  private finish(reason: GameState["finishReason"]): void {
    this.state.finished = true;
    this.state.finishReason = reason;
  }
}

export function downsamplePoints(points: GraphPoint[], target = 800): GraphPoint[] {
  if (points.length <= target) return points.slice();

  const bucketCount = Math.max(1, target - 2);
  const result: GraphPoint[] = [points[0]!];
  const span = points.length - 2;

  for (let i = 0; i < bucketCount; i += 1) {
    const start = 1 + Math.floor((i * span) / bucketCount);
    const end = 1 + Math.floor(((i + 1) * span) / bucketCount);
    if (start >= points.length - 1 || start >= end) continue;

    let minPoint = points[start]!;
    let maxPoint = points[start]!;
    for (let j = start + 1; j < end; j += 1) {
      const point = points[j]!;
      if (point.diffBalls < minPoint.diffBalls) minPoint = point;
      if (point.diffBalls > maxPoint.diffBalls) maxPoint = point;
    }

    if (minPoint.spin === maxPoint.spin) result.push(minPoint);
    else if (minPoint.spin < maxPoint.spin) result.push(minPoint, maxPoint);
    else result.push(maxPoint, minPoint);
  }

  result.push(points[points.length - 1]!);
  return result;
}

export function buildHistory(events: GameEvent[]): HistoryRow[] {
  const rows: HistoryRow[] = [];

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    if (event.type === "ST_ENTRY") {
      const previous = events[i - 1];
      const last = rows[rows.length - 1];
      if (previous?.type === "INITIAL_HIT" && previous.spin === event.spin && last) {
        last.kind = "st-entry";
        last.note = "ST突入";
        continue;
      }
      rows.push(row(event, "ST突入", "ST開始", "st-entry"));
      continue;
    }
    if (event.type === "INITIAL_HIT") {
      rows.push(row(event, "初当たり", "通常時継続", "initial"));
      continue;
    }
    if (event.type === "ST_HIT") {
      rows.push(row(event, "ST中大当たり", "ST継続", "st-hit"));
      continue;
    }
    rows.push(row(event, "ST終了", "通常時へ", "st-end"));
  }

  return rows;
}

export function buildMarkers(events: GameEvent[]): ChartMarker[] {
  return buildHistory(events).map((item) => ({
    spin: item.spin,
    diffBalls: item.diffBalls,
    kind: item.kind,
    label: item.note === item.title ? item.title : `${item.title}・${item.note}`,
  }));
}

export function buildStIntervals(events: GameEvent[], totalSpins: number): StInterval[] {
  const intervals: StInterval[] = [];
  let start: number | null = null;

  for (const event of events) {
    if (event.type === "ST_ENTRY") start = event.spin;
    if (event.type === "ST_END" && start != null) {
      intervals.push({ start, end: event.spin });
      start = null;
    }
  }

  if (start != null) intervals.push({ start, end: Math.max(start, totalSpins) });
  return intervals;
}

export function sampleMarkers(markers: ChartMarker[], limit = 350): ChartMarker[] {
  if (markers.length <= limit) return markers;
  const stride = Math.ceil(markers.length / limit);
  const sampled: ChartMarker[] = [];
  for (let i = 0; i < markers.length; i += stride) sampled.push(markers[i]!);
  const last = markers[markers.length - 1]!;
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function row(
  event: GameEvent,
  title: string,
  note: string,
  kind: HistoryRow["kind"],
): HistoryRow {
  return {
    spin: event.spin,
    title,
    note,
    payout: event.payout,
    kind,
    diffBalls: event.diffBalls,
  };
}
