"use client";

import dynamic from "next/dynamic";

const SimulatorApp = dynamic(
  () => import("@/components/SimulatorApp").then((mod) => mod.SimulatorApp),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center text-sm text-zinc-400">読み込み中...</main>
    ),
  },
);

export function SimulatorRoot() {
  return <SimulatorApp />;
}
