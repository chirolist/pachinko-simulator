"use client";

import { formatBalls, formatCount } from "@/lib/pachinko/format";
import type { HistoryKind, HistoryRow } from "@/lib/pachinko/types";

const KIND_CLASS: Record<HistoryKind, string> = {
  initial: "border-gold text-gold",
  "st-entry": "border-cyan text-cyan",
  "st-hit": "border-[#ff9f43] text-[#ffb067]",
  "st-end": "border-zinc-500 text-zinc-400",
};

interface HistoryPanelProps {
  history: HistoryRow[];
}

export function HistoryPanel({ history }: HistoryPanelProps) {
  const start = Math.max(0, history.length - 200);
  const visible = history.slice(start);

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-300">大当たり履歴</h2>
        <p className="text-[11px] text-zinc-500">
          {history.length > 200 ? `最新200件 / 全${formatCount(history.length)}件` : `${formatCount(history.length)}件`}
        </p>
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">初当たり・ST突入・ST終了がここに時系列で残ります。</p>
      ) : (
        <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {[...visible].reverse().map((row, index) => {
            const number = start + visible.length - index;
            return (
              <li key={`${row.spin}-${row.kind}-${number}`} className="rounded-xl border border-white/6 bg-black/20 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-zinc-500">#{number}</p>
                    <p className="mt-0.5 text-sm">{row.title}</p>
                    <p className="text-xs text-zinc-500">{formatCount(row.spin)}回転</p>
                  </div>
                  <div className="text-right">
                    {row.payout > 0 ? (
                      <p className="font-mono text-sm text-good">+{formatCount(row.payout)}玉</p>
                    ) : (
                      <p className="font-mono text-sm text-zinc-500">—</p>
                    )}
                    <p className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${KIND_CLASS[row.kind]}`}>
                      {row.note}
                    </p>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">その時点の差玉 {formatBalls(row.diffBalls, true)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
