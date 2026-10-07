"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { diffMoneyOf, formatAxisBalls, formatBalls, formatYen } from "@/lib/pachinko/format";
import type { ChartMarker, GraphPoint, HistoryKind, StInterval } from "@/lib/pachinko/types";

const MARKER_FILL: Record<HistoryKind, string> = {
  initial: "#e4b15a",
  "st-entry": "#5ec8ff",
  "st-hit": "#ff9f43",
  "st-end": "#8b97a8",
};

interface PayoutChartProps {
  points: GraphPoint[];
  markers: ChartMarker[];
  intervals: StInterval[];
  exchangeRate: number;
  currentDiff: number;
  maxDiff: number;
  minDiff: number;
  maxInvestment: number;
}

export function PayoutChart({
  points,
  markers,
  intervals,
  exchangeRate,
  currentDiff,
  maxDiff,
  minDiff,
  maxInvestment,
}: PayoutChartProps) {
  const domain = useMemo(() => yDomain(points, markers), [points, markers]);
  const last = points[points.length - 1];
  const visibleIntervals = intervals.length > 300 ? intervals.slice(-300) : intervals;

  return (
    <section className="panel flex flex-col p-4 sm:p-5" aria-label="出玉グラフ">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-300">出玉グラフ</h2>
          <p className="mt-1 text-xs text-zinc-500">横軸: 総回転数　縦軸: 差玉</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ChartStat label="現在差玉" value={formatBalls(currentDiff, true)} tone={toneOf(currentDiff)} />
        <ChartStat label="最大差玉" value={formatBalls(maxDiff, true)} tone={toneOf(maxDiff)} />
        <ChartStat label="最低差玉" value={formatBalls(minDiff, true)} tone={toneOf(minDiff)} />
        <ChartStat label="最大投資" value={formatYen(maxInvestment)} />
      </div>

      <div className="relative h-[320px] sm:h-[420px] lg:h-[520px]">
        {points.length < 2 ? (
          <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-zinc-500">
            シミュレーションを開始すると、回転ごとの差玉がここに描画されます
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="spin"
                type="number"
                domain={[0, "dataMax"]}
                tickFormatter={(value) => Number(value).toLocaleString("ja-JP")}
                stroke="#66758b"
                tick={{ fill: "#93a0b5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={domain}
                tickFormatter={(value) => formatAxisBalls(Number(value))}
                stroke="#66758b"
                tick={{ fill: "#93a0b5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={(props) => <DiffTooltip {...props} exchangeRate={exchangeRate} />}
                cursor={{ stroke: "rgba(228,177,90,0.45)", strokeDasharray: "4 4" }}
                wrapperStyle={{ outline: "none" }}
              />
              <ReferenceLine y={0} stroke="rgba(232,237,245,0.45)" strokeDasharray="4 4" />
              {visibleIntervals.map((interval) => (
                <ReferenceArea
                  key={`${interval.start}-${interval.end}`}
                  x1={interval.start}
                  x2={interval.end}
                  fill="#5ec8ff"
                  fillOpacity={0.08}
                  strokeOpacity={0}
                />
              ))}
              <Line
                type="monotone"
                dataKey="diffBalls"
                stroke="#e4b15a"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: "#e4b15a", stroke: "#080a0e" }}
              />
              {markers.length > 0 ? (
                <Scatter
                  data={markers}
                  dataKey="diffBalls"
                  isAnimationActive={false}
                  shape={(raw) => <MarkerShape {...raw} />}
                />
              ) : null}
              {last ? (
                <ReferenceDot
                  x={last.spin}
                  y={last.diffBalls}
                  r={4}
                  fill={last.diffBalls >= 0 ? "#3dcc8c" : "#ff6b81"}
                  stroke="#080a0e"
                  strokeWidth={1}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        <Legend swatch="#e4b15a" label="差玉" line />
        <Legend swatch="rgba(232,237,245,0.7)" label="0玉ライン" line />
        <Legend swatch="#5ec8ff" label="ST区間" />
        <Legend swatch={MARKER_FILL.initial} label="初当たり" />
        <Legend swatch={MARKER_FILL["st-entry"]} label="ST突入" />
        <Legend swatch={MARKER_FILL["st-hit"]} label="ST継続" />
        <Legend swatch={MARKER_FILL["st-end"]} label="ST終了" />
      </ul>
    </section>
  );
}

function ChartStat({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`font-mono text-sm tabular-nums sm:text-base ${tone}`}>{value}</p>
    </div>
  );
}

function Legend({ swatch, label, line = false }: { swatch: string; label: string; line?: boolean }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      {line ? (
        <span className="inline-block h-0.5 w-4 rounded" style={{ background: swatch }} />
      ) : (
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: swatch }} />
      )}
      {label}
    </li>
  );
}

function MarkerShape(props: { cx?: number; cy?: number; payload?: ChartMarker }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.kind === "st-end" ? 3 : 4.5}
      fill={MARKER_FILL[payload.kind]}
      stroke="#080a0e"
      strokeWidth={1}
    />
  );
}

function DiffTooltip({
  active,
  payload,
  exchangeRate,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  exchangeRate: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload
    .map((item) => item.payload)
    .find((item): item is GraphPoint => isGraphPoint(item));
  if (!point) return null;
  const money = diffMoneyOf(point.diffBalls, exchangeRate);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1016]/95 px-3 py-2 text-xs shadow-2xl">
      <p className="font-mono text-zinc-300">回転数：{point.spin.toLocaleString("ja-JP")}回転</p>
      <p className={`mt-1 font-mono ${toneOf(point.diffBalls)}`}>差玉：{formatBalls(point.diffBalls, true)}</p>
      <p className={`font-mono ${toneOf(money)}`}>差額：{formatYen(money, true)}</p>
      <p className="font-mono text-zinc-300">投資：{formatYen(point.investment)}</p>
      <p className="font-mono text-zinc-300">持ち玉：{formatBalls(point.balance)}</p>
      <p className="font-mono text-zinc-300">状態：{point.mode === "ST" ? "ST" : "通常"}</p>
      {point.label ? <p className="mt-1 text-gold">{point.label}</p> : null}
    </div>
  );
}

function isGraphPoint(value: unknown): value is GraphPoint {
  return (
    typeof value === "object" &&
    value != null &&
    "spin" in value &&
    "balance" in value &&
    "diffBalls" in value &&
    "mode" in value
  );
}

function yDomain(points: GraphPoint[], markers: ChartMarker[]): [number, number] {
  let min = 0;
  let max = 0;
  for (const point of points) {
    if (point.diffBalls < min) min = point.diffBalls;
    if (point.diffBalls > max) max = point.diffBalls;
  }
  for (const marker of markers) {
    if (marker.diffBalls < min) min = marker.diffBalls;
    if (marker.diffBalls > max) max = marker.diffBalls;
  }
  if (min === 0 && max === 0) return [-1000, 1000];
  const pad = Math.max(200, (max - min) * 0.12);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function toneOf(value: number): string {
  if (value > 0) return "text-good";
  if (value < 0) return "text-bad";
  return "text-white";
}
