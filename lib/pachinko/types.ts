export type GameMode = "NORMAL" | "ST";

export type FinishReason = "LIMIT" | "STOPPED" | "SPIN_LIMIT";

export type GameEventType = "INITIAL_HIT" | "ST_ENTRY" | "ST_HIT" | "ST_END";

export type HistoryKind = "initial" | "st-entry" | "st-hit" | "st-end";

/** ユーザーが変更できる台スペック。確率は分母（1/n）か 0〜1 の率で持つ。 */
export interface Spec {
  /** 現金投資の上限（円） */
  investmentLimit: number;
  /** 1,000円あたりの貸玉 */
  ballsPerThousand: number;
  /** 1,000円あたりの通常回転数 */
  spinsPerThousand: number;
  /** 初当たり確率の分母。319 なら 1/319 */
  initialHitDenominator: number;
  /** 初当たり出玉 */
  initialPayout: number;
  /** ST突入率。0.55 なら 55% */
  stEntryRate: number;
  /** ST回転数。当たり時にこの値へリセットする */
  stSpins: number;
  /** ST中当選確率の分母。99 なら 1/99 */
  stHitDenominator: number;
  /** ST中大当たり出玉 */
  stPayout: number;
  /** 換金率（円/玉）。理論収支の計算に使う */
  exchangeRate: number;
}

export interface GameState {
  mode: GameMode;
  /** 現在の持ち玉 */
  balance: number;
  /** これまでに投入した現金 */
  investment: number;
  /** 現金で購入した貸玉の累計 */
  loanedBalls: number;
  totalSpins: number;
  normalSpins: number;
  stSpins: number;
  stRemaining: number;
  jackpots: number;
  initialJackpots: number;
  stJackpots: number;
  stEntries: number;
  maxBalance: number;
  maxDiffBalls: number;
  minDiffBalls: number;
  maxInvestment: number;
  finished: boolean;
  finishReason: FinishReason | null;
}

export interface GraphPoint {
  spin: number;
  balance: number;
  investment: number;
  diffBalls: number;
  diffMoney: number;
  mode: GameMode;
  label?: string;
}

export interface GameEvent {
  id: number;
  spin: number;
  type: GameEventType;
  payout: number;
  mode: GameMode;
  diffBalls: number;
  balance: number;
  investment: number;
}

export interface HistoryRow {
  spin: number;
  title: string;
  note: string;
  payout: number;
  kind: HistoryKind;
  diffBalls: number;
}

export interface ChartMarker {
  spin: number;
  diffBalls: number;
  kind: HistoryKind;
  label: string;
}

export interface StInterval {
  start: number;
  end: number;
}

export interface Rng {
  /** [0, 1) の乱数 */
  next(): number;
}
