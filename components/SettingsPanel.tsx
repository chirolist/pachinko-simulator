"use client";

import type { ReactNode } from "react";
import {
  INVESTMENT_CHIPS,
  PRESETS,
  SPIN_CHIPS,
  ballsPerSpin,
  type PresetId,
} from "@/lib/pachinko/presets";
import type { Spec } from "@/lib/pachinko/types";

interface SettingsPanelProps {
  spec: Spec;
  presetId: PresetId;
  seed: string;
  seedError: boolean;
  activeSeed: number | null;
  disabled: boolean;
  onSpecChange: (patch: Partial<Spec>) => void;
  onPreset: (id: PresetId) => void;
  onSeedChange: (seed: string) => void;
  onCopySeed: () => void;
}

export function SettingsPanel({
  spec,
  presetId,
  seed,
  seedError,
  activeSeed,
  disabled,
  onSpecChange,
  onPreset,
  onSeedChange,
  onCopySeed,
}: SettingsPanelProps) {
  const consumption = ballsPerSpin(spec);

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-zinc-300">設定</h2>
          <p className="mt-1 text-xs text-zinc-500">現金投資と持ち玉は別に計算します</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => {
          const selected = preset.id === presetId;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled || preset.id === "custom"}
              onClick={() => onPreset(preset.id)}
              className={`rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed ${
                selected
                  ? "border-gold/70 bg-gold/12 text-white"
                  : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
              }`}
            >
              <span className="block text-sm font-medium">{preset.name}</span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">{preset.description}</span>
            </button>
          );
        })}
      </div>

      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
        <Group title="基本設定">
          <Field label="投資上限" hint="1,000円単位で追加。上限は現金投資額です">
            <input
              className="field-input"
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              value={spec.investmentLimit}
              onChange={(event) => setNumber(event.target.value, (value) => onSpecChange({ investmentLimit: value }))}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {INVESTMENT_CHIPS.map((value) => (
              <Chip
                key={value}
                selected={spec.investmentLimit === value}
                onClick={() => onSpecChange({ investmentLimit: value })}
              >
                {value.toLocaleString("ja-JP")}円
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="貸玉 / 1,000円">
              <input
                className="field-input"
                type="number"
                inputMode="decimal"
                min={1}
                step={10}
                value={spec.ballsPerThousand}
                onChange={(event) =>
                  setNumber(event.target.value, (value) => onSpecChange({ ballsPerThousand: value }))
                }
              />
            </Field>
            <Field label="回転数 / 1,000円">
              <input
                className="field-input"
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                value={spec.spinsPerThousand}
                onChange={(event) =>
                  setNumber(event.target.value, (value) => onSpecChange({ spinsPerThousand: value }))
                }
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SPIN_CHIPS.map((value) => (
              <Chip
                key={value}
                selected={spec.spinsPerThousand === value}
                onClick={() => onSpecChange({ spinsPerThousand: value })}
              >
                {value}回転
              </Chip>
            ))}
          </div>
          <p className="text-xs text-zinc-400">
            1回転あたり{" "}
            <span className="font-mono text-gold">
              {consumption.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}玉
            </span>{" "}
            を消費（{spec.ballsPerThousand} ÷ {spec.spinsPerThousand}）
          </p>
          <Field label="換金率（円 / 玉）" hint="理論収支用。店舗ごとの実換金率ではありません">
            <input
              className="field-input"
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.1}
              value={spec.exchangeRate}
              onChange={(event) => setNumber(event.target.value, (value) => onSpecChange({ exchangeRate: value }))}
            />
          </Field>
        </Group>

        <Group title="通常時">
          <Field label="初当たり確率" hint="各通常回転で 1 / 分母 を抽選">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-400">1 /</span>
              <input
                className="field-input"
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                value={spec.initialHitDenominator}
                onChange={(event) =>
                  setNumber(event.target.value, (value) => onSpecChange({ initialHitDenominator: value }))
                }
              />
            </div>
          </Field>
        </Group>

        <Group title="初当たり">
          <div className="grid grid-cols-2 gap-3">
            <Field label="初当たり出玉">
              <input
                className="field-input"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={spec.initialPayout}
                onChange={(event) => setNumber(event.target.value, (value) => onSpecChange({ initialPayout: value }))}
              />
            </Field>
            <Field label="ST突入率" hint="残りは通常時へ">
              <div className="flex items-center gap-2">
                <input
                  className="field-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(spec.stEntryRate * 1000) / 10}
                  onChange={(event) =>
                    setNumber(event.target.value, (value) =>
                      onSpecChange({ stEntryRate: Math.min(100, Math.max(0, value)) / 100 }),
                    )
                  }
                />
                <span className="text-sm text-zinc-400">%</span>
              </div>
            </Field>
          </div>
        </Group>

        <Group title="ST">
          <Field label="ST回転数" hint="ST中の大当たりで、この回転数にリセットします">
            <input
              className="field-input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={spec.stSpins}
              onChange={(event) => setNumber(event.target.value, (value) => onSpecChange({ stSpins: value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ST中当選確率">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-zinc-400">1 /</span>
                <input
                  className="field-input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={1}
                  value={spec.stHitDenominator}
                  onChange={(event) =>
                    setNumber(event.target.value, (value) => onSpecChange({ stHitDenominator: value }))
                  }
                />
              </div>
            </Field>
            <Field label="ST大当たり出玉">
              <input
                className="field-input"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={spec.stPayout}
                onChange={(event) => setNumber(event.target.value, (value) => onSpecChange({ stPayout: value }))}
              />
            </Field>
          </div>
        </Group>
      </fieldset>

      <details className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
        <summary className="cursor-pointer text-xs text-zinc-400">再現用シード</summary>
        <div className="mt-3 space-y-2">
          <input
            className="field-input"
            inputMode="numeric"
            placeholder="空欄なら開始時に自動採番"
            value={seed}
            disabled={disabled}
            onChange={(event) => onSeedChange(event.target.value)}
          />
          {seedError ? <p className="text-xs text-bad">0以上の整数（4294967295まで）を入力してください</p> : null}
          {activeSeed != null ? (
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
              <span>
                この試行のシード <span className="font-mono text-zinc-200">{activeSeed}</span>
              </span>
              <button type="button" className="text-gold" onClick={onCopySeed}>
                コピー
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">同じシードを指定すると、同じ抽選結果を再現できます。</p>
          )}
        </div>
      </details>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-medium tracking-[0.16em] text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function Chip({
  children,
  selected,
  onClick,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] ${
        selected ? "bg-gold text-black" : "bg-white/6 text-zinc-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function setNumber(raw: string, apply: (value: number) => void) {
  const value = Number(raw);
  if (Number.isFinite(value)) apply(value);
}
